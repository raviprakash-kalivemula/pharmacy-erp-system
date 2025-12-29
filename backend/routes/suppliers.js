const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const { validate } = require('../middleware/validator');
const { AppError } = require('../middleware/errorHandler');

// Get all suppliers WITH SEARCH and STATS
router.get('/', async (req, res, next) => {
  try {
    const { search = '', limit = 50, offset = 0, withStats = 'true' } = req.query;
    
    const suppliers = await Supplier.search(
      search,
      parseInt(limit),
      parseInt(offset)
    );
    
    const total = await Supplier.count(search);
    
    res.json({
      suppliers,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    next(error);
  }
});

// Get suppliers with outstanding balance
router.get('/outstanding', async (req, res, next) => {
  try {
    const suppliers = await Supplier.findWithOutstanding();
    res.json(suppliers);
  } catch (error) {
    next(error);
  }
});

// Get top suppliers by purchase volume
router.get('/top', async (req, res, next) => {
  try {
    const { limit = 10, startDate, endDate } = req.query;
    const suppliers = await Supplier.getTopSuppliers(
      parseInt(limit),
      startDate,
      endDate
    );
    res.json(suppliers);
  } catch (error) {
    next(error);
  }
});

// Get supplier by ID with purchase history
router.get('/:id', async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const supplier = await Supplier.findWithHistory(req.params.id, parseInt(limit));

    if (!supplier) {
      throw new AppError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');
    }

    res.json(supplier);
  } catch (error) {
    next(error);
  }
});

// Add new supplier - WITH VALIDATION
router.post('/', validate('supplier'), async (req, res, next) => {
  try {
    const { name, phone, email, address, gst_number, dl_number } = req.body;
    
    // Check if supplier with same name already exists
    const existing = await Supplier.findByName(name);
    if (existing) {
      throw new AppError('Supplier with this name already exists', 409, 'DUPLICATE_SUPPLIER');
    }
    
    const id = await Supplier.create({
      name,
      phone,
      email,
      address,
      gst_number,
      dl_number
    });
    
    res.json({ 
      success: true,
      id,
      message: 'Supplier added successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Update supplier - WITH VALIDATION
router.put('/:id', validate('supplier'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, gst_number, dl_number } = req.body;

    // Check if supplier exists
    const existing = await Supplier.findById(id);
    if (!existing) {
      throw new AppError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');
    }

    // Check if another supplier has the same name
    const duplicate = await Supplier.findByName(name);
    if (duplicate && duplicate.id !== parseInt(id)) {
      throw new AppError('Another supplier with this name already exists', 409, 'DUPLICATE_SUPPLIER');
    }

    const updated = await Supplier.update(id, {
      name,
      phone,
      email,
      address,
      gst_number,
      dl_number
    });

    if (!updated) {
      throw new AppError('Failed to update supplier', 500, 'UPDATE_FAILED');
    }
    
    res.json({ 
      success: true,
      message: 'Supplier updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Delete supplier
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if supplier exists
    const existing = await Supplier.findById(id);
    if (!existing) {
      throw new AppError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');
    }

    // This will throw error if supplier has purchase history
    const deleted = await Supplier.delete(id);
    
    if (!deleted) {
      throw new AppError('Failed to delete supplier', 500, 'DELETE_FAILED');
    }
    
    res.json({ 
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    // Handle specific error from model
    if (error.message === 'Cannot delete supplier with purchase history') {
      next(new AppError('Cannot delete supplier with purchase history. Consider archiving instead.', 400, 'SUPPLIER_HAS_PURCHASES'));
    } else {
      next(error);
    }
  }
});

module.exports = router;