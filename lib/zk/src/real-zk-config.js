/**
 * Configuration for real ZK implementation
 * This file provides the correct paths for the real ZK implementation
 * 
 * @module real-zk-config
 */

// This is a modern JavaScript (ESM) re-exporter that dynamically loads 
// the appropriate module format based on the environment.

// Check if we're in an ESM environment
const isEsm = typeof import.meta === 'object';

// Internal logging function - will be replaced with proper logger once loaded
let logError = (message, error, context = {}) => {
  console.error(`[real-zk-config] ${message}`, error);
};

// Attempt to load the proper logger asynchronously
if (isEsm) {
  import('./zkErrorLogger.mjs').then(logger => {
    // Use the imported logger
    const zkErrorLogger = logger.default || logger.zkErrorLogger;
    logError = (message, error, context = {}) => {
      zkErrorLogger.logError(error, {
        context: 'real-zk-config',
        ...context,
        details: {
          message,
          ...(context.details || {})
        }
      });
    };
  }).catch(err => {
    console.error('[real-zk-config] Error loading error logger:', err);
  });
} else {
  try {
    const logger = require('./cjs/zkErrorLogger.cjs');
    // Use the required logger
    const zkErrorLogger = logger.zkErrorLogger;
    logError = (message, error, context = {}) => {
      zkErrorLogger.logError(error, {
        context: 'real-zk-config',
        ...context,
        details: {
          message,
          ...(context.details || {})
        }
      });
    };
  } catch (err) {
    console.error('[real-zk-config] Error loading error logger:', err);
  }
}

// Storage for configuration values
let configExports = null;

// Lazy-load the config
if (isEsm) {
  // ESM environment - use dynamic import
  import('../config/real-zk-config.mjs').then(mod => {
    configExports = mod;
  }).catch(err => {
    logError('Error loading ESM config', err, { 
      operationId: `load_config_${Date.now()}`,
      details: { configType: 'ESM', path: '../config/real-zk-config.mjs' }
    });
  });
} else {
  // CommonJS environment
  try {
    configExports = require('./cjs/real-zk-config.cjs');
  } catch (err) {
    logError('Error loading CommonJS config', err, { 
      operationId: `load_config_${Date.now()}`,
      details: { configType: 'CommonJS', path: './cjs/real-zk-config.cjs' }
    });
  }
}

/**
 * Circuit paths configurations for wasm, zkey, and verification key files
 * @type {Object}
 */
export const circuitPaths = {
  /**
   * Base path for all ZK build artifacts
   * @type {string}
   */
  basePath: 'lib/zk/build',

  /**
   * Path to WebAssembly files
   * @param {string} circuitName - Name of the circuit
   * @returns {string} Path to the WASM file
   */
  wasmPath: (circuitName) => `lib/zk/build/${circuitName}_js/${circuitName}.wasm`,

  /**
   * Path to zkey files
   * @param {string} circuitName - Name of the circuit
   * @returns {string} Path to the zkey file
   */
  zkeyPath: (circuitName) => `lib/zk/build/zkey/${circuitName}.zkey`,

  /**
   * Path to verification key files
   * @param {string} circuitName - Name of the circuit
   * @returns {string} Path to the verification key file
   */
  vkeyPath: (circuitName) => `lib/zk/build/verification_key/${circuitName}.json`,
};

/**
 * Circuit names for different proof types
 * @type {Object}
 */
export const circuitNames = {
  /** Standard proof circuit name */
  standard: 'standardProof',
  /** Threshold proof circuit name */
  threshold: 'thresholdProof',
  /** Maximum proof circuit name */
  maximum: 'maximumProof'
};

/**
 * Proof types mapping from type ID to circuit name
 * @type {Object}
 */
export const proofTypes = {
  /** Standard proof type (ID: 0) */
  0: 'standardProof',
  /** Threshold proof type (ID: 1) */
  1: 'thresholdProof',
  /** Maximum proof type (ID: 2) */
  2: 'maximumProof'
};

/**
 * Default export containing all configuration
 * @type {Object}
 */
export default {
  circuitPaths,
  circuitNames,
  proofTypes
};