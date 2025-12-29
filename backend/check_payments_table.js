const db = require('./config/db');
require('dotenv').config();

async function checkSupplierPayments() {
  const connection = await db.getConnection();
  try {
    const [tables] = await connection.query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'pharmacy_erp' AND TABLE_NAME = 'supplier_payments'"
    );
    
    if (tables.length > 0) {
      console.log('✓ supplier_payments table already exists');
      const [columns] = await connection.query('DESCRIBE supplier_payments');
      console.log('\nColumns:');
      columns.forEach(col => {
        console.log(`- ${col.Field}: ${col.Type}`);
      });
    } else {
      console.log('✗ supplier_payments table does NOT exist - need to create it');
    }
  } finally {
    connection.release();
    process.exit(0);
  }
}

checkSupplierPayments().catch(console.error);
