const db = require('../config/db');

function auditLogMiddleware(req, res, next) {
  // Store original body for comparison (for updates)
  req.originalBody = JSON.parse(JSON.stringify(req.body || {}));
  
  // Intercept response to capture after state
  const originalSend = res.send;
  res.send = function(data) {
    // Log operation if successful (2xx status)
    if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
      const method = req.method;
      let action = 'unknown';
      let entityType = extractEntityType(req.originalUrl);

      if (method === 'POST') action = 'create';
      else if (method === 'PUT') action = 'update';
      else if (method === 'DELETE') action = 'delete';

      if (action !== 'unknown' && entityType) {
        // Log asynchronously (don't block response)
        logAuditEvent(req, action, entityType).catch(err => 
          console.error('Audit log error:', err)
        );
      }
    }

    res.send = originalSend;
    return res.send(data);
  };

  next();
}

/**
 * Log audit event with old and new values
 * For updates, fetches the previous values from database for comparison
 */
async function logAuditEvent(req, action, entityType) {
  try {
    const entityId = extractEntityId(req);
    const newValue = JSON.stringify(req.body || {});
    let oldValue = null;
    let entityName = null;

    // For UPDATE operations, fetch old values from database
    if (action === 'update' && entityId) {
      try {
        const tableMap = {
          medicines: 'medicines',
          customers: 'customers',
          suppliers: 'suppliers',
          sales: 'transactions',
          purchases: 'purchases',
          settings: 'settings',
        };

        const table = tableMap[entityType];
        const idField = entityType === 'sales' ? 'invoice_no' : 'id';

        if (table) {
          const [rows] = await db.query(
            `SELECT * FROM ${table} WHERE ${idField} = ? LIMIT 1`,
            [entityId]
          );

          if (rows.length > 0) {
            oldValue = JSON.stringify(rows[0]);
            // Extract human-readable name for entity
            entityName = rows[0].name || rows[0].customer_name || rows[0].invoice_no || `${entityType}_${entityId}`;
          }
        }
      } catch (err) {
        console.warn(`Could not fetch old values for ${entityType}:${entityId}`, err.message);
      }
    }

    // For DELETE operations, fetch full record before deletion
    if (action === 'delete' && entityId) {
      try {
        const tableMap = {
          medicines: 'medicines',
          customers: 'customers',
          suppliers: 'suppliers',
          sales: 'transactions',
          purchases: 'purchases',
          settings: 'settings',
        };

        const table = tableMap[entityType];
        const idField = entityType === 'sales' ? 'invoice_no' : 'id';

        if (table) {
          const [rows] = await db.query(
            `SELECT * FROM ${table} WHERE ${idField} = ? LIMIT 1`,
            [entityId]
          );

          if (rows.length > 0) {
            oldValue = JSON.stringify(rows[0]);
            entityName = rows[0].name || rows[0].customer_name || rows[0].invoice_no || `${entityType}_${entityId}`;
          }
        }
      } catch (err) {
        console.warn(`Could not fetch deleted record for ${entityType}:${entityId}`, err.message);
      }
    }

    // Generate summary of changes
    let changesSummary = null;
    if (action === 'update' && oldValue && newValue) {
      const oldObj = JSON.parse(oldValue);
      const newObj = JSON.parse(newValue);
      const changes = [];

      for (const key in newObj) {
        if (oldObj[key] !== newObj[key]) {
          changes.push(`${key}: "${oldObj[key]}" → "${newObj[key]}"`);
        }
      }

      changesSummary = changes.slice(0, 5).join('; '); // Limit to 500 chars
      if (changes.length > 5) {
        changesSummary += ` (+${changes.length - 5} more fields)`;
      }
    }

    // Insert audit log with old and new values
    await db.query(
      `INSERT INTO audit_logs 
       (user_id, action, entity_type, entity_id, entity_name, new_value, old_value, changes_summary, ip_address, user_agent, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        action,
        entityType,
        entityId,
        entityName,
        newValue,
        oldValue,
        changesSummary,
        req.ip,
        req.get('user-agent')
      ]
    );
  } catch (err) {
    console.error('Error logging audit event:', err);
    throw err;
  }
}

function extractEntityType(url) {
  const match = url.match(/\/api\/(\w+)/);
  return match ? match[1] : null;
}

function extractEntityId(req) {
  const idParam = req.params.id || req.params.invoiceNo || req.params.supplierId;
  return idParam || null;
}

module.exports = { auditLogMiddleware, logAuditEvent };
