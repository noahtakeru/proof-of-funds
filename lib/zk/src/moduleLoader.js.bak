/**
 * Module Loader Helper for ESM and CommonJS compatibility
 * 
 * This module provides helper functions to dynamically load modules
 * in both ESM and CommonJS environments, providing a consistent API
 * regardless of the module format.
 * 
 * Key features:
 * - Environment detection (ESM vs CommonJS)
 * - Unified module loading interface
 * - Error handling with proper logging
 * - Dynamic imports with fallbacks
 * 
 * ---------- NON-TECHNICAL EXPLANATION ----------
 * This file works like a universal adapter for software components.
 * Different parts of our system might be written in different formats (ESM and CommonJS),
 * and this module helps load them correctly regardless of the environment they're running in.
 * Think of it as a translator that ensures all the pieces can communicate with each other.
 * 
 * NOTE: This is a re-exporter file that dynamically loads either the ESM or CJS version
 * based on the environment.
 * 
 * @module moduleLoader
 */

// Dynamic import/require strategy for ESM/CJS compatibility
let moduleLoader;
let errorLogger;
let errorHandler;

// Check if ESM environment (based on import.meta presence)
const isEsm = typeof import.meta === 'object';

/**
 * Custom error class for module loading failures
 * Used when module loading system encounters an error
 * 
 * @class ModuleLoaderError
 * @extends Error
 */
class ModuleLoaderError extends Error {
  /**
   * Create a new ModuleLoaderError
   * 
   * @param {string} message - Error message
   * @param {Object} details - Additional error details
   * @param {Error} [originalError] - Original error that caused this error
   */
  constructor(message, details = {}, originalError = null) {
    super(message);
    this.name = 'ModuleLoaderError';
    this.details = details;
    this.originalError = originalError;
    this.timestamp = new Date();
    
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

/**
 * Load error handling modules
 * 
 * @private
 * @async
 * @function loadErrorModules
 * @returns {Promise<void>} Promise that resolves when the error modules are loaded
 */
async function loadErrorModules() {
  try {
    if (isEsm) {
      // ESM environment - dynamically import the .mjs versions
      const [loggerMod, handlerMod] = await Promise.all([
        import('./zkErrorLogger.mjs'),
        import('./zkErrorHandler.mjs')
      ]);
      
      errorLogger = loggerMod.default.zkErrorLogger;
      errorHandler = handlerMod;
    } else {
      // CommonJS environment - use require for the CJS versions
      const errorLoggerMod = require('./cjs/zkErrorLogger.cjs');
      errorHandler = require('./cjs/zkErrorHandler.cjs');
      errorLogger = errorLoggerMod.zkErrorLogger;
    }
  } catch (err) {
    // Basic error logging for bootstrap error (can't use the error system yet)
    console.error(`Failed to load error handling modules: ${err.message}`, {
      originalError: err.message,
      environment: isEsm ? 'ESM' : 'CommonJS',
      context: 'moduleLoader.js.loadErrorModules'
    });
  }
}

// Initialize error modules immediately
const errorModulesPromise = loadErrorModules();

/**
 * Log an error through the error logging system if available
 * 
 * @async
 * @function logError
 * @param {Error} error - The error to log
 * @param {Object} additionalData - Additional contextual data
 * @returns {Promise<void>} Promise that resolves when logging is complete
 */
async function logError(error, additionalData = {}) {
  try {
    await errorModulesPromise;
    
    // Ensure we have the error logger
    if (!errorLogger) {
      console.error('Error logger not available', {
        error: error.message,
        context: 'moduleLoader.js.logError'
      });
      return;
    }
    
    // Convert to system error if needed
    let errorToLog = error;
    if (errorHandler && !errorHandler.isZKError(error)) {
      errorToLog = new errorHandler.SystemError(
        `Module loading error: ${error.message}`,
        {
          code: errorHandler.ErrorCode.SYSTEM_NOT_INITIALIZED,
          severity: errorHandler.ErrorSeverity.ERROR,
          recoverable: false,
          details: { 
            originalError: error.message,
            ...additionalData 
          }
        }
      );
    }
    
    // Log through the error logging system
    errorLogger.logError(errorToLog, {
      context: 'moduleLoader.js',
      ...additionalData
    });
  } catch (loggingError) {
    // Fallback if error logging fails
    console.error('Error logging failed', {
      originalError: error.message,
      loggingError: loggingError.message,
      context: 'moduleLoader.js.logError'
    });
  }
}

/**
 * Dynamically load a module in either ESM or CommonJS format
 * 
 * @async
 * @function loadModule
 * @param {string} esmPath - Path to the ESM module (e.g. "./myModule.mjs")
 * @param {string} cjsPath - Path to the CommonJS module (e.g. "./cjs/myModule.cjs")
 * @param {Object} [options] - Additional options for loading
 * @param {boolean} [options.required=true] - Whether the module is required (throws if not found)
 * @param {Object} [options.fallback] - Fallback module to return if loading fails
 * @returns {Promise<Object>} The loaded module
 * @throws {ModuleLoaderError} When module loading fails and no fallback is provided
 * 
 * @example
 * // Load a module based on environment
 * const utils = await loadModule('./utils.mjs', './cjs/utils.cjs');
 * 
 * // Load with fallback
 * const config = await loadModule('./config.mjs', './cjs/config.cjs', {
 *   required: false,
 *   fallback: { defaultSetting: true }
 * });
 */
export async function loadModule(esmPath, cjsPath, options = {}) {
  const { required = true, fallback = null } = options;
  const operationId = `loadModule_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  try {
    if (isEsm) {
      try {
        const module = await import(esmPath);
        return module.default || module;
      } catch (error) {
        await logError(error, {
          context: 'moduleLoader.loadModule.esm',
          operationId,
          modulePath: esmPath
        });
        
        if (required && !fallback) {
          throw new ModuleLoaderError(
            `Failed to load ESM module ${esmPath}: ${error.message}`,
            { modulePath: esmPath, environment: 'ESM' },
            error
          );
        }
        
        return fallback;
      }
    } else {
      try {
        // CommonJS environment
        return require(cjsPath);
      } catch (error) {
        await logError(error, {
          context: 'moduleLoader.loadModule.cjs',
          operationId,
          modulePath: cjsPath
        });
        
        if (required && !fallback) {
          throw new ModuleLoaderError(
            `Failed to load CommonJS module ${cjsPath}: ${error.message}`,
            { modulePath: cjsPath, environment: 'CommonJS' },
            error
          );
        }
        
        return fallback;
      }
    }
  } catch (error) {
    // Handle any other errors that might occur
    await logError(error, {
      context: 'moduleLoader.loadModule',
      operationId,
      modulePaths: { esm: esmPath, cjs: cjsPath }
    });
    
    throw error;
  }
}

/**
 * Check if the current environment is CommonJS
 * 
 * @type {boolean}
 */
export const isCommonJS = !isEsm;

/**
 * Default export with all module functions
 */
export default {
  loadModule,
  isCommonJS
};