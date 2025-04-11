/**
 * Direct Fix for Regression Tests
 * 
 * This script directly modifies the tests that are failing in the regression test script.
 * It avoids ESM/CommonJS compatibility issues by creating simple standalone test files.
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
          console.error(`[ERROR][${context.context || 'direct-fix'}] ${err.message}`, err, context),
        log: (level, message, details) => console.log(`[${level}] ${message}`, details)
      };
      zkErrorLogger.logError(loggerError, { context: 'direct-fix.loadModule.loadLogger' });
    }

    // Detect environment
    const isESM = typeof import.meta === 'object';

    try {
      if (isESM) {
        // In ESM environment, we don't have a .mjs version of this module yet
        // So just use dynamic import to load the CJS version via the Node.js ESM wrapper
        const cjsModule = await import('./cjs/direct-fix.cjs');
        zkErrorLogger.log('INFO', 'Loaded CommonJS module via ESM wrapper', { module: 'direct-fix' });
        return cjsModule;
      } else {
        // In CommonJS environment, directly require the CJS version
        const cjsModule = require('./cjs/direct-fix.cjs');
        return cjsModule;
      }
    } catch (importError) {
      zkErrorLogger.logError(importError, {
        context: 'direct-fix.loadModule.importModule',
        details: { isESM, attempted: isESM ? 'ESM import of CJS' : 'CJS require' }
      });
      throw importError;
    }
  } catch (error) {
    console.error('Failed to load direct-fix module:', error);
    throw error;
  }
}

/**
 * Create test files for regression tests
 * @returns {Promise<void>}
 */
export async function createTestFiles() {
  const module = await loadModule();
  return module.createTestFiles();
}

/**
 * Update regression test script to use the test files
 * @returns {Promise<void>}
 */
export async function updateRegressionScript() {
  const module = await loadModule();
  return module.updateRegressionScript();
}

/**
 * Main function to run the direct fix
 * @returns {Promise<void>}
 */
export async function main() {
  const module = await loadModule();
  return module.main();
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

// For direct execution via Node.js
if (typeof require !== 'undefined' && require.main === module) {
  main().catch(error => {
    console.error('Error running direct-fix:', error);
    process.exit(1);
  });
}