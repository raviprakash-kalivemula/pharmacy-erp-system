/**
 * Thermal Printer Template (80mm)
 * 
 * This template defines the structure for thermal printer (ESC/POS)
 * Used for quick receipts and point-of-sale printing
 */

module.exports = {
  name: 'Thermal Receipt (80mm)',
  size: 'thermal',
  width: 80,
  margin: {
    left: 5,
    right: 5
  },
  header: {
    maxChars: 32,
    centerAlign: true,
    showShopName: true,
    showAddress: false,
    showPhone: false
  },
  itemTable: {
    maxChars: 32,
    format: 'compact', // Shows item, qty x rate = amount on single line
    columns: [
      { name: 'Item', width: 20 },
      { name: 'Qty', width: 4 },
      { name: 'Amt', width: 8 }
    ]
  },
  separator: '---',
  totals: {
    showSubtotal: false,
    showDiscount: true,
    showTax: false,
    showGrandTotal: true,
    showPaymentMode: true
  },
  footer: {
    showThankYou: true,
    showContact: false,
    textAlign: 'center'
  },
  features: {
    cutPaper: true,
    soundBeep: false,
    drawerKick: false
  }
};
