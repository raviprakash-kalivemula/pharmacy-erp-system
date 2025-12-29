/**
 * WhatsApp Message Template
 * 
 * Template for sending invoice summaries via WhatsApp
 */

module.exports = {
  name: 'WhatsApp Invoice',
  format: 'text',
  
  generateMessage: (invoiceData) => {
    const itemsList = invoiceData.items?.map((item, index) => 
      `${index + 1}. ${item.name} (${item.batch || 'Batch N/A'})\n   Qty: ${item.quantity} x ₹${parseFloat(item.rate).toFixed(2)} = ₹${parseFloat(item.total).toFixed(2)}`
    ).join('\n') || '';

    return `
Hello ${invoiceData.customer?.name || 'Customer'},

Your invoice from ${invoiceData.shop?.name || 'our pharmacy'} is ready! 

📋 *Invoice Details*
Invoice #: ${invoiceData.invoice_no}
Date: ${invoiceData.sale_date}

🛒 *Items*
${itemsList}

💰 *Bill Summary*
Subtotal: ₹${parseFloat(invoiceData.subtotal || 0).toFixed(2)}
${parseFloat(invoiceData.discount || 0) > 0 ? `Discount: -₹${parseFloat(invoiceData.discount).toFixed(2)}\n` : ''}Tax: ₹${parseFloat(invoiceData.tax || 0).toFixed(2)}
*Total: ₹${parseFloat(invoiceData.grand_total || 0).toFixed(2)}*

Payment Method: ${invoiceData.payment_mode || 'Not specified'}
Status: ${invoiceData.payment_status || 'Paid'}

Thank you for choosing us! 🙏
For support, contact: ${invoiceData.shop?.phone || 'N/A'}
    `.trim();
  },

  generateFileMessage: (invoiceData) => {
    // Message to send with PDF attachment
    return `📄 Your Invoice ${invoiceData.invoice_no} is attached.\n\nTotal: ₹${parseFloat(invoiceData.grand_total || 0).toFixed(2)}\n\nThank you!`;
  }
};
