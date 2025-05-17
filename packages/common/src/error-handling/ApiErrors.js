/**
 * API Error Handlers
 * 
 * This module provides specialized error handling for API operations.
 * It extends the base error system with API-specific functionality.
 */

import {
  ErrorCategory,
  ErrorCode,
  ValidationError,
  NetworkError,
  SecurityError,
  sendApiErrorResponse
} from './ErrorSystem';

/**
 * Creates a validation error for API requests
 * @param {string} message - Error message
 * @param {Object} validationErrors - Specific validation errors
 * @returns {ValidationError} Validation error
 */
export function createValidationError(message, validationErrors = {}) {
  return new ValidationError(message, {
    details: { validationErrors }
  });
}

/**
 * Creates a rate limit error
 * @param {string} message - Error message
 * @returns {NetworkError} Network error with rate limit code
 */
export function createRateLimitError(message = 'Rate limit exceeded') {
  return new NetworkError(message, {
    code: ErrorCode.RATE_LIMIT_EXCEEDED,
    statusCode: 429
  });
}

/**
 * Creates an authentication error
 * @param {string} message - Error message
 * @returns {SecurityError} Security error
 */
export function createAuthError(message = 'Authentication required') {
  return new SecurityError(message, {
    code: ErrorCode.UNAUTHORIZED,
    statusCode: 401
  });
}

/**
 * Handles API errors with Next.js/Express response
 * @param {Error} error - Error object
 * @param {Object} res - Response object
 * @returns {Object} Response with error details
 */
export function handleApiError(error, res) {
  return sendApiErrorResponse(error, res);
}

/**
 * API request validator with consistent error structure
 * @param {Object} data - Request data to validate
 * @param {Object} schema - Validation schema
 * @returns {Object} Validation result
 */
export function validateApiRequest(data, schema) {
  const result = {
    isValid: true,
    errors: [],
    sanitizedData: {}
  };

  // Check for required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (data[field] === undefined) {
        result.isValid = false;
        result.errors.push({
          field,
          code: 'missing_required_field',
          message: `The field '${field}' is required`
        });
      }
    }
  }

  // Skip field validation if required fields are missing
  if (!result.isValid) {
    return result;
  }

  // Validate and sanitize fields
  if (schema.fields) {
    for (const [field, validators] of Object.entries(schema.fields)) {
      // Skip if field is not provided and not required
      if (data[field] === undefined) {
        continue;
      }

      // Apply all validators to the field
      let fieldValue = data[field];
      let isFieldValid = true;

      for (const validate of validators) {
        if (typeof validate === 'function') {
          const validationResult = validate(fieldValue, field);
          
          if (!validationResult.isValid) {
            result.isValid = false;
            isFieldValid = false;
            result.errors.push({
              field,
              code: validationResult.error,
              message: validationResult.message
            });
            break;
          }
          
          // Apply transformation if provided
          if (validationResult.value !== undefined) {
            fieldValue = validationResult.value;
          }
        }
      }

      // Add valid field to sanitized data
      if (isFieldValid) {
        result.sanitizedData[field] = fieldValue;
      }
    }
  } else {
    // If no field validators, copy all data
    result.sanitizedData = { ...data };
  }

  return result;
}

/**
 * Common validator functions for API requests
 */
export const validators = {
  /**
   * Validates string type
   */
  isString(value, fieldName) {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: 'invalid_type',
        message: `The field '${fieldName}' must be a string`
      };
    }
    return { isValid: true };
  },

  /**
   * Validates number type
   */
  isNumber(value, fieldName) {
    if (typeof value !== 'number' || isNaN(value)) {
      return {
        isValid: false,
        error: 'invalid_type',
        message: `The field '${fieldName}' must be a number`
      };
    }
    return { isValid: true };
  },

  /**
   * Validates boolean type
   */
  isBoolean(value, fieldName) {
    if (typeof value !== 'boolean') {
      return {
        isValid: false,
        error: 'invalid_type',
        message: `The field '${fieldName}' must be a boolean`
      };
    }
    return { isValid: true };
  },

  /**
   * Validates object type
   */
  isObject(value, fieldName) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {
        isValid: false,
        error: 'invalid_type',
        message: `The field '${fieldName}' must be an object`
      };
    }
    return { isValid: true };
  },

  /**
   * Validates array type
   */
  isArray(value, fieldName) {
    if (!Array.isArray(value)) {
      return {
        isValid: false,
        error: 'invalid_type',
        message: `The field '${fieldName}' must be an array`
      };
    }
    return { isValid: true };
  },

  /**
   * Validates min length for strings and arrays
   * @param {number} min - Minimum length
   */
  minLength(min) {
    return (value, fieldName) => {
      if ((typeof value === 'string' || Array.isArray(value)) && value.length < min) {
        return {
          isValid: false,
          error: 'too_short',
          message: `The field '${fieldName}' must be at least ${min} characters long`
        };
      }
      return { isValid: true };
    };
  },

  /**
   * Validates max length for strings and arrays
   * @param {number} max - Maximum length
   */
  maxLength(max) {
    return (value, fieldName) => {
      if ((typeof value === 'string' || Array.isArray(value)) && value.length > max) {
        return {
          isValid: false,
          error: 'too_long',
          message: `The field '${fieldName}' must be no more than ${max} characters long`
        };
      }
      return { isValid: true };
    };
  },

  /**
   * Validates min value for numbers
   * @param {number} min - Minimum value
   */
  min(min) {
    return (value, fieldName) => {
      if (typeof value === 'number' && value < min) {
        return {
          isValid: false,
          error: 'too_small',
          message: `The field '${fieldName}' must be at least ${min}`
        };
      }
      return { isValid: true };
    };
  },

  /**
   * Validates max value for numbers
   * @param {number} max - Maximum value
   */
  max(max) {
    return (value, fieldName) => {
      if (typeof value === 'number' && value > max) {
        return {
          isValid: false,
          error: 'too_large',
          message: `The field '${fieldName}' must be no more than ${max}`
        };
      }
      return { isValid: true };
    };
  },

  /**
   * Validates pattern for strings
   * @param {RegExp} pattern - Regular expression pattern
   * @param {string} message - Custom error message
   */
  pattern(pattern, message) {
    return (value, fieldName) => {
      if (typeof value === 'string' && !pattern.test(value)) {
        return {
          isValid: false,
          error: 'invalid_format',
          message: message || `The field '${fieldName}' has an invalid format`
        };
      }
      return { isValid: true };
    };
  },

  /**
   * Validates that value is one of the allowed values
   * @param {Array} allowedValues - List of allowed values
   */
  isEnum(allowedValues) {
    return (value, fieldName) => {
      if (!allowedValues.includes(value)) {
        return {
          isValid: false,
          error: 'invalid_value',
          message: `The field '${fieldName}' must be one of: ${allowedValues.join(', ')}`
        };
      }
      return { isValid: true };
    };
  },

  /**
   * Trims string values
   */
  trim(value, fieldName) {
    if (typeof value === 'string') {
      return {
        isValid: true,
        value: value.trim()
      };
    }
    return { isValid: true };
  },

  /**
   * Converts to lowercase
   */
  toLowerCase(value, fieldName) {
    if (typeof value === 'string') {
      return {
        isValid: true,
        value: value.toLowerCase()
      };
    }
    return { isValid: true };
  },

  /**
   * Validates ethereum address format
   */
  isEthAddress(value, fieldName) {
    if (typeof value !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
      return {
        isValid: false,
        error: 'invalid_eth_address',
        message: `The field '${fieldName}' must be a valid Ethereum address`
      };
    }
    return { isValid: true };
  }
};

export default {
  createValidationError,
  createRateLimitError,
  createAuthError,
  handleApiError,
  validateApiRequest,
  validators
};