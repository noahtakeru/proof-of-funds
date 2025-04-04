/**
 * Zero-Knowledge Circuit Input Generation
 * 
 * This module provides utilities to generate inputs for the zero-knowledge circuits.
 * It converts user data into the format required by the ZK circuits.
 */

import { ethers } from 'ethers';
import { ZK_PROOF_TYPES } from '../../config/constants';

/**
 * Converts an Ethereum address to array of bytes
 * @param {string} address - Ethereum address
 * @returns {Array<number>} Array of byte values (0-255)
 */
const addressToBytes = (address) => {
  // Remove 0x prefix if present
  const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;

  // Convert to bytes
  const bytes = [];
  for (let i = 0; i < cleanAddress.length; i += 2) {
    bytes.push(parseInt(cleanAddress.slice(i, i + 2), 16));
  }

  return bytes;
};

/**
 * Generates inputs for the ZK circuit based on proof type
 * @param {Object} params - Parameters for input generation
 * @param {string} params.walletAddress - Wallet address
 * @param {string} params.amount - Amount for verification
 * @param {number} params.proofType - Proof type from ZK_PROOF_TYPES
 * @param {Object} params.privateData - Additional private data
 * @returns {Object} Inputs for the ZK circuit
 */
export const generateInputs = async (params) => {
  const { walletAddress, amount, proofType, privateData = {} } = params;

  // Validate inputs
  if (!walletAddress) throw new Error('Wallet address is required');
  if (!amount) throw new Error('Amount is required');
  if (proofType === undefined) throw new Error('Proof type is required');

  // Convert address to bytes for the circuit
  const addressBytes = addressToBytes(walletAddress);

  // Convert amount to a numeric value
  // In a real implementation, this would handle different token decimals
  let numericAmount;
  try {
    // If amount is in wei (string), convert to numeric
    numericAmount = ethers.BigNumber.from(amount).toString();
  } catch (e) {
    // If conversion fails, assume it's already a number/string
    numericAmount = amount.toString();
  }

  // Calculate address hash (simplified version)
  // In a real implementation, this would use a proper hash function
  const addressHash = ethers.utils.keccak256(walletAddress);

  // Generate circuit-specific inputs
  switch (proofType) {
    case ZK_PROOF_TYPES.STANDARD:
      return {
        // Private inputs (only known to the prover)
        privateAmount: numericAmount,
        privateAddress: addressBytes,

        // Public inputs (shared with verifier)
        publicAmount: numericAmount,
        publicAddressHash: addressHash
      };

    case ZK_PROOF_TYPES.THRESHOLD:
      return {
        // Private inputs
        privateAmount: numericAmount,
        privateAddress: addressBytes,

        // Public inputs
        thresholdAmount: numericAmount,
        publicAddressHash: addressHash
      };

    case ZK_PROOF_TYPES.MAXIMUM:
      return {
        // Private inputs
        privateAmount: numericAmount,
        privateAddress: addressBytes,

        // Public inputs
        maximumAmount: numericAmount,
        publicAddressHash: addressHash
      };

    default:
      throw new Error(`Invalid proof type: ${proofType}`);
  }
};

/**
 * Extract public inputs from circuit inputs
 * @param {Object} inputs - Full circuit inputs
 * @param {number} proofType - Proof type from ZK_PROOF_TYPES
 * @returns {Object} Only the public inputs
 */
export const extractPublicInputs = (inputs, proofType) => {
  switch (proofType) {
    case ZK_PROOF_TYPES.STANDARD:
      return {
        publicAmount: inputs.publicAmount,
        publicAddressHash: inputs.publicAddressHash
      };

    case ZK_PROOF_TYPES.THRESHOLD:
      return {
        thresholdAmount: inputs.thresholdAmount,
        publicAddressHash: inputs.publicAddressHash
      };

    case ZK_PROOF_TYPES.MAXIMUM:
      return {
        maximumAmount: inputs.maximumAmount,
        publicAddressHash: inputs.publicAddressHash
      };

    default:
      throw new Error(`Invalid proof type: ${proofType}`);
  }
};

/**
 * Verify that inputs are valid for a specific circuit
 * Validates that all required parameters are present and properly formatted for the specific
 * proof type before passing to the circuit. This helps prevent errors during proof generation.
 * 
 * @param {Object} inputs - Circuit inputs
 * @param {number} proofType - Proof type from ZK_PROOF_TYPES
 * @returns {boolean} Whether inputs are valid
 */
export const validateInputs = (inputs, proofType) => {
  try {
    // Check if inputs object exists
    if (!inputs) {
      console.error('Validation failed: inputs object is null or undefined');
      return false;
    }

    // Check if proofType is valid
    if (proofType === undefined) {
      console.error('Validation failed: proofType is undefined');
      return false;
    }

    // Validate common fields that all proof types need
    const hasCommonFields = (
      inputs.privateAddress !== undefined &&
      Array.isArray(inputs.privateAddress) &&
      inputs.publicAddressHash !== undefined
    );

    if (!hasCommonFields) {
      console.error('Validation failed: missing common fields');
      return false;
    }

    // Validate proof-specific fields
    switch (proofType) {
      case ZK_PROOF_TYPES.STANDARD:
        // Standard proof requires exact amount fields
        if (inputs.privateAmount === undefined) {
          console.error('Validation failed: standard proof requires privateAmount');
          return false;
        }
        if (inputs.publicAmount === undefined) {
          console.error('Validation failed: standard proof requires publicAmount');
          return false;
        }
        return true;

      case ZK_PROOF_TYPES.THRESHOLD:
        // Threshold proof requires amount and threshold
        if (inputs.privateAmount === undefined) {
          console.error('Validation failed: threshold proof requires privateAmount');
          return false;
        }
        if (inputs.thresholdAmount === undefined) {
          console.error('Validation failed: threshold proof requires thresholdAmount');
          return false;
        }
        return true;

      case ZK_PROOF_TYPES.MAXIMUM:
        // Maximum proof requires amount and maximum
        if (inputs.privateAmount === undefined) {
          console.error('Validation failed: maximum proof requires privateAmount');
          return false;
        }
        if (inputs.maximumAmount === undefined) {
          console.error('Validation failed: maximum proof requires maximumAmount');
          return false;
        }
        return true;

      default:
        console.error(`Validation failed: unknown proof type: ${proofType}`);
        return false;
    }
  } catch (error) {
    console.error('Error during input validation:', error);
    return false;
  }
};

// Export addressToBytes as it wasn't exported above
export { addressToBytes };