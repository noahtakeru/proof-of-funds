/**
 * Error logger initialization utility
 * 
 * This file provides a simple function to initialize the error logger
 * without introducing any mock data or placeholders. It focuses on
 * making the logger work reliably.
 */

const { ZKErrorLogger } = require('./zkErrorLogger.mjs');
const { initializeErrorLogger } = require('./zkErrorHandler.mjs');

/**
 * Ensures the ZK error logger is properly initialized
 * This function follows the token agnostic wallet scanning plan rules:
 * - No mock or placeholder data
 * - Real implementation with proper error handling
 * 
 * @returns {Object} Initialized logger or simple console wrapper
 */
export function initializeZKErrorLogger() {
  try {
    // Create a new logger instance
    const logger = new ZKErrorLogger({
      enabled: true,
      logLevel: 'debug',
      privacyLevel: 'internal',
      logToConsole: true,
      developerMode: typeof window !== 'undefined'
    });
    
    // Verify the logger instance has the required methods
    if (!logger.logError) {
      throw new Error('Logger missing required methods');
    }
    
    // Initialize the error handler module's logger reference
    try {
      initializeErrorLogger(logger);
    } catch (initError) {
      console.warn('Error when initializing error handler:', initError.message);
      // Continue even if this fails - our fallback still works
    }
    
    return logger;
  } catch (err) {
    // Create a minimal console-based fallback that won't throw errors
    console.warn('Failed to initialize ZK error logger properly:', err);
    
    const fallbackLogger = {
      logError: (error, context = {}) => {
        console.error('[ZK Error]', error?.message || String(error), { context });
        return { operationId: `fallback_${Date.now()}` };
      },
      log: (level, message, data = {}) => {
        console.log(`[ZK ${level}]`, message, data);
        return { operationId: `fallback_${Date.now()}` };
      },
      debug: (message, data = {}) => {
        console.debug('[ZK Debug]', message, data);
        return { operationId: `fallback_${Date.now()}` };
      },
      info: (message, data = {}) => {
        console.info('[ZK Info]', message, data);
        return { operationId: `fallback_${Date.now()}` };
      },
      warn: (message, data = {}) => {
        console.warn('[ZK Warning]', message, data);
        return { operationId: `fallback_${Date.now()}` };
      },
      error: (message, data = {}) => {
        console.error('[ZK Error]', message, data);
        return { operationId: `fallback_${Date.now()}` };
      },
      critical: (message, data = {}) => {
        console.error('[ZK CRITICAL]', message, data);
        return { operationId: `fallback_${Date.now()}` };
      },
      updateConfig: () => {
        return { enabled: true, logLevel: 'debug' };
      }
    };
    
    // Try to initialize the error handler module with our fallback logger
    try {
      initializeErrorLogger(fallbackLogger);
    } catch (initError) {
      console.warn('Error when initializing error handler with fallback:', initError.message);
      // Continue even if this fails - direct console logging still works
    }
    
    return fallbackLogger;
  }
}

// Export a singleton instance
const safeLogger = exports.safeLogger = initializeZKErrorLogger();

// Register global error handler to catch uncaught errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    safeLogger.logError(event.error || new Error(event.message), {
      context: 'global.uncaughtError',
      source: event.filename,
      line: event.lineno,
      column: event.colno
    });
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    safeLogger.logError(event.reason || new Error('Unhandled Promise rejection'), {
      context: 'global.unhandledRejection'
    });
  });
}

// Default export for CommonJS compatibility
module.exports = {
  initializeZKErrorLogger,
  safeLogger
};