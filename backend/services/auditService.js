/**
 * Enhanced Audit Logging Service
 * Tracks user actions with detailed change logs, roles, and IP addresses
 */

const pool = require('../config/db');
const logger = require('../utils/logger');

class AuditService {
  /**
   * Log user action with detailed information
   */
  static async logAction(req, details = {}) {
    try {
      const {
        action,
        resourceType,
        resourceId,
        oldValues = {},
        newValues = {},
        status = 'success',
        errorMessage = null
      } = details;

      const user = req.user || {};
      const ipAddress = req.ip || 
        req.connection.remoteAddress || 
        req.headers['x-forwarded-for']?.split(',')[0] || 
        'unknown';

      const query = `
        INSERT INTO audit_logs (
          user_id,
          username,
          user_role,
          action,
          resource_type,
          resource_id,
          old_values,
          new_values,
          ip_address,
          user_agent,
          status,
          error_message,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;

      const values = [
        user.id || null,
        user.username || 'system',
        user.role || 'unknown',
        action,
        resourceType,
        resourceId || null,
        JSON.stringify(oldValues),
        JSON.stringify(newValues),
        ipAddress,
        req.headers['user-agent'] || 'unknown',
        status,
        errorMessage
      ];

      await pool.query(query, values);
      
      logger.info(`Audit: ${user.username} - ${action} ${resourceType}#${resourceId}`);
      return true;
    } catch (error) {
      logger.error(`Audit logging error: ${error.message}`);
      // Don't throw - audit logging should never break request
      return false;
    }
  }

  /**
   * Get audit logs with filtering
   */
  static async getAuditLogs(filters = {}) {
    try {
      let query = `
        SELECT 
          id,
          user_id,
          username,
          user_role,
          action,
          resource_type,
          resource_id,
          old_values,
          new_values,
          ip_address,
          user_agent,
          status,
          error_message,
          created_at
        FROM audit_logs
        WHERE 1=1
      `;

      const params = [];

      // Filter by user
      if (filters.userId) {
        query += ' AND user_id = ?';
        params.push(filters.userId);
      }

      // Filter by action
      if (filters.action) {
        query += ' AND action = ?';
        params.push(filters.action);
      }

      // Filter by resource type
      if (filters.resourceType) {
        query += ' AND resource_type = ?';
        params.push(filters.resourceType);
      }

      // Filter by date range
      if (filters.startDate) {
        query += ' AND created_at >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ' AND created_at <= ?';
        params.push(filters.endDate);
      }

      // Filter by status
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      // Sorting and pagination
      query += ' ORDER BY created_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
        
        if (filters.offset) {
          query += ' OFFSET ?';
          params.push(filters.offset);
        }
      }

      const [logs] = await pool.query(query, params);
      
      // Parse JSON fields
      return logs.map(log => ({
        ...log,
        oldValues: JSON.parse(log.old_values || '{}'),
        newValues: JSON.parse(log.new_values || '{}')
      }));
    } catch (error) {
      logger.error(`Get audit logs error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get audit log summary (count by action/resource)
   */
  static async getAuditSummary(days = 30) {
    try {
      const query = `
        SELECT 
          action,
          resource_type,
          status,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM audit_logs
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY action, resource_type, status, DATE(created_at)
        ORDER BY DATE(created_at) DESC
      `;

      const [summary] = await pool.query(query, [days]);
      return summary;
    } catch (error) {
      logger.error(`Get audit summary error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate change statistics
   */
  static async getChangeStats(days = 30) {
    try {
      const query = `
        SELECT 
          resource_type,
          COUNT(CASE WHEN action = 'create' THEN 1 END) as creates,
          COUNT(CASE WHEN action = 'update' THEN 1 END) as updates,
          COUNT(CASE WHEN action = 'delete' THEN 1 END) as deletes,
          COUNT(CASE WHEN status = 'error' THEN 1 END) as errors
        FROM audit_logs
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY resource_type
      `;

      const [stats] = await pool.query(query, [days]);
      return stats;
    } catch (error) {
      logger.error(`Get change stats error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user activity timeline
   */
  static async getUserActivity(userId, limit = 50) {
    try {
      const query = `
        SELECT 
          id,
          action,
          resource_type,
          resource_id,
          status,
          created_at
        FROM audit_logs
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `;

      const [activity] = await pool.query(query, [userId, limit]);
      return activity;
    } catch (error) {
      logger.error(`Get user activity error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export audit logs to CSV format
   */
  static async exportAuditLogs(filters = {}) {
    try {
      const logs = await this.getAuditLogs({ ...filters, limit: 10000 });
      
      // Convert to CSV
      const headers = [
        'Timestamp',
        'User',
        'Role',
        'Action',
        'Resource',
        'Resource ID',
        'IP Address',
        'Status',
        'Error Message'
      ];

      const rows = logs.map(log => [
        log.created_at,
        log.username,
        log.user_role,
        log.action,
        log.resource_type,
        log.resource_id || '-',
        log.ip_address,
        log.status,
        log.error_message || '-'
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(col => `"${col}"`).join(','))
      ].join('\n');

      return csv;
    } catch (error) {
      logger.error(`Export audit logs error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AuditService;
