/**
 * @fileoverview Consolidated Error Handling System (ESM)
 * 
 * ESM version of the consolidated error handling system.
 * This file provides functionality for standardized error handling, logging,
 * recovery, and security in the ZK system.
 * 
 * @module ErrorSystem
 */

// Error severity levels
export const ErrorSeverity = {
  CRITICAL: 'critical',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

// Error categories
export const ErrorCategory = {
  CIRCUIT: 'circuit',
  PROOF: 'proof',
  VERIFICATION: 'verification',
  MEMORY: 'memory',
  NETWORK: 'network',
  SECURITY: 'security',
  INPUT: 'input',
  SYSTEM: 'system',
  COMPATIBILITY: 'compatibility',
  DEPLOYMENT: 'deployment',
  GAS: 'gas'
};

// Privacy levels
export const PrivacyLevel = {
  PUBLIC: 'public',
  INTERNAL: 'internal',
  SENSITIVE: 'sensitive',
  PRIVATE: 'private'
};

// Log levels
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  CRITICAL: 'critical'
};

// Standard error fields
export const STANDARD_ERROR_FIELDS = {
  MESSAGE: 'message',
  CODE: 'code',
  SEVERITY: 'severity',
  CATEGORY: 'category',
  TIMESTAMP: 'timestamp',
  OPERATION_ID: 'operationId',
  DETAILS: 'details',
  RECOVERABLE: 'recoverable',
  CONTEXT: 'context',
  STACK: 'stack'
};

/**
 * Base error class for all application errors.
 * ESM version compatible with import syntax.
 */
export class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    
    this.name = this.constructor.name;
    this.code = options.code || 0;
    this.severity = options.severity || ErrorSeverity.ERROR;
    this.category = options.category || ErrorCategory.SYSTEM;
    this.timestamp = new Date();
    this.operationId = options.operationId || `error_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    this.details = options.details || {};
    this.recoverable = options.recoverable !== undefined ? options.recoverable : false;
    this.context = options.context || 'unknown';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
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

// PRNG for consistent errors across environments
export function createSeededRandom(seed) {
  return function() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
}

// Generate a deterministic operation ID
export function generateOperationId(prefix, context) {
  const timestamp = Date.now();
  const random = createSeededRandom(timestamp);
  const randomPart = Math.floor(random() * 1000000).toString(16);
  
  return `${prefix}_${timestamp}_${randomPart}${context ? `_${context}` : ''}`;
}

// Check if a privacy level is allowed based on configuration
export function isPrivacyLevelAllowed(current, required) {
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

// Sanitize an object by removing or masking sensitive data
export function sanitizeObject(obj, privacyLevel) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key) && !isPrivacyLevelAllowed(privacyLevel, PrivacyLevel.SENSITIVE)) {
      continue;
    }
    
    if (value && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value, privacyLevel);
    } else if (isSensitiveKey(key) && isPrivacyLevelAllowed(privacyLevel, PrivacyLevel.SENSITIVE)) {
      sanitized[key] = maskSensitiveValue(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// Check if a key name is likely to contain sensitive information
export function isSensitiveKey(key) {
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

// Mask a sensitive value for logging
export function maskSensitiveValue(value) {
  if (typeof value === 'string') {
    if (value.length <= 4) return '****';
    return `${value.substring(0, 2)}****${value.substring(value.length - 2)}`;
  }
  return '[REDACTED]';
}

// Class for logging errors with privacy controls and severity levels
export class ErrorLogger {
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
  
  initializeLogger() {
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
  
  logError(error, context = {}) {
    if (!this.options.enabled) return { operationId: 'logging-disabled' };
    
    const severity = error.severity || 
      (error instanceof AppError ? error.severity : ErrorSeverity.ERROR);
    
    const logLevel = this.mapSeverityToLogLevel(severity);
    
    const logData = this.createLogData(error, context);
    
    this.logWithLevel(logLevel, error.message || 'An error occurred', logData);
    
    return logData;
  }
  
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
  
  createLogData(error, context) {
    if (error instanceof AppError) {
      return {
        ...error.getLoggableObject(this.options.privacyLevel),
        ...sanitizeObject(context, this.options.privacyLevel)
      };
    }
    
    const timestamp = new Date().toISOString();
    const operationId = context.operationId || 
      generateOperationId('error', context.context || 'unknown');
    
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
    
    if (isPrivacyLevelAllowed(this.options.privacyLevel, PrivacyLevel.INTERNAL)) {
      safeData.stack = error.stack;
    }
    
    if (context) {
      Object.assign(safeData, sanitizeObject(context, this.options.privacyLevel));
    }
    
    return safeData;
  }
  
  logWithLevel(level, message, data = {}) {
    if (!this.isLevelEnabled(level)) return;
    
    const logMethod = level === LogLevel.CRITICAL ? 'critical' :
      level === LogLevel.ERROR ? 'error' :
        level === LogLevel.WARN ? 'warn' :
          level === LogLevel.DEBUG ? 'debug' : 'info';
    
    this.logger[logMethod](message, data);
  }
  
  logEvent(level, message, context = {}) {
    if (!this.options.enabled) return { operationId: 'logging-disabled' };
    
    const timestamp = new Date().toISOString();
    const operationId = context.operationId || 
      generateOperationId('event', context.context || 'unknown');
    
    const logData = {
      timestamp,
      operationId,
      message,
      level,
      environment: typeof window === 'undefined' ? 'node' : 'browser',
      ...sanitizeObject(context, this.options.privacyLevel)
    };
    
    this.logWithLevel(level, message, logData);
    
    return logData;
  }
  
  debug(message, context = {}) {
    return this.logEvent(LogLevel.DEBUG, message, context);
  }
  
  info(message, context = {}) {
    return this.logEvent(LogLevel.INFO, message, context);
  }
  
  warn(message, context = {}) {
    return this.logEvent(LogLevel.WARN, message, context);
  }
  
  error(message, context = {}) {
    return this.logEvent(LogLevel.ERROR, message, context);
  }
  
  critical(message, context = {}) {
    return this.logEvent(LogLevel.CRITICAL, message, context);
  }
}

// Create singleton instance with default configuration
export const errorLogger = new ErrorLogger();

// Utility for handling try/catch patterns consistently
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
    if (logError) {
      errorLogger.logError(error, context);
    }
    
    if (typeof onError === 'function') {
      onError(error);
    }
    
    if (rethrow) {
      throw error;
    }
    
    return [error, null];
  }
}

// Synchronous version of tryCatch
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
    if (logError) {
      errorLogger.logError(error, context);
    }
    
    if (typeof onError === 'function') {
      onError(error);
    }
    
    if (rethrow) {
      throw error;
    }
    
    return [error, null];
  }
}

// Create a standardized error handler for a component
export function createErrorHandler(options) {
  const { component, transform, fallback } = options;
  
  return function handleError(error, context = {}) {
    const logContext = { ...context, component };
    errorLogger.logError(error, logContext);
    
    let processedError = error;
    if (typeof transform === 'function') {
      processedError = transform(error);
    }
    
    if (typeof fallback === 'function') {
      return fallback(processedError);
    }
    
    return null;
  };
}

// ZK-specific error classes
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

// Check if an error is a specific type
export function isErrorType(error, errorClass) {
  return error instanceof errorClass;
}

// Standardized error handling pattern for async functions
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

// Recovery system for error recovery strategies
export class RecoverySystem {
  constructor() {
    this.strategies = new Map();
  }
  
  // Register a recovery strategy for a specific error type
  registerStrategy(errorType, strategy) {
    this.strategies.set(errorType, strategy);
  }
  
  // Attempt to recover from an error
  async recover(error, context = {}) {
    const errorType = error.name || (error.constructor ? error.constructor.name : 'Error');
    
    // Try to find an exact match for the error type
    if (this.strategies.has(errorType)) {
      const strategy = this.strategies.get(errorType);
      return strategy(error, context);
    }
    
    // If no exact match, try to find a strategy for a parent error class
    for (const [strategyType, strategy] of this.strategies.entries()) {
      if (error instanceof Error && 
          Object.prototype.isPrototypeOf.call(window[strategyType].prototype, error)) {
        return strategy(error, context);
      }
    }
    
    // No strategy found
    return {
      recovered: false,
      message: `No recovery strategy found for error type: ${errorType}`,
      error
    };
  }
}

// Create singleton instance of recovery system
export const recoverySystem = new RecoverySystem();

// Create common recovery strategies
recoverySystem.registerStrategy('NetworkError', async (error, context) => {
  const maxRetries = context.maxRetries || 3;
  const retryDelay = context.retryDelay || 1000;
  
  if (!context.retryCount) {
    context.retryCount = 0;
  }
  
  if (context.retryCount < maxRetries && context.operation) {
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, context.retryCount)));
    
    // Increment retry count
    context.retryCount++;
    
    try {
      // Retry the operation
      const result = await context.operation();
      return {
        recovered: true,
        message: `Successfully recovered after ${context.retryCount} retries`,
        result
      };
    } catch (retryError) {
      // Recursively try to recover from the new error
      return recoverySystem.recover(retryError, context);
    }
  }
  
  return {
    recovered: false,
    message: `Failed to recover after ${context.retryCount} retries`,
    error
  };
});

recoverySystem.registerStrategy('MemoryError', async (error, context) => {
  // Attempt to free memory and retry if possible
  if (typeof global.gc === 'function') {
    global.gc();
  }
  
  if (context.operation && context.fallbackMode) {
    try {
      // Retry with reduced memory footprint
      const result = await context.operation({ 
        ...context, 
        optimizeMemory: true,
        reduceChunkSize: true
      });
      return {
        recovered: true,
        message: 'Successfully recovered with memory optimization',
        result
      };
    } catch (retryError) {
      return {
        recovered: false,
        message: 'Failed to recover even with memory optimization',
        error: retryError
      };
    }
  }
  
  return {
    recovered: false,
    message: 'Memory error recovery not possible in this context',
    error
  };
});

recoverySystem.registerStrategy('ValidationError', async (error, context) => {
  if (context.fallbackValue !== undefined) {
    return {
      recovered: true,
      message: 'Recovered using fallback value',
      result: context.fallbackValue
    };
  }
  
  return {
    recovered: false,
    message: 'Validation error recovery requires fallback value',
    error
  };
});

// Export default values for ESM default import
export default {
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
  ErrorSeverity,
  ErrorCategory,
  PrivacyLevel,
  LogLevel,
  STANDARD_ERROR_FIELDS,
  errorLogger,
  ErrorLogger,
  tryCatch,
  tryCatchSync,
  createErrorHandler,
  isErrorType,
  withErrorHandling,
  generateOperationId,
  recoverySystem,
  RecoverySystem
};