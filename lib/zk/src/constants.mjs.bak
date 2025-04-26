/**
 * Constants for Zero-Knowledge Module (ESM Version)
 * 
 * This file provides constants for the ZK proof system, including proof types,
 * security levels, and module formats. All constants are exported using ESM 
 * named exports for better tree-shaking, and a default export is provided for 
 * backward compatibility.
 * 
 * @module constants
 */

/**
 * ZK Proof types supported by the application
 * Each type corresponds to a different circuit implementation and proof strategy.
 * 
 * @enum {string}
 * @readonly
 */
export const ZK_PROOF_TYPES = Object.freeze({
  /** Standard proof verifying an exact amount */
  STANDARD: 'standard',
  /** Threshold proof verifying a minimum amount */
  THRESHOLD: 'threshold',
  /** Maximum proof verifying an amount does not exceed a limit */
  MAXIMUM: 'maximum',
  /** Batch proof combining multiple proof validations */
  BATCH: 'batch'
});

/**
 * Mapping of proof types to human-readable names for display purposes
 * 
 * @enum {string}
 * @readonly
 */
export const PROOF_TYPE_NAMES = Object.freeze({
  /** User-friendly name for standard proofs */
  standard: 'Standard Proof (Exact Amount)',
  /** User-friendly name for threshold proofs */
  threshold: 'Threshold Proof (Minimum Amount)',
  /** User-friendly name for maximum proofs */
  maximum: 'Maximum Proof (Maximum Amount)',
  /** User-friendly name for batch proofs */
  batch: 'Batch Proof (Multiple Proofs)'
});

/**
 * Security levels for input generation and proof validation
 * Different security levels provide different trade-offs between
 * performance and security guarantees.
 * 
 * @enum {string}
 * @readonly
 */
export const SECURITY_LEVELS = Object.freeze({
  /** Standard security with reasonable performance */
  STANDARD: 'standard',
  /** Enhanced security with additional protections */
  ENHANCED: 'enhanced',
  /** Maximum security with comprehensive protections (resource intensive) */
  MAXIMUM: 'maximum'
});

/**
 * Module format identifiers for dynamic loading
 * Used by the module system to determine which version of a module to load.
 * 
 * @enum {string}
 * @readonly
 */
export const MODULE_FORMATS = Object.freeze({
  /** ECMAScript Modules format */
  ESM: 'esm',
  /** CommonJS format */
  CJS: 'cjs',
  /** Dual format supporting both ESM and CJS */
  DUAL: 'dual'
});

/**
 * Error severity levels for the error handling system
 * Used to categorize errors by their impact and required response.
 * 
 * @enum {string}
 * @readonly
 */
export const ErrorSeverity = Object.freeze({
  /** Informational message, not an error */
  INFO: 'info',
  /** Warning that doesn't prevent operation but should be addressed */
  WARNING: 'warning',
  /** Error that prevents current operation but allows system to continue */
  ERROR: 'error',
  /** Critical error that may compromise system integrity */
  CRITICAL: 'critical',
  /** Fatal error that requires immediate attention and system shutdown */
  FATAL: 'fatal'
});

/**
 * Error codes for different types of errors in the ZK system
 * Each code represents a specific error condition and helps with
 * error tracking, analysis, and recovery.
 * 
 * @enum {number}
 * @readonly
 */
export const ErrorCode = Object.freeze({
  // System errors (1000-1999)
  /** Unknown system error */
  SYSTEM_UNKNOWN_ERROR: 1000,
  /** System feature not supported */
  SYSTEM_FEATURE_UNSUPPORTED: 1001,
  /** System resource unavailable */
  SYSTEM_RESOURCE_UNAVAILABLE: 1002,
  
  // Input validation errors (2000-2999)
  /** Required input parameter missing */
  INPUT_MISSING_REQUIRED: 2000,
  /** Input parameter has invalid type */
  INPUT_TYPE_ERROR: 2001,
  /** Input parameter validation failed */
  INPUT_VALIDATION_FAILED: 2002,
  /** Input parameter out of allowed range */
  INPUT_OUT_OF_RANGE: 2003,
  
  // Proof generation errors (3000-3999)
  /** Generic proof generation failure */
  PROOF_GENERATION_FAILED: 3000,
  /** Circuit constraints not satisfied */
  PROOF_CONSTRAINT_VIOLATION: 3001,
  /** Proof input processing failed */
  PROOF_INPUT_PROCESSING_FAILED: 3002,
  
  // Verification errors (4000-4999)
  /** Proof verification failed */
  VERIFICATION_FAILED: 4000,
  /** Proof format invalid */
  VERIFICATION_INVALID_FORMAT: 4001,
  /** Verification key missing or invalid */
  VERIFICATION_KEY_INVALID: 4002,
  
  // Serialization errors (5000-5999)
  /** Proof serialization error */
  PROOF_SERIALIZATION_ERROR: 5000,
  /** Proof deserialization error */
  PROOF_DESERIALIZATION_ERROR: 5001,
  
  // Network errors (6000-6999)
  /** Network request failed */
  NETWORK_REQUEST_FAILED: 6000,
  /** Network response invalid */
  NETWORK_RESPONSE_INVALID: 6001,
  /** Network timeout */
  NETWORK_TIMEOUT: 6002,
  
  // Security errors (7000-7999)
  /** Tamper detection triggered */
  SECURITY_TAMPER_DETECTED: 7000,
  /** Unauthorized access attempt */
  SECURITY_UNAUTHORIZED: 7001,
  /** Security configuration error */
  SECURITY_CONFIG_ERROR: 7002,
  
  // Compatibility errors (9000-9999)
  /** Browser compatibility error */
  COMPATIBILITY_BROWSER_UNSUPPORTED: 9000,
  /** Device capability insufficient */
  COMPATIBILITY_DEVICE_UNSUPPORTED: 9001
});

/**
 * Operation modes for ZK proof generation and verification
 * Different modes have different performance and security characteristics.
 * 
 * @enum {string}
 * @readonly
 */
export const OPERATION_MODES = Object.freeze({
  /** Client-side only operation (most private) */
  CLIENT: 'client',
  /** Server-side only operation (most reliable) */
  SERVER: 'server',
  /** Hybrid operation with client-side priority */
  HYBRID_CLIENT: 'hybrid-client',
  /** Hybrid operation with server-side priority */
  HYBRID_SERVER: 'hybrid-server'
});

/**
 * Default export providing all constants in a single object
 * Provided for backward compatibility with code that may have used
 * CommonJS require() syntax.
 * 
 * @type {Object}
 */
export default {
  ZK_PROOF_TYPES,
  PROOF_TYPE_NAMES,
  SECURITY_LEVELS,
  MODULE_FORMATS,
  ErrorSeverity,
  ErrorCode,
  OPERATION_MODES
};