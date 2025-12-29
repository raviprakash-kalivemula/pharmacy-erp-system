const { AppError } = require('./errorHandler');
const db = require('../config/db');

function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401, 'NO_AUTH');
      }

      if (!allowedRoles.includes(req.user.role)) {
        // Log unauthorized attempt
        await db.query(
          'INSERT INTO audit_logs (user_id, action, entity_type, ip_address) VALUES (?, ?, ?, ?)',
          [req.user.id, 'unauthorized_access', req.originalUrl, req.ip]
        ).catch(() => {}); // Don't fail if audit log fails

        throw new AppError(
          `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`,
          403,
          'FORBIDDEN'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { requireRole };
