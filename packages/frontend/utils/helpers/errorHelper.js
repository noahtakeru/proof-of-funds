/**
 * Error Helper
 * 
 * Simplified error handling utilities for the ZK proof system
 * that don't rely on importing from @proof-of-funds/common
 */

const crypto = require('crypto');

// Error Types
const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  ZK_ERROR: 'ZK_ERROR',
  FILE_ERROR: 'FILE_ERROR',
  API_ERROR: 'API_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  SYSTEM_ERROR: 'SYSTEM_ERROR'
};

/**
 * Create a structured API error response
 * @param {string} message - Error message
 * @param {string} type - Error type
 * @param {number} status - HTTP status code
 * @param {Object} details - Additional error details
 * @returns {Object} Structured error response
 */
function createApiError(message, type = ErrorTypes.SYSTEM_ERROR, status = 500, details = {}) {
  return {
    error: true,
    message,
    type,
    status,
    details,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a ZK-specific error 
 * @param {string} message - Error message
 * @param {string} subtype - Specific ZK error subtype
 * @param {Object} details - Additional error details
 * @returns {Object} Structured ZK error
 */
function createZkError(message, subtype = 'UNKNOWN', details = {}) {
  return createApiError(
    message,
    ErrorTypes.ZK_ERROR, 
    500,
    {
      ...details,
      zkErrorType: subtype
    }
  );
}

/**
 * Handle API errors and convert to structured response
 * @param {Error} error - The error object
 * @param {Object} res - Express response object
 */
function handleApiError(error, res) {
  // Generate a unique error reference ID for tracking
  const errorId = crypto.randomBytes(8).toString('hex');
  
  // Log the error with the reference ID for internal tracking
  console.error(`API Error [${errorId}]:`, error);
  
  // Sanitize error message to prevent leaking sensitive information
  let sanitizedMessage = error.message || 'An unexpected error occurred';
  
  // Filter out potentially sensitive information from error messages
  const sensitivePatterns = [
    /key/i, /secret/i, /password/i, /token/i, /credential/i,
    /private/i, /address/i, /0x[a-fA-F0-9]{40}/  // Ethereum address pattern
  ];
  
  sensitivePatterns.forEach(pattern => {
    if (pattern.test(sanitizedMessage)) {
      sanitizedMessage = 'A system error occurred';
    }
  });
  
  // If it's already a structured error, use it but sanitize
  if (error.type && error.status) {
    const sanitizedError = {
      ...error,
      message: sanitizedMessage,
      errorId,
      details: process.env.NODE_ENV === 'production' 
        ? { errorType: error.type }
        : { ...error.details, stack: error.stack }
    };
    
    return res.status(error.status).json(sanitizedError);
  }
  
  // Default error response
  const errorResponse = createApiError(
    sanitizedMessage, 
    ErrorTypes.SYSTEM_ERROR,
    500,
    { 
      errorId,
      errorType: error.name || 'SystemError',
      stack: process.env.NODE_ENV !== 'production' ? undefined : error.stack
    }
  );
  
  // In production, never reveal the actual error details
  if (process.env.NODE_ENV === 'production') {
    delete errorResponse.details.stack;
  }
  
  return res.status(errorResponse.status).json(errorResponse);
}

/**
 * Simple validation function
 * @param {Object} data - Data to validate
 * @param {Array} requiredFields - Required fields
 * @returns {Object} Validation result
 */
function validateData(data, requiredFields = []) {
  const errors = [];
  
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'data', message: 'Data must be an object' }]
    };
  }
  
  for (const field of requiredFields) {
    if (data[field] === undefined) {
      errors.push({ field, message: `Missing required field: ${field}` });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  ErrorTypes,
  createApiError,
  createZkError,
  handleApiError,
  validateData
};