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
 * @param {Object} inputs - Circuit inputs
 * @param {number} proofType - Proof type from ZK_PROOF_TYPES
 * @returns {boolean} Whether inputs are valid
 */
export const validateInputs = (inputs, proofType) => {
  try {
    switch (proofType) {
      case ZK_PROOF_TYPES.STANDARD:
        return (
          inputs.privateAmount !== undefined &&
          inputs.privateAddress !== undefined &&
          inputs.publicAmount !== undefined &&
          inputs.publicAddressHash !== undefined
        );
        
      case ZK_PROOF_TYPES.THRESHOLD:
        return (
          inputs.privateAmount !== undefined &&
          inputs.privateAddress !== undefined &&
          inputs.thresholdAmount !== undefined &&
          inputs.publicAddressHash !== undefined
        );
        
      case ZK_PROOF_TYPES.MAXIMUM:
        return (
          inputs.privateAmount !== undefined &&
          inputs.privateAddress !== undefined &&
          inputs.maximumAmount !== undefined &&
          inputs.publicAddressHash !== undefined
        );
        
      default:
        return false;
    }
  } catch (error) {
    console.error('Error validating inputs:', error);
    return false;
  }
};

export default {
  generateInputs,
  extractPublicInputs,
  validateInputs,
  addressToBytes
};