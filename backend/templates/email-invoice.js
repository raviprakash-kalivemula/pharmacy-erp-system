/**
 * Email Invoice Template
 * 
 * HTML template for sending invoices via email
 */

module.exports = {
  name: 'Email Invoice',
  format: 'html',
  
  generateHTML: (invoiceData) => {
    const subtotal = parseFloat(invoiceData.subtotal || 0).toFixed(2);
    const discount = parseFloat(invoiceData.discount || 0).toFixed(2);
    const tax = parseFloat(invoiceData.tax || 0).toFixed(2);
    const grandTotal = parseFloat(invoiceData.grand_total || 0).toFixed(2);

    const itemsHTML = invoiceData.items?.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.batch || 'N/A'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${parseFloat(item.rate).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${parseFloat(item.total).toFixed(2)}</td>
      </tr>
    `).join('') || '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .header h1 { margin: 0; color: #2c3e50; }
        .header p { margin: 5px 0; color: #7f8c8d; }
        .invoice-details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .invoice-details div { background: #f8f9fa; padding: 15px; border-radius: 5px; }
        .invoice-details label { font-weight: bold; color: #2c3e50; display: block; margin-bottom: 5px; }
        .invoice-details span { color: #555; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        table th { background-color: #3498db; color: white; padding: 12px; text-align: left; }
        table td { padding: 10px; }
        .totals { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; }
        .total-row.grand-total { border: none; font-size: 18px; font-weight: bold; color: #27ae60; padding: 15px 0; }
        .footer { text-align: center; color: #7f8c8d; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; }
        .payment-status { padding: 10px; background-color: #e8f5e9; color: #2e7d32; border-radius: 3px; margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${invoiceData.shop?.name || 'Pharmacy Invoice'}</h1>
          ${invoiceData.shop?.address ? `<p>${invoiceData.shop.address}</p>` : ''}
          ${invoiceData.shop?.phone ? `<p>Phone: ${invoiceData.shop.phone}</p>` : ''}
        </div>

        <div class="invoice-details">
          <div>
            <label>Invoice Number:</label>
            <span>${invoiceData.invoice_no}</span>
          </div>
          <div>
            <label>Date:</label>
            <span>${invoiceData.sale_date}</span>
          </div>
          <div>
            <label>Customer Name:</label>
            <span>${invoiceData.customer?.name || 'N/A'}</span>
          </div>
          <div>
            <label>Phone:</label>
            <span>${invoiceData.customer?.phone || 'N/A'}</span>
          </div>
          ${invoiceData.customer?.gst_number ? `
          <div>
            <label>GST Number:</label>
            <span>${invoiceData.customer.gst_number}</span>
          </div>
          ` : ''}
        </div>

        <h3>Invoice Details</h3>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Batch</th>
              <th>Quantity</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>₹${subtotal}</span>
          </div>
          ${parseFloat(discount) > 0 ? `
          <div class="total-row">
            <span>Discount:</span>
            <span>-₹${discount}</span>
          </div>
          ` : ''}
          ${parseFloat(tax) > 0 ? `
          <div class="total-row">
            <span>Tax:</span>
            <span>₹${tax}</span>
          </div>
          ` : ''}
          <div class="total-row grand-total">
            <span>Total Amount:</span>
            <span>₹${grandTotal}</span>
          </div>
        </div>

        <div class="payment-status">
          <strong>Payment Mode:</strong> ${invoiceData.payment_mode || 'N/A'}<br>
          <strong>Status:</strong> ${invoiceData.payment_status || 'Paid'}
        </div>

        <div class="footer">
          <p>Thank you for your purchase!</p>
          <p>This is an automatically generated invoice. For any queries, please contact us.</p>
          ${invoiceData.shop?.phone ? `<p>Support: ${invoiceData.shop.phone}</p>` : ''}
        </div>
      </div>
    </body>
    </html>
    `;
  }
};
