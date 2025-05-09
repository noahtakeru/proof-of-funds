/**
 * Error handling module for ZK proof operations.
 * This module re-exports all error handling functionality from the migrated implementation.
 * 
 * @module error-handling
 */

// Export all from the error handling system
Object.assign(exports, require('./zkErrorHandler.mjs'));
Object.assign(exports, require('./zkErrorLogger.mjs'));

// Ensure backward compatibility with any code that might be using these exports directly
const { 
  ErrorSeverity, 
  ErrorCategory, 
  ErrorCode as ZKErrorCode,
  getErrorLogger,
  createZKError
} = require('./zkErrorHandler.mjs');

// Re-export the specific exports that might be used directly
module.exports = { 
  ErrorSeverity, 
  ErrorCategory, 
  ZKErrorCode,
  getErrorLogger,
  createZKError 
};