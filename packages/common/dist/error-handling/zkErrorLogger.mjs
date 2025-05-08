/**
 * Error logging system for Zero-Knowledge operations.
 * Provides structured logging with privacy controls and severity levels.
 * 
 * This is the ESM version of the error logger.
 * 
 * @module zkErrorLogger
 */

// Import the error handler module
import { ErrorSeverity, ErrorCategory, ZKError } from './zkErrorHandler.mjs';

// Define the privacy levels for error logging
/**
 * Privacy levels for controlling what information gets logged.
 * Used to filter sensitive data from logs based on environment and configuration.
 * 
 * @enum {string}
 */
export const PrivacyLevel = {
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
export const LogLevel = {
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
export class ZKErrorLogger {
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

    // Add detailed information for internal or higher privacy
    if (this.isPrivacyLevelAllowed(PrivacyLevel.INTERNAL) && error.details) {
      safeData.details = this.sanitizeObject(error.details);
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

    return targetIndex <= configuredIndex;
  }

  /**
   * Sanitize an object to remove sensitive data based on privacy level
   * 
   * @param {Object} obj - The object to sanitize
   * @returns {Object} Sanitized object
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
   * Log with specific level and format the output
   * 
   * @param {string} level - The log level to use
   * @param {string} message - The message to log
   * @param {Object} data - The structured log data
   * @private
   */
  logWithLevel(level, message, data) {
    if (!this.isLevelEnabled(level)) return;

    // Format the log entry
    const formattedLog = {
      level,
      message,
      timestamp: data.timestamp || new Date().toISOString(),
      operationId: data.operationId || `log_${Date.now()}`,
      ...data
    };

    // Add timestamp and operation ID to the message
    const opId = formattedLog.operationId ? ` [${formattedLog.operationId}]` : '';
    const formattedMsg = `${message}${opId}`;

    // Log to appropriate destination
    if (this.options.logToConsole) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMsg, formattedLog);
          break;
        case LogLevel.INFO:
          console.info(formattedMsg, formattedLog);
          break;
        case LogLevel.WARN:
          console.warn(formattedMsg, formattedLog);
          break;
        case LogLevel.ERROR:
          console.error(formattedMsg, formattedLog);
          break;
        case LogLevel.CRITICAL:
          console.error('[CRITICAL] ' + formattedMsg, formattedLog);
          break;
        default:
          console.log(formattedMsg, formattedLog);
      }
    }
  }

  /**
   * Log an event with structured data
   * 
   * @param {string} level - The log level to use
   * @param {string} message - The message to log
   * @param {Object} data - Additional event data
   * @returns {Object} The log data including operation ID for tracking
   */
  logEvent(level, message, data = {}) {
    if (!this.options.enabled) return { operationId: 'logging-disabled' };

    // Generate operation ID if not present
    const operationId = data.operationId || `event_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // Create structured log data
    const logData = {
      ...data,
      operationId,
      timestamp: data.timestamp || new Date().toISOString()
    };

    // Log using the appropriate level
    this.logWithLevel(level, message, logData);

    return logData;
  }

  /**
   * Log a debug message
   * 
   * @param {string} message - The message to log
   * @param {Object} data - Additional event data
   * @returns {Object} The log data including operation ID for tracking
   */
  debug(message, data = {}) {
    return this.logEvent(LogLevel.DEBUG, message, data);
  }

  /**
   * Log an info message
   * 
   * @param {string} message - The message to log
   * @param {Object} data - Additional event data
   * @returns {Object} The log data including operation ID for tracking
   */
  info(message, data = {}) {
    return this.logEvent(LogLevel.INFO, message, data);
  }

  /**
   * Log a warning message
   * 
   * @param {string} message - The message to log
   * @param {Object} data - Additional event data
   * @returns {Object} The log data including operation ID for tracking
   */
  warn(message, data = {}) {
    return this.logEvent(LogLevel.WARN, message, data);
  }

  /**
   * Log an error message
   * 
   * @param {string} message - The message to log
   * @param {Object} data - Additional event data
   * @returns {Object} The log data including operation ID for tracking
   */
  error(message, data = {}) {
    return this.logEvent(LogLevel.ERROR, message, data);
  }

  /**
   * Log a critical message
   * 
   * @param {string} message - The message to log
   * @param {Object} data - Additional event data
   * @returns {Object} The log data including operation ID for tracking
   */
  critical(message, data = {}) {
    return this.logEvent(LogLevel.CRITICAL, message, data);
  }
}

// Create singleton instance with default configuration
export const zkErrorLogger = new ZKErrorLogger();

/**
 * Default export containing all logger components
 * @type {Object}
 */
export default {
  /**
   * Error logger class for creating custom logger instances
   * @type {typeof ZKErrorLogger}
   */
  ZKErrorLogger,
  
  /**
   * Default error logger singleton instance
   * @type {ZKErrorLogger}
   */
  zkErrorLogger,
  
  /**
   * Privacy levels enum for controlling log content
   * @type {Object}
   */
  PrivacyLevel,
  
  /**
   * Log levels enum for categorizing message importance
   * @type {Object}
   */
  LogLevel
};