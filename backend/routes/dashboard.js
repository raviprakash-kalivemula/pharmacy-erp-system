const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get dashboard statistics
router.get('/', async (req, res, next) => {
  try {
    // Total stock count
    const [stockCount] = await db.query(`
      SELECT COUNT(DISTINCT m.id) as total_stock,
             COALESCE(SUM(mb.stock * mb.purchase_rate), 0) as stock_value
      FROM medicines m
      LEFT JOIN medicine_batches mb ON m.id = mb.medicine_id
    `);

    // Low stock count - FIX: Use subquery to properly reference min_stock
    const [lowStock] = await db.query(`
      SELECT COUNT(*) as low_stock
      FROM (
        SELECT m.id, m.min_stock, COALESCE(SUM(mb.stock), 0) as total_stock
        FROM medicines m
        LEFT JOIN medicine_batches mb ON m.id = mb.medicine_id
        GROUP BY m.id, m.min_stock
        HAVING total_stock <= m.min_stock
      ) as low_stock_medicines
    `);

    // Expiring soon count (within 90 days)
    const [expiringCount] = await db.query(`
      SELECT COUNT(DISTINCT mb.id) as expiring_soon
      FROM medicine_batches mb
      WHERE mb.expiry <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
      AND mb.stock > 0
    `);

    // Today's sales
    const [todaySales] = await db.query(`
      SELECT COALESCE(SUM(total_amount), 0) as today_sales
      FROM transactions
      WHERE DATE(created_at) = CURDATE()
    `);

    // Pending payments
    const [pendingPayments] = await db.query(`
      SELECT COALESCE(SUM(amount_due), 0) as pending_payments
      FROM transactions
      WHERE payment_status IN ('due', 'partial')
    `);

    // Monthly revenue
    const [monthlyRevenue] = await db.query(`
      SELECT COALESCE(SUM(total_amount), 0) as monthly_revenue
      FROM transactions
      WHERE MONTH(created_at) = MONTH(CURDATE())
      AND YEAR(created_at) = YEAR(CURDATE())
    `);

    // Monthly expenses
    const [monthlyExpense] = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as monthly_expense
      FROM expenses
      WHERE MONTH(expense_date) = MONTH(CURDATE())
      AND YEAR(expense_date) = YEAR(CURDATE())
    `);

    // Calculate profit margin
    const revenue = parseFloat(monthlyRevenue[0].monthly_revenue) || 0;
    const expense = parseFloat(monthlyExpense[0].monthly_expense) || 0;
    const profit = revenue - expense;
    const profitMargin = revenue > 0 ? ((profit / revenue) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      totalStock: stockCount[0].total_stock || 0,
      stockValue: parseFloat(stockCount[0].stock_value) || 0,
      lowStock: lowStock[0].low_stock || 0,
      expiryingSoon: expiringCount[0].expiring_soon || 0,
      todaySales: parseFloat(todaySales[0].today_sales) || 0,
      pendingPayments: parseFloat(pendingPayments[0].pending_payments) || 0,
      monthlyRevenue: parseFloat(monthlyRevenue[0].monthly_revenue) || 0,
      monthlyExpense: parseFloat(monthlyExpense[0].monthly_expense) || 0,
      profitMargin: parseFloat(profitMargin)
    });
  } catch (error) {
    next(error);
  }
});

// New Sales Performance Dashboard Endpoints
const PerformanceService = require('../services/performanceService');

/**
 * GET /api/dashboard/sales-performance
 * Get complete sales performance dashboard data
 */
router.get('/sales-performance', async (req, res, next) => {
  try {
    const dashboardData = await PerformanceService.getDashboardData();
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    next(error);
  }
});

/**
 * GET /api/dashboard/today-metrics
 * Get only today's metrics (lightweight endpoint for frequent updates)
 */
router.get('/today-metrics', async (req, res, next) => {
  try {
    const today = await PerformanceService.getTodayMetrics();
    const yesterday = await PerformanceService.getYesterdayMetrics();
    
    const comparison = {
      sales_change: ((today.total_sales - yesterday.total_sales) / (yesterday.total_sales || 1)) * 100,
      transactions_change: today.transaction_count - yesterday.transaction_count,
      avg_bill_change: ((today.avg_bill - yesterday.avg_bill) / (yesterday.avg_bill || 1)) * 100
    };
    
    res.json({
      success: true,
      data: { today, yesterday, comparison }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/hourly-trend
 * Get hourly sales trend for today
 */
router.get('/hourly-trend', async (req, res, next) => {
  try {
    const data = await PerformanceService.getHourlySalesTrend();
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/top-medicines
 * Get top selling medicines today
 */
router.get('/top-medicines', async (req, res, next) => {
  try {
    const data = await PerformanceService.getTopMedicinesToday();
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/pending-payments
 * Get pending payments list
 */
router.get('/pending-payments', async (req, res, next) => {
  try {
    const limit = req.query.limit || 10;
    const data = await PerformanceService.getPendingPayments(limit);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/low-stock
 * Get low stock medicines
 */
router.get('/low-stock', async (req, res, next) => {
  try {
    const limit = req.query.limit || 10;
    const data = await PerformanceService.getLowStockMedicines(limit);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/payment-breakdown
 * Get payment status breakdown for today
 */
router.get('/payment-breakdown', async (req, res, next) => {
  try {
    const data = await PerformanceService.getPaymentBreakdown();
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;