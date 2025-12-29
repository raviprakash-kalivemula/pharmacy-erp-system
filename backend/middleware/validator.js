const Joi = require('joi');
const { getCustomErrorMessage } = require('../utils/validationHelpers');

// Strong password regex: 8+ chars, uppercase, lowercase, digit, special char
const strongPasswordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

// Validation schemas
const schemas = {
  // =====================
  // AUTHENTICATION SCHEMAS
  // =====================
  
  // Register validation
  register: Joi.object({
    username: Joi.string()
      .required()
      .min(3)
      .max(50)
      .alphanum()
      .trim()
      .messages({
        'string.alphanum': 'Username must contain only letters and numbers',
        'string.min': 'Username must be at least 3 characters',
        'string.max': 'Username cannot exceed 50 characters',
        'any.required': 'Username is required',
      }),
    email: Joi.string()
      .required()
      .email()
      .trim()
      .messages({
        'string.email': 'Please enter a valid email address',
        'any.required': 'Email is required',
      }),
    password: Joi.string()
      .required()
      .pattern(strongPasswordRegex)
      .messages({
        'string.pattern.base': 'Password must contain: 8+ characters, uppercase, lowercase, digit, and special character (!@#$%^&*)',
        'any.required': 'Password is required',
      }),
    role: Joi.string()
      .required()
      .valid('admin', 'pharmacist', 'cashier', 'inventory_manager')
      .messages({
        'any.only': 'Role must be one of: admin, pharmacist, cashier, inventory_manager',
        'any.required': 'Role is required',
      }),
  }),

  // Login validation
  login: Joi.object({
    username: Joi.string()
      .required()
      .trim()
      .messages({
        'any.required': 'Username is required',
      }),
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required',
      }),
    remember_me: Joi.boolean().default(false),
  }),

  // =====================
  // MEDICINE SCHEMAS
  // =====================
  
  // Medicine validation
  medicine: Joi.object({
    name: Joi.string()
      .required()
      .min(3)
      .max(255)
      .trim()
      .messages({
        'string.min': 'Medicine name must be at least 3 characters',
        'string.max': 'Medicine name cannot exceed 255 characters',
        'any.required': 'Medicine name is required',
      }),
    salt: Joi.string().allow('', null).max(255),
    manufacturer: Joi.string().allow('', null).max(255),
    category: Joi.string().allow('', null).max(100),
    hsn_code: Joi.string().allow('', null).max(20),
    pack: Joi.string().allow('', null).max(100),
    rack: Joi.string().allow('', null).max(20),
    barcode: Joi.string().allow('', null).max(50),
    min_stock: Joi.number().integer().min(0).default(50).messages({
      'number.base': 'Minimum stock must be a number',
      'number.min': 'Minimum stock cannot be negative',
    }),
    max_stock: Joi.number().integer().min(0).default(1000).messages({
      'number.base': 'Maximum stock must be a number',
      'number.min': 'Maximum stock cannot be negative',
    }),
    reorder_level: Joi.number().integer().min(0).default(100).messages({
      'number.base': 'Reorder level must be a number',
      'number.min': 'Reorder level cannot be negative',
    }),
  }),

  // Medicine batch validation
  medicineBatch: Joi.object({
    medicine_id: Joi.number()
      .integer()
      .required()
      .messages({
        'number.base': 'Medicine ID must be a number',
        'any.required': 'Medicine ID is required',
      }),
    batch: Joi.string()
      .required()
      .min(1)
      .max(50)
      .trim()
      .messages({
        'string.min': 'Batch number is required',
        'string.max': 'Batch number cannot exceed 50 characters',
        'any.required': 'Batch number is required',
      }),
    expiry: Joi.date()
      .required()
      .greater('now')
      .messages({
        'date.base': 'Expiry must be a valid date',
        'date.greater': 'Expiry date must be in the future',
        'any.required': 'Expiry date is required',
      }),
    stock: Joi.number()
      .integer()
      .min(0)
      .required()
      .messages({
        'number.base': 'Stock must be a number',
        'number.min': 'Stock cannot be negative',
        'any.required': 'Stock quantity is required',
      }),
    mrp: Joi.number()
      .positive()
      .required()
      .messages({
        'number.base': 'MRP must be a number',
        'number.positive': 'MRP must be greater than zero',
        'any.required': 'MRP is required',
      }),
    purchase_rate: Joi.number()
      .positive()
      .required()
      .messages({
        'number.base': 'Purchase rate must be a number',
        'number.positive': 'Purchase rate must be greater than zero',
        'any.required': 'Purchase rate is required',
      }),
    selling_rate: Joi.number().positive(),
    margin: Joi.number().min(0).max(100),
  }),

  // Batch stock update
  batchStockUpdate: Joi.object({
    quantity: Joi.number()
      .integer()
      .min(0)
      .required()
      .messages({
        'number.base': 'Quantity must be a number',
        'number.min': 'Quantity cannot be negative',
        'any.required': 'Quantity is required',
      }),
    expiry: Joi.date()
      .greater('now')
      .messages({
        'date.base': 'Expiry must be a valid date',
        'date.greater': 'Expiry date must be in the future',
      }),
  }),

  // =====================
  // CUSTOMER SCHEMAS
  // =====================
  
  // Customer validation
  customer: Joi.object({
    name: Joi.string()
      .required()
      .min(2)
      .max(255)
      .trim()
      .messages({
        'string.min': 'Customer name must be at least 2 characters',
        'string.max': 'Customer name cannot exceed 255 characters',
        'any.required': 'Customer name is required',
      }),
    phone: Joi.string()
      .allow('', null)
      .pattern(/^[0-9]{10,15}$/)
      .messages({
        'string.pattern.base': 'Phone number must be 10-15 digits',
      }),
    email: Joi.string()
      .allow('', null)
      .email()
      .messages({
        'string.email': 'Please enter a valid email address',
      }),
    address: Joi.string().allow('', null).max(500),
    gst_number: Joi.string()
      .allow('', null)
      .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
      .messages({
        'string.pattern.base': 'Invalid GST number format (expected: 15-character code)',
      }),
    dl_number: Joi.string().allow('', null).max(20),
    credit_limit: Joi.number().min(0).default(0),
    credit_days: Joi.number().integer().min(0).default(0),
  }),

  // Customer credit update
  customerCredit: Joi.object({
    credit_limit: Joi.number()
      .min(0)
      .required()
      .messages({
        'number.base': 'Credit limit must be a number',
        'number.min': 'Credit limit cannot be negative',
        'any.required': 'Credit limit is required',
      }),
    credit_days: Joi.number()
      .integer()
      .min(0)
      .required()
      .messages({
        'number.base': 'Credit days must be a number',
        'number.min': 'Credit days cannot be negative',
        'any.required': 'Credit days is required',
      }),
  }),

  // =====================
  // SUPPLIER SCHEMAS
  // =====================
  
  // Supplier validation
  supplier: Joi.object({
    name: Joi.string()
      .required()
      .min(2)
      .max(255)
      .trim()
      .messages({
        'string.min': 'Supplier name must be at least 2 characters',
        'string.max': 'Supplier name cannot exceed 255 characters',
        'any.required': 'Supplier name is required',
      }),
    phone: Joi.string()
      .allow('', null)
      .pattern(/^[0-9]{10,15}$/)
      .messages({
        'string.pattern.base': 'Phone number must be 10-15 digits',
      }),
    email: Joi.string()
      .allow('', null)
      .email()
      .messages({
        'string.email': 'Please enter a valid email address',
      }),
    address: Joi.string().allow('', null).max(500),
    gst_number: Joi.string()
      .allow('', null)
      .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
      .messages({
        'string.pattern.base': 'Invalid GST number format (expected: 15-character code)',
      }),
    dl_number: Joi.string().allow('', null).max(50),
    credit_days: Joi.number().integer().min(0).default(30),
    credit_limit: Joi.number().min(0).default(0),
  }),

  // Supplier credit update
  supplierCredit: Joi.object({
    credit_limit: Joi.number()
      .min(0)
      .required()
      .messages({
        'number.base': 'Credit limit must be a number',
        'number.min': 'Credit limit cannot be negative',
        'any.required': 'Credit limit is required',
      }),
    credit_days: Joi.number()
      .integer()
      .min(0)
      .required()
      .messages({
        'number.base': 'Credit days must be a number',
        'number.min': 'Credit days cannot be negative',
        'any.required': 'Credit days is required',
      }),
  }),

  // =====================
  // SALE SCHEMAS
  // =====================
  
  // Sale validation
  sale: Joi.object({
    customer: Joi.object({
      id: Joi.number().integer().allow(null),
      name: Joi.string()
        .required()
        .min(2)
        .max(255)
        .messages({
          'string.min': 'Customer name must be at least 2 characters',
          'string.max': 'Customer name cannot exceed 255 characters',
          'any.required': 'Customer name is required',
        }),
      phone: Joi.string().allow('', null),
      address: Joi.string().allow('', null),
      gst_number: Joi.string().allow('', null),
      dl_number: Joi.string().allow('', null),
    }).required(),
    items: Joi.array()
      .min(1)
      .items(
        Joi.object({
          name: Joi.string().required(),
          batch_id: Joi.number().integer().allow(null),
          batch: Joi.string().allow('', null),
          quantity: Joi.number()
            .integer()
            .min(1)
            .required()
            .messages({
              'number.base': 'Quantity must be a number',
              'number.min': 'Quantity must be at least 1',
              'any.required': 'Quantity is required',
            }),
          rate: Joi.number()
            .positive()
            .required()
            .messages({
              'number.base': 'Rate must be a number',
              'number.positive': 'Rate must be greater than zero',
              'any.required': 'Rate is required',
            }),
          amount: Joi.number()
            .positive()
            .required()
            .messages({
              'number.base': 'Amount must be a number',
              'number.positive': 'Amount must be greater than zero',
              'any.required': 'Amount is required',
            }),
          mrp: Joi.number().positive(),
          gst_percent: Joi.number().min(0).max(100),
        })
      )
      .required()
      .messages({
        'array.min': 'Sale must contain at least one item',
        'any.required': 'Items list is required',
      }),
    payment: Joi.object({
      mode: Joi.string()
        .valid('Cash', 'Card', 'UPI', 'Credit', 'Cheque')
        .required()
        .messages({
          'any.only': 'Payment mode must be one of: Cash, Card, UPI, Credit, Cheque',
          'any.required': 'Payment mode is required',
        }),
      amount: Joi.number()
        .min(0)
        .required()
        .messages({
          'number.base': 'Payment amount must be a number',
          'number.min': 'Payment amount cannot be negative',
          'any.required': 'Payment amount is required',
        }),
    }).required(),
    totals: Joi.object({
      subtotal: Joi.number()
        .min(0)
        .required()
        .messages({
          'number.base': 'Subtotal must be a number',
          'number.min': 'Subtotal cannot be negative',
          'any.required': 'Subtotal is required',
        }),
      tax: Joi.number()
        .min(0)
        .required()
        .messages({
          'number.base': 'Tax must be a number',
          'number.min': 'Tax cannot be negative',
          'any.required': 'Tax is required',
        }),
      grandTotal: Joi.number()
        .positive()
        .required()
        .messages({
          'number.base': 'Grand total must be a number',
          'number.positive': 'Grand total must be greater than zero',
          'any.required': 'Grand total is required',
        }),
    }).required(),
  }),

  // Payment validation
  payment: Joi.object({
    amount_paid: Joi.number()
      .positive()
      .required()
      .messages({
        'number.base': 'Payment amount must be a number',
        'number.positive': 'Payment amount must be greater than zero',
        'any.required': 'Payment amount is required',
      }),
    payment_mode: Joi.string()
      .valid('Cash', 'Card', 'UPI', 'Credit', 'Cheque')
      .required()
      .messages({
        'any.only': 'Payment mode must be one of: Cash, Card, UPI, Credit, Cheque',
        'any.required': 'Payment mode is required',
      }),
  }),

  // =====================
  // PURCHASE SCHEMAS
  // =====================
  
  // Purchase validation
  purchase: Joi.object({
    supplier_id: Joi.number()
      .integer()
      .required()
      .messages({
        'number.base': 'Supplier ID must be a number',
        'any.required': 'Supplier is required',
      }),
    invoice_no: Joi.string()
      .required()
      .max(100)
      .trim()
      .messages({
        'string.max': 'Invoice number cannot exceed 100 characters',
        'any.required': 'Supplier invoice number is required',
      }),
    purchase_date: Joi.date()
      .required()
      .messages({
        'date.base': 'Purchase date must be a valid date',
        'any.required': 'Purchase date is required',
      }),
    items: Joi.array()
      .min(1)
      .items(
        Joi.object({
          medicine_id: Joi.number()
            .integer()
            .required()
            .messages({
              'number.base': 'Medicine ID must be a number',
              'any.required': 'Medicine is required',
            }),
          batch: Joi.string()
            .required()
            .max(50)
            .messages({
              'string.max': 'Batch number cannot exceed 50 characters',
              'any.required': 'Batch number is required',
            }),
          expiry: Joi.date()
            .required()
            .greater('now')
            .messages({
              'date.base': 'Expiry must be a valid date',
              'date.greater': 'Expiry date must be in the future',
              'any.required': 'Expiry date is required',
            }),
          quantity: Joi.number()
            .integer()
            .min(1)
            .required()
            .messages({
              'number.base': 'Quantity must be a number',
              'number.min': 'Quantity must be at least 1',
              'any.required': 'Quantity is required',
            }),
          rate: Joi.number()
            .positive()
            .required()
            .messages({
              'number.base': 'Rate must be a number',
              'number.positive': 'Rate must be greater than zero',
              'any.required': 'Rate is required',
            }),
          mrp: Joi.number()
            .positive()
            .messages({
              'number.base': 'MRP must be a number',
              'number.positive': 'MRP must be greater than zero',
            }),
        })
      )
      .required()
      .messages({
        'array.min': 'Purchase must contain at least one item',
        'any.required': 'Items list is required',
      }),
    total_amount: Joi.number()
      .positive()
      .required()
      .messages({
        'number.base': 'Total amount must be a number',
        'number.positive': 'Total amount must be greater than zero',
        'any.required': 'Total amount is required',
      }),
  }),

  // =====================
  // SETTINGS SCHEMAS
  // =====================
  
  // Settings validation
  settings: Joi.object({
    shop_name: Joi.string()
      .required()
      .min(2)
      .max(255)
      .messages({
        'string.min': 'Shop name must be at least 2 characters',
        'string.max': 'Shop name cannot exceed 255 characters',
        'any.required': 'Shop name is required',
      }),
    phone: Joi.string()
      .allow('', null)
      .pattern(/^[0-9]{10,15}$/)
      .messages({
        'string.pattern.base': 'Phone number must be 10-15 digits',
      }),
    email: Joi.string()
      .allow('', null)
      .email()
      .messages({
        'string.email': 'Please enter a valid email address',
      }),
    address: Joi.string().allow('', null).max(500),
    gst_number: Joi.string()
      .allow('', null)
      .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
      .messages({
        'string.pattern.base': 'Invalid GST number format (expected: 15-character code)',
      }),
    license_number: Joi.string().allow('', null).max(50),
  }),
};

// Validation middleware factory
const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    
    if (!schema) {
      return res.status(500).json({
        success: false,
        error: 'Validation schema not found',
        code: 'SCHEMA_NOT_FOUND',
        statusCode: 500,
      });
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Return all errors
      stripUnknown: true, // Remove unknown fields
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        errors,
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

// Param validation middleware (for ID parameters)
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        errors,
      });
    }

    req.params = value;
    next();
  };
};

module.exports = { validate, validateParams, schemas };