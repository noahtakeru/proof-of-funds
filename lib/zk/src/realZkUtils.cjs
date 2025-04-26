/**
 * Re-export file for realZkUtils
 * 
 * This file is a compatibility layer that determines whether to use
 * the ESM (.mjs) or CommonJS (.cjs) version based on the environment.
 * 
 * Replaces the mock implementations in zkUtils.js with real, functional
 * implementations that perform actual cryptographic operations.
 * 
 * @module realZkUtils
 */

// For static ESM imports, export a placeholder that will be populated
export default {};

// Define the export object for documentation purposes
/**
 * ZK utility module
 * @typedef {Object} RealZkUtilsModule
 * @property {function} toFieldElement - Converts a number to field element representation
 * @property {function} padArray - Pads an array to the specified length
 * @property {function} serializeZKProof - Serializes a ZK proof for transmission or storage
 * @property {function} deserializeZKProof - Deserializes a ZK proof from its string format
 * @property {function} generateZKProofHash - Generates a hash of a ZK proof
 * @property {function} bufferToFieldArray - Converts a buffer to field element array
 * @property {function} normalizeAddress - Normalizes an Ethereum address
 * @property {function} stringifyBigInts - Stringifies BigInt values for JSON
 * @property {function} parseBigInts - Parses stringified BigInt values
 * @property {function} formatNumber - Formats a number with appropriate units
 * @property {function} generateZKProof - Generates ZK proofs using snarkjs
 * @property {function} verifyZKProof - Verifies ZK proofs using snarkjs
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

        // After error handlers are set up, load realZkUtils
        import('./realZkUtils.mjs').then(module => {
          // Make the exports available globally
          window.realZkUtils = module.default || module;
        }).catch(importError => {
          if (_zkErrorLogger && _ErrorHandler) {
            const operationId = `realZkUtils_import_${Date.now()}`;
            _zkErrorLogger.logError(new _ErrorHandler.SystemError(`Failed to load ESM version of realZkUtils: ${importError.message}`, {
              code: _ErrorHandler.ErrorCode.SYSTEM_NOT_INITIALIZED,
              severity: _ErrorHandler.ErrorSeverity.ERROR,
              operationId,
              recoverable: false,
              details: { originalError: importError.message }
            }), {
              context: 'realZkUtils.js'
            });
          } else {
            console.error('Failed to load ESM version of realZkUtils:', importError);
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

        // Load realZkUtils module
        const realZkUtils = require(path.join('..', 'cjs', 'realZkUtils.cjs'));

        // Export all properties
        Object.keys(realZkUtils).forEach(key => {
          exports[key] = realZkUtils[key];
        });
      } catch (requireError) {
        if (_zkErrorLogger && _ErrorHandler) {
          const operationId = `realZkUtils_require_${Date.now()}`;
          _zkErrorLogger.logError(new _ErrorHandler.SystemError(`Failed to require CommonJS modules: ${requireError.message}`, {
            code: _ErrorHandler.ErrorCode.SYSTEM_NOT_INITIALIZED,
            severity: _ErrorHandler.ErrorSeverity.ERROR,
            operationId,
            recoverable: false,
            details: { originalError: requireError.message }
          }), {
            context: 'realZkUtils.js'
          });
        } else {
          console.error('Failed to require CommonJS modules:', requireError);
        }
      }
    }
  } catch (e) {
    // Final fallback error handler
    console.error('Critical error in realZkUtils module:', e);
  }
})();