/**
 * Secure Input Generator for Zero-Knowledge Circuits (Re-exporter Module)
 * 
 * This is a re-exporter that loads either the ESM or CommonJS version
 * of the zkSecureInputs module based on the environment. This file is explicitly
 * named with a .cjs extension to indicate it uses CommonJS module format.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This file acts as an intelligent router for our secure data handling system.
 * It detects what type of JavaScript environment is running and automatically
 * selects the compatible version of our code. This ensures that the secure input
 * generation system works consistently across different environments without
 * developers having to manually select the right version.
 */

// Import error handling utilities
let ErrorCode, SystemError, zkErrorLogger;

try {
    // Load from CommonJS paths
    const zkErrorHandler = require('./cjs/zkErrorHandler.cjs');
    const zkErrorLoggerModule = require('./cjs/zkErrorLogger.cjs');

    ErrorCode = zkErrorHandler.ErrorCode;
    SystemError = zkErrorHandler.SystemError;
    zkErrorLogger = zkErrorLoggerModule.zkErrorLogger;
} catch (e) {
    // Fallback minimal implementations if we can't load the actual modules
    ErrorCode = {
        SYSTEM_FEATURE_UNSUPPORTED: 'SYSTEM_FEATURE_UNSUPPORTED',
        SYSTEM_NOT_INITIALIZED: 'SYSTEM_NOT_INITIALIZED',
        SYSTEM_RESOURCE_UNAVAILABLE: 'SYSTEM_RESOURCE_UNAVAILABLE'
    };

    // Minimal SystemError implementation
    SystemError = class SystemError extends Error {
        constructor(message, options = {}) {
            super(message);
            this.name = 'SystemError';
            this.code = options.code || ErrorCode.SYSTEM_NOT_INITIALIZED;
            this.operationId = options.operationId || `systemError_${Date.now()}`;
            this.details = options.details || {};
        }
    };

    // Minimal logger implementation
    zkErrorLogger = {
        logError: (error, context = {}) => {
            console.error(`[${error.code || 'ERROR'}] ${error.message}`, {
                context,
                details: error.details || {}
            });
        },
        log: (level, message, details = {}) => {
            console.log(`[${level}] ${message}`, details);
        }
    };
}

/**
 * Determines whether we're running in a Node.js environment
 * @returns {boolean} True if running in Node.js
 */
function isNodeEnvironment() {
    return typeof process !== 'undefined' &&
        process.versions != null &&
        process.versions.node != null;
}

/**
 * Determines whether we're running in a browser environment
 * @returns {boolean} True if running in a browser
 */
function isBrowserEnvironment() {
    return typeof window !== 'undefined';
}

/**
 * Dynamically determines which module to load based on the environment
 * @returns {Object} The appropriate module exports
 */
function loadAppropriateModule() {
    const operationId = `zkSecureInputs_load_${Date.now()}`;

    // Check if we're in a browser environment that might support ESM
    const isBrowser = isBrowserEnvironment();
    const isNode = isNodeEnvironment();

    // Log environment detection
    zkErrorLogger.log('INFO', 'Detecting environment for zkSecureInputs loading', {
        operationId,
        context: 'zkSecureInputs.cjs',
        details: {
            isBrowser,
            isNode,
            moduleType: 'CommonJS'
        }
    });

    // In CommonJS context, we'll load the CommonJS version
    try {
        // Try to load the CommonJS version
        return require('./cjs/zkSecureInputs.cjs');
    } catch (error) {
        // Create a proper error object with detailed information
        const moduleError = new SystemError(`Failed to load zkSecureInputs module: ${error.message}`, {
            code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
            operationId,
            recoverable: false,
            details: {
                originalError: error.message,
                modulePath: './cjs/zkSecureInputs.cjs',
                environment: isNode ? 'node' : (isBrowser ? 'browser' : 'unknown')
            }
        });

        // Log the error properly
        zkErrorLogger.logError(moduleError, {
            context: 'zkSecureInputs.cjs',
            operation: 'module loading'
        });

        // Return a fallback implementation
        return createFallbackModule(moduleError);
    }
}

/**
 * Creates a fallback module with minimal functionality if module loading fails
 * @param {Error} error - The error that caused the fallback to be needed
 * @returns {Object} A minimal implementation that throws helpful errors
 */
function createFallbackModule(error) {
    const operationId = `zkSecureInputs_fallback_${Date.now()}`;
    const errorMessage = `zkSecureInputs module failed to load properly: ${error.message}`;

    // Log a clear warning using the error logger
    zkErrorLogger.log('WARNING', 'Using fallback implementation of zkSecureInputs', {
        operationId,
        context: 'zkSecureInputs.cjs',
        details: {
            originalError: error.message,
            recommendation: 'Check module paths and build configuration'
        }
    });

    // Return functions that throw proper errors when called
    return {
        generateSecureInputs: () => {
            const functionError = new SystemError('generateSecureInputs unavailable: module failed to load', {
                code: ErrorCode.SYSTEM_NOT_INITIALIZED,
                operationId: `generateSecureInputs_error_${Date.now()}`,
                recoverable: false,
                details: { originalError: error.message }
            });

            zkErrorLogger.logError(functionError, {
                context: 'zkSecureInputs.generateSecureInputs'
            });

            throw functionError;
        },
        getSecureInputs: () => {
            const functionError = new SystemError('getSecureInputs unavailable: module failed to load', {
                code: ErrorCode.SYSTEM_NOT_INITIALIZED,
                operationId: `getSecureInputs_error_${Date.now()}`,
                recoverable: false,
                details: { originalError: error.message }
            });

            zkErrorLogger.logError(functionError, {
                context: 'zkSecureInputs.getSecureInputs'
            });

            throw functionError;
        },
        validateSecureInputs: () => {
            const functionError = new SystemError('validateSecureInputs unavailable: module failed to load', {
                code: ErrorCode.SYSTEM_NOT_INITIALIZED,
                operationId: `validateSecureInputs_error_${Date.now()}`,
                recoverable: false,
                details: { originalError: error.message }
            });

            zkErrorLogger.logError(functionError, {
                context: 'zkSecureInputs.validateSecureInputs'
            });

            throw functionError;
        },
        cleanupSecureInputs: () => {
            const functionError = new SystemError('cleanupSecureInputs unavailable: module failed to load', {
                code: ErrorCode.SYSTEM_NOT_INITIALIZED,
                operationId: `cleanupSecureInputs_error_${Date.now()}`,
                recoverable: false,
                details: { originalError: error.message }
            });

            zkErrorLogger.logError(functionError, {
                context: 'zkSecureInputs.cleanupSecureInputs'
            });

            throw functionError;
        },
        SECURITY_LEVELS: {
            STANDARD: 'standard',
            ENHANCED: 'enhanced',
            MAXIMUM: 'maximum'
        },
        // Include a reference to the error for easy access
        loadError: error
    };
}

// Load the appropriate module
const zkSecureInputs = loadAppropriateModule();

// Log successful module loading
zkErrorLogger.log('INFO', 'zkSecureInputs module loaded successfully', {
    context: 'zkSecureInputs.cjs',
    moduleType: 'CommonJS'
});

// Export the loaded module using CommonJS style
module.exports = zkSecureInputs; 