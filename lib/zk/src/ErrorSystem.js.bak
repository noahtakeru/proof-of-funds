/**
 * @fileoverview Consolidated Error Handling System
 * 
 * This module provides a standardized error handling system for the entire ZK infrastructure.
 * It consolidates all error types, error logging, and error handling patterns into a single,
 * comprehensive system. This simplifies error management across the codebase and ensures
 * consistent error handling practices.
 * 
 * Features:
 * - Unified error hierarchy with consistent properties and methods
 * - Integrated logging with privacy controls
 * - Standardized error handling patterns with recovery options
 * - Support for both ESM and CommonJS module systems
 * 
 * @module ErrorSystem
 */

/**
 * Error severity levels for categorizing the impact of errors.
 * Used to determine appropriate logging and handling strategies.
 * 
 * @enum {string}
 */
export const ErrorSeverity = {
  CRITICAL: 'critical', // System cannot function, immediate attention required
  ERROR: 'error',       // Operation failed, but system can continue
  WARNING: 'warning',   // Issue detected but operation succeeded
  INFO: 'info'          // Informational message about potential issue
};

/**
 * Error categories for classifying errors by their domain or subsystem.
 * Helps in routing errors to the appropriate handlers and analyzers.
 * 
 * @enum {string}
 */
export const ErrorCategory = {
  CIRCUIT: 'circuit',           // ZK circuit errors
  PROOF: 'proof',               // Proof generation and management
  VERIFICATION: 'verification', // Proof verification
  MEMORY: 'memory',             // Memory management
  NETWORK: 'network',           // Network operations
  SECURITY: 'security',         // Security operations
  INPUT: 'input',               // User input validation
  SYSTEM: 'system',             // Core system operations
  COMPATIBILITY: 'compatibility', // Environment compatibility
  DEPLOYMENT: 'deployment',     // Deployment operations
  GAS: 'gas'                    // Gas-related operations
};

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

/**
 * Log levels for categorizing the importance of logged information.
 * Used to filter logs based on verbosity settings.
 * 
 * @enum {string}
 */
export const LogLevel = {
  DEBUG: 'debug',     // Detailed debugging information
  INFO: 'info',       // Normal but significant events
  WARN: 'warn',       // Warning conditions
  ERROR: 'error',     // Error conditions
  CRITICAL: 'critical' // Critical conditions requiring immediate attention
};

/**
 * Standard fields that should be included in all error objects
 * 
 * @type {Object}
 */
export const STANDARD_ERROR_FIELDS = {
  MESSAGE: 'message',         // Human-readable error message
  CODE: 'code',               // Numeric error code
  SEVERITY: 'severity',       // Error severity level
  CATEGORY: 'category',       // Error category
  TIMESTAMP: 'timestamp',     // When the error occurred
  OPERATION_ID: 'operationId', // Unique identifier for tracking
  DETAILS: 'details',         // Additional error details
  RECOVERABLE: 'recoverable', // Whether the error is recoverable
  CONTEXT: 'context',         // Where the error occurred
  STACK: 'stack'              // Stack trace for debugging
};

/**
 * Base error class for all application errors.
 * Provides common properties and behavior for derived error classes.
 * 
 * @class
 * @extends Error
 */
export class AppError extends Error {
  /**
   * Create a new AppError instance
   * 
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error configuration options
   * @param {number} [options.code=0] - Error code
   * @param {string} [options.severity=ErrorSeverity.ERROR] - Error severity level
   * @param {string} [options.category='system'] - Error category
   * @param {Object} [options.details={}] - Additional error details
   * @param {string} [options.operationId] - Operation ID for tracking
   * @param {boolean} [options.recoverable=false] - Whether the error is recoverable
   */
  constructor(message, options = {}) {
    super(message);
    
    // Standard error properties
    this.name = this.constructor.name;
    this.code = options.code || 0;
    this.severity = options.severity || ErrorSeverity.ERROR;
    this.category = options.category || ErrorCategory.SYSTEM;
    this.timestamp = new Date();
    this.operationId = options.operationId || `error_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    this.details = options.details || {};
    this.recoverable = options.recoverable !== undefined ? options.recoverable : false;
    this.context = options.context || 'unknown';
    
    // Ensure stack trace is captured
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Convert error to a JSON-serializable object
   * 
   * @returns {Object} JSON representation of the error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      category: this.category,
      timestamp: this.timestamp.toISOString(),
      operationId: this.operationId,
      details: this.details,
      recoverable: this.recoverable,
      context: this.context,
      stack: this.stack
    };
  }
  
  /**
   * Get a loggable representation of the error
   * 
   * @param {string} [privacyLevel=PrivacyLevel.INTERNAL] - Privacy level for filtering
   * @returns {Object} Object with fields safe to log at the specified privacy level
   */
  getLoggableObject(privacyLevel = PrivacyLevel.INTERNAL) {
    const baseSafeFields = {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      category: this.category,
      timestamp: this.timestamp.toISOString(),
      operationId: this.operationId,
      recoverable: this.recoverable,
      context: this.context
    };
    
    // Add stack trace and details for internal and higher privacy levels
    if (isPrivacyLevelAllowed(privacyLevel, PrivacyLevel.INTERNAL)) {
      return {
        ...baseSafeFields,
        stack: this.stack,
        details: sanitizeObject(this.details, privacyLevel)
      };
    }
    
    return baseSafeFields;
  }
}

/**
 * PRNG for consistent errors across environments
 * 
 * @param {number} seed - Seed value
 * @returns {function} Seeded random function
 */
function createSeededRandom(seed) {
  return function() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
}

/**
 * Generate a deterministic operation ID
 * 
 * @param {string} prefix - Prefix for the operation ID
 * @param {string} [context] - Optional context identifier
 * @returns {string} Operation ID
 */
export function generateOperationId(prefix, context) {
  const timestamp = Date.now();
  const random = createSeededRandom(timestamp);
  const randomPart = Math.floor(random() * 1000000).toString(16);
  
  return `${prefix}_${timestamp}_${randomPart}${context ? `_${context}` : ''}`;
}

/**
 * Check if a privacy level is allowed based on configuration
 * 
 * @param {string} current - Current privacy level
 * @param {string} required - Required privacy level
 * @returns {boolean} Whether the privacy level is allowed
 */
function isPrivacyLevelAllowed(current, required) {
  const levels = [
    PrivacyLevel.PUBLIC,
    PrivacyLevel.INTERNAL,
    PrivacyLevel.SENSITIVE,
    PrivacyLevel.PRIVATE
  ];
  
  const currentIndex = levels.indexOf(current);
  const requiredIndex = levels.indexOf(required);
  
  return requiredIndex <= currentIndex;
}

/**
 * Sanitize an object by removing or masking sensitive data
 * 
 * @param {Object} obj - The object to sanitize
 * @param {string} privacyLevel - Privacy level for filtering
 * @returns {Object} Sanitized copy of the object
 */
function sanitizeObject(obj, privacyLevel) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive keys altogether if privacy level is too low
    if (isSensitiveKey(key) && !isPrivacyLevelAllowed(privacyLevel, PrivacyLevel.SENSITIVE)) {
      continue;
    }
    
    // Recursively sanitize objects
    if (value && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value, privacyLevel);
    } else if (isSensitiveKey(key) && isPrivacyLevelAllowed(privacyLevel, PrivacyLevel.SENSITIVE)) {
      // Mask sensitive data
      sanitized[key] = maskSensitiveValue(value);
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
 */
function isSensitiveKey(key) {
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
 */
function maskSensitiveValue(value) {
  if (typeof value === 'string') {
    if (value.length <= 4) return '****';
    return `${value.substring(0, 2)}****${value.substring(value.length - 2)}`;
  }
  return '[REDACTED]';
}

/**
 * Class for logging errors with privacy controls and severity levels
 */
export class ErrorLogger {
  /**
   * Create a new ErrorLogger instance
   * 
   * @param {Object} [options={}] - Logger configuration options
   * @param {boolean} [options.enabled=true] - Whether logging is enabled
   * @param {string} [options.logLevel=LogLevel.INFO] - Minimum log level to record
   * @param {string} [options.privacyLevel=PrivacyLevel.INTERNAL] - Privacy level for filtering sensitive data
   * @param {boolean} [options.logToConsole=true] - Whether to output logs to console
   * @param {Array<string>} [options.destinations=['console']] - Output destinations
   */
  constructor(options = {}) {
    this.options = {
      enabled: options.enabled !== false,
      logLevel: options.logLevel || LogLevel.INFO,
      privacyLevel: options.privacyLevel || PrivacyLevel.INTERNAL,
      logToConsole: options.logToConsole !== false,
      destinations: options.destinations || ['console'],
      ...options
    };
    
    // Initialize fallback internal logging
    this.initializeLogger();
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
          console.debug('[Debug]', ...args);
        }
      },
      info: (...args) => {
        if (this.isLevelEnabled(LogLevel.INFO)) {
          console.info('[Info]', ...args);
        }
      },
      warn: (...args) => {
        if (this.isLevelEnabled(LogLevel.WARN)) {
          console.warn('[Warning]', ...args);
        }
      },
      error: (...args) => {
        if (this.isLevelEnabled(LogLevel.ERROR)) {
          console.error('[Error]', ...args);
        }
      },
      critical: (...args) => {
        if (this.isLevelEnabled(LogLevel.CRITICAL)) {
          console.error('[CRITICAL]', ...args);
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
      (error instanceof AppError ? error.severity : ErrorSeverity.ERROR);
    
    // Map severity to log level
    const logLevel = this.mapSeverityToLogLevel(severity);
    
    // Create structured log data
    const logData = this.createLogData(error, context);
    
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
   * Create structured log data from an error and context
   * 
   * @param {Error} error - The error to structure
   * @param {Object} context - Additional context information
   * @returns {Object} Structured log data object
   * @private
   */
  createLogData(error, context) {
    if (error instanceof AppError) {
      return {
        ...error.getLoggableObject(this.options.privacyLevel),
        ...sanitizeObject(context, this.options.privacyLevel)
      };
    }
    
    // Handle standard Error objects
    const timestamp = new Date().toISOString();
    const operationId = context.operationId || 
      generateOperationId('error', context.context || 'unknown');
    
    // Base structured data that's safe to log
    const safeData = {
      timestamp,
      operationId,
      message: error.message || 'Unknown error',
      errorType: error.name || (error instanceof Error ? error.constructor.name : 'Unknown'),
      code: error.code || 0,
      severity: error.severity || ErrorSeverity.ERROR,
      category: error.category || ErrorCategory.SYSTEM,
      environment: typeof window === 'undefined' ? 'node' : 'browser',
      context: context.context || 'unknown'
    };
    
    // Add stacktrace for internal and higher privacy
    if (isPrivacyLevelAllowed(this.options.privacyLevel, PrivacyLevel.INTERNAL)) {
      safeData.stack = error.stack;
    }
    
    // Add context information with privacy filtering
    if (context) {
      Object.assign(safeData, sanitizeObject(context, this.options.privacyLevel));
    }
    
    return safeData;
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
      generateOperationId('event', context.context || 'unknown');
    
    // Create log data
    const logData = {
      timestamp,
      operationId,
      message,
      level,
      environment: typeof window === 'undefined' ? 'node' : 'browser',
      ...sanitizeObject(context, this.options.privacyLevel)
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
export const errorLogger = new ErrorLogger();

/**
 * Utility for handling try/catch patterns consistently
 * 
 * @param {Function} operation - The operation to execute
 * @param {Object} options - Options for error handling
 * @param {Function} [options.onError] - Custom error handler
 * @param {boolean} [options.rethrow=false] - Whether to rethrow the error
 * @param {Object} [options.context={}] - Context for error logging
 * @param {boolean} [options.logError=true] - Whether to log the error
 * @returns {[Error|null, any]} Tuple of [error, result]
 */
export async function tryCatch(operation, options = {}) {
  const {
    onError,
    rethrow = false,
    context = {},
    logError = true
  } = options;
  
  try {
    const result = await operation();
    return [null, result];
  } catch (error) {
    // Log the error if requested
    if (logError) {
      errorLogger.logError(error, context);
    }
    
    // Call custom error handler if provided
    if (typeof onError === 'function') {
      onError(error);
    }
    
    // Rethrow if requested
    if (rethrow) {
      throw error;
    }
    
    return [error, null];
  }
}

/**
 * Synchronous version of tryCatch
 * 
 * @param {Function} operation - The operation to execute
 * @param {Object} options - Options for error handling
 * @param {Function} [options.onError] - Custom error handler
 * @param {boolean} [options.rethrow=false] - Whether to rethrow the error
 * @param {Object} [options.context={}] - Context for error logging
 * @param {boolean} [options.logError=true] - Whether to log the error
 * @returns {[Error|null, any]} Tuple of [error, result]
 */
export function tryCatchSync(operation, options = {}) {
  const {
    onError,
    rethrow = false,
    context = {},
    logError = true
  } = options;
  
  try {
    const result = operation();
    return [null, result];
  } catch (error) {
    // Log the error if requested
    if (logError) {
      errorLogger.logError(error, context);
    }
    
    // Call custom error handler if provided
    if (typeof onError === 'function') {
      onError(error);
    }
    
    // Rethrow if requested
    if (rethrow) {
      throw error;
    }
    
    return [error, null];
  }
}

/**
 * Create a standardized error handler for a component
 * 
 * @param {Object} options - Handler configuration
 * @param {string} options.component - Component name for context
 * @param {Function} [options.transform] - Error transformation function
 * @param {Function} [options.fallback] - Fallback response function
 * @returns {Function} Error handler function
 */
export function createErrorHandler(options) {
  const { component, transform, fallback } = options;
  
  return function handleError(error, context = {}) {
    // Log the error with component context
    const logContext = { ...context, component };
    errorLogger.logError(error, logContext);
    
    // Transform the error if requested
    let processedError = error;
    if (typeof transform === 'function') {
      processedError = transform(error);
    }
    
    // Return fallback value if provided
    if (typeof fallback === 'function') {
      return fallback(processedError);
    }
    
    // Default to null return
    return null;
  };
}

/**
 * Collection of specific error types for different categories
 */

/**
 * Base class for Zero-Knowledge related errors
 * @extends AppError
 */
export class ZKError extends AppError {
  constructor(message, options = {}) {
    super(message, { 
      ...options, 
      category: options.category || 'system',
      code: options.code || 10000
    });
    this.name = 'ZKError';
  }
}

/**
 * Error class for input validation failures
 * @extends ZKError
 */
export class InputError extends ZKError {
  constructor(message, options = {}) {
    super(message, { 
      ...options, 
      category: ErrorCategory.INPUT,
      code: options.code || 11000
    });
    this.name = 'InputError';
  }
}

/**
 * Error class for circuit-related failures
 * @extends ZKError
 */
export class CircuitError extends ZKError {
  constructor(message, options = {}) {
    super(message, { 
      ...options, 
      category: ErrorCategory.CIRCUIT,
      code: options.code || 12000
    });
    this.name = 'CircuitError';
  }
}

/**
 * Error class for proof generation and manipulation failures
 * @extends ZKError
 */
export class ProofError extends ZKError {
  constructor(message, options = {}) {
    super(message, { 
      ...options, 
      category: ErrorCategory.PROOF,
      code: options.code || 13000
    });
    this.name = 'ProofError';
  }
}

/**
 * Error class for proof verification failures
 * @extends ZKError
 */
export class VerificationError extends ZKError {
  constructor(message, options = {}) {
    super(message, { 
      ...options, 
      category: ErrorCategory.VERIFICATION,
      code: options.code || 14000
    });
    this.name = 'VerificationError';
  }
}

/**
 * Error class for memory-related failures
 * @extends ZKError
 */
export class MemoryError extends ZKError {
  constructor(message, options = {}) {
    super(message, { 
      ...options, 
      category: ErrorCategory.MEMORY,
      code: options.code || 15000
    });
    this.name = 'MemoryError';
  }
}

/**
 * Error class for network-related failures
 * @extends ZKError
 */
export class NetworkError extends ZKError {
  constructor(message, options = {}) {
    super(message, { 
      ...options, 
      category: ErrorCategory.NETWORK,
      code: options.code || 16000
    });
    this.name = 'NetworkError';
  }
}

/**
 * Error class for security-related failures
 * @extends ZKError
 */
export class SecurityError extends ZKError {
  constructor(message, options = {}) {
    super(message, { 
      ...options, 
      category: ErrorCategory.SECURITY,
      code: options.code || 17000
    });
    this.name = 'SecurityError';
  }
}

/**
 * Error class for system-level failures
 * @extends ZKError
 */
export class SystemError extends ZKError {
  constructor(message, options = {}) {
    super(message, { 
      ...options, 
      category: ErrorCategory.SYSTEM,
      code: options.code || 18000
    });
    this.name = 'SystemError';
  }
}

/**
 * Error class for compatibility-related failures
 * @extends ZKError
 */
export class CompatibilityError extends ZKError {
  constructor(message, options = {}) {
    super(message, { 
      ...options, 
      category: ErrorCategory.COMPATIBILITY,
      code: options.code || 19000
    });
    this.name = 'CompatibilityError';
  }
}

/**
 * Error class for deployment-related failures
 * @extends ZKError
 */
export class DeploymentError extends ZKError {
  constructor(message, options = {}) {
    super(message, { 
      ...options, 
      category: ErrorCategory.DEPLOYMENT,
      code: options.code || 20000
    });
    this.name = 'DeploymentError';
  }
}

/**
 * Error class for gas-related failures
 * @extends ZKError
 */
export class GasError extends ZKError {
  constructor(message, options = {}) {
    super(message, { 
      ...options, 
      category: ErrorCategory.GAS,
      code: options.code || 21000
    });
    this.name = 'GasError';
  }
}

/**
 * Check if an error is a specific type
 * 
 * @param {Error} error - Error to check
 * @param {Function} errorClass - Error class to check against
 * @returns {boolean} True if error is an instance of errorClass
 */
export function isErrorType(error, errorClass) {
  return error instanceof errorClass;
}

/**
 * Standardized error handling pattern for async functions
 * This decorator wraps a function with try-catch logic
 * 
 * @param {Object} options - Options for the decorator
 * @param {string} [options.component] - Component name for context
 * @param {Function} [options.fallback] - Fallback function
 * @returns {Function} Decorated function with error handling
 */
export function withErrorHandling(options = {}) {
  return function decorator(target) {
    return async function wrapped(...args) {
      try {
        return await target(...args);
      } catch (error) {
        const context = {
          component: options.component || target.name || 'unknown',
          args: args.map(arg => typeof arg === 'object' ? '[object]' : arg)
        };
        
        errorLogger.logError(error, context);
        
        if (typeof options.fallback === 'function') {
          return options.fallback(error, ...args);
        }
        
        throw error;
      }
    };
  };
}

/**
 * Default export - provides access to all error related functionality
 */
export default {
  // Error classes
  AppError,
  ZKError,
  InputError,
  CircuitError,
  ProofError,
  VerificationError,
  MemoryError,
  NetworkError,
  SecurityError,
  SystemError,
  CompatibilityError,
  DeploymentError,
  GasError,
  
  // Enums and constants
  ErrorSeverity,
  ErrorCategory,
  PrivacyLevel,
  LogLevel,
  STANDARD_ERROR_FIELDS,
  
  // Logger
  errorLogger,
  ErrorLogger,
  
  // Utility functions
  tryCatch,
  tryCatchSync,
  createErrorHandler,
  isErrorType,
  withErrorHandling,
  generateOperationId
};