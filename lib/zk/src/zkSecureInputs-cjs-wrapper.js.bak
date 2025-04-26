/**
 * Zero-Knowledge Secure Inputs - CommonJS Re-exporter
 * 
 * This module provides CommonJS require() compatibility for projects
 * that haven't migrated to ESM imports yet.
 * 
 * For ESM projects, import directly from zkSecureInputs.mjs:
 * import { generateSecureInputs } from './zkSecureInputs.mjs';
 * 
 * @module zkSecureInputs-reexport
 */

"use strict";

// Try to load error handling utilities
let ErrorCode, SystemError, zkErrorLogger;

try {
    const zkErrorHandler = require('./zkErrorHandler.js');
    const zkErrorLoggerModule = require('./zkErrorLogger.js');

    ErrorCode = zkErrorHandler.ErrorCode;
    SystemError = zkErrorHandler.SystemError;
    zkErrorLogger = zkErrorLoggerModule.zkErrorLogger;
} catch (e) {
    // Simple error logger fallback
    console.warn('Warning: Could not load error utilities:', e.message);

    // Create minimal implementations
    ErrorCode = { SYSTEM_MODULE_LOADING_FAILED: 'SYSTEM_MODULE_LOADING_FAILED' };
    SystemError = class SystemError extends Error {
        constructor(message, options = {}) {
            super(message);
            this.name = 'SystemError';
            this.code = options.code || ErrorCode.SYSTEM_MODULE_LOADING_FAILED;
        }
    };
    zkErrorLogger = {
        logError: (error) => console.error('[ERROR]', error.message),
        log: (level, message) => console.log(`[${level}]`, message)
    };
}

try {
    // Re-export the CJS module
    module.exports = require('./zkSecureInputs.cjs');
} catch (error) {
    // Log the error properly
    const moduleError = new SystemError(`Failed to load zkSecureInputs.cjs: ${error.message}`, {
        code: ErrorCode.SYSTEM_MODULE_LOADING_FAILED
    });

    zkErrorLogger.logError(moduleError);
    console.error('This might be due to a missing or corrupted zkSecureInputs.cjs file.');
    console.error('For ESM projects, use: import { generateSecureInputs } from "./zkSecureInputs.mjs";');

    // Provide a minimal fallback implementation
    const SECURITY_LEVELS = {
        STANDARD: 'standard',
        ENHANCED: 'enhanced',
        MAXIMUM: 'maximum'
    };

    // Create function stubs that throw helpful errors
    function createErrorFunction(name) {
        return function () {
            throw new SystemError(`${name} is unavailable - module failed to load`, {
                code: ErrorCode.SYSTEM_MODULE_LOADING_FAILED
            });
        };
    }

    // Export the fallback implementation
    module.exports = {
        generateSecureInputs: createErrorFunction('generateSecureInputs'),
        getSecureInputs: createErrorFunction('getSecureInputs'),
        validateSecureInputs: createErrorFunction('validateSecureInputs'),
        cleanupSecureInputs: createErrorFunction('cleanupSecureInputs'),
        SECURITY_LEVELS
    };
} 