/**
 * Advanced Admin Routes
 * Handles RBAC, Audit Logs, Backups, Exports, and Settings
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const logger = require('../utils/logger');
const { rbacMiddleware } = require('../middleware/rbac');
const AuditService = require('../services/auditService');
const BackupService = require('../services/backupService');
const ExportService = require('../services/exportService');

// ========== AUDIT LOGS ENDPOINTS ==========

/**
 * GET /api/admin/audit-logs
 * Retrieve audit logs with filtering
 */
router.get('/audit-logs', rbacMiddleware('VIEW_AUDIT_LOGS'), async (req, res) => {
  try {
    const { userId, action, resourceType, startDate, endDate, status, limit = 100, offset = 0 } = req.query;

    const filters = {
      userId: userId ? parseInt(userId) : null,
      action,
      resourceType,
      startDate,
      endDate,
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const logs = await AuditService.getAuditLogs(filters);
    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM audit_logs');

    res.json({
      success: true,
      data: logs,
      pagination: {
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logger.error(`Get audit logs error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/audit-summary
 * Get audit log summary/statistics
 */
router.get('/audit-summary', rbacMiddleware('VIEW_AUDIT_LOGS'), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    
    const [summary] = await Promise.all([
      AuditService.getAuditSummary(days),
      AuditService.getChangeStats(days)
    ]);

    res.json({
      success: true,
      data: summary,
      period: `${days} days`
    });
  } catch (error) {
    logger.error(`Get audit summary error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/user-activity/:userId
 * Get activity timeline for specific user
 */
router.get('/user-activity/:userId', rbacMiddleware('VIEW_AUDIT_LOGS'), async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const activity = await AuditService.getUserActivity(parseInt(userId), limit);

    res.json({
      success: true,
      userId: parseInt(userId),
      activityCount: activity.length,
      data: activity
    });
  } catch (error) {
    logger.error(`Get user activity error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/audit-export
 * Export audit logs as CSV
 */
router.get('/audit-export', rbacMiddleware('VIEW_AUDIT_LOGS'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const filters = {
      startDate,
      endDate,
      limit: 50000
    };

    const csv = await AuditService.exportAuditLogs(filters);

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="audit-logs-${new Date().getTime()}.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error(`Export audit logs error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== BACKUP & RESTORE ENDPOINTS ==========

/**
 * POST /api/admin/backup
 * Create manual database backup
 */
router.post('/backup', rbacMiddleware('BACKUP_DATABASE'), async (req, res) => {
  try {
    const { description } = req.body;

    const backup = await BackupService.createBackup(description || 'Manual backup');

    // Log to audit
    await AuditService.logAction(req, {
      action: 'create',
      resourceType: 'backup',
      resourceId: backup.filename,
      newValues: { filename: backup.filename, size: backup.filesize }
    });

    res.json({
      success: true,
      message: 'Backup created successfully',
      data: backup
    });
  } catch (error) {
    logger.error(`Create backup error: ${error.message}`);
    
    await AuditService.logAction(req, {
      action: 'create',
      resourceType: 'backup',
      status: 'error',
      errorMessage: error.message
    });

    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/backups
 * List all backups
 */
router.get('/backups', rbacMiddleware('BACKUP_DATABASE'), async (req, res) => {
  try {
    const backups = await BackupService.listBackups();
    const stats = await BackupService.getBackupStats();

    res.json({
      success: true,
      data: backups,
      stats
    });
  } catch (error) {
    logger.error(`List backups error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/backup/:backupId/download
 * Download backup file
 */
router.get('/backup/:backupId/download', rbacMiddleware('BACKUP_DATABASE'), async (req, res) => {
  try {
    const { backupId } = req.params;
    const backup = await BackupService.getBackupFile(parseInt(backupId));

    res.header('Content-Type', 'application/octet-stream');
    res.header('Content-Disposition', `attachment; filename="${backup.filename}"`);
    
    backup.stream.pipe(res);
  } catch (error) {
    logger.error(`Download backup error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/backup/:backupId/restore
 * Restore database from backup
 * WARNING: This will overwrite current database
 */
router.post('/backup/:backupId/restore', rbacMiddleware('RESTORE_DATABASE'), async (req, res) => {
  try {
    const { backupId } = req.params;
    const { confirm } = req.body;

    if (confirm !== true) {
      return res.status(400).json({
        success: false,
        message: 'Confirmation required. Send { confirm: true } in request body.'
      });
    }

    const result = await BackupService.restoreBackup(parseInt(backupId));

    // Log to audit
    await AuditService.logAction(req, {
      action: 'restore',
      resourceType: 'backup',
      resourceId: backupId,
      newValues: { message: result.message }
    });

    res.json({
      success: true,
      message: 'Database restored successfully',
      data: result
    });
  } catch (error) {
    logger.error(`Restore backup error: ${error.message}`);

    await AuditService.logAction(req, {
      action: 'restore',
      resourceType: 'backup',
      resourceId: req.params.backupId,
      status: 'error',
      errorMessage: error.message
    });

    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/admin/backup/:backupId
 * Delete backup file
 */
router.delete('/backup/:backupId', rbacMiddleware('BACKUP_DATABASE'), async (req, res) => {
  try {
    const { backupId } = req.params;
    const backup = await BackupService.getBackup(parseInt(backupId));

    // Delete file
    const fs = require('fs');
    if (fs.existsSync(backup.filepath)) {
      fs.unlinkSync(backup.filepath);
    }

    // Delete record
    await pool.query('DELETE FROM backups WHERE id = ?', [backupId]);

    await AuditService.logAction(req, {
      action: 'delete',
      resourceType: 'backup',
      resourceId: backupId,
      oldValues: { filename: backup.filename }
    });

    res.json({ success: true, message: 'Backup deleted successfully' });
  } catch (error) {
    logger.error(`Delete backup error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== DATA EXPORT ENDPOINTS ==========

/**
 * GET /api/admin/export/medicines
 * Export medicines to CSV
 */
router.get('/export/medicines', rbacMiddleware('EXPORT_REPORTS'), async (req, res) => {
  try {
    const csv = await ExportService.exportMedicinesCSV();

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="medicines.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/export/medicines-excel
 * Export medicines to Excel
 */
router.get('/export/medicines-excel', rbacMiddleware('EXPORT_REPORTS'), async (req, res) => {
  try {
    const buffer = await ExportService.exportMedicinesExcel();

    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', 'attachment; filename="medicines.xlsx"');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/export/customers
 * Export customers to CSV
 */
router.get('/export/customers', rbacMiddleware('EXPORT_REPORTS'), async (req, res) => {
  try {
    const csv = await ExportService.exportCustomersCSV();

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="customers.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/export/sales
 * Export sales transactions to CSV
 */
router.get('/export/sales', rbacMiddleware('EXPORT_REPORTS'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate required (YYYY-MM-DD)'
      });
    }

    const csv = await ExportService.exportSalesCSV(startDate, endDate);

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="sales.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/export/inventory
 * Export inventory report to Excel
 */
router.get('/export/inventory', rbacMiddleware('EXPORT_REPORTS'), async (req, res) => {
  try {
    const buffer = await ExportService.exportInventoryExcel();

    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', 'attachment; filename="inventory.xlsx"');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== SETTINGS ENDPOINTS ==========

/**
 * GET /api/admin/settings
 * Get all application settings
 */
router.get('/settings', rbacMiddleware('VIEW_SETTINGS'), async (req, res) => {
  try {
    const [settings] = await pool.query('SELECT setting_key, setting_value, data_type FROM settings');

    const formattedSettings = {};
    settings.forEach(s => {
      formattedSettings[s.setting_key] = s.setting_value;
    });

    res.json({
      success: true,
      data: formattedSettings,
      count: settings.length
    });
  } catch (error) {
    logger.error(`Get settings error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/admin/settings/:key
 * Update a setting value
 */
router.put('/settings/:key', rbacMiddleware('EDIT_SETTINGS'), async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing key or value'
      });
    }

    // Get old value for audit
    const [oldSettings] = await pool.query(
      'SELECT setting_value FROM settings WHERE setting_key = ?',
      [key]
    );

    const oldValue = oldSettings.length > 0 ? oldSettings[0].setting_value : null;

    // Update setting
    await pool.query(
      'UPDATE settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?',
      [value, req.user?.id || null, key]
    );

    // Log to audit
    await AuditService.logAction(req, {
      action: 'update',
      resourceType: 'setting',
      resourceId: null,
      oldValues: { [key]: oldValue },
      newValues: { [key]: value }
    });

    res.json({
      success: true,
      message: `Setting '${key}' updated successfully`
    });
  } catch (error) {
    logger.error(`Update setting error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== USER MANAGEMENT ENDPOINTS ==========

/**
 * GET /api/admin/users
 * Get all users
 */
router.get('/users', rbacMiddleware('VIEW_SETTINGS'), async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, username, email, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
    );

    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    logger.error(`Get users error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/users
 * Create new user
 */
router.post('/users', rbacMiddleware('EDIT_SETTINGS'), async (req, res) => {
  try {
    const { username, email, password, role = 'viewer' } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password required'
      });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, true)',
      [username, email || null, hashedPassword, role]
    );

    await AuditService.logAction(req, {
      action: 'create',
      resourceType: 'user',
      newValues: { username, email, role }
    });

    res.json({
      success: true,
      message: `User '${username}' created successfully`
    });
  } catch (error) {
    logger.error(`Create user error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/admin/users/:userId/role
 * Update user role
 */
router.put('/users/:userId/role', rbacMiddleware('EDIT_SETTINGS'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['admin', 'pharmacist', 'viewer'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin, pharmacist, or viewer'
      });
    }

    const [users] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    const oldRole = users.length > 0 ? users[0].role : null;

    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);

    await AuditService.logAction(req, {
      action: 'update',
      resourceType: 'user',
      resourceId: parseInt(userId),
      oldValues: { role: oldRole },
      newValues: { role }
    });

    res.json({
      success: true,
      message: `User role updated to '${role}'`
    });
  } catch (error) {
    logger.error(`Update user role error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Deactivate user
 */
router.delete('/users/:userId', rbacMiddleware('EDIT_SETTINGS'), async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent self-deletion
    if (req.user?.id === parseInt(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own user account'
      });
    }

    await pool.query('UPDATE users SET is_active = false WHERE id = ?', [userId]);

    await AuditService.logAction(req, {
      action: 'delete',
      resourceType: 'user',
      resourceId: parseInt(userId)
    });

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    logger.error(`Delete user error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
