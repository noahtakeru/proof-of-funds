/**
 * API Validation Utilities
 * 
 * This module provides standardized input validation for API endpoints
 * 
 * This file now uses the unified error handling system.
 */

import { 
  validateApiRequest as unifiedValidateApiRequest,
  validators as unifiedValidators
} from '@proof-of-funds/common/src/error-handling';

/**
 * Validate a Proof of Funds API request
 * @param {Object} req - Express request object
 * @param {Object} validationSpec - Validation specification
 * @returns {Object} - Validation result
 */
export function validateApiRequest(requestData, validationSpec) {
  return unifiedValidateApiRequest(requestData, validationSpec);
}

/**
 * Validation functions
 */
export const validators = {
  // Import all validators from unified system
  ...unifiedValidators,
  
  // Keep any custom validators not in the unified system
  isAddress: unifiedValidators.isEthAddress || ((value, fieldName) => {
    if (!value || typeof value !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
      return {
        isValid: false,
        error: 'invalid_address',
        message: `The field '${fieldName}' must be a valid Ethereum address`
      };
    }
    return { isValid: true };
  })
};

export default {
  validateApiRequest,
  validators
};