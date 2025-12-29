const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { validate } = require('../middleware/validator');

router.get('/', async (req, res, next) => {
  try {
    const [settings] = await db.query('SELECT * FROM settings WHERE id=1');
    if (settings.length === 0) {
      // Create default settings if none exist
      await db.query(
        'INSERT INTO settings (id, shop_name, address, phone, gst_number, license_number) VALUES (1, "", "", "", "", "")'
      );
      const [newSettings] = await db.query('SELECT * FROM settings WHERE id=1');
      res.json(newSettings[0]);
    } else {
      res.json(settings[0]);
    }
  } catch (error) {
    next(error);
  }
});

router.put('/', validate('settings'), async (req, res, next) => {
  try {
    const { shop_name, address, phone, gst_number, license_number } = req.body;
    
    // Check if settings exist
    const [existing] = await db.query('SELECT * FROM settings WHERE id=1');
    
    if (existing.length === 0) {
      // Insert if doesn't exist
      await db.query(
        'INSERT INTO settings (id, shop_name, address, phone, gst_number, license_number) VALUES (1, ?, ?, ?, ?, ?)',
        [shop_name, address, phone, gst_number, license_number]
      );
    } else {
      // Update if exists
      await db.query(
        'UPDATE settings SET shop_name=?, address=?, phone=?, gst_number=?, license_number=? WHERE id=1',
        [shop_name, address, phone, gst_number, license_number]
      );
    }
    
    res.json({ 
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;