const fs = require('fs');
const path = require('path');
require('dotenv').config();

const db = require('./config/db');

async function runMigration() {
  const connection = await db.getConnection();

  try {
    const migrationFile = path.join(__dirname, 'migrations/20251223_add_purchase_payments.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 70) + '...');
      await connection.query(statement);
    }

    console.log('✓ Migration completed successfully');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    throw error;
  } finally {
    connection.release();
    process.exit(0);
  }
}

runMigration().catch(error => {
  console.error(error);
  process.exit(1);
});
