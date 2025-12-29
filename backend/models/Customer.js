const db = require('../config/db');
const { DEFAULTS } = require('../config/constants');

class Customer {
  // Find customer by ID
  static async findById(id) {
    const [customers] = await db.query(
      'SELECT * FROM customers WHERE id = ?',
      [id]
    );
    return customers[0] || null;
  }

  // Find customer by phone
  static async findByPhone(phone) {
    const [customers] = await db.query(
      'SELECT * FROM customers WHERE phone = ?',
      [phone]
    );
    return customers[0] || null;
  }

  // Search customers
  static async search(searchTerm = '', limit = DEFAULTS.ITEMS_PER_PAGE, offset = 0) {
    let query = `
      SELECT 
        c.*,
        COUNT(DISTINCT t.id) as total_purchases,
        COALESCE(SUM(t.grand_total), 0) as total_spent,
        COALESCE(SUM(t.grand_total - t.paid_amount), 0) as outstanding
      FROM customers c
      LEFT JOIN transactions t ON c.id = t.customer_id
    `;
    
    const params = [];
    
    if (searchTerm && searchTerm.trim() !== '') {
      query += ' WHERE (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
      const term = `%${searchTerm}%`;
      params.push(term, term, term);
    }
    
    query += ' GROUP BY c.id ORDER BY c.name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [customers] = await db.query(query, params);
    return customers;
  }

  // Get all customers
  static async findAll(options = {}) {
    const { 
      limit = DEFAULTS.ITEMS_PER_PAGE, 
      offset = 0, 
      withStats = false 
    } = options;

    if (withStats) {
      return this.search('', limit, offset);
    }

    const [customers] = await db.query(
      'SELECT * FROM customers ORDER BY name LIMIT ? OFFSET ?',
      [parseInt(limit), parseInt(offset)]
    );
    return customers;
  }

  // Get customers with outstanding balance
  static async findWithOutstanding() {
    const [customers] = await db.query(`
      SELECT 
        c.*,
        COALESCE(SUM(t.grand_total - t.paid_amount), 0) as outstanding
      FROM customers c
      INNER JOIN transactions t ON c.id = t.customer_id
      WHERE t.payment_status IN ('due', 'partial')
      GROUP BY c.id
      HAVING outstanding > 0
      ORDER BY outstanding DESC
    `);
    return customers;
  }

  // Get customer with purchase history
  static async findWithHistory(id, limit = 10) {
    const customer = await this.findById(id);
    if (!customer) return null;

    const [transactions] = await db.query(
      `SELECT 
        t.*,
        COUNT(ti.id) as item_count
      FROM transactions t
      LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
      WHERE t.customer_id = ?
      GROUP BY t.id
      ORDER BY t.created_at DESC
      LIMIT ?`,
      [id, limit]
    );

    return { 
      ...customer, 
      recent_purchases: transactions,
      purchase_count: transactions.length 
    };
  }

  // Create new customer
  static async create(data) {
    const {
      name,
      phone = null,
      email = null,
      address = null,
      gst_number = null,
      dl_number = null
    } = data;

    const [result] = await db.query(
      `INSERT INTO customers 
       (name, phone, email, address, gst_number, dl_number, last_purchase_date) 
       VALUES (?, ?, ?, ?, ?, ?, CURDATE())`,
      [name.trim(), phone, email, address, gst_number, dl_number]
    );

    return result.insertId;
  }

  // Update customer
  static async update(id, data) {
    const {
      name,
      phone,
      email,
      address,
      gst_number,
      dl_number
    } = data;

    const [result] = await db.query(
      `UPDATE customers 
       SET name=?, phone=?, email=?, address=?, gst_number=?, dl_number=?
       WHERE id=?`,
      [name.trim(), phone, email, address, gst_number, dl_number, id]
    );

    return result.affectedRows > 0;
  }

  // Update last purchase date
  static async updateLastPurchase(id, date = null) {
    const purchaseDate = date || new Date();
    const [result] = await db.query(
      'UPDATE customers SET last_purchase_date = ? WHERE id = ?',
      [purchaseDate, id]
    );
    return result.affectedRows > 0;
  }

  // Delete customer (only if no purchase history)
  static async delete(id) {
    // Check if customer has any transactions
    const [transactions] = await db.query(
      'SELECT COUNT(*) as count FROM transactions WHERE customer_id = ?',
      [id]
    );

    if (transactions[0].count > 0) {
      throw new Error('Cannot delete customer with purchase history');
    }

    const [result] = await db.query('DELETE FROM customers WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // Get customer loyalty points (if implemented)
  static async getLoyaltyPoints(id) {
    const [result] = await db.query(
      `SELECT 
        COALESCE(SUM(t.grand_total), 0) * ${DEFAULTS.LOYALTY_POINTS_RATE} as points
      FROM transactions t
      WHERE t.customer_id = ? AND t.payment_status = 'paid'`,
      [id]
    );
    return Math.floor(result[0].points);
  }

  // Count total customers
  static async count(search = '') {
    let query = 'SELECT COUNT(*) as total FROM customers';
    const params = [];

    if (search && search.trim() !== '') {
      query += ' WHERE (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const [result] = await db.query(query, params);
    return result[0].total;
  }
}

module.exports = Customer;