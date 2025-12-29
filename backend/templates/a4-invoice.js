/**
 * A4 Invoice Template
 * 
 * This template defines the structure for A4 size invoices
 * Used for formal billing and record-keeping
 */

module.exports = {
  name: 'A4 Invoice',
  size: 'a4',
  margin: {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20
  },
  header: {
    shopNameFontSize: 20,
    shopAddressFontSize: 10,
    showLogo: false
  },
  itemTable: {
    columns: [
      { name: 'Item', width: 230 },
      { name: 'Batch', width: 100 },
      { name: 'Qty', width: 60 },
      { name: 'Rate', width: 80 },
      { name: 'Amount', width: 85 }
    ],
    itemNameFontSize: 9
  },
  totals: {
    showSubtotal: true,
    showDiscount: true,
    showTax: true,
    showGrandTotal: true,
    showPaymentMode: true,
    grandTotalFontSize: 14
  },
  footer: {
    showThankYou: true,
    showContact: true,
    showSignature: false
  }
};
