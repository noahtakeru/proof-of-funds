/**
 * Error Logger Pre-initialization
 * 
 * This file is intended to be imported as early as possible in application
 * startup process to ensure error logger is initialized before being used
 * anywhere in the codebase. Import it at the entry points of the application.
 */

import { safeLogger } from './initializeErrorLogger.js';
import { initializeErrorLogger } from './zkErrorHandler.mjs';

// Initialize error logger and configure it
try {
  // Initialize the error handler with our global safe logger instance
  initializeErrorLogger(safeLogger);
  
  // Log successful initialization
  safeLogger.info('ZK Error logger pre-initialized successfully', {
    context: 'error-handling/preInitialize',
    timestamp: new Date().toISOString()
  });
} catch (error) {
  // If initialization fails, log to console
  console.warn('Failed to pre-initialize ZK error logger:', error);
}

// Export the safe logger for immediate use
export { safeLogger };

// Default export for non-ES module environments
export default safeLogger;