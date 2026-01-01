const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { hashPassword, verifyPassword, generateToken } = require('../services/authService');
const { AppError } = require('../middleware/errorHandler');
const { authMiddleware, trackFailedLogin, clearFailedLogin } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleCheck');
const { validate } = require('../middleware/validator');
const { validateStrongPassword } = require('../utils/validationHelpers');
const jwt = require('jsonwebtoken');
const tokenService = require('../services/tokenService');
const otpService = require('../services/otpService');
const { loginLimiter, otpRequestLimiter, otpVerifyLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

// POST /auth/signup - Public user registration (no admin required)
router.post('/signup', async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    const { username, email, password } = req.body;

    // Validate inputs
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    // Check if user exists
    const [existing] = await connection.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Insert user with pending approval status
    const [result] = await connection.query(
      'INSERT INTO users (username, email, password_hash, role, is_active, signup_pending_approval, signup_method) VALUES (?, ?, ?, ?, 1, 1, ?)',
      [username, email, hashedPassword, 'viewer', 'email']
    );

    res.status(201).json({
      success: true,
      message: 'Account created! Please wait for admin approval.',
      data: {
        id: result.insertId,
        username,
        email,
        signup_pending_approval: true
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// POST /auth/register - Create new user (admin only)
router.post('/register', authMiddleware, requireRole('admin'), validate('register'), async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    const { username, email, password, full_name, role } = req.body;

    // Validate strong password
    const passwordCheck = validateStrongPassword(password);
    if (!passwordCheck.isValid) {
      throw new AppError(passwordCheck.message, 400, 'WEAK_PASSWORD');
    }

    // Check if user exists
    const [existing] = await connection.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      throw new AppError('User already exists', 409, 'USER_EXISTS');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert user
    const [result] = await connection.query(
      'INSERT INTO users (username, email, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [username, email, passwordHash, full_name, role]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        username,
        email,
        full_name,
        role
      },
      message: 'User created successfully'
    });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

// POST /auth/login - Authenticate user
router.post('/login', validate('login'), async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    const { username, password, remember_me } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    if (!username || !password) {
      throw new AppError('Username and password required', 400, 'MISSING_CREDENTIALS');
    }

    // Check rate limiting
    trackFailedLogin(clientIp);

    // Get user
    const [users] = await connection.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      throw new AppError('Invalid username or password', 401, 'INVALID_CREDENTIALS');
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      throw new AppError('User is inactive', 401, 'USER_INACTIVE');
    }

    // Check if user is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AppError('Account locked. Try again later.', 401, 'ACCOUNT_LOCKED');
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.password_hash);

    if (!passwordValid) {
      // Increment failed attempts
      await connection.query(
        'UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?',
        [user.id]
      );

      throw new AppError('Invalid username or password', 401, 'INVALID_CREDENTIALS');
    }

    // Clear failed attempts on successful login
    clearFailedLogin(clientIp);

    // Reset failed login counter
    await connection.query(
      'UPDATE users SET failed_login_attempts = 0, last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Issue tokens using new tokenService
    const tokens = await tokenService.issueTokens(
      user.id,
      user.role,
      user.username,
      clientIp,
      req.get('user-agent')
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role
        },
        expiresAt: tokens.expiresAt
      }
    });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

// POST /auth/request-otp - Request OTP code for login or signup
router.post('/request-otp', otpRequestLimiter, validate('requestOtp'), async (req, res, next) => {
  try {
    const { email, purpose = 'login' } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400, 'MISSING_EMAIL');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError('Invalid email format', 400, 'INVALID_EMAIL');
    }

    // Check if purpose is valid
    const validPurposes = ['login', 'signup', 'password_reset', 'email_verification'];
    if (!validPurposes.includes(purpose)) {
      throw new AppError('Invalid purpose', 400, 'INVALID_PURPOSE');
    }

    // Check rate limiting
    const rateLimitCheck = await otpService.checkOTPRateLimit(email, purpose, 5); // 5 per hour
    if (!rateLimitCheck.allowed) {
      throw new AppError(`Too many OTP requests. Try again in ${rateLimitCheck.retryAfter} minutes`, 429, 'RATE_LIMIT_EXCEEDED');
    }

    // If purpose is login, check if user exists
    if (purpose === 'login') {
      const connection = await db.getConnection();
      const [users] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
      connection.release();

      if (users.length === 0) {
        // User doesn't exist - suggest signup instead
        throw new AppError('No account found with this email. Please sign up first.', 404, 'USER_NOT_FOUND');
      }
    }

    // Generate and send OTP
    const userId = purpose === 'login' ? (await db.query('SELECT id FROM users WHERE email = ?', [email]))[0][0]?.id : null;
    await otpService.sendOTPViaEmail(email, userId, purpose);

    res.json({
      success: true,
      message: `OTP sent to ${email}`,
      data: {
        email,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        expiryMinutes: 10
      }
    });

    logger.info(`OTP requested for ${email}`, { email, purpose });
  } catch (error) {
    next(error);
  }
});

// POST /auth/verify-otp - Verify OTP and issue tokens
router.post('/verify-otp', otpVerifyLimiter, validate('verifyOtp'), async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    const { email, otpCode, purpose = 'login' } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    if (!email || !otpCode) {
      throw new AppError('Email and OTP code are required', 400, 'MISSING_FIELDS');
    }

    // Validate OTP
    const otpValidation = await otpService.validateOTP(email, otpCode, purpose);
    if (!otpValidation.valid) {
      throw new AppError(otpValidation.message, 401, otpValidation.code || 'INVALID_OTP');
    }

    // Get or create user based on purpose
    let user;
    const [existingUsers] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);

    if (purpose === 'login' && existingUsers.length === 0) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (purpose === 'signup' || (purpose === 'login' && existingUsers.length === 0)) {
      // Create new user for signup
      const username = email.split('@')[0] + '_' + Date.now().toString().slice(-5);
      const passwordHash = await hashPassword(Math.random().toString(36).substring(10)); // Dummy password

      const [result] = await connection.query(
        'INSERT INTO users (username, email, password_hash, role, is_active, email_verified, email_verified_at, signup_method) VALUES (?, ?, ?, ?, 1, 1, NOW(), ?)',
        [username, email, passwordHash, 'cashier', 'otp']
      );

      user = { id: result.insertId, username, email, role: 'cashier' };
    } else {
      user = existingUsers[0];
    }

    // Check if user is active
    if (!user.is_active) {
      throw new AppError('User account is inactive', 401, 'USER_INACTIVE');
    }

    // Mark OTP as used
    await otpService.markOTPAsUsed(otpValidation.otpId);

    // Issue tokens
    const tokens = await tokenService.issueTokens(
      user.id,
      user.username,
      user.email,
      user.role,
      clientIp,
      req.get('user-agent')
    );

    // Update last login
    await connection.query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        expiresAt: tokens.expiresAt
      }
    });

    logger.info(`User ${user.id} verified OTP login`, { email, userId: user.id });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

// POST /auth/refresh-token - Refresh access token using refresh token
router.post('/refresh-token', validate('refreshToken'), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400, 'MISSING_TOKEN');
    }

    // Verify and decode refresh token
    const decoded = tokenService.verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new AppError('Invalid or expired refresh token', 401, 'INVALID_TOKEN');
    }

    // Refresh the token
    const newTokens = await tokenService.refreshAccessToken(
      decoded.userId,
      refreshToken,
      clientIp,
      req.get('user-agent')
    );

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresAt: newTokens.expiresAt
      }
    });

    logger.info(`Token refreshed for user ${decoded.userId}`, { userId: decoded.userId });
  } catch (error) {
    next(error);
  }
});

// POST /auth/logout - Invalidate session
router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    const accessToken = req.headers.authorization?.substring(7);
    const userId = req.user.id;

    if (!accessToken) {
      throw new AppError('Access token is required', 400, 'MISSING_TOKEN');
    }

    // Invalidate the token by adding to blacklist (optional: for extra security)
    // This could also be done by storing revoked tokens in a cache
    
    logger.info(`User ${userId} logged out`, { userId });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /auth/me - Get current user profile
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const [users] = await db.query(
      'SELECT id, username, email, full_name, role, is_active, last_login FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
