/**
 * Error Logger Unified Entry Point (CommonJS version)
 * 
 * This module provides a consistent API for accessing the error logger
 * regardless of module system (CommonJS or ESM).
 * 
 * It is specifically formatted as CommonJS (.cjs) to ensure compatibility.
 */

// Simple fallback logger that just uses console
const fallbackLogger = {
  logError: (error, context = {}) => {
    console.error('[ZK Error]', error?.message || String(error), { context });
    return { operationId: `fallback_${Date.now()}` };
  },
  log: (level, message, data = {}) => {
    console.log(`[ZK ${level}]`, message, data);
    return { operationId: `fallback_${Date.now()}` };
  },
  debug: (message, data = {}) => {
    console.debug('[ZK Debug]', message, data);
    return { operationId: `fallback_${Date.now()}` };
  },
  info: (message, data = {}) => {
    console.info('[ZK Info]', message, data);
    return { operationId: `fallback_${Date.now()}` };
  },
  warn: (message, data = {}) => {
    console.warn('[ZK Warning]', message, data);
    return { operationId: `fallback_${Date.now()}` };
  },
  error: (message, data = {}) => {
    console.error('[ZK Error]', message, data);
    return { operationId: `fallback_${Date.now()}` };
  },
  critical: (message, data = {}) => {
    console.error('[ZK CRITICAL]', message, data);
    return { operationId: `fallback_${Date.now()}` };
  },
  updateConfig: () => {
    return { enabled: true, logLevel: 'debug' };
  }
};

// Default to fallback logger
let zkErrorLogger = fallbackLogger;

/**
 * Get the global error logger instance
 * @returns {Object} Error logger with all required methods
 */
function getLogger() {
  return zkErrorLogger;
}

/**
 * Safely log an error without throwing exceptions
 * @param {Error} error - The error to log
 * @param {Object} context - Additional context information
 * @returns {Object} Log data including operation ID
 */
function logError(error, context = {}) {
  try {
    return zkErrorLogger.logError(error, context);
  } catch (loggerError) {
    console.error('Error using logger:', loggerError);
    return fallbackLogger.logError(error, context);
  }
}

/**
 * Log a message with a specific level
 * @param {string} level - The log level (debug, info, warn, error, critical)
 * @param {string} message - The message to log
 * @param {Object} data - Additional data
 * @returns {Object} Log data including operation ID
 */
function log(level, message, data = {}) {
  try {
    return zkErrorLogger.log(level, message, data);
  } catch (loggerError) {
    console.error('Error using logger for level', level, loggerError);
    return fallbackLogger.log(level, message, data);
  }
}

// Export functions and logger instance
module.exports = {
  getLogger,
  logError,
  log,
  zkErrorLogger,
  fallbackLogger
};