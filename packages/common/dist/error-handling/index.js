/**
 * Error handling module for ZK proof operations.
 * This module re-exports all error handling functionality from the migrated implementation.
 * 
 * @module error-handling
 */

// Export all from the error handling system
export * from './zkErrorHandler.mjs';
export * from './zkErrorLogger.mjs';

// Ensure backward compatibility with any code that might be using these exports directly
import { 
  ErrorSeverity, 
  ErrorCategory, 
  ErrorCode as ZKErrorCode,
  getErrorLogger,
  createZKError
} from './zkErrorHandler.mjs';

// Re-export the specific exports that might be used directly
export { 
  ErrorSeverity, 
  ErrorCategory, 
  ZKErrorCode,
  getErrorLogger,
  createZKError 
};