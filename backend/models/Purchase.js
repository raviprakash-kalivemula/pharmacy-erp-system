const db = require('../config/db');
const { PURCHASE_STATUS, DEFAULTS } = require('../config/constants');

class Purchase {
  // Find purchase by ID
  static async findById(id) {
    const [purchases] = await db.query(
      `SELECT 
        p.*,
        s.name as supplier_name,
        s.phone as supplier_phone,
        s.address as supplier_address,
        s.gst_number as supplier_gst
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?`,
      [id]
    );
    return purchases[0] || null;
  }

  // Find purchase with items and payment history
  static async findWithItems(id) {
    const purchase = await this.findById(id);
    if (!purchase) return null;

    const [items] = await db.query(
      `SELECT 
        pi.*,
        m.name as medicine_name,
        m.manufacturer,
        m.pack,
        mb.id as batch_id,
        mb.batch,
        mb.expiry,
        mb.stock as current_stock
      FROM purchase_items pi
      LEFT JOIN medicines m ON pi.medicine_id = m.id
      LEFT JOIN medicine_batches mb ON pi.batch_id = mb.id
      WHERE pi.purchase_id = ?`,
      [id]
    );

    // Get payment history
    const [payments] = await db.query(
      `SELECT * FROM supplier_payments WHERE purchase_id = ? ORDER BY payment_date DESC`,
      [id]
    );

    return { ...purchase, items, payments: payments || [] };
  }

  // Get all purchases with filters
  static async findAll(options = {}) {
    const {
      limit = DEFAULTS.ITEMS_PER_PAGE,
      offset = 0,
      supplierId = null,
      status = null,
      startDate = null,
      endDate = null,
      search = ''
    } = options;

    let query = `
      SELECT 
        p.*,
        s.name as supplier_name,
        s.phone as supplier_phone,
        COUNT(DISTINCT pi.id) as item_count
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
    `;

    const conditions = [];
    const params = [];

    if (supplierId) {
      conditions.push('p.supplier_id = ?');
      params.push(supplierId);
    }

    if (status) {
      conditions.push('p.status = ?');
      params.push(status);
    }

    if (startDate) {
      conditions.push('DATE(p.purchase_date) >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('DATE(p.purchase_date) <= ?');
      params.push(endDate);
    }

    if (search && search.trim() !== '') {
      conditions.push('(p.invoice_number LIKE ? OR s.name LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY p.id ORDER BY p.purchase_date DESC, p.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [purchases] = await db.query(query, params);
    return purchases;
  }

  // Create new purchase
  static async create(data, items) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Insert purchase
      const {
        invoice_number,
        supplier_id,
        purchase_date,
        total_amount,
        paid_amount = 0,
        payment_mode = 'Cash',
        status = PURCHASE_STATUS.RECEIVED
      } = data;

      const [result] = await connection.query(
        `INSERT INTO purchases 
         (invoice_number, supplier_id, purchase_date, total_amount, paid_amount, payment_mode, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [invoice_number, supplier_id, purchase_date, total_amount, paid_amount, payment_mode, status]
      );

      const purchaseId = result.insertId;

      // Process each item
      for (const item of items) {
        const {
          medicine_id,
          batch,
          expiry,
          quantity,
          free = 0,
          purchase_rate,
          mrp,
          selling_rate,
          margin,
          gst = 0,
          total
        } = item;

        // Check if batch exists
        const [existingBatch] = await connection.query(
          `SELECT id, stock FROM medicine_batches 
           WHERE medicine_id = ? AND batch = ? AND expiry = ?`,
          [medicine_id, batch, expiry]
        );

        let batchId;
        const totalQty = parseInt(quantity) + parseInt(free);

        if (existingBatch.length > 0) {
          // Update existing batch
          batchId = existingBatch[0].id;
          await connection.query(
            `UPDATE medicine_batches 
             SET stock = stock + ?, 
                 purchase_rate = ?, 
                 mrp = ?, 
                 selling_rate = ?, 
                 margin = ?,
                 gst = ?
             WHERE id = ?`,
            [totalQty, purchase_rate, mrp, selling_rate, margin, gst, batchId]
          );
        } else {
          // Create new batch
          const [batchResult] = await connection.query(
            `INSERT INTO medicine_batches 
             (medicine_id, batch, expiry, stock, purchase_rate, mrp, selling_rate, margin, gst) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [medicine_id, batch, expiry, totalQty, purchase_rate, mrp, selling_rate, margin, gst]
          );
          batchId = batchResult.insertId;
        }

        // Insert purchase item
        await connection.query(
          `INSERT INTO purchase_items 
           (purchase_id, medicine_id, batch_id, batch, expiry, quantity, free, 
            purchase_rate, mrp, selling_rate, margin, gst, total) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [purchaseId, medicine_id, batchId, batch, expiry, quantity, free, 
           purchase_rate, mrp, selling_rate, margin, gst, total]
        );
      }

      await connection.commit();
      return purchaseId;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Update purchase payment
  static async updatePayment(id, paidAmount, paymentMode = 'Cash') {
    const purchase = await this.findById(id);
    if (!purchase) return false;

    const totalPaid = parseFloat(purchase.paid_amount) + parseFloat(paidAmount);

    const [result] = await db.query(
      `UPDATE purchases 
       SET paid_amount = ?, payment_mode = ?
       WHERE id = ?`,
      [totalPaid, paymentMode, id]
    );

    return result.affectedRows > 0;
  }

  // Update purchase status
  static async updateStatus(id, status) {
    const [result] = await db.query(
      'UPDATE purchases SET status = ? WHERE id = ?',
      [status, id]
    );
    return result.affectedRows > 0;
  }

  // Get purchase summary
  static async getPurchaseSummary(startDate, endDate) {
    const [result] = await db.query(
      `SELECT 
        COUNT(*) as total_purchases,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(total_amount - paid_amount), 0) as total_due
      FROM purchases
      WHERE DATE(purchase_date) BETWEEN ? AND ?`,
      [startDate, endDate]
    );
    return result[0];
  }

  // Get purchases by supplier
  static async findBySupplier(supplierId, limit = 10) {
    const [purchases] = await db.query(
      `SELECT 
        p.*,
        COUNT(DISTINCT pi.id) as item_count
      FROM purchases p
      LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
      WHERE p.supplier_id = ?
      GROUP BY p.id
      ORDER BY p.purchase_date DESC
      LIMIT ?`,
      [supplierId, limit]
    );
    return purchases;
  }

  // Get expiring stock from purchases
  static async getExpiringStock(daysUntilExpiry = 90) {
    const [items] = await db.query(
      `SELECT 
        m.name as medicine_name,
        m.manufacturer,
        mb.batch,
        mb.expiry,
        mb.stock,
        mb.mrp,
        DATEDIFF(mb.expiry, CURDATE()) as days_to_expiry,
        p.invoice_number as purchase_invoice,
        p.purchase_date,
        s.name as supplier_name
      FROM medicine_batches mb
      INNER JOIN medicines m ON mb.medicine_id = m.id
      LEFT JOIN purchase_items pi ON mb.id = pi.batch_id
      LEFT JOIN purchases p ON pi.purchase_id = p.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE mb.stock > 0 
        AND DATEDIFF(mb.expiry, CURDATE()) <= ?
        AND DATEDIFF(mb.expiry, CURDATE()) > 0
      ORDER BY mb.expiry ASC`,
      [daysUntilExpiry]
    );
    return items;
  }

  // Count purchases
  static async count(filters = {}) {
    let query = 'SELECT COUNT(*) as total FROM purchases';
    const conditions = [];
    const params = [];

    if (filters.supplierId) {
      conditions.push('supplier_id = ?');
      params.push(filters.supplierId);
    }

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.startDate) {
      conditions.push('DATE(purchase_date) >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push('DATE(purchase_date) <= ?');
      params.push(filters.endDate);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const [result] = await db.query(query, params);
    return result[0].total;
  }

  // Delete purchase (with stock rollback)
  static async delete(id) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Get purchase items
      const [items] = await connection.query(
        'SELECT batch_id, quantity, free FROM purchase_items WHERE purchase_id = ?',
        [id]
      );

      // Reduce stock from batches
      for (const item of items) {
        const totalQty = parseInt(item.quantity) + parseInt(item.free);
        
        // Check current stock
        const [batch] = await connection.query(
          'SELECT stock FROM medicine_batches WHERE id = ?',
          [item.batch_id]
        );

        if (batch.length > 0) {
          const newStock = batch[0].stock - totalQty;
          
          if (newStock < 0) {
            throw new Error('Cannot delete: Stock has been sold from this purchase');
          }

          if (newStock === 0) {
            // Delete batch if stock becomes 0
            await connection.query('DELETE FROM medicine_batches WHERE id = ?', [item.batch_id]);
          } else {
            // Update stock
            await connection.query(
              'UPDATE medicine_batches SET stock = ? WHERE id = ?',
              [newStock, item.batch_id]
            );
          }
        }
      }

      // Delete purchase items
      await connection.query('DELETE FROM purchase_items WHERE purchase_id = ?', [id]);

      // Delete purchase
      await connection.query('DELETE FROM purchases WHERE id = ?', [id]);

      await connection.commit();
      return true;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Record a payment for purchase
  static async recordPayment(purchaseId, paymentData) {
    const connection = await db.getConnection();
    try {
      // Get purchase details
      const [purchases] = await connection.query(
        'SELECT * FROM purchases WHERE id = ?',
        [purchaseId]
      );
      if (!purchases.length) throw new Error('Purchase not found');

      const purchase = purchases[0];
      const { payment_amount, payment_mode, payment_reference, notes, created_by } = paymentData;

      // Insert payment record
      const [result] = await connection.query(
        `INSERT INTO supplier_payments 
        (purchase_id, supplier_id, amount, payment_date, payment_mode, payment_reference, notes, created_by) 
        VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)`,
        [purchaseId, purchase.supplier_id, payment_amount, payment_mode, payment_reference || null, notes || null, created_by]
      );

      // Calculate new payment totals
      const [paymentTotals] = await connection.query(
        'SELECT COALESCE(SUM(amount), 0) as total_paid FROM supplier_payments WHERE purchase_id = ?',
        [purchaseId]
      );

      const total_paid = paymentTotals[0].total_paid;
      const amount_due = purchase.total_amount - total_paid;
      const new_status = amount_due <= 0 ? 'paid' : (total_paid > 0 ? 'partial' : 'due');

      // Update purchase with payment info
      await connection.query(
        `UPDATE purchases SET 
        amount_paid = ?, 
        amount_due = ?, 
        payment_status = ?,
        payment_mode = ?
        WHERE id = ?`,
        [total_paid, Math.max(0, amount_due), new_status, payment_mode, purchaseId]
      );

      return result.insertId;
    } finally {
      connection.release();
    }
  }

  // Get payment history for a purchase
  static async getPaymentHistory(purchaseId) {
    const [payments] = await db.query(
      `SELECT sp.*, u.username as recorded_by FROM supplier_payments sp
      LEFT JOIN users u ON sp.created_by = u.id
      WHERE sp.purchase_id = ?
      ORDER BY sp.payment_date DESC`,
      [purchaseId]
    );
    return payments;
  }

  // Calculate payment status
  static calculatePaymentStatus(purchase) {
    if (!purchase.total_amount) return { status: 'due', paid: 0, due: purchase.total_amount };
    
    const paid = purchase.amount_paid || 0;
    const due = purchase.amount_due || (purchase.total_amount - paid);
    
    let status = purchase.payment_status || 'due';
    
    return {
      status,
      paid,
      due: Math.max(0, due),
      percentage: Math.round((paid / purchase.total_amount) * 100)
    };
  }
}

module.exports = Purchase;