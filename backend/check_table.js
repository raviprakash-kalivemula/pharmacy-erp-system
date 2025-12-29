const db = require('./config/db');
require('dotenv').config();

async function checkTable() {
  const connection = await db.getConnection();
  try {
    const [columns] = await connection.query('DESCRIBE purchases');
    console.log('Current purchases table columns:');
    columns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''}`);
    });
  } finally {
    connection.release();
    process.exit(0);
  }
}

checkTable().catch(console.error);
