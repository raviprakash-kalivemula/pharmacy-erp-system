/**
 * Data Export Service
 * Exports data to CSV, PDF, and Excel formats
 */

const pool = require('../config/db');
const logger = require('../utils/logger');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { Readable } = require('stream');

class ExportService {
  /**
   * Export medicines to CSV
   */
  static async exportMedicinesCSV() {
    try {
      const [medicines] = await pool.query(`
        SELECT 
          id,
          name,
          quantity_in_stock,
          price,
          margin_percentage,
          expiry_date,
          generic_name,
          manufacturer,
          batch_number
        FROM medicines
        ORDER BY name
      `);

      return this.convertToCSV(medicines, [
        'ID',
        'Medicine Name',
        'Generic Name',
        'Manufacturer',
        'Stock',
        'Price',
        'Margin %',
        'Batch',
        'Expiry Date'
      ]);
    } catch (error) {
      logger.error(`Export medicines CSV error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export medicines to Excel
   */
  static async exportMedicinesExcel() {
    try {
      const [medicines] = await pool.query(`
        SELECT 
          id,
          name,
          quantity_in_stock,
          price,
          margin_percentage,
          expiry_date,
          generic_name,
          manufacturer,
          batch_number,
          created_at
        FROM medicines
        ORDER BY name
      `);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Medicines');

      // Headers
      worksheet.columns = [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Generic Name', key: 'generic_name', width: 20 },
        { header: 'Manufacturer', key: 'manufacturer', width: 20 },
        { header: 'Stock', key: 'quantity_in_stock', width: 10 },
        { header: 'Price', key: 'price', width: 12 },
        { header: 'Margin %', key: 'margin_percentage', width: 10 },
        { header: 'Batch', key: 'batch_number', width: 15 },
        { header: 'Expiry Date', key: 'expiry_date', width: 12 }
      ];

      // Add data
      medicines.forEach(med => {
        worksheet.addRow({
          id: med.id,
          name: med.name,
          generic_name: med.generic_name,
          manufacturer: med.manufacturer,
          quantity_in_stock: med.quantity_in_stock,
          price: med.price,
          margin_percentage: med.margin_percentage,
          batch_number: med.batch_number,
          expiry_date: med.expiry_date ? med.expiry_date.toISOString().split('T')[0] : ''
        });
      });

      // Style headers
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF366092' }
      };

      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
    } catch (error) {
      logger.error(`Export medicines Excel error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export customers to CSV
   */
  static async exportCustomersCSV() {
    try {
      const [customers] = await pool.query(`
        SELECT 
          id,
          name,
          phone,
          email,
          address,
          city,
          state,
          pincode,
          loyalty_points,
          created_at
        FROM customers
        ORDER BY name
      `);

      return this.convertToCSV(customers, [
        'ID',
        'Name',
        'Phone',
        'Email',
        'Address',
        'City',
        'State',
        'Pincode',
        'Loyalty Points',
        'Join Date'
      ]);
    } catch (error) {
      logger.error(`Export customers CSV error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export sales transactions for date range
   */
  static async exportSalesCSV(startDate, endDate) {
    try {
      const [sales] = await pool.query(`
        SELECT 
          t.id,
          t.transaction_number,
          c.name as customer_name,
          t.total_amount,
          t.discount_amount,
          t.final_amount,
          t.payment_method,
          t.payment_status,
          t.created_at
        FROM transactions t
        LEFT JOIN customers c ON t.customer_id = c.id
        WHERE t.transaction_type = 'sale'
          AND t.created_at >= ?
          AND t.created_at <= ?
        ORDER BY t.created_at DESC
      `, [startDate, endDate]);

      return this.convertToCSV(sales, [
        'ID',
        'Transaction #',
        'Customer',
        'Amount',
        'Discount',
        'Final Amount',
        'Payment Method',
        'Status',
        'Date'
      ]);
    } catch (error) {
      logger.error(`Export sales CSV error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export inventory report to Excel
   */
  static async exportInventoryExcel() {
    try {
      const [medicines] = await pool.query(`
        SELECT 
          name,
          quantity_in_stock,
          price,
          (quantity_in_stock * price) as stock_value,
          expiry_date,
          CASE 
            WHEN quantity_in_stock = 0 THEN 'Out of Stock'
            WHEN quantity_in_stock < 10 THEN 'Low Stock'
            ELSE 'Healthy'
          END as status
        FROM medicines
        ORDER BY status, quantity_in_stock ASC
      `);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Inventory');

      worksheet.columns = [
        { header: 'Medicine Name', key: 'name', width: 30 },
        { header: 'Quantity', key: 'quantity_in_stock', width: 12 },
        { header: 'Unit Price', key: 'price', width: 12 },
        { header: 'Stock Value', key: 'stock_value', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Expiry Date', key: 'expiry_date', width: 12 }
      ];

      medicines.forEach(med => {
        const row = worksheet.addRow({
          name: med.name,
          quantity_in_stock: med.quantity_in_stock,
          price: med.price,
          stock_value: med.stock_value,
          status: med.status,
          expiry_date: med.expiry_date ? med.expiry_date.toISOString().split('T')[0] : ''
        });

        // Color code status
        if (med.status === 'Out of Stock') {
          row.cells[4].fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
        } else if (med.status === 'Low Stock') {
          row.cells[4].fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
        } else {
          row.cells[4].fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B050' } };
        }
      });

      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF366092' }
      };

      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
    } catch (error) {
      logger.error(`Export inventory Excel error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export analytics report to PDF
   */
  static async exportAnalyticsPDF(analyticsData) {
    try {
      const doc = new PDFDocument({ margin: 50 });

      // Title
      doc.fontSize(20).font('Helvetica-Bold').text('Pharmacy Analytics Report', { align: 'center' });
      doc.fontSize(10).fillColor('gray').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown();

      // KPIs Section
      if (analyticsData.metrics) {
        doc.fontSize(14).font('Helvetica-Bold').fillColor('black').text('Key Performance Indicators');
        
        const metrics = [
          { label: "Today's Sales", value: `₹${analyticsData.metrics.todaySales?.toFixed(2) || '0'}` },
          { label: 'Monthly Revenue', value: `₹${analyticsData.metrics.monthlyRevenue?.toFixed(2) || '0'}` },
          { label: 'Stock Value', value: `₹${analyticsData.metrics.stockValue?.toFixed(2) || '0'}` }
        ];

        metrics.forEach(m => {
          doc.fontSize(11).text(`${m.label}: ${m.value}`);
        });
        
        doc.moveDown();
      }

      // Sales Trends Section
      if (analyticsData.salesTrends && analyticsData.salesTrends.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').text('Sales Trends (Last 30 Days)');
        
        const data = [['Date', 'Sales', 'Paid', 'Pending']];
        analyticsData.salesTrends.slice(0, 10).forEach(trend => {
          data.push([
            trend.date.split('T')[0],
            `₹${trend.dailySales?.toFixed(2) || '0'}`,
            `₹${trend.paid?.toFixed(2) || '0'}`,
            `₹${trend.pending?.toFixed(2) || '0'}`
          ]);
        });

        this.drawTable(doc, data);
        doc.moveDown();
      }

      // P&L Section
      if (analyticsData.profitLoss && analyticsData.profitLoss.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').text('Profit & Loss Statement');
        
        const data = [['Month', 'Revenue', 'COGS', 'Expenses', 'Profit', 'Margin %']];
        analyticsData.profitLoss.slice(0, 12).forEach(pnl => {
          data.push([
            pnl.month,
            `₹${pnl.revenue?.toFixed(2) || '0'}`,
            `₹${pnl.cogs?.toFixed(2) || '0'}`,
            `₹${pnl.expenses?.toFixed(2) || '0'}`,
            `₹${pnl.profit?.toFixed(2) || '0'}`,
            `${pnl.profitMargin?.toFixed(2) || '0'}%`
          ]);
        });

        this.drawTable(doc, data);
      }

      return doc;
    } catch (error) {
      logger.error(`Export analytics PDF error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper: Convert data to CSV
   */
  static convertToCSV(data, headers) {
    if (!data || data.length === 0) {
      return headers.join(',') + '\n';
    }

    const keys = Object.keys(data[0]);
    const rows = data.map(row => {
      return keys.map(key => {
        const value = row[key];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Helper: Draw table in PDF
   */
  static drawTable(doc, data) {
    const cellHeight = 20;
    const cellWidth = 100;
    const y = doc.y;
    const x = doc.x;

    data.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        doc.rect(x + colIndex * cellWidth, y + rowIndex * cellHeight, cellWidth, cellHeight).stroke();
        doc.fontSize(10)
          .text(cell, x + colIndex * cellWidth + 5, y + rowIndex * cellHeight + 5, {
            width: cellWidth - 10,
            height: cellHeight - 10,
            align: 'left'
          });
      });
    });

    doc.moveDown(data.length + 1);
  }
}

module.exports = ExportService;
