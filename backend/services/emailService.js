/**
 * Email Service
 * Centralized email sending with retry logic, templates, and queue management
 * Extracted from printService for better separation of concerns
 */

const nodemailer = require('nodemailer');
const path = require('path');
const ejs = require('ejs');
const logger = require('../utils/logger');

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const EMAIL_RETRY_ATTEMPTS = parseInt(process.env.EMAIL_RETRY_ATTEMPTS || '3');
const EMAIL_RETRY_DELAY = parseInt(process.env.EMAIL_RETRY_DELAY || '1000');

// Initialize transporter
let transporter;

try {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
  
  logger.info('✓ Email service initialized');
} catch (error) {
  logger.error(`✗ Email service initialization failed: ${error.message}`);
}

/**
 * Email queue for storing failed emails for retry
 */
class EmailQueue {
  constructor() {
    this.queue = [];
  }

  add(emailData) {
    this.queue.push({ ...emailData, attempt: 1, addedAt: new Date() });
  }

  getAll() {
    return this.queue;
  }

  remove(emailData) {
    this.queue = this.queue.filter(item => item !== emailData);
  }

  processQueue() {
    const failedEmails = this.queue.filter(item => item.attempt < EMAIL_RETRY_ATTEMPTS);
    failedEmails.forEach(email => {
      setTimeout(() => sendEmail(email), email.attempt * EMAIL_RETRY_DELAY);
    });
  }
}

const emailQueue = new EmailQueue();

/**
 * Compile EJS template
 * @param {string} templateName - Template filename (without .ejs)
 * @param {object} data - Data for template
 * @returns {Promise<string>} - Compiled HTML
 */
async function compileTemplate(templateName, data) {
  try {
    const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.ejs`);
    const html = await ejs.renderFile(templatePath, data);
    return html;
  } catch (error) {
    logger.error(`✗ Template compilation error (${templateName}): ${error.message}`);
    throw error;
  }
}

/**
 * Send email with retry logic
 * @param {object} emailData - Email configuration
 * @param {string} emailData.to - Recipient email
 * @param {string} emailData.subject - Email subject
 * @param {string} emailData.template - Template name (without .ejs)
 * @param {object} emailData.data - Data for template
 * @param {string} [emailData.html] - Direct HTML (if not using template)
 * @param {string} [emailData.text] - Plain text alternative
 * @returns {Promise<boolean>}
 */
async function sendEmail(emailData) {
  try {
    if (!transporter) {
      logger.error('✗ Email service not initialized (missing SMTP credentials)');
      emailQueue.add(emailData);
      return false;
    }

    const { to, subject, template, data = {}, html: directHtml, text } = emailData;

    // Compile template if provided
    let html = directHtml;
    if (template && !directHtml) {
      html = await compileTemplate(template, data);
    }

    if (!html) {
      throw new Error('No email content provided (template or html)');
    }

    // Send email
    const result = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
      text: text || 'Please view this email in HTML format.'
    });

    logger.info(`✓ Email sent to ${to} (${subject})`);
    return true;
  } catch (error) {
    logger.error(`✗ Email send error: ${error.message}`);

    // Add to queue for retry if not already in queue
    if (emailData.attempt < EMAIL_RETRY_ATTEMPTS) {
      emailData.attempt = (emailData.attempt || 0) + 1;
      emailQueue.add(emailData);
      logger.info(`→ Email queued for retry (attempt ${emailData.attempt}/${EMAIL_RETRY_ATTEMPTS})`);
    } else {
      logger.error(`✗ Email max retries exceeded for ${emailData.to}`);
    }

    return false;
  }
}

/**
 * Send OTP email
 * @param {string} email - Recipient email
 * @param {string} otpCode - OTP code
 * @param {number} expiryMinutes - OTP expiry in minutes
 * @returns {Promise<boolean>}
 */
async function sendOTPEmail(email, otpCode, expiryMinutes = 10) {
  try {
    return await sendEmail({
      to: email,
      subject: 'Your OTP Verification Code',
      template: 'otp',
      data: {
        otpCode,
        expiryMinutes,
        appName: 'Sri Raghavendra Medical Pharmacy',
        timestamp: new Date().toLocaleString()
      }
    });
  } catch (error) {
    logger.error(`✗ OTP email error: ${error.message}`);
    return false;
  }
}

/**
 * Send welcome email to new user
 * @param {object} user - User object {email, full_name, username}
 * @returns {Promise<boolean>}
 */
async function sendWelcomeEmail(user) {
  try {
    return await sendEmail({
      to: user.email,
      subject: 'Welcome to Sri Raghavendra Medical Pharmacy',
      template: 'welcome',
      data: {
        fullName: user.full_name || user.username,
        appName: 'Sri Raghavendra Medical Pharmacy',
        appUrl: process.env.APP_URL || 'http://localhost:3000',
        supportEmail: 'support@pharmacy.local'
      }
    });
  } catch (error) {
    logger.error(`✗ Welcome email error: ${error.message}`);
    return false;
  }
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @param {string} resetToken - Password reset token
 * @param {number} expiryHours - Token expiry in hours
 * @returns {Promise<boolean>}
 */
async function sendPasswordResetEmail(email, resetToken, expiryHours = 24) {
  try {
    const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    return await sendEmail({
      to: email,
      subject: 'Password Reset Request',
      template: 'password-reset',
      data: {
        resetUrl,
        expiryHours,
        appName: 'Sri Raghavendra Medical Pharmacy',
        supportEmail: 'support@pharmacy.local',
        timestamp: new Date().toLocaleString()
      }
    });
  } catch (error) {
    logger.error(`✗ Password reset email error: ${error.message}`);
    return false;
  }
}

/**
 * Send invoice email (from printService)
 * @param {object} invoiceData - Invoice data
 * @param {string} recipientEmail - Recipient email
 * @returns {Promise<boolean>}
 */
async function sendInvoiceEmail(invoiceData, recipientEmail) {
  try {
    // For now, keep simple HTML
    const html = `
      <p>Dear ${invoiceData.customer_name},</p>
      <p>Please find your invoice attached below.</p>
      <p>Invoice #: ${invoiceData.invoice_no}</p>
      <p>Date: ${invoiceData.invoice_date}</p>
      <p>Amount: ${invoiceData.total_amount}</p>
      <p>Thank you for your business!</p>
    `;

    return await sendEmail({
      to: recipientEmail,
      subject: `Invoice #${invoiceData.invoice_no} from Sri Raghavendra Medical`,
      html,
      text: `Invoice ${invoiceData.invoice_no} - Amount: ${invoiceData.total_amount}`
    });
  } catch (error) {
    logger.error(`✗ Invoice email error: ${error.message}`);
    return false;
  }
}

/**
 * Get email queue status
 * @returns {object} - Queue statistics
 */
function getQueueStatus() {
  return {
    totalQueued: emailQueue.queue.length,
    details: emailQueue.queue.map(item => ({
      to: item.to,
      subject: item.subject,
      attempt: item.attempt,
      maxAttempts: EMAIL_RETRY_ATTEMPTS,
      addedAt: item.addedAt
    }))
  };
}

/**
 * Process email queue (call periodically via scheduler)
 * @returns {number} - Number of emails retried
 */
async function processEmailQueue() {
  const failedEmails = emailQueue.queue.filter(item => item.attempt < EMAIL_RETRY_ATTEMPTS);
  let processed = 0;

  for (const email of failedEmails) {
    try {
      const success = await sendEmail(email);
      if (success) {
        emailQueue.remove(email);
        processed++;
      }
    } catch (error) {
      logger.error(`✗ Queue processing error: ${error.message}`);
    }
  }

  if (processed > 0) {
    logger.info(`✓ Processed ${processed} queued emails`);
  }

  return processed;
}

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendInvoiceEmail,
  compileTemplate,
  getQueueStatus,
  processEmailQueue,
  emailQueue
};
