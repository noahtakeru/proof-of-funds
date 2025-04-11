/**
 * Memory Management for Zero-Knowledge Operations
 * 
 * This file is a compatibility layer that determines whether to use
 * the ESM (.mjs) or CommonJS (.cjs) version based on the environment.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module acts as a resource manager for our privacy-protecting system.
 * It handles memory monitoring, secure data wiping, and resource optimization.
 * This supports operation across different device capabilities and prevents
 * application crashes during memory-intensive operations.
 */

// For static ESM imports, export a placeholder that will be populated
export default {};

// Define the export object for documentation purposes
/**
 * Memory manager module
 * @typedef {Object} MemoryManagerModule
 * @property {function} suggestGarbageCollection - Suggests garbage collection to JS engine
 * @property {function} secureMemoryWipe - Securely wipes sensitive data from memory
 * @property {function} getMemoryUsage - Gets current memory usage information
 * @property {function} checkMemoryAvailability - Checks if required memory is available
 * @property {function} startMemoryMonitoring - Starts periodic memory monitoring
 * @property {function} stopMemoryMonitoring - Stops memory monitoring
 * @property {function} runWithMemoryControl - Runs a function with memory monitoring
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

        // After error handlers are set up, load memoryManager
        import('./memoryManager.mjs').then(module => {
          // Make the exports available globally
          window.memoryManager = module.default || module;
        }).catch(importError => {
          if (_zkErrorLogger && _ErrorHandler) {
            const operationId = `memoryManager_import_${Date.now()}`;
            _zkErrorLogger.logError(new _ErrorHandler.SystemError(`Failed to load ESM version of memoryManager: ${importError.message}`, {
              code: _ErrorHandler.ErrorCode.SYSTEM_NOT_INITIALIZED,
              severity: _ErrorHandler.ErrorSeverity.ERROR,
              operationId,
              recoverable: false,
              details: { originalError: importError.message }
            }), {
              context: 'memoryManager.js'
            });
          } else {
            console.error('Failed to load ESM version of memoryManager:', importError);
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

        // Load memoryManager module
        const memoryManager = require(path.join('..', 'cjs', 'memoryManager.cjs'));

        // Export all properties
        Object.keys(memoryManager).forEach(key => {
          exports[key] = memoryManager[key];
        });
      } catch (requireError) {
        if (_zkErrorLogger && _ErrorHandler) {
          const operationId = `memoryManager_require_${Date.now()}`;
          _zkErrorLogger.logError(new _ErrorHandler.SystemError(`Failed to require CommonJS modules: ${requireError.message}`, {
            code: _ErrorHandler.ErrorCode.SYSTEM_NOT_INITIALIZED,
            severity: _ErrorHandler.ErrorSeverity.ERROR,
            operationId,
            recoverable: false,
            details: { originalError: requireError.message }
          }), {
            context: 'memoryManager.js'
          });
        } else {
          console.error('Failed to require CommonJS modules:', requireError);
        }
      }
    }
  } catch (e) {
    // Final fallback error handler
    console.error('Critical error in memoryManager module:', e);
  }
})();