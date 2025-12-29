const express = require('express');
const router = express.Router();
const printService = require('../services/printService');
const pool = require('../config/db');
const logger = require('../utils/logger');

/**
 * POST /api/print/pdf
 * Generate and return PDF invoice
 */
router.post('/pdf', async (req, res) => {
  try {
    const { invoiceData, format = 'a4' } = req.body;

    if (!invoiceData || !invoiceData.invoice_no) {
      return res.status(400).json({
        success: false,
        error: 'Invoice data is required'
      });
    }

    // Generate PDF
    const pdfBuffer = await printService.generatePDF(invoiceData, format);

    if (!pdfBuffer) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate PDF'
      });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoiceData.invoice_no}.pdf"`);
    res.send(pdfBuffer);

    // Log operation
    logger.info(`PDF generated: ${invoiceData.invoice_no}`);
  } catch (error) {
    logger.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate PDF'
    });
  }
});

/**
 * POST /api/print/email
 * Send invoice via email
 */
router.post('/email', async (req, res) => {
  try {
    const { invoiceData, recipientEmail } = req.body;

    if (!invoiceData || !invoiceData.invoice_no) {
      return res.status(400).json({
        success: false,
        error: 'Invoice data is required'
      });
    }

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Valid email address is required'
      });
    }

    // Check if SMTP is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      logger.warn('SMTP not configured. Email sending disabled.');
      return res.status(503).json({
        success: false,
        error: 'Email service is not configured. Please contact administrator.',
        code: 'SMTP_NOT_CONFIGURED'
      });
    }

    // Get email config
    const emailConfig = {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      from: process.env.SMTP_FROM || process.env.SMTP_USER
    };

    // Send email
    const result = await printService.sendViaEmail(invoiceData, recipientEmail, emailConfig);

    if (result.success) {
      logger.info(`Invoice emailed: ${invoiceData.invoice_no} to ${recipientEmail}`);
      return res.json({
        success: true,
        message: `Invoice sent successfully to ${recipientEmail}`,
        messageId: result.messageId
      });
    } else {
      logger.error(`Failed to email invoice: ${invoiceData.invoice_no}`, result.error);
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send email',
        code: result.code
      });
    }
  } catch (error) {
    logger.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send email'
    });
  }
});

/**
 * POST /api/print/whatsapp
 * Send invoice via WhatsApp
 */
router.post('/whatsapp', async (req, res) => {
  try {
    const { invoiceData, phoneNumber } = req.body;

    if (!invoiceData || !invoiceData.invoice_no) {
      return res.status(400).json({
        success: false,
        error: 'Invoice data is required'
      });
    }

    if (!phoneNumber || phoneNumber.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Valid phone number is required (minimum 10 digits)'
      });
    }

    // Check if Twilio is configured
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER) {
      logger.warn('Twilio not configured. WhatsApp sending disabled.');
      return res.status(503).json({
        success: false,
        error: 'WhatsApp service is not configured. Please contact administrator.',
        code: 'TWILIO_NOT_CONFIGURED'
      });
    }

    // Get Twilio config
    const twilioConfig = {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_FROM_NUMBER
    };

    // Normalize phone number (basic validation)
    let normalizedPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits
    if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+91' + normalizedPhone.slice(-10); // Add India country code if not present
    }

    // Send WhatsApp message
    const result = await printService.sendViaWhatsApp(invoiceData, normalizedPhone, twilioConfig);

    if (result.success) {
      logger.info(`Invoice sent via WhatsApp: ${invoiceData.invoice_no} to ${normalizedPhone}`);
      return res.json({
        success: true,
        message: `Invoice sent successfully via WhatsApp to ${phoneNumber}`,
        messageId: result.messageId
      });
    } else {
      logger.error(`Failed to send WhatsApp: ${invoiceData.invoice_no}`, result.error);
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send WhatsApp message',
        code: result.code
      });
    }
  } catch (error) {
    logger.error('Error sending WhatsApp:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send WhatsApp message'
    });
  }
});

/**
 * POST /api/print/thermal
 * Generate thermal printer commands
 */
router.post('/thermal', async (req, res) => {
  try {
    const { invoiceData } = req.body;

    if (!invoiceData || !invoiceData.invoice_no) {
      return res.status(400).json({
        success: false,
        error: 'Invoice data is required'
      });
    }

    // Generate thermal commands
    const commands = printService.generateThermalCommands(invoiceData);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${invoiceData.invoice_no}-thermal.bin"`);
    res.send(commands);

    logger.info(`Thermal commands generated: ${invoiceData.invoice_no}`);
  } catch (error) {
    logger.error('Error generating thermal commands:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate thermal commands'
    });
  }
});

module.exports = router;
