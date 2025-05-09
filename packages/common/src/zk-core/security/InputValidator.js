/**
 * Input Validator module
 * 
 * This module provides utilities for validating and sanitizing input
 * to ZK proof operations to prevent injection attacks and ensure data quality.
 */

/**
 * Sanitize input to prevent injection attacks
 * @param {Object} input - The input to sanitize
 * @returns {Object} The sanitized input
 */
function sanitizeInput(input) {
  // Create a deep copy of the input
  const sanitized = JSON.parse(JSON.stringify(input));

  // Recursive function to sanitize values
  function sanitizeValue(value) {
    if (typeof value === 'string') {
      // Remove any potentially dangerous characters or patterns
      return value
        .replace(/[<>]/g, '') // Remove HTML tags
        .trim();
    } else if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    } else if (value && typeof value === 'object') {
      const sanitizedObj = {};
      for (const [key, val] of Object.entries(value)) {
        sanitizedObj[key] = sanitizeValue(val);
      }
      return sanitizedObj;
    }
    return value;
  }

  // Sanitize all values in the input
  return sanitizeValue(sanitized);
}

/**
 * Validate proof input based on proof type
 * @param {Object} input - The input to validate
 * @returns {Object} The validation result
 */
function validateProofInput(input) {
  const errors = [];

  // Ensure input is an object
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    errors.push({
      field: 'input',
      message: 'Input must be an object'
    });
    return { valid: false, errors };
  }

  // Get proof type
  const proofType = input.proofType !== undefined ? Number(input.proofType) : undefined;

  // Validate proof type
  if (proofType === undefined || isNaN(proofType) || proofType < 0 || proofType > 2) {
    errors.push({
      field: 'proofType',
      message: 'Invalid proof type, must be 0, 1, or 2'
    });
  }

  // Define required fields for each proof type
  const requiredFields = {
    0: ['walletAddress', 'amount'], // STANDARD
    1: ['walletAddress', 'amount', 'threshold'], // THRESHOLD
    2: ['walletAddress', 'amount', 'maximum'] // MAXIMUM
  };

  // Check for required fields based on proof type
  if (proofType !== undefined && requiredFields[proofType]) {
    for (const field of requiredFields[proofType]) {
      if (input[field] === undefined) {
        errors.push({
          field,
          message: `Missing required field: ${field}`
        });
      }
    }
  }

  // Validate wallet address format if provided
  if (input.walletAddress !== undefined) {
    if (typeof input.walletAddress !== 'string') {
      errors.push({
        field: 'walletAddress',
        message: 'Wallet address must be a string'
      });
    } else if (!/^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(input.walletAddress)) {
      errors.push({
        field: 'walletAddress',
        message: 'Invalid wallet address format'
      });
    }
  }

  // Validate amount if provided
  if (input.amount !== undefined) {
    const amount = Number(input.amount);
    if (isNaN(amount) || amount < 0) {
      errors.push({
        field: 'amount',
        message: 'Amount must be a non-negative number or numeric string'
      });
    }
  }

  // Validate threshold if provided (for proof type 1)
  if (input.threshold !== undefined && proofType === 1) {
    const threshold = Number(input.threshold);
    if (isNaN(threshold) || threshold < 0) {
      errors.push({
        field: 'threshold',
        message: 'Threshold must be a non-negative number or numeric string'
      });
    }
  }

  // Validate maximum if provided (for proof type 2)
  if (input.maximum !== undefined && proofType === 2) {
    const maximum = Number(input.maximum);
    if (isNaN(maximum) || maximum < 0) {
      errors.push({
        field: 'maximum',
        message: 'Maximum must be a non-negative number or numeric string'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export const inputValidator = {
  sanitizeInput,
  validateProofInput
};