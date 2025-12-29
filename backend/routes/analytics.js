/**
 * Analytics Routes
 * RESTful endpoints for analytics data
 */

const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analyticsService');
const { authMiddleware } = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * GET /api/analytics/sales-trends
 * Get sales trend data for specified period
 * Query params: days (default 30)
 */
router.get('/sales-trends', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const result = await analyticsService.getSalesTrends(days);
    res.json(result);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/analytics/inventory-forecast
 * Get inventory forecast with stock predictions
 */
router.get('/inventory-forecast', async (req, res) => {
  try {
    const result = await analyticsService.getInventoryForecast();
    res.json(result);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/analytics/profit-loss
 * Get profit and loss analysis
 * Query params: months (default 12)
 */
router.get('/profit-loss', async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const result = await analyticsService.getProfitLossAnalysis(months);
    res.json(result);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/analytics/customers
 * Get customer analytics and lifetime value
 */
router.get('/customers', async (req, res) => {
  try {
    const result = await analyticsService.getCustomerAnalytics();
    res.json(result);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/analytics/dashboard
 * Get dashboard summary metrics
 */
router.get('/dashboard', async (req, res) => {
  try {
    const result = await analyticsService.getDashboardMetrics();
    res.json(result);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/analytics/top-medicines
 * Get top selling medicines
 * Query params: limit (default 10)
 */
router.get('/top-medicines', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const result = await analyticsService.getTopSellingMedicines(limit);
    res.json(result);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
