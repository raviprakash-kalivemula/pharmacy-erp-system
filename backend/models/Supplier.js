const db = require('../config/db');
const { DEFAULTS } = require('../config/constants');

class Supplier {
  // Find supplier by ID
  static async findById(id) {
    const [suppliers] = await db.query(
      'SELECT * FROM suppliers WHERE id = ?',
      [id]
    );
    return suppliers[0] || null;
  }

  // Find supplier by name
  static async findByName(name) {
    const [suppliers] = await db.query(
      'SELECT * FROM suppliers WHERE name = ?',
      [name]
    );
    return suppliers[0] || null;
  }

  // Search suppliers
  static async search(searchTerm = '', limit = DEFAULTS.ITEMS_PER_PAGE, offset = 0) {
    let query = `
      SELECT 
        s.*,
        COUNT(DISTINCT p.id) as total_purchases,
        COALESCE(SUM(p.total_amount), 0) as total_purchased,
        COALESCE(SUM(p.total_amount - p.paid_amount), 0) as outstanding
      FROM suppliers s
      LEFT JOIN purchases p ON s.id = p.supplier_id
    `;
    
    const params = [];
    
    if (searchTerm && searchTerm.trim() !== '') {
      query += ' WHERE (s.name LIKE ? OR s.phone LIKE ? OR s.email LIKE ?)';
      const term = `%${searchTerm}%`;
      params.push(term, term, term);
    }
    
    query += ' GROUP BY s.id ORDER BY s.name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [suppliers] = await db.query(query, params);
    return suppliers;
  }

  // Get all suppliers
  static async findAll(options = {}) {
    const { 
      limit = DEFAULTS.ITEMS_PER_PAGE, 
      offset = 0, 
      withStats = false 
    } = options;

    if (withStats) {
      return this.search('', limit, offset);
    }

    const [suppliers] = await db.query(
      'SELECT * FROM suppliers ORDER BY name LIMIT ? OFFSET ?',
      [parseInt(limit), parseInt(offset)]
    );
    return suppliers;
  }

  // Get suppliers with outstanding balance
  static async findWithOutstanding() {
    const [suppliers] = await db.query(`
      SELECT 
        s.*,
        COALESCE(SUM(p.total_amount - p.paid_amount), 0) as outstanding
      FROM suppliers s
      INNER JOIN purchases p ON s.id = p.supplier_id
      WHERE p.total_amount > p.paid_amount
      GROUP BY s.id
      HAVING outstanding > 0
      ORDER BY outstanding DESC
    `);
    return suppliers;
  }

  // Get supplier with purchase history
  static async findWithHistory(id, limit = 10) {
    const supplier = await this.findById(id);
    if (!supplier) return null;

    const [purchases] = await db.query(
      `SELECT 
        p.*,
        COUNT(pi.id) as item_count
      FROM purchases p
      LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
      WHERE p.supplier_id = ?
      GROUP BY p.id
      ORDER BY p.purchase_date DESC
      LIMIT ?`,
      [id, limit]
    );

    return { 
      ...supplier, 
      recent_purchases: purchases,
      purchase_count: purchases.length 
    };
  }

  // Create new supplier
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
      `INSERT INTO suppliers 
       (name, phone, email, address, gst_number, dl_number) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), phone, email, address, gst_number, dl_number]
    );

    return result.insertId;
  }

  // Update supplier
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
      `UPDATE suppliers 
       SET name=?, phone=?, email=?, address=?, gst_number=?, dl_number=?
       WHERE id=?`,
      [name.trim(), phone, email, address, gst_number, dl_number, id]
    );

    return result.affectedRows > 0;
  }

  // Delete supplier (only if no purchase history)
  static async delete(id) {
    // Check if supplier has any purchases
    const [purchases] = await db.query(
      'SELECT COUNT(*) as count FROM purchases WHERE supplier_id = ?',
      [id]
    );

    if (purchases[0].count > 0) {
      throw new Error('Cannot delete supplier with purchase history');
    }

    const [result] = await db.query('DELETE FROM suppliers WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // Get top suppliers by purchase volume
  static async getTopSuppliers(limit = 10, startDate = null, endDate = null) {
    let query = `
      SELECT 
        s.*,
        COUNT(DISTINCT p.id) as purchase_count,
        COALESCE(SUM(p.total_amount), 0) as total_purchased
      FROM suppliers s
      INNER JOIN purchases p ON s.id = p.supplier_id
    `;

    const params = [];
    
    if (startDate && endDate) {
      query += ' WHERE DATE(p.purchase_date) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    query += ` 
      GROUP BY s.id 
      ORDER BY total_purchased DESC 
      LIMIT ?
    `;
    params.push(limit);

    const [suppliers] = await db.query(query, params);
    return suppliers;
  }

  // Count total suppliers
  static async count(search = '') {
    let query = 'SELECT COUNT(*) as total FROM suppliers';
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

module.exports = Supplier;