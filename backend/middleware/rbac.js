/**
 * Role-Based Access Control (RBAC) Middleware
 * Enforces user role permissions on API endpoints
 */

class AppError extends Error {
  constructor(message, statusCode = 400, code = 'UNKNOWN_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.success = false;
  }
}

// Role definitions and permissions
const ROLES = {
  ADMIN: 'admin',
  PHARMACIST: 'pharmacist',
  VIEWER: 'viewer'
};

const PERMISSIONS = {
  // Medicines
  VIEW_MEDICINES: ['admin', 'pharmacist', 'viewer'],
  EDIT_MEDICINES: ['admin', 'pharmacist'],
  DELETE_MEDICINES: ['admin'],
  
  // Sales/Billing
  VIEW_SALES: ['admin', 'pharmacist', 'viewer'],
  CREATE_SALE: ['admin', 'pharmacist'],
  EDIT_SALE: ['admin', 'pharmacist'],
  DELETE_SALE: ['admin'],
  
  // Purchases
  VIEW_PURCHASES: ['admin', 'pharmacist', 'viewer'],
  CREATE_PURCHASE: ['admin', 'pharmacist'],
  EDIT_PURCHASE: ['admin'],
  DELETE_PURCHASE: ['admin'],
  
  // Customers
  VIEW_CUSTOMERS: ['admin', 'pharmacist', 'viewer'],
  CREATE_CUSTOMER: ['admin', 'pharmacist'],
  EDIT_CUSTOMER: ['admin', 'pharmacist'],
  DELETE_CUSTOMER: ['admin'],
  
  // Reports & Analytics
  VIEW_REPORTS: ['admin', 'pharmacist', 'viewer'],
  EXPORT_REPORTS: ['admin', 'pharmacist'],
  
  // Settings
  VIEW_SETTINGS: ['admin'],
  EDIT_SETTINGS: ['admin'],
  
  // Audit & Admin
  VIEW_AUDIT_LOGS: ['admin'],
  BACKUP_DATABASE: ['admin'],
  RESTORE_DATABASE: ['admin']
};

/**
 * Check if user has required role
 */
const checkRole = (userRole, requiredRole) => {
  if (!userRole || !requiredRole) return false;
  return userRole.toLowerCase() === requiredRole.toLowerCase();
};

/**
 * Check if user has permission
 */
const hasPermission = (userRole, permission) => {
  if (!userRole) return false;
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(userRole.toLowerCase());
};

/**
 * RBAC Middleware Factory
 * Usage: app.use(rbacMiddleware(permission))
 */
const rbacMiddleware = (permission) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    
    if (!userRole) {
      return res.status(401).json(new AppError('Unauthorized: No user role found', 401, 'NO_ROLE'));
    }
    
    if (!hasPermission(userRole, permission)) {
      return res.status(403).json(
        new AppError(
          `Forbidden: Insufficient permissions. Required: ${permission}`,
          403,
          'INSUFFICIENT_PERMISSION'
        )
      );
    }
    
    next();
  };
};

/**
 * Multi-permission checker (user must have at least one)
 */
const rbacMultiMiddleware = (permissions) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    
    if (!userRole) {
      return res.status(401).json(new AppError('Unauthorized: No user role found', 401, 'NO_ROLE'));
    }
    
    const hasAnyPermission = permissions.some(permission => 
      hasPermission(userRole, permission)
    );
    
    if (!hasAnyPermission) {
      return res.status(403).json(
        new AppError(
          `Forbidden: Required one of: ${permissions.join(', ')}`,
          403,
          'INSUFFICIENT_PERMISSION'
        )
      );
    }
    
    next();
  };
};

module.exports = {
  ROLES,
  PERMISSIONS,
  checkRole,
  hasPermission,
  rbacMiddleware,
  rbacMultiMiddleware
};
