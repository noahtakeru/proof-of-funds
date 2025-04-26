/**
 * ESM Module Format Standardizer
 * 
 * This module is a re-exporter that dynamically loads the appropriate
 * implementation (ESM or CommonJS) based on the environment.
 * 
 * It converts the codebase to use ESM format consistently and creates
 * necessary CJS compatibility layers for backwards compatibility.
 * The approach is "ESM-first" - we standardize on ESM and provide CJS support.
 * 
 * ---------- NON-TECHNICAL EXPLANATION ----------
 * This tool standardizes our code to use modern JavaScript formats (ESM) while
 * maintaining compatibility with older JavaScript systems (CommonJS).
 * Rather than having dual-format modules, we have a clean ESM implementation 
 * and generate CommonJS compatibility versions when needed.
 */

// Determine if we're in an ESM environment
const isEsm = typeof import.meta === 'object';

// Reference to our lazily loaded module instance
let moduleInstance = null;

/**
 * Dynamically loads the appropriate module implementation based on environment
 * @returns {Promise<Object>} The loaded module
 */
async function loadModule() {
  if (moduleInstance) {
    return moduleInstance;
  }
  
  try {
    // Load the appropriate error handling modules first
    let zkErrorLogger, ErrorCode, isZKError;
    
    if (isEsm) {
      // ESM environment - use dynamic imports
      const errorHandlerModule = await import('./zkErrorHandler.js');
      const errorLoggerModule = await import('./zkErrorLogger.js');
      
      ErrorCode = errorHandlerModule.ErrorCode;
      isZKError = errorHandlerModule.isZKError;
      zkErrorLogger = errorLoggerModule.zkErrorLogger;
    } else {
      // CommonJS environment - use require
      // This branch should never execute in an ESM file, but we include it for completeness
      const errorHandlerModule = require('./zkErrorHandler.js');
      const errorLoggerModule = require('./zkErrorLogger.js');
      
      ErrorCode = errorHandlerModule.ErrorCode;
      isZKError = errorHandlerModule.isZKError;
      zkErrorLogger = errorLoggerModule.zkErrorLogger;
    }
    
    // Now load the actual module implementation
    if (isEsm) {
      // Use dynamic import for the ESM version - import the named exports
      const {
        convertToESM: esmConvertToESM,
        updateImportPaths: esmUpdateImportPaths,
        buildCJSCompatibilityVersions: esmBuildCJSCompatibilityVersions,
        standardizeModules: esmStandardizeModules,
        ModuleFormatError: esmModuleFormatError
      } = await import('./fix-module-formats.mjs');
      
      // Create our own object with the imported functions
      moduleInstance = {
        convertToESM: esmConvertToESM,
        updateImportPaths: esmUpdateImportPaths,
        buildCJSCompatibilityVersions: esmBuildCJSCompatibilityVersions,
        standardizeModules: esmStandardizeModules,
        ModuleFormatError: esmModuleFormatError
      };
    } else {
      // This branch should never execute in an ESM file, but we include it for completeness
      moduleInstance = require('./cjs/fix-module-formats.cjs');
    }
    
    return moduleInstance;
  } catch (error) {
    // Basic error handling if we can't even load the error modules
    console.error('[fix-module-formats] Error loading module:', error);
    
    // Attempt to load a fallback error logger
    try {
      if (isEsm) {
        const { zkErrorLogger } = await import('./zkErrorLogger.js');
        zkErrorLogger.logError(error, {
          context: 'fix-module-formats.loadModule',
          details: { isEsm }
        });
      }
    } catch (loggerError) {
      console.error('[fix-module-formats] Error loading error logger:', loggerError);
    }
    
    // Return a minimal implementation with stub functions
    return {
      convertToESM: async () => false,
      updateImportPaths: async () => false,
      buildCJSCompatibilityVersions: async () => false,
      standardizeModules: async () => false
    };
  }
}

/**
 * Convert a file from CommonJS to ESM format
 * @param {string} filePath - Path to the file to convert
 * @param {boolean} [renameFile=true] - Whether to rename the file to .mjs
 * @returns {Promise<boolean>} Whether the conversion was successful
 */
export async function convertToESM(filePath, renameFile = true) {
  const module = await loadModule();
  return module.convertToESM(filePath, renameFile);
}

/**
 * Function to build CommonJS compatibility versions using rollup
 * @returns {Promise<boolean>} Whether the build was successful
 */
export async function buildCJSCompatibilityVersions() {
  const module = await loadModule();
  return module.buildCJSCompatibilityVersions();
}

/**
 * Update import paths in modules to use .mjs extensions
 * @param {string} [directory] - Directory to scan (defaults to src directory)
 * @returns {Promise<void>}
 */
export async function updateImportPaths(directory) {
  const module = await loadModule();
  return module.updateImportPaths(directory);
}

/**
 * Main function to run the standardization process
 * @returns {Promise<void>}
 */
export async function standardizeModules() {
  const module = await loadModule();
  return module.standardizeModules();
}

// Create a proxy for default export
const moduleProxy = new Proxy({}, {
  get: function(target, prop) {
    // Return a function that loads the module then calls the requested method
    return async function(...args) {
      const module = await loadModule();
      if (typeof module[prop] === 'function') {
        return module[prop](...args);
      }
      return undefined;
    };
  }
});

// Default export as a proxy to the actual implementation
export default moduleProxy;

// Run the standardization if this file is executed directly
if (isEsm && import.meta.url === `file://${process.argv[1]}`) {
  try {
    standardizeModules().catch(error => {
      console.error('Fatal error during module standardization:', error.message);
      process.exit(1);
    });
  } catch (error) {
    console.error('Fatal error during module standardization:', error.message);
    process.exit(1);
  }
}