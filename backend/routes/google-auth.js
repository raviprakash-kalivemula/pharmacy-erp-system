/**
 * Google OAuth Routes - FIXED VERSION
 * Handles Google Sign-In callback, token exchange, signup flow
 * Uses centralized googleOAuthService and tokenService
 */

const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const db = require('../config/db');
const logger = require('../utils/logger');
const tokenService = require('../services/tokenService');
const googleOAuthService = require('../services/googleOAuthService');
const { googleOAuthLimiter } = require('../middleware/rateLimiter');
const { AppError } = require('../middleware/errorHandler');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Token verification middleware
const verifyToken = (token) => {
  return tokenService.verifyAccessToken(token);
};

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

/**
 * POST /auth/google/callback
 * Exchange Google token for app JWT tokens
 * Used by existing users or users pending approval
 */
router.post('/google/callback', googleOAuthLimiter, async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    const { idToken } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    if (!idToken) {
      throw new AppError('Google token is required', 400, 'MISSING_TOKEN');
    }

    // Verify Google token
    let googleProfile;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      googleProfile = ticket.getPayload();
      logger.info('Google token verified', { email: googleProfile.email });
    } catch (error) {
      logger.error('Google token verification failed', { error: error.message });
      throw new AppError('Invalid Google token', 401, 'INVALID_TOKEN');
    }

    // Find or create user
    const result = await googleOAuthService.findOrCreateGoogleUser(googleProfile, 'cashier');
    const user = result.user;

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated',
        code: 'USER_INACTIVE'
      });
    }

    // Check if user is pending approval
    if (user.signup_pending_approval) {
      return res.status(200).json({
        success: false,
        message: 'Your account is pending admin approval',
        code: 'PENDING_APPROVAL',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            signup_pending_approval: true
          }
        }
      });
    }

    // Issue tokens (access + refresh with rotation support)
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

    logger.info('Google login successful', { userId: user.id, email: user.email });

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
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

/**
 * POST /auth/google/register
 * Create new user with Google OAuth (guided signup)
 * User is created with pending_approval status
 */
router.post('/google/register', googleOAuthLimiter, async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    const { idToken, username } = req.body;

    if (!idToken || !username) {
      throw new AppError('Google token and username are required', 400, 'MISSING_FIELDS');
    }

    // Verify Google token
    let googleProfile;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      googleProfile = ticket.getPayload();
    } catch (error) {
      throw new AppError('Invalid Google token', 401, 'INVALID_TOKEN');
    }

    // Check if username is already taken
    const [existingUsername] = await connection.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUsername.length > 0) {
      throw new AppError('Username already taken', 409, 'USERNAME_EXISTS');
    }

    // Check if email is already registered
    const [existingEmail] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [googleProfile.email]
    );

    if (existingEmail.length > 0) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    // Create new user with cashier role (not viewer)
    const passwordHash = await require('../services/authService').hashPassword(
      require('crypto').randomBytes(32).toString('hex')
    );

    const [result] = await connection.query(
      `INSERT INTO users 
      (username, email, password_hash, role, is_active, email_verified, email_verified_at, signup_method, signup_pending_approval, google_id) 
      VALUES (?, ?, ?, ?, 1, 1, NOW(), ?, 1, ?)`,
      [username, googleProfile.email, passwordHash, 'cashier', 'google', googleProfile.sub]
    );

    const userId = result.insertId;

    // Store OAuth account details
    await connection.query(
      `INSERT INTO oauth_accounts (user_id, provider, provider_id, provider_email, picture_url, verified) 
       VALUES (?, 'google', ?, ?, ?, 1)`,
      [userId, googleProfile.sub, googleProfile.email, googleProfile.picture || null]
    );

    logger.info('New Google user registered', { userId, username, email: googleProfile.email });

    res.status(201).json({
      success: true,
      message: 'Account created successfully. Waiting for admin approval.',
      data: {
        user: {
          id: userId,
          username,
          email: googleProfile.email,
          signup_pending_approval: true
        }
      }
    });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

/**
 * POST /auth/google/link
 * Link Google account to existing user account
 * Requires authentication
 */
router.post('/google/link', authMiddleware, googleOAuthLimiter, async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    const { idToken } = req.body;
    const userId = req.user.userId;

    if (!idToken) {
      throw new AppError('Google token is required', 400, 'MISSING_TOKEN');
    }

    // Verify Google token
    let googleProfile;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      googleProfile = ticket.getPayload();
    } catch (error) {
      throw new AppError('Invalid Google token', 401, 'INVALID_TOKEN');
    }

    // Check if Google ID is already linked to another user
    const [existing] = await connection.query(
      'SELECT id FROM oauth_accounts WHERE provider = ? AND provider_id = ? AND user_id != ?',
      ['google', googleProfile.sub, userId]
    );

    if (existing.length > 0) {
      throw new AppError('This Google account is already linked to another user', 409, 'GOOGLE_ALREADY_LINKED');
    }

    // Check if already linked to this user
    const [alreadyLinked] = await connection.query(
      'SELECT id FROM oauth_accounts WHERE provider = ? AND user_id = ?',
      ['google', userId]
    );

    if (alreadyLinked.length > 0) {
      throw new AppError('You already have a Google account linked', 409, 'ALREADY_LINKED');
    }

    // Link the account
    await connection.query(
      `INSERT INTO oauth_accounts (user_id, provider, provider_id, provider_email, picture_url, verified) 
       VALUES (?, 'google', ?, ?, ?, 1)`,
      [userId, googleProfile.sub, googleProfile.email, googleProfile.picture || null]
    );

    // Update user's Google ID
    await connection.query(
      'UPDATE users SET google_id = ? WHERE id = ?',
      [googleProfile.sub, userId]
    );

    logger.info('Google account linked', { userId, email: googleProfile.email });

    res.json({
      success: true,
      message: 'Google account linked successfully'
    });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

module.exports = router;
