/**
 * Backend Analytics Service
 * Calculates sales trends, forecasts, profit/loss, and customer insights
 */

const pool = require('../config/db');

class AnalyticsService {
  /**
   * Get sales trends for specified period
   * Returns daily sales data for charts
   */
  async getSalesTrends(days = 30) {
    try {
      const query = `
        SELECT 
          DATE(t.created_at) as date,
          COUNT(DISTINCT t.id) as transaction_count,
          SUM(t.total_amount) as daily_sales,
          SUM(CASE WHEN t.payment_status = 'paid' THEN t.total_amount ELSE 0 END) as paid_sales,
          SUM(CASE WHEN t.payment_status != 'paid' THEN t.total_amount ELSE 0 END) as pending_sales
        FROM transactions t
        WHERE t.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(t.created_at)
        ORDER BY date DESC
      `;

      const [rows] = await pool.query(query, [days]);
      return {
        success: true,
        data: rows.reverse(),
        period: `Last ${days} days`
      };
    } catch (error) {
      console.error('Error fetching sales trends:', error);
      throw error;
    }
  }

  /**
   * Get inventory forecast based on sales velocity
   */
  async getInventoryForecast() {
    try {
      const query = `
        SELECT 
          m.id,
          m.name,
          m.salt,
          m.min_stock,
          m.max_stock,
          m.reorder_level,
          0 as current_quantity,
          COALESCE(
            (SELECT SUM(item_quantity) 
             FROM transaction_items ti
             WHERE ti.medicine_id = m.id
             AND ti.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ), 0
          ) as weekly_sales,
          CASE 
            WHEN m.reorder_level IS NULL THEN 'unknown'
            WHEN m.reorder_level = 0 THEN 'stockout'
            WHEN m.reorder_level <= m.min_stock THEN 'critical'
            ELSE 'healthy'
          END as status
        FROM medicines m
        WHERE m.is_active = 1
        ORDER BY status, m.reorder_level ASC
        LIMIT 20
      `;

      const [rows] = await pool.query(query);
      return {
        success: true,
        data: rows,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error fetching inventory forecast:', error);
      throw error;
    }
  }

  /**
   * Get profit and loss analysis
   */
  async getProfitLossAnalysis(months = 12) {
    try {
      const query = `
        SELECT 
          DATE_FORMAT(t.created_at, '%Y-%m') as month,
          SUM(t.total_amount) as revenue,
          0 as cost_of_goods,
          0 as expenses,
          SUM(t.total_amount) as profit
        FROM transactions t
        WHERE t.created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
        GROUP BY DATE_FORMAT(t.created_at, '%Y-%m')
        ORDER BY month ASC
      `;

      const [rows] = await pool.query(query, [months]);
      
      // Calculate aggregates
      const totals = rows.reduce((acc, row) => ({
        revenue: (acc.revenue || 0) + (row.revenue || 0),
        cost_of_goods: (acc.cost_of_goods || 0) + (row.cost_of_goods || 0),
        expenses: (acc.expenses || 0) + (row.expenses || 0),
        profit: (acc.profit || 0) + (row.profit || 0)
      }), {});

      const margin = totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(2) : 0;

      return {
        success: true,
        data: rows,
        totals: {
          ...totals,
          profit_margin: `${margin}%`
        },
        period: `Last ${months} months`
      };
    } catch (error) {
      console.error('Error fetching profit/loss analysis:', error);
      throw error;
    }
  }

  /**
   * Get customer insights and lifetime value
   */
  async getCustomerAnalytics() {
    try {
      const query = `
        SELECT 
          c.id,
          c.name,
          c.phone,
          COUNT(DISTINCT t.id) as total_transactions,
          SUM(t.total_amount) as lifetime_value,
          MAX(t.created_at) as last_purchase,
          DATEDIFF(NOW(), MAX(t.created_at)) as days_since_purchase,
          AVG(t.total_amount) as avg_transaction_value,
          CASE 
            WHEN MAX(t.created_at) IS NULL THEN 'inactive'
            WHEN DATEDIFF(NOW(), MAX(t.created_at)) <= 30 THEN 'active'
            WHEN DATEDIFF(NOW(), MAX(t.created_at)) <= 90 THEN 'at_risk'
            ELSE 'inactive'
          END as status
        FROM customers c
        LEFT JOIN transactions t ON c.id = t.customer_id
        GROUP BY c.id, c.name, c.phone
        ORDER BY lifetime_value DESC
        LIMIT 50
      `;

      const [rows] = await pool.query(query);

      // Segment customers
      const segments = {
        active: rows.filter(r => r.status === 'active').length,
        at_risk: rows.filter(r => r.status === 'at_risk').length,
        inactive: rows.filter(r => r.status === 'inactive').length
      };

      return {
        success: true,
        data: rows,
        segments,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error fetching customer analytics:', error);
      throw error;
    }
  }

  /**
   * Get dashboard summary metrics
   */
  async getDashboardMetrics() {
    try {
      // Today's metrics
      const todayQuery = `
        SELECT 
          SUM(t.total_amount) as today_sales,
          COUNT(DISTINCT t.id) as today_transactions
        FROM transactions t
        WHERE DATE(t.created_at) = DATE(NOW())
      `;

      // This month's metrics
      const monthQuery = `
        SELECT 
          SUM(t.total_amount) as month_sales,
          0 as month_cogs
        FROM transactions t
        WHERE YEAR(t.created_at) = YEAR(NOW())
          AND MONTH(t.created_at) = MONTH(NOW())
      `;

      // Inventory health - using view or basic count
      const inventoryQuery = `
        SELECT 
          COUNT(*) as total_items,
          SUM(CASE WHEN min_stock IS NOT NULL AND min_stock > 0 THEN 1 ELSE 0 END) as active_items,
          0 as stockout_items,
          0 as low_stock_items,
          0 as total_stock_value
        FROM medicines
        WHERE is_active = 1
      `;

      const [todayData] = await pool.query(todayQuery);
      const [monthData] = await pool.query(monthQuery);
      const [inventoryData] = await pool.query(inventoryQuery);

      return {
        success: true,
        today: todayData[0] || {},
        month: monthData[0] || {},
        inventory: inventoryData[0] || {}
      };
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Get top selling medicines
   */
  async getTopSellingMedicines(limit = 10) {
    try {
      const query = `
        SELECT 
          m.id,
          m.name,
          m.salt,
          SUM(ti.item_quantity) as total_sold,
          SUM(ti.total_price) as total_revenue,
          COUNT(DISTINCT ti.transaction_id) as transactions,
          ROUND(SUM(ti.item_quantity) / COUNT(DISTINCT ti.transaction_id), 2) as avg_qty_per_sale
        FROM transaction_items ti
        JOIN medicines m ON ti.medicine_id = m.id
        WHERE ti.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY m.id, m.name, m.salt
        ORDER BY total_sold DESC
        LIMIT ?
      `;

      const [rows] = await pool.query(query, [limit]);
      return {
        success: true,
        data: rows,
        period: 'Last 30 days'
      };
    } catch (error) {
      console.error('Error fetching top selling medicines:', error);
      throw error;
    }
  }
}

module.exports = new AnalyticsService();
