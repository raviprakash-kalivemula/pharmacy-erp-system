// src/utils/validators.js
import { VALIDATION_RULES } from '../constants';

/**
 * Basic Validators
 */
export const isRequired = (value) => {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined && value !== '';
};

export const isEmail = (email) => {
  if (!email) return true; // Optional field
  return VALIDATION_RULES.EMAIL.test(email);
};

export const isPhone = (phone) => {
  if (!phone) return true; // Optional field
  const cleaned = phone.replace(/\D/g, '');
  return VALIDATION_RULES.PHONE.test(cleaned);
};

export const isGST = (gst) => {
  if (!gst) return true; // Optional field
  return VALIDATION_RULES.GST.test(gst.toUpperCase());
};

/**
 * Number Validators
 */
export const isPositiveNumber = (value) => {
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
};

export const isValidPrice = (price) => {
  const num = parseFloat(price);
  return !isNaN(num) && 
         num >= VALIDATION_RULES.MIN_PRICE && 
         num <= VALIDATION_RULES.MAX_PRICE;
};

export const isValidStock = (stock) => {
  const num = parseInt(stock);
  return !isNaN(num) && 
         num >= VALIDATION_RULES.MIN_STOCK && 
         num <= VALIDATION_RULES.MAX_STOCK;
};

export const isValidPercentage = (value) => {
  const num = parseFloat(value);
  return !isNaN(num) && num >= 0 && num <= 100;
};

/**
 * Date Validators
 */
export const isValidDate = (dateString) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

export const isFutureDate = (dateString) => {
  if (!isValidDate(dateString)) return false;
  return new Date(dateString) > new Date();
};

export const isPastDate = (dateString) => {
  if (!isValidDate(dateString)) return false;
  return new Date(dateString) < new Date();
};

export const isExpiryNear = (expiryDate, daysThreshold = 90) => {
  if (!isValidDate(expiryDate)) return false;
  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysToExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  return daysToExpiry <= daysThreshold && daysToExpiry > 0;
};

export const isExpired = (expiryDate) => {
  if (!isValidDate(expiryDate)) return false;
  return new Date(expiryDate) < new Date();
};

/**
 * Batch/Expiry Status
 */
export const getExpiryStatus = (expiryDate) => {
  if (!isValidDate(expiryDate)) return 'unknown';
  
  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysToExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  
  if (daysToExpiry < 0) return 'expired';
  if (daysToExpiry <= 30) return 'critical';
  if (daysToExpiry <= 90) return 'warning';
  return 'good';
};

/**
 * Stock Status
 */
export const getStockStatus = (currentStock, minStock = 10) => {
  const stock = parseInt(currentStock) || 0;
  const min = parseInt(minStock) || 10;
  
  if (stock === 0) return 'out';
  if (stock <= min / 2) return 'critical';
  if (stock <= min) return 'low';
  return 'good';
};

/**
 * Form Validators
 */
export const validateMedicine = (data) => {
  const errors = {};
  
  if (!isRequired(data.name)) {
    errors.name = 'Medicine name is required';
  }
  
  if (data.min_stock && !isValidStock(data.min_stock)) {
    errors.min_stock = 'Invalid minimum stock value';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateCustomer = (data) => {
  const errors = {};
  
  if (!isRequired(data.name)) {
    errors.name = 'Customer name is required';
  }
  
  if (data.phone && !isPhone(data.phone)) {
    errors.phone = 'Invalid phone number (10 digits required)';
  }
  
  if (data.gst_number && !isGST(data.gst_number)) {
    errors.gst_number = 'Invalid GST format (15 characters)';
  }
  
  if (data.email && !isEmail(data.email)) {
    errors.email = 'Invalid email format';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateBatch = (data) => {
  const errors = {};
  
  if (!isRequired(data.batch)) {
    errors.batch = 'Batch number is required';
  }
  
  if (!isValidDate(data.expiry)) {
    errors.expiry = 'Valid expiry date is required';
  } else if (isPastDate(data.expiry)) {
    errors.expiry = 'Expiry date cannot be in the past';
  }
  
  if (!isValidStock(data.stock)) {
    errors.stock = 'Valid stock quantity is required';
  }
  
  if (!isValidPrice(data.mrp)) {
    errors.mrp = 'Valid MRP is required';
  }
  
  if (!isValidPrice(data.purchase_rate)) {
    errors.purchase_rate = 'Valid purchase rate is required';
  }
  
  if (parseFloat(data.mrp) < parseFloat(data.purchase_rate)) {
    errors.mrp = 'MRP must be greater than purchase rate';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validatePurchaseItem = (data) => {
  const errors = {};
  
  if (!isRequired(data.product_name)) {
    errors.product_name = 'Product name is required';
  }
  
  if (!isRequired(data.batch)) {
    errors.batch = 'Batch number is required';
  }
  
  if (!isValidStock(data.qty)) {
    errors.qty = 'Valid quantity is required';
  }
  
  if (!isValidPrice(data.rate)) {
    errors.rate = 'Valid rate is required';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Payment Validators
 */
export const validatePayment = (amountPaid, totalAmount) => {
  const paid = parseFloat(amountPaid) || 0;
  const total = parseFloat(totalAmount) || 0;
  
  if (paid < 0) return { valid: false, message: 'Payment cannot be negative' };
  if (paid > total) return { valid: false, message: 'Payment cannot exceed total amount' };
  
  return { valid: true, message: '' };
};

export const getPaymentStatus = (amountPaid, totalAmount) => {
  const paid = parseFloat(amountPaid) || 0;
  const total = parseFloat(totalAmount) || 0;
  
  if (paid >= total) return 'paid';
  if (paid > 0) return 'partial';
  return 'due';
};

/**
 * CSV Validators
 */
export const validateCSVRow = (row, requiredFields) => {
  const errors = [];
  
  requiredFields.forEach(field => {
    if (!row[field] || row[field].trim() === '') {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Utility Validator
 */
export const sanitizeInput = (input, type = 'text') => {
  if (!input) return '';
  
  switch (type) {
    case 'text':
      return input.trim();
    case 'number':
      return parseFloat(input) || 0;
    case 'integer':
      return parseInt(input) || 0;
    case 'uppercase':
      return input.trim().toUpperCase();
    case 'phone':
      return input.replace(/\D/g, '');
    default:
      return input;
  }
};