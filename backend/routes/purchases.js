const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const Papa = require('papaparse');
const { validate } = require('../middleware/validator');
const { validateCSVImport } = require('../utils/validationHelpers');
const { AppError } = require('../middleware/errorHandler');

// Configure multer for CSV uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// Helper function to parse and normalize date formats
function normalizeDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  
  dateStr = dateStr.trim();
  
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // MM/YY or M/YY format (e.g., "03/28", "3/28") - PHARMACEUTICAL EXPIRY FORMAT
  const matchMonthYear = dateStr.match(/^(\d{1,2})\/(\d{2})$/);
  if (matchMonthYear) {
    const [_, month, year] = matchMonthYear;
    const fullYear = `20${year}`;
    const paddedMonth = month.padStart(2, '0');
    const lastDay = new Date(parseInt(fullYear), parseInt(month), 0).getDate();
    return `${fullYear}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;
  }
  
  // MM/DD/YYYY or M/D/YYYY
  const match1 = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match1) {
    const [_, month, day, year] = match1;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // DD-MM-YYYY or D-M-YYYY
  const match2 = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match2) {
    const [_, day, month, year] = match2;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // YYYY-MM or YYYY/MM format
  const matchYearMonth = dateStr.match(/^(\d{4})[-\/](\d{1,2})$/);
  if (matchYearMonth) {
    const [_, year, month] = matchYearMonth;
    const paddedMonth = month.padStart(2, '0');
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    return `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;
  }
  
  return null;
}

// Get all purchases
router.get('/', async (req, res, next) => {
  try {
    const [purchases] = await db.query(`
      SELECT 
        p.id,
        p.supplier_id,
        p.invoice_no,
        p.purchase_date,
        COALESCE(p.total_amount, 0) as total_amount,
        p.status,
        p.created_at,
        s.name as supplier_name,
        s.gst_number,
        s.dl_number
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      ORDER BY p.created_at DESC
    `);
    res.json(purchases);
  } catch (error) {
    next(error);
  }
});

// Get purchase details with items
router.get('/:id', async (req, res, next) => {
  try {
    const [purchase] = await db.query(`
      SELECT p.*, s.name as supplier_name, s.address, s.phone, s.gst_number, s.dl_number
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (purchase.length === 0) {
      throw new AppError('Purchase not found', 404, 'PURCHASE_NOT_FOUND');
    }

    const [items] = await db.query(`
      SELECT pi.*, m.name, m.salt, m.manufacturer, m.pack
      FROM purchase_items pi
      JOIN medicines m ON pi.medicine_id = m.id
      WHERE pi.purchase_id = ?
    `, [req.params.id]);

    res.json({ ...purchase[0], items });
  } catch (error) {
    next(error);
  }
});

// Add manual purchase order - WITH VALIDATION
router.post('/manual', validate('purchase'), async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { supplier_id, invoice_no, purchase_date, items } = req.body;

    if (!items || items.length === 0) {
      throw new AppError('Purchase must contain at least one item', 400, 'NO_ITEMS');
    }

    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => {
      const amount = parseFloat(item.amount) || 0;
      return sum + amount;
    }, 0);

    console.log('Manual Purchase - Total Amount:', totalAmount);

    // Insert purchase order
    const [purchaseResult] = await connection.query(
      'INSERT INTO purchases (supplier_id, invoice_no, purchase_date, total_amount, status) VALUES (?, ?, ?, ?, ?)',
      [supplier_id, invoice_no, purchase_date, totalAmount, 'pending']
    );

    const purchaseId = purchaseResult.insertId;

    // Process each item
    for (const item of items) {
      // Find or create medicine (consistent lookup by name, salt, manufacturer)
      let [medicine] = await connection.query(
        'SELECT id, default_margin FROM medicines WHERE name = ? AND salt = ? AND manufacturer = ?',
        [item.product_name.trim(), item.salt || '', item.mfg || '']
      );

      let medicineId;
      let margin;

      if (medicine.length === 0) {
        // NEW MEDICINE - Margin is REQUIRED
        margin = parseFloat(item.margin);
        if (isNaN(margin) || margin <= 0) {
          throw new AppError(`Margin is required for new medicine: ${item.product_name}`, 400, 'MARGIN_REQUIRED');
        }

        // Create new medicine with default_margin
        const [medResult] = await connection.query(
          'INSERT INTO medicines (name, salt, manufacturer, hsn_code, pack, min_stock, default_margin) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [item.product_name.trim(), item.salt || '', item.mfg || '', item.hsn_code || '', item.pack || '', 50, margin]
        );
        medicineId = medResult.insertId;
        console.log(`✅ NEW medicine created: ${item.product_name} with margin ${margin}%`);
      } else {
        // EXISTING MEDICINE
        medicineId = medicine[0].id;
        
        if (item.margin && item.margin !== '' && item.margin !== 0) {
          // Use provided margin and UPDATE default_margin
          margin = parseFloat(item.margin);
          await connection.query(
            'UPDATE medicines SET default_margin = ? WHERE id = ?',
            [margin, medicineId]
          );
          console.log(`✅ Updated default_margin to ${margin}% for ${item.product_name}`);
        } else {
          // Use stored default_margin
          margin = medicine[0].default_margin || 15;
          console.log(`✅ Using stored margin ${margin}% for ${item.product_name}`);
        }
      }

      // Check if batch exists
      let [batch] = await connection.query(
        'SELECT id FROM medicine_batches WHERE medicine_id = ? AND batch = ?',
        [medicineId, item.batch.trim()]
      );

      let batchId;
      const totalQty = parseInt(item.qty || 0) + parseInt(item.free || 0);
      const mrp = parseFloat(item.mrp || 0);
      const rate = parseFloat(item.rate || 0);
      const sellingRate = rate * (1 + margin / 100);

      const expiryDate = normalizeDate(item.exp) || null;
      if (!expiryDate) {
        throw new AppError(`Invalid expiry date for ${item.product_name}, batch ${item.batch}`, 400, 'INVALID_EXPIRY');
      }

      if (batch.length === 0) {
        // Create new batch
        const [batchResult] = await connection.query(
          'INSERT INTO medicine_batches (medicine_id, batch, expiry, stock, mrp, purchase_rate, selling_rate, margin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [medicineId, item.batch.trim(), expiryDate, totalQty, mrp, rate, sellingRate.toFixed(2), margin.toFixed(2)]
        );
        batchId = batchResult.insertId;
      } else {
        // Update existing batch
        batchId = batch[0].id;
        await connection.query(
          'UPDATE medicine_batches SET stock = stock + ?, mrp = ?, purchase_rate = ?, selling_rate = ?, margin = ?, expiry = ? WHERE id = ?',
          [totalQty, mrp, rate, sellingRate.toFixed(2), margin.toFixed(2), expiryDate, batchId]
        );
      }

      // Insert purchase item with margin
      const itemAmount = parseFloat(item.amount) || 0;
      const gstPercent = parseFloat(item.gst_percent) || 12;

      await connection.query(
        'INSERT INTO purchase_items (purchase_id, medicine_id, batch_id, hsn_code, batch, expiry, quantity, free_quantity, mrp, rate, amount, gst_percent, margin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [purchaseId, medicineId, batchId, item.hsn_code || '', item.batch.trim(), expiryDate, item.qty || 0, item.free || 0, mrp, rate, itemAmount, gstPercent, margin.toFixed(2)]
      );
    }

    await connection.commit();
    res.json({ 
      success: true,
      id: purchaseId, 
      message: 'Purchase order created successfully'
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

// CSV Import (File Upload)
router.post('/import-csv', upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400, 'NO_FILE');
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { supplier_id, invoice_no, purchase_date } = req.body;
    
    if (!supplier_id || !invoice_no || !purchase_date) {
      throw new AppError('Supplier, invoice number and purchase date are required', 400, 'MISSING_FIELDS');
    }

    const csvData = req.file.buffer.toString('utf8');

    console.log('CSV Upload Started - Invoice:', invoice_no);

    // Parse CSV
    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: (header) => header.trim().toLowerCase().replace(/[.\s]+/g, '_')
    });

    if (parsed.errors.length > 0) {
      throw new AppError('CSV parsing error: ' + parsed.errors[0].message, 400, 'CSV_PARSE_ERROR');
    }

    const items = parsed.data;
    console.log('Parsed CSV rows:', items.length);

    // Validate CSV with detailed error reporting
    const validationResult = validateCSVImport(items);
    
    // If there are validation errors, return them with summary
    if (!validationResult.isValid && validationResult.errors.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'CSV validation failed',
        code: 'CSV_VALIDATION_ERROR',
        statusCode: 400,
        errors: validationResult.errors,
        summary: {
          total_rows: items.length,
          valid_rows: validationResult.validRows.length,
          invalid_rows: items.length - validationResult.validRows.length,
          success_rate: validationResult.summary.successRate,
          message: `${validationResult.validRows.length} of ${items.length} rows are valid. Please correct the ${items.length - validationResult.validRows.length} invalid row(s) and re-upload.`
        }
      });
    }

    // Process valid items
    const validItems = validationResult.validRows;
    const { totalAmount, errors } = await processCSVItems(connection, validItems);

    if (validItems.length === 0) {
      throw new AppError('No valid items found in CSV', 400, 'NO_VALID_ITEMS');
    }

    console.log('Valid items:', validItems.length);
    console.log('CSV Total Amount:', totalAmount);

    // Insert purchase order
    const [purchaseResult] = await connection.query(
      'INSERT INTO purchases (supplier_id, invoice_no, purchase_date, total_amount, status) VALUES (?, ?, ?, ?, ?)',
      [supplier_id, invoice_no, purchase_date, totalAmount, 'pending']
    );

    const purchaseId = purchaseResult.insertId;
    const processedCount = await insertPurchaseItems(connection, purchaseId, validItems);

    await connection.commit();
    console.log('CSV Import Success - Processed:', processedCount, 'Total:', totalAmount);
    
    res.json({ 
      success: true,
      id: purchaseId, 
      message: `Purchase order created with ${processedCount} items`, 
      processedCount,
      totalAmount,
      skippedCount: items.length - validItems.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

// CSV Paste Import (Direct paste from clipboard)
router.post('/import-csv-paste', async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { supplier_id, invoice_no, purchase_date, csvText } = req.body;

    if (!csvText || !csvText.trim()) {
      throw new AppError('CSV data is required', 400, 'NO_CSV_DATA');
    }

    if (!supplier_id || !invoice_no || !purchase_date) {
      throw new AppError('Supplier, invoice number and purchase date are required', 400, 'MISSING_FIELDS');
    }

    console.log('CSV Paste Import Started - Invoice:', invoice_no);

    // Parse CSV
    const parsed = Papa.parse(csvText.trim(), {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: (header) => header.trim().toLowerCase().replace(/[.\s]+/g, '_')
    });

    if (parsed.errors.length > 0) {
      throw new AppError('CSV parsing error: ' + parsed.errors[0].message, 400, 'CSV_PARSE_ERROR');
    }

    const items = parsed.data;
    console.log('Parsed CSV rows:', items.length);

    // Validate CSV with detailed error reporting
    const validationResult = validateCSVImport(items);
    
    // If there are validation errors, return them with summary
    if (!validationResult.isValid && validationResult.errors.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'CSV validation failed',
        code: 'CSV_VALIDATION_ERROR',
        statusCode: 400,
        errors: validationResult.errors,
        summary: {
          total_rows: items.length,
          valid_rows: validationResult.validRows.length,
          invalid_rows: items.length - validationResult.validRows.length,
          success_rate: validationResult.summary.successRate,
          message: `${validationResult.validRows.length} of ${items.length} rows are valid. Please correct the ${items.length - validationResult.validRows.length} invalid row(s) and re-upload.`
        }
      });
    }

    // Process valid items
    const validItems = validationResult.validRows;
    const { totalAmount, errors } = await processCSVItems(connection, validItems);

    if (validItems.length === 0) {
      throw new AppError('No valid items found in CSV data', 400, 'NO_VALID_ITEMS');
    }

    console.log('Valid items:', validItems.length);
    console.log('CSV Paste Total Amount:', totalAmount);

    // Insert purchase order
    const [purchaseResult] = await connection.query(
      'INSERT INTO purchases (supplier_id, invoice_no, purchase_date, total_amount, status) VALUES (?, ?, ?, ?, ?)',
      [supplier_id, invoice_no, purchase_date, totalAmount, 'pending']
    );

    const purchaseId = purchaseResult.insertId;
    const processedCount = await insertPurchaseItems(connection, purchaseId, validItems);

    await connection.commit();
    console.log('CSV Paste Import Success - Processed:', processedCount, 'Total:', totalAmount);
    
    res.json({ 
      success: true,
      id: purchaseId, 
      message: `Purchase order created with ${processedCount} items from pasted CSV`, 
      processedCount,
      totalAmount,
      skippedCount: items.length - validItems.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

// Helper function to process and validate CSV items
async function processCSVItems(connection, items) {
  let totalAmount = 0;
  const validItems = [];
  const errors = [];

  for (let i = 0; i < items.length; i++) {
    const row = items[i];
    
    // Skip if essential fields missing
    if (!row.product_name || !row.batch) {
      errors.push(`Row ${i + 1}: Missing product name or batch`);
      continue;
    }

    // Validate and format expiry date
    let expiryDate = normalizeDate(row.exp || row.expiry);
    if (!expiryDate) {
      errors.push(`Row ${i + 1} (${row.product_name}): Invalid or missing expiry date`);
      continue;
    }

    // ✅ SMART MARGIN LOGIC: Check if medicine exists
    const [existingMedicine] = await connection.query(
      'SELECT id, default_margin FROM medicines WHERE name = ? AND manufacturer = ?',
      [row.product_name.trim(), row.mfg || '']
    );

    let margin;
    
    if (existingMedicine.length > 0) {
      // EXISTING MEDICINE
      const marginValue = row.margin ? String(row.margin).trim() : '';
      if (marginValue !== '') {
        // Use provided margin ✅
        margin = parseFloat(row.margin);
        if (isNaN(margin) || margin < 0) {
          errors.push(`Row ${i + 1} (${row.product_name}): Invalid MARGIN value`);
          continue;
        }
      } else {
        // Use stored default_margin ✅
        margin = existingMedicine[0].default_margin || 15;
        console.log(`Row ${i + 1}: Using stored margin ${margin}% for ${row.product_name}`);
      }
    } else {
      // NEW MEDICINE - MARGIN REQUIRED ❌
      const marginValue = row.margin ? String(row.margin).trim() : '';
      if (marginValue === '') {
        errors.push(`Row ${i + 1} (${row.product_name}): NEW medicine - MARGIN is REQUIRED`);
        continue;
      }
      margin = parseFloat(row.margin);
      if (isNaN(margin) || margin <= 0) {
        errors.push(`Row ${i + 1} (${row.product_name}): Invalid MARGIN value for new medicine`);
        continue;
      }
      console.log(`Row ${i + 1}: NEW medicine ${row.product_name} - using margin ${margin}%`);
    }

    // Parse amounts
    const amount = parseFloat(row.amount) || 0;
    totalAmount += amount;

    validItems.push({
      ...row,
      amount,
      expiry: expiryDate,
      margin,
      isNewMedicine: existingMedicine.length === 0
    });
  }

  return { validItems, totalAmount, errors };
}

// Helper function to insert purchase items into database
async function insertPurchaseItems(connection, purchaseId, validItems) {
  let processedCount = 0;

  for (const row of validItems) {
    // Find or create medicine (consistent with manual entry)
    let [medicine] = await connection.query(
      'SELECT id, default_margin FROM medicines WHERE name = ? AND salt = ? AND manufacturer = ?',
      [row.product_name.trim(), row.salt || '', row.mfg || '']
    );

    let medicineId;
    const margin = parseFloat(row.margin);

    if (medicine.length === 0) {
      // Create new medicine with default_margin
      const [medResult] = await connection.query(
        'INSERT INTO medicines (name, salt, manufacturer, hsn_code, pack, min_stock, default_margin) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [row.product_name.trim(), row.salt || '', row.mfg || '', row.hsn_code || '', row.pack || '', 50, margin]
      );
      medicineId = medResult.insertId;
      console.log(`✅ Created NEW medicine: ${row.product_name} with default_margin ${margin}%`);
    } else {
      medicineId = medicine[0].id;
      
      // Update default_margin if CSV provided a value (check if it's different)
      if (!isNaN(margin) && margin !== medicine[0].default_margin) {
        await connection.query(
          'UPDATE medicines SET default_margin = ? WHERE id = ?',
          [margin, medicineId]
        );
        console.log(`✅ Updated default_margin to ${margin}% for ${row.product_name}`);
      }
    }

    // Check if batch exists
    let [batch] = await connection.query(
      'SELECT id FROM medicine_batches WHERE medicine_id = ? AND batch = ?',
      [medicineId, row.batch.trim()]
    );

    let batchId;
    const qty = parseInt(row.qty || 0);
    const free = parseInt(row.free || 0);
    const totalQty = qty + free;
    const mrp = parseFloat(row.mrp || row['m_r_p'] || 0);
    const rate = parseFloat(row.rate || 0);
    const sellingRate = rate * (1 + margin / 100);

    if (batch.length === 0) {
      const [batchResult] = await connection.query(
        'INSERT INTO medicine_batches (medicine_id, batch, expiry, stock, mrp, purchase_rate, selling_rate, margin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [medicineId, row.batch.trim(), row.expiry, totalQty, mrp, rate, sellingRate.toFixed(2), margin.toFixed(2)]
      );
      batchId = batchResult.insertId;
    } else {
      batchId = batch[0].id;
      await connection.query(
        'UPDATE medicine_batches SET stock = stock + ?, mrp = ?, purchase_rate = ?, selling_rate = ?, margin = ?, expiry = ? WHERE id = ?',
        [totalQty, mrp, rate, sellingRate.toFixed(2), margin.toFixed(2), row.expiry, batchId]
      );
    }

    // Insert purchase item with margin
    const gstPercent = parseFloat(row.gst_percent || row['gst_%'] || row.gst || 12);

    await connection.query(
      'INSERT INTO purchase_items (purchase_id, medicine_id, batch_id, hsn_code, batch, expiry, quantity, free_quantity, mrp, rate, amount, gst_percent, margin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [purchaseId, medicineId, batchId, row.hsn_code || '', row.batch.trim(), row.expiry, qty, free, mrp, rate, row.amount, gstPercent, margin.toFixed(2)]
    );

    processedCount++;
  }

  return processedCount;
}

// Update purchase status
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['pending', 'completed', 'cancelled'].includes(status)) {
      throw new AppError('Invalid status', 400, 'INVALID_STATUS');
    }
    
    const [existing] = await db.query('SELECT id FROM purchases WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw new AppError('Purchase not found', 404, 'PURCHASE_NOT_FOUND');
    }
    
    await db.query('UPDATE purchases SET status=? WHERE id=?', [status, id]);
    res.json({ 
      success: true,
      message: 'Purchase updated'
    });
  } catch (error) {
    next(error);
  }
});

// Delete purchase
router.delete('/:id', async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check if purchase exists
    const [existing] = await connection.query('SELECT id FROM purchases WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      throw new AppError('Purchase not found', 404, 'PURCHASE_NOT_FOUND');
    }

    // Get purchase items to reduce stock
    const [items] = await connection.query(
      'SELECT batch_id, quantity, free_quantity FROM purchase_items WHERE purchase_id = ?',
      [req.params.id]
    );

    // Reduce stock from batches
    for (const item of items) {
      const totalQty = parseInt(item.quantity) + parseInt(item.free_quantity || 0);
      await connection.query(
        'UPDATE medicine_batches SET stock = GREATEST(stock - ?, 0) WHERE id = ?',
        [totalQty, item.batch_id]
      );
    }

    // Delete purchase (items will be deleted via CASCADE)
    await connection.query('DELETE FROM purchases WHERE id=?', [req.params.id]);

    await connection.commit();
    res.json({ 
      success: true,
      message: 'Purchase deleted and stock adjusted'
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

// Record a payment for purchase
router.post('/:id/payments', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { payment_amount, payment_mode, payment_reference, notes } = req.body;

    // Validation
    if (!payment_amount || payment_amount <= 0) {
      throw new AppError('Payment amount must be greater than 0', 400, 'INVALID_PAYMENT_AMOUNT');
    }
    if (!payment_mode) {
      throw new AppError('Payment mode is required', 400, 'MISSING_PAYMENT_MODE');
    }

    const Purchase = require('../models/Purchase');
    const paymentId = await Purchase.recordPayment(id, {
      payment_amount,
      payment_mode,
      payment_reference,
      notes,
      created_by: req.user?.id || 1
    });

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      paymentId
    });
  } catch (error) {
    next(error);
  }
});

// Get payment history for purchase
router.get('/:id/payments', async (req, res, next) => {
  try {
    const { id } = req.params;

    const Purchase = require('../models/Purchase');
    const payments = await Purchase.getPaymentHistory(id);

    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;