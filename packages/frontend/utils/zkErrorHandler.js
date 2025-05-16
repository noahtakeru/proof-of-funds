/**
 * ZK Error Handler Utility
 * 
 * This utility helps handle ZK-related errors in the frontend without blocking UI navigation.
 * It follows the token-agnostic wallet scanning plan by not using fallbacks or hiding errors.
 */

/**
 * Handles ZK errors from API responses
 * @param {Object} error - The error object from fetch responses
 * @param {Function} setError - Function to set error state in UI
 * @param {Function} logError - Optional function to log errors
 * @returns {Object} - User-friendly error information
 */
export const handleZkError = async (error, setError, logError) => {
  try {
    // Try to parse error response
    let errorData;
    
    if (error.response) {
      try {
        errorData = await error.response.json();
      } catch (e) {
        errorData = { error: 'Unknown error', message: error.message };
      }
    } else if (error.json) {
      try {
        errorData = await error.json();
      } catch (e) {
        errorData = { error: 'Unknown error', message: error.message };
      }
    } else {
      errorData = { error: 'Unknown error', message: error.message };
    }
    
    // Log error if logger function provided
    if (logError && typeof logError === 'function') {
      logError('ZK Error:', errorData);
    } else {
      console.error('ZK Error:', errorData);
    }
    
    // Create user-friendly error message based on error type
    const userMessage = getUserFriendlyErrorMessage(errorData);
    
    // Update UI error state if function provided
    if (setError && typeof setError === 'function') {
      setError(userMessage);
    }
    
    return {
      userMessage,
      technicalDetails: errorData
    };
  } catch (handlingError) {
    console.error('Error handling ZK error:', handlingError);
    return {
      userMessage: 'An unexpected error occurred while processing your request.',
      technicalDetails: { error: 'Error handling error', message: handlingError.message }
    };
  }
};

/**
 * Get user-friendly error message based on error type
 * @param {Object} errorData - Parsed error data from API response
 * @returns {string} - User-friendly error message
 */
function getUserFriendlyErrorMessage(errorData) {
  const errorType = errorData.errorType || 'UNKNOWN';
  
  switch (errorType) {
    case 'ZK_ERROR':
      return `Zero-Knowledge proof generation failed. This is a real error we are investigating: ${errorData.message}`;
      
    case 'ZK_VERIFICATION_ERROR':
      return `Zero-Knowledge proof verification failed. The proof could not be verified: ${errorData.message}`;
      
    case 'SYSTEM_ERROR':
      return 'A system error occurred while processing your request. Please try again later.';
      
    default:
      // Check common error messages
      if (errorData.message && errorData.message.includes('getFrLen is not a function')) {
        return 'Zero-Knowledge circuit is missing required functions. The development team is working on fixing this.';
      } else if (errorData.message && errorData.message.includes('WebAssembly.compile')) {
        return 'Zero-Knowledge circuit file format is invalid. The development team is working on fixing this.';
      }
      
      return errorData.message || 'An unknown error occurred';
  }
}

/**
 * Determines if the error is related to ZK proof functionality
 * @param {Object} error - Error object
 * @returns {boolean} - Whether this is a ZK-related error
 */
export const isZkError = (error) => {
  if (!error) return false;
  
  if (error.errorType) {
    return ['ZK_ERROR', 'ZK_VERIFICATION_ERROR'].includes(error.errorType);
  }
  
  if (error.message) {
    return (
      error.message.includes('ZK proof') ||
      error.message.includes('snarkjs') ||
      error.message.includes('WebAssembly') ||
      error.message.includes('getFrLen') ||
      error.message.includes('circuit')
    );
  }
  
  return false;
};

/**
 * Safely handles ZK operations with proper error handling
 * @param {Function} zkOperation - The ZK operation function to perform
 * @param {Object} params - Parameters for the ZK operation
 * @param {Function} setError - Function to set error state
 * @param {Function} onSuccess - Callback for successful operation
 */
export const safeZkOperation = async (zkOperation, params, setError, onSuccess) => {
  try {
    const result = await zkOperation(params);
    if (onSuccess && typeof onSuccess === 'function') {
      onSuccess(result);
    }
    return result;
  } catch (error) {
    const handledError = await handleZkError(error, setError);
    return {
      success: false,
      error: handledError
    };
  }
};

export default {
  handleZkError,
  isZkError,
  safeZkOperation
};