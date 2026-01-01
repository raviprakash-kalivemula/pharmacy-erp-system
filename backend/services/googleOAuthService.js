/**
 * Google OAuth Service
 * Centralized Google authentication logic
 * Handles token verification, user lookup, account creation/linking
 */

const { OAuth2Client } = require('google-auth-library');
const db = require('../config/db');
const logger = require('../utils/logger');
const { hashPassword } = require('./authService');
const crypto = require('crypto');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Verify Google ID Token
 * @param {string} idToken - Google ID token from frontend
 * @returns {Promise<{sub, email, name, picture, email_verified}>}
 */
async function verifyGoogleToken(idToken) {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    
    if (!payload.email_verified) {
      logger.warn(`⚠ Google account email not verified: ${payload.email}`);
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture,
      email_verified: payload.email_verified
    };
  } catch (error) {
    logger.error(`✗ Google token verification failed: ${error.message}`);
    throw new Error(`Google authentication failed: ${error.message}`);
  }
}

/**
 * Find user by Google ID or email
 * @param {string} googleId - Google user ID
 * @param {string} email - Email address
 * @returns {Promise<object|null>}
 */
async function findUserByGoogleOrEmail(googleId, email) {
  try {
    const query = `
      SELECT id, username, email, role, is_active, signup_pending_approval, google_id
      FROM users
      WHERE google_id = ? OR email = ?
      LIMIT 1
    `;

    const conn = await db.getConnection();
    try {
      const [results] = await conn.execute(query, [googleId, email]);
      return results.length > 0 ? results[0] : null;
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error(`✗ User lookup error: ${error.message}`);
    throw error;
  }
}

/**
 * Check if email is unique (not already used by another user)
 * @param {string} email - Email to check
 * @returns {Promise<boolean>}
 */
async function isEmailUnique(email) {
  try {
    const query = 'SELECT id FROM users WHERE email = ? LIMIT 1';

    const conn = await db.getConnection();
    try {
      const [results] = await conn.execute(query, [email]);
      return results.length === 0;
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error(`✗ Email uniqueness check error: ${error.message}`);
    throw error;
  }
}

/**
 * Create new user from Google profile (with pending approval)
 * @param {object} googleProfile - Google profile {sub, email, name, picture}
 * @param {string} requestedRole - Role requested by user (default: cashier)
 * @returns {Promise<object>} - Created user object
 */
async function createGoogleUser(googleProfile, requestedRole = 'cashier') {
  try {
    const { sub: googleId, email, name } = googleProfile;

    // Validate role is allowed
    const allowedRoles = ['admin', 'pharmacist', 'cashier', 'inventory_manager'];
    const role = allowedRoles.includes(requestedRole) ? requestedRole : 'cashier';

    // Generate placeholder password for OAuth users
    const dummyPassword = await hashPassword(crypto.randomBytes(32).toString('hex'));

    // Generate unique username from email
    const baseUsername = email.split('@')[0];
    let username = baseUsername;
    let counter = 1;

    // Check if username is unique, append number if needed
    while (true) {
      const query = 'SELECT id FROM users WHERE username = ? LIMIT 1';
      const conn = await db.getConnection();
      try {
        const [results] = await conn.execute(query, [username]);
        if (results.length === 0) break;
        username = `${baseUsername}${counter++}`;
      } finally {
        conn.release();
      }
    }

    // Create user
    const insertQuery = `
      INSERT INTO users 
      (username, email, password_hash, full_name, role, google_id, signup_method, 
       signup_pending_approval, requested_role, email_verified, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'google', 1, ?, 1, 1, NOW(), NOW())
    `;

    const conn = await db.getConnection();
    try {
      const [result] = await conn.execute(insertQuery, [
        username,
        email,
        dummyPassword,
        name,
        role,
        googleId,
        requestedRole
      ]);

      logger.info(`✓ New Google user created (pending approval): ${email}`);

      return {
        id: result.insertId,
        username,
        email,
        full_name: name,
        role,
        google_id: googleId,
        signup_pending_approval: true,
        is_active: true,
        email_verified: true
      };
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error(`✗ Google user creation error: ${error.message}`);
    throw error;
  }
}

/**
 * Link Google account to existing user
 * @param {number} userId - User ID
 * @param {object} googleProfile - Google profile {sub, email, name}
 * @returns {Promise<object>} - OAuth account object
 */
async function linkGoogleAccount(userId, googleProfile) {
  try {
    const { sub: googleId, email, name, picture } = googleProfile;

    // Check if Google ID already linked to another user
    const checkQuery = `
      SELECT user_id FROM oauth_accounts 
      WHERE provider = 'google' AND provider_user_id = ? AND user_id != ?
      LIMIT 1
    `;

    const conn = await db.getConnection();
    try {
      const [results] = await conn.execute(checkQuery, [googleId, userId]);
      if (results.length > 0) {
        throw new Error('This Google account is already linked to another user');
      }

      // Check if email matches user's email
      const userQuery = 'SELECT email FROM users WHERE id = ?';
      const [userResults] = await conn.execute(userQuery, [userId]);
      
      if (userResults.length === 0) {
        throw new Error('User not found');
      }

      // Link Google account
      const linkQuery = `
        INSERT INTO oauth_accounts 
        (user_id, provider, provider_user_id, provider_email, is_primary, profile_data, created_at, updated_at)
        VALUES (?, 'google', ?, ?, 0, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE 
          updated_at = NOW(),
          is_primary = VALUES(is_primary),
          profile_data = VALUES(profile_data)
      `;

      const profileData = JSON.stringify({ name, picture, email_verified: true });
      await conn.execute(linkQuery, [userId, googleId, email, profileData]);

      // Update user's google_id field
      const updateQuery = 'UPDATE users SET google_id = ? WHERE id = ?';
      await conn.execute(updateQuery, [googleId, userId]);

      logger.info(`✓ Google account linked for user: ${userId}`);

      return {
        user_id: userId,
        provider: 'google',
        provider_user_id: googleId,
        provider_email: email,
        is_primary: false
      };
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error(`✗ Google account linking error: ${error.message}`);
    throw error;
  }
}

/**
 * Find or create user from Google profile
 * Returns existing user or creates new one with pending approval
 * @param {object} googleProfile - Google profile
 * @param {string} requestedRole - Role requested
 * @returns {Promise<{user, isNewUser}>}
 */
async function findOrCreateGoogleUser(googleProfile, requestedRole = 'cashier') {
  try {
    const { sub: googleId, email } = googleProfile;

    // Try to find existing user
    let user = await findUserByGoogleOrEmail(googleId, email);

    if (user) {
      logger.info(`✓ Google user found: ${user.email}`);
      return { user, isNewUser: false };
    }

    // Check if email is unique before creating
    const emailUnique = await isEmailUnique(email);
    if (!emailUnique) {
      logger.warn(`⚠ Email already exists (not via Google): ${email}`);
      throw new Error('Email already registered. Please use email login or contact support.');
    }

    // Create new user
    const newUser = await createGoogleUser(googleProfile, requestedRole);
    return { user: newUser, isNewUser: true };
  } catch (error) {
    logger.error(`✗ Find or create Google user error: ${error.message}`);
    throw error;
  }
}

/**
 * Update user's Google profile picture (optional)
 * @param {number} userId - User ID
 * @param {string} pictureUrl - Picture URL
 * @returns {Promise<boolean>}
 */
async function updateGoogleProfilePicture(userId, pictureUrl) {
  try {
    const query = 'UPDATE users SET avatar_url = ? WHERE id = ?';
    
    const conn = await db.getConnection();
    try {
      await conn.execute(query, [pictureUrl, userId]);
      return true;
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.warn(`⚠ Failed to update profile picture: ${error.message}`);
    return false;
  }
}

/**
 * Get OAuth account details for a user
 * @param {number} userId - User ID
 * @returns {Promise<object[]>}
 */
async function getOAuthAccounts(userId) {
  try {
    const query = `
      SELECT id, provider, provider_user_id, provider_email, is_primary, created_at
      FROM oauth_accounts
      WHERE user_id = ?
      ORDER BY is_primary DESC, created_at DESC
    `;

    const conn = await db.getConnection();
    try {
      const [results] = await conn.execute(query, [userId]);
      return results;
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error(`✗ Get OAuth accounts error: ${error.message}`);
    throw error;
  }
}

module.exports = {
  verifyGoogleToken,
  findUserByGoogleOrEmail,
  isEmailUnique,
  createGoogleUser,
  linkGoogleAccount,
  findOrCreateGoogleUser,
  updateGoogleProfilePicture,
  getOAuthAccounts
};
