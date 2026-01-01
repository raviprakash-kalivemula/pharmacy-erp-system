/**
 * Token Service
 * Manages JWT token lifecycle: generation, verification, refresh, revocation
 * Implements token rotation for enhanced security
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_change_in_production';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'default_refresh_secret_change_in_production';
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

/**
 * Create SHA256 hash of token for storage
 * @param {string} token - The token to hash
 * @returns {string} - SHA256 hash
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate UUID for token family (track token lineage for rotation)
 * @returns {string} - UUID v4
 */
function generateTokenFamily() {
  return crypto.randomUUID();
}

/**
 * Issue new access and refresh token pair
 * @param {number} userId - User ID
 * @param {string} username - Username
 * @param {string} email - User email
 * @param {string} role - User role
 * @returns {Promise<{accessToken, refreshToken, expiresAt, refreshExpiresAt}>}
 */
async function issueTokens(userId, username, email, role) {
  try {
    // Generate token family for rotation tracking
    const tokenFamily = generateTokenFamily();
    
    // Generate access token (short-lived)
    const accessToken = jwt.sign(
      { 
        userId, 
        username, 
        email, 
        role,
        type: 'access'
      },
      JWT_SECRET,
      { 
        expiresIn: ACCESS_TOKEN_EXPIRY,
        algorithm: process.env.JWT_ALGORITHM || 'HS256'
      }
    );

    // Generate refresh token (long-lived)
    const refreshToken = jwt.sign(
      { 
        userId, 
        username,
        type: 'refresh',
        family: tokenFamily
      },
      REFRESH_TOKEN_SECRET,
      { 
        expiresIn: REFRESH_TOKEN_EXPIRY,
        algorithm: process.env.JWT_ALGORITHM || 'HS256'
      }
    );

    // Decode tokens to get expiry times
    const accessDecoded = jwt.decode(accessToken);
    const refreshDecoded = jwt.decode(refreshToken);

    // Hash tokens for storage (don't store plain tokens)
    const accessTokenHash = hashToken(accessToken);
    const refreshTokenHash = hashToken(refreshToken);

    // Store session with refresh token
    const expiresAt = new Date(accessDecoded.exp * 1000);
    const refreshExpiresAt = new Date(refreshDecoded.exp * 1000);

    const query = `
      INSERT INTO user_sessions 
      (user_id, token, refresh_token, token_hash, expires_at, refresh_token_family, is_active, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const conn = await db.getConnection();
    try {
      await conn.execute(query, [
        userId,
        accessToken,
        refreshToken,
        accessTokenHash,
        new Date(accessDecoded.exp * 1000),
        tokenFamily,
        1,
        null, // IP address - set from middleware if available
        null  // User agent - set from middleware if available
      ]);
    } finally {
      conn.release();
    }

    logger.info(`✓ Tokens issued for user: ${userId}`);

    return {
      accessToken,
      refreshToken,
      expiresAt,
      refreshExpiresAt
    };
  } catch (error) {
    logger.error(`✗ Token generation error: ${error.message}`);
    throw new Error(`Token generation failed: ${error.message}`);
  }
}

/**
 * Verify access token
 * @param {string} token - JWT access token
 * @returns {object|null} - Decoded token or null if invalid
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: [process.env.JWT_ALGORITHM || 'HS256']
    });
  } catch (error) {
    logger.warn(`⚠ Access token verification failed: ${error.message}`);
    return null;
  }
}

/**
 * Verify refresh token
 * @param {string} token - JWT refresh token
 * @returns {object|null} - Decoded token or null if invalid
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET, {
      algorithms: [process.env.JWT_ALGORITHM || 'HS256']
    });
  } catch (error) {
    logger.warn(`⚠ Refresh token verification failed: ${error.message}`);
    return null;
  }
}

/**
 * Refresh access token using refresh token
 * Implements token rotation: invalidates old refresh token and issues new pair
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<{accessToken, refreshToken, expiresAt}|null>}
 */
async function refreshAccessToken(refreshToken) {
  try {
    // Verify refresh token signature
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      logger.warn('⚠ Invalid refresh token signature');
      return null;
    }

    const { userId, username, family: tokenFamily } = decoded;

    // Check if refresh token exists in database and not revoked
    const query = `
      SELECT user_id, is_revoked, refresh_token_family
      FROM user_sessions
      WHERE refresh_token = ? AND is_revoked = 0 AND expires_at > NOW()
      LIMIT 1
    `;

    const conn = await db.getConnection();
    try {
      const [results] = await conn.execute(query, [refreshToken]);
      
      if (results.length === 0) {
        logger.warn(`⚠ Refresh token not found or revoked for user: ${userId}`);
        return null;
      }

      // Get user details
      const userQuery = 'SELECT username, email, role FROM users WHERE id = ? LIMIT 1';
      const [userResults] = await conn.execute(userQuery, [userId]);
      
      if (userResults.length === 0) {
        logger.warn(`⚠ User not found: ${userId}`);
        return null;
      }

      const user = userResults[0];

      // Revoke old refresh token (token rotation)
      const revokeQuery = `
        UPDATE user_sessions 
        SET is_revoked = 1, last_rotated_at = NOW()
        WHERE refresh_token = ?
      `;
      await conn.execute(revokeQuery, [refreshToken]);

      // Issue new token pair
      const newTokens = await issueTokens(userId, user.username, user.email, user.role);

      logger.info(`✓ Token rotated for user: ${userId}`);
      return newTokens;
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error(`✗ Token refresh error: ${error.message}`);
    return null;
  }
}

/**
 * Revoke a token by adding it to blacklist
 * @param {number} userId - User ID
 * @param {string} token - Token to revoke
 * @param {string} reason - Reason for revocation (logout, security_breach, etc)
 * @returns {Promise<boolean>}
 */
async function revokeToken(userId, token, reason = 'manual_logout') {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      logger.warn('⚠ Invalid token for revocation');
      return false;
    }

    const tokenHash = hashToken(token);
    const expiresAt = new Date(decoded.exp * 1000);

    const query = `
      INSERT INTO token_blacklist (token_hash, user_id, reason, expires_at)
      VALUES (?, ?, ?, ?)
    `;

    const conn = await db.getConnection();
    try {
      await conn.execute(query, [tokenHash, userId, reason, expiresAt]);
      
      // Also revoke the session
      const revokeSessionQuery = `
        UPDATE user_sessions 
        SET is_revoked = 1 
        WHERE user_id = ? AND token_hash = ?
      `;
      await conn.execute(revokeSessionQuery, [userId, tokenHash]);

      logger.info(`✓ Token revoked for user: ${userId}, reason: ${reason}`);
      return true;
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error(`✗ Token revocation error: ${error.message}`);
    return false;
  }
}

/**
 * Check if token is blacklisted
 * @param {string} token - Token to check
 * @returns {Promise<boolean>}
 */
async function isTokenBlacklisted(token) {
  try {
    const tokenHash = hashToken(token);
    const query = `
      SELECT id FROM token_blacklist 
      WHERE token_hash = ? AND expires_at > NOW()
      LIMIT 1
    `;

    const conn = await db.getConnection();
    try {
      const [results] = await conn.execute(query, [tokenHash]);
      return results.length > 0;
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error(`✗ Token blacklist check error: ${error.message}`);
    return false;
  }
}

/**
 * Clean up expired tokens from blacklist (maintenance task)
 * @returns {Promise<number>} - Number of records deleted
 */
async function cleanupExpiredTokens() {
  try {
    const query = 'DELETE FROM token_blacklist WHERE expires_at < NOW()';
    
    const conn = await db.getConnection();
    try {
      const [result] = await conn.execute(query);
      logger.info(`✓ Cleaned up ${result.affectedRows} expired tokens`);
      return result.affectedRows;
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error(`✗ Token cleanup error: ${error.message}`);
    return 0;
  }
}

/**
 * Clean up revoked sessions (maintenance task)
 * @returns {Promise<number>} - Number of records deleted
 */
async function cleanupRevokedSessions() {
  try {
    const query = 'DELETE FROM user_sessions WHERE is_revoked = 1 AND expires_at < NOW()';
    
    const conn = await db.getConnection();
    try {
      const [result] = await conn.execute(query);
      logger.info(`✓ Cleaned up ${result.affectedRows} revoked sessions`);
      return result.affectedRows;
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error(`✗ Session cleanup error: ${error.message}`);
    return 0;
  }
}

module.exports = {
  issueTokens,
  verifyAccessToken,
  verifyRefreshToken,
  refreshAccessToken,
  revokeToken,
  isTokenBlacklisted,
  cleanupExpiredTokens,
  cleanupRevokedSessions,
  hashToken,
  generateTokenFamily
};
