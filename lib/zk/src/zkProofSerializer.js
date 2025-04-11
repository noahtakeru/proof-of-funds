/**
 * Re-export file for zkProofSerializer
 * 
 * This file is a compatibility layer that determines whether to use
 * the ESM (.mjs) or CommonJS (.cjs) version based on the environment.
 * 
 * @module zkProofSerializer
 */

// For static ESM imports, export a placeholder
export default {};

// Export placeholders for documentation purposes
/**
 * Zero-Knowledge Proof Serialization module
 * @typedef {Object} ZkProofSerializerModule
 * @property {function} serializeProof - Serializes a ZK proof with metadata
 * @property {function} deserializeProof - Deserializes a ZK proof from its serialized form
 * @property {function} extractProofForVerification - Extracts proof data for verification
 * @property {function} isValidProof - Checks if a proof container is valid
 * @property {function} getProofMetadata - Extracts metadata from a proof container
 * @property {function} checkVersionCompatibility - Checks version compatibility
 * @property {Object} PROOF_TYPES - Supported proof types
 * @property {string} PROOF_FORMAT_VERSION - Current proof format version
 * @property {string} LIBRARY_VERSION - Current library version
 */

// We need to conditionally import error handlers based on the environment
let _zkErrorLogger = null;
let _ErrorHandler = null;

// Use a self-invoking function to avoid global scope pollution and
// to properly handle both ESM and CommonJS environments
(function () {
    // Set up error logging
    try {
        // For ESM environment, we use dynamic imports
        if (typeof window !== 'undefined') {
            // Browser environment - use dynamic imports
            Promise.all([
                import('./zkErrorLogger.mjs'),
                import('./zkErrorHandler.mjs')
            ]).then(([errorLogger, errorHandler]) => {
                _zkErrorLogger = errorLogger.default;
                _ErrorHandler = errorHandler;

                // After error handlers are set up, load zkProofSerializer
                import('./zkProofSerializer.mjs').then(module => {
                    // Make the exports available globally
                    window.zkProofSerializer = module.default || module;
                }).catch(importError => {
                    if (_zkErrorLogger && _ErrorHandler) {
                        const operationId = `zkProofSerializer_import_${Date.now()}`;
                        _zkErrorLogger.logError(new _ErrorHandler.SystemError(`Failed to load ESM version of zkProofSerializer: ${importError.message}`, {
                            code: _ErrorHandler.ErrorCode.SYSTEM_NOT_INITIALIZED,
                            severity: _ErrorHandler.ErrorSeverity.ERROR,
                            operationId,
                            recoverable: false,
                            details: { originalError: importError.message }
                        }), {
                            context: 'zkProofSerializer.js'
                        });
                    } else {
                        console.error('Failed to load ESM version of zkProofSerializer:', importError);
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

                // Load zkProofSerializer module
                const zkProofSerializer = require(path.join('..', 'cjs', 'zkProofSerializer.cjs'));

                // Export all properties
                Object.keys(zkProofSerializer).forEach(key => {
                    exports[key] = zkProofSerializer[key];
                });
            } catch (requireError) {
                if (_zkErrorLogger && _ErrorHandler) {
                    const operationId = `zkProofSerializer_require_${Date.now()}`;
                    _zkErrorLogger.logError(new _ErrorHandler.SystemError(`Failed to require CommonJS modules: ${requireError.message}`, {
                        code: _ErrorHandler.ErrorCode.SYSTEM_NOT_INITIALIZED,
                        severity: _ErrorHandler.ErrorSeverity.ERROR,
                        operationId,
                        recoverable: false,
                        details: { originalError: requireError.message }
                    }), {
                        context: 'zkProofSerializer.js'
                    });
                } else {
                    console.error('Failed to require CommonJS modules:', requireError);
                }
            }
        }
    } catch (e) {
        // Final fallback error handler
        console.error('Critical error in zkProofSerializer module:', e);
    }
})(); 