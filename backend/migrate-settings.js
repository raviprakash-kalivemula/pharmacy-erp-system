const pool = require('./config/db');

(async () => {
  try {
    console.log('🔄 Converting settings table from old to new format...\n');
    
    // Drop the old settings table
    await pool.query('DROP TABLE IF EXISTS settings');
    console.log('✅ Dropped old settings table');
    
    // Create new settings table
    await pool.query(`
      CREATE TABLE settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value LONGTEXT,
        data_type VARCHAR(20),
        description TEXT,
        updated_by INT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Created new settings table with key-value format');
    
    // Insert default settings
    const defaultSettings = [
      { key: 'app_name', value: 'Sri Raghavendra Medical', type: 'string', desc: 'Application name' },
      { key: 'backup_auto_enabled', value: 'true', type: 'boolean', desc: 'Enable automatic daily backups' },
      { key: 'backup_keep_count', value: '7', type: 'number', desc: 'Number of backups to keep' },
      { key: 'audit_retention_days', value: '90', type: 'number', desc: 'Days to retain audit logs' },
      { key: 'low_stock_threshold', value: '10', type: 'number', desc: 'Minimum quantity before low stock alert' },
      { key: 'currency_symbol', value: '₹', type: 'string', desc: 'Currency symbol for display' }
    ];
    
    for (const s of defaultSettings) {
      await pool.query(
        'INSERT INTO settings (setting_key, setting_value, data_type, description) VALUES (?, ?, ?, ?)',
        [s.key, s.value, s.type, s.desc]
      );
    }
    console.log('✅ Inserted 6 default settings');
    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
