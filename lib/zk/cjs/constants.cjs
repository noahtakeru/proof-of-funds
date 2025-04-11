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

// Detect environment - true if ESM environment
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
try {
  if (isEsm) {
    // ESM environment - use .mjs extension for ESM build
    console.debug(`[Constants] Loading ESM module (operationId: ${operationId})`);
    
    // Dynamic import for ESM
    import('./constants.mjs').then(module => {
      constantsModule = module;
      console.debug(`[Constants] Successfully loaded ESM module (operationId: ${operationId})`);
    }).catch(error => {
      logError(error, { context: 'ESM import', operationId });
    });
  } else {
    // CommonJS environment - use .cjs extension for CommonJS build
    console.debug(`[Constants] Loading CommonJS module (operationId: ${operationId})`);
    constantsModule = require('./constants.cjs');
    console.debug(`[Constants] Successfully loaded CommonJS module (operationId: ${operationId})`);
  }
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

/**
 * Get a property from the appropriate module
 * @param {string} prop - The property name to get
 * @returns {any} The property value
 * @throws {Error} If the property doesn't exist
 */
function getProp(prop) {
  if (!constantsModule) {
    throw new ConstantsModuleError('Constants module not loaded yet', {
      code: 'MODULE_NOT_LOADED',
      severity: 'ERROR',
      recoverable: true,
      operationId,
      details: {
        property: prop,
        environment: isEsm ? 'ESM' : 'CommonJS'
      }
    });
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

// Create proxy to dynamically access properties from the loaded module
const proxy = new Proxy({}, {
  get: (target, prop) => {
    // Handle toString method
    if (prop === Symbol.toStringTag) {
      return 'Module';
    }
    
    // For ESM environment, return a promise if the module is loading
    if (isEsm && !constantsModule) {
      return Promise.resolve().then(() => {
        if (!constantsModule) {
          throw new ConstantsModuleError('Constants module not loaded', {
            code: 'MODULE_NOT_LOADED_ASYNC',
            severity: 'ERROR',
            recoverable: true,
            operationId,
            details: {
              property: prop,
              environment: 'ESM',
              asyncAccess: true
            }
          });
        }
        return constantsModule[prop];
      });
    }
    
    // For synchronous CommonJS environment or loaded ESM module
    return getProp(prop);
  }
});

// Export the proxy as default export
export default proxy;