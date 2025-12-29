// Application Constants

// Payment Status
const PAYMENT_STATUS = {
  PAID: 'paid',
  DUE: 'due',
  PARTIAL: 'partial',
};

// Payment Modes
const PAYMENT_MODES = {
  CASH: 'Cash',
  CARD: 'Card',
  UPI: 'UPI',
  CREDIT: 'Credit',
};

// Purchase Status
const PURCHASE_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// Stock Alert Thresholds
const STOCK_THRESHOLDS = {
  LOW_STOCK_DAYS: 7,
  EXPIRY_WARNING_DAYS: 90,
  EXPIRY_CRITICAL_DAYS: 30,
};

// GST Rates
const GST_RATES = {
  RATE_0: 0,
  RATE_5: 5,
  RATE_12: 12,
  RATE_18: 18,
  RATE_28: 28,
};

// Default Values
const DEFAULTS = {
  MIN_STOCK: 50,
  MAX_STOCK: 1000,
  REORDER_LEVEL: 100,
  DEFAULT_MARGIN: 15,
  ITEMS_PER_PAGE: 50,
  MAX_ITEMS_PER_PAGE: 1000,
};

// Error Codes
const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};

// Date Formats
const DATE_FORMATS = {
  DISPLAY: 'DD/MM/YYYY',
  DATABASE: 'YYYY-MM-DD',
  DATETIME: 'YYYY-MM-DD HH:mm:ss',
  MONTH_YEAR: 'MM/YYYY',
};

// Regex Patterns
const PATTERNS = {
  PHONE: /^[0-9]{10,15}$/,
  GST: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  INVOICE_NO: /^INV-\d{4}$/,
};

// Report Types
const REPORT_TYPES = {
  SALES_SUMMARY: 'sales-summary',
  PURCHASE_SUMMARY: 'purchase-summary',
  STOCK_REPORT: 'stock-report',
  EXPIRY_REPORT: 'expiry-report',
  CUSTOMER_REPORT: 'customer-report',
  GST_REPORT: 'gst-report',
  PROFIT_LOSS: 'profit-loss',
};

// User Roles (for future authentication)
const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  VIEWER: 'viewer',
};

module.exports = {
  PAYMENT_STATUS,
  PAYMENT_MODES,
  PURCHASE_STATUS,
  STOCK_THRESHOLDS,
  GST_RATES,
  DEFAULTS,
  ERROR_CODES,
  HTTP_STATUS,
  DATE_FORMATS,
  PATTERNS,
  REPORT_TYPES,
  USER_ROLES,
};