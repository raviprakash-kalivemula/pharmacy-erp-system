const db = require('../config/db');
const { DEFAULTS } = require('../config/constants');

class Medicine {
  // Find medicine by ID
  static async findById(id) {
    const [medicines] = await db.query(
      'SELECT * FROM medicines WHERE id = ? AND is_active = TRUE',
      [id]
    );
    return medicines[0] || null;
  }

  // Find medicine by name
  static async findByName(name, manufacturer = null) {
    let query = 'SELECT * FROM medicines WHERE name = ? AND is_active = TRUE';
    const params = [name];
    
    if (manufacturer) {
      query += ' AND manufacturer = ?';
      params.push(manufacturer);
    }
    
    const [medicines] = await db.query(query, params);
    return medicines[0] || null;
  }

  // Get all medicines with stock info
  static async findAll(options = {}) {
    const { 
      limit = DEFAULTS.ITEMS_PER_PAGE, 
      offset = 0, 
      search = '',
      includeInactive = false 
    } = options;
    
    let query = `
      SELECT 
        m.*,
        COALESCE(SUM(mb.stock), 0) as total_stock,
        MIN(mb.expiry) as nearest_expiry,
        COUNT(DISTINCT mb.id) as batch_count,
        MIN(CASE WHEN mb.stock > 0 THEN mb.purchase_rate END) as lowest_rate,
        MIN(CASE WHEN mb.stock > 0 THEN mb.selling_rate END) as lowest_selling_rate,
        MIN(CASE WHEN mb.stock > 0 THEN mb.mrp END) as lowest_mrp
      FROM medicines m
      LEFT JOIN medicine_batches mb ON m.id = mb.medicine_id
    `;
    
    const params = [];
    const conditions = [];
    
    if (!includeInactive) {
      conditions.push('m.is_active = TRUE');
    }
    
    if (search && search.trim() !== '') {
      conditions.push('(m.name LIKE ? OR m.salt LIKE ? OR m.manufacturer LIKE ?)');
      const searchTerm = `${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' GROUP BY m.id ORDER BY m.name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [medicines] = await db.query(query, params);
    return medicines;
  }

  // Get low stock medicines
  static async findLowStock() {
    const [medicines] = await db.query(`
      SELECT 
        m.*,
        COALESCE(SUM(mb.stock), 0) as total_stock
      FROM medicines m
      LEFT JOIN medicine_batches mb ON m.id = mb.medicine_id
      WHERE m.is_active = TRUE
      GROUP BY m.id
      HAVING total_stock <= m.min_stock
      ORDER BY total_stock ASC
    `);
    return medicines;
  }

  // Create new medicine
  static async create(data) {
    const {
      name,
      salt = null,
      manufacturer = null,
      category = null,
      hsn_code = null,
      pack = null,
      rack = null,
      barcode = null,
      min_stock = DEFAULTS.MIN_STOCK,
      default_margin = DEFAULTS.DEFAULT_MARGIN
    } = data;

    const [result] = await db.query(
      `INSERT INTO medicines 
       (name, salt, manufacturer, category, hsn_code, pack, rack, barcode, min_stock, default_margin) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, salt, manufacturer, category, hsn_code, pack, rack, barcode, min_stock, default_margin]
    );

    return result.insertId;
  }

  // Update medicine
  static async update(id, data) {
    const {
      name,
      salt,
      manufacturer,
      category,
      hsn_code,
      pack,
      rack,
      barcode,
      min_stock
    } = data;

    const [result] = await db.query(
      `UPDATE medicines 
       SET name=?, salt=?, manufacturer=?, category=?, hsn_code=?, 
           pack=?, rack=?, barcode=?, min_stock=?, updated_at=NOW()
       WHERE id=?`,
      [name, salt, manufacturer, category, hsn_code, pack, rack, barcode, min_stock, id]
    );

    return result.affectedRows > 0;
  }

  // Soft delete medicine
  static async delete(id) {
    const [result] = await db.query(
      'UPDATE medicines SET is_active = FALSE, deleted_at = NOW() WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  // Restore deleted medicine
  static async restore(id) {
    const [result] = await db.query(
      'UPDATE medicines SET is_active = TRUE, deleted_at = NULL WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  // Get medicine with batches
  static async findWithBatches(id) {
    const medicine = await this.findById(id);
    if (!medicine) return null;

    const [batches] = await db.query(
      `SELECT * FROM medicine_batches 
       WHERE medicine_id = ? 
       ORDER BY expiry ASC`,
      [id]
    );

    return { ...medicine, batches };
  }

  // Get available batches for billing
  static async getAvailableBatches(id) {
    const [batches] = await db.query(
      `SELECT 
        id, batch, expiry, stock, mrp, purchase_rate, selling_rate, margin,
        DATEDIFF(expiry, CURDATE()) as days_to_expiry,
        CASE 
          WHEN DATEDIFF(expiry, CURDATE()) <= 30 THEN 'critical'
          WHEN DATEDIFF(expiry, CURDATE()) <= 90 THEN 'warning'
          ELSE 'good'
        END as expiry_status
      FROM medicine_batches 
      WHERE medicine_id = ? AND stock > 0
      ORDER BY expiry ASC`,
      [id]
    );
    return batches;
  }

  // Count total medicines
  static async count(includeInactive = false) {
    const condition = includeInactive ? '' : 'WHERE is_active = TRUE';
    const [result] = await db.query(`SELECT COUNT(*) as total FROM medicines ${condition}`);
    return result[0].total;
  }
}

module.exports = Medicine;