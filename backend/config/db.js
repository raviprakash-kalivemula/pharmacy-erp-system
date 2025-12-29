const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
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