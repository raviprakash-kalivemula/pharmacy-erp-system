// src/utils/calculations.js

/**
 * Calculate selling rate from purchase rate and margin
 */
export const calculateSellingRate = (purchaseRate, margin) => {
  const rate = parseFloat(purchaseRate) || 0;
  const marginPercent = parseFloat(margin) || 0;
  
  if (marginPercent === 0) return rate;
  return rate * (1 + marginPercent / 100);
};

/**
 * Calculate margin from purchase rate and selling rate
 */
export const calculateMargin = (purchaseRate, sellingRate) => {
  const purchase = parseFloat(purchaseRate) || 0;
  const selling = parseFloat(sellingRate) || 0;
  
  if (purchase === 0) return 0;
  return ((selling - purchase) / purchase) * 100;
};

/**
 * Calculate GST amount
 */
export const calculateGST = (amount, gstPercent) => {
  const amt = parseFloat(amount) || 0;
  const gst = parseFloat(gstPercent) || 0;
  
  return (amt * gst) / 100;
};

/**
 * Calculate discount amount
 */
export const calculateDiscount = (subtotal, discount, discountType = 'percentage') => {
  const amount = parseFloat(subtotal) || 0;
  const disc = parseFloat(discount) || 0;
  
  if (discountType === 'percentage') {
    return (amount * disc) / 100;
  }
  return disc;
};

/**
 * Calculate bill totals
 */
export const calculateBillTotals = (items, discount = 0, discountType = 'percentage', gstPercent = 0) => {
  const subtotal = items.reduce((sum, item) => {
    const rate = parseFloat(item.selling_rate || item.rate || item.price || 0);
    const qty = parseInt(item.quantity || 0);
    return sum + (rate * qty);
  }, 0);
  
  const discountAmount = calculateDiscount(subtotal, discount, discountType);
  const subtotalAfterDiscount = subtotal - discountAmount;
  const tax = calculateGST(subtotalAfterDiscount, gstPercent);
  const grandTotal = subtotalAfterDiscount + tax;
  
  return {
    subtotal,
    discountAmount,
    subtotalAfterDiscount,
    tax,
    grandTotal
  };
};

/**
 * Calculate item total with GST
 */
export const calculateItemTotal = (quantity, rate, gstPercent = 0) => {
  const qty = parseInt(quantity) || 0;
  const price = parseFloat(rate) || 0;
  const gst = parseFloat(gstPercent) || 0;
  
  const baseAmount = qty * price;
  const gstAmount = (baseAmount * gst) / 100;
  
  return {
    baseAmount,
    gstAmount,
    total: baseAmount + gstAmount
  };
};

/**
 * Calculate stock value
 */
export const calculateStockValue = (medicines) => {
  if (!Array.isArray(medicines)) return 0;
  
  return medicines.reduce((sum, medicine) => {
    const stock = parseFloat(medicine.total_stock || 0);
    const rate = parseFloat(medicine.lowest_selling_rate || medicine.selling_rate || 0);
    return sum + (stock * rate);
  }, 0);
};

/**
 * Calculate profit/loss
 */
export const calculateProfit = (sellingPrice, purchasePrice, quantity = 1) => {
  const selling = parseFloat(sellingPrice) || 0;
  const purchase = parseFloat(purchasePrice) || 0;
  const qty = parseInt(quantity) || 1;
  
  const profit = (selling - purchase) * qty;
  const profitPercent = purchase > 0 ? ((selling - purchase) / purchase) * 100 : 0;
  
  return {
    profit,
    profitPercent,
    isProfit: profit >= 0
  };
};

/**
 * Calculate payment status
 */
export const calculatePaymentStatus = (amountPaid, totalAmount) => {
  const paid = parseFloat(amountPaid) || 0;
  const total = parseFloat(totalAmount) || 0;
  
  if (paid >= total) return 'paid';
  if (paid > 0) return 'partial';
  return 'due';
};

/**
 * Calculate days to expiry
 */
export const calculateDaysToExpiry = (expiryDate) => {
  if (!expiryDate) return null;
  
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

/**
 * Calculate total outstanding
 */
export const calculateTotalOutstanding = (customers) => {
  if (!Array.isArray(customers)) return 0;
  
  return customers.reduce((sum, customer) => {
    return sum + (parseFloat(customer.outstanding) || 0);
  }, 0);
};

/**
 * Safe number conversion
 */
export const safeNumber = (value, defaultValue = 0) => {
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
};

/**
 * Calculate average
 */
export const calculateAverage = (numbers) => {
  if (!Array.isArray(numbers) || numbers.length === 0) return 0;
  
  const sum = numbers.reduce((acc, num) => acc + (parseFloat(num) || 0), 0);
  return sum / numbers.length;
};

/**
 * Calculate percentage change
 */
export const calculatePercentageChange = (oldValue, newValue) => {
  const old = parseFloat(oldValue) || 0;
  const newVal = parseFloat(newValue) || 0;
  
  if (old === 0) return 0;
  return ((newVal - old) / old) * 100;
};