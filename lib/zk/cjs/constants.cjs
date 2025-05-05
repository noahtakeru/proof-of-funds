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

// Detect environment
const isEsm = typeof import.meta === 'object';

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

// Storage for imported module
let constantsModule;

// Dynamically load the appropriate version
async function loadConstantsModule() {
  try {
    if (isEsm) {
      // ESM environment - use .mjs extension for ESM build
      console.debug(`[Constants] Loading ESM module (operationId: ${operationId})`);
      constantsModule = await import('./constants.mjs');
      console.debug(`[Constants] Successfully loaded ESM module (operationId: ${operationId})`);
    } else {
      // CommonJS environment - use .cjs extension for CommonJS build
      console.debug(`[Constants] Loading CommonJS module (operationId: ${operationId})`);
      // This should never be executed in an ESM context
      throw new ConstantsModuleError('CommonJS imports not supported in ESM contexts', {
        code: 'MODULE_SYSTEM_MISMATCH',
        severity: 'ERROR',
        recoverable: false,
        operationId,
        details: { environment: 'ESM' }
      });
    }
    return constantsModule;
  } catch (error) {
    const moduleError = logError(error, { context: 'module loading', operationId });
    throw new ConstantsModuleError(`Failed to load constants module: ${error.message}`, {
      code: 'MODULE_LOAD_FAILED',
      severity: 'ERROR',
      recoverable: false,
      operationId,
      details: {
        environment: isEsm ? 'ESM' : 'CommonJS',
        originalError: error
      }
    });
  }
}

/**
 * Get a property from the appropriate module
 * @param {string} prop - The property name to get
 * @returns {Promise<any>} The property value
 * @throws {Error} If the property doesn't exist
 */
async function getProp(prop) {
  if (!constantsModule) {
    await loadConstantsModule();
  }

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

// Initialize module loading
const moduleLoadingPromise = loadConstantsModule();

// Export default object with lazy loading
export default {
  /**
   * Types of zero-knowledge proofs supported by the system
   * @type {Promise<Object>}
   */
  get ZK_PROOF_TYPES() { return getProp('ZK_PROOF_TYPES'); },

  /**
   * Error codes used throughout the ZK system
   * @type {Promise<Object>}
   */
  get ERROR_CODES() { return getProp('ERROR_CODES'); },

  /**
   * Types of circuits supported by the ZK system
   * @type {Promise<Object>}
   */
  get CIRCUIT_TYPES() { return getProp('CIRCUIT_TYPES'); },

  /**
   * Verification modes for ZK proofs
   * @type {Promise<Object>}
   */
  get VERIFICATION_MODES() { return getProp('VERIFICATION_MODES'); },

  /**
   * Security levels for ZK operations
   * @type {Promise<Object>}
   */
  get SECURITY_LEVELS() { return getProp('SECURITY_LEVELS'); },
  // Add other constants as needed
};

// Also export individual constants for selective imports
/**
 * Types of zero-knowledge proofs supported by the system
 * @type {Promise<Object>}
 */
export const ZK_PROOF_TYPES = getProp('ZK_PROOF_TYPES');

/**
 * Error codes used throughout the ZK system
 * @type {Promise<Object>}
 */
export const ERROR_CODES = getProp('ERROR_CODES');

/**
 * Types of circuits supported by the ZK system
 * @type {Promise<Object>}
 */
export const CIRCUIT_TYPES = getProp('CIRCUIT_TYPES');

/**
 * Verification modes for ZK proofs
 * @type {Promise<Object>}
 */
export const VERIFICATION_MODES = getProp('VERIFICATION_MODES');

/**
 * Security levels for ZK operations
 * @type {Promise<Object>}
 */
export const SECURITY_LEVELS = getProp('SECURITY_LEVELS');

// Export error classes for error handling
export { ConstantsModuleError };