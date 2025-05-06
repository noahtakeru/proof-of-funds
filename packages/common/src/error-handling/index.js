/**
 * Error handling module for ZK proof operations.
 * This module re-exports all error handling functionality from the original implementation.
 * 
 * @module error-handling
 */

/**
 * This is a temporary proxy module that will be replaced with the actual migration
 * of the error handling system. Per the dependency resolution plan, this file will 
 * import and re-export functionality from zkErrorHandler.mjs and zkErrorLogger.mjs
 * during Phase 3 of the migration.
 * 
 * During Phase 3.1, Step 2, we will:
 * 1. Copy the zkErrorHandler.mjs and zkErrorLogger.mjs to this directory
 * 2. Update this file to re-export all necessary types and functions
 * 3. Test the migrated modules 
 * 4. Only after successful testing, remove the original files
 */

// The actual error handling implementation will be migrated here
// from /lib/zk/src/zkErrorHandler.mjs and /lib/zk/src/zkErrorLogger.mjs
// For now we're only exporting the minimum interfaces needed

export const ErrorSeverity = {
  CRITICAL: 'critical',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

export const ErrorCategory = {
  CIRCUIT: 'circuit',
  PROOF: 'proof',
  VERIFICATION: 'verification',
  MEMORY: 'memory', 
  NETWORK: 'network',
  SECURITY: 'security',
  INPUT: 'input',
  SYSTEM: 'system',
  COMPATIBILITY: 'compatibility'
};

// This will be a mapping to the numeric error codes in the actual implementation
export const ZKErrorCode = {
  // Temporary error codes
  SYSTEM_NOT_INITIALIZED: 8001,
  SYSTEM_FEATURE_UNSUPPORTED: 8002
};

/**
 * @throws {Error} - This function will throw during Phase 2 setup
 * @returns {never}
 */
export function getErrorLogger() {
  throw new Error('Error handling system not yet migrated. This will be implemented during Phase 3.1.');
}

/**
 * @throws {Error} - This function will throw during Phase 2 setup
 * @returns {never}
 */
export function createZKError(code, message, options = {}) {
  throw new Error('Error handling system not yet migrated. This will be implemented during Phase 3.1.');
}