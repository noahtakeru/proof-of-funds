/**
 * Zero-Knowledge Circuit Input Preparation (ESM Version)
 * 
 * This module provides functions for preparing and validating inputs for ZK circuits.
 * It handles input formatting, validation, and conversion to circuit-compatible formats.
 */

// Import dependencies for ESM
import { getEthers } from '../../ethersUtils.mjs';
import { toFieldElement } from './zkUtils.mjs';
import { zkErrorLogger } from './zkErrorLogger.mjs';
import { ZKErrorCode, createZKError, ErrorSeverity } from './zkErrorHandler.mjs';

/**
 * Defines the supported types of zero-knowledge proofs in the system
 * @typedef {Object} ZK_PROOF_TYPES
 * @property {string} STANDARD - Exact amount proof (proves user has exactly X tokens)
 * @property {string} THRESHOLD - Minimum amount proof (proves user has at least X tokens)
 * @property {string} MAXIMUM - Maximum amount proof (proves user has at most X tokens) 
 * @property {string} BATCH - Batch proof for multiple assets (combines multiple proofs)
 */
export const ZK_PROOF_TYPES = {
  STANDARD: 'standard',
  THRESHOLD: 'threshold',
  MAXIMUM: 'maximum',
  BATCH: 'batch'
};

/**
 * Converts an Ethereum address to array of bytes for use in ZK circuits
 * @param {string} address - The Ethereum address to convert (with or without 0x prefix)
 * @returns {Array<number>} Array of individual bytes representing the address
 * @throws {ZKError} If the address is invalid or conversion fails
 */
export const addressToBytes = (address) => {
  try {
    // Validate input
    if (!address || typeof address !== 'string') {
      throw createZKError(
        ZKErrorCode.INVALID_ADDRESS,
        'Invalid Ethereum address: address must be a non-empty string',
        {
          severity: ErrorSeverity.ERROR,
          details: {
            addressType: typeof address,
            provided: !!address
          },
          recoverable: false,
          userFixable: true
        }
      );
    }

    // Remove 0x prefix if present
    const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;

    // Validate address length (should be 40 characters without prefix)
    if (cleanAddress.length !== 40) {
      throw createZKError(
        ZKErrorCode.INVALID_ADDRESS,
        `Invalid Ethereum address length: expected 40 hex chars, got ${cleanAddress.length}`,
        {
          severity: ErrorSeverity.ERROR,
          details: {
            addressLength: cleanAddress.length,
            expectedLength: 40
          },
          recoverable: false,
          userFixable: true
        }
      );
    }

    // Validate address is hex format
    if (!/^[0-9a-fA-F]+$/.test(cleanAddress)) {
      throw createZKError(
        ZKErrorCode.INVALID_ADDRESS,
        'Invalid Ethereum address: must contain only hex characters',
        {
          severity: ErrorSeverity.ERROR,
          details: {
            hasNonHexChars: true
          },
          recoverable: false,
          userFixable: true
        }
      );
    }

    // Convert to bytes
    const bytes = [];
    for (let i = 0; i < cleanAddress.length; i += 2) {
      bytes.push(parseInt(cleanAddress.slice(i, i + 2), 16));
    }

    return bytes;
  } catch (error) {
    // Handle errors that aren't already ZKErrors
    if (!error.code || !error.name || error.name !== 'ZKError') {
      error = createZKError(
        ZKErrorCode.ADDRESS_CONVERSION_FAILED,
        `Failed to convert address to bytes: ${error.message}`,
        {
          severity: ErrorSeverity.ERROR,
          details: { originalError: error.message },
          recoverable: false,
          userFixable: true
        }
      );
    }

    // Log the error
    zkErrorLogger.logError(error, {
      context: 'addressToBytes',
      input: typeof address === 'string' ?
        (address.startsWith('0x') ? address.slice(0, 8) + '...' : address.slice(0, 6) + '...') :
        typeof address
    });

    throw error;
  }
};

/**
 * Extracts the public inputs from circuit inputs for a specific proof type
 * These are the inputs that will be publicly visible on the blockchain
 * 
 * @param {Object} inputs - The circuit inputs containing both public and private data
 * @param {string} proofType - The type of proof being generated (standard, threshold, maximum)
 * @returns {Object} Public inputs that can be safely shared
 * @throws {ZKError} If the proof type is invalid or inputs are incomplete
 */
export const extractPublicInputs = (inputs, proofType) => {
  try {
    // Validate inputs
    if (!inputs || typeof inputs !== 'object') {
      throw createZKError(
        ZKErrorCode.INVALID_CIRCUIT_INPUTS,
        'Invalid circuit inputs: must be a non-empty object',
        {
          severity: ErrorSeverity.ERROR,
          details: {
            inputsType: typeof inputs,
            hasInputs: !!inputs
          },
          recoverable: false,
          userFixable: true
        }
      );
    }

    if (!proofType || typeof proofType !== 'string') {
      throw createZKError(
        ZKErrorCode.INVALID_PROOF_TYPE,
        `Invalid proof type: ${proofType}`,
        {
          severity: ErrorSeverity.ERROR,
          details: {
            proofTypeProvided: proofType,
            validTypes: Object.values(ZK_PROOF_TYPES)
          },
          recoverable: false,
          userFixable: true
        }
      );
    }

    // Extract public inputs based on proof type
    switch (proofType) {
      case ZK_PROOF_TYPES.STANDARD:
        // Validate required fields for standard proof
        if (!inputs.publicAmount) {
          throw createZKError(
            ZKErrorCode.MISSING_PUBLIC_INPUT,
            'Missing required public input: publicAmount',
            {
              severity: ErrorSeverity.ERROR,
              details: { missingField: 'publicAmount' },
              recoverable: false,
              userFixable: true
            }
          );
        }
        if (!inputs.publicAddressHash) {
          throw createZKError(
            ZKErrorCode.MISSING_PUBLIC_INPUT,
            'Missing required public input: publicAddressHash',
            {
              severity: ErrorSeverity.ERROR,
              details: { missingField: 'publicAddressHash' },
              recoverable: false,
              userFixable: true
            }
          );
        }
        return {
          publicAmount: inputs.publicAmount,
          publicAddressHash: inputs.publicAddressHash
        };

      case ZK_PROOF_TYPES.THRESHOLD:
        // Validate required fields for threshold proof
        if (!inputs.thresholdAmount) {
          throw createZKError(
            ZKErrorCode.MISSING_PUBLIC_INPUT,
            'Missing required public input: thresholdAmount',
            {
              severity: ErrorSeverity.ERROR,
              details: { missingField: 'thresholdAmount' },
              recoverable: false,
              userFixable: true
            }
          );
        }
        if (!inputs.publicAddressHash) {
          throw createZKError(
            ZKErrorCode.MISSING_PUBLIC_INPUT,
            'Missing required public input: publicAddressHash',
            {
              severity: ErrorSeverity.ERROR,
              details: { missingField: 'publicAddressHash' },
              recoverable: false,
              userFixable: true
            }
          );
        }
        return {
          thresholdAmount: inputs.thresholdAmount,
          publicAddressHash: inputs.publicAddressHash
        };

      case ZK_PROOF_TYPES.MAXIMUM:
        // Validate required fields for maximum proof
        if (!inputs.maximumAmount) {
          throw createZKError(
            ZKErrorCode.MISSING_PUBLIC_INPUT,
            'Missing required public input: maximumAmount',
            {
              severity: ErrorSeverity.ERROR,
              details: { missingField: 'maximumAmount' },
              recoverable: false,
              userFixable: true
            }
          );
        }
        if (!inputs.publicAddressHash) {
          throw createZKError(
            ZKErrorCode.MISSING_PUBLIC_INPUT,
            'Missing required public input: publicAddressHash',
            {
              severity: ErrorSeverity.ERROR,
              details: { missingField: 'publicAddressHash' },
              recoverable: false,
              userFixable: true
            }
          );
        }
        return {
          maximumAmount: inputs.maximumAmount,
          publicAddressHash: inputs.publicAddressHash
        };

      default:
        throw createZKError(
          ZKErrorCode.INVALID_PROOF_TYPE,
          `Invalid proof type: ${proofType}. Expected one of: ${Object.values(ZK_PROOF_TYPES).join(', ')}`,
          {
            severity: ErrorSeverity.ERROR,
            details: {
              providedType: proofType,
              validTypes: Object.values(ZK_PROOF_TYPES)
            },
            recoverable: false,
            userFixable: true
          }
        );
    }
  } catch (error) {
    // Log error with context
    zkErrorLogger.logError(error, {
      context: 'extractPublicInputs',
      proofType,
      inputFields: inputs ? Object.keys(inputs).join(',') : 'none'
    });
    throw error;
  }
};

/**
 * Verify that inputs are valid for a specific circuit
 * @param {Object} inputs - The inputs to validate
 * @param {string} proofType - The type of proof being generated
 * @returns {Object} Validation results with status and errors
 */
export const validateInputs = (inputs, proofType) => {
  const operationId = `validate_inputs_${Date.now()}`;

  try {
    // Create validation schema based on proof type
    const commonSchema = {
      accountAddress: {
        type: 'address',
        required: true,
        options: {}
      },
      tokenSymbol: {
        type: 'string',
        required: true,
        options: {
          maxStringLength: 10
        }
      },
      tokenDecimals: {
        type: 'number',
        required: true,
        options: {
          minNumber: 0,
          maxNumber: 30,
          allowNegative: false
        }
      }
    };

    // Add proof-type specific validation rules
    let proofSchema = {};

    switch (proofType) {
      case ZK_PROOF_TYPES.STANDARD:
        proofSchema = {
          amount: {
            type: 'number',
            required: true,
            options: {
              minNumber: 0,
              allowNegative: false
            },
            validate: (value) => value > 0 || 'Amount must be greater than zero'
          },
          balance: {
            type: 'number',
            required: true,
            options: {
              minNumber: 0,
              allowNegative: false
            }
          }
        };
        break;

      case ZK_PROOF_TYPES.THRESHOLD:
        proofSchema = {
          threshold: {
            type: 'number',
            required: true,
            options: {
              minNumber: 0,
              allowNegative: false
            },
            validate: (value) => value > 0 || 'Threshold must be greater than zero'
          },
          balance: {
            type: 'number',
            required: true,
            options: {
              minNumber: 0,
              allowNegative: false
            }
          }
        };
        break;

      case ZK_PROOF_TYPES.MAXIMUM:
        proofSchema = {
          maximum: {
            type: 'number',
            required: true,
            options: {
              minNumber: 0,
              allowNegative: false
            },
            validate: (value) => value > 0 || 'Maximum value must be greater than zero'
          },
          balance: {
            type: 'number',
            required: true,
            options: {
              minNumber: 0,
              allowNegative: false
            }
          }
        };
        break;

      default:
        // Validate the proof type
        if (!proofType || !Object.values(ZK_PROOF_TYPES).includes(proofType)) {
          return {
            valid: false,
            errors: {
              proofType: createUserFriendlyError(
                ZKErrorCode.INVALID_PROOF_TYPE,
                `Invalid proof type: ${proofType}. Must be one of: ${Object.values(ZK_PROOF_TYPES).join(', ')}`,
                {
                  severity: ErrorSeverity.ERROR,
                  operationId,
                  details: {
                    providedType: proofType,
                    validTypes: Object.values(ZK_PROOF_TYPES)
                  },
                  recoverable: false,
                  userFixable: true
                }
              )
            }
          };
        }
    }

    // Combine schemas
    const schema = { ...commonSchema, ...proofSchema };

    // Validate all inputs against the schema
    const validationResults = validateCircuitInputs(inputs, schema);

    // Add special validation for balance being greater than or equal to amount
    if (validationResults.valid) {
      // For standard proof type, verify balance >= amount
      if (proofType === ZK_PROOF_TYPES.STANDARD &&
        validationResults.sanitizedInputs.balance < validationResults.sanitizedInputs.amount) {
        validationResults.valid = false;
        validationResults.errors.balance = createUserFriendlyError(
          ZKErrorCode.INVALID_CIRCUIT_INPUT,
          'Balance must be greater than or equal to the specified amount',
          {
            severity: ErrorSeverity.ERROR,
            operationId,
            details: {
              fieldName: 'balance',
              balance: validationResults.sanitizedInputs.balance,
              amount: validationResults.sanitizedInputs.amount
            },
            recoverable: false,
            userFixable: true,
            params: { errorType: 'BALANCE_INSUFFICIENT' }
          }
        );
      }

      // For threshold proof type, verify balance >= threshold
      if (proofType === ZK_PROOF_TYPES.THRESHOLD &&
        validationResults.sanitizedInputs.balance < validationResults.sanitizedInputs.threshold) {
        validationResults.valid = false;
        validationResults.errors.balance = createUserFriendlyError(
          ZKErrorCode.INVALID_CIRCUIT_INPUT,
          'Balance must be greater than or equal to the threshold value',
          {
            severity: ErrorSeverity.ERROR,
            operationId,
            details: {
              fieldName: 'balance',
              balance: validationResults.sanitizedInputs.balance,
              threshold: validationResults.sanitizedInputs.threshold
            },
            recoverable: false,
            userFixable: true,
            params: { errorType: 'BALANCE_INSUFFICIENT' }
          }
        );
      }
    }

    // For backward compatibility, also log errors to console
    if (!validationResults.valid) {
      Object.keys(validationResults.errors).forEach(fieldName => {
        const error = validationResults.errors[fieldName];
        console.error(`Validation error for ${fieldName}: ${error.message}`);
      });
    }

    return validationResults;
  } catch (error) {
    // Handle unexpected errors
    const validationError = error.name === 'ZKError' ? error : createZKError(
      ZKErrorCode.CIRCUIT_INPUT_VALIDATION_FAILED,
      `Unexpected error validating inputs: ${error.message}`,
      {
        severity: ErrorSeverity.ERROR,
        operationId,
        details: { originalError: error.message },
        recoverable: false,
        userFixable: false
      }
    );

    zkErrorLogger.logError(validationError, {
      context: 'validateInputs',
      proofType
    });

    // Log to console for backward compatibility
    console.error(`Validation error: ${validationError.message}`);

    return {
      valid: false,
      errors: {
        global: validationError
      }
    };
  }
};

/**
 * Shortens an Ethereum address for display purposes
 * @param {string} address - The address to shorten
 * @param {number} chars - Number of characters to keep at each end
 * @returns {string} Shortened address
 */
export function shortenAddress(address, chars = 4) {
  if (!address || typeof address !== 'string') {
    return '';
  }

  const prefix = address.startsWith('0x') ? '0x' : '';
  const addr = address.startsWith('0x') ? address.slice(2) : address;

  if (addr.length <= chars * 2) {
    return address;
  }

  return `${prefix}${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

/**
 * Prepares inputs for a zk circuit based on the type of proof
 * @param {Object} inputs - Raw input values
 * @param {string} proofType - Type of proof to generate
 * @returns {Object} Formatted circuit inputs
 */
export const prepareCircuitInputs = async (inputs, proofType) => {
  // ESM implementation
  return { meta: { proofType, timestamp: Date.now() }, ...inputs };
};

/**
 * Normalizes token balance according to decimals
 * @param {string|number} balance - The raw balance
 * @param {number} decimals - Number of token decimals
 * @returns {string} Normalized balance as string
 */
export const normalizeBalance = (balance, decimals) => {
  // ESM implementation
  return String(balance);
};

/**
 * Creates a human-readable description of a proof
 * @param {Object} inputs - The circuit inputs
 * @param {string} proofType - The type of proof
 * @returns {string} Human-readable description
 */
export const createProofDescription = (inputs, proofType) => {
  if (!inputs || !proofType) {
    return 'Invalid proof';
  }

  return `Proof of funds for ${shortenAddress(inputs.accountAddress || '')}`;
};

/**
 * Generates circuit inputs from parameters
 * @param {Object} params - Parameters for generating inputs
 * @returns {Object} Generated inputs for the circuit
 */
export const generateInputs = async (params) => {
  const { walletAddress, amount, proofType } = params;
  const { ethers } = await getEthers();

  return {
    privateAddress: addressToBytes(walletAddress),
    publicAddressHash: ethers.utils.keccak256(walletAddress),
    publicAmount: amount
  };
};

/**
 * Sanitizes and validates circuit input values based on their type
 * 
 * @param {any} input - The input value to sanitize
 * @param {string} fieldType - The expected type of the field
 * @param {Object} options - Additional options for sanitization
 * @param {boolean} options.allowEmpty - Whether empty values are allowed
 * @param {number} options.maxStringLength - Maximum allowed string length
 * @param {number} options.minNumber - Minimum allowed number value
 * @param {number} options.maxNumber - Maximum allowed number value
 * @param {boolean} options.allowNegative - Whether negative numbers are allowed
 * @param {string} fieldName - Name of the field (for error messages)
 * @returns {any} The sanitized input value
 * @throws {ZKError} If the input is invalid or cannot be sanitized
 */
export const sanitizeCircuitInput = (input, fieldType, options = {}, fieldName = 'field') => {
  const operationId = `sanitize_input_${Date.now()}`;

  // Set defaults for options
  const {
    allowEmpty = false,
    maxStringLength = 1024,
    minNumber = Number.MIN_SAFE_INTEGER,
    maxNumber = Number.MAX_SAFE_INTEGER,
    allowNegative = false,
  } = options;

  try {
    // Handle null or undefined
    if (input === null || input === undefined) {
      if (allowEmpty) {
        return null;
      }
      throw createZKError(
        ZKErrorCode.INVALID_CIRCUIT_INPUT,
        `${fieldName} cannot be null or undefined`,
        {
          severity: ErrorSeverity.ERROR,
          operationId,
          details: {
            fieldName,
            input: null,
            fieldType
          },
          recoverable: false,
          userFixable: true
        }
      );
    }

    // Handle different field types
    switch (fieldType) {
      case 'string':
        // Convert input to string if it's not already
        const stringValue = String(input);

        // Check for empty string
        if (stringValue.length === 0 && !allowEmpty) {
          throw createZKError(
            ZKErrorCode.INVALID_CIRCUIT_INPUT,
            `${fieldName} cannot be empty`,
            {
              severity: ErrorSeverity.ERROR,
              operationId,
              details: {
                fieldName,
                input: '',
                fieldType
              },
              recoverable: false,
              userFixable: true
            }
          );
        }

        // Check string length
        if (stringValue.length > maxStringLength) {
          throw createZKError(
            ZKErrorCode.INVALID_CIRCUIT_INPUT,
            `${fieldName} exceeds maximum length of ${maxStringLength} characters`,
            {
              severity: ErrorSeverity.ERROR,
              operationId,
              details: {
                fieldName,
                inputLength: stringValue.length,
                maxLength: maxStringLength,
                input: stringValue.substring(0, 20) + '...'
              },
              recoverable: false,
              userFixable: true
            }
          );
        }

        // Sanitize string: remove control characters and trim
        return stringValue
          .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
          .trim();

      case 'number':
        // Handle conversion to number
        let numValue;

        if (typeof input === 'string') {
          // Remove any non-numeric characters except decimal point and minus
          const cleanedInput = input.replace(/[^\d.-]/g, '');

          // Check if it's a valid number
          if (!/^-?\d*\.?\d*$/.test(cleanedInput)) {
            throw createZKError(
              ZKErrorCode.INVALID_CIRCUIT_INPUT,
              `${fieldName} contains invalid characters for a number`,
              {
                severity: ErrorSeverity.ERROR,
                operationId,
                details: {
                  fieldName,
                  input,
                  fieldType
                },
                recoverable: false,
                userFixable: true
              }
            );
          }

          numValue = parseFloat(cleanedInput);
        } else {
          numValue = Number(input);
        }

        // Check if it's a valid number
        if (isNaN(numValue) || !isFinite(numValue)) {
          throw createZKError(
            ZKErrorCode.INVALID_CIRCUIT_INPUT,
            `${fieldName} is not a valid number`,
            {
              severity: ErrorSeverity.ERROR,
              operationId,
              details: {
                fieldName,
                input,
                fieldType,
                isNaN: isNaN(numValue),
                isFinite: isFinite(numValue)
              },
              recoverable: false,
              userFixable: true
            }
          );
        }

        // Check for negative when not allowed
        if (!allowNegative && numValue < 0) {
          throw createZKError(
            ZKErrorCode.INVALID_CIRCUIT_INPUT,
            `${fieldName} cannot be negative`,
            {
              severity: ErrorSeverity.ERROR,
              operationId,
              details: {
                fieldName,
                input: numValue,
                fieldType
              },
              recoverable: false,
              userFixable: true
            }
          );
        }

        // Enforce min/max bounds
        if (numValue < minNumber) {
          throw createZKError(
            ZKErrorCode.INVALID_CIRCUIT_INPUT,
            `${fieldName} is below the minimum value of ${minNumber}`,
            {
              severity: ErrorSeverity.ERROR,
              operationId,
              details: {
                fieldName,
                input: numValue,
                minValue: minNumber,
                fieldType
              },
              recoverable: false,
              userFixable: true
            }
          );
        }

        if (numValue > maxNumber) {
          throw createZKError(
            ZKErrorCode.INVALID_CIRCUIT_INPUT,
            `${fieldName} exceeds the maximum value of ${maxNumber}`,
            {
              severity: ErrorSeverity.ERROR,
              operationId,
              details: {
                fieldName,
                input: numValue,
                maxValue: maxNumber,
                fieldType
              },
              recoverable: false,
              userFixable: true
            }
          );
        }

        return numValue;

      case 'boolean':
        // Convert to boolean using standard JavaScript truthiness
        return Boolean(input);

      case 'address':
        // Ensure it's a string
        if (typeof input !== 'string') {
          throw createZKError(
            ZKErrorCode.INVALID_CIRCUIT_INPUT,
            `${fieldName} must be a string`,
            {
              severity: ErrorSeverity.ERROR,
              operationId,
              details: {
                fieldName,
                inputType: typeof input,
                fieldType
              },
              recoverable: false,
              userFixable: true
            }
          );
        }

        // Remove 0x prefix if present
        const cleanAddress = input.startsWith('0x') ? input.slice(2) : input;

        // Validate address length (should be 40 characters without prefix)
        if (cleanAddress.length !== 40) {
          throw createZKError(
            ZKErrorCode.INVALID_CIRCUIT_INPUT,
            `${fieldName} has invalid length: expected 40 hex chars, got ${cleanAddress.length}`,
            {
              severity: ErrorSeverity.ERROR,
              operationId,
              details: {
                fieldName,
                addressLength: cleanAddress.length,
                expectedLength: 40,
                fieldType
              },
              recoverable: false,
              userFixable: true
            }
          );
        }

        // Validate address is hex format
        if (!/^[0-9a-fA-F]+$/.test(cleanAddress)) {
          throw createZKError(
            ZKErrorCode.INVALID_CIRCUIT_INPUT,
            `${fieldName} must contain only hexadecimal characters`,
            {
              severity: ErrorSeverity.ERROR,
              operationId,
              details: {
                fieldName,
                hasNonHexChars: true,
                fieldType
              },
              recoverable: false,
              userFixable: true
            }
          );
        }

        // Ensure it's returned with 0x prefix
        return `0x${cleanAddress.toLowerCase()}`;

      case 'bigint':
        // Handle big integers carefully
        let bigIntValue;

        try {
          if (typeof input === 'string') {
            // Clean the string of any non-numeric characters
            const cleanedInput = input.replace(/[^\d.-]/g, '');
            bigIntValue = BigInt(cleanedInput);
          } else {
            bigIntValue = BigInt(input);
          }
        } catch (error) {
          throw createZKError(
            ZKErrorCode.INVALID_CIRCUIT_INPUT,
            `${fieldName} is not a valid big integer: ${error.message}`,
            {
              severity: ErrorSeverity.ERROR,
              operationId,
              details: {
                fieldName,
                input: String(input),
                fieldType,
                originalError: error.message
              },
              recoverable: false,
              userFixable: true
            }
          );
        }

        // Check for negative when not allowed
        if (!allowNegative && bigIntValue < 0n) {
          throw createZKError(
            ZKErrorCode.INVALID_CIRCUIT_INPUT,
            `${fieldName} cannot be negative`,
            {
              severity: ErrorSeverity.ERROR,
              operationId,
              details: {
                fieldName,
                input: String(bigIntValue),
                fieldType
              },
              recoverable: false,
              userFixable: true
            }
          );
        }

        // Check min/max if they're defined as BigInts
        if (typeof options.minBigInt === 'bigint' && bigIntValue < options.minBigInt) {
          throw createZKError(
            ZKErrorCode.INVALID_CIRCUIT_INPUT,
            `${fieldName} is below the minimum value`,
            {
              severity: ErrorSeverity.ERROR,
              operationId,
              details: {
                fieldName,
                input: String(bigIntValue),
                minValue: String(options.minBigInt),
                fieldType
              },
              recoverable: false,
              userFixable: true
            }
          );
        }

        if (typeof options.maxBigInt === 'bigint' && bigIntValue > options.maxBigInt) {
          throw createZKError(
            ZKErrorCode.INVALID_CIRCUIT_INPUT,
            `${fieldName} exceeds the maximum value`,
            {
              severity: ErrorSeverity.ERROR,
              operationId,
              details: {
                fieldName,
                input: String(bigIntValue),
                maxValue: String(options.maxBigInt),
                fieldType
              },
              recoverable: false,
              userFixable: true
            }
          );
        }

        return bigIntValue;

      case 'array':
        // Ensure it's an array
        if (!Array.isArray(input)) {
          throw createZKError(
            ZKErrorCode.INVALID_CIRCUIT_INPUT,
            `${fieldName} must be an array`,
            {
              severity: ErrorSeverity.ERROR,
              operationId,
              details: {
                fieldName,
                inputType: typeof input,
                fieldType
              },
              recoverable: false,
              userFixable: true
            }
          );
        }

        // Check array length if minLength/maxLength are provided
        if (options.minLength !== undefined && input.length < options.minLength) {
          throw createZKError(
            ZKErrorCode.INVALID_CIRCUIT_INPUT,
            `${fieldName} must have at least ${options.minLength} items`,
            {
              severity: ErrorSeverity.ERROR,
              operationId,
              details: {
                fieldName,
                inputLength: input.length,
                minLength: options.minLength,
                fieldType
              },
              recoverable: false,
              userFixable: true
            }
          );
        }

        if (options.maxLength !== undefined && input.length > options.maxLength) {
          throw createZKError(
            ZKErrorCode.INVALID_CIRCUIT_INPUT,
            `${fieldName} cannot have more than ${options.maxLength} items`,
            {
              severity: ErrorSeverity.ERROR,
              operationId,
              details: {
                fieldName,
                inputLength: input.length,
                maxLength: options.maxLength,
                fieldType
              },
              recoverable: false,
              userFixable: true
            }
          );
        }

        // If itemType is provided, sanitize each item in the array
        if (options.itemType) {
          return input.map((item, index) =>
            sanitizeCircuitInput(
              item,
              options.itemType,
              options.itemOptions || {},
              `${fieldName}[${index}]`
            )
          );
        }

        return input;

      default:
        // For unknown types, just return the input as is
        return input;
    }
  } catch (error) {
    // If it's already a ZKError, just log and rethrow
    if (error.name === 'ZKError') {
      zkErrorLogger.logError(error, {
        context: 'sanitizeCircuitInput',
        fieldName,
        fieldType
      });
      throw error;
    }

    // Otherwise, wrap in a ZKError
    const zkError = createZKError(
      ZKErrorCode.CIRCUIT_INPUT_SANITIZATION_FAILED,
      `Failed to sanitize ${fieldName}: ${error.message}`,
      {
        severity: ErrorSeverity.ERROR,
        operationId,
        details: {
          fieldName,
          fieldType,
          originalError: error.message,
          input: String(input).substring(0, 100)
        },
        recoverable: false,
        userFixable: true
      }
    );

    zkErrorLogger.logError(zkError, {
      context: 'sanitizeCircuitInput',
      fieldName,
      fieldType
    });

    throw zkError;
  }
};

/**
 * Maps technical error codes to user-friendly messages
 */
export const USER_FRIENDLY_ERROR_MESSAGES = {
  // Address errors
  [ZKErrorCode.INVALID_ADDRESS]: 'The wallet address is not valid. Please check the address and try again.',
  [ZKErrorCode.ADDRESS_CONVERSION_FAILED]: 'We couldn\'t process the wallet address. Please check that it\'s a valid Ethereum address.',

  // Circuit input errors
  [ZKErrorCode.INVALID_CIRCUIT_INPUT]: 'There\'s a problem with one of the values you provided. Please check your input and try again.',
  [ZKErrorCode.INVALID_CIRCUIT_INPUTS]: 'Some of the information you provided isn\'t in the right format. Please double-check your inputs.',
  [ZKErrorCode.MISSING_PUBLIC_INPUT]: 'Some required information is missing. Please provide all necessary details.',
  [ZKErrorCode.CIRCUIT_INPUT_SANITIZATION_FAILED]: 'We couldn\'t process one of your inputs. Please check your information and try again.',

  // Proof type errors
  [ZKErrorCode.INVALID_PROOF_TYPE]: 'The selected verification type is not supported. Please choose a valid option.',

  // Generic errors
  [ZKErrorCode.UNKNOWN_ERROR]: 'Something went wrong. Please try again or contact support if the problem persists.',
  [ZKErrorCode.OPERATION_FAILED]: 'The operation couldn\'t be completed. Please try again later.',

  // Field-specific errors - these will be used for specific error cases
  'AMOUNT_TOO_LARGE': 'The amount you entered is too large. Please enter a smaller number.',
  'AMOUNT_TOO_SMALL': 'The amount you entered is too small. Please enter a larger number.',
  'AMOUNT_NEGATIVE': 'The amount cannot be negative. Please enter a positive number.',
  'AMOUNT_INVALID_FORMAT': 'The amount format is invalid. Please enter a number.',
  'ADDRESS_WRONG_LENGTH': 'The wallet address has the wrong length. Ethereum addresses must be 42 characters (including 0x).',
  'ADDRESS_INVALID_FORMAT': 'The wallet address contains invalid characters. Ethereum addresses must contain only hexadecimal characters (0-9, a-f).',
  'BALANCE_INSUFFICIENT': 'The account balance is insufficient for this operation.',
  'TOKEN_UNSUPPORTED': 'The selected token is not supported for this operation.'
};

/**
 * Gets a user-friendly error message for a technical error
 * 
 * @param {Error|string} error - The error object or code
 * @param {Object} params - Additional parameters for the message
 * @returns {string} User-friendly error message
 */
export const getUserFriendlyErrorMessage = (error, params = {}) => {
  // Handle string error codes
  if (typeof error === 'string') {
    return USER_FRIENDLY_ERROR_MESSAGES[error] || USER_FRIENDLY_ERROR_MESSAGES[ZKErrorCode.UNKNOWN_ERROR];
  }

  // Handle ZKError objects
  if (error && error.name === 'ZKError' && error.code) {
    // Get the base message for this error code
    let message = USER_FRIENDLY_ERROR_MESSAGES[error.code] || USER_FRIENDLY_ERROR_MESSAGES[ZKErrorCode.UNKNOWN_ERROR];

    // Add specific field information if available
    if (error.details && error.details.fieldName) {
      message = message.replace('one of the values', `the ${error.details.fieldName}`);
      message = message.replace('one of your inputs', `your ${error.details.fieldName}`);
    }

    // Add specific guidance for some error types
    if (error.code === ZKErrorCode.INVALID_CIRCUIT_INPUT) {
      if (error.details) {
        // Handle specific validation failures
        if (error.details.inputLength && error.details.maxLength) {
          return `The ${error.details.fieldName} is too long. Please use fewer than ${error.details.maxLength} characters.`;
        }
        if (error.details.inputLength && error.details.minLength) {
          return `The ${error.details.fieldName} is too short. Please provide at least ${error.details.minLength} characters.`;
        }
        if (error.details.maxValue !== undefined && error.details.input !== undefined) {
          return `The ${error.details.fieldName} is too large. Maximum allowed value is ${error.details.maxValue}.`;
        }
        if (error.details.minValue !== undefined && error.details.input !== undefined) {
          return `The ${error.details.fieldName} is too small. Minimum allowed value is ${error.details.minValue}.`;
        }
        if (error.details.hasNonHexChars) {
          return `The ${error.details.fieldName} contains invalid characters. Please use only hexadecimal characters (0-9, a-f).`;
        }
      }
    }

    // For address validation failures
    if (error.code === ZKErrorCode.INVALID_ADDRESS) {
      if (error.details) {
        if (error.details.addressLength) {
          return USER_FRIENDLY_ERROR_MESSAGES['ADDRESS_WRONG_LENGTH'];
        }
        if (error.details.hasNonHexChars) {
          return USER_FRIENDLY_ERROR_MESSAGES['ADDRESS_INVALID_FORMAT'];
        }
      }
    }

    return message;
  }

  // Handle generic Error objects
  if (error instanceof Error) {
    return USER_FRIENDLY_ERROR_MESSAGES[ZKErrorCode.UNKNOWN_ERROR];
  }

  // Fallback for unknown error types
  return 'An unexpected error occurred. Please try again or contact support.';
};

/**
 * Creates an error object with both technical and user-friendly messages
 * 
 * @param {string} code - Error code
 * @param {string} technicalMessage - Technical error message
 * @param {Object} options - Error options 
 * @returns {Object} Error object with user-friendly message
 */
export const createUserFriendlyError = (code, technicalMessage, options = {}) => {
  // Create the technical error
  const error = createZKError(code, technicalMessage, options);

  // Add user-friendly message
  error.userFriendlyMessage = getUserFriendlyErrorMessage(error, options.params);

  return error;
};

/**
 * Validates circuit inputs against a set of constraints
 * 
 * @param {string} inputName - Name of the input field
 * @param {any} inputValue - The value to validate
 * @param {Object} constraints - Validation constraints
 * @param {string} constraints.type - Expected type (string, number, boolean, address, etc.)
 * @param {boolean} constraints.required - Whether the field is required
 * @param {Object} constraints.options - Additional type-specific options
 * @returns {Object} Validation result with status and error information
 */
export const validateCircuitInput = (inputName, inputValue, constraints) => {
  const operationId = `validate_circuit_input_${Date.now()}`;

  try {
    // Check required constraint
    if (constraints.required && (inputValue === undefined || inputValue === null)) {
      return {
        valid: false,
        error: createUserFriendlyError(
          ZKErrorCode.MISSING_PUBLIC_INPUT,
          `Missing required input: ${inputName}`,
          {
            severity: ErrorSeverity.ERROR,
            operationId,
            details: { fieldName: inputName, missingField: inputName },
            recoverable: false,
            userFixable: true
          }
        )
      };
    }

    // Skip validation if value is not provided and not required
    if ((inputValue === undefined || inputValue === null) && !constraints.required) {
      return { valid: true };
    }

    // Type validation and sanitization
    try {
      const sanitizedValue = sanitizeCircuitInput(
        inputValue,
        constraints.type,
        constraints.options || {},
        inputName
      );

      // Additional custom validations based on field type
      if (constraints.type === 'number' || constraints.type === 'bigint') {
        // For amount fields, check specific constraints
        if (inputName.toLowerCase().includes('amount') ||
          inputName.toLowerCase().includes('balance') ||
          inputName.toLowerCase().includes('threshold') ||
          inputName.toLowerCase().includes('maximum')) {

          if (constraints.type === 'number' && sanitizedValue <= 0) {
            return {
              valid: false,
              error: createUserFriendlyError(
                ZKErrorCode.INVALID_CIRCUIT_INPUT,
                `${inputName} must be greater than zero`,
                {
                  severity: ErrorSeverity.ERROR,
                  operationId,
                  details: {
                    fieldName: inputName,
                    input: sanitizedValue,
                    fieldType: constraints.type
                  },
                  recoverable: false,
                  userFixable: true,
                  params: { errorType: 'AMOUNT_NEGATIVE' }
                }
              )
            };
          }
        }
      }

      // Pass constraints.validate function for custom validation logic
      if (typeof constraints.validate === 'function') {
        const customValidationResult = constraints.validate(sanitizedValue);

        if (customValidationResult !== true) {
          const errorMessage = typeof customValidationResult === 'string'
            ? customValidationResult
            : `${inputName} failed custom validation`;

          return {
            valid: false,
            error: createUserFriendlyError(
              ZKErrorCode.INVALID_CIRCUIT_INPUT,
              errorMessage,
              {
                severity: ErrorSeverity.ERROR,
                operationId,
                details: {
                  fieldName: inputName,
                  input: typeof sanitizedValue === 'object' ? 'object' : String(sanitizedValue),
                  fieldType: constraints.type,
                  customValidation: true
                },
                recoverable: false,
                userFixable: true
              }
            )
          };
        }
      }

      // All validations passed
      return {
        valid: true,
        sanitizedValue
      };
    } catch (error) {
      // The sanitizeCircuitInput function already creates appropriate ZKError
      return {
        valid: false,
        error
      };
    }
  } catch (error) {
    // Handle unexpected errors
    const validationError = error.name === 'ZKError' ? error : createZKError(
      ZKErrorCode.CIRCUIT_INPUT_VALIDATION_FAILED,
      `Unexpected error validating ${inputName}: ${error.message}`,
      {
        severity: ErrorSeverity.ERROR,
        operationId,
        details: {
          fieldName: inputName,
          originalError: error.message
        },
        recoverable: false,
        userFixable: false
      }
    );

    zkErrorLogger.logError(validationError, {
      context: 'validateCircuitInput',
      fieldName: inputName,
      constraints
    });

    return {
      valid: false,
      error: validationError
    };
  }
};

/**
 * Validates all inputs for a circuit against a schema
 * 
 * @param {Object} inputs - The input values to validate
 * @param {Object} schema - Schema defining validation rules for each field
 * @returns {Object} Validation results with status and errors
 */
export const validateCircuitInputs = (inputs, schema) => {
  const results = {
    valid: true,
    errors: {},
    sanitizedInputs: {}
  };

  // Validate each field according to schema
  for (const fieldName in schema) {
    if (schema.hasOwnProperty(fieldName)) {
      const constraints = schema[fieldName];
      const fieldValue = inputs[fieldName];

      const fieldResult = validateCircuitInput(fieldName, fieldValue, constraints);

      if (!fieldResult.valid) {
        results.valid = false;
        results.errors[fieldName] = fieldResult.error;
      } else if (fieldResult.sanitizedValue !== undefined) {
        results.sanitizedInputs[fieldName] = fieldResult.sanitizedValue;
      }
    }
  }

  return results;
};

/**
 * Propagates validation errors to UI components
 * 
 * @param {Object} error - The validation error
 * @param {Object} options - Options for error propagation
 * @param {string} options.component - Target UI component
 * @param {string} options.fieldMapping - How to map error fields to UI fields
 * @returns {Object} Formatted error for UI consumption
 */
export const propagateValidationError = (error, options = {}) => {
  // Create a user-friendly error object for UI display
  const uiError = {
    field: error.details?.fieldName || error.details?.field || 'unknown',
    message: error.userFriendlyMessage || getUserFriendlyErrorMessage(error),
    technical: error.message,
    code: error.code,
    timestamp: Date.now(),
    id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    component: options.component || 'global'
  };

  // Add severity level for UI styling
  switch (error.severity) {
    case ErrorSeverity.WARNING:
      uiError.severity = 'warning';
      break;
    case ErrorSeverity.ERROR:
      uiError.severity = 'error';
      break;
    case ErrorSeverity.CRITICAL:
      uiError.severity = 'critical';
      break;
    default:
      uiError.severity = 'info';
  }

  // Add fixable flag for UI guidance
  uiError.fixable = error.userFixable === true;

  // Map to component-specific field if needed
  if (options.fieldMapping && options.fieldMapping[uiError.field]) {
    uiError.uiField = options.fieldMapping[uiError.field];
  } else {
    uiError.uiField = uiError.field;
  }

  // Log the UI error being propagated
  zkErrorLogger.log('INFO', 'Propagating validation error to UI', {
    context: 'propagateValidationError',
    component: uiError.component,
    field: uiError.field,
    uiField: uiError.uiField,
    errorId: uiError.id
  });

  return uiError;
};

/**
 * Propagates multiple validation errors to UI components
 * 
 * @param {Object} validationResults - Results from validateCircuitInputs
 * @param {Object} options - Options for error propagation
 * @returns {Object} Formatted errors for UI consumption
 */
export const propagateValidationErrors = (validationResults, options = {}) => {
  if (validationResults.valid) {
    return { hasErrors: false };
  }

  const uiErrors = {};
  let firstErrorField = null;

  // Convert each error to UI format
  for (const fieldName in validationResults.errors) {
    if (validationResults.errors.hasOwnProperty(fieldName)) {
      const error = validationResults.errors[fieldName];
      uiErrors[fieldName] = propagateValidationError(error, options);

      if (!firstErrorField) {
        firstErrorField = fieldName;
      }
    }
  }

  return {
    hasErrors: true,
    errors: uiErrors,
    // Include first error for easy access (useful for showing first error message)
    firstError: firstErrorField ? uiErrors[firstErrorField] : null,
    // Include a summary message combining all errors
    summary: Object.values(uiErrors)
      .map(err => err.message)
      .join('. ')
  };
};

// Default export for compatibility
export default {
  ZK_PROOF_TYPES,
  validateInputs,
  prepareCircuitInputs,
  normalizeBalance,
  createProofDescription,
  addressToBytes,
  extractPublicInputs,
  generateInputs,
  shortenAddress,
  sanitizeCircuitInput,
  getUserFriendlyErrorMessage,
  createUserFriendlyError,
  validateCircuitInput,
  validateCircuitInputs,
  propagateValidationError,
  propagateValidationErrors,
  USER_FRIENDLY_ERROR_MESSAGES
};