const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { validate } = require('../middleware/validator');
const { AppError } = require('../middleware/errorHandler');

// Get all transactions WITH SEARCH AND PAGINATION
router.get('/', async (req, res, next) => {
  try {
    const { search, limit = 1000, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM transactions';
    const params = [];
    
    // Add search conditions if search parameter exists
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      query += ` WHERE (
        invoice_no LIKE ? OR
        customer_name LIKE ? OR
        total_amount LIKE ? OR
        DATE_FORMAT(created_at, '%d/%m/%Y') LIKE ? OR
        payment_status LIKE ?
      )`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [transactions] = await db.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM transactions';
    const countParams = [];
    
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      countQuery += ` WHERE (
        invoice_no LIKE ? OR
        customer_name LIKE ? OR
        total_amount LIKE ? OR
        DATE_FORMAT(created_at, '%d/%m/%Y') LIKE ? OR
        payment_status LIKE ?
      )`;
      countParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    const [countResult] = await db.query(countQuery, countParams);
    
    res.json({
      transactions,
      total: countResult[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    next(error);
  }
});

// Get transaction details with items
router.get('/:invoiceNo', async (req, res, next) => {
  try {
    const { invoiceNo } = req.params;
    
    // Get transaction
    const [transactions] = await db.query(
      'SELECT * FROM transactions WHERE invoice_no = ?',
      [invoiceNo]
    );
    
    if (transactions.length === 0) {
      throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
    }
    
    // Get transaction items
    const [items] = await db.query(
      'SELECT * FROM sale_items WHERE invoice_no = ?',
      [invoiceNo]
    );
    
    const transaction = transactions[0];
    transaction.items = items;
    
    res.json(transaction);
  } catch (error) {
    next(error);
  }
});

// Helper function to format date to YYYY-MM-DD
const formatDate = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
};

// Create new sale/transaction - WITH VALIDATION
router.post('/', validate('sale'), async (req, res, next) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { customer, items, payment, totals } = req.body;
    
    // Validate items exist
    if (!items || items.length === 0) {
      throw new AppError('Sale must contain at least one item', 400, 'NO_ITEMS');
    }
    
    // Generate invoice number
    const [lastInvoice] = await connection.query(
      "SELECT invoice_no FROM transactions ORDER BY id DESC LIMIT 1"
    );
    
    let invoiceNo;
    if (lastInvoice.length > 0) {
      const lastNum = parseInt(lastInvoice[0].invoice_no.split('-')[1]);
      invoiceNo = `INV-${String(lastNum + 1).padStart(4, '0')}`;
    } else {
      invoiceNo = 'INV-0001';
    }
    
    // Calculate payment status with proper decimal handling
    const totalAmount = parseFloat(totals.grandTotal) || 0;
    const amountPaid = parseFloat(payment.amount) || 0;
    const amountDue = parseFloat((totalAmount - amountPaid).toFixed(2));
    
    // Validate amounts
    if (totalAmount <= 0) {
      throw new AppError('Total amount must be greater than zero', 400, 'INVALID_AMOUNT');
    }
    
    if (amountPaid < 0 || amountPaid > totalAmount) {
      throw new AppError('Invalid payment amount', 400, 'INVALID_PAYMENT');
    }
    
    let paymentStatus;
    if (amountDue <= 0) {
      paymentStatus = 'paid';
    } else if (amountPaid > 0 && amountPaid < totalAmount) {
      paymentStatus = 'partial';
    } else {
      paymentStatus = 'due';
    }
    
    // Insert transaction
    const [result] = await connection.query(
      `INSERT INTO transactions (
        invoice_no, invoice_date, customer_id, customer_name, customer_phone, 
        customer_address, customer_gst, customer_dl,
        total_amount, tax_amount, payment_mode, payment_status,
        amount_paid, amount_due
      ) VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNo,
        customer.id || null,
        customer.name,
        customer.phone || null,
        customer.address || null,
        customer.gst_number || null,
        customer.dl_number || null,
        parseFloat(totalAmount.toFixed(2)),
        parseFloat(totals.tax.toFixed(2)),
        payment.mode,
        paymentStatus,
        parseFloat(amountPaid.toFixed(2)),
        amountDue
      ]
    );
    
    const transactionId = result.insertId;
    
    // Insert transaction items and update stock
    for (const item of items) {
      // Validate item quantities
      const itemQuantity = parseInt(item.quantity) || 0;
      if (itemQuantity <= 0) {
        throw new AppError(`Invalid quantity for ${item.name}`, 400, 'INVALID_QUANTITY');
      }
      
      // Check if batch has enough stock
      if (item.batch_id) {
        const [batch] = await connection.query(
          'SELECT stock FROM medicine_batches WHERE id = ?',
          [item.batch_id]
        );
        
        if (batch.length === 0) {
          throw new AppError(`Batch not found for ${item.name}`, 404, 'BATCH_NOT_FOUND');
        }
        
        if (batch[0].stock < itemQuantity) {
          throw new AppError(`Insufficient stock for ${item.name}. Available: ${batch[0].stock}`, 400, 'INSUFFICIENT_STOCK');
        }
      }
      
      // Format expiry date to YYYY-MM-DD
      const formattedExpiry = formatDate(item.expiry);
      
      // Ensure decimal precision for rate and amount
      const itemRate = parseFloat(item.rate) || 0;
      const itemAmount = parseFloat(item.amount) || 0;
      
      // Insert sale item
      await connection.query(
        `INSERT INTO sale_items (
          transaction_id, invoice_no, medicine_name, pack, manufacturer, hsn_code, batch, expiry,
          mrp, quantity, rate, amount, gst_percent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId,
          invoiceNo,
          item.name,
          item.pack || 'N/A',
          item.manufacturer || 'N/A',
          item.hsn_code || null,
          item.batch || null,
          formattedExpiry,
          parseFloat(item.mrp) || 0,
          itemQuantity,
          parseFloat(itemRate.toFixed(2)),
          parseFloat(itemAmount.toFixed(2)),
          parseFloat(item.gst_percent) || 12
        ]
      );
      
      // Update batch stock
      if (item.batch_id) {
        await connection.query(
          'UPDATE medicine_batches SET stock = stock - ? WHERE id = ?',
          [itemQuantity, item.batch_id]
        );
      }
    }
    
    // Update customer outstanding if customer exists
    if (customer.id && amountDue > 0) {
      await connection.query(
        'UPDATE customers SET outstanding = outstanding + ? WHERE id = ?',
        [amountDue, customer.id]
      );
    }
    
    await connection.commit();
    
    res.json({
      success: true,
      invoiceNo,
      message: 'Sale completed successfully'
    });
    
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

// Update payment for a transaction - WITH VALIDATION
router.put('/:invoiceNo/payment', validate('payment'), async (req, res, next) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { invoiceNo } = req.params;
    const { amount_paid, payment_mode } = req.body;
    
    // Validate payment amount
    const paymentAmount = parseFloat(amount_paid);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new AppError('Payment amount must be greater than zero', 400, 'INVALID_PAYMENT_AMOUNT');
    }
    
    // Get current transaction
    const [transactions] = await connection.query(
      'SELECT * FROM transactions WHERE invoice_no = ?',
      [invoiceNo]
    );
    
    if (transactions.length === 0) {
      throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
    }
    
    const transaction = transactions[0];
    const newAmountPaid = parseFloat((parseFloat(transaction.amount_paid) + paymentAmount).toFixed(2));
    const newAmountDue = parseFloat((parseFloat(transaction.total_amount) - newAmountPaid).toFixed(2));
    
    // Validate payment doesn't exceed due amount
    if (newAmountPaid > parseFloat(transaction.total_amount)) {
      throw new AppError('Payment amount exceeds total due', 400, 'PAYMENT_EXCEEDS_DUE');
    }
    
    // Determine new payment status
    let newPaymentStatus;
    if (newAmountDue <= 0) {
      newPaymentStatus = 'paid';
    } else if (newAmountPaid > 0) {
      newPaymentStatus = 'partial';
    } else {
      newPaymentStatus = 'due';
    }
    
    // Update transaction
    await connection.query(
      `UPDATE transactions 
       SET amount_paid = ?, amount_due = ?, payment_status = ?, payment_mode = ?
       WHERE invoice_no = ?`,
      [newAmountPaid, newAmountDue, newPaymentStatus, payment_mode, invoiceNo]
    );
    
    // Update customer outstanding if customer exists
    if (transaction.customer_id) {
      await connection.query(
        'UPDATE customers SET outstanding = outstanding - ? WHERE id = ?',
        [parseFloat(paymentAmount.toFixed(2)), transaction.customer_id]
      );
    }
    
    await connection.commit();
    
    res.json({
      success: true,
      message: 'Payment updated successfully',
      newAmountPaid,
      newAmountDue,
      newPaymentStatus
    });
    
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

// Delete transaction
router.delete('/:invoiceNo', async (req, res, next) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { invoiceNo } = req.params;
    
    // Get transaction details
    const [transactions] = await connection.query(
      'SELECT * FROM transactions WHERE invoice_no = ?',
      [invoiceNo]
    );
    
    if (transactions.length === 0) {
      throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
    }
    
    const transaction = transactions[0];
    
    // Get transaction items to restore stock
    const [items] = await connection.query(
      'SELECT * FROM sale_items WHERE invoice_no = ?',
      [invoiceNo]
    );
    
    // Restore stock for each item
    for (const item of items) {
      // Find the batch to restore stock
      const [batches] = await connection.query(
        `SELECT mb.id 
         FROM medicine_batches mb
         JOIN medicines m ON mb.medicine_id = m.id
         WHERE m.name = ? AND mb.batch = ?
         LIMIT 1`,
        [item.medicine_name, item.batch]
      );
      
      if (batches.length > 0) {
        await connection.query(
          'UPDATE medicine_batches SET stock = stock + ? WHERE id = ?',
          [item.quantity, batches[0].id]
        );
      }
    }
    
    // Update customer outstanding if customer exists
    if (transaction.customer_id && transaction.amount_due > 0) {
      await connection.query(
        'UPDATE customers SET outstanding = outstanding - ? WHERE id = ?',
        [transaction.amount_due, transaction.customer_id]
      );
    }
    
    // Delete sale items
    await connection.query('DELETE FROM sale_items WHERE invoice_no = ?', [invoiceNo]);
    
    // Delete transaction
    await connection.query('DELETE FROM transactions WHERE invoice_no = ?', [invoiceNo]);
    
    await connection.commit();
    
    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });
    
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

// Get sales report
router.get('/reports/summary', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      throw new AppError('Start date and end date are required', 400, 'MISSING_DATES');
    }
    
    const [sales] = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_sales,
        SUM(total_amount) as revenue
      FROM transactions
      WHERE created_at BETWEEN ? AND ?
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [start_date, end_date]);
    
    res.json(sales);
  } catch (error) {
    next(error);
  }
});

module.exports = router;