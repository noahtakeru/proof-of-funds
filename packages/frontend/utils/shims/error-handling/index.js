/**
 * Error handling shim for Next.js Pages Router
 * This provides the same interface as @proof-of-funds/common/src/error-handling
 * but is compatible with the Pages Router build process.
 */

// ZK Error Types
const ZkErrorType = {
  INVALID_INPUT: 'INVALID_INPUT',
  CIRCUIT_ERROR: 'CIRCUIT_ERROR',
  PROOF_GENERATION_ERROR: 'PROOF_GENERATION_ERROR',
  VERIFICATION_ERROR: 'VERIFICATION_ERROR',
  SYSTEM_ERROR: 'SYSTEM_ERROR'
};

// Create a ZK-specific error
function createZkError(message, options = {}) {
  const error = new Error(message);
  error.zkErrorType = options.zkErrorType || ZkErrorType.SYSTEM_ERROR;
  error.details = options.details || {};
  return error;
}

/**
 * Create a rate limit error
 * @param {string} message - Error message
 * @param {Object} details - Error details
 * @returns {Error} - Rate limit error
 */
function createRateLimitError(message, details = {}) {
  const error = new Error(message || 'Rate limit exceeded');
  error.type = 'RATE_LIMIT_ERROR';
  error.status = 429;
  error.details = details || {};
  return error;
}

// API request validation
function validateApiRequest(data, schema) {
  const result = {
    isValid: true,
    errors: [],
    sanitizedData: { ...data }
  };
  
  if (!schema || !schema.required) {
    return result;
  }
  
  // Check required fields
  for (const field of schema.required) {
    if (data[field] === undefined) {
      result.isValid = false;
      result.errors.push({
        field,
        error: 'missing_field',
        message: `Required field '${field}' is missing`
      });
    }
  }
  
  // If validators are provided, use them
  if (schema.fields) {
    for (const [field, validators] of Object.entries(schema.fields)) {
      if (Array.isArray(validators) && data[field] !== undefined) {
        for (const validator of validators) {
          if (typeof validator === 'function') {
            const validationResult = validator(data[field], field);
            if (validationResult && !validationResult.isValid) {
              result.isValid = false;
              result.errors.push({
                field,
                error: validationResult.error || 'validation_failed',
                message: validationResult.message || `Validation failed for field '${field}'`
              });
            }
          }
        }
      }
    }
  }
  
  return result;
}

// Common field validators
const validators = {
  isString: (value, fieldName) => {
    if (value !== undefined && typeof value !== 'string') {
      return {
        isValid: false,
        error: 'invalid_type',
        message: `The field '${fieldName}' must be a string`
      };
    }
    return { isValid: true };
  },
  
  isEnum: (allowedValues) => (value, fieldName) => {
    if (value !== undefined && !allowedValues.includes(value)) {
      return {
        isValid: false,
        error: 'invalid_value',
        message: `The field '${fieldName}' must be one of: ${allowedValues.join(', ')}`
      };
    }
    return { isValid: true };
  },
  
  maxLength: (maxLen) => (value, fieldName) => {
    if (typeof value === 'string' && value.length > maxLen) {
      return {
        isValid: false,
        error: 'max_length_exceeded',
        message: `The field '${fieldName}' must not exceed ${maxLen} characters`
      };
    }
    return { isValid: true };
  },
  
  isNumber: (value, fieldName) => {
    if (value !== undefined && (typeof value !== 'number' || isNaN(value))) {
      return {
        isValid: false,
        error: 'invalid_number',
        message: `The field '${fieldName}' must be a number`
      };
    }
    return { isValid: true };
  },
  
  isPositiveNumber: (value, fieldName) => {
    // Accept string numbers and convert them
    const num = typeof value === 'string' ? Number(value) : value;
    
    if (value !== undefined && (typeof num !== 'number' || isNaN(num) || num <= 0)) {
      return {
        isValid: false,
        error: 'invalid_positive_number',
        message: `The field '${fieldName}' must be a positive number`
      };
    }
    return { isValid: true };
  },
  
  isEthAddress: (value, fieldName) => {
    if (value !== undefined && (!value || typeof value !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(value))) {
      return {
        isValid: false,
        error: 'invalid_address',
        message: `The field '${fieldName}' must be a valid Ethereum address`
      };
    }
    return { isValid: true };
  }
};

// Handle API errors
function handleApiError(error, res) {
  console.error('API Error:', error);
  
  // If it's already a structured error, use it
  if (error.type && error.status) {
    return res.status(error.status).json({
      error: error.type,
      message: error.message,
      details: error.details || {}
    });
  }
  
  // Default error response
  const errorResponse = {
    error: error.zkErrorType || 'SYSTEM_ERROR',
    message: error.message || 'An unexpected error occurred',
    details: error.details || {}
  };
  
  if (process.env.NODE_ENV !== 'production' && error.stack) {
    errorResponse.details.stack = error.stack;
  }
  
  return res.status(error.status || 500).json(errorResponse);
}

module.exports = {
  ZkErrorType,
  createZkError,
  createRateLimitError,
  validateApiRequest,
  validators,
  handleApiError
};