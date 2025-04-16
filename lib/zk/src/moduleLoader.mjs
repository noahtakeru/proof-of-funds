/**
 * Module Loader Helper for ESM and CommonJS compatibility (ESM Version)
 * 
 * This module provides helper functions to statically load modules
 * in both ESM and CommonJS environments, providing a consistent API
 * regardless of the module format.
 * 
 * @module moduleLoader
 */

import { SystemError, ErrorCode } from './zkErrorHandler.mjs';
import { zkErrorLogger } from './zkErrorLogger.mjs';

// Directly import all possible modules to avoid dynamic imports
import * as zkUtils from './zkUtils.mjs';
import * as realZkUtils from './realZkUtils.mjs';
import * as zkErrorHandlerModule from './zkErrorHandler.mjs';
import * as zkErrorLoggerModule from './zkErrorLogger.mjs';
import * as browserCompatibility from './browserCompatibility.mjs';
import * as zkProofSerializer from './zkProofSerializer.js';
import * as zkSecureInputs from './zkSecureInputs.mjs';
import * as zkCircuitRegistry from './zkCircuitRegistry.mjs';

/**
 * Check if we're in a CommonJS environment
 * @type {boolean}
 */
export const isCommonJS = typeof module !== 'undefined' && module.exports;

/**
 * Module mapping to avoid dynamic imports
 */
const moduleMap = {
  './zkUtils.mjs': zkUtils,
  './realZkUtils.mjs': realZkUtils,
  './zkErrorHandler.mjs': zkErrorHandlerModule,
  './zkErrorLogger.mjs': zkErrorLoggerModule,
  './browserCompatibility.mjs': browserCompatibility,
  './zkProofSerializer.js': zkProofSerializer,
  './zkSecureInputs.mjs': zkSecureInputs,
  './zkCircuitRegistry.mjs': zkCircuitRegistry
};

/**
 * Statically load a module from our predefined map
 * 
 * @param {string} esmPath - Path to the ESM module
 * @param {string} cjsPath - Path to the CommonJS module (not used in this implementation)
 * @returns {Promise<Object>} - The loaded module
 * @throws {SystemError} If module loading fails
 */
export async function loadModule(esmPath, cjsPath) {
  const operationId = `loadModule_${Date.now()}`;

  try {
    // Look up the module in our static map
    if (moduleMap[esmPath]) {
      return Promise.resolve(moduleMap[esmPath]);
    }
    
    // If the module isn't in our map, throw an error
    throw new Error(`Module not found in static mapping: ${esmPath}`);
  } catch (error) {
    // Log with proper error handling
    const moduleError = new SystemError(`Failed to load module: ${error.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      operationId,
      recoverable: false,
      details: { 
        originalError: error.message,
        modulePath: esmPath 
      }
    });
    
    zkErrorLogger.logError(moduleError, { context: 'loadModule' });
    throw moduleError;
  }
}

/**
 * Register a module in the static map
 * 
 * @param {string} path - Path to register
 * @param {object} module - The module implementation
 */
export function registerModule(path, module) {
  moduleMap[path] = module;
}

export default {
  isCommonJS,
  loadModule,
  registerModule
};