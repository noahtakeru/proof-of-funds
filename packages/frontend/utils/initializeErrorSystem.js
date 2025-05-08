/**
 * Initializes the error logging system for the application
 * This ensures proper error tracking and reporting throughout the app
 */
import { getErrorLogger } from '@proof-of-funds/common/error-handling';

/**
 * Initialize the error logging system with the specified configuration
 * @param {Object} options - Configuration options
 * @param {string} options.logLevel - Minimum log level to record ('debug', 'info', 'warn', 'error', 'critical')
 * @param {string} options.logDestination - Where to send logs ('console', 'server', 'storage')
 * @param {boolean} options.developerMode - Whether to enable additional debug information
 * @returns {Object} The initialized logger instance
 */
export function initializeErrorSystem(options = {}) {
  const { 
    logLevel = process.env.NODE_ENV === 'production' ? 'error' : 'debug',
    logDestination = 'console',
    developerMode = process.env.NODE_ENV !== 'production'
  } = options;
  
  // Initialize the root logger
  const rootLogger = getErrorLogger('ApplicationRoot');
  
  // Configure log level
  rootLogger.updateConfig({ 
    logLevel,
    developerMode,
    destinations: [logDestination]
  });
  
  // Configure server-side logging if needed
  if (logDestination === 'server') {
    rootLogger.setLogDestination('/api/logs');
  }
  
  console.log(`Error logging system initialized with level: ${logLevel}`);
  return rootLogger;
}