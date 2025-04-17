/**
 * @fileoverview ESM-only Module Standardizer
 * 
 * This utility helps standardize module exports in ESM format.
 * Provides functions to create consistent module exports with metadata.
 * 
 * @module utils/ModuleStandardizer
 * @pure-esm true
 */

// Import error handling utilities
import { SystemError, ErrorCode } from '../zkErrorHandler.mjs';
import { zkErrorLogger } from '../zkErrorLogger.mjs';

/**
 * Creates a standardized module object with metadata
 * @template T
 * @param {T} moduleExports - Primary module exports to standardize
 * @param {Object} options - Options for the standardized module
 * @param {string} options.name - Module name for error messages and debugging
 * @param {Object<string, any>} [options.namedExports] - Named exports to include
 * @param {any} [options.defaultExport] - Default export (if different from moduleExports)
 * @returns {T & {__moduleFormat: string}} Standardized module object
 */
export function StandardizedModule(moduleExports, options = {}) {
  try {
    logDebug('Creating standardized module', {
      context: 'ModuleStandardizer.StandardizedModule',
      moduleName: options.name || 'unnamed-module'
    });
    
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
  } catch (error) {
    logError('Error creating standardized module', {
      context: 'ModuleStandardizer.StandardizedModule',
      error: error.message,
      options
    });
    throw error;
  }
}

/**
 * Create standardized exports for ESM modules
 * @param {Object} namedExports - Named exports as key-value pairs
 * @param {any} [defaultExport] - Default export value
 * @returns {Object} Standardized exports object for ESM
 */
export function createESMExports(namedExports, defaultExport) {
  try {
    logDebug('Creating ESM exports', {
      context: 'ModuleStandardizer.createESMExports'
    });
    
    return {
      ...namedExports,
      default: defaultExport || namedExports
    };
  } catch (error) {
    logError('Error creating ESM exports', {
      context: 'ModuleStandardizer.createESMExports',
      error: error.message
    });
    throw error;
  }
}

/**
 * Create module exports object for ESM
 * @param {Object} namedExports - Named exports as key-value pairs
 * @param {any} [defaultExport] - Default export value
 * @param {string} [name] - Module name for debugging
 * @returns {Object} - Standardized exports object
 */
export function createDualExports(namedExports, defaultExport, name = 'unnamed-module') {
  try {
    logDebug('Creating dual exports', {
      context: 'ModuleStandardizer.createDualExports',
      moduleName: name
    });
    
    // Create a new object with the named exports
    const moduleObj = { ...namedExports };

    // Set the default export
    const mainExport = defaultExport || moduleObj;
    moduleObj.default = mainExport;

    // Add metadata for module type detection
    moduleObj.__moduleFormat = 'esm';
    moduleObj.__moduleName = name;

    // Copy named exports to default export for convenience
    if (typeof mainExport === 'object' && mainExport !== null) {
      Object.keys(namedExports).forEach(key => {
        if (key !== 'default' && !(key in mainExport)) {
          // Use a regular property assignment
          mainExport[key] = namedExports[key];
        }
      });
    }

    return moduleObj;
  } catch (error) {
    logError('Error creating dual exports', {
      context: 'ModuleStandardizer.createDualExports',
      error: error.message,
      name
    });
    throw error;
  }
}

/**
 * Define a module with standard format
 * @param {Function} defineModule - Function that returns module exports
 * @param {Object} [options] - Module options
 * @param {string} [options.name] - Module name
 * @returns {Object} Standardized module exports
 */
export function defineUniversalModule(defineModule, options = {}) {
  const { name = 'unnamed-module' } = options;
  const operationId = `defineModule_${Date.now()}`;

  try {
    logDebug('Defining universal module', {
      context: 'ModuleStandardizer.defineUniversalModule',
      moduleName: name
    });
    
    const moduleContent = defineModule();

    // Handle different export types
    if (typeof moduleContent === 'function') {
      // Function export - make it the default
      return StandardizedModule(moduleContent, {
        name,
        defaultExport: moduleContent
      });
    } else if (typeof moduleContent === 'object' && moduleContent !== null) {
      // Object exports - preserve all exports with default
      const hasDefault = 'default' in moduleContent;
      return StandardizedModule(moduleContent, {
        name,
        defaultExport: hasDefault ? moduleContent.default : moduleContent
      });
    } else {
      // Primitive value - make it the default
      return StandardizedModule({}, {
        name,
        defaultExport: moduleContent
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
    logError('Module definition error', {
      context: 'ModuleStandardizer.defineUniversalModule',
      module: name,
      error: moduleError
    });

    // Rethrow with proper error
    throw moduleError;
  }
}

/**
 * Create standardized module exports for a class
 * @param {Function} ClassConstructor - Class to export
 * @param {Object} [options] - Export options 
 * @param {string} [options.name] - Class name
 * @param {Object<string, any>} [options.extraExports] - Additional named exports
 * @returns {Object} Standardized module exports
 */
export function createClassExports(ClassConstructor, options = {}) {
  try {
    const className = options?.name || ClassConstructor?.name || 'unknown';
    
    logDebug('Creating class exports', {
      context: 'ModuleStandardizer.createClassExports',
      className
    });
    
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
  } catch (error) {
    logError('Error creating class exports', {
      context: 'ModuleStandardizer.createClassExports',
      className: options?.name || ClassConstructor?.name || 'unknown',
      error: error.message
    });
    throw error;
  }
}

/**
 * Converts imported module to standardized exports format
 * @param {any} module - Imported module
 * @param {Object} [options] - Export options
 * @param {string} [options.name] - Module name
 * @param {Object<string, any>} [options.namedExports] - Additional named exports
 * @returns {Object} Standardized module exports
 */
export function convertModule(module, options = {}) {
  try {
    const moduleName = options?.name || 'imported-module';
    
    logDebug('Converting module', {
      context: 'ModuleStandardizer.convertModule',
      moduleName
    });
    
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
  } catch (error) {
    logError('Error converting module', {
      context: 'ModuleStandardizer.convertModule',
      name: options?.name || 'imported-module',
      error: error.message
    });
    throw error;
  }
}

// Helper functions for logging
const logDebug = zkErrorLogger.debug.bind(zkErrorLogger);
const logError = zkErrorLogger.log.bind(zkErrorLogger, 'error');

/**
 * Default export providing all module standardization functions
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