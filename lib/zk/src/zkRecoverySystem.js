/**
 * ZK Recovery System
 * 
 * This module provides sophisticated recovery mechanisms for handling failures
 * during ZK operations, including retries, checkpointing, and partial completion handling.
 * 
 * Key features:
 * - Exponential backoff with jitter for retries
 * - Operation-specific retry policies
 * - Partial completion handling for batch operations
 * - Checkpointing for long-running operations
 * - Resumable proof generation
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module acts as a safety net for the entire proof system. It's like having multiple backup
 * systems for a critical operation:
 * 
 * 1. When something fails, it tries again with smart timing (like waiting a bit longer
 *    between each attempt).
 * 2. It saves progress checkpoints so operations can resume exactly where they left off
 *    if interrupted (like saving your game progress).
 * 3. It handles processing multiple items, ensuring that if one item fails, the others 
 *    can still succeed (like a package delivery system that doesn't stop if one package
 *    has an issue).
 * 
 * This provides a more robust user experience with fewer complete failures and
 * allows large operations to recover from temporary issues without starting over.
 * 
 * @module zkRecoverySystem
 */

// This is a modern JavaScript (ESM) re-exporter for the ZK Recovery System
// that dynamically loads the appropriate module format based on the environment.

// Check if we're in an ESM environment
const isEsm = typeof import.meta === 'object';

// Create a logger function for diagnostic purposes
const logDebug = (message) => {
  if (typeof process !== 'undefined' && process.env.DEBUG) {
    console.debug(`[zkRecoverySystem] ${message}`);
  }
};

// Create a basic error logger
const logError = (message, error) => {
  console.error(`[zkRecoverySystem] ${message}`, error);
};

/**
 * Error thrown when there's an issue with the recovery system module loading
 * 
 * @class RecoverySystemModuleError
 * @extends Error
 */
class RecoverySystemModuleError extends Error {
  /**
   * Create a new RecoverySystemModuleError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Additional error options
   * @param {string} [options.operationId] - Operation ID for tracking
   * @param {Error} [options.originalError] - Original error that caused this one
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'RecoverySystemModuleError';
    this.operationId = options.operationId || `recovery_error_${Date.now()}`;
    
    // Capture original error if provided
    if (options.originalError) {
      this.originalError = options.originalError;
      this.originalStack = options.originalError.stack;
    }
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Storage for lazy loading
let moduleExports = null;
let moduleLoadPromise = null;

/**
 * Load the appropriate module format dynamically
 * 
 * @private
 * @async
 * @returns {Promise<Object>} Module exports
 */
async function loadModule() {
  if (moduleExports) {
    return moduleExports;
  }
  
  if (!moduleLoadPromise) {
    const operationId = `load_recovery_module_${Date.now()}`;
    
    moduleLoadPromise = (async () => {
      try {
        logDebug(`Loading module in ${isEsm ? 'ESM' : 'CommonJS'} environment (operationId: ${operationId})`);
        
        if (isEsm) {
          // ESM environment - use dynamic import for .mjs
          moduleExports = await import('./zkRecoverySystem.mjs');
          logDebug(`Successfully loaded ESM module: ${Object.keys(moduleExports).join(', ')}`);
        } else {
          // CommonJS environment - use require for .cjs
          moduleExports = require('./cjs/zkRecoverySystem.cjs');
          logDebug(`Successfully loaded CommonJS module: ${Object.keys(moduleExports).join(', ')}`);
        }
        
        return moduleExports;
      } catch (error) {
        logError(`Failed to load module: ${error.message}`, error);
        
        // Throw a specialized error with context
        throw new RecoverySystemModuleError(
          `Failed to load ZK Recovery System module: ${error.message}`,
          {
            operationId,
            originalError: error
          }
        );
      }
    })();
  }
  
  return moduleLoadPromise;
}

/**
 * Execute a function with retry logic
 * @async
 * @function withRetry
 * @param {Function} fn - Function to execute
 * @param {Object} [options] - Retry options
 * @returns {Promise<any>} Result of the function
 * @throws {Error} Original error after retries are exhausted
 */
export async function withRetry(fn, options) {
  const module = await loadModule();
  return module.withRetry(fn, options);
}

/**
 * Create a checkpoint for resumable operations
 * @async
 * @function createCheckpoint
 * @param {string} operationId - Unique operation identifier
 * @param {Object} state - Operation state to checkpoint
 * @param {Object} [options] - Checkpoint options
 * @returns {Promise<boolean>} Success indicator
 */
export async function createCheckpoint(operationId, state, options) {
  const module = await loadModule();
  return module.createCheckpoint(operationId, state, options);
}

/**
 * Retrieve a checkpoint for resuming an operation
 * @async
 * @function getCheckpoint
 * @param {string} operationId - Unique operation identifier
 * @param {Object} [options] - Checkpoint options
 * @returns {Promise<Object|null>} Checkpoint state or null if not found
 */
export async function getCheckpoint(operationId, options) {
  const module = await loadModule();
  return module.getCheckpoint(operationId, options);
}

/**
 * Remove a checkpoint after operation completion
 * @async
 * @function removeCheckpoint
 * @param {string} operationId - Unique operation identifier
 * @param {Object} [options] - Checkpoint options
 * @returns {Promise<boolean>} Success indicator
 */
export async function removeCheckpoint(operationId, options) {
  const module = await loadModule();
  return module.removeCheckpoint(operationId, options);
}

/**
 * List all checkpoints of a specific type
 * @async
 * @function listCheckpoints
 * @param {string} type - Checkpoint type filter
 * @param {Object} [options] - Checkpoint options
 * @returns {Promise<Array>} List of checkpoint metadata
 */
export async function listCheckpoints(type, options) {
  const module = await loadModule();
  return module.listCheckpoints(type, options);
}

/**
 * Execute a function with checkpointing
 * @async
 * @function withCheckpointing
 * @param {Function} fn - Function to execute with state parameter
 * @param {string} operationId - Unique operation identifier
 * @param {Object} [options] - Checkpointing options
 * @returns {Promise<any>} Result of the function
 */
export async function withCheckpointing(fn, operationId, options) {
  const module = await loadModule();
  return module.withCheckpointing(fn, operationId, options);
}

/**
 * Handles batch operations with partial completion support
 * @async
 * @function processBatch
 * @param {Array} items - Array of items to process
 * @param {Function} processFn - Function to process each item
 * @param {Object} [options] - Batch options
 * @returns {Promise<Object>} Results with success and failure counts
 */
export async function processBatch(items, processFn, options) {
  const module = await loadModule();
  return module.processBatch(items, processFn, options);
}

/**
 * Create session transferable checkpoint for partial proof data
 * @async
 * @function createTransferableCheckpoint
 * @param {string} operationId - Unique operation identifier
 * @param {Object} state - Operation state to checkpoint
 * @param {Object} [options] - Checkpoint options
 * @returns {Promise<string>} Transferable checkpoint token
 */
export async function createTransferableCheckpoint(operationId, state, options) {
  const module = await loadModule();
  return module.createTransferableCheckpoint(operationId, state, options);
}

/**
 * Resume operation from a transferable checkpoint token
 * @async
 * @function resumeFromTransferableCheckpoint
 * @param {string} token - Transferable checkpoint token
 * @returns {Promise<Object>} Checkpoint data and state
 */
export async function resumeFromTransferableCheckpoint(token) {
  const module = await loadModule();
  return module.resumeFromTransferableCheckpoint(token);
}

/**
 * Default export for the ZK Recovery System module
 * @type {Object}
 */
export default {
  withRetry,
  createCheckpoint,
  getCheckpoint,
  removeCheckpoint,
  listCheckpoints,
  withCheckpointing,
  processBatch,
  createTransferableCheckpoint,
  resumeFromTransferableCheckpoint
};