// backend/services/printService.js
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PrintService {
  /**
   * Generate PDF invoice
   * @param {Object} invoiceData - Invoice data from transaction
   * @param {String} format - 'a4' or 'thermal'
   * @returns {Buffer} PDF buffer
   */
  static async generatePDF(invoiceData, format = 'a4') {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: format === 'thermal' ? [80, 203] : 'A4',
          margin: format === 'thermal' ? 5 : 20
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Header
        if (format === 'a4') {
          if (invoiceData.shop?.name) {
            doc.fontSize(20).font('Helvetica-Bold').text(invoiceData.shop.name, { align: 'center' });
          }
          if (invoiceData.shop?.address) {
            doc.fontSize(10).font('Helvetica').text(invoiceData.shop.address, { align: 'center' });
          }
          if (invoiceData.shop?.phone) {
            doc.text(`Phone: ${invoiceData.shop.phone}`, { align: 'center' });
          }
          doc.moveTo(20, doc.y).lineTo(575, doc.y).stroke();
        } else {
          // Thermal format
          if (invoiceData.shop?.name) {
            doc.fontSize(10).font('Helvetica-Bold').text(invoiceData.shop.name, { align: 'center' });
          }
          doc.fontSize(7).text('---', { align: 'center' });
        }

        // Invoice number and date
        doc.fontSize(format === 'thermal' ? 8 : 12).font('Helvetica-Bold');
        doc.text(`Invoice: ${invoiceData.invoice_no}`);
        doc.text(`Date: ${invoiceData.sale_date}`);
        
        // Customer details
        if (format === 'a4') {
          doc.fontSize(10).text('Customer Details:', { underline: true });
          doc.fontSize(9).font('Helvetica');
          doc.text(`Name: ${invoiceData.customer?.name || 'N/A'}`);
          if (invoiceData.customer?.phone) doc.text(`Phone: ${invoiceData.customer.phone}`);
          if (invoiceData.customer?.gst_number) doc.text(`GST: ${invoiceData.customer.gst_number}`);
        } else {
          doc.fontSize(7).text(`Cust: ${invoiceData.customer?.name || 'N/A'}`);
        }

        // Items table
        doc.fontSize(format === 'thermal' ? 7 : 9).font('Helvetica-Bold');
        
        if (format === 'a4') {
          const tableTop = doc.y + 10;
          const col1 = 20, col2 = 250, col3 = 350, col4 = 450, col5 = 530;
          
          doc.moveTo(col1, tableTop).lineTo(575, tableTop).stroke();
          doc.text('Item', col1, tableTop + 5);
          doc.text('Qty', col2, tableTop + 5);
          doc.text('Rate', col3, tableTop + 5);
          doc.text('Amount', col4, tableTop + 5);
          doc.moveTo(col1, tableTop + 20).lineTo(575, tableTop + 20).stroke();

          let itemTop = tableTop + 25;
          doc.fontSize(9).font('Helvetica');
          
          invoiceData.items?.forEach(item => {
            const itemName = `${item.name} ${item.batch ? `(${item.batch})` : ''}`;
            doc.text(itemName, col1, itemTop, { width: col2 - col1 - 5 });
            doc.text(item.quantity, col2, itemTop);
            doc.text(parseFloat(item.rate).toFixed(2), col3, itemTop);
            doc.text(parseFloat(item.total).toFixed(2), col4, itemTop);
            itemTop += 20;
          });

          doc.moveTo(col1, itemTop).lineTo(575, itemTop).stroke();
        } else {
          // Thermal format
          doc.fontSize(7).text('Items:');
          invoiceData.items?.forEach(item => {
            doc.text(`${item.name} x${item.quantity}`, 5);
            doc.text(`₹${parseFloat(item.rate).toFixed(2)} = ₹${parseFloat(item.total).toFixed(2)}`, 5);
          });
          doc.text('---');
        }

        // Totals
        const startY = doc.y + 5;
        doc.fontSize(format === 'thermal' ? 8 : 10).font('Helvetica-Bold');
        
        if (format === 'a4') {
          doc.text(`Subtotal: ₹${parseFloat(invoiceData.subtotal).toFixed(2)}`, 450, startY);
          if (invoiceData.discount && parseFloat(invoiceData.discount) > 0) {
            doc.text(`Discount: ₹${parseFloat(invoiceData.discount).toFixed(2)}`, 450, startY + 15);
          }
          doc.text(`Tax: ₹${parseFloat(invoiceData.tax).toFixed(2)}`, 450, startY + 30);
          doc.fontSize(12).text(`Total: ₹${parseFloat(invoiceData.grand_total).toFixed(2)}`, 450, startY + 45);
        } else {
          doc.text(`Total: ₹${parseFloat(invoiceData.grand_total).toFixed(2)}`);
        }

        // Payment info
        doc.fontSize(format === 'thermal' ? 7 : 9).font('Helvetica');
        doc.text(`\nPayment: ${invoiceData.payment_mode || 'N/A'}`);
        doc.text(`Status: ${invoiceData.payment_status || 'N/A'}`);

        // Footer
        if (format === 'a4') {
          doc.moveTo(20, doc.y + 20).lineTo(575, doc.y + 20).stroke();
          doc.fontSize(8).text('Thank you for your purchase!', { align: 'center' });
          if (invoiceData.shop?.phone) {
            doc.text(`For support: ${invoiceData.shop.phone}`, { align: 'center' });
          }
        } else {
          doc.fontSize(7).text('Thank you!', { align: 'center' });
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send invoice via email
   * @param {Object} invoiceData - Invoice data
   * @param {String} recipientEmail - Email address
   * @param {Object} emailConfig - Email configuration (from env)
   * @returns {Object} Send result
   */
  static async sendViaEmail(invoiceData, recipientEmail, emailConfig = {}) {
    try {
      // Check if SMTP configuration exists
      if (!emailConfig.user || !emailConfig.pass || !emailConfig.service) {
        return {
          success: false,
          error: 'Email configuration not found. Please configure SMTP in settings.',
          code: 'CONFIG_MISSING'
        };
      }

      // Create transporter
      const transporter = nodemailer.createTransport({
        service: emailConfig.service || 'gmail',
        host: emailConfig.host,
        port: emailConfig.port || 587,
        secure: emailConfig.secure || false,
        auth: {
          user: emailConfig.user,
          pass: emailConfig.pass
        }
      });

      // Generate PDF
      const pdfBuffer = await this.generatePDF(invoiceData, 'a4');

      // Prepare email
      const mailOptions = {
        from: emailConfig.fromEmail || emailConfig.user,
        to: recipientEmail,
        subject: `Invoice ${invoiceData.invoice_no} - ${invoiceData.shop?.name || 'Pharmacy'}`,
        html: `
          <h2>Invoice ${invoiceData.invoice_no}</h2>
          <p>Dear ${invoiceData.customer?.name || 'Customer'},</p>
          <p>Please find your invoice attached.</p>
          <p>Total Amount: ₹${parseFloat(invoiceData.grand_total).toFixed(2)}</p>
          <p>Thank you for your purchase!</p>
          <p>${invoiceData.shop?.name || 'Pharmacy'}</p>
        `,
        attachments: [
          {
            filename: `${invoiceData.invoice_no}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      };

      // Send email
      const result = await transporter.sendMail(mailOptions);
      
      return {
        success: true,
        message: `Invoice sent to ${recipientEmail}`,
        messageId: result.messageId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'EMAIL_ERROR'
      };
    }
  }

  /**
   * Send invoice via WhatsApp
   * @param {Object} invoiceData - Invoice data
   * @param {String} phoneNumber - WhatsApp number
   * @param {Object} twilio - Twilio client (from backend)
   * @returns {Object} Send result
   */
  static async sendViaWhatsApp(invoiceData, phoneNumber, twilio = null) {
    try {
      if (!twilio) {
        return {
          success: false,
          error: 'WhatsApp integration not configured. Please configure Twilio in settings.',
          code: 'CONFIG_MISSING'
        };
      }

      // Format message
      const message = `
Hello ${invoiceData.customer?.name || 'Customer'},

Your invoice is ready!

Invoice: ${invoiceData.invoice_no}
Date: ${invoiceData.sale_date}
Total: ₹${parseFloat(invoiceData.grand_total).toFixed(2)}

Items: ${invoiceData.items?.length || 0}

Thank you for your purchase from ${invoiceData.shop?.name || 'our pharmacy'}!
      `.trim();

      // Send via WhatsApp
      const result = await twilio.messages.create({
        from: `whatsapp:+14155552671`, // Twilio sandbox number (should be from env)
        to: `whatsapp:${phoneNumber}`,
        body: message
      });

      return {
        success: true,
        message: `Invoice sent to ${phoneNumber}`,
        messageId: result.sid
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'WHATSAPP_ERROR'
      };
    }
  }

  /**
   * Generate thermal printer format (ESC/POS)
   * @param {Object} invoiceData - Invoice data
   * @returns {Buffer} Printer commands buffer
   */
  static generateThermalCommands(invoiceData) {
    // ESC/POS commands for thermal printer
    const ESC = '\x1B';
    const GS = '\x1D';
    
    let commands = '';
    
    // Initialize printer
    commands += ESC + '@';
    
    // Set alignment to center
    commands += ESC + 'a' + '\x01';
    
    // Print shop name
    if (invoiceData.shop?.name) {
      commands += ESC + 'E' + '\x01'; // Bold on
      commands += invoiceData.shop.name + '\n';
      commands += ESC + 'E' + '\x00'; // Bold off
    }
    
    // Invoice info
    commands += 'Invoice: ' + invoiceData.invoice_no + '\n';
    commands += invoiceData.sale_date + '\n';
    
    // Set alignment to left
    commands += ESC + 'a' + '\x00';
    
    // Items
    commands += '---\n';
    invoiceData.items?.forEach(item => {
      commands += item.name.substring(0, 30) + '\n';
      commands += `Qty:${item.quantity} x ₹${parseFloat(item.rate).toFixed(2)}\n`;
      commands += `Amount: ₹${parseFloat(item.total).toFixed(2)}\n`;
    });
    
    // Totals
    commands += '---\n';
    commands += `Total: ₹${parseFloat(invoiceData.grand_total).toFixed(2)}\n`;
    commands += 'Payment: ' + invoiceData.payment_mode + '\n';
    
    // Set alignment to center
    commands += ESC + 'a' + '\x01';
    commands += 'Thank you!\n';
    
    // Cut paper
    commands += GS + 'V' + '\x00';
    
    return Buffer.from(commands);
  }
}

module.exports = PrintService;
