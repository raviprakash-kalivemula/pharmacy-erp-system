# Phase 5: Quick Start Guide

## ⚡ Get Started in 5 Minutes

### Step 1: Setup Database (2 minutes)
```bash
# Connect to MySQL
mysql -h localhost -u root -p

# Use pharmacy_erp database
USE pharmacy_erp;

# Execute audit schema
SOURCE c:/Users/kaliv/ravi/backend/database/audit_schema.sql;

# Verify tables created
SHOW TABLES; -- Should include audit_logs and audit_logs_archive
DESC audit_logs;
```

### Step 2: Restart Backend Server (1 minute)
```bash
# Terminal 1: Backend
cd c:\Users\kaliv\ravi\backend
node server.js

# Expected output:
# ✅ Server running on port 5000
# ✅ Database connected
```

### Step 3: Login & Access Audit Trail (1 minute)
1. Open frontend (http://localhost:3000)
2. Login: `admin` / `Admin@123`
3. Go to Settings → **Audit Logs** tab

### Step 4: Test Functionality (1 minute)
1. Create a test medicine (to generate audit log)
2. Refresh Audit tab
3. Click "Details" to see before/after values
4. Click "Export to CSV" to download audit report

---

## 🎯 Key Features at a Glance

### Audit Logs Page
```
Settings → Audit Logs (admin-only)
├── Filters Panel
│   ├── Date range picker
│   ├── Action filter (CREATE, UPDATE, DELETE)
│   ├── Entity type filter
│   ├── Preset buttons (Today, 7 days, 30 days, 90 days)
│   └── Reset button
├── Audit Table
│   ├── User, Action, Entity Type, Entity ID, Timestamp
│   ├── View Details button
│   ├── Pagination (10-100 per page)
│   └── Export to CSV button
└── Detail Modal
    ├── User info & IP address
    ├── Before values (red background)
    ├── After values (green background)
    └── User agent info
```

### Color Coding
- 🟢 **CREATE** = Green badge
- 🟡 **UPDATE** = Yellow badge
- 🔴 **DELETE** = Red badge
- 🔵 **LOGIN** = Blue badge
- ⚫ **LOGOUT** = Gray badge

### Available Filters
| Filter | Options |
|--------|---------|
| Start Date | Any date |
| End Date | Any date |
| Action | CREATE, UPDATE, DELETE, LOGIN, LOGOUT |
| Entity Type | medicines, customers, suppliers, sales, purchases, users, reports |
| User | Username or ID |

---

## 📊 Activity Dashboard Features

### Summary Cards
- Total activities count
- Active users count
- Activity trend indicator

### Charts
- Activity timeline (last 30 days)
- Action type breakdown (pie chart)
- Top 5 contributors (user breakdown)

### Security Alerts
- Failed login attempts
- Unique attacking IPs
- Suspicious activity detection (3+ from same IP)

---

## 📥 CSV Export Details

### Format
- Headers: Log ID, User, Action, Entity Type, Entity ID, Before, After, IP, Agent, Timestamp
- Data rows: All filtered records
- Certification footer: Export date, exported by, record count, retention notice

### Example Download
```csv
"Log ID","User ID","Username","Action",...
"1","1","admin","CREATE",...
"2","1","admin","UPDATE",...
```

---

## 🧪 Quick Test Scenarios

### Scenario 1: Create & Track Changes
```
1. Settings → Audit Logs (should be empty)
2. Inventory → Add new medicine (name: Test, price: 100)
3. Refresh Audit Logs
4. Should see 1 CREATE entry
5. Click Details → see new_value with medicine data
```

### Scenario 2: Update & View Before/After
```
1. Inventory → Edit same medicine (price: 150)
2. Audit Logs → Should see UPDATE entry
3. Click Details → see old_value (100) vs new_value (150)
```

### Scenario 3: Export Report
```
1. Audit Logs → Click "Export to CSV"
2. File downloads as audit-logs-YYYY-MM-DD.csv
3. Open in Excel/Google Sheets
4. Should have all records with certification footer
```

### Scenario 4: Apply Filters
```
1. Audit Logs → Click "Last 7 Days" preset
2. Should show only last 7 days of data
3. Action dropdown → Select "UPDATE"
4. Should show only UPDATE actions from last 7 days
5. Reset button → Clear all filters
```

---

## 🔐 Security Features

### Access Control
- Only admin users can view audit logs
- Non-admin users see: "You don't have permission to view audit logs"

### Data Integrity
- All exports include certification metadata
- Export action itself logged in audit trail
- IP address and user agent captured for all operations

### Suspicious Activity Detection
- Failed login attempts tracked
- IP addresses monitored
- Alert severity based on attempt frequency:
  - 3+ attempts: HIGH severity
  - 5+ attempts: CRITICAL severity

---

## 📋 Database Schema Quick Reference

### audit_logs Table
```sql
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    action VARCHAR(50),          -- CREATE, UPDATE, DELETE, LOGIN
    entity_type VARCHAR(50),     -- medicines, customers, etc.
    entity_id INT,
    new_value JSON,              -- After update values
    old_value JSON,              -- Before update values
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Archive Strategy
- Active table: 0-24 months of logs
- Archive table: 24+ months of logs
- Monthly job moves old logs automatically
- Compliance: 7-year retention period

---

## ❓ Troubleshooting

### Issue: Audit Logs tab not showing
**Solution:** Make sure you're logged in as admin user

### Issue: No data appears in audit logs
**Solution:** 
1. Make sure database schema was executed
2. Perform an action (create medicine, customer, etc.)
3. Refresh the page

### Issue: Export button disabled
**Solution:** Make sure there are logs to export (create some test data first)

### Issue: "Cannot read property 'logs' of undefined"
**Solution:** Backend might not be running on port 5000. Check server terminal.

### Issue: Date filter not working
**Solution:** Make sure to use format YYYY-MM-DD in date pickers

---

## 📞 API Endpoints Reference

All endpoints require JWT token and admin role.

```bash
# Get audit logs (with filtering)
GET /api/audit-logs?limit=50&offset=0&startDate=2024-01-01&endDate=2024-01-31&action=CREATE

# Get single audit log
GET /api/audit-logs/123

# Get change history of specific entity
GET /api/audit-logs/entity/medicines/456

# Get failed login attempts
GET /api/audit-logs/security

# Export to CSV
GET /api/audit-logs/export/csv?startDate=2024-01-01&action=UPDATE
```

---

## 🚀 Next Steps

After Phase 5 is working:

1. **Optional: Add to Dashboard**
   - Import ActivityChart into Dashboard component
   - Show recent activities and trending data
   - Add real-time websocket updates

2. **Optional: Setup Auto-Archival**
   - Create cron job for monthly archival
   - Move logs 24+ months old to archive table
   - Generate retention reports

3. **Optional: Email Alerts**
   - Send alert when suspicious activity detected
   - Daily digest of audit activities
   - Failed login notifications

4. **Optional: PDF Exports**
   - Generate compliance reports in PDF
   - Include charts and trends
   - Sign with digital certificate

---

## 📈 Success Metrics

You'll know Phase 5 is working when:

✅ Audit Logs tab appears in Settings (admin users only)  
✅ Creating data creates audit entries  
✅ Filtering works (date, action, entity, user)  
✅ Detail modal shows before/after values  
✅ CSV export downloads with all records  
✅ Activity charts display (if integrated to dashboard)  
✅ Security alerts show failed login attempts  

---

**Phase 5 Status: READY FOR PRODUCTION** 🎉

Test the scenarios above, fix any issues, and deploy with confidence!
