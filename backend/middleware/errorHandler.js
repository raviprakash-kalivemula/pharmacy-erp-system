// Custom error class
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.success = false;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Standardized error response helper
const sendErrorResponse = (res, error) => {
  const statusCode = error.statusCode || 500;
  const response = {
    success: false,
    error: error.message || 'Internal server error',
    code: error.code || 'INTERNAL_ERROR',
    statusCode,
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  // Include additional error details if available
  if (error.errors) {
    response.errors = error.errors;
  }

  res.status(statusCode).json(response);
};

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Handle MySQL errors
  if (err.code && err.code.startsWith('ER_')) {
    return handleDatabaseError(err, res);
  }

  // Handle validation errors (from Joi)
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      errors: err.details,
    });
  }

  // Handle custom AppError
  if (err instanceof AppError) {
    return sendErrorResponse(res, err);
  }

  // Handle unknown errors
  return sendErrorResponse(res, {
    message: 'An unexpected error occurred',
    statusCode: 500,
    code: 'INTERNAL_ERROR',
  });
};

// Database error handler
const handleDatabaseError = (err, res) => {
  const errorMap = {
    ER_DUP_ENTRY: {
      statusCode: 409,
      code: 'DUPLICATE_ENTRY',
      message: 'Record already exists',
    },
    ER_NO_REFERENCED_ROW_2: {
      statusCode: 400,
      code: 'INVALID_REFERENCE',
      message: 'Referenced record does not exist',
    },
    ER_ROW_IS_REFERENCED_2: {
      statusCode: 400,
      code: 'RECORD_IN_USE',
      message: 'Cannot delete record - it is referenced by other records',
    },
    ER_BAD_FIELD_ERROR: {
      statusCode: 500,
      code: 'DATABASE_SCHEMA_ERROR',
      message: 'Database schema mismatch - column does not exist',
    },
    ER_NO_SUCH_TABLE: {
      statusCode: 500,
      code: 'DATABASE_SCHEMA_ERROR',
      message: 'Database schema mismatch - table does not exist',
    },
    ER_NO_DEFAULT_FOR_FIELD: {
      statusCode: 400,
      code: 'MISSING_REQUIRED_FIELD',
      message: 'Required field is missing',
    },
  };

  const errorInfo = errorMap[err.code] || {
    statusCode: 500,
    code: 'DATABASE_ERROR',
    message: err.sqlMessage || 'Database operation failed',
  };

  return res.status(errorInfo.statusCode).json({
    success: false,
    error: errorInfo.message,
    code: errorInfo.code,
    statusCode: errorInfo.statusCode,
    ...(process.env.NODE_ENV === 'development' && { 
      details: err.sqlMessage,
      sql: err.sql,
    }),
  });
};

// Not found error handler
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    statusCode: 404,
    path: req.originalUrl,
  });
};

module.exports = {
  AppError,
  errorHandler,
  sendErrorResponse,
  notFound,
};