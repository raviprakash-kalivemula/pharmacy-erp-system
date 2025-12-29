const fs = require('fs');
const path = require('path');

// Change to backend directory to access node_modules
process.chdir(path.join(__dirname, 'backend'));
require('dotenv').config();

const db = require('./config/db');

const migrationFile = path.join(__dirname, 'backend/migrations/20251223_add_purchase_payments.sql');

async function runMigration() {
  const connection = await db.getConnection();

  try {
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 50) + '...');
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
