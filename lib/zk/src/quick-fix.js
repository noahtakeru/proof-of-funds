/**
 * Quick Fix for Module Format Issues
 * 
 * This is a re-exporter that dynamically loads the appropriate module
 * implementation (ESM or CommonJS) based on the environment.
 * 
 * ---------- NON-TECHNICAL EXPLANATION ----------
 * This utility applies quick fixes to resolve JavaScript module compatibility issues.
 * It's like a translation tool that helps files written in one format (ESM) 
 * work with files written in another format (CommonJS), similar to how a 
 * document translator might help a Spanish document work in an English system.
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
    // First try to load the error logger
    let zkErrorLogger;
    try {
      zkErrorLogger = (await import('./zkErrorLogger.js')).zkErrorLogger;
    } catch (loggerError) {
      // Fall back to console if we can't load the logger
      zkErrorLogger = {
        logError: (err, context) => console.error(`[ERROR][${context.context || 'quick-fix'}] ${err.message}`, err, context),
        log: (level, message, details) => console.log(`[${level}] ${message}`, details)
      };
      zkErrorLogger.logError(loggerError, { context: 'quick-fix.loadModule.loadLogger' });
    }

    if (isEsm) {
      // For ESM environment, use the CJS implementation through the adapter
      const module = await import('./cjs/quick-fix.cjs');
      moduleInstance = {
        applyQuickFix: async (...args) => module.applyQuickFix(...args),
        createCommonJSTestFiles: async (...args) => module.createCommonJSTestFiles(...args),
        QuickFixError: module.QuickFixError
      };
      
      zkErrorLogger.log('INFO', 'Successfully loaded quick-fix.cjs module', {
        context: 'quick-fix.loadModule',
        details: { moduleType: 'CommonJS' }
      });
    } else {
      // This branch should never execute in an ESM file, but we include it for completeness
      moduleInstance = require('./cjs/quick-fix.cjs');
      
      zkErrorLogger.log('INFO', 'Successfully loaded quick-fix.cjs module via require', {
        context: 'quick-fix.loadModule',
        details: { moduleType: 'CommonJS' }
      });
    }
    
    return moduleInstance;
  } catch (error) {
    // Try to load error logger again in case it wasn't loaded in the first try/catch
    try {
      const { zkErrorLogger } = await import('./zkErrorLogger.js');
      zkErrorLogger.logError(error, { 
        context: 'quick-fix.loadModule',
        details: { isEsm }
      });
    } catch (loggerError) {
      // Last resort: log to console if we can't load the error logger
      console.error('[quick-fix] Error loading module:', error);
      console.error('[quick-fix] Also failed to load error logger:', loggerError);
    }
    
    // Return a minimal implementation with stub functions
    return {
      applyQuickFix: async () => false,
      createCommonJSTestFiles: async () => false,
      QuickFixError: class QuickFixError extends Error {
        constructor(message) {
          super(message);
          this.name = 'QuickFixError';
        }
      }
    };
  }
}

/**
 * Function to apply quick fixes programmatically
 * @param {Array<Object>} filesToFix - List of files to fix with their replacements
 * @returns {Promise<boolean>} - Success status
 */
export async function applyQuickFix(filesToFix) {
  const module = await loadModule();
  return module.applyQuickFix(filesToFix);
}

/**
 * Create CommonJS versions of ESM test files
 * @param {Array<Object>} testFilesToConvert - List of test files to convert
 * @returns {Promise<boolean>} - Success status
 */
export async function createCommonJSTestFiles(testFilesToConvert) {
  const module = await loadModule();
  return module.createCommonJSTestFiles(testFilesToConvert);
}

/**
 * QuickFixError class for error handling
 */
export class QuickFixError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'QuickFixError';
    this.code = options.code || 'SYSTEM_FEATURE_UNSUPPORTED';
    this.severity = options.severity || 'ERROR';
    this.recoverable = options.recoverable !== undefined ? options.recoverable : true;
    this.operationId = options.operationId || `quick_fix_${Date.now()}`;
    this.details = {
      ...(options.details || {}),
      component: 'QuickFixer',
    };
  }
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

// Run the main function if this module is being executed directly
if (isEsm && import.meta.url === `file://${process.argv[1]}`) {
  loadModule().then(async module => {
    try {
      // First try to load the error logger
      let zkErrorLogger;
      try {
        zkErrorLogger = (await import('./zkErrorLogger.js')).zkErrorLogger;
      } catch (loggerError) {
        // Fall back to console if we can't load the logger
        zkErrorLogger = {
          logError: (err, context) => console.error(`[ERROR][${context.context || 'quick-fix'}] ${err.message}`, err, context),
          log: (level, message, details) => console.log(`[${level}] ${message}`, details)
        };
        zkErrorLogger.logError(loggerError, { context: 'quick-fix.mainExecution.loadLogger' });
      }
  
      if (module.main) {
        await module.main().catch(error => {
          zkErrorLogger.logError(error, { context: 'quick-fix.mainExecution.runMain' });
        });
      } else {
        zkErrorLogger.log('WARNING', 'Main function not found in loaded module', {
          context: 'quick-fix.mainExecution',
          details: { moduleKeys: Object.keys(module) }
        });
      }
    } catch (error) {
      // Try to log with error logger if we can
      try {
        const { zkErrorLogger } = await import('./zkErrorLogger.js');
        zkErrorLogger.logError(error, { context: 'quick-fix.mainExecution' });
      } catch (loggerError) {
        // Last resort fallback to console
        console.error('[quick-fix] Error during main execution:', error);
        console.error('[quick-fix] Also failed to load error logger:', loggerError);
      }
    }
  }).catch(async error => {
    // Try to log with error logger if we can
    try {
      const { zkErrorLogger } = await import('./zkErrorLogger.js');
      zkErrorLogger.logError(error, { context: 'quick-fix.mainExecution.loadModule' });
    } catch (loggerError) {
      // Last resort fallback to console
      console.error('[quick-fix] Error loading module for main execution:', error);
      console.error('[quick-fix] Also failed to load error logger:', loggerError);
    }
  });
}