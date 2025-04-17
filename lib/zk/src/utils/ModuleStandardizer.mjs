/**
 * Module Standardizer - ESM Version
 * 
 * This utility helps standardize module exports in ESM format.
 * This is a pure ESM implementation with no CommonJS compatibility code.
 */

// Import error handling utilities
import { SystemError, ErrorCode } from '../zkErrorHandler.mjs';
import { zkErrorLogger } from '../zkErrorLogger.mjs';

/**
 * Creates a standardized module object with metadata
 * 
 * @template T
 * @param {T} moduleExports - Primary module exports to standardize
 * @param {Object} options - Options for the standardized module
 * @param {string} options.name - Module name for error messages and debugging
 * @param {Object<string, any>} [options.namedExports] - Named exports to include
 * @param {any} [options.defaultExport] - Default export (if different from moduleExports)
 * @returns {T & {__moduleFormat: string}} Standardized module object
 */
function StandardizedModule(moduleExports, options = {}) {
  const { name, namedExports = {}, defaultExport } = options;

  // Create a clean object with exports
  const standardized = {
    ...moduleExports,
    // Use proper metadata for module format
    __moduleFormat: 'esm',
    __moduleName: name || 'unnamed-module'
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
 * Create standardized exports for ESM modules
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
 * Create module exports object for ESM
 * 
 * @param {Object} namedExports - Named exports as key-value pairs
 * @param {any} [defaultExport] - Default export value
 * @param {string} [name] - Module name for debugging
 * @returns {Object} - Standardized exports object
 */
function createDualExports(namedExports, defaultExport, name = 'unnamed-module') {
  // Create a new object with the named exports
  const exports = { ...namedExports };

  // Set the default export
  const mainExport = defaultExport || exports;
  exports.default = mainExport;

  // Add metadata for module type detection
  exports.__moduleFormat = 'esm';
  exports.__moduleName = name;

  // Copy named exports to default export for convenience
  if (typeof mainExport === 'object' && mainExport !== null) {
    Object.keys(namedExports).forEach(key => {
      if (key !== 'default' && !(key in mainExport)) {
        // Use a regular property assignment
        mainExport[key] = namedExports[key];
      }
    });
  }

  return exports;
}

/**
 * Define a module with standard format
 * 
 * @param {Function} defineModule - Function that returns module exports
 * @param {Object} [options] - Module options
 * @param {string} [options.name] - Module name
 * @returns {Object} Standardized module exports
 */
function defineUniversalModule(defineModule, options = {}) {
  const { name = 'unnamed-module' } = options;
  const operationId = `defineModule_${Date.now()}`;

  try {
    const exports = defineModule();

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
 * Converts imported module to standardized exports format
 * 
 * @param {any} module - Imported module
 * @param {Object} [options] - Export options
 * @param {string} [options.name] - Module name
 * @param {Object<string, any>} [options.namedExports] - Additional named exports
 * @returns {Object} Standardized module exports
 */
function convertModule(module, options = {}) {
  const { name = 'imported-module', namedExports = {} } = options;

  if (typeof module !== 'object' || module === null) {
    return StandardizedModule({}, {
      name,
      namedExports,
      defaultExport: module
    });
  }

  // Create a new object with all named exports and module properties
  const exportsObj = {
    ...module,
    ...namedExports,
    __moduleFormat: 'esm',
    __moduleName: name
  };

  // Set default export
  exportsObj.default = module;

  return exportsObj;
}

// Export all functions
export {
  StandardizedModule,
  createESMExports,
  createDualExports,
  defineUniversalModule,
  createClassExports,
  convertModule
};

/**
 * Default export for the ModuleStandardizer utility.
 * Provides all module standardization functions as a single object.
 * 
 * @type {Object}
 */
export default {
  StandardizedModule,
  createESMExports,
  createDualExports,
  defineUniversalModule,
  createClassExports,
  convertModule
};