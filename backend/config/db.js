const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'R@vi1234',
  database: process.env.DB_NAME || 'pharmacy_erp',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Database Error:', err.message);
    console.error('⚠️  Check your .env file settings!');
  } else {
    console.log('✅ Database: Connected');
    connection.release();
  }
});

module.exports = pool.promise();