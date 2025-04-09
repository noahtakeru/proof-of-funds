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
 */

// Error severity levels
const ErrorSeverity = {
  CRITICAL: 'critical',  // Application cannot continue
  ERROR: 'error',        // Operation failed but application can continue
  WARNING: 'warning',    // Operation succeeded with issues
  INFO: 'info'           // Informational only
};

// Error categories
const ErrorCategory = {
  CIRCUIT: 'circuit',        // Errors in circuit design/constraints
  PROOF: 'proof',            // Errors in proof generation
  VERIFICATION: 'verification', // Errors in proof verification
  MEMORY: 'memory',          // Memory-related errors
  NETWORK: 'network',        // Network and API errors
  SECURITY: 'security',      // Security-related errors
  INPUT: 'input',            // Input validation errors
  SYSTEM: 'system',          // System/environment errors
  COMPATIBILITY: 'compatibility' // Browser/environment compatibility issues
};

// Error codes by category
const ErrorCode = {
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

// Base ZK error class
class ZKError extends Error {
  constructor(message, options = {}) {
    super(message);
    
    // Standard Error properties
    this.name = this.constructor.name;
    
    // Extended properties
    this.code = options.code || 0;
    this.severity = options.severity || ErrorSeverity.ERROR;
    this.category = options.category || ErrorCategory.SYSTEM;
    this.details = options.details || {};
    this.timestamp = options.timestamp || new Date();
    this.operationId = options.operationId;
    this.recoverable = options.recoverable !== undefined ? options.recoverable : false;
    this.userFixable = options.userFixable !== undefined ? options.userFixable : false;
    this.expected = options.expected !== undefined ? options.expected : false;
    this.securityCritical = options.securityCritical !== undefined ? options.securityCritical : false;
    this.recommendedAction = options.recommendedAction || null;
    this.technicalDetails = options.technicalDetails || null;
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Creates a user-friendly message with actionable information
   * @returns {string} User-friendly error message
   */
  toUserMessage() {
    let message = this.message;
    
    if (this.userFixable && this.recommendedAction) {
      message += `\n\nRecommended action: ${this.recommendedAction}`;
    }
    
    return message;
  }
  
  /**
   * Creates a detailed technical message for debugging
   * @returns {string} Technical error details
   */
  toTechnicalMessage() {
    let message = `[${this.code}] ${this.name}: ${this.message}`;
    
    if (this.technicalDetails) {
      message += `\n\nTechnical details: ${this.technicalDetails}`;
    }
    
    if (this.stack) {
      message += `\n\n${this.stack}`;
    }
    
    return message;
  }
  
  /**
   * Creates a structured object for error logging
   * @param {boolean} includeStack - Whether to include stack trace
   * @returns {Object} Structured error data for logging
   */
  toLogFormat(includeStack = false) {
    // Create a sanitized copy for logging
    const logData = {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      category: this.category,
      timestamp: this.timestamp.toISOString(),
      operationId: this.operationId,
      recoverable: this.recoverable,
      userFixable: this.userFixable,
      expected: this.expected,
      securityCritical: this.securityCritical
    };
    
    // Only include sensitive details for development environment
    if (process.env.NODE_ENV === 'development' && includeStack) {
      logData.stack = this.stack;
      logData.details = this.details;
      logData.technicalDetails = this.technicalDetails;
    }
    
    return logData;
  }
}

// Circuit-related errors
class CircuitError extends ZKError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      category: ErrorCategory.CIRCUIT,
      code: options.code || ErrorCode.CIRCUIT_EXECUTION_ERROR
    });
  }
}

class CircuitConstraintError extends CircuitError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || ErrorCode.CIRCUIT_CONSTRAINT_FAILURE,
      recoverable: false
    });
  }
}

class CircuitCompilationError extends CircuitError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || ErrorCode.CIRCUIT_COMPILATION_ERROR,
      recoverable: false
    });
  }
}

class CircuitParameterError extends CircuitError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || ErrorCode.CIRCUIT_PARAMETER_ERROR,
      recoverable: true,
      userFixable: true
    });
  }
}

class CircuitVersionError extends CircuitError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || ErrorCode.CIRCUIT_VERSION_MISMATCH,
      recoverable: false
    });
  }
}

// Proof generation errors
class ProofError extends ZKError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      category: ErrorCategory.PROOF,
      code: options.code || ErrorCode.PROOF_GENERATION_FAILED
    });
  }
}

class ProofWitnessError extends ProofError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || ErrorCode.PROOF_WITNESS_ERROR,
      recoverable: false
    });
  }
}

class ProofSerializationError extends ProofError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || ErrorCode.PROOF_SERIALIZATION_ERROR,
      recoverable: true
    });
  }
}

class ProofInputError extends ProofError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || ErrorCode.PROOF_INPUT_INVALID,
      recoverable: true,
      userFixable: true
    });
  }
}

// Verification errors
class VerificationError extends ZKError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      category: ErrorCategory.VERIFICATION,
      code: options.code || ErrorCode.VERIFICATION_FAILED
    });
  }
}

class VerificationKeyError extends VerificationError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || ErrorCode.VERIFICATION_KEY_MISSING,
      recoverable: false
    });
  }
}

class VerificationProofError extends VerificationError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || ErrorCode.VERIFICATION_PROOF_INVALID,
      recoverable: false
    });
  }
}

// Memory errors
class MemoryError extends ZKError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      category: ErrorCategory.MEMORY,
      code: options.code || ErrorCode.MEMORY_INSUFFICIENT
    });
  }
}

class InsufficientMemoryError extends MemoryError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || ErrorCode.MEMORY_INSUFFICIENT,
      recoverable: true,
      recommendedAction: "Try using a device with more memory or switch to server-side processing."
    });
  }
}

// Network errors
class NetworkError extends ZKError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      category: ErrorCategory.NETWORK,
      code: options.code || ErrorCode.NETWORK_REQUEST_FAILED
    });
  }
}

class NetworkTimeoutError extends NetworkError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || ErrorCode.NETWORK_TIMEOUT,
      recoverable: true,
      recommendedAction: "Check your internet connection and try again."
    });
  }
}

class NetworkServerError extends NetworkError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || ErrorCode.NETWORK_SERVER_ERROR,
      recoverable: true,
      userFixable: false
    });
  }
}

class RateLimitError extends NetworkError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || ErrorCode.NETWORK_RATE_LIMIT,
      recoverable: true,
      userFixable: true,
      recommendedAction: "Please wait a moment before trying again."
    });
  }
}

// Security errors
class SecurityError extends ZKError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      category: ErrorCategory.SECURITY,
      code: options.code || ErrorCode.SECURITY_DATA_INTEGRITY,
      securityCritical: true
    });
  }
}

// Input errors
class InputError extends ZKError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      category: ErrorCategory.INPUT,
      code: options.code || ErrorCode.INPUT_VALIDATION_FAILED,
      recoverable: true,
      userFixable: true
    });
  }
}

// System errors
class SystemError extends ZKError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      category: ErrorCategory.SYSTEM,
      code: options.code || ErrorCode.SYSTEM_NOT_INITIALIZED
    });
  }
}

// Compatibility errors
class CompatibilityError extends ZKError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      category: ErrorCategory.COMPATIBILITY,
      code: options.code || ErrorCode.COMPATIBILITY_BROWSER_UNSUPPORTED,
      recoverable: false,
      userFixable: true,
      recommendedAction: "Try using a more modern browser like Chrome, Firefox, or Edge."
    });
  }
}

class WebAssemblyError extends CompatibilityError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || ErrorCode.COMPATIBILITY_WASM_UNAVAILABLE,
      recommendedAction: "Try using a browser that supports WebAssembly, or enable WebAssembly in your current browser."
    });
  }
}

/**
 * Determines if an error is an instance of ZKError or its subclasses
 * @param {Error} error - The error to check
 * @returns {boolean} Whether the error is a ZKError
 */
const isZKError = (error) => {
  return error instanceof ZKError;
};

/**
 * Creates a ZKError instance from a standard Error or error-like object
 * @param {Error|Object} error - The error to convert
 * @param {Object} options - Additional options for the ZKError
 * @returns {ZKError} A ZKError instance
 */
const fromError = (error, options = {}) => {
  if (isZKError(error)) {
    return error;
  }
  
  const message = error.message || 'Unknown error';
  return new ZKError(message, options);
};

/**
 * Gets a localized error message for the given error code
 * @param {number} code - The error code
 * @param {string} locale - The locale (defaults to 'en')
 * @returns {string} Localized error message
 */
const getLocalizedErrorMessage = (code, locale = 'en') => {
  // This is a simplified implementation - in production this would load 
  // from localization files or a database
  const localizedMessages = {
    en: {
      [ErrorCode.CIRCUIT_CONSTRAINT_FAILURE]: 'Circuit constraint not satisfied',
      [ErrorCode.CIRCUIT_COMPILATION_ERROR]: 'Failed to compile circuit',
      [ErrorCode.CIRCUIT_EXECUTION_ERROR]: 'Error executing circuit',
      [ErrorCode.CIRCUIT_PARAMETER_ERROR]: 'Invalid circuit parameter',
      [ErrorCode.CIRCUIT_VERSION_MISMATCH]: 'Circuit version mismatch',
      
      [ErrorCode.PROOF_GENERATION_FAILED]: 'Failed to generate proof',
      [ErrorCode.PROOF_WITNESS_ERROR]: 'Error generating witness',
      [ErrorCode.PROOF_SERIALIZATION_ERROR]: 'Failed to serialize/deserialize proof',
      [ErrorCode.PROOF_INPUT_INVALID]: 'Invalid proof input',
      [ErrorCode.PROOF_TYPE_UNSUPPORTED]: 'Unsupported proof type',
      
      [ErrorCode.VERIFICATION_FAILED]: 'Proof verification failed',
      [ErrorCode.VERIFICATION_KEY_MISSING]: 'Verification key missing',
      [ErrorCode.VERIFICATION_PROOF_INVALID]: 'Invalid proof format for verification',
      [ErrorCode.VERIFICATION_SIGNAL_ERROR]: 'Error processing verification signals',
      
      [ErrorCode.MEMORY_ALLOCATION_FAILED]: 'Failed to allocate memory',
      [ErrorCode.MEMORY_INSUFFICIENT]: 'Not enough memory to complete operation',
      [ErrorCode.MEMORY_LIMIT_EXCEEDED]: 'Memory limit exceeded',
      
      [ErrorCode.NETWORK_REQUEST_FAILED]: 'Network request failed',
      [ErrorCode.NETWORK_TIMEOUT]: 'Network request timed out',
      [ErrorCode.NETWORK_SERVER_ERROR]: 'Server error occurred',
      [ErrorCode.NETWORK_RATE_LIMIT]: 'Rate limit exceeded',
      
      [ErrorCode.SECURITY_PERMISSION_DENIED]: 'Permission denied',
      [ErrorCode.SECURITY_DATA_INTEGRITY]: 'Data integrity check failed',
      [ErrorCode.SECURITY_KEY_ERROR]: 'Key management error',
      
      [ErrorCode.INPUT_VALIDATION_FAILED]: 'Input validation failed',
      [ErrorCode.INPUT_MISSING_REQUIRED]: 'Required input missing',
      [ErrorCode.INPUT_TYPE_ERROR]: 'Input type mismatch',
      
      [ErrorCode.SYSTEM_NOT_INITIALIZED]: 'System not initialized',
      [ErrorCode.SYSTEM_FEATURE_UNSUPPORTED]: 'Feature not supported',
      [ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE]: 'System resource unavailable',
      
      [ErrorCode.COMPATIBILITY_BROWSER_UNSUPPORTED]: 'Browser not supported',
      [ErrorCode.COMPATIBILITY_WASM_UNAVAILABLE]: 'WebAssembly not available',
      [ErrorCode.COMPATIBILITY_API_UNAVAILABLE]: 'Required API not available'
    },
    // Add other locales as needed
  };
  
  const messages = localizedMessages[locale] || localizedMessages.en;
  return messages[code] || 'Unknown error';
};

// CommonJS exports
module.exports = {
  ErrorSeverity,
  ErrorCategory,
  ErrorCode,
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
  isZKError,
  fromError,
  getLocalizedErrorMessage
};