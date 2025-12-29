const { DATE_FORMATS } = require('../config/constants');

// Date formatting helper
const formatDate = (date, format = DATE_FORMATS.DISPLAY) => {
  if (!date) return null;
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  switch (format) {
    case DATE_FORMATS.DATABASE:
      return `${year}-${month}-${day}`;
    case DATE_FORMATS.DISPLAY:
      return `${day}/${month}/${year}`;
    case DATE_FORMATS.DATETIME:
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    case DATE_FORMATS.MONTH_YEAR:
      return `${month}/${year}`;
    default:
      return date;
  }
};

// Currency formatting
const formatCurrency = (amount, currency = '₹') => {
  if (isNaN(amount)) return `${currency}0.00`;
  const formatted = parseFloat(amount).toFixed(2);
  return `${currency}${formatted}`;
};

// Generate invoice number
const generateInvoiceNo = (lastInvoiceNo) => {
  if (!lastInvoiceNo) return 'INV-0001';
  
  const match = lastInvoiceNo.match(/INV-(\d+)/);
  if (!match) return 'INV-0001';
  
  const nextNum = parseInt(match[1]) + 1;
  return `INV-${String(nextNum).padStart(4, '0')}`;
};

// Calculate GST
const calculateGST = (amount, gstPercent) => {
  const gst = (parseFloat(amount) * parseFloat(gstPercent)) / 100;
  return parseFloat(gst.toFixed(2));
};

// Calculate selling price from purchase rate and margin
const calculateSellingPrice = (purchaseRate, marginPercent) => {
  const sellingPrice = parseFloat(purchaseRate) * (1 + parseFloat(marginPercent) / 100);
  return parseFloat(sellingPrice.toFixed(2));
};

// Calculate margin percentage
const calculateMargin = (purchaseRate, sellingRate) => {
  if (parseFloat(purchaseRate) === 0) return 0;
  const margin = ((parseFloat(sellingRate) - parseFloat(purchaseRate)) / parseFloat(purchaseRate)) * 100;
  return parseFloat(margin.toFixed(2));
};

// Validate phone number
const isValidPhone = (phone) => {
  if (!phone) return true; // Optional field
  return /^[0-9]{10,15}$/.test(phone);
};

// Validate GST number
const isValidGST = (gst) => {
  if (!gst) return true; // Optional field
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst);
};

// Validate email
const isValidEmail = (email) => {
  if (!email) return true; // Optional field
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Parse date from various formats
const parseDate = (dateStr) => {
  if (!dateStr || dateStr.trim() === '') return null;
  
  dateStr = dateStr.trim();
  
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // MM/YY format (pharmaceutical expiry)
  const matchMonthYear = dateStr.match(/^(\d{1,2})\/(\d{2})$/);
  if (matchMonthYear) {
    const [_, month, year] = matchMonthYear;
    const fullYear = `20${year}`;
    const paddedMonth = month.padStart(2, '0');
    const lastDay = new Date(parseInt(fullYear), parseInt(month), 0).getDate();
    return `${fullYear}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;
  }
  
  // DD/MM/YYYY or DD-MM-YYYY
  const match = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const [_, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return null;
};

// Paginate array
const paginate = (array, page = 1, limit = 50) => {
  const offset = (page - 1) * limit;
  return {
    data: array.slice(offset, offset + limit),
    page,
    limit,
    total: array.length,
    totalPages: Math.ceil(array.length / limit)
  };
};

// Safe JSON parse
const safeJSONParse = (str, defaultValue = null) => {
  try {
    return JSON.parse(str);
  } catch (err) {
    return defaultValue;
  }
};

// Generate random alphanumeric string
const generateRandomString = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Sanitize string (remove special characters)
const sanitizeString = (str) => {
  if (!str) return '';
  return str.replace(/[^a-zA-Z0-9\s]/g, '').trim();
};

// Calculate days between dates
const daysBetween = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Round to 2 decimal places
const roundTo2 = (num) => {
  return Math.round(parseFloat(num) * 100) / 100;
};

module.exports = {
  formatDate,
  formatCurrency,
  generateInvoiceNo,
  calculateGST,
  calculateSellingPrice,
  calculateMargin,
  isValidPhone,
  isValidGST,
  isValidEmail,
  parseDate,
  paginate,
  safeJSONParse,
  generateRandomString,
  sanitizeString,
  daysBetween,
  roundTo2,
};