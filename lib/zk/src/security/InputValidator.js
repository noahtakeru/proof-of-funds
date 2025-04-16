/**
 * Enhanced Input Validator for ZK API Endpoints
 * 
 * This module provides comprehensive input validation for ZK operations,
 * including cross-field validation, schema validation, and sanitization.
 */

/**
 * ValidationRule class representing a single validation rule
 */
class ValidationRule {
  /**
   * Create a new validation rule
   * 
   * @param {Object} config - Rule configuration
   * @param {string} config.field - Field name to validate
   * @param {Function} config.validator - Validation function
   * @param {string} config.message - Error message on validation failure
   * @param {boolean} [config.required=true] - Whether the field is required
   */
  constructor({ field, validator, message, required = true }) {
    this.field = field;
    this.validator = validator;
    this.message = message;
    this.required = required;
  }
  
  /**
   * Run validation against a value
   * 
   * @param {any} value - Value to validate
   * @param {Object} allValues - All input values (for cross-field validation)
   * @returns {boolean} Whether validation passed
   */
  validate(value, allValues) {
    // Skip validation for optional fields that are not present
    if (!this.required && (value === undefined || value === null)) {
      return true;
    }
    
    // Run the validator function
    return this.validator(value, allValues);
  }
}

/**
 * CrossFieldRule class for validations that involve multiple fields
 */
class CrossFieldRule {
  /**
   * Create a new cross-field validation rule
   * 
   * @param {Object} config - Rule configuration
   * @param {string[]} config.fields - Field names involved in validation
   * @param {Function} config.validator - Validation function
   * @param {string} config.message - Error message on validation failure
   */
  constructor({ fields, validator, message }) {
    this.fields = fields;
    this.validator = validator;
    this.message = message;
  }
  
  /**
   * Run validation across multiple fields
   * 
   * @param {Object} values - All input values
   * @returns {boolean} Whether validation passed
   */
  validate(values) {
    // Extract just the fields we care about
    const relevantValues = {};
    for (const field of this.fields) {
      relevantValues[field] = values[field];
    }
    
    // Run the validator with all relevant values
    return this.validator(relevantValues, values);
  }
}

/**
 * InputValidator class for validating API inputs
 */
class InputValidator {
  /**
   * Create a new InputValidator instance
   */
  constructor() {
    // Pre-defined validation rules for common fields
    this.commonRules = {
      // Wallet address validation
      walletAddress: new ValidationRule({
        field: 'walletAddress',
        validator: (value) => /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(value),
        message: 'Invalid wallet address format'
      }),
      
      // Amount validation (positive number)
      amount: new ValidationRule({
        field: 'amount',
        validator: (value) => 
          (typeof value === 'number' && value >= 0) || 
          (typeof value === 'string' && /^\d+$/.test(value) && parseInt(value) >= 0),
        message: 'Amount must be a non-negative number or numeric string'
      }),
      
      // Nonce validation
      nonce: new ValidationRule({
        field: 'nonce',
        validator: (value) => typeof value === 'string' && value.length >= 8,
        message: 'Nonce must be a string of at least 8 characters'
      }),
      
      // Timestamp validation
      timestamp: new ValidationRule({
        field: 'timestamp',
        validator: (value) => {
          if (typeof value === 'number') return true;
          if (typeof value === 'string') return !isNaN(parseInt(value, 10));
          return false;
        },
        message: 'Timestamp must be a valid number or numeric string',
        required: false
      }),
      
      // Proof type validation
      proofType: new ValidationRule({
        field: 'proofType',
        validator: (value) => [0, 1, 2].includes(Number(value)),
        message: 'Proof type must be 0 (standard), 1 (threshold), or 2 (maximum)'
      }),
      
      // Threshold validation (for threshold proof)
      threshold: new ValidationRule({
        field: 'threshold',
        validator: (value) => typeof value === 'number' && value > 0,
        message: 'Threshold must be a positive number',
        required: false
      }),
      
      // Maximum validation (for maximum proof)
      maximum: new ValidationRule({
        field: 'maximum',
        validator: (value) => typeof value === 'number' && value > 0,
        message: 'Maximum must be a positive number',
        required: false
      }),
      
      // Signature validation
      signature: new ValidationRule({
        field: 'signature',
        validator: (value) => typeof value === 'string' && value.length > 0,
        message: 'Signature must be a non-empty string',
        required: false
      }),
      
      // Client ID validation
      clientId: new ValidationRule({
        field: 'clientId',
        validator: (value) => typeof value === 'string' && value.length > 0,
        message: 'Client ID must be a non-empty string',
        required: false
      })
    };
    
    // Cross-field validation rules
    this.crossFieldRules = {
      // Proof type specific required fields
      proofTypeRequirements: new CrossFieldRule({
        fields: ['proofType', 'threshold', 'maximum'],
        validator: (values) => {
          const { proofType, threshold, maximum } = values;
          
          // Threshold proof requires threshold field
          if (Number(proofType) === 1 && threshold === undefined) {
            return false;
          }
          
          // Maximum proof requires maximum field
          if (Number(proofType) === 2 && maximum === undefined) {
            return false;
          }
          
          return true;
        },
        message: 'Threshold proofs require threshold field; Maximum proofs require maximum field'
      }),
      
      // Amount consistency validation
      amountConsistency: new CrossFieldRule({
        fields: ['amount', 'threshold', 'maximum'],
        validator: (values) => {
          const { amount, threshold, maximum } = values;
          
          // Convert amount to number for comparison
          const numAmount = typeof amount === 'string' ? parseInt(amount, 10) : amount;
          
          // If threshold is provided, amount should be >= threshold
          if (threshold !== undefined && numAmount < threshold) {
            return false;
          }
          
          // If maximum is provided, amount should be <= maximum
          if (maximum !== undefined && numAmount > maximum) {
            return false;
          }
          
          return true;
        },
        message: 'Amount must be >= threshold and <= maximum when those values are provided'
      }),
      
      // Signature consistency validation
      signatureConsistency: new CrossFieldRule({
        fields: ['signature', 'clientId', 'timestamp'],
        validator: (values) => {
          const { signature, clientId, timestamp } = values;
          
          // If signature is provided, clientId and timestamp should also be provided
          if (signature !== undefined) {
            return clientId !== undefined && timestamp !== undefined;
          }
          
          return true;
        },
        message: 'When signature is provided, clientId and timestamp must also be provided'
      })
    };
    
    // Predefined validation schemas
    this.schemas = {
      // Standard proof schema
      standardProof: [
        this.commonRules.walletAddress,
        this.commonRules.amount,
        this.commonRules.proofType,
        this.commonRules.nonce,
        this.commonRules.timestamp
      ],
      
      // Threshold proof schema
      thresholdProof: [
        this.commonRules.walletAddress,
        this.commonRules.amount,
        this.commonRules.proofType,
        this.commonRules.threshold,
        this.commonRules.nonce,
        this.commonRules.timestamp
      ],
      
      // Maximum proof schema
      maximumProof: [
        this.commonRules.walletAddress,
        this.commonRules.amount,
        this.commonRules.proofType,
        this.commonRules.maximum,
        this.commonRules.nonce,
        this.commonRules.timestamp
      ],
      
      // Schema for verifying signed requests
      signedRequest: [
        this.commonRules.nonce,
        this.commonRules.timestamp,
        this.commonRules.signature,
        this.commonRules.clientId
      ]
    };
  }
  
  /**
   * Validate input data against a set of validation rules
   * 
   * @param {Object} inputData - Input data to validate
   * @param {ValidationRule[]} rules - Validation rules to apply
   * @param {CrossFieldRule[]} [crossFieldRules=[]] - Cross-field validation rules
   * @returns {Object} Validation result with status and errors
   */
  validate(inputData, rules, crossFieldRules = []) {
    const errors = [];
    
    // Validate individual fields
    for (const rule of rules) {
      const value = inputData[rule.field];
      
      // Check required fields
      if (rule.required && (value === undefined || value === null)) {
        errors.push({
          field: rule.field,
          message: `Field '${rule.field}' is required`
        });
        continue;
      }
      
      // Apply validation rule
      if (!rule.validate(value, inputData)) {
        errors.push({
          field: rule.field,
          message: rule.message
        });
      }
    }
    
    // Apply cross-field validations
    for (const rule of crossFieldRules) {
      if (!rule.validate(inputData)) {
        errors.push({
          fields: rule.fields,
          message: rule.message
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate input for a proof generation or verification request
   * 
   * @param {Object} inputData - Input data to validate
   * @param {number} [proofType] - Optional proof type to use specific schema
   * @returns {Object} Validation result
   */
  validateProofInput(inputData, proofType) {
    // Determine proof type if not explicitly provided
    const inputProofType = proofType !== undefined ? proofType : inputData.proofType;
    
    let schema;
    switch (Number(inputProofType)) {
      case 0:
        schema = this.schemas.standardProof;
        break;
      case 1:
        schema = this.schemas.thresholdProof;
        break;
      case 2:
        schema = this.schemas.maximumProof;
        break;
      default:
        return {
          valid: false,
          errors: [{
            field: 'proofType',
            message: 'Invalid proof type, must be 0, 1, or 2'
          }]
        };
    }
    
    // Apply all cross-field rules
    const crossFieldRules = Object.values(this.crossFieldRules);
    
    return this.validate(inputData, schema, crossFieldRules);
  }
  
  /**
   * Validate a signed request
   * 
   * @param {Object} requestData - Request data to validate
   * @returns {Object} Validation result
   */
  validateSignedRequest(requestData) {
    return this.validate(
      requestData,
      this.schemas.signedRequest,
      [this.crossFieldRules.signatureConsistency]
    );
  }
  
  /**
   * Sanitize input to prevent injection attacks
   * 
   * @param {Object} inputData - Input data to sanitize
   * @returns {Object} Sanitized input data
   */
  sanitizeInput(inputData) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(inputData)) {
      // Skip nullish values
      if (value === null || value === undefined) {
        sanitized[key] = value;
        continue;
      }
      
      // Handle different types
      if (typeof value === 'string') {
        // Remove potential script/HTML tags
        sanitized[key] = value.replace(/<[^>]*>/g, '');
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeInput(value);
      } else if (Array.isArray(value)) {
        // Sanitize array values
        sanitized[key] = value.map(item => 
          typeof item === 'object' ? this.sanitizeInput(item) : item
        );
      } else {
        // Other types (number, boolean) are kept as is
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
}

// Create singleton instance for global use
const inputValidator = new InputValidator();

export { InputValidator, ValidationRule, CrossFieldRule, inputValidator };
export default inputValidator;