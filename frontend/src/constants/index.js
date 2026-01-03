// src/constants/index.js

// Payment modes
export const PAYMENT_MODES = ['Cash', 'Card', 'UPI', 'Credit'];

// Payment statuses
export const PAYMENT_STATUS = {
  PAID: 'paid',
  PARTIAL: 'partial',
  DUE: 'due',
  PENDING: 'pending'
};

// GST rates
export const GST_RATES = [
  { value: 0, label: '0%' },
  { value: 5, label: '5%' },
  { value: 12, label: '12%' },
  { value: 18, label: '18%' }
];

// Discount types
export const DISCOUNT_TYPES = {
  PERCENTAGE: 'percentage',
  FIXED: 'fixed'
};

// Purchase status
export const PURCHASE_STATUS = {
  PENDING: 'pending',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
};

// Date formats
export const DATE_FORMATS = {
  DISPLAY: 'en-GB',
  INPUT: 'YYYY-MM-DD',
  INVOICE: 'DD/MM/YYYY'
};

// Stock thresholds
export const STOCK_THRESHOLDS = {
  LOW: 10,
  CRITICAL: 5,
  DEFAULT_MIN: 50
};

// Expiry thresholds (in days)
export const EXPIRY_THRESHOLDS = {
  CRITICAL: 30,
  WARNING: 90,
  SAFE: 180
};

// Status colors for Tailwind
export const STATUS_COLORS = {
  paid: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-200'
  },
  partial: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    border: 'border-yellow-200'
  },
  due: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-200'
  },
  pending: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    border: 'border-orange-200'
  },
  delivered: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-200'
  }
};

// Pagination
export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  DEFAULT_PAGE: 0
};

// CSV Templates
export const CSV_TEMPLATES = {
  CUSTOMER: 'Name,Phone,Address,GST_Number,DL_Number\nABC Medical Store,9876543210,Madhapur Hyderabad,36AAAA1111A1ZZ,DL123',
  PURCHASE: 'HSN_CODE,PRODUCT_NAME,PACK,MFG,BATCH,EXP,QTY,FREE,M.R.P,RATE,AMOUNT,GST_%,MARGIN\n30049099,Paracetamol 500mg,10x10,Cipla,B1234,2026-03-15,100,0,129.00,40.00,4000.00,12,15'
};

// Alert messages (cleaned for toast notifications)
export const MESSAGES = {
  SUCCESS: {
    SAVE: 'Saved successfully!',
    UPDATE: 'Updated successfully!',
    DELETE: 'Deleted successfully!',
    GENERATE: 'Generated successfully!',
    IMPORT: 'Imported successfully!',
    EXPORT: 'Exported successfully!'
  },
  ERROR: {
    FETCH: 'Error fetching data',
    SAVE: 'Error saving data',
    DELETE: 'Error deleting data',
    NETWORK: 'Network error. Please try again.',
    VALIDATION: 'Please check all required fields',
    PERMISSION: 'You do not have permission for this action'
  },
  WARNING: {
    CONFIRM_DELETE: 'Are you sure you want to delete this?',
    NO_DATA: 'No data available',
    VALIDATION_FAILED: 'Please check all required fields',
    LOW_STOCK: 'Stock is running low!',
    EXPIRING_SOON: 'Some items are expiring soon',
    UNSAVED_CHANGES: 'You have unsaved changes'
  },
  INFO: {
    LOADING: 'Loading...',
    PROCESSING: 'Processing...',
    CONNECTING: 'Connecting to server...',
    SAVING: 'Saving...',
    DELETING: 'Deleting...',
    NO_RESULTS: 'No results found'
  }
};

// Icons mapping (for dynamic icon selection)
export const ICON_MAP = {
  dashboard: 'LayoutDashboard',
  inventory: 'Package',
  billing: 'ShoppingCart',
  purchase: 'ShoppingBag',
  customers: 'Users',
  transactions: 'Receipt',
  reports: 'FileText',
  settings: 'Settings'
};

// Menu items for navigation
export const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { id: 'inventory', label: 'Inventory', icon: 'Package' },
  { id: 'billing', label: 'Billing', icon: 'ShoppingCart' },
  { id: 'purchase', label: 'Purchase', icon: 'ShoppingBag' },
  { id: 'customers', label: 'Customers', icon: 'Users' },
  { id: 'transactions', label: 'Transactions', icon: 'Receipt' },
  { id: 'reports', label: 'Reports', icon: 'FileText' },
  { id: 'settings', label: 'Settings', icon: 'Settings' }
];

// Default form values
export const DEFAULT_FORM_VALUES = {
  medicine: {
    name: '',
    salt: '',
    manufacturer: '',
    hsn_code: '',
    pack: '',
    rack: '',
    barcode: '',
    min_stock: 50
  },
  customer: {
    name: '',
    phone: '',
    address: '',
    gst_number: '',
    dl_number: '',
    outstanding: 0
  },
  batch: {
    batch: '',
    expiry: '',
    stock: 0,
    mrp: 0,
    purchase_rate: 0
  }
};

// Validation rules
export const VALIDATION_RULES = {
  PHONE: /^[0-9]{10}$/,
  GST: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  MIN_STOCK: 1,
  MAX_STOCK: 999999,
  MIN_PRICE: 0.01,
  MAX_PRICE: 999999
};

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  SAVE: { key: 's', ctrl: true, description: 'Save form' },
  NEW: { key: 'n', ctrl: true, description: 'Add new item' },
  SEARCH: { key: 'f', ctrl: true, description: 'Focus search' },
  CLOSE: { key: 'Escape', description: 'Close modal' },
  BILLING: { key: 'F2', description: 'Quick billing' },
  INVENTORY: { key: 'F3', description: 'Open inventory' },
  CUSTOMERS: { key: 'F4', description: 'Open customers' }
};