/**
 * ZK Error Logging and Aggregation System (Re-Exporter)
 * 
 * This module serves as a flexible entry point that dynamically detects the module
 * system environment and loads the appropriate module format (ESM or CommonJS).
 * It uses the environment detection pattern recommended in the module standardization
 * plan to ensure proper operation in both Node.js and browser environments.
 * 
 * Key features:
 * - Privacy-preserving error reporting (no sensitive data)
 * - Structured log format for machine processing
 * - Error frequency tracking and pattern analysis
 * - Configurable logging destinations
 * - Integration with error handling framework
 * 
 * @module zkErrorLogger
 */

// Check if ESM environment (based on import.meta presence)
const isEsm = typeof import.meta === 'object';

/**
 * Custom error class for module loading failures
 * Used when error logging system itself encounters an error
 * 
 * @class LoggerModuleError
 * @extends Error
 */
class LoggerModuleError extends Error {
  /**
   * Create a new LoggerModuleError
   * 
   * @param {string} message - Error message
   * @param {Object} details - Additional error details
   * @param {Error} [originalError] - Original error that caused this error
   */
  constructor(message, details = {}, originalError = null) {
    super(message);
    this.name = 'LoggerModuleError';
    this.details = details;
    this.originalError = originalError;
    this.timestamp = new Date();
    this.operationId = details.operationId || `logger_load_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
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
    let result = `${this.name}: ${this.message}`;
    if (this.details && Object.keys(this.details).length > 0) {
      result += `\nDetails: ${JSON.stringify(this.details, null, 2)}`;
    }
    if (this.originalError) {
      result += `\nOriginal error: ${this.originalError.message}`;
    }
    return result;
  }
}

// Storage for imported modules
let loggerModule;

/**
 * Log a basic error during bootstrapping
 * 
 * @private
 * @function logBasicError
 * @param {Error} error - The error to log
 * @param {Object} context - Additional context
 */
function logBasicError(error, context = {}) {
  console.error(`[zkErrorLogger] ${error.message}`, {
    ...context,
    errorName: error.name,
    isEsm,
    operationId: context.operationId || error.operationId || `basic_log_${Date.now()}`,
    timestamp: new Date().toISOString()
  });
}

/**
 * Load the appropriate module format based on the environment
 * 
 * @private
 * @async
 * @function loadModule
 * @returns {Promise<void>} Promise that resolves when the module is loaded
 * @throws {LoggerModuleError} When module loading fails
 */
async function loadModule() {
  const operationId = `zkErrorLogger_load_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  try {
    console.debug(`[zkErrorLogger] Loading module in ${isEsm ? 'ESM' : 'CommonJS'} environment (operationId: ${operationId})`);
    
    if (isEsm) {
      // ESM environment - dynamically import the .mjs version
      loggerModule = await import('./zkErrorLogger.mjs');
      console.debug(`[zkErrorLogger] Successfully loaded ESM module (operationId: ${operationId})`);
    } else {
      // CommonJS environment - use require for the CJS version
      loggerModule = require('./cjs/zkErrorLogger.cjs');
      console.debug(`[zkErrorLogger] Successfully loaded CommonJS module (operationId: ${operationId})`);
    }
  } catch (err) {
    // Basic error logging for bootstrap error
    logBasicError(err, {
      originalError: err.message,
      environment: isEsm ? 'ESM' : 'CommonJS',
      context: 'zkErrorLogger.loadModule',
      operationId
    });
    
    // Throw specialized error with context
    throw new LoggerModuleError(
      `Error logger module initialization failed: ${err.message}`,
      {
        environment: isEsm ? 'ESM' : 'CommonJS',
        moduleType: 'error logger',
        operationId,
        attemptedPaths: isEsm ? 
          ['./zkErrorLogger.mjs'] : 
          ['./cjs/zkErrorLogger.cjs']
      },
      err
    );
  }
}

/**
 * Promise for module loading, initialized immediately
 * @type {Promise<void>}
 */
const modulePromise = loadModule();

/**
 * Lazy-loaded module property getter
 * Ensures the module is loaded before returning any properties
 * 
 * @async
 * @function getModuleProp
 * @param {string} prop - The property to get
 * @returns {Promise<any>} The requested property from the module
 * @throws {LoggerModuleError} When module loading fails
 */
async function getModuleProp(prop) {
  const operationId = `get_logger_prop_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  try {
    await modulePromise;
    
    if (!loggerModule) {
      throw new LoggerModuleError(
        'Error logger module not loaded yet',
        {
          propertyName: prop,
          environment: isEsm ? 'ESM' : 'CommonJS',
          operationId
        }
      );
    }
    
    if (!(prop in loggerModule)) {
      throw new LoggerModuleError(
        `Property '${prop}' not found in error logger module`,
        {
          propertyName: prop,
          availableProperties: Object.keys(loggerModule),
          operationId
        }
      );
    }
    
    return loggerModule[prop];
  } catch (err) {
    // Handle errors that might occur during module loading
    const moduleError = new LoggerModuleError(
      `Failed to get error logger property '${prop}': ${err.message}`,
      { 
        propertyName: prop,
        environment: isEsm ? 'ESM' : 'CommonJS',
        operationId
      },
      err
    );
    
    logBasicError(moduleError, { context: 'getModuleProp', operationId });
    throw moduleError;
  }
}

/**
 * Default export - dynamic module proxy to the error logger singleton
 * 
 * @type {Proxy}
 */
export default new Proxy({}, {
  get: (target, prop) => {
    // Special case for Symbol.toStringTag to avoid errors
    if (prop === Symbol.toStringTag) {
      return 'Module';
    }
    
    // For special property zkErrorLogger, return the actual logger object
    if (prop === 'zkErrorLogger') {
      return {
        logError: async (error, context = {}) => {
          try {
            await modulePromise;
            if (loggerModule && loggerModule.zkErrorLogger) {
              return loggerModule.zkErrorLogger.logError(error, context);
            } else {
              logBasicError(error, { 
                context: 'zkErrorLogger.logError',
                ...context
              });
            }
          } catch (loggingError) {
            logBasicError(error, { 
              context: 'zkErrorLogger.logError',
              originalError: loggingError
            });
          }
        },
        
        log: async (level, message, data = {}) => {
          try {
            await modulePromise;
            if (loggerModule && loggerModule.zkErrorLogger) {
              return loggerModule.zkErrorLogger.log(level, message, data);
            } else {
              logBasicError(new Error(message), {
                logLevel: level,
                context: 'zkErrorLogger.log',
                ...data
              });
            }
          } catch (loggingError) {
            logBasicError(new Error(message), { 
              logLevel: level,
              context: 'zkErrorLogger.log',
              originalError: loggingError
            });
          }
        }
      };
    }
    
    // For other properties, return function that loads module first
    return (...args) => {
      return getModuleProp(prop).then(value => {
        return typeof value === 'function' ? value(...args) : value;
      });
    };
  }
});

/**
 * ZK Error Logger class for creating logger instances
 * @type {Promise<Function>}
 */
export const ZKErrorLogger = getModuleProp('ZKErrorLogger');

/**
 * Log level constants for controlling log verbosity
 * @type {Promise<Object>}
 */
export const LogLevel = getModuleProp('LogLevel');

/**
 * Privacy level constants for controlling data redaction in logs
 * @type {Promise<Object>}
 */
export const PrivacyLevel = getModuleProp('PrivacyLevel');

/**
 * Error telemetry utilities for analyzing error patterns
 * @type {Promise<Object>}
 */
export const errorTelemetry = getModuleProp('errorTelemetry');