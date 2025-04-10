/**
 * Constants for Zero-Knowledge Module (ESM Version)
 * 
 * This file provides local constants for the ZK module to ensure
 * consistent values across components when the global constants
 * might not be accessible.
 * 
 * @module constants
 */

/**
 * ZK Proof types supported by the application
 * @enum {string}
 */
export const ZK_PROOF_TYPES = {
  /** Exact amount proof */
  STANDARD: 'standard',
  /** At-least amount proof */
  THRESHOLD: 'threshold',
  /** At-most amount proof */
  MAXIMUM: 'maximum',
  /** Multiple proofs combined */
  BATCH: 'batch'
};

/**
 * Mapping of proof types to human-readable names
 * @type {Object<string, string>}
 */
export const PROOF_TYPE_NAMES = {
  standard: 'Standard Proof (Exact Amount)',
  threshold: 'Threshold Proof (Minimum Amount)',
  maximum: 'Maximum Proof (Maximum Amount)',
  batch: 'Batch Proof (Multiple Proofs)'
};

/**
 * Security levels for input generation
 * @enum {string}
 */
export const SECURITY_LEVELS = {
  /** Basic security */
  STANDARD: 'standard',
  /** Additional protections */
  ENHANCED: 'enhanced',
  /** Maximum security, more resource intensive */
  MAXIMUM: 'maximum'
};

/**
 * Supported module formats
 * @enum {string}
 */
export const MODULE_FORMATS = {
  /** ECMAScript modules */
  ESM: 'esm',
  /** CommonJS modules */
  CJS: 'cjs',
  /** Dual format supporting both ESM and CJS */
  DUAL: 'dual'
};

// Default export for backward compatibility
export default {
  ZK_PROOF_TYPES,
  PROOF_TYPE_NAMES,
  SECURITY_LEVELS,
  MODULE_FORMATS
};