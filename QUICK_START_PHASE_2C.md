# Phase 2C Quick Start Guide

## 🚀 Getting Started (5 minutes)

### Step 1: Install Dependencies
```bash
cd backend
npm install
```

### Step 2: Start Both Servers
```bash
# Terminal 1: Backend
npm start

# Terminal 2: Frontend  
cd ../frontend
npm start
```

**Expected Output:**
```
Backend:
✅ Sri Raghavendra Medical - API Server
✅ Status: Running
🔌 Real-time: Socket.io Active
✅ All database migrations applied successfully

Frontend:
webpack compiled with warnings (expected)
Compiled successfully!
```

### Step 3: Login
- Navigate to http://localhost:3000
- **Username:** admin
- **Password:** admin123

### Step 4: Access Settings
- Click "Settings" in sidebar
- You now have 4 new tabs:
  1. Profile - View admin information
  2. User Management - Create/manage users
  3. Backup & Restore - Backup database
  4. Export Data - Export as CSV/Excel

---

## 📊 What Each Tab Does

### Profile Tab
Shows your user information:
- Username (admin)
- Role (admin)
- Administrator badge

### User Management Tab
**Create Users:**
1. Click "Add New User"
2. Enter: username, email, password, role
3. Click "Create User"

**Change Roles:**
- Select new role from dropdown
- Automatically saves

**Deactivate Users:**
- Click "Deactivate" button
- User is marked inactive but not deleted

### Backup & Restore Tab
**View Statistics:**
- Total backups created
- Total size of all backups
- Last backup date
- Average backup size

**Create Backup:**
1. Click "Create Backup Now"
2. Wait 10-30 seconds
3. Backup appears in history table

**Download Backup:**
- Click "Download" in backup history
- Gets SQL dump file

**Restore Backup:**
1. Click "Restore" in backup history
2. Confirm action (⚠️ warns it will overwrite current database)
3. Database is restored

**Automatic Backups:**
- System creates backup daily at 2:00 AM
- Keeps last 7 backups automatically

### Export Data Tab
Click any card to export:

**Medicines (Excel)**
- All medicine information
- Professional formatting
- Ready for spreadsheet analysis

**Customers (CSV)**
- All customer records
- Open in Excel or Google Sheets

**Inventory (Excel)**
- Current stock levels
- Color-coded status (Red=Out, Yellow=Low, Green=Healthy)

**Audit Logs (CSV)**
- All system actions
- Who did what, when
- For compliance/auditing

**Sales (CSV)**
- By date range
- Transaction details
- Payment status

---

## 🔐 Accounts & Roles

### Default Admin Account
```
Username: admin
Password: admin123
Role: admin
```
⚠️ Change this password immediately in production!

### Role Permissions

**Admin Role** ✅
- View, create, edit, delete everything
- User management
- Backup & restore
- Data export
- View audit logs
- Change system settings

**Pharmacist Role** 📋
- View medicines, customers, sales
- Create & edit sales and purchases
- Cannot delete medicines
- Cannot access admin features
- No user management access

**Viewer Role** 👁️
- View-only access
- Cannot create or edit
- Cannot access admin features
- Good for reports-only access

---

## 📈 Monitoring Features

### Audit Trail
Every admin action is logged:
- Who made the change
- What was changed
- When it happened
- IP address
- Success/failure

**To view:**
- Backend logs show audit entries
- Export audit logs from Settings

### Backup History
Automatic cleanup:
- Keeps last 7 backups
- Older backups deleted automatically
- Saves disk space

---

## 🛠️ Common Tasks

### Create New Pharmacist Account
1. Go to Settings → User Management
2. Click "Add New User"
3. Fill in:
   - Username: `ram_pharmacy`
   - Email: `ram@pharmacy.local`
   - Password: `SecurePass123!`
   - Role: `pharmacist`
4. Click "Create User"

### Create Daily Backup Manually
1. Go to Settings → Backup & Restore
2. Click "Create Backup Now"
3. Wait for completion
4. See backup in history

### Export Medicines List for Inventory Check
1. Go to Settings → Export Data
2. Click "Export Medicines"
3. File downloads as `medicines.xlsx`
4. Open in Excel

### Check Who Did What
1. Go to Settings → Audit Logs (if added to UI)
2. Filter by date/user
3. See detailed action history

---

## ⚠️ Important Notes

### Backup Restore Warning
- Restore overwrites current database
- Choose correct backup before confirming
- Takes 10-30 seconds
- Confirm dialog prevents accidents

### Password Requirements
- Minimum 6 characters recommended
- No validation enforced yet (future enhancement)
- Store securely!

### Default Settings
Located in database `settings` table:
- app_name: Sri Raghavendra Medical
- backup_keep_count: 7
- audit_retention_days: 90
- low_stock_threshold: 10
- currency_symbol: ₹

These can be updated via settings API endpoints.

---

## 🔍 Troubleshooting

### "Permission Denied" Error
**Issue:** Non-admin user trying to access admin features
**Solution:** Login as admin or ask admin to increase your role

### Backup Creation Failed
**Issue:** mysqldump command not found
**Solution:** 
- Windows: Add MySQL to PATH
- Mac: Install via Homebrew: `brew install mysql`
- Linux: Install via package manager

### Export Not Downloading
**Issue:** Browser blocking popup/download
**Solution:** 
- Check browser download settings
- Disable popup blockers
- Try different browser

### Can't Login After Password Change
**Issue:** Password not updated correctly
**Solution:**
- Use default admin account to reset user
- Delete user and recreate with new password

---

## 📊 Database Info

### New Tables Created
```sql
-- User accounts
SELECT * FROM users;

-- Complete audit trail
SELECT * FROM audit_logs LIMIT 10;

-- Backup history
SELECT * FROM backups;

-- Application settings
SELECT * FROM settings;
```

### Quick Queries

**Count all actions by user:**
```sql
SELECT username, COUNT(*) as actions 
FROM audit_logs 
GROUP BY username 
ORDER BY actions DESC;
```

**Find failed operations:**
```sql
SELECT username, action, error_message, created_at
FROM audit_logs
WHERE status = 'error'
ORDER BY created_at DESC;
```

**Check backup sizes:**
```sql
SELECT filename, size/1024/1024 as size_mb, created_at
FROM backups
ORDER BY created_at DESC;
```

---

## 🎯 Next Steps

### For Testing
1. ✅ Login as admin
2. ✅ Create test user (pharmacist)
3. ✅ Create backup
4. ✅ Export data
5. ✅ View audit logs
6. ✅ Check database tables

### For Production
1. ⚠️ Change default admin password
2. ⚠️ Create production admin accounts
3. ⚠️ Set up backup schedule
4. ⚠️ Configure backup retention
5. ⚠️ Review audit logs regularly
6. ⚠️ Test restore procedure

### For Team
1. 📖 Document role assignments
2. 📖 Create user accounts for staff
3. 📖 Set password policies
4. 📖 Train on backup procedures
5. 📖 Schedule regular audits

---

## 💡 Tips & Tricks

### Faster Backups
- Run during off-peak hours
- Schedule automatic backups at 2 AM
- Keep last 7 backups (configurable)

### Efficient Exports
- Export periodically for records
- Use filters to limit data
- Save exports with date in filename

### Audit Trail Usage
- Review monthly for compliance
- Export for reports/audits
- Track user activity patterns

### Security Best Practices
- Change default admin password first
- Use strong passwords for all accounts
- Review audit logs monthly
- Keep regular backups
- Test restore procedure quarterly

---

## 📞 Support

If you encounter issues:

1. **Check logs:**
   ```bash
   # Backend logs show detailed errors
   npm start  # See error output
   ```

2. **Check database:**
   ```bash
   # Verify tables exist
   SHOW TABLES;
   DESCRIBE users;
   DESCRIBE audit_logs;
   ```

3. **Clear cache:**
   - Clear browser cache
   - Logout and login again
   - Restart servers

4. **Reset to defaults:**
   - Delete user, create new one
   - Delete backup, create new one
   - Check SQL statements directly

---

## 🎉 You're All Set!

Phase 2C is now fully operational with:
- ✅ Role-Based Access Control
- ✅ Enhanced Audit Logging
- ✅ Backup & Restore
- ✅ Data Export

Start exploring the Settings page to see all new features in action!
