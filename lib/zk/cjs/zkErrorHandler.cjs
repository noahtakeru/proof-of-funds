/**
 * Zero Knowledge Proof Error Handling Framework
 * CommonJS version
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
  
  // Other errors (shortened for brevity)
  PROOF_GENERATION_FAILED: 2001,
  VERIFICATION_FAILED: 3001,
  MEMORY_INSUFFICIENT: 4001,
  NETWORK_REQUEST_FAILED: 5001,
  INPUT_VALIDATION_FAILED: 7001
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
    this.recoverable = options.recoverable \!== undefined ? options.recoverable : false;
  }
}

// Factory for creating ZK errors
const ZKErrorFactory = {
  createCircuitError: (message, options = {}) => {
    return new ZKError(message, {
      ...options,
      category: ErrorCategory.CIRCUIT
    });
  },
  
  createProofError: (message, options = {}) => {
    return new ZKError(message, {
      ...options,
      category: ErrorCategory.PROOF
    });
  },
  
  createInputError: (message, options = {}) => {
    return new ZKError(message, {
      ...options,
      category: ErrorCategory.INPUT
    });
  }
};

// Function to check if an error is a ZKError
const isZKError = (error) => error instanceof ZKError;

// Function to create a ZK error from a code
const createZKError = (code, message, options = {}) => {
  return new ZKError(message, { ...options, code });
};

// CommonJS exports
module.exports = {
  ErrorSeverity,
  ErrorCategory,
  ErrorCode,
  ZKError,
  ZKErrorFactory,
  isZKError,
  createZKError
};
