/**
 * Browser Compatibility Module - Re-exporter
 * 
 * This module provides advanced browser compatibility detection and scoring for running
 * zero-knowledge proofs in browser environments. It dynamically loads the appropriate
 * module format (ESM or CommonJS) based on the runtime environment.
 * 
 * Key features:
 * - Feature detection for WebAssembly, SharedArrayBuffer, WebCrypto, etc.
 * - Browser version compatibility checking
 * - Device capability analysis
 * - Fallback strategies for different environments
 * 
 * ---------- NON-TECHNICAL EXPLANATION ----------
 * This file acts like a browser detective. It checks if your web browser has all the
 * special features needed to run our privacy-preserving proof system. Different browsers
 * support different technologies, and this code figures out what your browser can do and
 * recommends the best approach based on its capabilities.
 * 
 * NOTE: This is a re-exporter file that dynamically loads either the ESM or CJS version
 * based on the environment.
 * 
 * @module browserCompatibility
 */

// Dynamic import/require strategy for ESM/CJS compatibility
let compatibilityModule;
let errorLogger;
let errorHandler;

// Check if ESM environment (based on import.meta presence)
const isEsm = typeof import.meta === 'object';

/**
 * Custom error class for browser compatibility issues
 * Used when browser compatibility module encounters an error
 * 
 * @class BrowserCompatibilityError
 * @extends Error
 */
class BrowserCompatibilityError extends Error {
  /**
   * Create a new BrowserCompatibilityError
   * 
   * @param {string} message - Error message
   * @param {Object} details - Additional error details
   * @param {Error} [originalError] - Original error that caused this error
   */
  constructor(message, details = {}, originalError = null) {
    super(message);
    this.name = 'BrowserCompatibilityError';
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
 * Load the appropriate module format based on the environment
 * 
 * @private
 * @async
 * @function loadModules
 * @returns {Promise<void>} Promise that resolves when the module is loaded
 * @throws {BrowserCompatibilityError} When module loading fails
 */
async function loadModules() {
  try {
    if (isEsm) {
      // ESM environment - dynamically import the .mjs versions
      const [compatibilityMod, loggerMod, handlerMod] = await Promise.all([
        import('./browserCompatibility.mjs'),
        import('./zkErrorLogger.mjs'),
        import('./zkErrorHandler.mjs')
      ]);

      compatibilityModule = compatibilityMod.default;
      errorLogger = loggerMod.default.zkErrorLogger;
      errorHandler = handlerMod;
    } else {
      // CommonJS environment - use require for the CJS versions
      compatibilityModule = require('./cjs/browserCompatibility.cjs');
      const errorLoggerMod = require('./cjs/zkErrorLogger.cjs');
      errorHandler = require('./cjs/zkErrorHandler.cjs');
      errorLogger = errorLoggerMod.zkErrorLogger;
    }
  } catch (err) {
    // Basic error logging for bootstrap error (can't use the error system yet)
    console.error(`Failed to load browser compatibility modules: ${err.message}`, {
      originalError: err.message,
      environment: isEsm ? 'ESM' : 'CommonJS',
      context: 'browserCompatibility.js.loadModules'
    });

    // Throw specialized error with context
    throw new BrowserCompatibilityError(
      `Browser compatibility module initialization failed: ${err.message}`,
      {
        environment: isEsm ? 'ESM' : 'CommonJS',
        moduleType: 'browser compatibility',
        attemptedPaths: isEsm ?
          ['./browserCompatibility.mjs', './zkErrorLogger.mjs', './zkErrorHandler.mjs'] :
          ['./cjs/browserCompatibility.cjs', './cjs/zkErrorLogger.cjs', './cjs/zkErrorHandler.cjs']
      },
      err
    );
  }
}

/**
 * Promise for module loading, initialized immediately
 * @type {Promise<void>}
 */
const modulesPromise = loadModules();

/**
 * Lazy-loaded module property getter
 * Ensures the modules are loaded before returning any properties
 * 
 * @async
 * @function getModuleProp
 * @param {string} prop - The property to get
 * @returns {Promise<any>} The requested property from the module
 * @throws {BrowserCompatibilityError} When module loading fails
 */
async function getModuleProp(prop) {
  try {
    await modulesPromise;
    return compatibilityModule[prop];
  } catch (err) {
    // Handle errors that might occur during module loading
    throw new BrowserCompatibilityError(
      `Failed to get browser compatibility property '${prop}': ${err.message}`,
      { propertyName: prop },
      err
    );
  }
}

/**
 * Log an error through the error logging system
 * 
 * @async
 * @function logError
 * @param {Error} error - The error to log
 * @param {Object} additionalData - Additional contextual data
 * @returns {Promise<void>} Promise that resolves when logging is complete
 */
async function logError(error, additionalData = {}) {
  try {
    await modulesPromise;

    // Ensure we have the error logger
    if (!errorLogger) {
      console.error('Error logger not available', {
        error: error.message,
        context: 'browserCompatibility.js.logError'
      });
      return;
    }

    // Log through the error logging system
    errorLogger.logError(error, {
      context: 'browserCompatibility.js',
      ...additionalData
    });
  } catch (loggingError) {
    // Fallback if error logging fails
    console.error('Error logging failed', {
      originalError: error.message,
      loggingError: loggingError.message,
      context: 'browserCompatibility.js.logError'
    });
  }
}

/**
 * Detects browser features and capabilities
 * 
 * @async
 * @function detectBrowserFeatures
 * @returns {Promise<Object>} Object containing detected browser features
 */
export async function detectBrowserFeatures() {
  try {
    await modulesPromise;
    // Use checkBrowserSupport as it's more comprehensive
    return compatibilityModule.checkBrowserSupport ?
      compatibilityModule.checkBrowserSupport() :
      compatibilityModule.detectSharedArrayBuffer ?
        { supported: compatibilityModule.detectSharedArrayBuffer() } :
        { supported: true };
  } catch (error) {
    // Handle and log errors
    if (errorLogger && errorHandler) {
      const operationId = `detectBrowserFeatures_${Date.now()}`;
      const systemError = new errorHandler.SystemError(
        `Failed to detect browser features: ${error.message}`,
        {
          code: errorHandler.ErrorCode.COMPATIBILITY_BROWSER_UNSUPPORTED,
          severity: errorHandler.ErrorSeverity.WARNING,
          operationId,
          recoverable: true,
          details: { originalError: error.message }
        }
      );

      await logError(systemError, { context: 'browserCompatibility.js.detectBrowserFeatures' });
    } else {
      console.error(`Failed to detect browser features: ${error.message}`);
    }

    // Return fallback value to prevent errors from propagating
    return { supported: false, error: error.message };
  }
}

/**
 * Checks if browser is compatible with ZK operations
 * 
 * @async
 * @function isBrowserCompatible
 * @param {string} [operationType='standard'] - Type of operation to check compatibility for
 * @returns {Promise<boolean>} True if browser is compatible for the specified operation
 */
export async function isBrowserCompatible(operationType = 'standard') {
  try {
    await modulesPromise;
    return compatibilityModule.isBrowserCompatible ?
      compatibilityModule.isBrowserCompatible(operationType) :
      true;
  } catch (error) {
    // Handle and log errors
    if (errorLogger && errorHandler) {
      const operationId = `isBrowserCompatible_${Date.now()}`;
      const systemError = new errorHandler.SystemError(
        `Failed to check browser compatibility: ${error.message}`,
        {
          code: errorHandler.ErrorCode.COMPATIBILITY_BROWSER_UNSUPPORTED,
          severity: errorHandler.ErrorSeverity.WARNING,
          operationId,
          recoverable: true,
          details: {
            originalError: error.message,
            operationType
          }
        }
      );

      await logError(systemError, { context: 'browserCompatibility.js.isBrowserCompatible' });
    } else {
      console.error(`Failed to check browser compatibility: ${error.message}`);
    }

    // Conservative approach: if there's an error, assume incompatibility
    return false;
  }
}

/**
 * Default export for ESM - dynamic module proxy
 * 
 * This pattern uses a Proxy to intercept property access and load modules on demand
 * 
 * @type {Proxy}
 */
export default new Proxy({}, {
  get: (target, prop) => {
    // Special case for Symbol.toStringTag to avoid errors
    if (prop === Symbol.toStringTag) {
      return 'Module';
    }

    // Return a function or property that loads the module on demand
    if (typeof prop === 'string' && prop !== 'then') {
      // Special case for already implemented methods
      if (prop === 'detectBrowserFeatures') {
        return detectBrowserFeatures;
      }

      if (prop === 'isBrowserCompatible') {
        return isBrowserCompatible;
      }

      // For all other functions, return a function that loads the module first
      return (...args) => {
        return getModuleProp(prop).then(value => {
          return typeof value === 'function' ? value(...args) : value;
        });
      };
    }
    return undefined;
  }
});

// Export named properties for common browser compatibility functions

/**
 * Detects SharedArrayBuffer support for parallel processing
 * @type {Promise<Function>}
 */
export const detectSharedArrayBuffer = getModuleProp('detectSharedArrayBuffer');

/**
 * Detects IndexedDB support for client-side storage
 * @type {Promise<Function>}
 */
export const detectIndexedDB = getModuleProp('detectIndexedDB');

/**
 * Detects BigInt support for cryptographic operations
 * @type {Promise<Function>}
 */
export const detectBigIntSupport = getModuleProp('detectBigIntSupport');

/**
 * Performs comprehensive browser compatibility checks
 * @type {Promise<Function>}
 */
export const checkBrowserSupport = getModuleProp('checkBrowserSupport');

/**
 * Gets detailed device capabilities for ZK operations
 * @type {Promise<Function>}
 */
export const getDeviceCapabilities = getModuleProp('getDeviceCapabilities');

/**
 * Minimum required browser versions for full compatibility
 * @type {Promise<Object>}
 */
export const BROWSER_VERSION_REQUIREMENTS = getModuleProp('BROWSER_VERSION_REQUIREMENTS');

/**
 * Feature support matrix by browser version
 * @type {Promise<Object>}
 */
export const FEATURE_SUPPORT_MATRIX = getModuleProp('FEATURE_SUPPORT_MATRIX');

/**
 * Known browser-specific issues and workarounds
 * @type {Promise<Object>}
 */
export const KNOWN_ISSUES = getModuleProp('KNOWN_ISSUES');