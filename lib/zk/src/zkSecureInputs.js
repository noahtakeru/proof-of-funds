/**
 * zkSecureInputs Bridge Module (CommonJS)
 * 
 * This file is a CommonJS bridge that redirects imports to the appropriate module version.
 * It uses CommonJS module.exports and require() syntax exclusively.
 * 
 * For ESM imports, users should directly import from zkSecureInputs.mjs:
 * import { generateSecureInputs } from "./zkSecureInputs.mjs";
 * 
 * This module serves as a compatibility layer for projects using CommonJS require().
 * See package.json "exports" field for proper module resolution configuration.
 * 
 * @module zkSecureInputs
 * @type {CommonJS}
 */

// Import error handling utilities (CommonJS style)
let ErrorCode, SystemError, zkErrorLogger;

try {
    // First try to load error utilities from the standard location
    const zkErrorHandler = require('./zkErrorHandler.js');
    const zkErrorLoggerModule = require('./zkErrorLogger.js');

    ErrorCode = zkErrorHandler.ErrorCode;
    SystemError = zkErrorHandler.SystemError;
    zkErrorLogger = zkErrorLoggerModule.zkErrorLogger;
} catch (e) {
    // Minimal implementations if can't load error modules
    ErrorCode = {
        SYSTEM_MODULE_LOADING_FAILED: 'SYSTEM_MODULE_LOADING_FAILED',
        SYSTEM_FEATURE_UNSUPPORTED: 'SYSTEM_FEATURE_UNSUPPORTED'
    };
    SystemError = class SystemError extends Error {
        constructor(message, options = {}) {
            super(message);
            this.name = 'SystemError';
            this.code = options.code || ErrorCode.SYSTEM_MODULE_LOADING_FAILED;
            this.operationId = options.operationId || `systemError_${Date.now()}`;
        }
    };
    zkErrorLogger = {
        logError: (error) => console.error(`[ERROR] ${error.message}`),
        log: (level, message) => console.log(`[${level}] ${message}`)
    };
}

// Use a try-catch to handle potential require errors
try {
    // Attempt to load the CommonJS version
    module.exports = require('./zkSecureInputs.cjs');
} catch (error) {
    // Log the error properly
    const operationId = `zkSecureInputs_load_${Date.now()}`;
    const moduleError = new SystemError(`Failed to load zkSecureInputs module: ${error.message}`, {
        code: ErrorCode.SYSTEM_MODULE_LOADING_FAILED,
        operationId,
        details: { originalError: error.message }
    });

    zkErrorLogger.logError(moduleError);

    // Provide user-friendly console guidance
    console.error('This might be due to trying to load a CommonJS module in an ESM context.');
    console.error('If you are using ESM, import directly from zkSecureInputs.mjs instead:');
    console.error('import { generateSecureInputs } from "./zkSecureInputs.mjs";');

    // Provide a minimal implementation that throws proper errors
    module.exports = {
        generateSecureInputs: () => {
            throw new SystemError('zkSecureInputs module failed to load properly', {
                code: ErrorCode.SYSTEM_MODULE_LOADING_FAILED,
                operationId: `generateSecureInputs_${Date.now()}`
            });
        },
        getSecureInputs: () => {
            throw new SystemError('zkSecureInputs module failed to load properly', {
                code: ErrorCode.SYSTEM_MODULE_LOADING_FAILED,
                operationId: `getSecureInputs_${Date.now()}`
            });
        },
        validateSecureInputs: () => {
            throw new SystemError('zkSecureInputs module failed to load properly', {
                code: ErrorCode.SYSTEM_MODULE_LOADING_FAILED,
                operationId: `validateSecureInputs_${Date.now()}`
            });
        },
        cleanupSecureInputs: () => {
            throw new SystemError('zkSecureInputs module failed to load properly', {
                code: ErrorCode.SYSTEM_MODULE_LOADING_FAILED,
                operationId: `cleanupSecureInputs_${Date.now()}`
            });
        },
        SECURITY_LEVELS: {
            STANDARD: 'standard',
            ENHANCED: 'enhanced',
            MAXIMUM: 'maximum'
        }
    };
} 