/**
 * Validation Helpers
 * Reusable utilities for validation, strong password checking, and CSV validation
 */

const Joi = require('joi');

/**
 * Custom error message mapping for user-friendly messages
 */
const getCustomErrorMessage = (field, joiMessage) => {
  // Custom message mapping for common validation errors
  const messageMap = {
    'is required': `${field} is required`,
    'must be a valid email': `Please enter a valid email address for ${field}`,
    'must be a number': `${field} must be a number`,
    'must be greater than zero': `${field} must be greater than zero`,
    'must be in the future': `${field} must be in the future`,
    'must contain at least': `${field} must contain at least one item`,
    'must be at least': `${field} must meet the minimum requirement`,
    'cannot exceed': `${field} cannot exceed the maximum length`,
    '10-15 digits': `${field} must be 10-15 digits`,
    'uppercase, lowercase, digit': 'Password must contain: uppercase, lowercase, digit, and special character (!@#$%^&*)',
  };

  // Check if any mapping matches the Joi message
  for (const [key, value] of Object.entries(messageMap)) {
    if (joiMessage.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  return joiMessage; // Return original if no mapping found
};

/**
 * Validate strong password
 * Requirements: 8+ chars, uppercase, lowercase, digit, special char
 */
const validateStrongPassword = (password) => {
  const strongPasswordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  
  if (!strongPasswordRegex.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain: 8+ characters, uppercase, lowercase, digit, and special character (!@#$%^*)',
    };
  }

  return { isValid: true, message: null };
};

/**
 * Normalize date in multiple formats for CSV import
 */
const normalizeDate = (dateStr) => {
  if (!dateStr || dateStr.trim() === '') return null;

  dateStr = dateStr.trim();

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const date = new Date(dateStr);
    if (date > new Date()) return dateStr;
    return null; // Past date
  }

  // MM/YY or M/YY format (e.g., "03/28", "3/28") - PHARMACEUTICAL EXPIRY FORMAT
  const matchMonthYear = dateStr.match(/^(\d{1,2})\/(\d{2})$/);
  if (matchMonthYear) {
    const [_, month, year] = matchMonthYear;
    const fullYear = `20${year}`;
    const paddedMonth = month.padStart(2, '0');
    const lastDay = new Date(parseInt(fullYear), parseInt(month), 0).getDate();
    const formattedDate = `${fullYear}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;
    const date = new Date(formattedDate);
    if (date > new Date()) return formattedDate;
    return null; // Past date
  }

  // MM/DD/YYYY or M/D/YYYY
  const match1 = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match1) {
    const [_, month, day, year] = match1;
    const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const date = new Date(formattedDate);
    if (date > new Date()) return formattedDate;
    return null; // Past date
  }

  // DD-MM-YYYY or D-M-YYYY
  const match2 = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match2) {
    const [_, day, month, year] = match2;
    const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const date = new Date(formattedDate);
    if (date > new Date()) return formattedDate;
    return null; // Past date
  }

  // YYYY-MM or YYYY/MM format
  const matchYearMonth = dateStr.match(/^(\d{4})[-\/](\d{1,2})$/);
  if (matchYearMonth) {
    const [_, year, month] = matchYearMonth;
    const paddedMonth = month.padStart(2, '0');
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const formattedDate = `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;
    const date = new Date(formattedDate);
    if (date > new Date()) return formattedDate;
    return null; // Past date
  }

  return null; // Invalid format
};

/**
 * CSV row validation with detailed error reporting
 * Returns: { isValid: boolean, errors: [{ row, column, message }] }
 */
const validateCSVRow = (row, rowIndex, requiredColumns = []) => {
  const errors = [];

  // Check for missing required columns
  for (const column of requiredColumns) {
    const value = row[column];
    if (!value || value.trim() === '') {
      errors.push({
        row: rowIndex + 1,
        column,
        message: `Missing required value. ${column.replace(/_/g, ' ')} is required for all entries.`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate CSV row for medicine batch import
 */
const validateMedicineBatchCSVRow = (row, rowIndex, existingBatches = []) => {
  const errors = [];
  const fieldErrors = [];

  // Check required fields
  const requiredFields = {
    product_name: 'Product/Medicine name',
    batch: 'Batch number',
    expiry: 'Expiry date',
    quantity: 'Quantity',
    rate: 'Purchase rate',
    mrp: 'MRP',
  };

  for (const [field, label] of Object.entries(requiredFields)) {
    const value = row[field];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      fieldErrors.push({
        row: rowIndex + 1,
        column: field,
        message: `Missing required value. ${label} is required.`,
      });
    }
  }

  // Validate numeric fields
  const numericFields = { quantity: 'Quantity', rate: 'Rate', mrp: 'MRP' };
  for (const [field, label] of Object.entries(numericFields)) {
    const value = row[field];
    if (value && isNaN(parseFloat(value))) {
      fieldErrors.push({
        row: rowIndex + 1,
        column: field,
        message: `Invalid number. ${label} must be a numeric value. Got: '${value}'`,
      });
    } else if (value && parseFloat(value) <= 0) {
      fieldErrors.push({
        row: rowIndex + 1,
        column: field,
        message: `Invalid value. ${label} must be greater than zero. Got: '${value}'`,
      });
    }
  }

  // Validate expiry date
  if (row.expiry && row.expiry.trim()) {
    const normalizedDate = normalizeDate(row.expiry);
    if (!normalizedDate) {
      fieldErrors.push({
        row: rowIndex + 1,
        column: 'expiry',
        message: `Invalid date format. Expected MM/YY (e.g., '03/25') or YYYY-MM-DD. Got: '${row.expiry}'`,
      });
    }
  }

  // Check for duplicate batch
  if (row.product_name && row.batch) {
    const key = `${row.product_name}|${row.batch}`;
    if (existingBatches.includes(key)) {
      fieldErrors.push({
        row: rowIndex + 1,
        column: 'batch',
        message: `Duplicate medicine+batch combination already exists in this file`,
      });
    }
  }

  return {
    isValid: fieldErrors.length === 0,
    errors: fieldErrors,
  };
};

/**
 * Validate phone number format
 */
const validatePhoneNumber = (phone) => {
  if (!phone || phone.trim() === '') return true; // Optional field
  return /^[0-9]{10,15}$/.test(phone);
};

/**
 * Validate GST number format (India)
 */
const validateGSTNumber = (gst) => {
  if (!gst || gst.trim() === '') return true; // Optional field
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst);
};

/**
 * Validate email format
 */
const validateEmail = (email) => {
  if (!email || email.trim() === '') return true; // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Get validation error summary for batch operations
 */
const getCSVValidationSummary = (totalRows, validRows, invalidRows) => {
  return {
    total: totalRows,
    valid: validRows,
    invalid: invalidRows,
    successRate: totalRows > 0 ? `${((validRows / totalRows) * 100).toFixed(2)}%` : '0%',
  };
};

/**
 * Validate entire CSV file and return detailed row-level errors
 * Returns: { isValid, validRows, errors }
 */
const validateCSVImport = (rows) => {
  const errors = [];
  const validRows = [];
  const requiredFields = ['product_name', 'batch', 'exp', 'qty', 'rate', 'mrp'];
  const processedBatches = new Set();

  rows.forEach((row, index) => {
    const rowErrors = [];
    
    // Check for empty rows
    if (!row.product_name || row.product_name.trim() === '') {
      rowErrors.push({
        row: index + 2, // +2 because row 1 is header and index starts at 0
        column: 'product_name',
        message: 'Missing required value. Product/Medicine name is required for all rows.',
      });
    }

    // Validate required fields
    for (const field of requiredFields) {
      const value = row[field];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        const fieldLabel = {
          product_name: 'Product/Medicine name',
          batch: 'Batch number',
          exp: 'Expiry date',
          qty: 'Quantity',
          rate: 'Purchase rate',
          mrp: 'MRP'
        }[field];
        
        rowErrors.push({
          row: index + 2,
          column: field,
          message: `Missing required value. ${fieldLabel} is required.`,
        });
      }
    }

    // Validate numeric fields
    if (row.qty && isNaN(parseFloat(row.qty))) {
      rowErrors.push({
        row: index + 2,
        column: 'qty',
        message: `Invalid number. Quantity must be a numeric value. Got: '${row.qty}'`,
      });
    } else if (row.qty && parseFloat(row.qty) < 0) {
      rowErrors.push({
        row: index + 2,
        column: 'qty',
        message: `Invalid value. Quantity cannot be negative. Got: '${row.qty}'`,
      });
    }

    if (row.rate && isNaN(parseFloat(row.rate))) {
      rowErrors.push({
        row: index + 2,
        column: 'rate',
        message: `Invalid number. Purchase rate must be a numeric value. Got: '${row.rate}'`,
      });
    } else if (row.rate && parseFloat(row.rate) <= 0) {
      rowErrors.push({
        row: index + 2,
        column: 'rate',
        message: `Invalid value. Purchase rate must be greater than zero. Got: '${row.rate}'`,
      });
    }

    if (row.mrp && isNaN(parseFloat(row.mrp))) {
      rowErrors.push({
        row: index + 2,
        column: 'mrp',
        message: `Invalid number. MRP must be a numeric value. Got: '${row.mrp}'`,
      });
    } else if (row.mrp && parseFloat(row.mrp) <= 0) {
      rowErrors.push({
        row: index + 2,
        column: 'mrp',
        message: `Invalid value. MRP must be greater than zero. Got: '${row.mrp}'`,
      });
    }

    // Validate expiry date
    if (row.exp && row.exp.trim()) {
      const normalizedDate = normalizeDate(row.exp);
      if (!normalizedDate) {
        rowErrors.push({
          row: index + 2,
          column: 'exp',
          message: `Invalid date format. Expected MM/YY (e.g., '03/25') or YYYY-MM-DD. Got: '${row.exp}'`,
        });
      }
    }

    // Check for duplicate batch in this file
    if (row.product_name && row.batch) {
      const batchKey = `${row.product_name.toLowerCase().trim()}|${row.batch.toLowerCase().trim()}`;
      if (processedBatches.has(batchKey)) {
        rowErrors.push({
          row: index + 2,
          column: 'batch',
          message: `Duplicate medicine+batch combination already exists in this file`,
        });
      } else {
        processedBatches.add(batchKey);
      }
    }

    // Store results
    if (rowErrors.length === 0) {
      validRows.push(row);
    } else {
      errors.push(...rowErrors);
    }
  });

  return {
    isValid: errors.length === 0,
    validRows,
    errors,
    summary: getCSVValidationSummary(rows.length, validRows.length, rows.length - validRows.length),
  };
};

module.exports = {
  getCustomErrorMessage,
  validateStrongPassword,
  normalizeDate,
  validateCSVRow,
  validateMedicineBatchCSVRow,
  validatePhoneNumber,
  validateGSTNumber,
  validateEmail,
  getCSVValidationSummary,
  validateCSVImport,
};
