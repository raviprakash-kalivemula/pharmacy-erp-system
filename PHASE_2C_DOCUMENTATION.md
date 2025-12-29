# Phase 2C: Advanced Features Implementation

## Overview

Phase 2C introduces enterprise-grade administrative features to the Pharmacy ERP system, including Role-Based Access Control (RBAC), Enhanced Audit Logging, Backup & Restore functionality, and Data Export capabilities.

## Features Implemented

### 1. Role-Based Access Control (RBAC)

**Files:**
- `backend/middleware/rbac.js` - Core RBAC middleware

**Implementation:**
- 3-tier role system: Admin, Pharmacist, Viewer
- Permission matrix defining what each role can access
- Middleware factory for protecting routes based on permissions
- Automatic role validation on all protected endpoints

**Roles & Permissions:**

| Role | Medicines | Sales | Purchases | Settings | Admin |
|------|-----------|-------|-----------|----------|-------|
| Admin | View, Edit, Delete | View, Create, Edit, Delete | View, Create, Edit, Delete | Full Access | Full Access |
| Pharmacist | View, Edit | View, Create, Edit | View, Create, Edit | Read Only | None |
| Viewer | View Only | View Only | View Only | None | None |

**Usage in Routes:**
```javascript
router.get('/admin/users', rbacMiddleware('VIEW_SETTINGS'), async (req, res) => {
  // Only users with VIEW_SETTINGS permission can access this
});
```

### 2. Enhanced Audit Logging

**Files:**
- `backend/services/auditService.js` - Comprehensive audit logging service

**Features:**
- Detailed action tracking with user information
- IP address and User-Agent logging
- Before/After value comparison (oldValues vs newValues)
- User role attribution
- Queryable audit trail with filtering:
  - By user ID
  - By action type (create, update, delete)
  - By resource type (medicine, customer, sale, etc.)
  - By date range
  - By status (success/error)

**Data Captured:**
- User ID, username, and role
- Action performed
- Resource type and ID
- Previous and new values (as JSON)
- IP address and User-Agent
- Timestamp
- Success/failure status
- Error messages for failed operations

**Endpoints:**
```
GET  /api/admin/audit-logs - List audit logs with filtering
GET  /api/admin/audit-summary - Statistics on actions
GET  /api/admin/user-activity/:userId - User activity timeline
GET  /api/admin/audit-export - Export audit logs as CSV
```

### 3. Backup & Restore

**Files:**
- `backend/services/backupService.js` - Backup management service
- `backend/config/migrations.js` - Database migrations for Phase 2C

**Features:**
- One-click manual database backups
- Automated daily backups at 2:00 AM
- Download backup files for safekeeping
- Restore database from any backup point
- Automatic cleanup (keeps last 7 backups)
- Backup metadata tracking (filename, size, creation time)
- Backup statistics dashboard

**Endpoints:**
```
POST   /api/admin/backup - Create new backup
GET    /api/admin/backups - List all backups
GET    /api/admin/backup/:id/download - Download backup file
POST   /api/admin/backup/:id/restore - Restore from backup (requires confirmation)
DELETE /api/admin/backup/:id - Delete backup file
```

**Backup File Format:**
- SQL dump with full database structure and data
- Includes all tables, indexes, and foreign keys
- Can be restored with MySQL command-line tools
- Timestamped filename: `pharmacy-erp-backup-YYYY-MM-DDTHH-MM-SS.sql`

### 4. Data Export

**Files:**
- `backend/services/exportService.js` - Export service for multiple formats

**Export Formats:**

1. **Medicines Export (Excel)**
   - ID, Name, Generic Name, Manufacturer
   - Stock, Price, Margin %, Batch Number, Expiry Date
   - Formatted currency, conditional formatting

2. **Customers Export (CSV)**
   - ID, Name, Phone, Email, Address
   - City, State, Pincode, Loyalty Points, Join Date

3. **Inventory Export (Excel)**
   - Medicine Name, Quantity, Unit Price, Stock Value
   - Status (Critical/Low/Healthy) with color coding
   - Expiry Date information

4. **Sales Export (CSV)**
   - Date range filtering
   - Transaction Number, Customer Name, Amounts
   - Payment Method and Status
   - Sortable by date

5. **Audit Logs Export (CSV)**
   - Complete audit trail in CSV format
   - All filtering options supported
   - Up to 50,000 records per export

**Endpoints:**
```
GET /api/admin/export/medicines - Excel format
GET /api/admin/export/medicines-excel - Excel format (duplicate)
GET /api/admin/export/customers - CSV format
GET /api/admin/export/sales - CSV with date filtering
GET /api/admin/export/inventory - Excel format
GET /api/admin/audit-export - CSV format
```

### 5. Database Migrations

**Files:**
- `backend/config/migrations.js`

**New Tables Created:**

1. **users** - User accounts with roles
   - Columns: id, username, email, password_hash, role, is_active, last_login, created_at, updated_at
   - Default admin user created: username: `admin`, password: `admin123`

2. **audit_logs** - Complete audit trail
   - Columns: id, user_id, username, user_role, action, resource_type, resource_id
   - old_values, new_values (JSON), ip_address, user_agent, status, error_message, created_at
   - Indexes on user_id, action, resource_type, created_at

3. **backups** - Backup metadata
   - Columns: id, filename, filepath, size, description, last_restored_at, created_at
   - Indexes on created_at for fast queries

4. **settings** - Application settings storage
   - Columns: id, setting_key (UNIQUE), setting_value, data_type, description, updated_by, updated_at
   - Pre-populated with default settings:
     - app_name, backup_auto_enabled, backup_keep_count
     - audit_retention_days, low_stock_threshold, currency_symbol

**Default Settings:**
```javascript
{
  app_name: 'Sri Raghavendra Medical',
  backup_auto_enabled: 'true',
  backup_keep_count: '7',
  audit_retention_days: '90',
  low_stock_threshold: '10',
  currency_symbol: '₹'
}
```

### 6. Advanced Routes

**File:** `backend/routes/admin.js`

**Route Structure:**
```
/api/admin/
├── audit-logs (GET) - List with filtering
├── audit-summary (GET) - Statistics
├── user-activity/:userId (GET) - Timeline
├── audit-export (GET) - CSV export
├── backup (POST) - Create backup
├── backups (GET) - List backups
├── backup/:id/download (GET) - Download file
├── backup/:id/restore (POST) - Restore database
├── backup/:id (DELETE) - Delete backup
├── export/medicines (GET) - CSV export
├── export/medicines-excel (GET) - Excel export
├── export/customers (GET) - CSV export
├── export/sales (GET) - CSV with date filter
├── export/inventory (GET) - Excel export
├── settings (GET) - All settings
├── settings/:key (PUT) - Update setting
├── users (GET) - List users
├── users (POST) - Create user
├── users/:id/role (PUT) - Change role
└── users/:id (DELETE) - Deactivate user
```

### 7. Frontend Settings Page

**File:** `frontend/src/components/pages/Settings.jsx`

**Tabs (Admin Only):**

1. **Profile Tab**
   - User information display
   - Username, role, admin status indicator

2. **User Management Tab**
   - List all users with roles
   - Inline role selection dropdown
   - User creation modal with password
   - User deactivation button
   - Active/Inactive status indicator

3. **Backup & Restore Tab**
   - Backup statistics cards:
     - Total backups count
     - Total size in MB
     - Last backup date
     - Average backup size
   - "Create Backup Now" button
   - Backup history table:
     - Filename, Size, Created date
     - Download button
     - Restore button with confirmation dialog

4. **Export Data Tab**
   - 5 export options with icons:
     - Medicines (Excel)
     - Customers (CSV)
     - Inventory (Excel)
     - Audit Logs (CSV)
     - Sales (with date range selector)
   - One-click download buttons
   - Responsive grid layout

**Features:**
- Role-based tab visibility (admin only)
- Real-time data loading
- Error handling with toast notifications
- Confirmation dialogs for destructive operations
- Loading states on buttons
- Responsive design
- Professional styling with Tailwind CSS

## Integration Points

### Backend Server (server.js)

1. **Database Migrations:**
```javascript
const { runMigrations } = require('./config/migrations');
runMigrations().catch(err => {
  console.error('❌ Phase 2C Migration error:', err.message);
});
```

2. **Automatic Backups:**
```javascript
BackupService.scheduleAutomaticBackups();
```

3. **Admin Routes:**
```javascript
app.use('/api/admin', require('./routes/admin'));
```

### Frontend API (src/api.js)

Added 20+ new API methods for:
- Audit log retrieval and filtering
- Backup operations
- Data export
- User management
- System settings

## Security Considerations

### Authentication & Authorization
- All admin routes protected by `authMiddleware`
- Permission checks via `rbacMiddleware`
- Default admin account created during migration
- Password hashing with bcryptjs (10 rounds)

### Audit Trail
- All administrative actions logged
- IP addresses tracked for forensics
- Failed operations recorded with error messages
- User context always preserved
- Cannot be disabled by non-admins

### Backup Security
- Backup files stored in `backups/` directory
- Automatic cleanup limits disk usage
- Restore requires explicit confirmation
- Backup operations logged to audit trail

### Data Protection
- Export data never cached
- Temporary files cleaned up
- Sensitive data fields included based on role
- CSV/Excel files generated on-demand

## Usage Examples

### Creating a User Backup
```javascript
// Frontend code
const backup = await api.post('/api/admin/backup', {
  description: 'Pre-maintenance backup'
});
// Returns: { filename, filepath, filesize, timestamp, success }
```

### Querying Audit Trail
```javascript
// Get all changes to medicines in last 30 days
const logs = await api.get('/api/admin/audit-logs', {
  params: {
    resourceType: 'medicine',
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    limit: 100
  }
});
```

### Exporting Data
```javascript
// Export inventory with automatic download
window.location.href = '/api/admin/export/inventory';
// Browser downloads: inventory.xlsx
```

### User Management
```javascript
// Create new pharmacist account
await api.post('/api/admin/users', {
  username: 'ram_pharma',
  email: 'ram@pharmacy.local',
  password: 'securepass123',
  role: 'pharmacist'
});

// Change user role
await api.put('/api/admin/users/5/role', {
  role: 'admin'
});
```

## Database Queries

### Getting User Activity
```sql
SELECT id, action, resource_type, resource_id, status, created_at
FROM audit_logs
WHERE user_id = 3
ORDER BY created_at DESC
LIMIT 50;
```

### Audit Statistics
```sql
SELECT action, resource_type, COUNT(*) as count
FROM audit_logs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY action, resource_type;
```

### Finding Failed Operations
```sql
SELECT * FROM audit_logs
WHERE status = 'error'
AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY created_at DESC;
```

## Testing

### Test Admin Account
- **Username:** admin
- **Password:** admin123
- **Role:** admin

### Test Endpoints
```bash
# Check audit logs
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/admin/audit-logs?limit=10"

# Create backup
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description":"test"}' \
  http://localhost:5000/api/admin/backup

# Export medicines
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/admin/export/medicines-excel \
  > medicines.xlsx
```

## Performance Optimizations

1. **Audit Indexes:** Queries on user_id, action, resource_type are indexed
2. **Backup Cleanup:** Automatic removal of old backups (configurable)
3. **Export Streaming:** Large exports streamed to client
4. **Settings Caching:** Could be implemented in future phase

## Future Enhancements

1. **Role Templates:** Pre-built role profiles for common positions
2. **Permission UI:** Visual permission assignment interface
3. **Audit Retention Policy:** Automatic archival of old logs
4. **Backup Encryption:** Encrypt sensitive backup data
5. **Multi-tenancy:** Support multiple pharmacy chains
6. **Advanced Reporting:** Custom report builder for exports
7. **Compliance Reports:** Generate compliance documentation
8. **API Rate Limiting:** Prevent backup/export abuse

## Troubleshooting

### Database Migration Fails
```javascript
// Solution: Check database connectivity and permissions
// Ensure MySQL user has CREATE TABLE, ALTER TABLE privileges
```

### Backup File Not Found
```javascript
// Check backups/ directory exists and has write permissions
// Verify mysqldump is installed and in PATH
```

### Export Timeouts
```javascript
// For large exports, increase Node.js timeout:
// req.socket.setTimeout(300000); // 5 minutes
```

### Role Changes Not Taking Effect
```javascript
// Clear browser cache and re-login
// Token may cache user role in JWT claims
```

## Files Added/Modified

### New Files
- `backend/middleware/rbac.js`
- `backend/services/auditService.js`
- `backend/services/backupService.js`
- `backend/services/exportService.js`
- `backend/config/migrations.js`
- `backend/routes/admin.js`

### Modified Files
- `backend/server.js` - Added admin routes and migrations
- `backend/package.json` - Added exceljs dependency
- `frontend/src/components/pages/Settings.jsx` - Complete rewrite with admin features
- `frontend/src/api.js` - Added 20+ admin API methods

### Database Changes
- New tables: users, audit_logs, backups, settings
- New column: transactions.user_role

## Deployment Checklist

- [ ] Run `npm install` in backend to install exceljs
- [ ] Run migrations to create new tables
- [ ] Create backup directory with write permissions
- [ ] Test admin login with default credentials
- [ ] Change default admin password
- [ ] Create additional admin/pharmacist accounts
- [ ] Configure backup retention policy in settings
- [ ] Test backup creation and restoration
- [ ] Test data exports with various data sets
- [ ] Verify audit logs are recording all actions
- [ ] Review and audit user access levels

## Summary

Phase 2C adds comprehensive administrative capabilities to the Pharmacy ERP:

✅ **Role-Based Access Control** - Granular permission management for 3 user roles
✅ **Audit Logging** - Complete audit trail of all system changes
✅ **Backup & Restore** - Automated and manual backup with restoration capability
✅ **Data Export** - Multi-format export (CSV/Excel) for reporting
✅ **User Management** - Admin interface for creating and managing users
✅ **Settings Management** - Centralized application settings

The system is now enterprise-ready with security, compliance, and operational features for production pharmacy environments.
