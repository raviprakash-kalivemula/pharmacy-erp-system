/**
 * Database Migrations for Phase 2C Advanced Features
 * Adds: Users table with roles, Audit logs, Backups, Settings
 */

const pool = require('./db');
const logger = require('../utils/logger');

const migrations = [
  {
    name: 'Create users table',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'pharmacist', 'viewer') DEFAULT 'viewer',
        is_active BOOLEAN DEFAULT true,
        last_login DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_role (role),
        INDEX idx_is_active (is_active)
      );
    `
  },
  {
    name: 'Create audit_logs table',
    sql: `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT,
        username VARCHAR(100) NOT NULL,
        user_role VARCHAR(50),
        action VARCHAR(50) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        resource_id INT,
        old_values LONGTEXT,
        new_values LONGTEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        status VARCHAR(20) DEFAULT 'success',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_resource_type (resource_type),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `
  },
  {
    name: 'Create backups table',
    sql: `
      CREATE TABLE IF NOT EXISTS backups (
        id INT PRIMARY KEY AUTO_INCREMENT,
        filename VARCHAR(255) NOT NULL,
        filepath VARCHAR(500) NOT NULL,
        size BIGINT,
        description TEXT,
        last_restored_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at)
      );
    `
  },
  {
    name: 'Create settings table',
    sql: `
      CREATE TABLE IF NOT EXISTS settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value LONGTEXT,
        data_type VARCHAR(20),
        description TEXT,
        updated_by INT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      );
    `
  }
];

/**
 * Run all migrations
 */
async function runMigrations() {
  try {
    console.log('🔄 Starting database migrations...');

    for (const migration of migrations) {
      try {
        await pool.query(migration.sql);
        console.log(`✅ Migration complete: ${migration.name}`);
      } catch (error) {
        // Table already exists, column already exists, or duplicate column - safe to continue
        if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column')) {
          console.log(`⏭️  Skipped: ${migration.name} (already exists)`);
        } else {
          console.error(`❌ Migration failed: ${migration.name}`);
          console.error(error.message);
          throw error;
        }
      }
    }

    // Insert default admin user if doesn't exist
    try {
      const [users] = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = "admin"');
      
      if (users[0].count === 0) {
        // Using bcrypt hash of "admin123" for demo
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        await pool.query(
          'INSERT INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
          ['admin', 'admin@pharmacy.local', hashedPassword, 'admin', true]
        );
        
        console.log('✅ Default admin user created (username: admin, password: admin123)');
      }
    } catch (error) {
      console.warn('⚠️  Could not create default admin user:', error.message);
    }

    // Insert default settings if not exist
    try {
      const defaultSettings = [
        {
          key: 'app_name',
          value: 'Sri Raghavendra Medical',
          type: 'string',
          description: 'Application name'
        },
        {
          key: 'backup_auto_enabled',
          value: 'true',
          type: 'boolean',
          description: 'Enable automatic daily backups'
        },
        {
          key: 'backup_keep_count',
          value: '7',
          type: 'number',
          description: 'Number of backups to keep'
        },
        {
          key: 'audit_retention_days',
          value: '90',
          type: 'number',
          description: 'Days to retain audit logs'
        },
        {
          key: 'low_stock_threshold',
          value: '10',
          type: 'number',
          description: 'Minimum quantity before low stock alert'
        },
        {
          key: 'currency_symbol',
          value: '₹',
          type: 'string',
          description: 'Currency symbol for display'
        }
      ];

      for (const setting of defaultSettings) {
        try {
          const [existing] = await pool.query(
            'SELECT id FROM settings WHERE setting_key = ?',
            [setting.key]
          );

          if (existing.length === 0) {
            await pool.query(
              'INSERT INTO settings (setting_key, setting_value, data_type, description) VALUES (?, ?, ?, ?)',
              [setting.key, setting.value, setting.type, setting.description]
            );
          }
        } catch (err) {
          // Skip this setting if it fails, continue with others
          console.warn(`⚠️  Could not set ${setting.key}:`, err.message);
        }
      }
      console.log('✅ Default settings initialized');
    } catch (error) {
      console.warn('⚠️  Could not initialize settings:', error.message);
    }

    console.log('✅ All database migrations completed successfully!\n');
  } catch (error) {
    console.error('❌ Migration process failed:', error);
    process.exit(1);
  }
}

module.exports = { runMigrations };
