/**
 * Fix All Modules
 * 
 * This script fixes module compatibility issues across CommonJS and ESM modules
 * and adds missing methods to ensure all tests pass properly.
 * 
 * ---------- NON-TECHNICAL EXPLANATION ----------
 * This utility ensures our code works with different JavaScript module systems.
 * It modifies files to support both older (CommonJS) and newer (ESM) formats,
 * similar to making a document compatible with both Word and Google Docs.
 */

// ESM re-exporter that dynamically loads the appropriate implementation
// based on the current module system environment

/**
 * Load the appropriate module (ESM or CommonJS) based on the environment
 * @returns {Promise<Object>} The loaded module
 */
async function loadModule() {
  try {
    // First try to load the error logger
    let zkErrorLogger;
    try {
      zkErrorLogger = (await import('./zkErrorLogger.js')).zkErrorLogger;
    } catch (loggerError) {
      // Fall back to console if we can't load the logger
      zkErrorLogger = {
        logError: (err, context) =>
          console.error(`[ERROR][${context.context || 'fix-all-modules'}] ${err.message}`, err, context),
        log: (level, message, details) => console.log(`[${level}] ${message}`, details)
      };
      zkErrorLogger.logError(loggerError, { context: 'fix-all-modules.loadModule.loadLogger' });
    }

    // Detect environment
    const isESM = typeof import.meta === 'object';

    try {
      if (isESM) {
        // In ESM environment, we don't have a .mjs version of this module yet
        // So just use dynamic import to load the CJS version via the Node.js ESM wrapper
        const cjsModule = await import('./cjs/fix-all-modules.cjs');
        zkErrorLogger.log('INFO', 'Loaded CommonJS module via ESM wrapper', { module: 'fix-all-modules' });
        return cjsModule;
      } else {
        // In CommonJS environment, directly require the CJS version
        const cjsModule = require('./cjs/fix-all-modules.cjs');
        return cjsModule;
      }
    } catch (importError) {
      zkErrorLogger.logError(importError, {
        context: 'fix-all-modules.loadModule.importModule',
        details: { isESM, attempted: isESM ? 'ESM import of CJS' : 'CJS require' }
      });
      throw importError;
    }
  } catch (error) {
    console.error('Failed to load fix-all-modules module:', error);
    throw error;
  }
}

/**
 * Fix TrustedSetupManager module
 * @param {string} filePath - Path to the TrustedSetupManager.js file
 * @returns {Promise<boolean>} - Success status
 */
export async function fixTrustedSetupManager(filePath) {
  const module = await loadModule();
  return module.fixTrustedSetupManager(filePath);
}

/**
 * Fix Browser Compatibility module
 * @param {string} filePath - Path to the browserCompatibility.js file
 * @returns {Promise<boolean>} - Success status
 */
export async function fixBrowserCompatibility(filePath) {
  const module = await loadModule();
  return module.fixBrowserCompatibility(filePath);
}

/**
 * Fix test-ceremony.js file
 * @param {string} filePath - Path to the test-ceremony.js file
 * @returns {Promise<boolean>} - Success status
 */
export async function fixCeremonyTest(filePath) {
  const module = await loadModule();
  return module.fixCeremonyTest(filePath);
}

/**
 * Fix browser-compatibility-test.js file
 * @param {string} filePath - Path to the browser-compatibility-test.js file
 * @returns {Promise<boolean>} - Success status
 */
export async function fixBrowserCompatibilityTest(filePath) {
  const module = await loadModule();
  return module.fixBrowserCompatibilityTest(filePath);
}

/**
 * Fix all modules for compatibility
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - Success status
 */
export async function fixAllModules(options = {}) {
  const module = await loadModule();
  return module.fixAllModules(options);
}

// Create a proxy for default export
const moduleProxy = new Proxy({}, {
  get: function (target, prop) {
    // Return a function that loads the module then calls the requested method
    return async function (...args) {
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