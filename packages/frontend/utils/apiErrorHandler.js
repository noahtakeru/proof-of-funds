/**
 * API Error Handler
 * 
 * Standardized error handling for API endpoints.
 * Part of the ZK Proof Execution Plan implementation.
 */

/**
 * Handles API errors in a consistent way
 * @param {Error} error - The error that occurred
 * @param {object} res - The response object from Next.js
 * @returns {object} - The response with appropriate error details
 */
export function handleApiError(error, res) {
  console.error('API Error:', error);
  
  // Determine error type
  const errorType = error.name === 'ZkError' ? 'ZK_ERROR' : 'SYSTEM_ERROR';
  
  // Default status code is 500 (Internal Server Error)
  let statusCode = 500;
  
  // Adjust status code based on error type
  if (error.statusCode) {
    statusCode = error.statusCode;
  } else if (errorType === 'ZK_ERROR') {
    statusCode = 400; // Bad Request for ZK errors
  } else if (error.message && error.message.includes('not found')) {
    statusCode = 404; // Not Found
  } else if (error.message && error.message.includes('validation')) {
    statusCode = 400; // Bad Request for validation errors
  }
  
  // Build error response object
  const errorResponse = {
    error: errorType === 'ZK_ERROR' ? 'ZK operation failed' : 'Internal server error',
    errorType,
    message: error.message || 'An unexpected error occurred',
    details: error.details || {}
  };
  
  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }
  
  return res.status(statusCode).json(errorResponse);
}