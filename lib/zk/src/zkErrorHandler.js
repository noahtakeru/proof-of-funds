/**
 * Re-export file for zkErrorHandler
 * 
 * This file is a compatibility layer that provides direct exports
 * from the zkErrorHandler.mjs module.
 * 
 * @module zkErrorHandler
 */

// Define error classes and constants that can be used synchronously
/**
 * Error severity levels for categorizing the impact of errors.
 * Used to determine the appropriate logging and handling strategies.
 * 
 * @enum {string}
 */
export const ErrorSeverity = {
  CRITICAL: 'critical',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

/**
 * Error categories for classifying errors by their domain or subsystem.
 * Helps in routing errors to the appropriate handlers and analyzers.
 * 
 * @enum {string}
 */
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

/**
 * Error codes for specific error conditions within the ZK system.
 * Each code uniquely identifies a particular error scenario.
 * 
 * @enum {number}
 */
export const ZKErrorCode = {
  // Circuit errors (1000-1999)
  CIRCUIT_CONSTRAINT_FAILURE: 1001,
  CIRCUIT_COMPILATION_ERROR: 1002,
  CIRCUIT_EXECUTION_ERROR: 1003,
  CIRCUIT_PARAMETER_ERROR: 1004,
  CIRCUIT_VERSION_MISMATCH: 1005,

  // Proof errors (2000-2999)
  PROOF_GENERATION_FAILED: 2001,
  PROOF_WITNESS_ERROR: 2002,
  PROOF_SERIALIZATION_ERROR: 2003,
  PROOF_INPUT_INVALID: 2004,
  PROOF_TYPE_UNSUPPORTED: 2005,

  // Verification errors (3000-3999)
  VERIFICATION_FAILED: 3001,
  VERIFICATION_KEY_MISSING: 3002,
  VERIFICATION_PROOF_INVALID: 3003,
  VERIFICATION_SIGNAL_ERROR: 3004,

  // Memory errors (4000-4999)
  MEMORY_ALLOCATION_FAILED: 4001,
  MEMORY_INSUFFICIENT: 4002,
  MEMORY_LIMIT_EXCEEDED: 4003,

  // Network errors (5000-5999)
  NETWORK_REQUEST_FAILED: 5001,
  NETWORK_TIMEOUT: 5002,
  NETWORK_SERVER_ERROR: 5003,
  NETWORK_RATE_LIMIT: 5004,

  // Security errors (6000-6999)
  SECURITY_PERMISSION_DENIED: 6001,
  SECURITY_DATA_INTEGRITY: 6002,
  SECURITY_KEY_ERROR: 6003,

  // Input errors (7000-7999)
  INPUT_VALIDATION_FAILED: 7001,
  INPUT_MISSING_REQUIRED: 7002,
  INPUT_TYPE_ERROR: 7003,

  // System errors (8000-8999)
  SYSTEM_NOT_INITIALIZED: 8001,
  SYSTEM_FEATURE_UNSUPPORTED: 8002,
  SYSTEM_RESOURCE_UNAVAILABLE: 8003,

  // Compatibility errors (9000-9999)
  COMPATIBILITY_BROWSER_UNSUPPORTED: 9001,
  COMPATIBILITY_WASM_UNAVAILABLE: 9002,
  COMPATIBILITY_API_UNAVAILABLE: 9003
};

// Basic error classes that work without the full module loaded
/**
 * Base error class for all ZK-related errors.
 * Provides common properties and behavior for derived error classes.
 * 
 * @class
 * @extends Error
 */
export class ZKError extends Error {
  /**
   * Create a new ZKError instance
   * 
   * @param {string|Object} message - Error message or error options object
   * @param {Object} [options={}] - Error configuration options
   * @param {number} [options.code=0] - Error code
   * @param {string} [options.severity] - Error severity level
   * @param {Object} [options.details={}] - Additional error details
   * @param {string} [options.operationId] - Operation ID for tracking
   * @param {boolean} [options.recoverable=false] - Whether the error is recoverable
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'ZKError';
    this.code = options.code || 0;
    this.severity = options.severity || ErrorSeverity.ERROR;
    this.details = options.details || {};
    this.timestamp = new Date();
    this.operationId = options.operationId || `zk_error_${Date.now()}`;
    this.recoverable = options.recoverable !== undefined ? options.recoverable : false;
  }
}

/**
 * Error class for input validation failures.
 * Used when user inputs or API parameters fail validation.
 * 
 * @class
 * @extends ZKError
 */
export class InputError extends ZKError {
  /**
   * Create a new InputError instance
   * 
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error configuration options
   */
  constructor(message, options = {}) {
    super(message, { ...options, category: 'input' });
    this.name = 'InputError';
  }
}

/**
 * Error class for proof generation and manipulation failures.
 * Used when operations on ZK proofs fail.
 * 
 * @class
 * @extends ZKError
 */
export class ProofError extends ZKError {
  /**
   * Create a new ProofError instance
   * 
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error configuration options
   */
  constructor(message, options = {}) {
    super(message, { ...options, category: 'proof' });
    this.name = 'ProofError';
  }
}

/**
 * Error class for proof verification failures.
 * Used when ZK proof verification operations fail.
 * 
 * @class
 * @extends ZKError
 */
export class VerificationError extends ZKError {
  /**
   * Create a new VerificationError instance
   * 
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error configuration options
   */
  constructor(message, options = {}) {
    super(message, { ...options, category: 'verification' });
    this.name = 'VerificationError';
  }
}

/**
 * Error class for network-related failures.
 * Used when network operations or communications fail.
 * 
 * @class
 * @extends ZKError
 */
export class NetworkError extends ZKError {
  /**
   * Create a new NetworkError instance
   * 
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error configuration options
   */
  constructor(message, options = {}) {
    super(message, { ...options, category: 'network' });
    this.name = 'NetworkError';
  }
}

/**
 * Error class for system-level failures.
 * Used when core system operations fail.
 * 
 * @class
 * @extends ZKError
 */
export class SystemError extends ZKError {
  /**
   * Create a new SystemError instance
   * 
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error configuration options
   */
  constructor(message, options = {}) {
    super(message, { ...options, category: 'system' });
    this.name = 'SystemError';
  }
}

/**
 * Error class for security-related failures.
 * Used when security checks or operations fail.
 * 
 * @class
 * @extends ZKError
 */
export class SecurityError extends ZKError {
  /**
   * Create a new SecurityError instance
   * 
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error configuration options
   */
  constructor(message, options = {}) {
    super(message, { ...options, category: 'security' });
    this.name = 'SecurityError';
  }
}

/**
 * Error class for proof serialization failures.
 * Used when converting proofs to/from transportable formats fails.
 * 
 * @class
 * @extends ProofError
 */
export class ProofSerializationError extends ProofError {
  /**
   * Create a new ProofSerializationError instance
   * 
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error configuration options
   */
  constructor(message, options = {}) {
    super(message, { ...options, code: ZKErrorCode.PROOF_SERIALIZATION_ERROR });
    this.name = 'ProofSerializationError';
  }
}

/**
 * Check if an error is a ZKError instance.
 * 
 * @param {Error} error - The error to check
 * @returns {boolean} True if the error is a ZKError or its subclass
 */
export function isZKError(error) {
  return error instanceof ZKError;
}

/**
 * Create a ZKError instance of the appropriate type based on the error code.
 * Factory function that maps error codes to specific error classes.
 * 
 * @param {number} code - The error code to use
 * @param {string} message - The error message
 * @param {Object} [options={}] - Additional error options
 * @returns {ZKError} A new error instance of the appropriate type
 */
export function createZKError(code, message, options = {}) {
  const errorOptions = { ...options, code };

  // Create appropriate error type based on code
  if (code >= 1000 && code < 2000) {
    return new CircuitError(message, errorOptions);
  } else if (code >= 2000 && code < 3000) {
    return new ProofError(message, errorOptions);
  } else if (code >= 3000 && code < 4000) {
    return new VerificationError(message, errorOptions);
  } else if (code >= 4000 && code < 5000) {
    return new MemoryError(message, errorOptions);
  } else if (code >= 5000 && code < 6000) {
    return new NetworkError(message, errorOptions);
  } else if (code >= 6000 && code < 7000) {
    return new SecurityError(message, errorOptions);
  } else if (code >= 7000 && code < 8000) {
    return new InputError(message, errorOptions);
  } else if (code >= 8000 && code < 9000) {
    return new SystemError(message, errorOptions);
  } else if (code >= 9000 && code < 10000) {
    return new CompatibilityError(message, errorOptions);
  }

  // Default to base ZKError for unknown codes
  return new ZKError(message, errorOptions);
}

// Additional error classes for completeness
/**
 * Error class for circuit-related failures.
 * Used when ZK circuit operations fail.
 * 
 * @class
 * @extends ZKError
 */
export class CircuitError extends ZKError {
  /**
   * Create a new CircuitError instance
   * 
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error configuration options
   */
  constructor(message, options = {}) {
    super(message, { ...options, category: 'circuit' });
    this.name = 'CircuitError';
  }
}

/**
 * Error class for memory-related failures.
 * Used when memory allocation or management operations fail.
 * 
 * @class
 * @extends ZKError
 */
export class MemoryError extends ZKError {
  /**
   * Create a new MemoryError instance
   * 
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error configuration options
   */
  constructor(message, options = {}) {
    super(message, { ...options, category: 'memory' });
    this.name = 'MemoryError';
  }
}

/**
 * Error class for compatibility-related failures.
 * Used when environment or platform compatibility issues occur.
 * 
 * @class
 * @extends ZKError
 */
export class CompatibilityError extends ZKError {
  /**
   * Create a new CompatibilityError instance
   * 
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error configuration options
   */
  constructor(message, options = {}) {
    super(message, { ...options, category: 'compatibility' });
    this.name = 'CompatibilityError';
  }
}

/**
 * Default export for the ZK error handler.
 * Provides all error classes, constants, and utility functions
 * in a single object for convenient default imports.
 * 
 * @type {Object}
 */
export default {
  ErrorSeverity,
  ErrorCategory,
  ZKErrorCode,
  ZKError,
  InputError,
  ProofError,
  VerificationError,
  NetworkError,
  SystemError,
  SecurityError,
  ProofSerializationError,
  CircuitError,
  MemoryError,
  CompatibilityError,
  isZKError,
  createZKError
};