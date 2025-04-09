/**
 * Module Loader Helper for ESM and CommonJS compatibility
 * 
 * This module provides helper functions to dynamically load modules
 * in both ESM and CommonJS environments, providing a consistent API
 * regardless of the module format.
 */

// Check if we're in a CommonJS environment
const isCommonJS = typeof module !== 'undefined' && module.exports;

/**
 * Dynamically load a module in either ESM or CommonJS format
 * 
 * @param {string} esmPath - Path to the ESM module
 * @param {string} cjsPath - Path to the CommonJS module
 * @returns {Promise<Object>} - The loaded module
 */
async function loadModule(esmPath, cjsPath) {
  if (isCommonJS) {
    try {
      return require(cjsPath);
    } catch (error) {
      console.error(`Failed to load CommonJS module ${cjsPath}:`, error.message);
      throw error;
    }
  } else {
    try {
      return await import(esmPath);
    } catch (error) {
      console.error(`Failed to load ESM module ${esmPath}:`, error.message);
      throw error;
    }
  }
}

// Export in the appropriate format
if (isCommonJS) {
  module.exports = {
    loadModule,
    isCommonJS
  };
} else {
  export {
    loadModule,
    isCommonJS
  };
}