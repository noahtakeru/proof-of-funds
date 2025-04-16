/**
 * Module Standardizer
 * 
 * This utility helps standardize module exports across the codebase,
 * supporting both ESM and CommonJS module formats.
 */

// Import error handling utilities
import { SystemError, ErrorCode } from '../zkErrorHandler.mjs';
import { zkErrorLogger } from '../zkErrorLogger.mjs';

/**
 * StandardizedModule provides a template for module exports that work in both ESM and CJS
 * 
 * @template T
 * @param {T} moduleExports - Primary module exports to standardize
 * @param {Object} options - Options for the standardized module
 * @param {string} options.name - Module name for error messages and debugging
 * @param {Object<string, any>} [options.namedExports] - Named exports to include
 * @param {any} [options.defaultExport] - Default export (if different from moduleExports)
 * @returns {T & {__esModule: boolean}} Standardized module object
 */
function StandardizedModule(moduleExports, options = {}) {
  const { name, namedExports = {}, defaultExport } = options;

  // Create base object with __esModule flag for interop
  const standardized = {
    ...moduleExports,
    __esModule: true
  };

  // Add named exports individually
  for (const [key, value] of Object.entries(namedExports)) {
    if (!(key in standardized)) {
      standardized[key] = value;
    }
  }

  // Handle default export
  if (defaultExport !== undefined) {
    standardized.default = defaultExport;
  } else if (!('default' in standardized)) {
    standardized.default = moduleExports;
  }

  return standardized;
}

/**
 * Create a standardized export for ESM modules
 * 
 * @param {Object} namedExports - Named exports as key-value pairs
 * @param {any} [defaultExport] - Default export value
 * @returns {Object} Standardized exports object for ESM
 */
function createESMExports(namedExports, defaultExport) {
  return {
    ...namedExports,
    default: defaultExport || namedExports
  };
}

/**
 * Create module exports object that works in both ESM and CJS
 * 
 * @param {Object} namedExports - Named exports as key-value pairs
 * @param {any} [defaultExport] - Default export value
 * @param {string} [name] - Module name for debugging
 * @returns {Object} - Standardized exports object
 */
function createDualExports(namedExports, defaultExport, name = 'unnamed-module') {
  // Create object with all named exports
  const exports = { ...namedExports };

  // Set default export
  const mainExport = defaultExport || exports;
  exports.default = mainExport;

  // For CJS compatibility
  Object.defineProperty(exports, '__esModule', { value: true });

  // Support both require() and import * styles
  Object.keys(exports).forEach(key => {
    if (key !== 'default') {
      Object.defineProperty(mainExport, key, {
        enumerable: true,
        get: () => exports[key]
      });
    }
  });

  return exports;
}

/**
 * Define a module that works in both ESM and CJS environments
 * 
 * @param {Function} defineModule - Function that returns module exports
 * @param {Object} [options] - Module options
 * @param {string} [options.name] - Module name
 * @param {boolean} [options.esmOnly] - Whether to optimize for ESM only
 * @returns {Object} Standardized module exports
 */
function defineUniversalModule(defineModule, options = {}) {
  const { name = 'unnamed-module', esmOnly = false } = options;

  const operationId = `defineModule_${Date.now()}`;

  try {
    const exports = defineModule();

    if (esmOnly) {
      return exports;
    }

    // Handle different export types
    if (typeof exports === 'function') {
      // Function export - make it the default
      return StandardizedModule(exports, {
        name,
        defaultExport: exports
      });
    } else if (typeof exports === 'object' && exports !== null) {
      // Object exports - preserve all exports with default
      const hasDefault = 'default' in exports;
      return StandardizedModule(exports, {
        name,
        defaultExport: hasDefault ? exports.default : exports
      });
    } else {
      // Primitive value - make it the default
      return StandardizedModule({}, {
        name,
        defaultExport: exports
      });
    }
  } catch (error) {
    // Create a proper error with all details
    const moduleError = new SystemError(`Error defining module ${name}: ${error.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      operationId,
      recoverable: false,
      details: {
        moduleName: name,
        originalError: error.message,
        errorStack: error.stack
      }
    });
    
    // Log the error properly
    zkErrorLogger.logError(moduleError, { 
      context: 'ModuleStandardizer.defineUniversalModule',
      module: name
    });
    
    // Rethrow with proper error
    throw moduleError;
  }
}

/**
 * Create standardized module exports for a class
 * 
 * @param {Function} ClassConstructor - Class to export
 * @param {Object} [options] - Export options 
 * @param {string} [options.name] - Class name
 * @param {Object<string, any>} [options.extraExports] - Additional named exports
 * @returns {Object} Standardized module exports
 */
function createClassExports(ClassConstructor, options = {}) {
  const { name = ClassConstructor.name, extraExports = {} } = options;

  // Create singleton instance if class has getInstance static method
  const instance = typeof ClassConstructor.getInstance === 'function'
    ? ClassConstructor.getInstance()
    : null;

  // Named exports include the class and optional instance
  const namedExports = {
    [name]: ClassConstructor,
    ...extraExports
  };

  // If there's an instance, add it to named exports
  if (instance) {
    const instanceName = name.charAt(0).toLowerCase() + name.slice(1);
    namedExports[instanceName] = instance;
  }

  // Default export is instance if available, otherwise the class
  const defaultExport = instance || ClassConstructor;

  return createDualExports(namedExports, defaultExport, name);
}

/**
 * Convert CJS module to standardized exports
 * 
 * @param {any} module - CommonJS module
 * @param {Object} [options] - Export options
 * @param {string} [options.name] - Module name
 * @param {Object<string, any>} [options.namedExports] - Additional named exports
 * @returns {Object} Standardized module exports
 */
function convertCJSModule(module, options = {}) {
  const { name = 'cjs-module', namedExports = {} } = options;

  if (typeof module !== 'object' || module === null) {
    return StandardizedModule({}, {
      name,
      namedExports,
      defaultExport: module
    });
  }

  // Combine module exports with additional named exports
  const exports = { ...module, ...namedExports };

  return StandardizedModule(exports, {
    name,
    defaultExport: module
  });
}

export {
  StandardizedModule,
  createESMExports,
  createDualExports,
  defineUniversalModule,
  createClassExports,
  convertCJSModule
};

/**
 * Default export for the ModuleStandardizer utility.
 * Provides all module standardization functions as a single object.
 * This allows for convenient default imports while maintaining named export access.
 * 
 * @type {Object}
 * @property {Function} StandardizedModule - Creates a standardized module object that works in both ESM and CJS
 * @property {Function} createESMExports - Creates standardized exports for ESM modules
 * @property {Function} createDualExports - Creates module exports that work in both ESM and CJS
 * @property {Function} defineUniversalModule - Defines a module that works in both ESM and CJS environments
 * @property {Function} createClassExports - Creates standardized module exports for a class
 * @property {Function} convertCJSModule - Converts a CommonJS module to standardized exports
 */
export default {
  StandardizedModule,
  createESMExports,
  createDualExports,
  defineUniversalModule,
  createClassExports,
  convertCJSModule
};