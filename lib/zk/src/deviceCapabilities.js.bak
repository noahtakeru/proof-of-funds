/**
 * Re-export file for deviceCapabilities
 * 
 * This file is a compatibility layer that determines whether to use
 * the ESM (.mjs) or CommonJS (.cjs) version based on the environment.
 * 
 * ---------- MOCK STATUS ----------
 * This file contains the following mock implementations:
 * - Default export (line 9): Exports an empty placeholder object that gets populated
 *   at runtime instead of providing proper static exports.
 * 
 * This mock is documented in MOCKS.md with priority MEDIUM for replacement.
 * 
 * @module deviceCapabilities
 */

// For static ESM imports, export a placeholder that will be populated
export default {};

// Define the export object for documentation purposes
/**
 * Device capabilities module
 * @typedef {Object} DeviceCapabilitiesModule
 * @property {function} detectCapabilities - Detects device capabilities
 * @property {function} detectWebAssembly - Detects WebAssembly support
 * @property {function} detectWebCrypto - Detects Web Crypto API support
 * @property {function} detectWebWorkers - Detects Web Workers support
 * @property {Object} MEMORY_THRESHOLDS - Memory threshold constants
 * @property {Object} CPU_THRESHOLDS - CPU threshold constants
 */

// We need to conditionally import zkErrorLogger based on the environment
let _zkErrorLogger = null;
let _ErrorHandler = null;

// Use a self-invoking function to avoid global scope pollution and
// to properly handle both ESM and CommonJS environments
(function () {
  // Set up error logging
  try {
    // For ESM environment, we need to use dynamic imports
    if (typeof window !== 'undefined') {
      // Browser environment - use dynamic imports
      Promise.all([
        import('./zkErrorLogger.mjs'),
        import('./zkErrorHandler.mjs')
      ]).then(([errorLogger, errorHandler]) => {
        _zkErrorLogger = errorLogger.default;
        _ErrorHandler = errorHandler;

        // After error handlers are set up, load deviceCapabilities
        import('./deviceCapabilities.mjs').then(module => {
          // Make the exports available globally
          window.deviceCapabilities = module.default || module;
        }).catch(importError => {
          if (_zkErrorLogger && _ErrorHandler) {
            const operationId = `deviceCapabilities_import_${Date.now()}`;
            _zkErrorLogger.logError(new _ErrorHandler.SystemError(`Failed to load ESM version of deviceCapabilities: ${importError.message}`, {
              code: _ErrorHandler.ErrorCode.SYSTEM_NOT_INITIALIZED,
              severity: _ErrorHandler.ErrorSeverity.ERROR,
              operationId,
              recoverable: false,
              details: { originalError: importError.message }
            }), {
              context: 'deviceCapabilities.js'
            });
          } else {
            console.error('Failed to load ESM version of deviceCapabilities:', importError);
          }
        });
      }).catch(loaderError => {
        console.error('Failed to load ESM version of error modules:', loaderError);
      });
    }

    // Check if we're in a CommonJS context in a way that won't trigger ESM warnings
    const isCommonJS = typeof require === 'function' && typeof exports === 'object';

    if (isCommonJS) {
      try {
        // Dynamically load the CommonJS version
        const path = require('path');

        // Load error modules for CommonJS
        const errorLogger = require(path.join('..', 'cjs', 'zkErrorLogger.cjs'));
        const errorHandler = require(path.join('..', 'cjs', 'zkErrorHandler.cjs'));
        _zkErrorLogger = errorLogger;
        _ErrorHandler = errorHandler;

        // Load deviceCapabilities module
        const deviceCapabilities = require(path.join('..', 'cjs', 'deviceCapabilities.cjs'));

        // Export all properties
        Object.keys(deviceCapabilities).forEach(key => {
          exports[key] = deviceCapabilities[key];
        });
      } catch (requireError) {
        if (_zkErrorLogger && _ErrorHandler) {
          const operationId = `deviceCapabilities_require_${Date.now()}`;
          _zkErrorLogger.logError(new _ErrorHandler.SystemError(`Failed to require CommonJS modules: ${requireError.message}`, {
            code: _ErrorHandler.ErrorCode.SYSTEM_NOT_INITIALIZED,
            severity: _ErrorHandler.ErrorSeverity.ERROR,
            operationId,
            recoverable: false,
            details: { originalError: requireError.message }
          }), {
            context: 'deviceCapabilities.js'
          });
        } else {
          console.error('Failed to require CommonJS modules:', requireError);
        }
      }
    }
  } catch (e) {
    // Final fallback error handler
    console.error('Critical error in deviceCapabilities module:', e);
  }
})();