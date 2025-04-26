/**
 * Constants for Zero-Knowledge Module (Re-Exporter)
 * 
 * This file serves as a flexible entry point that dynamically detects the module
 * system environment and loads the appropriate module format (ESM or CommonJS).
 * It uses the environment detection pattern recommended in the module standardization
 * plan to ensure proper operation in both Node.js and browser environments.
 *  
 * @module constants
 */

// Detect environment - CommonJS-safe way to check module type
const isEsm = false; // This is a .cjs file so it's always CommonJS

/**
 * Custom error class for constants module errors
 * @class ConstantsModuleError
 * @extends Error
 */
class ConstantsModuleError extends Error {
  /**
   * Create a new ConstantsModuleError
   * @param {string} message - Error message 
   * @param {Object} options - Error options
   * @param {string} [options.code='CONSTANTS_ERROR'] - Error code
   * @param {string} [options.severity='ERROR'] - Error severity
   * @param {boolean} [options.recoverable=true] - Whether error is recoverable
   * @param {string} [options.operationId] - Operation ID for tracking
   * @param {Object} [options.details={}] - Additional error details
   * @param {Error} [options.originalError] - Original error that caused this
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'ConstantsModuleError';
    this.code = options.code || 'CONSTANTS_ERROR';
    this.severity = options.severity || 'ERROR';
    this.recoverable = options.recoverable !== undefined ? options.recoverable : true;
    this.operationId = options.operationId || `constants_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.details = {
      ...(options.details || {}),
      component: 'ConstantsModule',
      timestamp: new Date().toISOString()
    };

    if (options.originalError) {
      this.originalError = options.originalError;
      this.originalStack = options.originalError.stack;
    }

    // Capture current stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConstantsModuleError);
    }
  }
}

// Define a logError function for bootstrapping errors
function logError(error, context = {}) {
  // Convert to ConstantsModuleError if not already
  if (!(error instanceof ConstantsModuleError)) {
    error = new ConstantsModuleError(error.message, {
      details: { originalError: error.message },
      operationId: context.operationId
    });
  }

  console.error(`[Constants Module] ${error.message}`, {
    ...context,
    errorName: error.name,
    errorCode: error.code,
    severity: error.severity,
    isEsm,
    timestamp: new Date().toISOString()
  });

  return error;
}

// Generate a unique operation ID for tracking errors
const operationId = `constants_load_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

// Define concrete constants directly instead of trying to import

/**
 * Types of zero-knowledge proofs supported by the system
 * @type {Object}
 */
const ZK_PROOF_TYPES = {
  STANDARD: 'standard',
  THRESHOLD: 'threshold',
  MAXIMUM: 'maximum'
};

/**
 * Error codes used throughout the ZK system
 * @type {Object}
 */
const ERROR_CODES = {
  INVALID_INPUT: 'INVALID_INPUT',
  PROOF_GENERATION_FAILED: 'PROOF_GENERATION_FAILED',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  INSUFFICIENT_RESOURCES: 'INSUFFICIENT_RESOURCES',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SECURITY_ERROR: 'SECURITY_ERROR',
  COMPATIBILITY_ERROR: 'COMPATIBILITY_ERROR'
};

/**
 * Types of circuits supported by the ZK system
 * @type {Object}
 */
const CIRCUIT_TYPES = {
  STANDARD_PROOF: 'standard-proof',
  THRESHOLD_PROOF: 'threshold-proof',
  MAXIMUM_PROOF: 'maximum-proof'
};

/**
 * Verification modes for ZK proofs
 * @type {Object}
 */
const VERIFICATION_MODES = {
  LOCAL: 'local',
  REMOTE: 'remote',
  HYBRID: 'hybrid'
};

/**
 * Security levels for ZK operations
 * @type {Object}
 */
const SECURITY_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

// Storage for constants module
const constantsModule = {
  ZK_PROOF_TYPES,
  ERROR_CODES,
  CIRCUIT_TYPES,
  VERIFICATION_MODES,
  SECURITY_LEVELS,
  ConstantsModuleError
};

/**
 * Get a property from the constants module
 * @param {string} prop - The property name to get
 * @returns {any} The property value
 * @throws {Error} If the property doesn't exist
 */
function getProp(prop) {
  if (!(prop in constantsModule)) {
    throw new ConstantsModuleError(`Property '${prop}' not found in constants module`, {
      code: 'PROPERTY_NOT_FOUND',
      severity: 'ERROR',
      recoverable: false,
      operationId,
      details: {
        property: prop,
        availableProperties: Object.keys(constantsModule)
      }
    });
  }

  return constantsModule[prop];
}

// Create module exports object with synchronous getters
const moduleExports = {
  /**
   * Types of zero-knowledge proofs supported by the system
   * @type {Object}
   */
  get ZK_PROOF_TYPES() { return constantsModule.ZK_PROOF_TYPES; },

  /**
   * Error codes used throughout the ZK system
   * @type {Object}
   */
  get ERROR_CODES() { return constantsModule.ERROR_CODES; },

  /**
   * Types of circuits supported by the ZK system
   * @type {Object}
   */
  get CIRCUIT_TYPES() { return constantsModule.CIRCUIT_TYPES; },

  /**
   * Verification modes for ZK proofs
   * @type {Object}
   */
  get VERIFICATION_MODES() { return constantsModule.VERIFICATION_MODES; },

  /**
   * Security levels for ZK operations
   * @type {Object}
   */
  get SECURITY_LEVELS() { return constantsModule.SECURITY_LEVELS; },
  
  // Error classes for error handling
  ConstantsModuleError,
  
  // Add other constants as needed
};

// Also add individual constants for selective imports
Object.defineProperties(moduleExports, {
  /**
   * Types of zero-knowledge proofs supported by the system
   * @type {Object}
   */
  ZK_PROOF_TYPES: { 
    get: function() { return constantsModule.ZK_PROOF_TYPES; }, 
    enumerable: true 
  },

  /**
   * Error codes used throughout the ZK system
   * @type {Object}
   */
  ERROR_CODES: {
    get: function() { return constantsModule.ERROR_CODES; },
    enumerable: true
  },

  /**
   * Types of circuits supported by the ZK system
   * @type {Object}
   */
  CIRCUIT_TYPES: {
    get: function() { return constantsModule.CIRCUIT_TYPES; },
    enumerable: true
  },

  /**
   * Verification modes for ZK proofs
   * @type {Object}
   */
  VERIFICATION_MODES: {
    get: function() { return constantsModule.VERIFICATION_MODES; },
    enumerable: true
  },

  /**
   * Security levels for ZK operations
   * @type {Object}
   */
  SECURITY_LEVELS: {
    get: function() { return constantsModule.SECURITY_LEVELS; },
    enumerable: true
  }
});

// Export using CommonJS module.exports
module.exports = moduleExports;