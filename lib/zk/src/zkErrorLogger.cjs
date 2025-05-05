/**
 * CommonJS version of zkErrorLogger
 * 
 * This file provides a CommonJS-compatible version of the ZKErrorLogger
 * for use in testing environments and non-ESM contexts.
 * 
 * @module zkErrorLogger
 */

// Import the error handler classes we need
const { ErrorSeverity, ErrorCategory, ZKError } = require('./zkErrorHandler.js');

// Define the privacy levels for error logging
/**
 * Privacy levels for controlling what information gets logged.
 * Used to filter sensitive data from logs based on environment and configuration.
 * 
 * @enum {string}
 */
const PrivacyLevel = {
  PUBLIC: 'public',       // Information safe to log anywhere
  INTERNAL: 'internal',   // Information for internal systems only
  SENSITIVE: 'sensitive', // Sensitive information that should be restricted
  PRIVATE: 'private'      // Private information that should never be logged
};

// Define log levels
/**
 * Log levels for categorizing the importance of logged information.
 * Used to filter logs based on verbosity settings.
 * 
 * @enum {string}
 */
const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  CRITICAL: 'critical'
};

// Simple fallback logger that works without the full module
/**
 * Error logger for ZK operations.
 * Provides structured logging with privacy controls and severity levels.
 * 
 * @class
 */
class ZKErrorLogger {
  /**
   * Create a new ZKErrorLogger instance
   * 
   * @param {Object} [options={}] - Logger configuration options
   * @param {boolean} [options.enabled=true] - Whether logging is enabled
   * @param {string} [options.logLevel='info'] - Minimum log level to record
   * @param {string} [options.privacyLevel='internal'] - Privacy level for filtering sensitive data
   * @param {boolean} [options.logToConsole=true] - Whether to output logs to console
   * @param {boolean} [options.developerMode=false] - Enable developer mode for testing
   * @param {Array<string>} [options.destinations=['console']] - Output destinations
   */
  constructor(options = {}) {
    this.options = {
      enabled: options.enabled !== false,
      logLevel: options.logLevel || LogLevel.INFO,
      privacyLevel: options.privacyLevel || PrivacyLevel.INTERNAL,
      logToConsole: options.logToConsole !== false,
      developerMode: options.developerMode || false,
      destinations: options.destinations || ['console'],
      ...options
    };

    // Initialize fallback internal logging
    this.initializeLogger();
  }

  /**
   * Update logger configuration
   * 
   * @param {Object} options - New configuration options
   * @param {boolean} [options.enabled] - Whether logging is enabled
   * @param {string} [options.logLevel] - Minimum log level to record
   * @param {string} [options.privacyLevel] - Privacy level for filtering sensitive data
   * @param {boolean} [options.logToConsole] - Whether to output logs to console
   * @param {boolean} [options.developerMode] - Enable developer mode for testing
   * @param {Array<string>} [options.destinations] - Output destinations
   * @returns {Object} The updated configuration
   */
  updateConfig(options = {}) {
    this.options = {
      ...this.options,
      ...options
    };

    // Reinitialize logger with new configuration
    this.initializeLogger();
    
    return this.options;
  }

  /**
   * Initialize the internal logger based on configuration
   * @private
   */
  initializeLogger() {
    // Simple internal logger
    this.logger = {
      debug: (...args) => {
        if (this.isLevelEnabled(LogLevel.DEBUG)) {
          console.debug('[ZK Debug]', ...args);
        }
      },
      info: (...args) => {
        if (this.isLevelEnabled(LogLevel.INFO)) {
          console.info('[ZK Info]', ...args);
        }
      },
      warn: (...args) => {
        if (this.isLevelEnabled(LogLevel.WARN)) {
          console.warn('[ZK Warning]', ...args);
        }
      },
      error: (...args) => {
        if (this.isLevelEnabled(LogLevel.ERROR)) {
          console.error('[ZK Error]', ...args);
        }
      },
      critical: (...args) => {
        if (this.isLevelEnabled(LogLevel.CRITICAL)) {
          console.error('[ZK CRITICAL]', ...args);
        }
      }
    };
  }

  /**
   * Check if a log level is enabled based on configuration
   * 
   * @param {string} level - The log level to check
   * @returns {boolean} Whether the log level is enabled
   * @private
   */
  isLevelEnabled(level) {
    if (!this.options.enabled) return false;

    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
      LogLevel.CRITICAL
    ];

    const configuredIndex = levels.indexOf(this.options.logLevel);
    const targetIndex = levels.indexOf(level);

    return targetIndex >= configuredIndex;
  }

  /**
   * Log an error with context information
   * 
   * @param {Error} error - The error to log
   * @param {Object} [context={}] - Additional context information
   * @returns {Object} The log data including operation ID for tracking
   */
  logError(error, context = {}) {
    if (!this.options.enabled) return { operationId: 'logging-disabled' };

    // Determine error severity
    const severity = error.severity ||
      (error instanceof ZKError ? error.severity : ErrorSeverity.ERROR);

    // Map severity to log level
    const logLevel = this.mapSeverityToLogLevel(severity);

    // Create structured log data with privacy filtering
    const logData = this.createStructuredLogData(error, context);

    // Log using the appropriate level
    this.logWithLevel(logLevel, error.message || 'An error occurred', logData);

    return logData;
  }

  /**
   * Log a message with arbitrary severity/level
   * 
   * @param {string} level - The log level to use
   * @param {string} message - The message to log
   * @param {Object} [context={}] - Additional context information
   * @returns {Object} The log data including operation ID for tracking
   */
  log(level, message, context = {}) {
    return this.logEvent(level, message, context);
  }

  /**
   * Map severity level to log level
   * 
   * @param {string} severity - The severity level from the error
   * @returns {string} The corresponding log level
   * @private
   */
  mapSeverityToLogLevel(severity) {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return LogLevel.CRITICAL;
      case ErrorSeverity.ERROR:
        return LogLevel.ERROR;
      case ErrorSeverity.WARNING:
        return LogLevel.WARN;
      case ErrorSeverity.INFO:
        return LogLevel.INFO;
      default:
        return LogLevel.ERROR;
    }
  }

  /**
   * Create a structured log data object from an error and context
   * 
   * @param {Error} error - The error to structure
   * @param {Object} context - Additional context information
   * @returns {Object} Structured log data object
   * @private
   */
  createStructuredLogData(error, context) {
    const timestamp = new Date().toISOString();
    const operationId = context.operationId ||
      error.operationId ||
      `error_${timestamp.replace(/[-:.TZ]/g, '')}_${Math.random().toString(36).substr(2, 5)}`;

    // Base structured data that's safe to log
    const safeData = {
      timestamp,
      operationId,
      message: error.message || 'Unknown error',
      errorType: error.name || (error instanceof Error ? error.constructor.name : 'Unknown'),
      errorCode: error.code || 0,
      severity: error.severity || ErrorSeverity.ERROR,
      environment: typeof window === 'undefined' ? 'node' : 'browser',
      context: context.context || 'unknown',
      recoverable: !!error.recoverable
    };

    // Add stacktrace for internal and higher privacy
    if (this.isPrivacyLevelAllowed(PrivacyLevel.INTERNAL)) {
      safeData.stack = error.stack;
    }

    // Add error details if available and privacy allows
    if (error.details && this.isPrivacyLevelAllowed(PrivacyLevel.SENSITIVE)) {
      safeData.details = this.sanitizeObject(error.details);
    }

    // Add additional context if privacy allows
    if (context && this.isPrivacyLevelAllowed(PrivacyLevel.SENSITIVE)) {
      safeData.additionalContext = this.sanitizeObject(context);
    }

    return safeData;
  }

  /**
   * Check if a privacy level is allowed based on configuration
   * 
   * @param {string} level - The privacy level to check
   * @returns {boolean} Whether the privacy level is allowed
   * @private
   */
  isPrivacyLevelAllowed(level) {
    const levels = [
      PrivacyLevel.PUBLIC,
      PrivacyLevel.INTERNAL,
      PrivacyLevel.SENSITIVE,
      PrivacyLevel.PRIVATE
    ];

    const configuredIndex = levels.indexOf(this.options.privacyLevel);
    const targetIndex = levels.indexOf(level);

    // Lower index means more permissive
    return targetIndex <= configuredIndex;
  }

  /**
   * Sanitize an object by redacting sensitive fields
   * 
   * @param {Object} obj - The object to sanitize
   * @returns {Object} Sanitized copy of the object
   * @private
   */
  sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    // Deep copy to avoid modifying the original
    const sanitized = JSON.parse(JSON.stringify(obj));

    // List of sensitive key patterns to redact
    const sensitiveKeys = [
      /password/i, /secret/i, /key/i, /token/i, /auth/i, /credential/i,
      /private/i, /seed/i, /mnemonic/i, /witness/i
    ];

    // Recursively sanitize the object
    function sanitizeRecursive(current) {
      if (!current || typeof current !== 'object') return;

      Object.keys(current).forEach(key => {
        // Check if key matches any sensitive pattern
        const isSensitive = sensitiveKeys.some(pattern => pattern.test(key));

        if (isSensitive && current[key]) {
          // Redact sensitive values but keep the type information
          const type = typeof current[key];
          if (type === 'string') {
            current[key] = '[REDACTED]';
          } else if (type === 'object' && current[key] !== null) {
            current[key] = Array.isArray(current[key])
              ? '[REDACTED ARRAY]'
              : '[REDACTED OBJECT]';
          } else {
            current[key] = '[REDACTED]';
          }
        } else if (typeof current[key] === 'object' && current[key] !== null) {
          // Recurse into nested objects/arrays
          sanitizeRecursive(current[key]);
        }
      });
    }

    sanitizeRecursive(sanitized);
    return sanitized;
  }

  /**
   * Log a message with the specified log level
   * 
   * @param {string} level - The log level to use
   * @param {string} message - The message to log
   * @param {Object} data - Additional data to include
   * @private
   */
  logWithLevel(level, message, data) {
    // Skip logging if not enabled or level not enabled
    if (!this.options.enabled || !this.isLevelEnabled(level)) {
      return;
    }
    
    // In developer mode, we only log to configured destinations
    if (this.options.developerMode) {
      // Check if console is in the destinations
      if (this.options.destinations.includes('console')) {
        switch (level) {
          case LogLevel.DEBUG:
            this.logger.debug(message, data);
            break;
          case LogLevel.INFO:
            this.logger.info(message, data);
            break;
          case LogLevel.WARN:
            this.logger.warn(message, data);
            break;
          case LogLevel.ERROR:
            this.logger.error(message, data);
            break;
          case LogLevel.CRITICAL:
            this.logger.critical(message, data);
            break;
          default:
            this.logger.error(message, data);
        }
      }
      
      // Add custom destination handling here if needed
      // For example, file logging, remote logging, etc.
      return;
    }
    
    // Normal (non-developer) mode logging
    switch (level) {
      case LogLevel.DEBUG:
        this.logger.debug(message, data);
        break;
      case LogLevel.INFO:
        this.logger.info(message, data);
        break;
      case LogLevel.WARN:
        this.logger.warn(message, data);
        break;
      case LogLevel.ERROR:
        this.logger.error(message, data);
        break;
      case LogLevel.CRITICAL:
        this.logger.critical(message, data);
        break;
      default:
        this.logger.error(message, data);
    }
  }

  /**
   * Log an event with the specified level and message
   * 
   * @param {string} level - The log level to use
   * @param {string} message - The message to log
   * @param {Object} [data={}] - Additional data to include
   * @returns {Object} The log data including operation ID for tracking
   */
  logEvent(level, message, data = {}) {
    if (!this.isLevelEnabled(level)) return { operationId: 'logging-disabled' };

    const timestamp = new Date().toISOString();
    const operationId = data.operationId ||
      `event_${timestamp.replace(/[-:.TZ]/g, '')}_${Math.random().toString(36).substr(2, 5)}`;

    const eventData = {
      timestamp,
      operationId,
      message,
      level,
      context: data.context || 'event',
      ...this.sanitizeObject(data)
    };

    this.logWithLevel(level, message, eventData);
    return eventData;
  }

  /**
   * Log a debug message
   * 
   * @param {string} message - The message to log
   * @param {Object} [data={}] - Additional data to include
   * @returns {Object} The log data including operation ID for tracking
   */
  debug(message, data = {}) {
    return this.logEvent(LogLevel.DEBUG, message, data);
  }

  /**
   * Log an informational message
   * 
   * @param {string} message - The message to log
   * @param {Object} [data={}] - Additional data to include
   * @returns {Object} The log data including operation ID for tracking
   */
  info(message, data = {}) {
    return this.logEvent(LogLevel.INFO, message, data);
  }

  /**
   * Log a warning message
   * 
   * @param {string} message - The message to log
   * @param {Object} [data={}] - Additional data to include
   * @returns {Object} The log data including operation ID for tracking
   */
  warn(message, data = {}) {
    return this.logEvent(LogLevel.WARN, message, data);
  }

  /**
   * Log an error message
   * 
   * @param {string} message - The message to log
   * @param {Object} [data={}] - Additional data to include
   * @returns {Object} The log data including operation ID for tracking
   */
  error(message, data = {}) {
    return this.logEvent(LogLevel.ERROR, message, data);
  }

  /**
   * Log a critical message
   * 
   * @param {string} message - The message to log
   * @param {Object} [data={}] - Additional data to include
   * @returns {Object} The log data including operation ID for tracking
   */
  critical(message, data = {}) {
    return this.logEvent(LogLevel.CRITICAL, message, data);
  }
}

// Create a singleton instance for direct import
const zkErrorLogger = new ZKErrorLogger();

// Export the logger and related constants
module.exports = {
  ZKErrorLogger,
  zkErrorLogger,
  LogLevel,
  PrivacyLevel
};