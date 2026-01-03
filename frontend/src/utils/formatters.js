// src/utils/formatters.js

/**
 * Currency Formatting
 */
export const formatCurrency = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num)) return '₹0.00';
  return `₹${num.toFixed(2)}`;
};

export const formatCurrencyCompact = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num)) return '₹0';
  
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(2)}K`;
  return `₹${num.toFixed(2)}`;
};

/**
 * Date Formatting
 */
export const formatDate = (dateString, locale = 'en-GB') => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString(locale);
  } catch {
    return 'Invalid Date';
  }
};

export const formatDateShort = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      month: 'short', 
      year: '2-digit' 
    });
  } catch {
    return 'Invalid Date';
  }
};

export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString('en-GB');
  } catch {
    return 'Invalid DateTime';
  }
};

export const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Number Formatting
 */
export const safeNumber = (value, defaultValue = 0) => {
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
};

export const formatPercentage = (value, decimals = 1) => {
  const num = safeNumber(value);
  return `${num.toFixed(decimals)}%`;
};

export const formatQuantity = (quantity, freeQuantity = 0) => {
  const qty = parseInt(quantity) || 0;
  const free = parseInt(freeQuantity) || 0;
  
  if (free > 0) {
    return `${qty} + ${free}F`;
  }
  return qty.toString();
};

/**
 * Number to Words (Indian System)
 */
export const numberToWords = (num) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  if (num === 0) return 'Zero';
  
  let words = '';
  
  if (num >= 10000000) {
    words += numberToWords(Math.floor(num / 10000000)) + ' Crore ';
    num %= 10000000;
  }
  
  if (num >= 100000) {
    words += numberToWords(Math.floor(num / 100000)) + ' Lakh ';
    num %= 100000;
  }
  
  if (num >= 1000) {
    words += numberToWords(Math.floor(num / 1000)) + ' Thousand ';
    num %= 1000;
  }
  
  if (num >= 100) {
    words += ones[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }
  
  if (num >= 20) {
    words += tens[Math.floor(num / 10)] + ' ';
    num %= 10;
  } else if (num >= 10) {
    words += teens[num - 10] + ' ';
    return words.trim();
  }
  
  if (num > 0) {
    words += ones[num] + ' ';
  }
  
  return words.trim();
};

/**
 * Status Formatting
 */
export const formatStatus = (status) => {
  if (!status) return 'N/A';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

export const formatPaymentStatus = (status, amountDue) => {
  if (status === 'paid') return 'PAID';
  if (status === 'partial') return `PARTIAL (₹${safeNumber(amountDue).toFixed(2)} due)`;
  return `DUE (₹${safeNumber(amountDue).toFixed(2)})`;
};

/**
 * Text Formatting
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const capitalizeFirst = (text) => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

export const formatPhone = (phone) => {
  if (!phone) return 'N/A';
  // Format as XXX-XXX-XXXX
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

/**
 * Array Formatting
 */
export const formatList = (items, property = 'name', separator = ', ') => {
  if (!Array.isArray(items) || items.length === 0) return 'None';
  return items.map(item => property ? item[property] : item).join(separator);
};

/**
 * Download Helper
 */
export const downloadCSV = (content, filename = 'download.csv') => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};