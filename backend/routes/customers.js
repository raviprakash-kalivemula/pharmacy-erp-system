const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { validate } = require('../middleware/validator');
const { AppError } = require('../middleware/errorHandler');

// Get all customers WITH SEARCH and PAGINATION
router.get('/', async (req, res, next) => {
  try {
    const { search, limit = 1000, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        id,
        name,
        phone,
        address,
        gst_number,
        dl_number,
        COALESCE(outstanding, 0) as outstanding,
        COALESCE(loyalty_points, 0) as loyalty_points,
        last_purchase_date,
        created_at
      FROM customers
    `;
    
    const params = [];
    
    // Add search conditions if search parameter exists
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      query += ` WHERE (
        name LIKE ? OR
        phone LIKE ? OR
        address LIKE ? OR
        gst_number LIKE ? OR
        dl_number LIKE ? OR
        outstanding LIKE ?
      )`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [customers] = await db.query(query, params);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM customers';
    const countParams = [];
    
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      countQuery += ` WHERE (
        name LIKE ? OR
        phone LIKE ? OR
        address LIKE ? OR
        gst_number LIKE ? OR
        dl_number LIKE ? OR
        outstanding LIKE ?
      )`;
      countParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    const [countResult] = await db.query(countQuery, countParams);
    
    res.json({
      customers,
      total: countResult[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    next(error);
  }
});

// Add new customer - WITH VALIDATION
router.post('/', validate('customer'), async (req, res, next) => {
  try {
    const { name, phone, address, gst_number, dl_number } = req.body;
    
    const [result] = await db.query(
      'INSERT INTO customers (name, phone, address, gst_number, dl_number, last_purchase_date) VALUES (?, ?, ?, ?, ?, CURDATE())',
      [name.trim(), phone || null, address || null, gst_number || null, dl_number || null]
    );
    
    res.json({ 
      success: true,
      id: result.insertId, 
      message: 'Customer added successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Update customer - WITH VALIDATION
router.put('/:id', validate('customer'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, address, gst_number, dl_number, outstanding } = req.body;

    await db.query(
      'UPDATE customers SET name=?, phone=?, address=?, gst_number=?, dl_number=?, outstanding=? WHERE id=?',
      [name.trim(), phone || null, address || null, gst_number || null, dl_number || null, outstanding || 0, id]
    );
    
    res.json({ 
      success: true,
      message: 'Customer updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Delete customer
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if customer has any sales history
    const [sales] = await db.query('SELECT COUNT(*) as count FROM sales WHERE customer_id = ?', [id]);
    
    if (sales[0].count > 0) {
      throw new AppError('Cannot delete customer with sales history. Consider archiving instead.', 400);
    }

    await db.query('DELETE FROM customers WHERE id=?', [id]);
    
    res.json({ 
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get customer by ID
router.get('/:id', async (req, res, next) => {
  try {
    const [customer] = await db.query(`
      SELECT 
        id,
        name,
        phone,
        address,
        gst_number,
        dl_number,
        COALESCE(outstanding, 0) as outstanding,
        COALESCE(loyalty_points, 0) as loyalty_points,
        last_purchase_date,
        created_at
      FROM customers 
      WHERE id = ?
    `, [req.params.id]);

    if (customer.length === 0) {
      throw new AppError('Customer not found', 404);
    }

    res.json(customer[0]);
  } catch (error) {
    next(error);
  }
});

// Update customer outstanding amount
router.patch('/:id/outstanding', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    await db.query(
      'UPDATE customers SET outstanding = outstanding + ? WHERE id = ?',
      [amount, id]
    );

    res.json({ 
      success: true,
      message: 'Outstanding updated'
    });
  } catch (error) {
    next(error);
  }
});

// Update customer loyalty points
router.patch('/:id/loyalty', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { points } = req.body;

    await db.query(
      'UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?',
      [points, id]
    );

    res.json({ 
      success: true,
      message: 'Loyalty points updated'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;