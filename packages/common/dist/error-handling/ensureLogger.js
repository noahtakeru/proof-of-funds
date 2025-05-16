/**
 * Error Logger Helper
 * 
 * This file provides a robust utility to get the error logger
 * with guaranteed initialization, following the token agnostic 
 * wallet scanning plan rules.
 */

import { safeLogger } from './initializeErrorLogger.js';
import { initializeErrorLogger as initErrorLogger } from './zkErrorHandler.mjs';

// A simple utility to get the guaranteed logger instance
export function getLogger() {
  // Try to initialize the error logger with our safe logger if it hasn't been done yet
  try {
    initErrorLogger(safeLogger);
  } catch (error) {
    // Ignore errors, our safeLogger will still work as a fallback
  }
  
  // Return the safeLogger which is always available
  return safeLogger;
}

// A utility to safely log errors without requiring explicit logger initialization
export function logSafeError(error, context = {}) {
  try {
    // Get the guaranteed logger
    const logger = getLogger();
    
    // Log the error
    return logger.logError(error, context);
  } catch (loggingError) {
    // Last resort fallback to console
    console.error('[Safe Error Logging]', error?.message || String(error), context);
    console.error('Additionally, error occurred during logging:', loggingError);
    
    // Return a minimal operation ID
    return { operationId: `fallback_${Date.now()}` };
  }
}

// Export singleton instance for direct use
export const zkErrorLoggerGuaranteed = safeLogger;

// Default export for compatibility
export default {
  getLogger,
  logSafeError,
  zkErrorLoggerGuaranteed
};