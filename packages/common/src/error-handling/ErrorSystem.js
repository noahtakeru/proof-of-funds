/**
 * Unified Error Handling System
 * 
 * This module provides a comprehensive error handling framework for both client and server-side code.
 * It consolidates multiple error handling approaches into a single, consistent system.
 * 
 * Features:
 * - Error categorization with severity levels
 * - Category-specific error handling
 * - Secure error messages that don't expose sensitive information
 * - Developer-friendly error details for debugging
 * - User-friendly error messages for UI display
 * - HTTP status code mapping for API responses
 * - Support for structured error reporting
 */

// --- ERROR TYPES AND CATEGORIES ---

/**
 * Error severity levels
 */
export const ErrorSeverity = {
  CRITICAL: 'critical',  // Application cannot continue
  ERROR: 'error',        // Operation failed but application can continue
  WARNING: 'warning',    // Operation succeeded with issues
  INFO: 'info'           // Informational only
};

/**
 * Error categories for classification
 */
export const ErrorCategory = {
  ZK: 'zk',              // Zero-knowledge proof related errors
  WALLET: 'wallet',      // Wallet connection and interaction errors
  NETWORK: 'network',    // Network and API connection errors
  VALIDATION: 'validation', // Input validation errors
  SECURITY: 'security',  // Security related errors
  SYSTEM: 'system',      // System and infrastructure errors
  UNKNOWN: 'unknown'     // Unclassified errors
};

/**
 * Common error codes
 */
export const ErrorCode = {
  // ZK Error Codes
  ZK_PROOF_GENERATION_FAILED: 'zk_proof_generation_failed',
  ZK_VERIFICATION_FAILED: 'zk_verification_failed',
  ZK_INVALID_WITNESS: 'zk_invalid_witness',
  ZK_CIRCUIT_ERROR: 'zk_circuit_error',
  
  // Wallet Error Codes
  WALLET_CONNECTION_FAILED: 'wallet_connection_failed',
  WALLET_SIGNATURE_REJECTED: 'wallet_signature_rejected',
  WALLET_NOT_FOUND: 'wallet_not_found',
  INSUFFICIENT_FUNDS: 'insufficient_funds',
  
  // Network Error Codes
  NETWORK_REQUEST_FAILED: 'network_request_failed',
  NETWORK_TIMEOUT: 'network_timeout',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  SERVICE_UNAVAILABLE: 'service_unavailable',
  
  // Validation Error Codes
  INVALID_INPUT: 'invalid_input',
  MISSING_PARAMETER: 'missing_parameter',
  INVALID_FORMAT: 'invalid_format',
  
  // Security Error Codes
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  INVALID_TOKEN: 'invalid_token',
  
  // System Error Codes
  INTERNAL_ERROR: 'internal_error',
  NOT_IMPLEMENTED: 'not_implemented',
  DATABASE_ERROR: 'database_error',
  
  // General Error Codes
  UNKNOWN_ERROR: 'unknown_error'
};

// --- ERROR CLASSES ---

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code || ErrorCode.UNKNOWN_ERROR;
    this.category = options.category || ErrorCategory.UNKNOWN;
    this.severity = options.severity || ErrorSeverity.ERROR;
    this.statusCode = options.statusCode || 500;
    this.details = options.details || {};
    this.timestamp = new Date().toISOString();
    this.requestId = options.requestId || generateRequestId();
  }
}

/**
 * ZK-specific error class
 */
export class ZkError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || ErrorCode.ZK_PROOF_GENERATION_FAILED,
      category: ErrorCategory.ZK,
      severity: options.severity || ErrorSeverity.ERROR,
      statusCode: options.statusCode || 400,
      details: options.details || {},
      requestId: options.requestId
    });
  }
}

/**
 * Wallet-specific error class
 */
export class WalletError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || ErrorCode.WALLET_CONNECTION_FAILED,
      category: ErrorCategory.WALLET,
      severity: options.severity || ErrorSeverity.ERROR,
      statusCode: options.statusCode || 400,
      details: options.details || {},
      requestId: options.requestId
    });
  }
}

/**
 * Network-specific error class
 */
export class NetworkError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || ErrorCode.NETWORK_REQUEST_FAILED,
      category: ErrorCategory.NETWORK,
      severity: options.severity || ErrorSeverity.ERROR,
      statusCode: options.statusCode || 503,
      details: options.details || {},
      requestId: options.requestId
    });
  }
}

/**
 * Validation-specific error class
 */
export class ValidationError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || ErrorCode.INVALID_INPUT,
      category: ErrorCategory.VALIDATION,
      severity: options.severity || ErrorSeverity.WARNING,
      statusCode: options.statusCode || 400,
      details: options.details || {},
      requestId: options.requestId
    });
  }
}

/**
 * Security-specific error class
 */
export class SecurityError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || ErrorCode.UNAUTHORIZED,
      category: ErrorCategory.SECURITY,
      severity: options.severity || ErrorSeverity.ERROR,
      statusCode: options.statusCode || 401,
      details: options.details || {},
      requestId: options.requestId
    });
  }
}

// --- ERROR FACTORY ---

/**
 * Creates an error of the appropriate type
 * @param {string} message - Error message
 * @param {Object} options - Error options 
 * @returns {AppError} - Specific error instance
 */
export function createError(message, options = {}) {
  const category = options.category || ErrorCategory.UNKNOWN;
  
  switch (category) {
    case ErrorCategory.ZK:
      return new ZkError(message, options);
    case ErrorCategory.WALLET:
      return new WalletError(message, options);
    case ErrorCategory.NETWORK:
      return new NetworkError(message, options);
    case ErrorCategory.VALIDATION:
      return new ValidationError(message, options);
    case ErrorCategory.SECURITY:
      return new SecurityError(message, options);
    default:
      return new AppError(message, options);
  }
}

// --- ERROR HANDLING UTILITIES ---

/**
 * Gets a user-friendly error message
 * @param {Error} error - The error
 * @param {boolean} includeDetails - Whether to include technical details 
 * @returns {string} - User-friendly message
 */
export function getUserFriendlyMessage(error, includeDetails = false) {
  if (!error) {return 'An unknown error occurred';}
  
  let message = '';
  
  // Handle different types of errors
  if (error instanceof AppError) {
    switch (error.category) {
      case ErrorCategory.ZK:
        message = 'Zero-knowledge proof operation failed';
        break;
      case ErrorCategory.WALLET:
        message = 'Wallet operation failed';
        break;
      case ErrorCategory.NETWORK:
        message = 'Network request failed';
        break;
      case ErrorCategory.VALIDATION:
        message = 'Invalid input provided';
        break;
      case ErrorCategory.SECURITY:
        message = 'Authorization error';
        break;
      default:
        message = 'An unexpected error occurred';
    }
    
    // Add specific code messages
    switch (error.code) {
      case ErrorCode.WALLET_SIGNATURE_REJECTED:
        message = 'You declined the signature request';
        break;
      case ErrorCode.INSUFFICIENT_FUNDS:
        message = 'Insufficient funds to complete the transaction';
        break;
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        message = 'Too many requests. Please try again later';
        break;
      case ErrorCode.NETWORK_TIMEOUT:
        message = 'The request timed out. Please try again';
        break;
    }
  } else if (error.message) {
    // Generic error handling
    if (error.message.includes('wallet') && error.message.includes('connect')) {
      message = 'Failed to connect to wallet';
    } else if (error.message.includes('network') || error.message.includes('connection')) {
      message = 'Network connection issue';
    } else if (error.message.includes('timeout')) {
      message = 'The request timed out';
    } else if (error.message.includes('signature') && error.message.includes('reject')) {
      message = 'Signature request was rejected';
    } else if (error.message.includes('not found')) {
      message = 'The requested resource was not found';
    } else {
      message = 'An error occurred';
    }
  } else {
    message = 'An unknown error occurred';
  }
  
  // Add technical details for developers if requested
  if (includeDetails && process.env.NODE_ENV === 'development') {
    if (error instanceof AppError) {
      message += ` (${error.code})`;
      
      if (error.details && Object.keys(error.details).length > 0) {
        message += `: ${JSON.stringify(error.details)}`;
      }
    } else if (error.message) {
      message += `: ${error.message}`;
    }
  }
  
  return message;
}

/**
 * Maps a JS error to an HTTP status code
 * @param {Error} error - The error
 * @returns {number} - HTTP status code
 */
export function getHttpStatusCode(error) {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  
  // Default mappings
  if (error.statusCode) {
    return error.statusCode;
  } else if (error.name === 'ValidationError' || error.message?.includes('validation')) {
    return 400;
  } else if (error.name === 'AuthenticationError' || error.message?.includes('auth')) {
    return 401;
  } else if (error.name === 'ForbiddenError' || error.message?.includes('forbidden')) {
    return 403;
  } else if (error.name === 'NotFoundError' || error.message?.includes('not found')) {
    return 404;
  } else if (error.message?.includes('timeout')) {
    return 504;
  } else if (error.message?.includes('rate limit')) {
    return 429;
  }
  
  return 500; // Default to server error
}

/**
 * Creates a standardized API error response
 * @param {Error} error - The error that occurred 
 * @param {Object} res - Express/Next.js response object
 * @returns {Object} - The response
 */
export function sendApiErrorResponse(error, res) {
  const isAppError = error instanceof AppError;
  
  // Get status code
  const statusCode = isAppError ? error.statusCode : getHttpStatusCode(error);
  
  // Generate request ID for tracing
  const requestId = isAppError ? error.requestId : generateRequestId();
  
  // Create error response
  const errorResponse = {
    error: isAppError ? error.code : ErrorCode.UNKNOWN_ERROR,
    message: getUserFriendlyMessage(error, false),
    requestId
  };
  
  // Add safe details
  if (isAppError && error.details) {
    // Filter to only include safe keys
    const safeDetails = {};
    const safeKeys = ['validationErrors', 'errorCode', 'component', 'operation'];
    
    for (const key of safeKeys) {
      if (error.details[key] !== undefined) {
        safeDetails[key] = error.details[key];
      }
    }
    
    if (Object.keys(safeDetails).length > 0) {
      errorResponse.details = safeDetails;
    }
  }
  
  // Add development details
  if (process.env.NODE_ENV === 'development') {
    errorResponse.dev = {
      stack: error.stack,
      originalMessage: error.message
    };
  }
  
  // Log error for monitoring and debugging
  console.error(`[${requestId}] ${isAppError ? error.severity : 'error'} (${statusCode}): ${error.message}`);
  
  return res.status(statusCode).json(errorResponse);
}

/**
 * Client-side error handler
 * @param {Error} error - Error object
 * @param {Function} setError - State setter for error message
 * @param {Function} logError - Optional logging function
 * @returns {Object} - Error information
 */
export async function handleClientError(error, setError, logError) {
  try {
    // Try to parse error from API responses
    let parsedError = error;
    
    if (error.response) {
      try {
        const data = await error.response.json();
        parsedError = data;
      } catch (e) {
        // Use original error if parsing fails
      }
    } else if (error.json) {
      try {
        const data = await error.json();
        parsedError = data;
      } catch (e) {
        // Use original error if parsing fails
      }
    }
    
    // Log error
    if (logError && typeof logError === 'function') {
      logError('Application Error:', parsedError);
    } else {
      console.error('Application Error:', parsedError);
    }
    
    // Get user-friendly message
    const userMessage = getUserFriendlyMessage(parsedError);
    
    // Update UI error state if function provided
    if (setError && typeof setError === 'function') {
      setError(userMessage);
    }
    
    return {
      userMessage,
      technicalDetails: parsedError
    };
  } catch (e) {
    console.error('Error handling error:', e);
    return {
      userMessage: 'An unexpected error occurred',
      technicalDetails: { error: 'Error handling error', message: e.message }
    };
  }
}

/**
 * Safe operation wrapper for any async operation
 * @param {Function} operation - Async operation to perform
 * @param {Object} params - Operation parameters
 * @param {Function} setError - State setter for error display
 * @param {Function} onSuccess - Success callback
 * @returns {Promise<any>} Operation result or error details
 */
export async function safeOperation(operation, params, setError, onSuccess) {
  try {
    const result = await operation(params);
    if (onSuccess && typeof onSuccess === 'function') {
      onSuccess(result);
    }
    return result;
  } catch (error) {
    const handledError = await handleClientError(error, setError);
    return {
      success: false,
      error: handledError
    };
  }
}

// --- HELPER FUNCTIONS ---

/**
 * Generate request ID for tracking errors
 * @returns {string} Unique request ID
 */
function generateRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Export a default object for convenience
export default {
  // Error categories
  ErrorCategory,
  ErrorSeverity,
  ErrorCode,
  
  // Error classes
  AppError,
  ZkError,
  WalletError,
  NetworkError,
  ValidationError,
  SecurityError,
  
  // Error factory
  createError,
  
  // Utility functions
  getUserFriendlyMessage,
  getHttpStatusCode,
  sendApiErrorResponse,
  handleClientError,
  safeOperation
};