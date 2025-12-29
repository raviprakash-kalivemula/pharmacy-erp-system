const { verifyToken } = require('../services/authService');
const { AppError } = require('./errorHandler');

// Track failed login attempts by IP
const failedAttempts = new Map();
const MAX_ATTEMPTS = process.env.MAX_LOGIN_ATTEMPTS || 5;
const LOCKOUT_TIME = process.env.LOCKOUT_TIME || 900000; // 15 minutes

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401, 'NO_TOKEN');
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
    }

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      role: decoded.role,
      username: decoded.username
    };

    next();
  } catch (error) {
    next(error);
  }
}

// Track failed login attempts for rate limiting
function trackFailedLogin(ip) {
  const now = Date.now();
  
  if (!failedAttempts.has(ip)) {
    failedAttempts.set(ip, []);
  }

  const attempts = failedAttempts.get(ip);
  
  // Remove attempts older than lockout time
  const recentAttempts = attempts.filter(time => now - time < LOCKOUT_TIME);
  
  if (recentAttempts.length >= MAX_ATTEMPTS) {
    throw new AppError(
      `Too many login attempts. Try again in ${Math.ceil(LOCKOUT_TIME / 60000)} minutes.`,
      429,
      'TOO_MANY_ATTEMPTS'
    );
  }

  recentAttempts.push(now);
  failedAttempts.set(ip, recentAttempts);
}

function clearFailedLogin(ip) {
  failedAttempts.delete(ip);
}

module.exports = {
  authMiddleware,
  trackFailedLogin,
  clearFailedLogin
};
