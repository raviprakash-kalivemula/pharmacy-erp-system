const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
require('dotenv').config();

const { errorHandler, notFound } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/authMiddleware');
const { auditLogMiddleware } = require('./middleware/auditLog');
const { featureFlagsMiddleware } = require('./middleware/featureFlags');
const MigrationRunner = require('./utils/migrationRunner');
const initializeSocket = require('./config/socket');
const { runMigrations } = require('./config/migrations');
const BackupService = require('./services/backupService');
const logger = require('./utils/logger');

// Initialize Express app FIRST
const app = express();

// Create HTTP server for Socket.io
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Run Phase 2C migrations (RBAC, Audit, Backups, Settings)
runMigrations().catch(err => {
  console.error('❌ Phase 2C Migration error:', err.message);
});

// Run pending legacy migrations on startup
const migrationRunner = new MigrationRunner('./migrations');
migrationRunner.runAll().then(result => {
  if (result.failed === 0) {
    console.log('✅ All database migrations applied successfully');
  } else {
    console.warn(`⚠️  ${result.failed} migration(s) failed`);
  }
}).catch(err => {
  console.error('❌ Migration error:', err.message);
});

// Schedule automatic backups
try {
  BackupService.scheduleAutomaticBackups();
} catch (error) {
  logger.warn('Automatic backups scheduling error:', error.message);
}

// Auth routes (NO authentication required)
app.use('/auth', require('./routes/google-auth'));
app.use('/auth', require('./routes/auth'));

// Audit logging middleware for POST, PUT, DELETE requests
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    auditLogMiddleware(req, res, next);
  } else {
    next();
  }
});

// Authentication middleware for all /api/* routes
app.use('/api', authMiddleware);

// Feature flags middleware
app.use('/api', featureFlagsMiddleware);

// Protected Routes (require authentication)
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/medicines', require('./routes/medicines'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/print', require('./routes/print'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/security', require('./routes/auditLogs'));
app.use('/api/analytics', require('./routes/analytics'));

// Phase 2C: Advanced admin routes with RBAC
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: '✅ Sri Raghavendra Medical API Running!',
    status: 'active'
  });
});

// 404 handler (must be before error handler)
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

// Initialize Socket.io
const { io, realtime } = initializeSocket(server);

// Make realtime service available to routes (optional, for broadcasting from API)
app.locals.realtime = realtime;
app.locals.io = io;

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🏥 Sri Raghavendra Medical - API Server`);
  console.log(`${'='.repeat(50)}`);
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`✅ Status: Running`);
  console.log(`🔌 Real-time: Socket.io Active`);
  console.log(`${'='.repeat(50)}\n`);
});