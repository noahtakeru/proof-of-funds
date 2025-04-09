/**
 * Constants for Zero-Knowledge Module (CommonJS Version)
 * 
 * This file provides local constants for the ZK module to ensure
 * consistent values across components when the global constants
 * might not be accessible.
 */

// ZK Proof types supported by the application
const ZK_PROOF_TYPES = {
  STANDARD: 'standard',  // Exact amount proof
  THRESHOLD: 'threshold', // At-least amount proof
  MAXIMUM: 'maximum',   // At-most amount proof
  BATCH: 'batch'       // Multiple proofs combined
};

// Mapping of proof types to human-readable names
const PROOF_TYPE_NAMES = {
  standard: 'Standard Proof (Exact Amount)',
  threshold: 'Threshold Proof (Minimum Amount)',
  maximum: 'Maximum Proof (Maximum Amount)',
  batch: 'Batch Proof (Multiple Proofs)'
};

// Security levels for input generation
const SECURITY_LEVELS = {
  STANDARD: 'standard',     // Basic security
  ENHANCED: 'enhanced',     // Additional protections
  MAXIMUM: 'maximum'        // Maximum security, more resource intensive
};

// Default module format
const MODULE_FORMATS = {
  ESM: 'esm',
  CJS: 'cjs',
  DUAL: 'dual'
};

// CommonJS exports
module.exports = {
  ZK_PROOF_TYPES,
  PROOF_TYPE_NAMES,
  SECURITY_LEVELS,
  MODULE_FORMATS
};