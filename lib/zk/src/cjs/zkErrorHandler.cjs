/**
 * Zero Knowledge Proof Error Handling Framework (CommonJS Version)
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
 * NOTE: This is the CommonJS version of the error handling framework.
 */

// Import dependencies (CJS format)
const zkErrorLogger = require('./zkErrorLogger.cjs');

/**
 * Error severity levels for classifying errors by impact
 * 
 * @enum {string}
 * @readonly
 */
const ErrorSeverity = Object.freeze({
  /** Informational message, not an actual error */
  INFO: 'info',
  /** Warning level issues that don't prevent operation */
  WARNING: 'warning',
  /** Errors that prevent the current operation but allow system to continue */
  ERROR: 'error',
  /** Critical errors that may compromise system integrity */
  CRITICAL: 'critical',
  /** Fatal errors requiring immediate attention and system shutdown */
  FATAL: 'fatal'
});

/**
 * Error categories for classifying errors by domain
 * 
 * @enum {string}
 * @readonly
 */
const ErrorCategory = Object.freeze({
  /** Input validation and formatting errors */
  INPUT: 'input',
  /** Circuit-related errors (constraints, compilation, etc.) */
  CIRCUIT: 'circuit',
  /** Proof generation and verification errors */
  PROOF: 'proof',
  /** Memory management errors */
  MEMORY: 'memory',
  /** Network and communication errors */
  NETWORK: 'network',
  /** Security-related errors */
  SECURITY: 'security',
  /** System-level errors */
  SYSTEM: 'system',
  /** Compatibility issues with browsers, devices, etc. */
  COMPATIBILITY: 'compatibility'
});

/**
 * Error codes for specific error conditions, organized by category
 * 
 * @enum {number}
 * @readonly
 */
const ErrorCode = Object.freeze({
  // System errors (1000-1999)
  SYSTEM_UNKNOWN_ERROR: 1000,
  SYSTEM_FEATURE_UNSUPPORTED: 1001,
  SYSTEM_RESOURCE_UNAVAILABLE: 1002,
  
  // Input validation errors (2000-2999)
  INPUT_MISSING_REQUIRED: 2000,
  INPUT_TYPE_ERROR: 2001,
  INPUT_VALIDATION_FAILED: 2002,
  INPUT_OUT_OF_RANGE: 2003,
  
  // Circuit errors (3000-3999)
  CIRCUIT_COMPILATION_FAILED: 3000,
  CIRCUIT_CONSTRAINT_VIOLATED: 3001,
  CIRCUIT_PARAMETER_INVALID: 3002,
  CIRCUIT_VERSION_MISMATCH: 3003,
  
  // Proof generation errors (4000-4999)
  PROOF_GENERATION_FAILED: 4000,
  PROOF_WITNESS_GENERATION_FAILED: 4001,
  PROOF_SERIALIZATION_ERROR: 4002,
  
  // Verification errors (5000-5999)
  VERIFICATION_FAILED: 5000,
  VERIFICATION_KEY_MISSING: 5001,
  VERIFICATION_PROOF_INVALID: 5002,
  
  // Memory errors (6000-6999)
  MEMORY_ALLOCATION_FAILED: 6000,
  MEMORY_LIMIT_EXCEEDED: 6001,
  
  // Network errors (7000-7999)
  NETWORK_REQUEST_FAILED: 7000,
  NETWORK_TIMEOUT: 7001,
  NETWORK_SERVER_ERROR: 7002,
  NETWORK_RATE_LIMIT_EXCEEDED: 7003,
  
  // Security errors (8000-8999)
  SECURITY_TAMPERING_DETECTED: 8000,
  SECURITY_UNAUTHORIZED_ACCESS: 8001,
  
  // Compatibility errors (9000-9999)
  COMPATIBILITY_BROWSER_UNSUPPORTED: 9000,
  COMPATIBILITY_DEVICE_UNSUPPORTED: 9001,
  COMPATIBILITY_WASM_UNSUPPORTED: 9002
});

/**
 * Base error class for all ZK-related errors
 * 
 * @class ZKError
 * @extends Error
 */
class ZKError extends Error {
  /**
   * Create a new ZKError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   * @param {number} [options.code] - Error code from ErrorCode enum
   * @param {string} [options.severity] - Error severity from ErrorSeverity enum
   * @param {string} [options.category] - Error category from ErrorCategory enum
   * @param {boolean} [options.recoverable] - Whether the error is recoverable
   * @param {boolean} [options.userFixable] - Whether the user can fix the issue
   * @param {string} [options.suggestedFix] - Suggested solution for the error
   * @param {Object} [options.details] - Additional error details
   * @param {Error} [options.originalError] - Original error that caused this error
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'ZKError';
    this.code = options.code || ErrorCode.SYSTEM_UNKNOWN_ERROR;
    this.severity = options.severity || ErrorSeverity.ERROR;
    this.category = options.category || ErrorCategory.SYSTEM;
    this.recoverable = options.recoverable !== undefined ? options.recoverable : false;
    this.userFixable = options.userFixable !== undefined ? options.userFixable : false;
    this.suggestedFix = options.suggestedFix || null;
    this.details = options.details || {};
    this.timestamp = new Date();
    this.operationId = options.operationId || generateOperationId();
    
    // Track original error for debugging
    if (options.originalError) {
      this.originalError = options.originalError;
      this.originalStack = options.originalError.stack;
    }
    
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
    let result = `${this.name} [${this.code}]: ${this.message}`;
    
    if (this.suggestedFix) {
      result += `\nSuggested fix: ${this.suggestedFix}`;
    }
    
    if (this.details && Object.keys(this.details).length > 0) {
      // Filter out sensitive information
      const safeDetails = { ...this.details };
      delete safeDetails.privateKey;
      delete safeDetails.secretData;
      delete safeDetails.userSecrets;
      
      result += `\nDetails: ${JSON.stringify(safeDetails, null, 2)}`;
    }
    
    if (this.originalError) {
      result += `\nOriginal error: ${this.originalError.message}`;
    }
    
    return result;
  }
  
  /**
   * Get a user-friendly error message suitable for display
   * 
   * @returns {string} User-friendly error message
   */
  getUserMessage() {
    let message = this.message;
    
    // Remove technical details for user-facing messages
    message = message.replace(/Error code: \d+/, '');
    message = message.replace(/\[.+\]/, '');
    
    if (this.userFixable && this.suggestedFix) {
      message += ` ${this.suggestedFix}`;
    }
    
    return message;
  }
}

/**
 * Generate a unique operation ID
 * 
 * @private
 * @returns {string} Unique operation ID
 */
function generateOperationId() {
  return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Circuit error class for circuit-related issues
 * 
 * @class CircuitError
 * @extends ZKError
 */
class CircuitError extends ZKError {
  /**
   * Create a new CircuitError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      category: ErrorCategory.CIRCUIT,
      code: options.code || ErrorCode.CIRCUIT_COMPILATION_FAILED,
      ...options
    });
    this.name = 'CircuitError';
  }
}

/**
 * Circuit constraint error class for constraint violations
 * 
 * @class CircuitConstraintError
 * @extends CircuitError
 */
class CircuitConstraintError extends CircuitError {
  /**
   * Create a new CircuitConstraintError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      code: ErrorCode.CIRCUIT_CONSTRAINT_VIOLATED,
      ...options
    });
    this.name = 'CircuitConstraintError';
  }
}

/**
 * Circuit compilation error class for compilation failures
 * 
 * @class CircuitCompilationError
 * @extends CircuitError
 */
class CircuitCompilationError extends CircuitError {
  /**
   * Create a new CircuitCompilationError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      code: ErrorCode.CIRCUIT_COMPILATION_FAILED,
      ...options
    });
    this.name = 'CircuitCompilationError';
  }
}

/**
 * Circuit parameter error class for parameter validation failures
 * 
 * @class CircuitParameterError
 * @extends CircuitError
 */
class CircuitParameterError extends CircuitError {
  /**
   * Create a new CircuitParameterError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      code: ErrorCode.CIRCUIT_PARAMETER_INVALID,
      ...options
    });
    this.name = 'CircuitParameterError';
  }
}

/**
 * Circuit version error class for version mismatches
 * 
 * @class CircuitVersionError
 * @extends CircuitError
 */
class CircuitVersionError extends CircuitError {
  /**
   * Create a new CircuitVersionError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      code: ErrorCode.CIRCUIT_VERSION_MISMATCH,
      ...options
    });
    this.name = 'CircuitVersionError';
  }
}

/**
 * Proof error class for proof generation issues
 * 
 * @class ProofError
 * @extends ZKError
 */
class ProofError extends ZKError {
  /**
   * Create a new ProofError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      category: ErrorCategory.PROOF,
      code: options.code || ErrorCode.PROOF_GENERATION_FAILED,
      ...options
    });
    this.name = 'ProofError';
  }
}

/**
 * Proof witness error class for witness generation failures
 * 
 * @class ProofWitnessError
 * @extends ProofError
 */
class ProofWitnessError extends ProofError {
  /**
   * Create a new ProofWitnessError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      code: ErrorCode.PROOF_WITNESS_GENERATION_FAILED,
      ...options
    });
    this.name = 'ProofWitnessError';
  }
}

/**
 * Proof serialization error class for serialization/deserialization failures
 * 
 * @class ProofSerializationError
 * @extends ProofError
 */
class ProofSerializationError extends ProofError {
  /**
   * Create a new ProofSerializationError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      code: ErrorCode.PROOF_SERIALIZATION_ERROR,
      ...options
    });
    this.name = 'ProofSerializationError';
  }
}

/**
 * Proof input error class for invalid proof inputs
 * 
 * @class ProofInputError
 * @extends ProofError
 */
class ProofInputError extends ProofError {
  /**
   * Create a new ProofInputError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      code: ErrorCode.INPUT_VALIDATION_FAILED,
      ...options
    });
    this.name = 'ProofInputError';
  }
}

/**
 * Verification error class for verification failures
 * 
 * @class VerificationError
 * @extends ZKError
 */
class VerificationError extends ZKError {
  /**
   * Create a new VerificationError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      category: ErrorCategory.PROOF,
      code: options.code || ErrorCode.VERIFICATION_FAILED,
      ...options
    });
    this.name = 'VerificationError';
  }
}

/**
 * Verification key error class for missing verification keys
 * 
 * @class VerificationKeyError
 * @extends VerificationError
 */
class VerificationKeyError extends VerificationError {
  /**
   * Create a new VerificationKeyError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      code: ErrorCode.VERIFICATION_KEY_MISSING,
      ...options
    });
    this.name = 'VerificationKeyError';
  }
}

/**
 * Verification proof error class for invalid proofs during verification
 * 
 * @class VerificationProofError
 * @extends VerificationError
 */
class VerificationProofError extends VerificationError {
  /**
   * Create a new VerificationProofError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      code: ErrorCode.VERIFICATION_PROOF_INVALID,
      ...options
    });
    this.name = 'VerificationProofError';
  }
}

/**
 * Memory error class for memory-related issues
 * 
 * @class MemoryError
 * @extends ZKError
 */
class MemoryError extends ZKError {
  /**
   * Create a new MemoryError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      category: ErrorCategory.MEMORY,
      code: options.code || ErrorCode.MEMORY_ALLOCATION_FAILED,
      ...options
    });
    this.name = 'MemoryError';
  }
}

/**
 * Insufficient memory error class for memory limit conditions
 * 
 * @class InsufficientMemoryError
 * @extends MemoryError
 */
class InsufficientMemoryError extends MemoryError {
  /**
   * Create a new InsufficientMemoryError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      code: ErrorCode.MEMORY_LIMIT_EXCEEDED,
      ...options
    });
    this.name = 'InsufficientMemoryError';
  }
}

/**
 * Network error class for network-related issues
 * 
 * @class NetworkError
 * @extends ZKError
 */
class NetworkError extends ZKError {
  /**
   * Create a new NetworkError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      category: ErrorCategory.NETWORK,
      code: options.code || ErrorCode.NETWORK_REQUEST_FAILED,
      ...options
    });
    this.name = 'NetworkError';
  }
}

/**
 * Network timeout error class for network timeout conditions
 * 
 * @class NetworkTimeoutError
 * @extends NetworkError
 */
class NetworkTimeoutError extends NetworkError {
  /**
   * Create a new NetworkTimeoutError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      code: ErrorCode.NETWORK_TIMEOUT,
      ...options
    });
    this.name = 'NetworkTimeoutError';
  }
}

/**
 * Network server error class for server-side errors
 * 
 * @class NetworkServerError
 * @extends NetworkError
 */
class NetworkServerError extends NetworkError {
  /**
   * Create a new NetworkServerError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      code: ErrorCode.NETWORK_SERVER_ERROR,
      ...options
    });
    this.name = 'NetworkServerError';
  }
}

/**
 * Rate limit error class for rate limit issues
 * 
 * @class RateLimitError
 * @extends NetworkError
 */
class RateLimitError extends NetworkError {
  /**
   * Create a new RateLimitError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      code: ErrorCode.NETWORK_RATE_LIMIT_EXCEEDED,
      ...options
    });
    this.name = 'RateLimitError';
  }
}

/**
 * Security error class for security-related issues
 * 
 * @class SecurityError
 * @extends ZKError
 */
class SecurityError extends ZKError {
  /**
   * Create a new SecurityError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      category: ErrorCategory.SECURITY,
      code: options.code || ErrorCode.SECURITY_TAMPERING_DETECTED,
      ...options
    });
    this.name = 'SecurityError';
  }
}

/**
 * Input error class for input validation failures
 * 
 * @class InputError
 * @extends ZKError
 */
class InputError extends ZKError {
  /**
   * Create a new InputError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      category: ErrorCategory.INPUT,
      code: options.code || ErrorCode.INPUT_VALIDATION_FAILED,
      ...options
    });
    this.name = 'InputError';
  }
}

/**
 * System error class for system-level issues
 * 
 * @class SystemError
 * @extends ZKError
 */
class SystemError extends ZKError {
  /**
   * Create a new SystemError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      category: ErrorCategory.SYSTEM,
      code: options.code || ErrorCode.SYSTEM_UNKNOWN_ERROR,
      ...options
    });
    this.name = 'SystemError';
  }
}

/**
 * Compatibility error class for compatibility issues
 * 
 * @class CompatibilityError
 * @extends ZKError
 */
class CompatibilityError extends ZKError {
  /**
   * Create a new CompatibilityError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      category: ErrorCategory.COMPATIBILITY,
      code: options.code || ErrorCode.COMPATIBILITY_BROWSER_UNSUPPORTED,
      ...options
    });
    this.name = 'CompatibilityError';
  }
}

/**
 * WebAssembly error class for WebAssembly-related issues
 * 
 * @class WebAssemblyError
 * @extends CompatibilityError
 */
class WebAssemblyError extends CompatibilityError {
  /**
   * Create a new WebAssemblyError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      code: ErrorCode.COMPATIBILITY_WASM_UNSUPPORTED,
      ...options
    });
    this.name = 'WebAssemblyError';
  }
}

/**
 * Check if an error is a ZKError
 * 
 * @param {Error} error - The error to check
 * @returns {boolean} True if the error is a ZKError
 */
function isZKError(error) {
  return error instanceof ZKError;
}

/**
 * Convert a generic error to a ZKError
 * 
 * @param {Error} error - The error to convert
 * @param {Object} options - Options for the new ZKError
 * @returns {ZKError} The converted error
 */
function fromError(error, options = {}) {
  if (isZKError(error)) {
    return error;
  }
  
  return new ZKError(error.message, {
    originalError: error,
    ...options
  });
}

/**
 * Get a localized error message for a given error code
 * 
 * @param {number} errorCode - The error code
 * @param {string} [locale='en'] - The locale to use
 * @returns {string} The localized error message
 */
function getLocalizedErrorMessage(errorCode, locale = 'en') {
  // Simple implementation for now
  const errorMessages = {
    en: {
      [ErrorCode.SYSTEM_UNKNOWN_ERROR]: 'An unknown system error occurred',
      [ErrorCode.SYSTEM_FEATURE_UNSUPPORTED]: 'This feature is not supported by your system',
      [ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE]: 'System resources are unavailable',
      [ErrorCode.INPUT_MISSING_REQUIRED]: 'A required input is missing',
      [ErrorCode.INPUT_TYPE_ERROR]: 'Input has an invalid type',
      [ErrorCode.INPUT_VALIDATION_FAILED]: 'Input validation failed',
      [ErrorCode.INPUT_OUT_OF_RANGE]: 'Input value is out of allowed range',
      [ErrorCode.CIRCUIT_COMPILATION_FAILED]: 'Circuit compilation failed',
      [ErrorCode.CIRCUIT_CONSTRAINT_VIOLATED]: 'Circuit constraint was violated',
      [ErrorCode.CIRCUIT_PARAMETER_INVALID]: 'Circuit parameter is invalid',
      [ErrorCode.CIRCUIT_VERSION_MISMATCH]: 'Circuit version mismatch',
      [ErrorCode.PROOF_GENERATION_FAILED]: 'Proof generation failed',
      [ErrorCode.PROOF_WITNESS_GENERATION_FAILED]: 'Witness generation failed',
      [ErrorCode.PROOF_SERIALIZATION_ERROR]: 'Proof serialization or deserialization failed',
      [ErrorCode.VERIFICATION_FAILED]: 'Proof verification failed',
      [ErrorCode.VERIFICATION_KEY_MISSING]: 'Verification key is missing',
      [ErrorCode.VERIFICATION_PROOF_INVALID]: 'Proof is invalid for verification',
      [ErrorCode.MEMORY_ALLOCATION_FAILED]: 'Memory allocation failed',
      [ErrorCode.MEMORY_LIMIT_EXCEEDED]: 'Memory limit exceeded',
      [ErrorCode.NETWORK_REQUEST_FAILED]: 'Network request failed',
      [ErrorCode.NETWORK_TIMEOUT]: 'Network request timed out',
      [ErrorCode.NETWORK_SERVER_ERROR]: 'Server error occurred',
      [ErrorCode.NETWORK_RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded for network requests',
      [ErrorCode.SECURITY_TAMPERING_DETECTED]: 'Security tampering detected',
      [ErrorCode.SECURITY_UNAUTHORIZED_ACCESS]: 'Unauthorized access attempt',
      [ErrorCode.COMPATIBILITY_BROWSER_UNSUPPORTED]: 'Your browser is not supported',
      [ErrorCode.COMPATIBILITY_DEVICE_UNSUPPORTED]: 'Your device is not supported',
      [ErrorCode.COMPATIBILITY_WASM_UNSUPPORTED]: 'WebAssembly is not supported in your environment'
    }
  };
  
  return (errorMessages[locale] && errorMessages[locale][errorCode]) || 
         errorMessages.en[ErrorCode.SYSTEM_UNKNOWN_ERROR];
}

/**
 * Create a ZKError from an error code
 * 
 * @param {number} errorCode - The error code
 * @param {string} [message] - Custom error message
 * @param {Object} [options] - Options for the error
 * @returns {ZKError} The created error
 */
function createZKError(errorCode, message, options = {}) {
  const defaultMessage = getLocalizedErrorMessage(errorCode);
  const errorMessage = message || defaultMessage;
  
  // Determine error category and class based on error code
  if (errorCode >= 2000 && errorCode < 3000) {
    return new InputError(errorMessage, { code: errorCode, ...options });
  } else if (errorCode >= 3000 && errorCode < 4000) {
    if (errorCode === ErrorCode.CIRCUIT_CONSTRAINT_VIOLATED) {
      return new CircuitConstraintError(errorMessage, { ...options });
    } else if (errorCode === ErrorCode.CIRCUIT_COMPILATION_FAILED) {
      return new CircuitCompilationError(errorMessage, { ...options });
    } else if (errorCode === ErrorCode.CIRCUIT_PARAMETER_INVALID) {
      return new CircuitParameterError(errorMessage, { ...options });
    } else if (errorCode === ErrorCode.CIRCUIT_VERSION_MISMATCH) {
      return new CircuitVersionError(errorMessage, { ...options });
    } else {
      return new CircuitError(errorMessage, { code: errorCode, ...options });
    }
  } else if (errorCode >= 4000 && errorCode < 5000) {
    if (errorCode === ErrorCode.PROOF_WITNESS_GENERATION_FAILED) {
      return new ProofWitnessError(errorMessage, { ...options });
    } else if (errorCode === ErrorCode.PROOF_SERIALIZATION_ERROR) {
      return new ProofSerializationError(errorMessage, { ...options });
    } else {
      return new ProofError(errorMessage, { code: errorCode, ...options });
    }
  } else if (errorCode >= 5000 && errorCode < 6000) {
    if (errorCode === ErrorCode.VERIFICATION_KEY_MISSING) {
      return new VerificationKeyError(errorMessage, { ...options });
    } else if (errorCode === ErrorCode.VERIFICATION_PROOF_INVALID) {
      return new VerificationProofError(errorMessage, { ...options });
    } else {
      return new VerificationError(errorMessage, { code: errorCode, ...options });
    }
  } else if (errorCode >= 6000 && errorCode < 7000) {
    if (errorCode === ErrorCode.MEMORY_LIMIT_EXCEEDED) {
      return new InsufficientMemoryError(errorMessage, { ...options });
    } else {
      return new MemoryError(errorMessage, { code: errorCode, ...options });
    }
  } else if (errorCode >= 7000 && errorCode < 8000) {
    if (errorCode === ErrorCode.NETWORK_TIMEOUT) {
      return new NetworkTimeoutError(errorMessage, { ...options });
    } else if (errorCode === ErrorCode.NETWORK_SERVER_ERROR) {
      return new NetworkServerError(errorMessage, { ...options });
    } else if (errorCode === ErrorCode.NETWORK_RATE_LIMIT_EXCEEDED) {
      return new RateLimitError(errorMessage, { ...options });
    } else {
      return new NetworkError(errorMessage, { code: errorCode, ...options });
    }
  } else if (errorCode >= 8000 && errorCode < 9000) {
    return new SecurityError(errorMessage, { code: errorCode, ...options });
  } else if (errorCode >= 9000 && errorCode < 10000) {
    if (errorCode === ErrorCode.COMPATIBILITY_WASM_UNSUPPORTED) {
      return new WebAssemblyError(errorMessage, { ...options });
    } else {
      return new CompatibilityError(errorMessage, { code: errorCode, ...options });
    }
  } else {
    return new SystemError(errorMessage, { code: errorCode, ...options });
  }
}

/**
 * Factory for creating and managing ZKErrors
 */
const ZKErrorFactory = {
  /**
   * Create a ZKError from an error code
   * 
   * @param {number} errorCode - The error code
   * @param {string} [message] - Custom error message
   * @param {Object} [options] - Options for the error
   * @returns {ZKError} The created error
   */
  createError: createZKError,
  
  /**
   * Convert a generic error to a ZKError
   * 
   * @param {Error} error - The error to convert
   * @param {Object} options - Options for the new ZKError
   * @returns {ZKError} The converted error
   */
  fromError,
  
  /**
   * Check if an error is a ZKError
   * 
   * @param {Error} error - The error to check
   * @returns {boolean} True if the error is a ZKError
   */
  isZKError,
  
  /**
   * Log an error through the error logging system
   * 
   * @param {Error} error - The error to log
   * @param {Object} context - Additional context for the error
   */
  logError: function(error, context = {}) {
    // First convert to ZKError if needed
    if (!isZKError(error)) {
      error = fromError(error, {
        code: ErrorCode.SYSTEM_UNKNOWN_ERROR,
        ...context
      });
    }
    
    // Then log the error
    zkErrorLogger.zkErrorLogger.logError(error, context);
    
    return error;
  }
};

// CommonJS exports
module.exports = {
  // Constants
  ErrorSeverity,
  ErrorCategory,
  ErrorCode,
  
  // Error classes
  ZKError,
  CircuitError,
  CircuitConstraintError,
  CircuitCompilationError,
  CircuitParameterError,
  CircuitVersionError,
  ProofError,
  ProofWitnessError,
  ProofSerializationError,
  ProofInputError,
  VerificationError,
  VerificationKeyError,
  VerificationProofError,
  MemoryError,
  InsufficientMemoryError,
  NetworkError,
  NetworkTimeoutError,
  NetworkServerError,
  RateLimitError,
  SecurityError,
  InputError,
  SystemError,
  CompatibilityError,
  WebAssemblyError,
  
  // Utility functions
  isZKError,
  fromError,
  getLocalizedErrorMessage,
  createZKError,
  
  // Factory
  ZKErrorFactory
};