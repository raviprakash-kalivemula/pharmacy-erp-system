/**
 * Audit Log Routes
 * GET /api/audit-logs - List audit logs with filtering and pagination
 * GET /api/audit-logs/:id - Get single audit log
 * GET /api/audit-logs/entity/:entityType/:entityId - Get change history for specific entity
 * GET /api/security/unauthorized-attempts - Get unauthorized access attempts
 */

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleCheck');
const { AppError } = require('../middleware/errorHandler');

// =====================================================
// AUDIT LOG ENDPOINTS
// =====================================================

/**
 * GET /api/audit-logs
 * List all audit logs with filtering, sorting, and pagination
 * Query params: limit, offset, startDate, endDate, userId, action, entityType
 */
router.get('/', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const { limit = 50, offset = 0, startDate, endDate, userId, action, entityType } = req.query;
    
    // Validate pagination
    const pageLimit = Math.min(parseInt(limit) || 50, 500); // Max 500 per page
    const pageOffset = parseInt(offset) || 0;
    
    // Build query
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    
    // Date range filter
    if (startDate) {
      query += ' AND DATE(created_at) >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND DATE(created_at) <= ?';
      params.push(endDate);
    }
    
    // User filter
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    
    // Action filter (create, update, delete)
    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }
    
    // Entity type filter
    if (entityType) {
      query += ' AND entity_type = ?';
      params.push(entityType);
    }
    
    // Count total matching records
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0].total;
    
    // Get paginated results
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(pageLimit, pageOffset);
    
    const [logs] = await db.query(query, params);
    
    // Enrich logs with user info
    const logsWithUsers = await Promise.all(
      logs.map(async (log) => {
        const [users] = await db.query('SELECT username, full_name FROM users WHERE id = ?', [log.user_id]);
        return {
          ...log,
          user: users[0] || { username: 'Unknown', full_name: 'Unknown' },
          new_value: log.new_value ? JSON.parse(log.new_value) : null,
          old_value: log.old_value ? JSON.parse(log.old_value) : null,
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        logs: logsWithUsers,
        total,
        limit: pageLimit,
        offset: pageOffset,
      },
      message: 'Audit logs retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit-logs/:id
 * Get single audit log with full details
 */
router.get('/:id', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [logs] = await db.query('SELECT * FROM audit_logs WHERE id = ?', [id]);
    
    if (logs.length === 0) {
      throw new AppError('Audit log not found', 404, 'AUDIT_LOG_NOT_FOUND');
    }
    
    const log = logs[0];
    const [users] = await db.query('SELECT username, full_name, email FROM users WHERE id = ?', [log.user_id]);
    
    res.json({
      success: true,
      data: {
        ...log,
        user: users[0] || { username: 'Unknown', full_name: 'Unknown', email: 'unknown@pharmacy.local' },
        new_value: log.new_value ? JSON.parse(log.new_value) : null,
        old_value: log.old_value ? JSON.parse(log.old_value) : null,
      },
      message: 'Audit log retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit-logs/entity/:entityType/:entityId
 * Get change history for a specific entity
 * Shows all create/update/delete operations on that entity
 */
router.get('/entity/:entityType/:entityId', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    
    const [logs] = await db.query(
      `SELECT * FROM audit_logs 
       WHERE entity_type = ? AND entity_id = ?
       ORDER BY created_at DESC`,
      [entityType, entityId]
    );
    
    if (logs.length === 0) {
      throw new AppError('No change history found for this entity', 404, 'ENTITY_HISTORY_NOT_FOUND');
    }
    
    // Enrich with user info
    const logsWithUsers = await Promise.all(
      logs.map(async (log) => {
        const [users] = await db.query('SELECT username, full_name FROM users WHERE id = ?', [log.user_id]);
        return {
          ...log,
          user: users[0] || { username: 'Unknown', full_name: 'Unknown' },
          new_value: log.new_value ? JSON.parse(log.new_value) : null,
          old_value: log.old_value ? JSON.parse(log.old_value) : null,
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        entityType,
        entityId,
        changeHistory: logsWithUsers,
        totalChanges: logsWithUsers.length,
      },
      message: 'Entity change history retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// SECURITY EVENT ENDPOINTS
// =====================================================

/**
 * GET /api/security/unauthorized-attempts
 * Get unauthorized access attempts and security events
 * Query params: limit, offset, startDate, endDate, eventType
 */
router.get('/security/unauthorized-attempts', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const { limit = 50, offset = 0, startDate, endDate, eventType } = req.query;
    
    const pageLimit = Math.min(parseInt(limit) || 50, 500);
    const pageOffset = parseInt(offset) || 0;
    
    let query = 'SELECT * FROM security_events WHERE 1=1';
    const params = [];
    
    // Date range filter
    if (startDate) {
      query += ' AND DATE(created_at) >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND DATE(created_at) <= ?';
      params.push(endDate);
    }
    
    // Event type filter
    if (eventType) {
      query += ' AND event_type = ?';
      params.push(eventType);
    }
    
    // Count total
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0].total;
    
    // Get results
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(pageLimit, pageOffset);
    
    const [events] = await db.query(query, params);
    
    // Group by IP for suspicious activity detection
    const ipSummary = {};
    events.forEach(event => {
      if (!ipSummary[event.ip_address]) {
        ipSummary[event.ip_address] = { count: 0, lastAttempt: null, events: [] };
      }
      ipSummary[event.ip_address].count++;
      ipSummary[event.ip_address].lastAttempt = event.created_at;
      ipSummary[event.ip_address].events.push(event.event_type);
    });
    
    res.json({
      success: true,
      data: {
        events,
        total,
        limit: pageLimit,
        offset: pageOffset,
        ipSummary,
        suspiciousIPs: Object.keys(ipSummary).filter(ip => ipSummary[ip].count >= 5),
      },
      message: 'Security events retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/security/suspicious-activity
 * Get summary of suspicious activity by IP and user
 */
router.get('/security/suspicious-activity', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    // Top IPs with failed attempts
    const [topIPs] = await db.query(`
      SELECT 
        ip_address,
        COUNT(*) as attempt_count,
        MAX(created_at) as last_attempt,
        GROUP_CONCAT(DISTINCT event_type) as event_types
      FROM security_events
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY ip_address
      HAVING attempt_count >= 3
      ORDER BY attempt_count DESC
      LIMIT 10
    `);
    
    // Top usernames attempted
    const [topUsernames] = await db.query(`
      SELECT 
        username,
        COUNT(*) as attempt_count,
        MAX(created_at) as last_attempt,
        GROUP_CONCAT(DISTINCT ip_address) as ip_addresses
      FROM security_events
      WHERE username IS NOT NULL 
        AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY username
      ORDER BY attempt_count DESC
      LIMIT 10
    `);
    
    // Failed login trends
    const [failedLoginTrend] = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as attempt_count
      FROM security_events
      WHERE event_type = 'failed_login'
        AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    
    res.json({
      success: true,
      data: {
        topSuspiciousIPs: topIPs,
        topAttemptedUsernames: topUsernames,
        failedLoginTrend,
      },
      message: 'Suspicious activity summary retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// ACTIVITY SUMMARY ENDPOINTS
// =====================================================

/**
 * GET /api/audit-logs/stats/by-user
 * Get activity stats grouped by user
 */
router.get('/stats/by-user', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        u.id,
        u.username,
        u.full_name,
        COUNT(*) as total_actions,
        SUM(CASE WHEN a.action = 'create' THEN 1 ELSE 0 END) as creates,
        SUM(CASE WHEN a.action = 'update' THEN 1 ELSE 0 END) as updates,
        SUM(CASE WHEN a.action = 'delete' THEN 1 ELSE 0 END) as deletes,
        MAX(a.created_at) as last_action
      FROM users u
      LEFT JOIN audit_logs a ON u.id = a.user_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (startDate) {
      query += ' AND DATE(a.created_at) >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND DATE(a.created_at) <= ?';
      params.push(endDate);
    }
    
    query += ' GROUP BY u.id ORDER BY total_actions DESC';
    
    const [stats] = await db.query(query, params);
    
    res.json({
      success: true,
      data: stats,
      message: 'User activity statistics retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit-logs/stats/by-entity
 * Get activity stats grouped by entity type
 */
router.get('/stats/by-entity', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        entity_type,
        COUNT(*) as total_actions,
        SUM(CASE WHEN action = 'create' THEN 1 ELSE 0 END) as creates,
        SUM(CASE WHEN action = 'update' THEN 1 ELSE 0 END) as updates,
        SUM(CASE WHEN action = 'delete' THEN 1 ELSE 0 END) as deletes,
        COUNT(DISTINCT entity_id) as entities_affected,
        MAX(created_at) as last_action
      FROM audit_logs
      WHERE 1=1
    `;
    
    const params = [];
    
    if (startDate) {
      query += ' AND DATE(created_at) >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND DATE(created_at) <= ?';
      params.push(endDate);
    }
    
    query += ' GROUP BY entity_type ORDER BY total_actions DESC';
    
    const [stats] = await db.query(query, params);
    
    res.json({
      success: true,
      data: stats,
      message: 'Entity activity statistics retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit-logs/stats/timeline
 * Get activity timeline for dashboard
 */
router.get('/stats/timeline', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_actions,
        SUM(CASE WHEN action = 'create' THEN 1 ELSE 0 END) as creates,
        SUM(CASE WHEN action = 'update' THEN 1 ELSE 0 END) as updates,
        SUM(CASE WHEN action = 'delete' THEN 1 ELSE 0 END) as deletes
      FROM audit_logs
      WHERE 1=1
    `;
    
    const params = [];
    
    if (startDate) {
      query += ' AND DATE(created_at) >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND DATE(created_at) <= ?';
      params.push(endDate);
    }
    
    query += ' GROUP BY DATE(created_at) ORDER BY date ASC';
    
    const [timeline] = await db.query(query, params);
    
    res.json({
      success: true,
      data: timeline,
      message: 'Activity timeline retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit-logs/export/csv
 * Export audit logs to CSV format with certification
 * Query params: startDate, endDate, userId, action, entityType
 */
router.get('/export/csv', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const { startDate, endDate, userId, action, entityType } = req.query;
    
    // Build query (same filters as list endpoint)
    let query = 'SELECT id, user_id, action, entity_type, entity_id, new_value, old_value, ip_address, user_agent, created_at FROM audit_logs WHERE 1=1';
    const params = [];
    
    // Date range filter
    if (startDate) {
      query += ' AND DATE(created_at) >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND DATE(created_at) <= ?';
      params.push(endDate);
    }
    
    // User filter
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    
    // Action filter
    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }
    
    // Entity type filter
    if (entityType) {
      query += ' AND entity_type = ?';
      params.push(entityType);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const [logs] = await db.query(query, params);
    
    if (!logs || logs.length === 0) {
      return res.json({
        success: true,
        csv: '',
        message: 'No audit logs found for the specified filters'
      });
    }
    
    // Build CSV header
    const headers = [
      'Log ID',
      'User ID',
      'Username',
      'Action',
      'Entity Type',
      'Entity ID',
      'Before Update',
      'After Update',
      'IP Address',
      'User Agent',
      'Timestamp'
    ];
    
    // Fetch user details for username lookup
    const [users] = await db.query('SELECT id, username FROM users');
    const userMap = {};
    users.forEach(user => {
      userMap[user.id] = user.username;
    });
    
    // Build CSV rows
    const rows = logs.map(log => [
      log.id,
      log.user_id,
      userMap[log.user_id] || 'Unknown',
      log.action,
      log.entity_type,
      log.entity_id,
      log.old_value ? JSON.stringify(log.old_value) : '',
      log.new_value ? JSON.stringify(log.new_value) : '',
      log.ip_address,
      log.user_agent || '',
      new Date(log.created_at).toISOString()
    ]);
    
    // Generate CSV content
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => 
        row.map(cell => {
          // Escape quotes in cell values
          const cellStr = String(cell || '').replace(/"/g, '""');
          return `"${cellStr}"`;
        }).join(',')
      )
    ].join('\n');
    
    // Add audit certification metadata as footer comments
    const exportDate = new Date().toISOString();
    const exportedBy = userMap[req.user.id] || 'Unknown';
    const totalRecords = logs.length;
    
    const csvWithMetadata = [
      csvContent,
      '',
      '# AUDIT EXPORT CERTIFICATION',
      `# Export Date: ${exportDate}`,
      `# Exported By: ${exportedBy}`,
      `# Total Records: ${totalRecords}`,
      `# Data Integrity: SHA256 checksum available upon request`,
      `# Retention Period: 7 years per pharmacy regulations`,
      `# Classification: CONFIDENTIAL - Pharmacy Records`
    ].join('\n');
    
    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.setHeader('X-Export-Date', exportDate);
    res.setHeader('X-Total-Records', totalRecords);
    res.setHeader('X-Exported-By', exportedBy);
    
    // Send CSV
    res.send(csvWithMetadata);
    
    // Log the export action
    const logAction = async () => {
      try {
        await db.query(
          'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            req.user.id,
            'EXPORT',
            'audit_logs',
            'csv_export',
            JSON.stringify({
              total_records: totalRecords,
              filters: { startDate, endDate, userId, action, entityType }
            }),
            req.ip,
            req.get('user-agent'),
            new Date()
          ]
        );
      } catch (err) {
        console.error('Error logging audit export:', err);
      }
    };
    
    logAction();
    
  } catch (error) {
    next(error);
  }
});

module.exports = router;
