/**
 * Zero Knowledge Proof Error Handling Framework
 * 
 * This module implements a comprehensive error handling system for ZK operations
 * with classification, recovery paths, and structured error reporting.
 * 
 * Key features:
 * - Hierarchical error classes with inheritance
 * - Error categorization by component and severity
 * - Recovery path identification
 * - Context-rich error messages with error codes
 * - Privacy-preserving error reporting
 * 
 * ---------- NON-TECHNICAL EXPLANATION ----------
 * This file is like an air traffic control system for handling errors in our privacy system.
 * It helps identify what went wrong (error type), how serious it is (severity),
 * and what can be done about it (recovery options). It's designed to:
 * 
 * 1. Clearly explain errors to both users and developers
 * 2. Suggest solutions when possible
 * 3. Protect private information even when logging errors
 * 4. Enable automated recovery from certain types of problems
 * 
 * NOTE: This is a re-exporter file that dynamically loads either the ESM or CJS version
 * based on the environment.
 */

// Dynamic import/require strategy for ESM/CJS compatibility
let errorHandler;
let errorLogger;

// Check if ESM environment (based on import.meta presence)
const isEsm = typeof import.meta === 'object';

/**
 * Custom error class for module loading failures
 * Used when error handling system itself encounters an error
 * 
 * @class ModuleLoadError
 * @extends Error
 */
class ModuleLoadError extends Error {
  /**
   * Create a new ModuleLoadError
   * 
   * @param {string} message - Error message
   * @param {Object} details - Additional error details
   * @param {Error} [originalError] - Original error that caused this error
   */
  constructor(message, details = {}, originalError = null) {
    super(message);
    this.name = 'ModuleLoadError';
    this.details = details;
    this.originalError = originalError;
    this.timestamp = new Date();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Create string representation of the error
   * 
   * @returns {string} String representation with details
   */
  toString() {
    let result = `${this.name}: ${this.message}`;
    if (this.details && Object.keys(this.details).length > 0) {
      result += `\nDetails: ${JSON.stringify(this.details, null, 2)}`;
    }
    if (this.originalError) {
      result += `\nOriginal error: ${this.originalError.message}`;
    }
    return result;
  }
}

/**
 * Load the appropriate module format based on the environment
 * 
 * @private
 * @async
 * @function loadModules
 * @returns {Promise<void>} Promise that resolves when the module is loaded
 * @throws {ModuleLoadError} When module loading fails
 */
async function loadModules() {
  try {
    if (isEsm) {
      // ESM environment - dynamically import the .mjs versions
      const [handlerModule, loggerModule] = await Promise.all([
        import('./zkErrorHandler.mjs'),
        import('./zkErrorLogger.mjs')
      ]);
      
      errorHandler = handlerModule;
      errorLogger = loggerModule.default;
    } else {
      // CommonJS environment - use require for the CJS versions
      errorHandler = require('./cjs/zkErrorHandler.cjs');
      errorLogger = require('./cjs/zkErrorLogger.cjs');
    }
  } catch (err) {
    // Basic error logging for bootstrap error (can't use the error system yet)
    console.error(`Failed to load error handling modules: ${err.message}`, {
      originalError: err.message,
      environment: isEsm ? 'ESM' : 'CommonJS',
      context: 'zkErrorHandler.js.loadModules'
    });
    
    // Throw specialized error with context
    throw new ModuleLoadError(
      `Error handling system initialization failed: ${err.message}`,
      {
        environment: isEsm ? 'ESM' : 'CommonJS',
        moduleType: 'error handling',
        attemptedPaths: isEsm ? 
          ['./zkErrorHandler.mjs', './zkErrorLogger.mjs'] : 
          ['./cjs/zkErrorHandler.cjs', './cjs/zkErrorLogger.cjs']
      },
      err
    );
  }
}

/**
 * Promise for module loading, initialized immediately
 * @type {Promise<void>}
 */
const modulesPromise = loadModules();

/**
 * Lazy-loaded error handler getter
 * Ensures the modules are loaded before returning any properties
 * 
 * @async
 * @function getErrorHandlerProp
 * @param {string} prop - The property to get
 * @returns {Promise<any>} The requested property from the error handler
 * @throws {ModuleLoadError} When module loading fails
 */
async function getErrorHandlerProp(prop) {
  try {
    await modulesPromise;
    return errorHandler[prop];
  } catch (err) {
    // Handle errors that might occur during module loading
    throw new ModuleLoadError(
      `Failed to get error handler property '${prop}': ${err.message}`,
      { propertyName: prop },
      err
    );
  }
}

/**
 * Log an error through the error logging system
 * 
 * @async
 * @function logError
 * @param {Error} error - The error to log
 * @param {Object} additionalData - Additional contextual data
 * @returns {Promise<void>} Promise that resolves when logging is complete
 */
async function logError(error, additionalData = {}) {
  try {
    await modulesPromise;
    
    // Ensure we have the error logger
    if (!errorLogger || !errorLogger.zkErrorLogger) {
      console.error('Error logger not available', {
        error: error.message,
        context: 'zkErrorHandler.js.logError'
      });
      return;
    }
    
    // Log through the error logging system
    errorLogger.zkErrorLogger.logError(error, {
      context: 'zkErrorHandler.js',
      ...additionalData
    });
  } catch (loggingError) {
    // Fallback if error logging fails
    console.error('Error logging failed', {
      originalError: error.message,
      loggingError: loggingError.message,
      context: 'zkErrorHandler.js.logError'
    });
  }
}

// For CommonJS environments, use module.exports
if (!isEsm) {
  /**
   * CommonJS export - proxy that loads modules on demand
   * 
   * @type {Object}
   */
  module.exports = new Proxy({}, {
    get: (target, prop) => {
      // Return a function that loads the module and returns the property
      if (typeof prop === 'string' && prop !== 'then') {
        return async (...args) => {
          await modulesPromise;
          
          // Handle special case for error logging
          if (prop === 'logError') {
            return logError(...args);
          }
          
          // Return the property or function result
          const value = errorHandler[prop];
          return typeof value === 'function' ? value(...args) : value;
        };
      }
      return undefined;
    }
  });
}

/**
 * Default export for ESM - dynamic module proxy
 * 
 * This pattern uses a Proxy to intercept property access and load modules on demand
 * 
 * @type {Proxy}
 */
export default new Proxy({}, {
  get: (target, prop) => {
    // Special case for Symbol.toStringTag to avoid errors
    if (prop === Symbol.toStringTag) {
      return 'Module';
    }
    
    // Return a function or property that loads the module on demand
    if (typeof prop === 'string' && prop !== 'then') {
      // Special case for error logging
      if (prop === 'logError') {
        return logError;
      }
      
      // For functions, return a function that loads the module first
      return (...args) => {
        return getErrorHandlerProp(prop).then(value => {
          return typeof value === 'function' ? value(...args) : value;
        });
      };
    }
    return undefined;
  }
});

/**
 * Error severity levels for classifying errors by impact
 * @type {Promise<Object>}
 */
export const ErrorSeverity = getErrorHandlerProp('ErrorSeverity');

/**
 * Error categories for classifying errors by domain
 * @type {Promise<Object>}
 */
export const ErrorCategory = getErrorHandlerProp('ErrorCategory');

/**
 * Error codes for specific error conditions, organized by category
 * @type {Promise<Object>}
 */
export const ErrorCode = getErrorHandlerProp('ErrorCode');

/**
 * Base error class for all ZK-related errors
 * @type {Promise<Function>}
 */
export const ZKError = getErrorHandlerProp('ZKError');

/**
 * Error class for circuit-related errors
 * @type {Promise<Function>}
 */
export const CircuitError = getErrorHandlerProp('CircuitError');

/**
 * Error class for circuit constraint failures
 * @type {Promise<Function>}
 */
export const CircuitConstraintError = getErrorHandlerProp('CircuitConstraintError');

/**
 * Error class for circuit compilation failures
 * @type {Promise<Function>}
 */
export const CircuitCompilationError = getErrorHandlerProp('CircuitCompilationError');

/**
 * Error class for circuit parameter validation failures
 * @type {Promise<Function>}
 */
export const CircuitParameterError = getErrorHandlerProp('CircuitParameterError');

/**
 * Error class for circuit version mismatches
 * @type {Promise<Function>}
 */
export const CircuitVersionError = getErrorHandlerProp('CircuitVersionError');

/**
 * Error class for proof generation failures
 * @type {Promise<Function>}
 */
export const ProofError = getErrorHandlerProp('ProofError');

/**
 * Error class for witness generation failures
 * @type {Promise<Function>}
 */
export const ProofWitnessError = getErrorHandlerProp('ProofWitnessError');

/**
 * Error class for proof serialization/deserialization failures
 * @type {Promise<Function>}
 */
export const ProofSerializationError = getErrorHandlerProp('ProofSerializationError');

/**
 * Error class for invalid proof inputs
 * @type {Promise<Function>}
 */
export const ProofInputError = getErrorHandlerProp('ProofInputError');

/**
 * Error class for verification failures
 * @type {Promise<Function>}
 */
export const VerificationError = getErrorHandlerProp('VerificationError');

/**
 * Error class for missing verification keys
 * @type {Promise<Function>}
 */
export const VerificationKeyError = getErrorHandlerProp('VerificationKeyError');

/**
 * Error class for invalid proofs during verification
 * @type {Promise<Function>}
 */
export const VerificationProofError = getErrorHandlerProp('VerificationProofError');

/**
 * Error class for memory-related issues
 * @type {Promise<Function>}
 */
export const MemoryError = getErrorHandlerProp('MemoryError');

/**
 * Error class for insufficient memory conditions
 * @type {Promise<Function>}
 */
export const InsufficientMemoryError = getErrorHandlerProp('InsufficientMemoryError');

/**
 * Error class for network-related issues
 * @type {Promise<Function>}
 */
export const NetworkError = getErrorHandlerProp('NetworkError');

/**
 * Error class for network timeout conditions
 * @type {Promise<Function>}
 */
export const NetworkTimeoutError = getErrorHandlerProp('NetworkTimeoutError');

/**
 * Error class for server-side errors
 * @type {Promise<Function>}
 */
export const NetworkServerError = getErrorHandlerProp('NetworkServerError');

/**
 * Error class for rate limit errors
 * @type {Promise<Function>}
 */
export const RateLimitError = getErrorHandlerProp('RateLimitError');

/**
 * Error class for security-related issues
 * @type {Promise<Function>}
 */
export const SecurityError = getErrorHandlerProp('SecurityError');

/**
 * Error class for input validation failures
 * @type {Promise<Function>}
 */
export const InputError = getErrorHandlerProp('InputError');

/**
 * Error class for system-level issues
 * @type {Promise<Function>}
 */
export const SystemError = getErrorHandlerProp('SystemError');

/**
 * Error class for compatibility issues
 * @type {Promise<Function>}
 */
export const CompatibilityError = getErrorHandlerProp('CompatibilityError');

/**
 * Error class for WebAssembly-related issues
 * @type {Promise<Function>}
 */
export const WebAssemblyError = getErrorHandlerProp('WebAssemblyError');

/**
 * Utility function to check if an error is a ZKError
 * @type {Promise<Function>}
 */
export const isZKError = getErrorHandlerProp('isZKError');

/**
 * Utility function to convert generic errors to ZKErrors
 * @type {Promise<Function>}
 */
export const fromError = getErrorHandlerProp('fromError');

/**
 * Utility function to get localized error messages
 * @type {Promise<Function>}
 */
export const getLocalizedErrorMessage = getErrorHandlerProp('getLocalizedErrorMessage');

/**
 * Utility function to create ZKErrors from codes
 * @type {Promise<Function>}
 */
export const createZKError = getErrorHandlerProp('createZKError');

/**
 * Factory for creating and managing ZKErrors
 * @type {Promise<Object>}
 */
export const ZKErrorFactory = getErrorHandlerProp('ZKErrorFactory');