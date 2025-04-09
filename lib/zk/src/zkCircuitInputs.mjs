/**
 * Zero-Knowledge Circuit Input Preparation (ESM Version)
 * 
 * This module provides functions for preparing and validating inputs for ZK circuits.
 * It handles input formatting, validation, and conversion to circuit-compatible formats.
 */

// Import dependencies for ESM
import { getEthers } from '../../ethersUtils.mjs';
import { toFieldElement } from './zkUtils.mjs';
import errorLogger from './zkErrorLogger.mjs';
import { ZKErrorCode, createZKError, ErrorSeverity } from './zkErrorHandler.mjs';

// Get error logger instance
const { zkErrorLogger } = errorLogger;

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
 * @returns {boolean} True if inputs are valid, false otherwise
 */
export const validateInputs = (inputs, proofType) => {
  if (!inputs || typeof inputs !== 'object') {
    console.error('Invalid inputs: Must provide an object with input values');
    return false;
  }

  if (!proofType || !Object.values(ZK_PROOF_TYPES).includes(proofType)) {
    console.error(`Invalid proof type: ${proofType}. Must be one of: ${Object.values(ZK_PROOF_TYPES).join(', ')}`);
    return false;
  }

  // Check common required fields for all proof types
  if (!inputs.accountAddress) {
    console.error('Missing required field: accountAddress - The account address must be provided');
    return false;
  }

  if (!inputs.tokenSymbol) {
    console.error('Missing required field: tokenSymbol - The token symbol must be provided');
    return false;
  }

  if (inputs.tokenDecimals === undefined) {
    console.error('Missing required field: tokenDecimals - The number of decimals for the token must be provided');
    return false;
  }

  // Check for specific proof type requirements
  switch (proofType) {
    case ZK_PROOF_TYPES.STANDARD:
      if (inputs.amount === undefined) {
        console.error('Missing required field for standard proof: amount - The token amount must be provided');
        return false;
      }
      if (inputs.balance === undefined) {
        console.error('Missing required field for standard proof: balance - The account balance must be provided');
        return false;
      }
      break;

    case ZK_PROOF_TYPES.THRESHOLD:
      if (inputs.threshold === undefined) {
        console.error('Missing required field for threshold proof: threshold - The threshold value must be provided');
        return false;
      }
      if (inputs.balance === undefined) {
        console.error('Missing required field for threshold proof: balance - The account balance must be provided');
        return false;
      }
      break;

    case ZK_PROOF_TYPES.MAXIMUM:
      if (inputs.maximum === undefined) {
        console.error('Missing required field for maximum proof: maximum - The maximum value must be provided');
        return false;
      }
      if (inputs.balance === undefined) {
        console.error('Missing required field for maximum proof: balance - The account balance must be provided');
        return false;
      }
      break;
  }

  return true;
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
  shortenAddress
};