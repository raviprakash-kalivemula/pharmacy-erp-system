/**
 * Google OAuth Routes
 * Handles Google Sign-In callback, token exchange, and signup flow
 */

const express = require('express');
const { verifyGoogleToken, generateJWT, verifyToken } = require('../services/authService');
const db = require('../config/db');
const logger = require('../utils/logger');

const router = express.Router();

// Simple auth middleware for protected routes
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
 * Exchange Google token for app JWT
 * Used by existing users or users pending approval
 */
router.post('/google/callback', async (req, res) => {
  try {
    const { token: googleToken } = req.body;

    if (!googleToken) {
      return res.status(400).json({
        success: false,
        message: 'Google token is required'
      });
    }

    // Verify Google token and extract user info
    let googleUser;
    try {
      googleUser = await verifyGoogleToken(googleToken);
      logger.info('Google token verified for email:', googleUser.email);
    } catch (error) {
      logger.error('Google token verification failed:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid Google token',
        code: 'INVALID_TOKEN',
        error: error.message
      });
    }

    // Find user by Google ID or email
    try {
      const query = 'SELECT id, username, email, role, is_active, google_id, signup_pending_approval FROM users WHERE google_id = ? OR email = ?';
      const [users] = await db.query(query, [googleUser.sub, googleUser.email]);

      if (users.length === 0) {
        // User doesn't exist, trigger signup flow
        return res.status(404).json({
          success: false,
          message: 'User not found. Please sign up.',
          code: 'USER_NOT_FOUND',
          googleUser: {
            email: googleUser.email,
            name: googleUser.name,
            picture: googleUser.picture
          }
        });
      }

      const user = users[0];

      // Check if user is inactive
      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated'
        });
      }

      // Check if user is pending approval
      if (user.signup_pending_approval) {
        return res.status(200).json({
          success: false,
          message: 'Your account is pending admin approval',
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            signup_pending_approval: true
          }
        });
      }

      // Generate JWT token
      const appToken = generateJWT({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      });

      // Update last login
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const updateQuery = 'UPDATE users SET last_login = NOW() WHERE id = ?';
      await db.query(updateQuery, [user.id]);

      // Store session
      const sessionQuery = `
        INSERT INTO user_sessions (user_id, token, expires_at, ip_address, user_agent, is_active)
        VALUES (?, ?, ?, ?, ?, true)
      `;
      const clientIp = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent') || 'Unknown';

      await db.query(sessionQuery, [
        user.id,
        appToken,
        expiresAt,
        clientIp,
        userAgent
      ]);

      logger.info(`Google login successful for user: ${user.username}`);

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          token: appToken,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          },
          expiresAt
        }
      });
    } catch (dbError) {
      logger.error('Database error in google callback:', dbError.message);
      return res.status(500).json({
        success: false,
        message: 'Database error: ' + dbError.message
      });
    }
  } catch (error) {
    logger.error('Google callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});

/**
 * POST /auth/google/register
 * Create new user with Google OAuth (guided signup)
 * User is created with pending_approval status
 */
router.post('/google/register', async (req, res) => {
  try {
    const { token: googleToken, username, email, role = 'viewer' } = req.body;

    if (!googleToken || !username || !email) {
      return res.status(400).json({
        success: false,
        message: 'Google token, username, and email are required'
      });
    }

    // Verify Google token
    let googleUser;
    try {
      googleUser = await verifyGoogleToken(googleToken);
      logger.info('Google token verified for signup:', email);
    } catch (error) {
      logger.error('Google token verification failed:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid Google token',
        error: error.message
      });
    }

    // Verify email matches
    if (googleUser.email !== email) {
      return res.status(400).json({
        success: false,
        message: 'Email does not match Google account'
      });
    }

    // Check if username already exists
    try {
      const [existingUsername] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
      if (existingUsername.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }

      // Check if email already exists
      const [existingEmail] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existingEmail.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }

      // Create new user (pending approval)
      const insertQuery = `
        INSERT INTO users (
          username, email, google_id, role, is_active, 
          signup_method, signup_pending_approval, requested_role
        ) VALUES (?, ?, ?, ?, ?, 'google', true, ?)
      `;

      const [result] = await db.query(insertQuery, [
        username,
        email,
        googleUser.sub,
        'viewer',
        true,
        role
      ]);

      // Store OAuth account details
      const oauthQuery = `
        INSERT INTO oauth_accounts (
          user_id, provider, provider_user_id, provider_email, is_primary,
          profile_data
        ) VALUES (?, 'google', ?, ?, true, ?)
      `;

      const profileData = JSON.stringify({
        name: googleUser.name,
        email: googleUser.email,
        picture: googleUser.picture
      });

      await db.query(oauthQuery, [
        result.insertId,
        googleUser.sub,
        email,
        profileData
      ]);

      logger.info(`New Google user registered: ${username} (pending approval)`);

      res.status(201).json({
        success: true,
        message: 'Account created successfully. Waiting for admin approval.',
        data: {
          user: {
            id: result.insertId,
            username,
            email,
            signup_pending_approval: true
          }
        }
      });
    } catch (dbError) {
      logger.error('Database error in google register:', dbError.message);
      return res.status(500).json({
        success: false,
        message: 'Database error: ' + dbError.message
      });
    }
  } catch (error) {
    logger.error('Google register error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});

/**
 * POST /auth/google/link
 * Link Google account to existing user account
 * Requires authentication
 */
router.post('/google/link', authMiddleware, async (req, res) => {
  try {
    const { token: googleToken } = req.body;
    const userId = req.user.id;

    if (!googleToken) {
      return res.status(400).json({
        success: false,
        message: 'Google token is required'
      });
    }

    // Verify Google token
    let googleUser;
    try {
      googleUser = await verifyGoogleToken(googleToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Google token'
      });
    }

    // Check if Google ID is already linked to another user
    const [existing] = await db.query(
      'SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ? AND user_id != ?',
      ['google', googleUser.sub, userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'This Google account is already linked to another user'
      });
    }

    // Check if already linked
    const [already] = await db.query(
      'SELECT id FROM oauth_accounts WHERE provider = ? AND user_id = ?',
      ['google', userId]
    );

    if (already.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have a Google account linked'
      });
    }

    // Link the account
    const insertQuery = `
      INSERT INTO oauth_accounts (
        user_id, provider, provider_user_id, provider_email, is_primary,
        profile_data
      ) VALUES (?, 'google', ?, ?, false, ?)
    `;

    const profileData = JSON.stringify({
      name: googleUser.name,
      email: googleUser.email,
      picture: googleUser.picture
    });

    await db.query(insertQuery, [
      userId,
      googleUser.sub,
      googleUser.email,
      profileData
    ]);

    logger.info(`Google account linked for user: ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Google account linked successfully'
    });
  } catch (error) {
    logger.error('Google link error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
