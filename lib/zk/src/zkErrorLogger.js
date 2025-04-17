/**
 * @fileoverview Error logging system for Zero-Knowledge operations
 * 
 * Provides structured logging with privacy controls and severity levels.
 * This is the CommonJS entry point for the error logger, which provides
 * the same functionality as the ESM version.
 * 
 * @module zkErrorLogger
 */

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

    return targetIndex <= configuredIndex;
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

    // Add detailed information for internal or higher privacy
    if (this.isPrivacyLevelAllowed(PrivacyLevel.INTERNAL) && error.details) {
      safeData.details = this.sanitizeObject(error.details);
    }

    return safeData;
  }

  /**
   * Sanitize an object by removing or masking sensitive data
   * 
   * @param {Object} obj - The object to sanitize
   * @returns {Object} Sanitized copy of the object
   * @private
   */
  sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    const sanitized = {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip sensitive keys altogether if privacy level is too low
      if (this.isSensitiveKey(key) && !this.isPrivacyLevelAllowed(PrivacyLevel.SENSITIVE)) {
        continue;
      }

      // Recursively sanitize objects
      if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value);
      } else if (this.isSensitiveKey(key) && this.isPrivacyLevelAllowed(PrivacyLevel.SENSITIVE)) {
        // Mask sensitive data
        sanitized[key] = this.maskSensitiveValue(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Check if a key name is likely to contain sensitive information
   * 
   * @param {string} key - The key name to check
   * @returns {boolean} Whether the key is sensitive
   * @private
   */
  isSensitiveKey(key) {
    const sensitiveKeywords = [
      'secret',
      'password',
      'token',
      'key',
      'credential',
      'private',
      'seed',
      'mnemonic',
      'wallet'
    ];

    const lowercaseKey = key.toLowerCase();

    return sensitiveKeywords.some(keyword =>
      lowercaseKey.includes(keyword) || lowercaseKey === keyword);
  }

  /**
   * Mask a sensitive value for logging
   * 
   * @param {*} value - The value to mask
   * @returns {string} Masked value
   * @private
   */
  maskSensitiveValue(value) {
    if (typeof value === 'string') {
      if (value.length <= 4) return '****';
      return `${value.substring(0, 2)}****${value.substring(value.length - 2)}`;
    }
    return '[REDACTED]';
  }

  /**
   * Log a message with the specified level
   * 
   * @param {string} level - The log level
   * @param {string} message - The message to log
   * @param {Object} [data={}] - Additional data to log
   * @private
   */
  logWithLevel(level, message, data = {}) {
    if (!this.isLevelEnabled(level)) return;

    // Determine which logger method to use
    const logMethod = level === LogLevel.CRITICAL ? 'critical' :
      level === LogLevel.ERROR ? 'error' :
        level === LogLevel.WARN ? 'warn' :
          level === LogLevel.DEBUG ? 'debug' : 'info';

    // Log the message and data
    this.logger[logMethod](message, data);

    // Send to additional configured destinations
    this.sendToDestinations(level, message, data);
  }

  /**
   * Send log data to configured destinations
   * 
   * @param {string} level - The log level
   * @param {string} message - The message to log
   * @param {Object} data - Additional data to log
   * @private
   */
  sendToDestinations(level, message, data) {
    // For now, just implement console logging
    // TODO: In a real implementation, this would send to configured log destinations
    if (this.options.destinations.includes('console') && this.options.logToConsole) {
      // Already logged to console by logWithLevel
    }
  }

  /**
   * Log an event with context information
   * 
   * @param {string} level - Log level for the event
   * @param {string} message - The message to log
   * @param {Object} [context={}] - Additional context information
   * @returns {Object} The log data including operation ID for tracking
   */
  logEvent(level, message, context = {}) {
    if (!this.options.enabled) return { operationId: 'logging-disabled' };

    const timestamp = new Date().toISOString();
    const operationId = context.operationId ||
      `event_${timestamp.replace(/[-:.TZ]/g, '')}_${Math.random().toString(36).substr(2, 5)}`;

    // Create log data
    const logData = {
      timestamp,
      operationId,
      message,
      level,
      environment: typeof window === 'undefined' ? 'node' : 'browser',
      ...this.sanitizeObject(context)
    };

    // Log using the appropriate level
    this.logWithLevel(level, message, logData);

    return logData;
  }

  /**
   * Log a debug message
   * 
   * @param {string} message - The message to log
   * @param {Object} [context={}] - Additional context information
   * @returns {Object} The log data including operation ID for tracking
   */
  debug(message, context = {}) {
    return this.logEvent(LogLevel.DEBUG, message, context);
  }

  /**
   * Log an info message
   * 
   * @param {string} message - The message to log
   * @param {Object} [context={}] - Additional context information
   * @returns {Object} The log data including operation ID for tracking
   */
  info(message, context = {}) {
    return this.logEvent(LogLevel.INFO, message, context);
  }

  /**
   * Log a warning message
   * 
   * @param {string} message - The message to log
   * @param {Object} [context={}] - Additional context information
   * @returns {Object} The log data including operation ID for tracking
   */
  warn(message, context = {}) {
    return this.logEvent(LogLevel.WARN, message, context);
  }

  /**
   * Log an error message
   * 
   * @param {string} message - The message to log
   * @param {Object} [context={}] - Additional context information
   * @returns {Object} The log data including operation ID for tracking
   */
  error(message, context = {}) {
    return this.logEvent(LogLevel.ERROR, message, context);
  }

  /**
   * Log a critical message
   * 
   * @param {string} message - The message to log
   * @param {Object} [context={}] - Additional context information
   * @returns {Object} The log data including operation ID for tracking
   */
  critical(message, context = {}) {
    return this.logEvent(LogLevel.CRITICAL, message, context);
  }
}

// Create singleton instance with default configuration
const zkErrorLogger = new ZKErrorLogger();

// Use modern export style without CommonJS exports
export { zkErrorLogger, ZKErrorLogger, PrivacyLevel, LogLevel };