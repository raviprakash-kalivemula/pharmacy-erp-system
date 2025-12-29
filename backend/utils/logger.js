const fs = require('fs');
const path = require('path');

// Simple logger (Winston-like interface but lightweight)
class Logger {
  constructor() {
    this.logFile = path.join(__dirname, '../server.log');
    this.ensureLogFile();
  }

  ensureLogFile() {
    if (!fs.existsSync(this.logFile)) {
      fs.writeFileSync(this.logFile, '');
    }
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
  }

  writeLog(level, message, meta) {
    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Console output with colors
    const colors = {
      error: '\x1b[31m',
      warn: '\x1b[33m',
      info: '\x1b[36m',
      debug: '\x1b[90m',
      reset: '\x1b[0m'
    };
    
    console.log(`${colors[level] || ''}${formattedMessage.trim()}${colors.reset}`);
    
    // File output
    try {
      fs.appendFileSync(this.logFile, formattedMessage);
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  error(message, meta = {}) {
    this.writeLog('error', message, meta);
  }

  warn(message, meta = {}) {
    this.writeLog('warn', message, meta);
  }

  info(message, meta = {}) {
    this.writeLog('info', message, meta);
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      this.writeLog('debug', message, meta);
    }
  }

  // HTTP request logger
  logRequest(req, res, responseTime) {
    const message = `${req.method} ${req.path} ${res.statusCode} - ${responseTime}ms`;
    const meta = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    };
    
    if (res.statusCode >= 500) {
      this.error(message, meta);
    } else if (res.statusCode >= 400) {
      this.warn(message, meta);
    } else {
      this.info(message, meta);
    }
  }

  // Clear old logs (keep last 7 days)
  clearOldLogs() {
    try {
      const logContent = fs.readFileSync(this.logFile, 'utf8');
      const lines = logContent.split('\n');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentLogs = lines.filter(line => {
        const match = line.match(/\[(\d{4}-\d{2}-\d{2})/);
        if (!match) return false;
        const logDate = new Date(match[1]);
        return logDate >= sevenDaysAgo;
      });
      
      fs.writeFileSync(this.logFile, recentLogs.join('\n'));
      this.info('Old logs cleared successfully');
    } catch (err) {
      this.error('Failed to clear old logs', { error: err.message });
    }
  }
}

// Create singleton instance
const logger = new Logger();

// Middleware for Express
logger.middleware = (req, res, next) => {
  const start = Date.now();
  
  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req, res, duration);
  });
  
  next();
};

module.exports = logger;