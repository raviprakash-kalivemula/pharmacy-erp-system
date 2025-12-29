/**
 * Database Backup & Restore Service
 * Handles automated backups and restoration of database
 */

const pool = require('../config/db');
const logger = require('../utils/logger');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');

// Create backups directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

class BackupService {
  /**
   * Create database backup
   */
  static async createBackup(description = '') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `pharmacy-erp-backup-${timestamp}.sql`;
      const filepath = path.join(BACKUP_DIR, filename);

      // Get database configuration
      const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'pharmacy_erp'
      };

      // Build mysqldump command
      let cmd = `mysqldump -h${dbConfig.host} -u${dbConfig.user}`;
      
      if (dbConfig.password) {
        cmd += ` -p${dbConfig.password}`;
      }
      
      cmd += ` --single-transaction --routines --triggers ${dbConfig.database} > "${filepath}"`;

      // Execute backup
      await execPromise(cmd);

      // Get file size
      const stats = fs.statSync(filepath);
      const filesize = stats.size;

      // Record backup metadata
      await pool.query(
        `INSERT INTO backups (filename, filepath, size, description, created_at) 
         VALUES (?, ?, ?, ?, NOW())`,
        [filename, filepath, filesize, description]
      );

      logger.info(`Backup created: ${filename} (${filesize} bytes)`);

      return {
        filename,
        filepath,
        filesize,
        timestamp: new Date(),
        success: true
      };
    } catch (error) {
      logger.error(`Backup error: ${error.message}`);
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  /**
   * List all backups
   */
  static async listBackups() {
    try {
      const [backups] = await pool.query(
        `SELECT id, filename, size, description, created_at 
         FROM backups 
         ORDER BY created_at DESC 
         LIMIT 50`
      );

      return backups.map(backup => ({
        ...backup,
        sizeKB: (backup.size / 1024).toFixed(2),
        sizeMB: (backup.size / (1024 * 1024)).toFixed(2)
      }));
    } catch (error) {
      logger.error(`List backups error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get backup by ID
   */
  static async getBackup(backupId) {
    try {
      const [backups] = await pool.query(
        `SELECT * FROM backups WHERE id = ?`,
        [backupId]
      );

      if (backups.length === 0) {
        throw new Error('Backup not found');
      }

      const backup = backups[0];
      
      // Check if file exists
      if (!fs.existsSync(backup.filepath)) {
        throw new Error('Backup file not found on disk');
      }

      return backup;
    } catch (error) {
      logger.error(`Get backup error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Restore database from backup
   * WARNING: This will overwrite current database
   */
  static async restoreBackup(backupId) {
    try {
      const backup = await this.getBackup(backupId);

      const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'pharmacy_erp'
      };

      // Build mysql restore command
      let cmd = `mysql -h${dbConfig.host} -u${dbConfig.user}`;
      
      if (dbConfig.password) {
        cmd += ` -p${dbConfig.password}`;
      }
      
      cmd += ` ${dbConfig.database} < "${backup.filepath}"`;

      logger.warn(`Starting database restore from backup: ${backup.filename}`);

      // Execute restore
      await execPromise(cmd);

      // Record restore in audit
      await pool.query(
        `UPDATE backups SET last_restored_at = NOW() WHERE id = ?`,
        [backupId]
      );

      logger.info(`Database restored successfully from: ${backup.filename}`);

      return {
        success: true,
        message: `Database restored from backup: ${backup.filename}`,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`Restore error: ${error.message}`);
      throw new Error(`Failed to restore backup: ${error.message}`);
    }
  }

  /**
   * Delete old backups (keep only recent ones)
   */
  static async cleanupOldBackups(keepCount = 10) {
    try {
      const [backups] = await pool.query(
        `SELECT id, filepath FROM backups ORDER BY created_at DESC LIMIT 10000`
      );

      let deleted = 0;

      for (let i = keepCount; i < backups.length; i++) {
        const backup = backups[i];
        
        try {
          // Delete file
          if (fs.existsSync(backup.filepath)) {
            fs.unlinkSync(backup.filepath);
          }
          
          // Delete record
          await pool.query(`DELETE FROM backups WHERE id = ?`, [backup.id]);
          deleted++;
        } catch (err) {
          logger.warn(`Failed to delete backup ${backup.id}: ${err.message}`);
        }
      }

      logger.info(`Cleanup complete: Deleted ${deleted} old backups`);
      return { deleted, remaining: keepCount };
    } catch (error) {
      logger.error(`Cleanup error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Schedule automatic backup (daily)
   * Call this in server initialization
   */
  static scheduleAutomaticBackups() {
    // Run daily at 2 AM
    const now = new Date();
    const target = new Date();
    target.setHours(2, 0, 0, 0);

    if (now > target) {
      target.setDate(target.getDate() + 1);
    }

    const delay = target.getTime() - now.getTime();

    setTimeout(() => {
      this.createBackup('Automatic daily backup')
        .then(() => {
          this.cleanupOldBackups(7); // Keep last 7 backups
        })
        .catch(err => {
          logger.error(`Automatic backup failed: ${err.message}`);
        });

      // Repeat daily
      setInterval(() => {
        this.createBackup('Automatic daily backup')
          .then(() => {
            this.cleanupOldBackups(7);
          })
          .catch(err => {
            logger.error(`Automatic backup failed: ${err.message}`);
          });
      }, 24 * 60 * 60 * 1000); // 24 hours
    }, delay);

    logger.info(`Automatic backups scheduled for 2:00 AM daily`);
  }

  /**
   * Download backup file
   */
  static async getBackupFile(backupId) {
    try {
      const backup = await this.getBackup(backupId);
      
      if (!fs.existsSync(backup.filepath)) {
        throw new Error('Backup file not found');
      }

      return {
        filepath: backup.filepath,
        filename: backup.filename,
        stream: fs.createReadStream(backup.filepath)
      };
    } catch (error) {
      logger.error(`Get backup file error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get backup statistics
   */
  static async getBackupStats() {
    try {
      const [stats] = await pool.query(`
        SELECT 
          COUNT(*) as total_backups,
          SUM(size) as total_size,
          MAX(created_at) as last_backup,
          AVG(size) as avg_size
        FROM backups
      `);

      return {
        totalBackups: stats[0].total_backups || 0,
        totalSize: stats[0].total_size || 0,
        totalSizeMB: ((stats[0].total_size || 0) / (1024 * 1024)).toFixed(2),
        lastBackup: stats[0].last_backup,
        avgSize: stats[0].avg_size ? (stats[0].avg_size / (1024 * 1024)).toFixed(2) : '0.00'
      };
    } catch (error) {
      logger.error(`Get backup stats error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = BackupService;
