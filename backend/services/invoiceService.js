const { formatDate, formatCurrency } = require('../utils/helpers');
const { PAYMENT_STATUS } = require('../config/constants');

class InvoiceService {
  /**
   * Generate invoice number
   * Format: INV-YYYYMMDD-XXXX
   */
  static async generateInvoiceNumber(db, prefix = 'INV') {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get today's invoice count
    const [result] = await db.query(
      `SELECT COUNT(*) as count 
       FROM transactions 
       WHERE DATE(created_at) = CURDATE()`
    );
    
    const count = result[0].count + 1;
    const invoiceNum = `${prefix}-${dateStr}-${String(count).padStart(4, '0')}`;
    
    return invoiceNum;
  }

  /**
   * Generate purchase invoice number
   * Format: PUR-YYYYMMDD-XXXX
   */
  static async generatePurchaseInvoiceNumber(db) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const [result] = await db.query(
      `SELECT COUNT(*) as count 
       FROM purchases 
       WHERE DATE(purchase_date) = CURDATE()`
    );
    
    const count = result[0].count + 1;
    const invoiceNum = `PUR-${dateStr}-${String(count).padStart(4, '0')}`;
    
    return invoiceNum;
  }

  /**
   * Calculate invoice totals
   */
  static calculateTotals(items, discount = 0, taxRate = 0) {
    // Calculate subtotal from items
    const subtotal = items.reduce((sum, item) => {
      const itemTotal = (item.rate * item.quantity) - (item.discount || 0);
      return sum + itemTotal;
    }, 0);

    // Apply overall discount
    const discountAmount = parseFloat(discount) || 0;
    const afterDiscount = subtotal - discountAmount;

    // Calculate tax
    const taxAmount = (afterDiscount * parseFloat(taxRate)) / 100;

    // Grand total
    const grandTotal = afterDiscount + taxAmount;

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: parseFloat(discountAmount.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      grandTotal: parseFloat(grandTotal.toFixed(2))
    };
  }

  /**
   * Validate invoice items
   */
  static validateItems(items) {
    const errors = [];

    if (!items || items.length === 0) {
      errors.push('Invoice must have at least one item');
      return { valid: false, errors };
    }

    items.forEach((item, index) => {
      if (!item.medicine_id) {
        errors.push(`Item ${index + 1}: Medicine is required`);
      }
      if (!item.batch_id) {
        errors.push(`Item ${index + 1}: Batch is required`);
      }
      if (!item.quantity || item.quantity <= 0) {
        errors.push(`Item ${index + 1}: Valid quantity is required`);
      }
      if (!item.rate || item.rate <= 0) {
        errors.push(`Item ${index + 1}: Valid rate is required`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check stock availability for invoice items
   */
  static async checkStockAvailability(db, items) {
    const unavailable = [];

    for (const item of items) {
      const [batch] = await db.query(
        'SELECT stock FROM medicine_batches WHERE id = ?',
        [item.batch_id]
      );

      if (batch.length === 0) {
        unavailable.push({
          medicine_id: item.medicine_id,
          batch_id: item.batch_id,
          reason: 'Batch not found'
        });
      } else if (batch[0].stock < item.quantity) {
        unavailable.push({
          medicine_id: item.medicine_id,
          batch_id: item.batch_id,
          requested: item.quantity,
          available: batch[0].stock,
          reason: 'Insufficient stock'
        });
      }
    }

    return {
      available: unavailable.length === 0,
      unavailable
    };
  }

  /**
   * Format invoice data for printing/PDF
   */
  static formatInvoiceData(transaction, items, settings) {
    return {
      invoice: {
        number: transaction.invoice_number,
        date: formatDate(transaction.created_at),
        payment_status: transaction.payment_status,
        payment_mode: transaction.payment_mode
      },
      shop: {
        name: settings.shop_name || 'Sri Raghavendra Medical',
        address: settings.address || '',
        phone: settings.phone || '',
        gst: settings.gst_number || '',
        license: settings.license_number || ''
      },
      customer: {
        name: transaction.customer_name || 'Walk-in Customer',
        phone: transaction.customer_phone || '',
        address: transaction.customer_address || '',
        gst: transaction.customer_gst || ''
      },
      items: items.map((item, index) => ({
        sno: index + 1,
        name: item.medicine_name,
        manufacturer: item.manufacturer || '',
        batch: item.batch,
        expiry: formatDate(item.expiry, 'MM/YYYY'),
        quantity: item.quantity,
        rate: formatCurrency(item.rate),
        discount: formatCurrency(item.discount || 0),
        total: formatCurrency(item.total)
      })),
      totals: {
        subtotal: formatCurrency(transaction.subtotal),
        discount: formatCurrency(transaction.discount),
        tax: formatCurrency(transaction.tax),
        grandTotal: formatCurrency(transaction.grand_total),
        paidAmount: formatCurrency(transaction.paid_amount),
        dueAmount: formatCurrency(transaction.grand_total - transaction.paid_amount)
      }
    };
  }

  /**
   * Calculate payment status based on amounts
   */
  static determinePaymentStatus(grandTotal, paidAmount) {
    const total = parseFloat(grandTotal);
    const paid = parseFloat(paidAmount);

    if (paid >= total) {
      return PAYMENT_STATUS.PAID;
    } else if (paid > 0) {
      return PAYMENT_STATUS.PARTIAL;
    } else {
      return PAYMENT_STATUS.DUE;
    }
  }

  /**
   * Calculate GST breakdown
   */
  static calculateGSTBreakdown(items) {
    const gstRates = {};

    items.forEach(item => {
      const gstRate = item.gst || 0;
      if (!gstRates[gstRate]) {
        gstRates[gstRate] = {
          rate: gstRate,
          taxableAmount: 0,
          cgst: 0,
          sgst: 0,
          total: 0
        };
      }

      const itemAmount = (item.rate * item.quantity) - (item.discount || 0);
      const taxAmount = (itemAmount * gstRate) / 100;

      gstRates[gstRate].taxableAmount += itemAmount;
      gstRates[gstRate].cgst += taxAmount / 2;
      gstRates[gstRate].sgst += taxAmount / 2;
      gstRates[gstRate].total += taxAmount;
    });

    return Object.values(gstRates).map(gst => ({
      rate: gst.rate,
      taxableAmount: parseFloat(gst.taxableAmount.toFixed(2)),
      cgst: parseFloat(gst.cgst.toFixed(2)),
      sgst: parseFloat(gst.sgst.toFixed(2)),
      total: parseFloat(gst.total.toFixed(2))
    }));
  }

  /**
   * Validate expiry dates for purchase items
   */
  static validateExpiryDates(items) {
    const errors = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    items.forEach((item, index) => {
      if (!item.expiry) {
        errors.push(`Item ${index + 1}: Expiry date is required`);
        return;
      }

      const expiryDate = new Date(item.expiry);
      expiryDate.setHours(0, 0, 0, 0);

      if (expiryDate <= today) {
        errors.push(`Item ${index + 1}: Expiry date must be in the future`);
      }

      // Warn if expiry is less than 6 months
      const sixMonthsFromNow = new Date(today);
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

      if (expiryDate < sixMonthsFromNow) {
        errors.push(`Item ${index + 1}: Warning - Expiry date is less than 6 months away`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate profit margin for items
   */
  static calculateMargin(purchaseRate, sellingRate) {
    const purchase = parseFloat(purchaseRate);
    const selling = parseFloat(sellingRate);

    if (purchase === 0) return 0;

    const margin = ((selling - purchase) / purchase) * 100;
    return parseFloat(margin.toFixed(2));
  }

  /**
   * Suggest selling rate based on purchase rate and margin
   */
  static suggestSellingRate(purchaseRate, marginPercent = 20) {
    const purchase = parseFloat(purchaseRate);
    const margin = parseFloat(marginPercent);

    const selling = purchase + (purchase * margin / 100);
    return parseFloat(selling.toFixed(2));
  }

  /**
   * Format purchase data for printing/PDF
   */
  static formatPurchaseData(purchase, items, supplier, settings) {
    return {
      purchase: {
        number: purchase.invoice_number,
        date: formatDate(purchase.purchase_date),
        status: purchase.status
      },
      shop: {
        name: settings.shop_name || 'Sri Raghavendra Medical',
        address: settings.address || '',
        phone: settings.phone || '',
        gst: settings.gst_number || '',
        license: settings.license_number || ''
      },
      supplier: {
        name: supplier.name,
        phone: supplier.phone || '',
        address: supplier.address || '',
        gst: supplier.gst_number || '',
        dl: supplier.dl_number || ''
      },
      items: items.map((item, index) => ({
        sno: index + 1,
        name: item.medicine_name,
        manufacturer: item.manufacturer || '',
        batch: item.batch,
        expiry: formatDate(item.expiry, 'MM/YYYY'),
        quantity: item.quantity,
        free: item.free || 0,
        purchaseRate: formatCurrency(item.purchase_rate),
        mrp: formatCurrency(item.mrp),
        sellingRate: formatCurrency(item.selling_rate),
        margin: `${item.margin}%`,
        total: formatCurrency(item.total)
      })),
      totals: {
        totalAmount: formatCurrency(purchase.total_amount),
        paidAmount: formatCurrency(purchase.paid_amount),
        dueAmount: formatCurrency(purchase.total_amount - purchase.paid_amount)
      }
    };
  }
}

module.exports = InvoiceService;