/**
 * Module Loader Helper for ESM and CommonJS compatibility (ESM Version)
 * 
 * This module provides helper functions to dynamically load modules
 * in both ESM and CommonJS environments, providing a consistent API
 * regardless of the module format.
 * 
 * @module moduleLoader
 */

import { SystemError, ErrorCode } from './zkErrorHandler.mjs';
import { zkErrorLogger } from './zkErrorLogger.mjs';

/**
 * Check if we're in a CommonJS environment
 * @type {boolean}
 */
export const isCommonJS = typeof module !== 'undefined' && module.exports;

/**
 * Dynamically load a module in either ESM or CommonJS format
 * 
 * @param {string} esmPath - Path to the ESM module
 * @param {string} cjsPath - Path to the CommonJS module
 * @returns {Promise<Object>} - The loaded module
 * @throws {SystemError} If module loading fails
 * @example
 * // In ESM context
 * const utils = await loadModule('./utils.mjs', './utils.cjs');
 * 
 * // In CommonJS context
 * const utils = await loadModule('./utils.mjs', './utils.cjs');
 */
export async function loadModule(esmPath, cjsPath) {
  const operationId = `loadModule_${Date.now()}`;

  try {
    if (isCommonJS) {
      try {
        // In CommonJS environment, use require()
        return require(cjsPath);
      } catch (error) {
        // Log with proper error handling
        const moduleError = new SystemError(`Failed to load CommonJS module ${cjsPath}`, {
          code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
          operationId,
          recoverable: false,
          details: { 
            originalError: error.message,
            modulePath: cjsPath 
          }
        });
        
        zkErrorLogger.logError(moduleError, { context: 'loadModule.cjs' });
        throw moduleError;
      }
    } else {
      try {
        // In ESM environment, use dynamic import()
        return await import(esmPath);
      } catch (error) {
        // Log with proper error handling
        const moduleError = new SystemError(`Failed to load ESM module ${esmPath}`, {
          code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
          operationId,
          recoverable: false,
          details: { 
            originalError: error.message,
            modulePath: esmPath 
          }
        });
        
        zkErrorLogger.logError(moduleError, { context: 'loadModule.esm' });
        throw moduleError;
      }
    }
  } catch (error) {
    // If it's already a SystemError, just re-throw
    if (error instanceof SystemError) {
      throw error;
    }
    
    // Otherwise wrap in a SystemError
    const wrapError = new SystemError(`Module loading failed`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      operationId,
      recoverable: false,
      details: { 
        originalError: error.message,
        esmPath,
        cjsPath
      }
    });
    
    zkErrorLogger.logError(wrapError, { context: 'loadModule' });
    throw wrapError;
  }
}

// Default export for backward compatibility
export default {
  loadModule,
  isCommonJS
};