const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { validate } = require('../middleware/validator'); // ADD THIS
const { AppError } = require('../middleware/errorHandler'); // ADD THIS

// Get all medicines with total stock from all batches (UPDATED - only active medicines)
router.get('/', async (req, res, next) => { // ADD next
  try {
    const { limit = 1000, offset = 0, search = '' } = req.query;
    
    let query = `
      SELECT 
        m.*,
        COALESCE(SUM(mb.stock), 0) as total_stock,
        MIN(mb.expiry) as nearest_expiry,
        COUNT(DISTINCT mb.id) as batch_count,
        MIN(CASE WHEN mb.stock > 0 THEN mb.purchase_rate END) as lowest_rate,
        MIN(CASE WHEN mb.stock > 0 THEN mb.selling_rate END) as lowest_selling_rate,
        MIN(CASE WHEN mb.stock > 0 THEN mb.mrp END) as lowest_mrp
      FROM medicines m
      LEFT JOIN medicine_batches mb ON m.id = mb.medicine_id
      WHERE m.is_active = TRUE
    `;
    
    const params = [];
    
    if (search && search.trim() !== '') {
      query += ` AND (m.name LIKE ? OR m.salt LIKE ? OR m.manufacturer LIKE ?)`;
      const searchTerm = `${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    query += ` GROUP BY m.id ORDER BY m.name`;
    
    if (limit) {
      query += ` LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), parseInt(offset));
    }
    
    const [medicines] = await db.query(query, params);
    
    const [countResult] = await db.query(
      'SELECT COUNT(*) as total FROM medicines WHERE is_active = TRUE'
    );
    
    res.json({
      medicines,
      total: countResult[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    next(error); // CHANGED: Pass to error handler
  }
});

// Get medicine with all its batches
router.get('/:id/batches', async (req, res, next) => {
  try {
    const [batches] = await db.query(`
      SELECT * FROM medicine_batches 
      WHERE medicine_id = ? 
      ORDER BY expiry ASC
    `, [req.params.id]);
    res.json(batches);
  } catch (error) {
    next(error);
  }
});

// Get available batches for a medicine (for billing)
router.get('/:id/available-batches', async (req, res, next) => {
  try {
    const [batches] = await db.query(`
      SELECT 
        id, 
        batch, 
        expiry, 
        stock, 
        mrp, 
        purchase_rate,
        selling_rate,
        margin,
        DATEDIFF(expiry, CURDATE()) as days_to_expiry,
        CASE 
          WHEN DATEDIFF(expiry, CURDATE()) <= 30 THEN 'critical'
          WHEN DATEDIFF(expiry, CURDATE()) <= 90 THEN 'warning'
          ELSE 'good'
        END as expiry_status
      FROM medicine_batches 
      WHERE medicine_id = ? AND stock > 0
      ORDER BY expiry ASC
    `, [req.params.id]);
    
    res.json(batches);
  } catch (error) {
    next(error);
  }
});

// Get low stock medicines
router.get('/alerts/low-stock', async (req, res, next) => {
  try {
    const [medicines] = await db.query(`
      SELECT 
        m.*,
        COALESCE(SUM(mb.stock), 0) as total_stock
      FROM medicines m
      LEFT JOIN medicine_batches mb ON m.id = mb.medicine_id
      WHERE m.is_active = TRUE
      GROUP BY m.id
      HAVING total_stock <= m.min_stock
      ORDER BY total_stock ASC
    `);
    res.json(medicines);
  } catch (error) {
    next(error);
  }
});

// Get expiring medicines
router.get('/alerts/expiring', async (req, res, next) => {
  try {
    const [batches] = await db.query(`
      SELECT 
        mb.*,
        m.name, m.salt, m.manufacturer,
        DATEDIFF(mb.expiry, CURDATE()) as days_to_expiry
      FROM medicine_batches mb
      JOIN medicines m ON mb.medicine_id = m.id
      WHERE mb.expiry <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
      AND mb.stock > 0
      AND m.is_active = TRUE
      ORDER BY mb.expiry ASC
    `);
    res.json(batches);
  } catch (error) {
    next(error);
  }
});

// Get deleted medicines
router.get('/deleted/list', async (req, res, next) => {
  try {
    const [medicines] = await db.query(`
      SELECT 
        m.*,
        COALESCE(SUM(mb.stock), 0) as total_stock
      FROM medicines m
      LEFT JOIN medicine_batches mb ON m.id = mb.medicine_id
      WHERE m.is_active = FALSE 
      GROUP BY m.id
      ORDER BY m.deleted_at DESC
    `);
    res.json(medicines);
  } catch (error) {
    next(error);
  }
});

// Add new medicine - WITH VALIDATION
router.post('/', validate('medicine'), async (req, res, next) => { // ADDED validate()
  try {
    const { name, salt, manufacturer, hsn_code, pack, rack, barcode, min_stock } = req.body;
    const [result] = await db.query(
      'INSERT INTO medicines (name, salt, manufacturer, hsn_code, pack, rack, barcode, min_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, salt, manufacturer, hsn_code, pack, rack, barcode, min_stock || 50]
    );
    
    res.json({ 
      success: true, // ADDED
      id: result.insertId, 
      message: 'Medicine added successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Update medicine - WITH VALIDATION
router.put('/:id', validate('medicine'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, salt, manufacturer, hsn_code, pack, rack, barcode, min_stock } = req.body;
    
    // Check if medicine exists
    const [existing] = await db.query('SELECT id FROM medicines WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw new AppError('Medicine not found', 404, 'MEDICINE_NOT_FOUND');
    }
    
    await db.query(
      'UPDATE medicines SET name=?, salt=?, manufacturer=?, hsn_code=?, pack=?, rack=?, barcode=?, min_stock=? WHERE id=?',
      [name, salt, manufacturer, hsn_code, pack, rack, barcode, min_stock, id]
    );
    
    // Broadcast inventory update to all connected users
    const realtimeService = req.app.locals.realtime;
    if (realtimeService) {
      const updatedMedicine = { id, name, salt, manufacturer, hsn_code, pack, rack, barcode, min_stock };
      realtimeService.broadcastInventoryUpdate(id, updatedMedicine, req.user?.id || 'system');
    }
    
    res.json({ 
      success: true,
      message: 'Medicine updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Restore deleted medicine
router.put('/restore/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [existing] = await db.query('SELECT id FROM medicines WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw new AppError('Medicine not found', 404, 'MEDICINE_NOT_FOUND');
    }
    
    await db.query(
      'UPDATE medicines SET is_active = TRUE, deleted_at = NULL WHERE id = ?',
      [id]
    );
    
    res.json({ 
      success: true,
      message: 'Medicine restored successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Add or update batch - WITH VALIDATION
router.post('/:id/batch', validate('medicineBatch'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { batch, expiry, stock, mrp, purchase_rate, margin } = req.body;
    
    // Check if medicine exists
    const [medicine] = await db.query('SELECT id FROM medicines WHERE id = ?', [id]);
    if (medicine.length === 0) {
      throw new AppError('Medicine not found', 404, 'MEDICINE_NOT_FOUND');
    }
    
    // Calculate selling rate correctly using margin
    const marginPercent = parseFloat(margin || 15);
    const sellingRate = parseFloat(purchase_rate) * (1 + marginPercent / 100);
    
    // Check if batch exists
    const [existing] = await db.query(
      'SELECT id FROM medicine_batches WHERE medicine_id = ? AND batch = ?',
      [id, batch]
    );

    if (existing.length > 0) {
      // Update existing batch
      await db.query(
        'UPDATE medicine_batches SET stock = stock + ?, expiry = ?, mrp = ?, purchase_rate = ?, selling_rate = ?, margin = ? WHERE id = ?',
        [stock, expiry, mrp, purchase_rate, sellingRate.toFixed(2), marginPercent.toFixed(2), existing[0].id]
      );
      res.json({ 
        success: true,
        message: 'Batch updated successfully'
      });
    } else {
      // Create new batch
      await db.query(
        'INSERT INTO medicine_batches (medicine_id, batch, expiry, stock, mrp, purchase_rate, selling_rate, margin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, batch, expiry, stock, mrp, purchase_rate, sellingRate.toFixed(2), marginPercent.toFixed(2)]
      );
      res.json({ 
        success: true,
        message: 'Batch added successfully'
      });
    }
  } catch (error) {
    next(error);
  }
});

// Soft delete medicine
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [existing] = await db.query('SELECT id FROM medicines WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw new AppError('Medicine not found', 404, 'MEDICINE_NOT_FOUND');
    }
    
    await db.query(
      'UPDATE medicines SET is_active = FALSE, deleted_at = NOW() WHERE id = ?',
      [id]
    );
    
    res.json({ 
      success: true,
      message: 'Medicine deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Delete specific batch
router.delete('/:id/batch/:batchId', async (req, res, next) => {
  try {
    const { batchId } = req.params;
    
    const [existing] = await db.query('SELECT id FROM medicine_batches WHERE id = ?', [batchId]);
    if (existing.length === 0) {
      throw new AppError('Batch not found', 404, 'BATCH_NOT_FOUND');
    }
    
    await db.query('DELETE FROM medicine_batches WHERE id=?', [batchId]);
    
    res.json({ 
      success: true,
      message: 'Batch deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;