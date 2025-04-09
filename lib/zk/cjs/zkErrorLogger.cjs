/**
 * ZK Error Logging and Aggregation System - CommonJS Version
 * 
 * This is the CommonJS compatibility wrapper for the ESM zkErrorLogger module.
 * It re-exports all functionality from the ESM version for use with require().
 */

// Import the error handler module
const zkErrorHandler = require('./zkErrorHandler.cjs');
const { isZKError, fromError, ErrorSeverity } = zkErrorHandler;

// Logging levels
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
  CRITICAL: 4,
  SILENT: 5
};

// Privacy levels
const PrivacyLevel = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

// Default configuration
const DEFAULT_CONFIG = {
  logLevel: LogLevel.ERROR,
  privacyLevel: PrivacyLevel.MEDIUM,
  includeTimestamps: true,
  includeErrorId: true,
  maxErrorsPerMinute: 60,
  errorStorageSize: 100,
  errorExpirationMs: 3600000, // 1 hour
  destinations: ['console'],
  developerMode: false,
  appVersion: '1.0.0',
  onErrorLogged: null
};

/**
 * Creates a redacted copy of an object with sensitive data removed
 * @param {Object} obj - Object to redact
 * @returns {Object} Redacted copy
 */
function redactSensitiveData(obj) {
  if (!obj) return obj;
  
  // Sensitive field patterns
  const sensitiveFields = [
    /wallet/i, /private/i, /key/i, /secret/i, /password/i, /token/i, 
    /seed/i, /mnemonic/i, /signature/i, /auth/i, /credential/i
  ];

  // Deep copy the object first
  const redacted = JSON.parse(JSON.stringify(obj));
  
  // Recursively process fields
  function redactFields(object) {
    if (!object || typeof object !== 'object') return;
    
    for (const key in object) {
      // Check if field name matches sensitive patterns
      const isSensitive = sensitiveFields.some(pattern => pattern.test(key));
      
      if (isSensitive && object[key]) {
        if (typeof object[key] === 'string') {
          // Redact strings but keep length info
          const len = object[key].length;
          object[key] = `[REDACTED:${len}]`;
        } else {
          // Remove non-string sensitive data entirely
          object[key] = '[REDACTED]';
        }
      } else if (object[key] && typeof object[key] === 'object') {
        // Recursively redact nested objects
        redactFields(object[key]);
      }
    }
  }
  
  redactFields(redacted);
  return redacted;
}

/**
 * Error logger class for ZK operations
 */
class ZKErrorLogger {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.errorCounts = new Map();
    this.errorCountsTimestamp = Date.now();
    this.recentErrors = [];
    this.errorPatterns = new Map();
    
    // Bind methods
    this.log = this.log.bind(this);
    this.logError = this.logError.bind(this);
    this.analyzeErrorPatterns = this.analyzeErrorPatterns.bind(this);
    this.resetErrorCounts = this.resetErrorCounts.bind(this);
    
    // Set up automatic reset of error counts
    setInterval(this.resetErrorCounts, 60000); // Reset every minute
  }
  
  // ... Method implementations remain the same as in mjs version
  
  /**
   * Reset error count tracking
   */
  resetErrorCounts() {
    this.errorCounts = new Map();
    this.errorCountsTimestamp = Date.now();
    
    // Clean up expired errors from recent errors list
    const now = Date.now();
    this.recentErrors = this.recentErrors.filter(error => 
      (now - error.timestamp) < this.config.errorExpirationMs
    );
    
    // Analyze patterns after reset
    this.analyzeErrorPatterns();
  }
  
  // ... other methods are the same as in the mjs version ...
  
  /**
   * Generate a unique error ID
   * @returns {string} Unique error ID
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Increment error count for rate limiting
   * @param {number} errorCode - Error code to track
   * @returns {boolean} Whether the error should be logged (false if rate limited)
   */
  incrementErrorCount(errorCode) {
    // Get current count for this error code
    const currentCount = this.errorCounts.get(errorCode) || 0;
    
    // Check if we've hit the rate limit
    if (currentCount >= this.config.maxErrorsPerMinute) {
      return false;
    }
    
    // Increment the counter
    this.errorCounts.set(errorCode, currentCount + 1);
    
    return true;
  }
  
  /**
   * Store error in recent errors list for pattern analysis
   * @param {Object} errorData - Processed error data
   */
  storeRecentError(errorData) {
    // Add to recent errors, maintaining max size
    this.recentErrors.push(errorData);
    
    if (this.recentErrors.length > this.config.errorStorageSize) {
      this.recentErrors.shift(); // Remove oldest error
    }
  }
  
  /**
   * Analyze error patterns to detect trends
   */
  analyzeErrorPatterns() {
    // Skip if no errors
    if (this.recentErrors.length === 0) {
      return;
    }
    
    // Count errors by code, category, and other dimensions
    const codeFrequency = new Map();
    const categoryFrequency = new Map();
    const userFixableCount = { true: 0, false: 0 };
    const recoverableCount = { true: 0, false: 0 };
    
    // Analyze the errors
    for (const error of this.recentErrors) {
      // Count by error code
      const codeCount = codeFrequency.get(error.code) || 0;
      codeFrequency.set(error.code, codeCount + 1);
      
      // Count by category
      const categoryCount = categoryFrequency.get(error.category) || 0;
      categoryFrequency.set(error.category, categoryCount + 1);
      
      // Count by user fixable
      userFixableCount[error.userFixable ? 'true' : 'false']++;
      
      // Count by recoverable
      recoverableCount[error.recoverable ? 'true' : 'false']++;
    }
    
    // Analyze trending errors
    const totalErrors = this.recentErrors.length;
    const trendingThreshold = Math.max(3, totalErrors * 0.2); // 20% or at least 3
    
    // Find trending error codes
    const trendingCodes = [];
    for (const [code, count] of codeFrequency) {
      if (count >= trendingThreshold) {
        trendingCodes.push({ code, count, percentage: (count / totalErrors) * 100 });
      }
    }
    
    // Find most common categories
    const categoryRanking = [...categoryFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ 
        category, 
        count, 
        percentage: (count / totalErrors) * 100 
      }));
    
    // Store the analysis results
    this.errorPatterns = {
      totalErrors,
      trendingCodes,
      categoryRanking,
      userFixablePercentage: (userFixableCount.true / totalErrors) * 100,
      recoverablePercentage: (recoverableCount.true / totalErrors) * 100,
      analysisTimestamp: Date.now()
    };
    
    return this.errorPatterns;
  }
  
  /**
   * Format error data based on privacy level
   * @param {Error} error - Original error
   * @param {Object} additionalData - Additional data to include
   * @returns {Object} Formatted error data
   */
  formatErrorData(error, additionalData = {}) {
    // Convert to ZKError if needed
    const zkError = isZKError(error) ? error : fromError(error, {
      severity: ErrorSeverity.ERROR,
      ...additionalData
    });
    
    // Generate error ID if needed
    const errorId = this.config.includeErrorId ? 
      (additionalData.errorId || this.generateErrorId()) : undefined;
    
    // Create base error data
    const timestamp = this.config.includeTimestamps ? 
      (additionalData.timestamp || new Date()) : undefined;
    
    // Build error data object based on privacy level
    let errorData = {
      errorId,
      timestamp: timestamp ? timestamp.toISOString() : undefined,
      code: zkError.code,
      name: zkError.name,
      message: zkError.message,
      severity: zkError.severity,
      category: zkError.category,
      appVersion: this.config.appVersion
    };
    
    // Add source location if available and privacy level permits
    if (this.config.privacyLevel === PrivacyLevel.LOW) {
      if (zkError.stack) {
        const stackLines = zkError.stack.split('\n');
        // Extract just the first few stack frames to avoid excessive data
        errorData.stackTrace = stackLines.slice(0, 3).join('\n');
      }
    }
    
    // Add operational metadata based on privacy level
    if (this.config.privacyLevel !== PrivacyLevel.HIGH) {
      errorData = {
        ...errorData,
        recoverable: zkError.recoverable,
        userFixable: zkError.userFixable,
        expected: zkError.expected,
        securityCritical: zkError.securityCritical,
        operationId: zkError.operationId,
      };
      
      // Add technical details if in developer mode and privacy level permits
      if (this.config.developerMode && this.config.privacyLevel === PrivacyLevel.LOW) {
        errorData.technicalDetails = zkError.technicalDetails;
      }
      
      // Add redacted details if privacy level permits
      if (zkError.details && Object.keys(zkError.details).length > 0) {
        errorData.details = redactSensitiveData(zkError.details);
      }
    }
    
    // Add user-provided additional data, with redaction
    if (additionalData && Object.keys(additionalData).length > 0) {
      errorData.additionalData = redactSensitiveData(additionalData);
    }
    
    return errorData;
  }
  
  /**
   * Log an error with structured data
   * @param {Error} error - The error to log
   * @param {Object} additionalData - Additional data to include
   * @returns {Object} Logged error data
   */
  logError(error, additionalData = {}) {
    if (!error) return null;
    
    try {
      // Convert to ZKError if not already
      const zkError = isZKError(error) ? error : fromError(error, {
        severity: ErrorSeverity.ERROR,
        ...additionalData
      });
      
      // Check log level
      if (this.mapSeverityToLogLevel(zkError.severity) < this.config.logLevel) {
        return null; // Skip logging for this level
      }
      
      // Check error rate limiting
      if (!this.incrementErrorCount(zkError.code)) {
        console.warn(`Error rate limit reached for code ${zkError.code}`);
        return null;
      }
      
      // Format error data based on privacy settings
      const errorData = this.formatErrorData(zkError, additionalData);
      
      // Store for pattern analysis
      this.storeRecentError(errorData);
      
      // Log to configured destinations
      this.logToDestinations(errorData, zkError.severity);
      
      // Trigger callback if configured
      if (typeof this.config.onErrorLogged === 'function') {
        this.config.onErrorLogged(errorData);
      }
      
      return errorData;
    } catch (loggingError) {
      // Fallback logging if error processing fails
      console.error('Error in error logging:', loggingError);
      console.error('Original error:', error);
      return null;
    }
  }
  
  /**
   * Map error severity to log level
   * @param {string} severity - Error severity
   * @returns {number} Corresponding log level
   */
  mapSeverityToLogLevel(severity) {
    switch (severity) {
      case ErrorSeverity.CRITICAL: return LogLevel.CRITICAL;
      case ErrorSeverity.ERROR: return LogLevel.ERROR;
      case ErrorSeverity.WARNING: return LogLevel.WARNING;
      case ErrorSeverity.INFO: return LogLevel.INFO;
      default: return LogLevel.ERROR;
    }
  }
  
  /**
   * Log to all configured destinations
   * @param {Object} errorData - Formatted error data
   * @param {string} severity - Error severity
   */
  logToDestinations(errorData, severity) {
    // Loop through configured destinations
    for (const destination of this.config.destinations) {
      switch (destination) {
        case 'console':
          this.logToConsole(errorData, severity);
          break;
        case 'localStorage':
          this.logToLocalStorage(errorData);
          break;
        case 'server':
          this.logToServer(errorData);
          break;
        // Additional destinations could be added here
      }
    }
  }
  
  /**
   * Log to browser console
   * @param {Object} errorData - Formatted error data
   * @param {string} severity - Error severity
   */
  logToConsole(errorData, severity) {
    const prefix = `[ZK:${errorData.code}]`;
    
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        console.error(`${prefix} CRITICAL:`, errorData);
        break;
      case ErrorSeverity.ERROR:
        console.error(`${prefix} ERROR:`, errorData);
        break;
      case ErrorSeverity.WARNING:
        console.warn(`${prefix} WARNING:`, errorData);
        break;
      case ErrorSeverity.INFO:
        console.info(`${prefix} INFO:`, errorData);
        break;
      default:
        console.log(`${prefix}`, errorData);
    }
  }
  
  /**
   * Log to localStorage for persistence
   * @param {Object} errorData - Formatted error data
   */
  logToLocalStorage(errorData) {
    try {
      // Get existing logs
      const existingLogsString = localStorage.getItem('zk_error_logs');
      const existingLogs = existingLogsString ? 
        JSON.parse(existingLogsString) : [];
      
      // Add new log, keeping only the most recent logs
      existingLogs.push(errorData);
      if (existingLogs.length > 50) {
        existingLogs.shift(); // Remove oldest log
      }
      
      // Save back to localStorage
      localStorage.setItem('zk_error_logs', JSON.stringify(existingLogs));
    } catch (e) {
      // Fall back to console if localStorage fails
      console.error('Failed to log to localStorage:', e);
    }
  }
  
  /**
   * Log to server endpoint
   * @param {Object} errorData - Formatted error data
   */
  logToServer(errorData) {
    // Skip server logging for low severity in production
    if (this.config.privacyLevel === PrivacyLevel.HIGH && 
        errorData.severity === ErrorSeverity.INFO) {
      return;
    }
    
    try {
      // Only send essential data to server
      const serverData = {
        errorId: errorData.errorId,
        timestamp: errorData.timestamp,
        code: errorData.code,
        message: errorData.message,
        severity: errorData.severity,
        category: errorData.category,
        appVersion: errorData.appVersion,
        recoverable: errorData.recoverable,
        userFixable: errorData.userFixable,
        // Add user agent info for browser stats
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        // Only send sanitized operational context
        context: errorData.additionalData ? 
          (errorData.additionalData.context || {}) : {}
      };
      
      // Use sendBeacon if available for reliable delivery even during page unload
      if (navigator && navigator.sendBeacon) {
        navigator.sendBeacon('/api/zk/error-logs', JSON.stringify(serverData));
      } else {
        // Fall back to fetch with keepalive
        fetch('/api/zk/error-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serverData),
          keepalive: true
        }).catch(e => console.error('Failed to send log to server:', e));
      }
    } catch (e) {
      console.error('Error in server logging:', e);
    }
  }
  
  /**
   * Generic log method (mostly for compatibility)
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  log(level, message, data = {}) {
    // Skip logging if below configured level
    if (LogLevel[level] < this.config.logLevel) return;
    
    // Map log level to severity
    let severity;
    switch (level) {
      case 'CRITICAL': severity = ErrorSeverity.CRITICAL; break;
      case 'ERROR': severity = ErrorSeverity.ERROR; break;
      case 'WARNING': severity = ErrorSeverity.WARNING; break;
      case 'INFO': severity = ErrorSeverity.INFO; break;
      default: severity = ErrorSeverity.INFO;
    }
    
    // Create error-like object and log it
    const errorLike = new Error(message);
    return this.logError(errorLike, { 
      severity,
      ...data
    });
  }
  
  /**
   * Get error pattern analysis
   * @returns {Object} Error pattern analysis data
   */
  getErrorPatterns() {
    // Run analysis if not done yet or data is old
    if (!this.errorPatterns || 
        (Date.now() - this.errorPatterns.analysisTimestamp) > 60000) {
      this.analyzeErrorPatterns();
    }
    
    return this.errorPatterns;
  }
  
  /**
   * Get recent errors (for debugging)
   * @param {number} limit - Maximum number of errors to return
   * @returns {Array} Recent errors
   */
  getRecentErrors(limit = 10) {
    // Only return in developer mode
    if (!this.config.developerMode) {
      return [];
    }
    
    return this.recentErrors
      .slice(-limit)
      .map(error => ({
        ...error,
        // Remove sensitive data from returned errors
        details: undefined,
        additionalData: undefined
      }));
  }
  
  /**
   * Update logger configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

// Create a singleton instance with default config
const zkErrorLogger = new ZKErrorLogger();

// Export the singleton, class, and constants
module.exports = {
  zkErrorLogger,
  ZKErrorLogger,
  LogLevel,
  PrivacyLevel
};