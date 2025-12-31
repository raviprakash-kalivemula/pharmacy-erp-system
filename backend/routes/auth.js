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

    // Generate token
    const token = generateToken(user.id, user.role, user.username);
    const decoded = jwt.decode(token);

    // Create session
    await connection.query(
      'INSERT INTO user_sessions (user_id, token, expires_at, ip_address, user_agent, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [user.id, token, new Date(decoded.exp * 1000), clientIp, req.get('user-agent')]
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role
        },
        expiresAt: new Date(decoded.exp * 1000)
      },
      message: 'Login successful'
    });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

// POST /auth/logout - Invalidate session
router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    const token = req.headers.authorization.substring(7);

    await db.query(
      'UPDATE user_sessions SET is_active = 0 WHERE token = ?',
      [token]
    );

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

// POST /auth/refresh - Refresh token
router.post('/refresh', authMiddleware, async (req, res, next) => {
  try {
    const newToken = generateToken(req.user.id, req.user.role, req.user.username);
    const decoded = jwt.decode(newToken);

    await db.query(
      'UPDATE user_sessions SET token = ?, expires_at = ? WHERE user_id = ? AND is_active = 1',
      [newToken, new Date(decoded.exp * 1000), req.user.id]
    );

    res.json({
      success: true,
      data: {
        token: newToken,
        expiresAt: new Date(decoded.exp * 1000)
      },
      message: 'Token refreshed successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
