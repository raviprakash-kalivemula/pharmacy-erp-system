/**
 * Rate Limiter Middleware
 * Implements rate limiting for sensitive endpoints
 * Prevents brute force attacks and DDoS
 */

const logger = require('../utils/logger');

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map();

/**
 * Clean up old entries from rate limit store (run periodically)
 */
function cleanupRateLimitStore() {
  const now = Date.now();
  const windowSize = 60 * 60 * 1000; // 1 hour

  for (const [key, data] of rateLimitStore.entries()) {
    // Remove entries older than window size
    const validAttempts = data.attempts.filter(time => now - time < windowSize);
    
    if (validAttempts.length === 0) {
      rateLimitStore.delete(key);
    } else {
      data.attempts = validAttempts;
    }
  }
}

// Run cleanup every 30 minutes
setInterval(cleanupRateLimitStore, 30 * 60 * 1000);

/**
 * Create rate limiter middleware
 * @param {object} options - Rate limiter options
 * @param {number} options.windowMs - Time window in milliseconds (default 15 min)
 * @param {number} options.maxRequests - Max requests per window (default 5)
 * @param {function} options.keyGenerator - Function to generate rate limit key
 * @param {string} options.message - Error message
 * @returns {function} - Express middleware
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 5,
    keyGenerator = (req) => req.ip || req.connection.remoteAddress,
    message = 'Too many requests, please try again later'
  } = options;

  return (req, res, next) => {
    // Skip rate limiting if disabled via env
    if (process.env.RATE_LIMIT_ENABLED === 'false') {
      return next();
    }

    try {
      const key = keyGenerator(req);
      const now = Date.now();

      // Get or create rate limit data for this key
      if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, { attempts: [], resetTime: now + windowMs });
      }

      const data = rateLimitStore.get(key);

      // Reset if window has passed
      if (now > data.resetTime) {
        data.attempts = [];
        data.resetTime = now + windowMs;
      }

      // Add current request timestamp
      data.attempts.push(now);

      // Check if limit exceeded
      if (data.attempts.length > maxRequests) {
        logger.warn(`⚠ Rate limit exceeded for ${key}`);

        return res.status(429).json({
          success: false,
          message,
          retryAfter: Math.ceil((data.resetTime - now) / 1000)
        });
      }

      // Add rate limit info to response headers
      const remaining = maxRequests - data.attempts.length;
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));
      res.setHeader('X-RateLimit-Reset', new Date(data.resetTime).toISOString());

      next();
    } catch (error) {
      logger.error(`✗ Rate limiter error: ${error.message}`);
      // Fail open - allow request if limiter fails
      next();
    }
  };
}

/**
 * Rate limiter for login endpoint
 * More lenient to allow legitimate users
 */
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  keyGenerator: (req) => {
    // Limit by IP + username combination
    return `${req.ip}-${req.body?.username || 'unknown'}`;
  },
  message: 'Too many login attempts. Please try again after 15 minutes.'
});

/**
 * Rate limiter for OTP requests
 * Strict to prevent spam
 */
const otpRequestLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  keyGenerator: (req) => {
    // Limit by email address
    return `otp-${req.body?.email || req.ip}`;
  },
  message: 'Too many OTP requests. Please try again after 1 hour.'
});

/**
 * Rate limiter for OTP verification
 * Strict to prevent brute force
 */
const otpVerifyLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  keyGenerator: (req) => {
    // Limit by email address
    return `verify-${req.body?.email || req.ip}`;
  },
  message: 'Too many verification attempts. Please request a new OTP.'
});

/**
 * Rate limiter for Google OAuth callback
 */
const googleOAuthLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  keyGenerator: (req) => {
    // Limit by IP
    return `google-${req.ip}`;
  },
  message: 'Too many OAuth requests. Please try again later.'
});

/**
 * Rate limiter for signup
 */
const signupLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5,
  keyGenerator: (req) => {
    // Limit by IP + email
    return `signup-${req.ip}-${req.body?.email || 'unknown'}`;
  },
  message: 'Too many signup attempts. Please try again later.'
});

/**
 * Rate limiter for password reset
 */
const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  keyGenerator: (req) => {
    // Limit by email
    return `reset-${req.body?.email || req.ip}`;
  },
  message: 'Too many password reset requests. Please try again later.'
});

/**
 * Generic rate limiter for API endpoints
 */
const apiLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
  message: 'Too many requests. Please try again later.'
});

module.exports = {
  createRateLimiter,
  loginLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
  googleOAuthLimiter,
  signupLimiter,
  passwordResetLimiter,
  apiLimiter
};
