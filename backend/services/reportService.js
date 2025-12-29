const { formatDate, formatCurrency } = require('../utils/helpers');

class ReportService {
  /**
   * Generate Sales Summary Report
   */
  static async generateSalesSummary(db, startDate, endDate) {
    // Overall summary
    const [summary] = await db.query(
      `SELECT 
        COUNT(DISTINCT t.id) as total_bills,
        COUNT(DISTINCT t.customer_id) as unique_customers,
        COALESCE(SUM(t.grand_total), 0) as total_sales,
        COALESCE(SUM(t.paid_amount), 0) as total_received,
        COALESCE(SUM(t.grand_total - t.paid_amount), 0) as total_due,
        COALESCE(AVG(t.grand_total), 0) as avg_bill_value,
        COALESCE(SUM(ti.quantity), 0) as total_items_sold
      FROM transactions t
      LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
      WHERE DATE(t.created_at) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    // Payment mode breakdown
    const [paymentModes] = await db.query(
      `SELECT 
        payment_mode,
        COUNT(*) as count,
        COALESCE(SUM(paid_amount), 0) as amount
      FROM transactions
      WHERE DATE(created_at) BETWEEN ? AND ?
      GROUP BY payment_mode
      ORDER BY amount DESC`,
      [startDate, endDate]
    );

    // Daily sales trend
    const [dailySales] = await db.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as bills,
        COALESCE(SUM(grand_total), 0) as sales,
        COALESCE(SUM(paid_amount), 0) as received
      FROM transactions
      WHERE DATE(created_at) BETWEEN ? AND ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC`,
      [startDate, endDate]
    );

    return {
      period: { start: startDate, end: endDate },
      summary: summary[0],
      paymentModes,
      dailySales
    };
  }

  /**
   * Generate Purchase Summary Report
   */
  static async generatePurchaseSummary(db, startDate, endDate) {
    // Overall summary
    const [summary] = await db.query(
      `SELECT 
        COUNT(DISTINCT p.id) as total_purchases,
        COUNT(DISTINCT p.supplier_id) as unique_suppliers,
        COALESCE(SUM(p.total_amount), 0) as total_amount,
        COALESCE(SUM(p.paid_amount), 0) as total_paid,
        COALESCE(SUM(p.total_amount - p.paid_amount), 0) as total_due,
        COALESCE(AVG(p.total_amount), 0) as avg_purchase_value,
        COALESCE(SUM(pi.quantity + pi.free), 0) as total_items_purchased
      FROM purchases p
      LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
      WHERE DATE(p.purchase_date) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    // Supplier-wise breakdown
    const [suppliers] = await db.query(
      `SELECT 
        s.name as supplier_name,
        COUNT(DISTINCT p.id) as purchase_count,
        COALESCE(SUM(p.total_amount), 0) as total_amount,
        COALESCE(SUM(p.paid_amount), 0) as paid_amount,
        COALESCE(SUM(p.total_amount - p.paid_amount), 0) as due_amount
      FROM purchases p
      INNER JOIN suppliers s ON p.supplier_id = s.id
      WHERE DATE(p.purchase_date) BETWEEN ? AND ?
      GROUP BY p.supplier_id, s.name
      ORDER BY total_amount DESC
      LIMIT 10`,
      [startDate, endDate]
    );

    return {
      period: { start: startDate, end: endDate },
      summary: summary[0],
      topSuppliers: suppliers
    };
  }

  /**
   * Generate Stock Report
   */
  static async generateStockReport(db) {
    // Stock summary
    const [summary] = await db.query(
      `SELECT 
        COUNT(DISTINCT m.id) as total_medicines,
        COALESCE(SUM(mb.stock), 0) as total_stock_quantity,
        COALESCE(SUM(mb.stock * mb.purchase_rate), 0) as stock_value_at_cost,
        COALESCE(SUM(mb.stock * mb.mrp), 0) as stock_value_at_mrp,
        COUNT(DISTINCT mb.id) as total_batches
      FROM medicines m
      LEFT JOIN medicine_batches mb ON m.id = mb.medicine_id
      WHERE m.is_active = TRUE`
    );

    // Low stock medicines
    const [lowStock] = await db.query(
      `SELECT 
        m.id,
        m.name,
        m.manufacturer,
        m.min_stock,
        COALESCE(SUM(mb.stock), 0) as current_stock
      FROM medicines m
      LEFT JOIN medicine_batches mb ON m.id = mb.medicine_id
      WHERE m.is_active = TRUE
      GROUP BY m.id, m.name, m.manufacturer, m.min_stock
      HAVING current_stock <= m.min_stock
      ORDER BY current_stock ASC
      LIMIT 20`
    );

    // Out of stock
    const [outOfStock] = await db.query(
      `SELECT 
        m.id,
        m.name,
        m.manufacturer,
        m.min_stock
      FROM medicines m
      LEFT JOIN medicine_batches mb ON m.id = mb.medicine_id
      WHERE m.is_active = TRUE
      GROUP BY m.id, m.name, m.manufacturer, m.min_stock
      HAVING COALESCE(SUM(mb.stock), 0) = 0
      ORDER BY m.name
      LIMIT 20`
    );

    // Expiring stock (within 90 days)
    const [expiringStock] = await db.query(
      `SELECT 
        m.name as medicine_name,
        m.manufacturer,
        mb.batch,
        mb.expiry,
        mb.stock,
        mb.mrp,
        DATEDIFF(mb.expiry, CURDATE()) as days_to_expiry
      FROM medicine_batches mb
      INNER JOIN medicines m ON mb.medicine_id = m.id
      WHERE mb.stock > 0 
        AND DATEDIFF(mb.expiry, CURDATE()) <= 90
        AND DATEDIFF(mb.expiry, CURDATE()) > 0
      ORDER BY mb.expiry ASC
      LIMIT 20`
    );

    return {
      summary: summary[0],
      lowStock,
      outOfStock,
      expiringStock
    };
  }

  /**
   * Generate Profit/Loss Report
   */
  static async generateProfitReport(db, startDate, endDate) {
    // Sales data
    const [sales] = await db.query(
      `SELECT 
        COALESCE(SUM(ti.quantity * ti.rate), 0) as sales_amount,
        COALESCE(SUM(ti.quantity * mb.purchase_rate), 0) as cost_amount
      FROM transaction_items ti
      INNER JOIN transactions t ON ti.transaction_id = t.id
      INNER JOIN medicine_batches mb ON ti.batch_id = mb.id
      WHERE DATE(t.created_at) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    const salesAmount = parseFloat(sales[0].sales_amount);
    const costAmount = parseFloat(sales[0].cost_amount);
    const grossProfit = salesAmount - costAmount;
    const profitMargin = salesAmount > 0 ? (grossProfit / salesAmount) * 100 : 0;

    // Category-wise profit
    const [categoryProfit] = await db.query(
      `SELECT 
        m.category,
        COALESCE(SUM(ti.quantity * ti.rate), 0) as sales,
        COALESCE(SUM(ti.quantity * mb.purchase_rate), 0) as cost,
        COALESCE(SUM(ti.quantity * ti.rate) - SUM(ti.quantity * mb.purchase_rate), 0) as profit
      FROM transaction_items ti
      INNER JOIN transactions t ON ti.transaction_id = t.id
      INNER JOIN medicines m ON ti.medicine_id = m.id
      INNER JOIN medicine_batches mb ON ti.batch_id = mb.id
      WHERE DATE(t.created_at) BETWEEN ? AND ?
      GROUP BY m.category
      ORDER BY profit DESC`,
      [startDate, endDate]
    );

    return {
      period: { start: startDate, end: endDate },
      summary: {
        sales: salesAmount,
        cost: costAmount,
        grossProfit: parseFloat(grossProfit.toFixed(2)),
        profitMargin: parseFloat(profitMargin.toFixed(2))
      },
      categoryWise: categoryProfit.map(cat => ({
        category: cat.category || 'Uncategorized',
        sales: parseFloat(cat.sales),
        cost: parseFloat(cat.cost),
        profit: parseFloat(cat.profit),
        margin: cat.sales > 0 ? parseFloat(((cat.profit / cat.sales) * 100).toFixed(2)) : 0
      }))
    };
  }

  /**
   * Generate Top Selling Medicines Report
   */
  static async generateTopSellingReport(db, startDate, endDate, limit = 20) {
    const [topSelling] = await db.query(
      `SELECT 
        m.id,
        m.name,
        m.manufacturer,
        m.category,
        COALESCE(SUM(ti.quantity), 0) as total_quantity,
        COALESCE(SUM(ti.total), 0) as total_sales,
        COALESCE(SUM(ti.quantity * mb.purchase_rate), 0) as cost,
        COUNT(DISTINCT t.id) as transaction_count
      FROM transaction_items ti
      INNER JOIN transactions t ON ti.transaction_id = t.id
      INNER JOIN medicines m ON ti.medicine_id = m.id
      INNER JOIN medicine_batches mb ON ti.batch_id = mb.id
      WHERE DATE(t.created_at) BETWEEN ? AND ?
      GROUP BY m.id, m.name, m.manufacturer, m.category
      ORDER BY total_quantity DESC
      LIMIT ?`,
      [startDate, endDate, limit]
    );

    return {
      period: { start: startDate, end: endDate },
      medicines: topSelling.map(med => ({
        ...med,
        profit: parseFloat((med.total_sales - med.cost).toFixed(2)),
        margin: med.total_sales > 0 ? 
          parseFloat((((med.total_sales - med.cost) / med.total_sales) * 100).toFixed(2)) : 0
      }))
    };
  }

  /**
   * Generate Customer Report
   */
  static async generateCustomerReport(db, startDate, endDate) {
    // Top customers by sales
    const [topCustomers] = await db.query(
      `SELECT 
        c.id,
        c.name,
        c.phone,
        COUNT(DISTINCT t.id) as purchase_count,
        COALESCE(SUM(t.grand_total), 0) as total_purchased,
        COALESCE(SUM(t.grand_total - t.paid_amount), 0) as outstanding,
        MAX(t.created_at) as last_purchase
      FROM customers c
      INNER JOIN transactions t ON c.id = t.customer_id
      WHERE DATE(t.created_at) BETWEEN ? AND ?
      GROUP BY c.id, c.name, c.phone
      ORDER BY total_purchased DESC
      LIMIT 20`,
      [startDate, endDate]
    );

    // New customers in period
    const [newCustomers] = await db.query(
      `SELECT COUNT(*) as count
      FROM customers
      WHERE DATE(created_at) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    // Customers with outstanding
    const [outstanding] = await db.query(
      `SELECT 
        c.name,
        c.phone,
        COALESCE(SUM(t.grand_total - t.paid_amount), 0) as due_amount
      FROM customers c
      INNER JOIN transactions t ON c.id = t.customer_id
      WHERE t.payment_status IN ('due', 'partial')
      GROUP BY c.id, c.name, c.phone
      HAVING due_amount > 0
      ORDER BY due_amount DESC
      LIMIT 20`
    );

    return {
      period: { start: startDate, end: endDate },
      topCustomers,
      newCustomers: newCustomers[0].count,
      outstanding
    };
  }

  /**
   * Generate Expiry Report
   */
  static async generateExpiryReport(db) {
    // Expired stock
    const [expired] = await db.query(
      `SELECT 
        m.name as medicine_name,
        m.manufacturer,
        mb.batch,
        mb.expiry,
        mb.stock,
        mb.mrp,
        mb.stock * mb.purchase_rate as cost_value
      FROM medicine_batches mb
      INNER JOIN medicines m ON mb.medicine_id = m.id
      WHERE mb.stock > 0 AND mb.expiry < CURDATE()
      ORDER BY mb.expiry DESC`
    );

    // Expiring in 30 days
    const [expiring30] = await db.query(
      `SELECT 
        m.name as medicine_name,
        m.manufacturer,
        mb.batch,
        mb.expiry,
        mb.stock,
        mb.mrp,
        DATEDIFF(mb.expiry, CURDATE()) as days_to_expiry
      FROM medicine_batches mb
      INNER JOIN medicines m ON mb.medicine_id = m.id
      WHERE mb.stock > 0 
        AND mb.expiry >= CURDATE()
        AND DATEDIFF(mb.expiry, CURDATE()) <= 30
      ORDER BY mb.expiry ASC`
    );

    // Expiring in 90 days
    const [expiring90] = await db.query(
      `SELECT 
        m.name as medicine_name,
        m.manufacturer,
        mb.batch,
        mb.expiry,
        mb.stock,
        mb.mrp,
        DATEDIFF(mb.expiry, CURDATE()) as days_to_expiry
      FROM medicine_batches mb
      INNER JOIN medicines m ON mb.medicine_id = m.id
      WHERE mb.stock > 0 
        AND mb.expiry >= CURDATE()
        AND DATEDIFF(mb.expiry, CURDATE()) <= 90
      ORDER BY mb.expiry ASC`
    );

    const expiredValue = expired.reduce((sum, item) => sum + parseFloat(item.cost_value), 0);

    return {
      expired: {
        count: expired.length,
        totalValue: parseFloat(expiredValue.toFixed(2)),
        items: expired
      },
      expiring30Days: expiring30,
      expiring90Days: expiring90
    };
  }

  /**
   * Generate GST Report
   */
  static async generateGSTReport(db, startDate, endDate) {
    // Sales GST
    const [salesGST] = await db.query(
      `SELECT 
        DATE(t.created_at) as date,
        COALESCE(SUM(ti.quantity * ti.rate), 0) as taxable_amount,
        COALESCE(SUM((ti.quantity * ti.rate) * mb.gst / 100), 0) as gst_amount
      FROM transaction_items ti
      INNER JOIN transactions t ON ti.transaction_id = t.id
      INNER JOIN medicine_batches mb ON ti.batch_id = mb.id
      WHERE DATE(t.created_at) BETWEEN ? AND ?
      GROUP BY DATE(t.created_at)
      ORDER BY date ASC`,
      [startDate, endDate]
    );

    // GST rate-wise breakdown
    const [gstBreakdown] = await db.query(
      `SELECT 
        mb.gst as gst_rate,
        COALESCE(SUM(ti.quantity * ti.rate), 0) as taxable_amount,
        COALESCE(SUM((ti.quantity * ti.rate) * mb.gst / 100), 0) as gst_amount,
        COALESCE(SUM((ti.quantity * ti.rate) * mb.gst / 200), 0) as cgst,
        COALESCE(SUM((ti.quantity * ti.rate) * mb.gst / 200), 0) as sgst
      FROM transaction_items ti
      INNER JOIN transactions t ON ti.transaction_id = t.id
      INNER JOIN medicine_batches mb ON ti.batch_id = mb.id
      WHERE DATE(t.created_at) BETWEEN ? AND ?
      GROUP BY mb.gst
      ORDER BY mb.gst ASC`,
      [startDate, endDate]
    );

    const totalGST = gstBreakdown.reduce((sum, item) => sum + parseFloat(item.gst_amount), 0);

    return {
      period: { start: startDate, end: endDate },
      summary: {
        totalGST: parseFloat(totalGST.toFixed(2))
      },
      dailyGST: salesGST,
      gstBreakdown: gstBreakdown.map(item => ({
        gstRate: parseFloat(item.gst_rate),
        taxableAmount: parseFloat(item.taxable_amount),
        gstAmount: parseFloat(item.gst_amount),
        cgst: parseFloat(item.cgst),
        sgst: parseFloat(item.sgst)
      }))
    };
  }
}

module.exports = ReportService;