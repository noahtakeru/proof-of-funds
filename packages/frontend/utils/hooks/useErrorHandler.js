/**
 * React hook for handling errors in components
 */
import { useCallback } from 'react';
import { getErrorLogger } from '@proof-of-funds/common/error-handling';

/**
 * Hook for consistent error handling within React components
 * @param {string} componentName - Name of the component using this hook
 * @param {Object} options - Additional options for error handling
 * @returns {Function} Error handler function
 */
export function useErrorHandler(componentName, options = {}) {
  const {
    notifyUser = true,
    logLevel = 'error',
    reportToAnalytics = true
  } = options;
  
  const logger = getErrorLogger(componentName);
  
  const handleError = useCallback((error, operation = 'unknown') => {
    // Log the error with component context
    logger.log({
      level: logLevel,
      message: `Error in ${componentName} during ${operation}`,
      error,
      context: {
        component: componentName,
        operation,
        ...options
      }
    });
    
    // Report to analytics if configured
    if (reportToAnalytics) {
      try {
        // Using dynamic import to avoid client/server mismatch issues
        import('@proof-of-funds/common/analytics').then(({ reportError }) => {
          reportError(error, {
            component: componentName,
            operation,
          });
        });
      } catch (analyticsError) {
        // Silently fail if analytics module fails
        console.error('Failed to report error to analytics', analyticsError);
      }
    }
    
    // Return standardized error message for user display
    return {
      message: notifyUser ? getUserFriendlyMessage(error) : null,
      error: error,
      success: false
    };
  }, [componentName, logLevel, notifyUser, reportToAnalytics, logger]);
  
  return handleError;
}

/**
 * Convert technical errors into user-friendly messages
 * @param {Error} error - The error object
 * @returns {string} User-friendly error message
 */
function getUserFriendlyMessage(error) {
  // Handle specific error types
  if (error.name === 'WalletConnectionError') {
    return 'Failed to connect to your wallet. Please check your wallet is unlocked and try again.';
  }
  
  if (error.name === 'ZKProofError') {
    return 'There was an issue generating the proof. Please try again.';
  }
  
  if (error.name === 'NetworkError' || error.message.includes('network')) {
    return 'Network error. Please check your internet connection and try again.';
  }
  
  // Default generic message
  return 'An unexpected error occurred. Please try again later.';
}