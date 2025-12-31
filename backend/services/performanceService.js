const db = require('../config/db');

class PerformanceService {
  /**
   * Get today's sales metrics
   */
  static async getTodayMetrics() {
    const [result] = await db.query(`
      SELECT
        COUNT(*) as transaction_count,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(AVG(total_amount), 0) as avg_bill,
        COALESCE(SUM(CASE WHEN payment_status IN ('due', 'partial') THEN amount_due ELSE 0 END), 0) as pending_amount,
        DATE(created_at) as sale_date
      FROM transactions
      WHERE DATE(created_at) = CURDATE()
    `);
    return result[0] || { transaction_count: 0, total_sales: 0, avg_bill: 0, pending_amount: 0 };
  }

  /**
   * Get yesterday's sales metrics for comparison
   */
  static async getYesterdayMetrics() {
    const [result] = await db.query(`
      SELECT
        COUNT(*) as transaction_count,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(AVG(total_amount), 0) as avg_bill,
        COALESCE(SUM(CASE WHEN payment_status IN ('due', 'partial') THEN amount_due ELSE 0 END), 0) as pending_amount,
        DATE(created_at) as sale_date
      FROM transactions
      WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
    `);
    return result[0] || { transaction_count: 0, total_sales: 0, avg_bill: 0, pending_amount: 0 };
  }

  /**
   * Get this month's metrics
   */
  static async getThisMonthMetrics() {
    const [result] = await db.query(`
      SELECT
        COUNT(*) as transaction_count,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(AVG(total_amount), 0) as avg_bill,
        COALESCE(SUM(CASE WHEN payment_status IN ('due', 'partial') THEN amount_due ELSE 0 END), 0) as pending_amount
      FROM transactions
      WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())
    `);
    return result[0] || { transaction_count: 0, total_sales: 0, avg_bill: 0, pending_amount: 0 };
  }

  /**
   * Get last month's metrics for comparison
   */
  static async getLastMonthMetrics() {
    const [result] = await db.query(`
      SELECT
        COUNT(*) as transaction_count,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(AVG(total_amount), 0) as avg_bill,
        COALESCE(SUM(CASE WHEN payment_status IN ('due', 'partial') THEN amount_due ELSE 0 END), 0) as pending_amount
      FROM transactions
      WHERE YEAR(created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) 
        AND MONTH(created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
    `);
    return result[0] || { transaction_count: 0, total_sales: 0, avg_bill: 0, pending_amount: 0 };
  }

  /**
   * Get this year's metrics
   */
  static async getThisYearMetrics() {
    const [result] = await db.query(`
      SELECT
        COUNT(*) as transaction_count,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(AVG(total_amount), 0) as avg_bill,
        COALESCE(SUM(CASE WHEN payment_status IN ('due', 'partial') THEN amount_due ELSE 0 END), 0) as pending_amount
      FROM transactions
      WHERE YEAR(created_at) = YEAR(CURDATE())
    `);
    return result[0] || { transaction_count: 0, total_sales: 0, avg_bill: 0, pending_amount: 0 };
  }

  /**
   * Get payment status breakdown
   */
  static async getPaymentBreakdown() {
    const [results] = await db.query(`
      SELECT
        payment_status,
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as amount
      FROM transactions
      WHERE DATE(created_at) = CURDATE()
      GROUP BY payment_status
    `);
    return results;
  }

  /**
   * Get hourly sales trend for today
   */
  static async getHourlySalesTrend() {
    const [results] = await db.query(`
      SELECT
        HOUR(created_at) as hour,
        COUNT(*) as transactions,
        COALESCE(SUM(total_amount), 0) as amount,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as paid_amount,
        COALESCE(SUM(CASE WHEN payment_status IN ('due', 'partial') THEN total_amount ELSE 0 END), 0) as pending_amount
      FROM transactions
      WHERE DATE(created_at) = CURDATE()
      GROUP BY HOUR(created_at)
      ORDER BY hour ASC
    `);
    return results;
  }

  /**
   * Get top 5 medicines sold today
   */
  static async getTopMedicinesToday() {
    const [results] = await db.query(`
      SELECT
        m.name as medicine_name,
        m.manufacturer,
        SUM(ti.item_quantity) as total_qty,
        COUNT(DISTINCT t.id) as transaction_count,
        COALESCE(SUM(ti.total_price), 0) as total_revenue
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      JOIN medicines m ON ti.medicine_id = m.id
      WHERE DATE(t.created_at) = CURDATE()
      GROUP BY ti.medicine_id, m.name, m.manufacturer
      ORDER BY total_qty DESC
      LIMIT 5
    `);
    return results;
  }

  /**
   * Get sales by payment mode today
   */
  static async getSalesByPaymentMode() {
    const [results] = await db.query(`
      SELECT
        payment_mode,
        COUNT(*) as transactions,
        COALESCE(SUM(total_amount), 0) as amount
      FROM transactions
      WHERE DATE(created_at) = CURDATE() AND payment_mode IS NOT NULL
      GROUP BY payment_mode
      ORDER BY amount DESC
    `);
    return results;
  }

  /**
   * Get pending payments (customers owing money)
   */
  static async getPendingPayments(limit = 10) {
    const [results] = await db.query(`
      SELECT
        customer_name,
        customer_phone,
        COUNT(*) as pending_bills,
        COALESCE(SUM(amount_due), 0) as total_pending,
        MAX(created_at) as last_purchase_date,
        DATEDIFF(CURDATE(), DATE(MAX(created_at))) as days_since_purchase
      FROM transactions
      WHERE payment_status IN ('due', 'partial') AND CURDATE() >= DATE(created_at)
      GROUP BY customer_name, customer_phone
      HAVING total_pending > 0
      ORDER BY total_pending DESC
      LIMIT ?
    `, [limit]);
    return results;
  }

  /**
   * Get low stock medicines
   */
  static async getLowStockMedicines(limit = 10) {
    const [results] = await db.query(`
      SELECT
        m.id,
        m.name,
        m.manufacturer,
        COALESCE(SUM(mb.stock), 0) as total_stock,
        m.min_stock,
        MIN(mb.expiry) as nearest_expiry,
        DATEDIFF(MIN(mb.expiry), CURDATE()) as days_to_expiry
      FROM medicines m
      LEFT JOIN medicine_batches mb ON m.id = mb.medicine_id
      WHERE m.is_active = TRUE
      GROUP BY m.id, m.name, m.manufacturer, m.min_stock
      HAVING total_stock <= COALESCE(m.min_stock, 5)
      ORDER BY total_stock ASC
      LIMIT ?
    `, [limit]);
    return results;
  }

  /**
   * Get complete dashboard data
   */
  static async getDashboardData() {
    try {
      const [
        today,
        yesterday,
        thisMonth,
        lastMonth,
        thisYear,
        paymentBreakdown,
        hourlySales,
        topMedicines,
        paymentModes,
        pendingPayments,
        lowStock
      ] = await Promise.all([
        this.getTodayMetrics(),
        this.getYesterdayMetrics(),
        this.getThisMonthMetrics(),
        this.getLastMonthMetrics(),
        this.getThisYearMetrics(),
        this.getPaymentBreakdown(),
        this.getHourlySalesTrend(),
        this.getTopMedicinesToday(),
        this.getSalesByPaymentMode(),
        this.getPendingPayments(),
        this.getLowStockMedicines()
      ]);

      // Calculate comparisons
      const todayVsYesterday = {
        sales_change: ((today.total_sales - yesterday.total_sales) / (yesterday.total_sales || 1)) * 100,
        transactions_change: today.transaction_count - yesterday.transaction_count,
        avg_bill_change: ((today.avg_bill - yesterday.avg_bill) / (yesterday.avg_bill || 1)) * 100
      };

      const monthVsLastMonth = {
        sales_change: ((thisMonth.total_sales - lastMonth.total_sales) / (lastMonth.total_sales || 1)) * 100,
        transactions_change: thisMonth.transaction_count - lastMonth.transaction_count
      };

      // Generate alerts
      const alerts = this.generateAlerts({
        pending_amount: today.pending_amount,
        low_stock_count: lowStock.length,
        payment_breakdown: paymentBreakdown
      });

      return {
        metrics: {
          today,
          yesterday,
          thisMonth,
          lastMonth,
          thisYear,
          comparisons: {
            todayVsYesterday,
            monthVsLastMonth
          }
        },
        charts: {
          paymentBreakdown,
          hourlySales,
          topMedicines,
          paymentModes
        },
        tables: {
          pendingPayments,
          lowStock
        },
        alerts,
        timestamp: new Date()
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate alerts based on thresholds
   */
  static generateAlerts(data) {
    const alerts = [];

    // Pending payment alerts
    if (data.pending_amount > 100000) {
      alerts.push({
        type: 'critical',
        category: 'payment',
        message: `High pending amount: ₹${data.pending_amount.toFixed(2)}`,
        icon: '🔴'
      });
    } else if (data.pending_amount > 50000) {
      alerts.push({
        type: 'warning',
        category: 'payment',
        message: `Moderate pending amount: ₹${data.pending_amount.toFixed(2)}`,
        icon: '🟡'
      });
    }

    // Low stock alerts
    if (data.low_stock_count > 5) {
      alerts.push({
        type: 'warning',
        category: 'stock',
        message: `${data.low_stock_count} medicines are low on stock`,
        icon: '🟡'
      });
    }

    // Payment mode alerts
    if (data.payment_breakdown && data.payment_breakdown.length > 0) {
      const dueAmount = data.payment_breakdown.find(p => p.payment_status === 'due');
      if (dueAmount && dueAmount.amount > 25000) {
        alerts.push({
          type: 'warning',
          category: 'payment',
          message: `₹${dueAmount.amount.toFixed(2)} in overdue payments`,
          icon: '🔴'
        });
      }
    }

    return alerts;
  }
}

module.exports = PerformanceService;
