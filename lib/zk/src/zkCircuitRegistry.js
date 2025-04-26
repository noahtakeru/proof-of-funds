/**
 * Re-export file for zkCircuitRegistry
 * 
 * This file is a compatibility layer that determines whether to use
 * the ESM (.mjs) or CommonJS (.cjs) version based on the environment.
 * 
 * @module zkCircuitRegistry
 */

// For static ESM imports, export a placeholder that will be populated
export default {};

// Define the export object for documentation purposes
/**
 * Circuit Registry module
 * @typedef {Object} CircuitRegistryModule
 * @property {Object} CIRCUIT_TYPES - Constants defining supported circuit types
 * @property {function} getCircuitVersions - Get all available versions for a circuit type
 * @property {function} getLatestCircuitVersion - Get latest version for a circuit type
 * @property {function} getCircuitByVersion - Get circuit metadata by type and version
 * @property {function} getCircuitMetadata - Get detailed metadata for a circuit
 * @property {function} getCircuitConfig - Get configuration for a circuit
 * @property {function} getCircuitPaths - Get file paths for a circuit
 * @property {function} registerCircuit - Register a new circuit in the registry
 * @property {function} updateCircuitMetadata - Update metadata for an existing circuit
 * @property {function} checkCircuitCompatibility - Check compatibility between circuit versions
 * @property {function} getMemoryRequirements - Get memory requirements for a circuit
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

                // After error handlers are set up, load zkCircuitRegistry
                import('./zkCircuitRegistry.mjs').then(module => {
                    // Make the exports available globally
                    window.zkCircuitRegistry = module.default || module;
                }).catch(importError => {
                    if (_zkErrorLogger && _ErrorHandler) {
                        const operationId = `zkCircuitRegistry_import_${Date.now()}`;
                        _zkErrorLogger.logError(new _ErrorHandler.SystemError(`Failed to load ESM version of zkCircuitRegistry: ${importError.message}`, {
                            code: _ErrorHandler.ErrorCode.SYSTEM_NOT_INITIALIZED,
                            severity: _ErrorHandler.ErrorSeverity.ERROR,
                            operationId,
                            recoverable: false,
                            details: { originalError: importError.message }
                        }), {
                            context: 'zkCircuitRegistry.js'
                        });
                    } else {
                        console.error('Failed to load ESM version of zkCircuitRegistry:', importError);
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
                import path from 'path';

                // Load error modules for CommonJS
                const errorLogger = require(path.join('..', 'cjs', 'zkErrorLogger.cjs'));
                const errorHandler = require(path.join('..', 'cjs', 'zkErrorHandler.cjs'));
                _zkErrorLogger = errorLogger;
                _ErrorHandler = errorHandler;

                // Load zkCircuitRegistry module
                const zkCircuitRegistry = require(path.join('..', 'cjs', 'zkCircuitRegistry.cjs'));

                // Export all properties
                Object.keys(zkCircuitRegistry).forEach(key => {
                    exports[key] = zkCircuitRegistry[key];
                });
            } catch (requireError) {
                if (_zkErrorLogger && _ErrorHandler) {
                    const operationId = `zkCircuitRegistry_require_${Date.now()}`;
                    _zkErrorLogger.logError(new _ErrorHandler.SystemError(`Failed to require CommonJS modules: ${requireError.message}`, {
                        code: _ErrorHandler.ErrorCode.SYSTEM_NOT_INITIALIZED,
                        severity: _ErrorHandler.ErrorSeverity.ERROR,
                        operationId,
                        recoverable: false,
                        details: { originalError: requireError.message }
                    }), {
                        context: 'zkCircuitRegistry.js'
                    });
                } else {
                    console.error('Failed to require CommonJS modules:', requireError);
                }
            }
        }
    } catch (e) {
        // Final fallback error handler
        console.error('Critical error in zkCircuitRegistry module:', e);
    }
})(); 