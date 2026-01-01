/**
 * OTP Service
 * Handles OTP generation, validation, email sending, and expiry management
 * Supports multiple OTP types: login, signup, password_reset, email_verification
 */

const crypto = require('crypto');
const db = require('../config/db');
const emailService = require('./emailService');
const logger = require('../utils/logger');

const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || '6');
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '10');
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5');

/**
 * Generate random OTP code
 * @param {number} length - Length of OTP (default 6)
 * @returns {string} - OTP code
 */
function generateOTP(length = OTP_LENGTH) {
  return Math.random()
    .toString()
    .slice(2, 2 + length)
    .padStart(length, '0');
}

/**
 * Create OTP record in database
 * @param {string} email - Email address
 * @param {number} userId - User ID (optional, for existing users)
 * @param {string} otpCode - OTP code
 * @param {string} otpType - OTP type (login, signup, password_reset, email_verification)
 * @param {number} expiryMinutes - Expiry time in minutes
 * @returns {Promise<{id, otp_code, expires_at}>}
 */
async function createOTPRecord(email, userId, otpCode, otpType, expiryMinutes = OTP_EXPIRY_MINUTES) {
  try {
    // Invalidate previous OTPs for same email/type
    const invalidateQuery = `
      UPDATE otp_codes 
      SET is_used = 1 
      WHERE email = ? AND otp_type = ? AND is_used = 0 AND expires_at > NOW()
    `;

    let conn = await db.getConnection();
    try {
      await conn.execute(invalidateQuery, [email, otpType]);
    } finally {
      conn.release();
    }

    // Create new OTP record
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiryMinutes);

    const insertQuery = `
      INSERT INTO otp_codes (email, user_id, otp_code, otp_type, is_used, expires_at, created_at)
      VALUES (?, ?, ?, ?, 0, ?, NOW())
    `;

    conn = await db.getConnection();
    try {
      const [result] = await conn.execute(insertQuery, [email, userId || null, otpCode, otpType, expiresAt]);
      
      logger.info(`✓ OTP created for ${email} (type: ${otpType})`);

      return {
        id: result.insertId,
        otp_code: otpCode,
        expires_at: expiresAt
      };
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error(`✗ OTP creation error: ${error.message}`);
    throw error;
  }
}

/**
 * Send OTP via email
 * @param {string} email - Recipient email
 * @param {string} userId - User ID (optional)
 * @param {string} otpType - OTP type
 * @returns {Promise<{success, otpCode, expiresAt}>}
 */
async function sendOTPViaEmail(email, userId = null, otpType = 'login') {
  try {
    // Generate OTP
    const otpCode = generateOTP();

    // Create OTP record
    const otpRecord = await createOTPRecord(email, userId, otpCode, otpType);

    // Send email
    const emailSent = await emailService.sendOTPEmail(email, otpCode, OTP_EXPIRY_MINUTES);

    if (!emailSent) {
      logger.warn(`⚠ OTP email failed for ${email}, but OTP created in DB`);
      // Still return success as OTP is in DB for manual entry
    }

    logger.info(`✓ OTP sent to ${email}`);

    return {
      success: true,
      message: `OTP sent to ${email}`,
      expiresAt: otpRecord.expires_at
    };
  } catch (error) {
    logger.error(`✗ OTP email send error: ${error.message}`);
    throw error;
  }
}

/**
 * Validate OTP code
 * @param {string} email - Email address
 * @param {string} otpCode - OTP code to verify
 * @param {string} otpType - OTP type
 * @returns {Promise<{valid, otpId, userId, message}>}
 */
async function validateOTP(email, otpCode, otpType = 'login') {
  try {
    const query = `
      SELECT id, user_id, otp_code, is_used, attempt_count, expires_at
      FROM otp_codes
      WHERE email = ? AND otp_type = ? AND is_used = 0
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const conn = await db.getConnection();
    try {
      const [results] = await conn.execute(query, [email, otpType]);

      // OTP not found
      if (results.length === 0) {
        logger.warn(`⚠ OTP not found for ${email}`);
        return { valid: false, message: 'OTP not found or already used' };
      }

      const otp = results[0];

      // Check if OTP has expired
      if (new Date() > new Date(otp.expires_at)) {
        logger.warn(`⚠ OTP expired for ${email}`);
        return { valid: false, message: 'OTP has expired. Please request a new one.' };
      }

      // Check max attempts
      if (otp.attempt_count >= OTP_MAX_ATTEMPTS) {
        logger.warn(`⚠ OTP max attempts exceeded for ${email}`);
        
        // Mark as used to prevent further attempts
        const markQuery = 'UPDATE otp_codes SET is_used = 1 WHERE id = ?';
        await conn.execute(markQuery, [otp.id]);

        return { valid: false, message: 'Too many attempts. Please request a new OTP.' };
      }

      // Validate OTP code
      if (otp.otp_code !== otpCode.trim()) {
        logger.warn(`⚠ Invalid OTP code for ${email}`);

        // Increment attempt count
        const updateQuery = 'UPDATE otp_codes SET attempt_count = attempt_count + 1 WHERE id = ?';
        await conn.execute(updateQuery, [otp.id]);

        const remainingAttempts = OTP_MAX_ATTEMPTS - otp.attempt_count - 1;
        return { 
          valid: false, 
          message: `Invalid OTP. ${remainingAttempts} attempts remaining.`,
          remainingAttempts
        };
      }

      // OTP is valid!
      logger.info(`✓ OTP validated for ${email}`);

      return {
        valid: true,
        otpId: otp.id,
        userId: otp.user_id,
        message: 'OTP verified successfully'
      };
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error(`✗ OTP validation error: ${error.message}`);
    throw error;
  }
}

/**
 * Mark OTP as used after successful validation
 * @param {number} otpId - OTP ID
 * @returns {Promise<boolean>}
 */
async function markOTPAsUsed(otpId) {
  try {
    const query = `
      UPDATE otp_codes 
      SET is_used = 1, used_at = NOW()
      WHERE id = ?
    `;

    const conn = await db.getConnection();
    try {
      await conn.execute(query, [otpId]);
      return true;
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error(`✗ Mark OTP as used error: ${error.message}`);
    return false;
  }
}

/**
 * Check OTP request rate limit (prevent spam)
 * @param {string} email - Email address
 * @param {string} otpType - OTP type
 * @param {number} maxRequestsPerHour - Max requests per hour (default 5)
 * @returns {Promise<{allowed, remainingRequests, retryAfterMinutes}>}
 */
async function checkOTPRateLimit(email, otpType = 'login', maxRequestsPerHour = 5) {
  try {
    const query = `
      SELECT COUNT(*) as count 
      FROM otp_codes
      WHERE email = ? AND otp_type = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `;

    const conn = await db.getConnection();
    try {
      const [results] = await conn.execute(query, [email, otpType]);
      const count = results[0].count;

      if (count >= maxRequestsPerHour) {
        logger.warn(`⚠ OTP rate limit exceeded for ${email}`);
        return {
          allowed: false,
          message: 'Too many OTP requests. Please try again later.',
          remainingRequests: 0,
          retryAfterMinutes: 60 - new Date().getMinutes()
        };
      }

      return {
        allowed: true,
        remainingRequests: maxRequestsPerHour - count
      };
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error(`✗ Rate limit check error: ${error.message}`);
    // Allow if check fails (fail open)
    return { allowed: true, message: 'Rate limit check unavailable' };
  }
}

/**
 * Clean up expired and used OTPs (maintenance task)
 * Run periodically (e.g., via cron job)
 * @returns {Promise<number>} - Number of records deleted
 */
async function cleanupExpiredOTPs() {
  try {
    const query = `
      DELETE FROM otp_codes 
      WHERE (is_used = 1 AND used_at < DATE_SUB(NOW(), INTERVAL 24 HOUR))
         OR (is_used = 0 AND expires_at < NOW())
    `;

    const conn = await db.getConnection();
    try {
      const [result] = await conn.execute(query);
      logger.info(`✓ Cleaned up ${result.affectedRows} expired OTPs`);
      return result.affectedRows;
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error(`✗ OTP cleanup error: ${error.message}`);
    return 0;
  }
}

/**
 * Get OTP statistics (for monitoring)
 * @returns {Promise<object>}
 */
async function getOTPStatistics() {
  try {
    const query = `
      SELECT 
        otp_type,
        COUNT(*) as total,
        SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used,
        SUM(CASE WHEN is_used = 0 AND expires_at > NOW() THEN 1 ELSE 0 END) as valid,
        SUM(CASE WHEN is_used = 0 AND expires_at < NOW() THEN 1 ELSE 0 END) as expired
      FROM otp_codes
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY otp_type
    `;

    const conn = await db.getConnection();
    try {
      const [results] = await conn.execute(query);
      return results;
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error(`✗ Get statistics error: ${error.message}`);
    return [];
  }
}

module.exports = {
  generateOTP,
  createOTPRecord,
  sendOTPViaEmail,
  validateOTP,
  markOTPAsUsed,
  checkOTPRateLimit,
  cleanupExpiredOTPs,
  getOTPStatistics,
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS
};
