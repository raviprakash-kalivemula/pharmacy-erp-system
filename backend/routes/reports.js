const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

// Sales Detailed Report with transactions
router.get('/sales', async (req, res, next) => {
  try {
    const { startDate, endDate, type = 'daily' } = req.query;
    
    if (!startDate || !endDate) {
      throw new AppError('Start date and end date are required', 400, 'MISSING_DATES');
    }

    let dateFormat;
    switch (type) {
      case 'monthly':
        dateFormat = '%Y-%m-01';
        break;
      case 'yearly':
        dateFormat = '%Y-01-01';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    // Get transactions
    const [transactions] = await db.query(`
      SELECT 
        t.id,
        t.invoice_no,
        t.created_at,
        t.customer_name,
        t.customer_phone,
        t.subtotal,
        t.tax_amount as tax,
        t.total_amount as total,
        (SELECT COALESCE(SUM(si.amount - si.cost), 0)
         FROM sale_items si WHERE si.transaction_id = t.id) as profit,
        (SELECT COUNT(*) FROM sale_items si WHERE si.transaction_id = t.id) as itemCount
      FROM transactions t
      WHERE DATE(t.created_at) BETWEEN ? AND ?
      ORDER BY t.created_at DESC
    `, [startDate, endDate]);

    // Calculate summary
    const totalRevenue = transactions.reduce((sum, t) => sum + parseFloat(t.total || 0), 0);
    const totalItems = transactions.reduce((sum, t) => sum + parseInt(t.itemCount || 0), 0);
    const totalProfit = transactions.reduce((sum, t) => sum + parseFloat(t.profit || 0), 0);
    const totalTransactions = transactions.length;

    res.json({
      success: true,
      transactions,
      totalRevenue,
      totalItems,
      totalProfit,
      totalTransactions,
      data: transactions
    });
  } catch (error) {
    next(error);
  }
});

// Sales Summary Report
router.get('/sales-summary', async (req, res, next) => {
  try {
    const { start_date, end_date, group_by = 'day' } = req.query;
    
    if (!start_date || !end_date) {
      throw new AppError('Start date and end date are required', 400, 'MISSING_DATES');
    }

    let dateFormat;
    switch (group_by) {
      case 'month':
        dateFormat = '%Y-%m';
        break;
      case 'year':
        dateFormat = '%Y';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    const [sales] = await db.query(`
      SELECT 
        DATE_FORMAT(created_at, ?) as period,
        COUNT(*) as total_transactions,
        SUM(total_amount) as total_revenue,
        SUM(tax_amount) as total_tax,
        AVG(total_amount) as average_sale,
        SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN payment_status = 'due' THEN 1 ELSE 0 END) as due_count,
        SUM(CASE WHEN payment_status = 'partial' THEN 1 ELSE 0 END) as partial_count,
        SUM(amount_due) as total_outstanding
      FROM transactions
      WHERE created_at BETWEEN ? AND ?
      GROUP BY period
      ORDER BY period DESC
    `, [dateFormat, start_date, end_date]);
    
    res.json({ success: true, data: sales });
  } catch (error) {
    next(error);
  }
});

// Top Selling Medicines
router.get('/top-medicines', async (req, res, next) => {
  try {
    const { start_date, end_date, limit = 20 } = req.query;
    
    if (!start_date || !end_date) {
      throw new AppError('Start date and end date are required', 400, 'MISSING_DATES');
    }

    const [medicines] = await db.query(`
      SELECT 
        si.medicine_name,
        si.manufacturer,
        COUNT(DISTINCT si.transaction_id) as transaction_count,
        SUM(si.quantity) as total_quantity,
        SUM(si.amount) as total_revenue,
        AVG(si.rate) as average_rate
      FROM sale_items si
      JOIN transactions t ON si.transaction_id = t.id
      WHERE t.created_at BETWEEN ? AND ?
      GROUP BY si.medicine_name, si.manufacturer
      ORDER BY total_revenue DESC
      LIMIT ?
    `, [start_date, end_date, parseInt(limit)]);
    
    res.json({ success: true, data: medicines });
  } catch (error) {
    next(error);
  }
});

// Customer Report
router.get('/customers', async (req, res, next) => {
  try {
    const { start_date, end_date, type = 'all' } = req.query;
    
    if (!start_date || !end_date) {
      throw new AppError('Start date and end date are required', 400, 'MISSING_DATES');
    }

    let whereClause = '';
    if (type === 'top') {
      whereClause = 'HAVING total_purchases > 0 ORDER BY total_purchases DESC LIMIT 50';
    } else if (type === 'outstanding') {
      whereClause = 'HAVING c.outstanding > 0 ORDER BY c.outstanding DESC';
    }

    const [customers] = await db.query(`
      SELECT 
        c.id,
        c.name,
        c.phone,
        c.outstanding,
        COUNT(t.id) as total_transactions,
        SUM(t.total_amount) as total_purchases,
        SUM(t.amount_paid) as total_paid,
        MAX(t.created_at) as last_purchase_date
      FROM customers c
      LEFT JOIN transactions t ON c.id = t.customer_id
        AND t.created_at BETWEEN ? AND ?
      GROUP BY c.id, c.name, c.phone, c.outstanding
      ${whereClause}
    `, [start_date, end_date]);
    
    res.json({ success: true, data: customers });
  } catch (error) {
    next(error);
  }
});

// Stock Report
router.get('/stock', async (req, res, next) => {
  try {
    const { type = 'all', category } = req.query;
    
    let query = `
      SELECT 
        m.id,
        m.name,
        m.manufacturer,
        m.category,
        m.min_stock,
        m.rack,
        COALESCE(SUM(mb.stock), 0) as total_stock,
        COALESCE(SUM(mb.stock * mb.purchase_rate), 0) as stock_value,
        COUNT(DISTINCT mb.id) as batch_count,
        MIN(mb.expiry) as nearest_expiry
      FROM medicines m
      LEFT JOIN medicine_batches mb ON m.id = mb.medicine_id AND mb.stock > 0
      WHERE m.is_active = TRUE
    `;

    if (category) {
      query += ` AND m.category = ?`;
    }

    query += ` GROUP BY m.id, m.name, m.manufacturer, m.category, m.min_stock, m.rack`;

    if (type === 'low') {
      query += ` HAVING total_stock <= m.min_stock`;
    } else if (type === 'zero') {
      query += ` HAVING total_stock = 0`;
    }

    query += ` ORDER BY m.name`;

    const params = category ? [category] : [];
    const [stock] = await db.query(query, params);
    
    res.json({ success: true, data: stock });
  } catch (error) {
    next(error);
  }
});

// Expiry Report
router.get('/expiry', async (req, res, next) => {
  try {
    const { days = 90 } = req.query;

    const [expiring] = await db.query(`
      SELECT 
        m.id,
        m.name,
        m.manufacturer,
        mb.batch,
        mb.expiry,
        mb.stock,
        mb.mrp,
        mb.purchase_rate,
        COALESCE(mb.stock * mb.purchase_rate, 0) as stock_value,
        DATEDIFF(mb.expiry, CURDATE()) as days_to_expiry,
        CASE 
          WHEN DATEDIFF(mb.expiry, CURDATE()) <= 30 THEN 'Critical'
          WHEN DATEDIFF(mb.expiry, CURDATE()) <= 90 THEN 'Warning'
          ELSE 'Normal'
        END as status
      FROM medicine_batches mb
      JOIN medicines m ON mb.medicine_id = m.id
      WHERE mb.expiry <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      AND mb.stock > 0
      AND m.is_active = TRUE
      ORDER BY mb.expiry ASC
    `, [parseInt(days)]);
    
    res.json({ success: true, data: expiring });
  } catch (error) {
    next(error);
  }
});

// Purchase Report
router.get('/purchases', async (req, res, next) => {
  try {
    const { start_date, end_date, supplier_id } = req.query;
    
    if (!start_date || !end_date) {
      throw new AppError('Start date and end date are required', 400, 'MISSING_DATES');
    }

    let query = `
      SELECT 
        p.id,
        p.invoice_no,
        p.purchase_date,
        p.total_amount,
        p.status,
        s.name as supplier_name,
        s.phone as supplier_phone,
        COUNT(pi.id) as item_count,
        SUM(pi.quantity + pi.free_quantity) as total_quantity
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
      WHERE p.purchase_date BETWEEN ? AND ?
    `;

    const params = [start_date, end_date];

    if (supplier_id) {
      query += ` AND p.supplier_id = ?`;
      params.push(supplier_id);
    }

    query += ` GROUP BY p.id, p.invoice_no, p.purchase_date, p.total_amount, p.status, s.name, s.phone`;
    query += ` ORDER BY p.purchase_date DESC`;

    const [purchases] = await db.query(query, params);
    
    // Calculate totals
    const totalAmount = purchases.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0);
    const totalItems = purchases.reduce((sum, p) => sum + parseInt(p.item_count || 0), 0);
    
    res.json({ 
      success: true, 
      data: purchases,
      summary: {
        total_purchases: purchases.length,
        total_amount: totalAmount,
        total_items: totalItems
      }
    });
  } catch (error) {
    next(error);
  }
});

// Profit/Loss Report
router.get('/profit-loss', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      throw new AppError('Start date and end date are required', 400, 'MISSING_DATES');
    }

    // Get sales revenue
    const [sales] = await db.query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as revenue,
        COALESCE(SUM(tax_amount), 0) as tax_collected,
        COUNT(*) as transaction_count
      FROM transactions
      WHERE created_at BETWEEN ? AND ?
    `, [start_date, end_date]);

    // Get purchase costs
    const [purchases] = await db.query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as purchase_cost,
        COUNT(*) as purchase_count
      FROM purchases
      WHERE purchase_date BETWEEN ? AND ?
    `, [start_date, end_date]);

    // Get expenses
    const [expenses] = await db.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as expenses,
        COUNT(*) as expense_count
      FROM expenses
      WHERE expense_date BETWEEN ? AND ?
    `, [start_date, end_date]);

    const revenue = parseFloat(sales[0].revenue) || 0;
    const purchaseCost = parseFloat(purchases[0].purchase_cost) || 0;
    const expenseAmount = parseFloat(expenses[0].expenses) || 0;
    const grossProfit = revenue - purchaseCost;
    const netProfit = grossProfit - expenseAmount;
    const profitMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        revenue,
        tax_collected: parseFloat(sales[0].tax_collected) || 0,
        purchase_cost: purchaseCost,
        expenses: expenseAmount,
        gross_profit: grossProfit,
        net_profit: netProfit,
        profit_margin: parseFloat(profitMargin),
        transaction_count: sales[0].transaction_count,
        purchase_count: purchases[0].purchase_count,
        expense_count: expenses[0].expense_count
      }
    });
  } catch (error) {
    next(error);
  }
});

// GST Report
router.get('/gst', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      throw new AppError('Start date and end date are required', 400, 'MISSING_DATES');
    }

    const [gstData] = await db.query(`
      SELECT 
        si.gst_percent,
        COUNT(DISTINCT si.transaction_id) as transaction_count,
        SUM(si.quantity) as total_quantity,
        SUM(si.amount) as taxable_amount,
        SUM(si.amount * si.gst_percent / 100) as tax_amount
      FROM sale_items si
      JOIN transactions t ON si.transaction_id = t.id
      WHERE t.created_at BETWEEN ? AND ?
      GROUP BY si.gst_percent
      ORDER BY si.gst_percent
    `, [start_date, end_date]);

    const totalTax = gstData.reduce((sum, row) => sum + parseFloat(row.tax_amount || 0), 0);
    const totalTaxable = gstData.reduce((sum, row) => sum + parseFloat(row.taxable_amount || 0), 0);

    res.json({
      success: true,
      data: gstData,
      summary: {
        total_taxable_amount: totalTaxable,
        total_tax_amount: totalTax,
        total_amount: totalTaxable + totalTax
      }
    });
  } catch (error) {
    next(error);
  }
});

// Payment Status Report
router.get('/payments', async (req, res, next) => {
  try {
    const { start_date, end_date, status } = req.query;
    
    if (!start_date || !end_date) {
      throw new AppError('Start date and end date are required', 400, 'MISSING_DATES');
    }

    let query = `
      SELECT 
        t.invoice_no,
        t.created_at,
        t.customer_name,
        t.customer_phone,
        t.total_amount,
        t.amount_paid,
        t.amount_due,
        t.payment_status,
        t.payment_mode,
        DATEDIFF(CURDATE(), t.created_at) as days_pending
      FROM transactions t
      WHERE t.created_at BETWEEN ? AND ?
    `;

    const params = [start_date, end_date];

    if (status) {
      query += ` AND t.payment_status = ?`;
      params.push(status);
    }

    query += ` ORDER BY t.created_at DESC`;

    const [payments] = await db.query(query, params);

    const summary = {
      total_transactions: payments.length,
      total_amount: payments.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0),
      total_paid: payments.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0),
      total_due: payments.reduce((sum, p) => sum + parseFloat(p.amount_due || 0), 0)
    };

    res.json({
      success: true,
      data: payments,
      summary
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;