const db = require('../config/db');
const { PAYMENT_STATUS, DEFAULTS } = require('../config/constants');

class Transaction {
  // Find transaction by ID
  static async findById(id) {
    const [transactions] = await db.query(
      `SELECT 
        t.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.address as customer_address,
        c.gst_number as customer_gst
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE t.id = ?`,
      [id]
    );
    return transactions[0] || null;
  }

  // Find transaction with items
  static async findWithItems(id) {
    const transaction = await this.findById(id);
    if (!transaction) return null;

    const [items] = await db.query(
      `SELECT 
        ti.*,
        m.name as medicine_name,
        m.manufacturer,
        mb.batch,
        mb.expiry
      FROM transaction_items ti
      LEFT JOIN medicines m ON ti.medicine_id = m.id
      LEFT JOIN medicine_batches mb ON ti.batch_id = mb.id
      WHERE ti.transaction_id = ?`,
      [id]
    );

    return { ...transaction, items };
  }

  // Get all transactions with filters
  static async findAll(options = {}) {
    const {
      limit = DEFAULTS.ITEMS_PER_PAGE,
      offset = 0,
      customerId = null,
      paymentStatus = null,
      startDate = null,
      endDate = null,
      search = ''
    } = options;

    let query = `
      SELECT 
        t.*,
        c.name as customer_name,
        c.phone as customer_phone,
        COUNT(DISTINCT ti.id) as item_count
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
    `;

    const conditions = [];
    const params = [];

    if (customerId) {
      conditions.push('t.customer_id = ?');
      params.push(customerId);
    }

    if (paymentStatus) {
      conditions.push('t.payment_status = ?');
      params.push(paymentStatus);
    }

    if (startDate) {
      conditions.push('DATE(t.created_at) >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('DATE(t.created_at) <= ?');
      params.push(endDate);
    }

    if (search && search.trim() !== '') {
      conditions.push('(t.invoice_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY t.id ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [transactions] = await db.query(query, params);
    return transactions;
  }

  // Create new transaction
  static async create(data, items) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Insert transaction
      const {
        invoice_number,
        customer_id = null,
        customer_name = null,
        subtotal,
        discount = 0,
        tax = 0,
        grand_total,
        paid_amount = 0,
        payment_mode = 'Cash',
        payment_status = PAYMENT_STATUS.PAID
      } = data;

      const [result] = await connection.query(
        `INSERT INTO transactions 
         (invoice_number, customer_id, customer_name, subtotal, discount, tax, 
          grand_total, paid_amount, payment_mode, payment_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [invoice_number, customer_id, customer_name, subtotal, discount, tax, 
         grand_total, paid_amount, payment_mode, payment_status]
      );

      const transactionId = result.insertId;

      // Insert transaction items and update stock
      for (const item of items) {
        // Insert item
        await connection.query(
          `INSERT INTO transaction_items 
           (transaction_id, medicine_id, batch_id, quantity, rate, discount, total) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [transactionId, item.medicine_id, item.batch_id, item.quantity, 
           item.rate, item.discount || 0, item.total]
        );

        // Update batch stock
        await connection.query(
          'UPDATE medicine_batches SET stock = stock - ? WHERE id = ?',
          [item.quantity, item.batch_id]
        );
      }

      // Update customer last purchase date if customer exists
      if (customer_id) {
        await connection.query(
          'UPDATE customers SET last_purchase_date = CURDATE() WHERE id = ?',
          [customer_id]
        );
      }

      await connection.commit();
      return transactionId;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Update payment
  static async updatePayment(id, paidAmount, paymentMode = 'Cash') {
    const transaction = await this.findById(id);
    if (!transaction) return false;

    const totalPaid = parseFloat(transaction.paid_amount) + parseFloat(paidAmount);
    const grandTotal = parseFloat(transaction.grand_total);

    let paymentStatus = PAYMENT_STATUS.PARTIAL;
    if (totalPaid >= grandTotal) {
      paymentStatus = PAYMENT_STATUS.PAID;
    } else if (totalPaid === 0) {
      paymentStatus = PAYMENT_STATUS.DUE;
    }

    const [result] = await db.query(
      `UPDATE transactions 
       SET paid_amount = ?, payment_status = ?, payment_mode = ?
       WHERE id = ?`,
      [totalPaid, paymentStatus, paymentMode, id]
    );

    return result.affectedRows > 0;
  }

  // Get sales summary
  static async getSalesSummary(startDate, endDate) {
    const [result] = await db.query(
      `SELECT 
        COUNT(*) as total_bills,
        COALESCE(SUM(grand_total), 0) as total_sales,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(grand_total - paid_amount), 0) as total_due,
        COALESCE(AVG(grand_total), 0) as avg_bill_value
      FROM transactions
      WHERE DATE(created_at) BETWEEN ? AND ?`,
      [startDate, endDate]
    );
    return result[0];
  }

  // Get daily sales
  static async getDailySales(startDate, endDate) {
    const [sales] = await db.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as bills,
        COALESCE(SUM(grand_total), 0) as sales,
        COALESCE(SUM(paid_amount), 0) as received
      FROM transactions
      WHERE DATE(created_at) BETWEEN ? AND ?
      GROUP BY DATE(created_at)
      ORDER BY date DESC`,
      [startDate, endDate]
    );
    return sales;
  }

  // Get top selling medicines
  static async getTopSelling(limit = 10, startDate = null, endDate = null) {
    let query = `
      SELECT 
        m.id,
        m.name,
        m.manufacturer,
        SUM(ti.quantity) as total_quantity,
        SUM(ti.total) as total_sales,
        COUNT(DISTINCT t.id) as transaction_count
      FROM transaction_items ti
      INNER JOIN medicines m ON ti.medicine_id = m.id
      INNER JOIN transactions t ON ti.transaction_id = t.id
    `;

    const params = [];
    
    if (startDate && endDate) {
      query += ' WHERE DATE(t.created_at) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    query += ` 
      GROUP BY m.id 
      ORDER BY total_quantity DESC 
      LIMIT ?
    `;
    params.push(limit);

    const [medicines] = await db.query(query, params);
    return medicines;
  }

  // Get payment summary
  static async getPaymentSummary(startDate, endDate) {
    const [result] = await db.query(
      `SELECT 
        payment_mode,
        COUNT(*) as count,
        COALESCE(SUM(paid_amount), 0) as amount
      FROM transactions
      WHERE DATE(created_at) BETWEEN ? AND ?
      GROUP BY payment_mode`,
      [startDate, endDate]
    );
    return result;
  }

  // Count transactions
  static async count(filters = {}) {
    let query = 'SELECT COUNT(*) as total FROM transactions';
    const conditions = [];
    const params = [];

    if (filters.customerId) {
      conditions.push('customer_id = ?');
      params.push(filters.customerId);
    }

    if (filters.paymentStatus) {
      conditions.push('payment_status = ?');
      params.push(filters.paymentStatus);
    }

    if (filters.startDate) {
      conditions.push('DATE(created_at) >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push('DATE(created_at) <= ?');
      params.push(filters.endDate);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const [result] = await db.query(query, params);
    return result[0].total;
  }

  // Delete transaction (with rollback of stock)
  static async delete(id) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Get transaction items first
      const [items] = await connection.query(
        'SELECT batch_id, quantity FROM transaction_items WHERE transaction_id = ?',
        [id]
      );

      // Restore stock
      for (const item of items) {
        await connection.query(
          'UPDATE medicine_batches SET stock = stock + ? WHERE id = ?',
          [item.quantity, item.batch_id]
        );
      }

      // Delete transaction items
      await connection.query('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);

      // Delete transaction
      await connection.query('DELETE FROM transactions WHERE id = ?', [id]);

      await connection.commit();
      return true;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = Transaction;