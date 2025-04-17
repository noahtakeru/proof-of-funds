/**
 * zkCircuitParameterDerivation.js
 * 
 * Functions for deriving and validating parameters for ZK circuits.
 */

import { ethers } from 'ethers';

/**
 * Convert an Ethereum address to byte array
 * 
 * @param {string} address - Ethereum address
 * @returns {Uint8Array} Byte array representation (20 bytes)
 */
function addressToBytes(address) {
  if (!ethers.utils.isAddress(address)) {
    throw new Error('Invalid Ethereum address');
  }
  
  // Remove 0x prefix and clean up address format
  const cleanAddress = ethers.utils.getAddress(address).substring(2);
  
  // Convert hex string to byte array
  const bytes = new Uint8Array(20);
  for (let i = 0; i < 20; i++) {
    bytes[i] = parseInt(cleanAddress.substring(i * 2, i * 2 + 2), 16);
  }
  
  return bytes;
}

/**
 * Derive circuit parameters for a standard proof
 * This proves a wallet contains EXACTLY the claimed amount
 * 
 * @param {Object} params - Input parameters
 * @param {string} params.walletAddress - Ethereum address
 * @param {string} params.amount - Amount (as string)
 * @returns {Object} Circuit parameters
 */
export function deriveStandardProofParameters(params) {
  const { walletAddress, amount } = params;
  
  // Validate inputs
  if (!walletAddress || !amount) {
    throw new Error('Missing required parameters: walletAddress, amount');
  }
  
  if (!ethers.utils.isAddress(walletAddress)) {
    throw new Error('Invalid Ethereum address');
  }
  
  try {
    // Try to parse the amount as a BigNumber to ensure it's valid
    ethers.BigNumber.from(amount);
  } catch (error) {
    throw new Error('Invalid amount - must be a valid numeric string');
  }
  
  // Get canonical address form
  const canonicalAddress = ethers.utils.getAddress(walletAddress);
  
  // Convert address to bytes for the circuit
  const addressBytes = Array.from(addressToBytes(canonicalAddress));
  
  // Generate a random nonce for the proof
  const nonce = Math.floor(Math.random() * 1000000);
  
  // Build circuit parameters
  return {
    publicInputs: {
      address: canonicalAddress,
      amount
    },
    privateInputs: {
      addressBytes,
      nonce,
      // For a standard proof, the private actualBalance equals the public amount
      actualBalance: amount
    },
    meta: {
      proofType: 'standard',
      timestamp: Date.now()
    }
  };
}

/**
 * Derive circuit parameters for a threshold proof
 * This proves a wallet contains AT LEAST the threshold amount
 * 
 * @param {Object} params - Input parameters
 * @param {string} params.walletAddress - Ethereum address
 * @param {string} params.amount - Threshold amount (as string)
 * @param {string} params.actualBalance - Actual wallet balance (as string)
 * @returns {Object} Circuit parameters
 */
export function deriveThresholdProofParameters(params) {
  const { walletAddress, amount, actualBalance } = params;
  
  // Validate inputs
  if (!walletAddress || !amount || !actualBalance) {
    throw new Error('Missing required parameters: walletAddress, amount, actualBalance');
  }
  
  if (!ethers.utils.isAddress(walletAddress)) {
    throw new Error('Invalid Ethereum address');
  }
  
  try {
    // Parse both amounts as BigNumber to validate and compare
    const thresholdAmount = ethers.BigNumber.from(amount);
    const balance = ethers.BigNumber.from(actualBalance);
    
    // Ensure actual balance >= threshold
    if (balance.lt(thresholdAmount)) {
      throw new Error('Actual balance is less than threshold - cannot generate valid proof');
    }
  } catch (error) {
    if (error.message.includes('cannot generate valid proof')) {
      throw error;
    }
    throw new Error('Invalid amount values - must be valid numeric strings');
  }
  
  // Get canonical address form
  const canonicalAddress = ethers.utils.getAddress(walletAddress);
  
  // Convert address to bytes for the circuit
  const addressBytes = Array.from(addressToBytes(canonicalAddress));
  
  // Generate a random nonce for the proof
  const nonce = Math.floor(Math.random() * 1000000);
  
  // Build circuit parameters
  return {
    publicInputs: {
      address: canonicalAddress,
      threshold: amount
    },
    privateInputs: {
      addressBytes,
      nonce,
      actualBalance
    },
    meta: {
      proofType: 'threshold',
      timestamp: Date.now()
    }
  };
}

/**
 * Derive circuit parameters for a maximum proof
 * This proves a wallet contains AT MOST the maximum amount
 * 
 * @param {Object} params - Input parameters
 * @param {string} params.walletAddress - Ethereum address
 * @param {string} params.amount - Maximum amount (as string)
 * @param {string} params.actualBalance - Actual wallet balance (as string)
 * @returns {Object} Circuit parameters
 */
export function deriveMaximumProofParameters(params) {
  const { walletAddress, amount, actualBalance } = params;
  
  // Validate inputs
  if (!walletAddress || !amount || !actualBalance) {
    throw new Error('Missing required parameters: walletAddress, amount, actualBalance');
  }
  
  if (!ethers.utils.isAddress(walletAddress)) {
    throw new Error('Invalid Ethereum address');
  }
  
  try {
    // Parse both amounts as BigNumber to validate and compare
    const maximumAmount = ethers.BigNumber.from(amount);
    const balance = ethers.BigNumber.from(actualBalance);
    
    // Ensure actual balance <= maximum
    if (balance.gt(maximumAmount)) {
      throw new Error('Actual balance is greater than maximum - cannot generate valid proof');
    }
  } catch (error) {
    if (error.message.includes('cannot generate valid proof')) {
      throw error;
    }
    throw new Error('Invalid amount values - must be valid numeric strings');
  }
  
  // Get canonical address form
  const canonicalAddress = ethers.utils.getAddress(walletAddress);
  
  // Convert address to bytes for the circuit
  const addressBytes = Array.from(addressToBytes(canonicalAddress));
  
  // Generate a random nonce for the proof
  const nonce = Math.floor(Math.random() * 1000000);
  
  // Build circuit parameters
  return {
    publicInputs: {
      address: canonicalAddress,
      maximum: amount
    },
    privateInputs: {
      addressBytes,
      nonce,
      actualBalance
    },
    meta: {
      proofType: 'maximum',
      timestamp: Date.now()
    }
  };
}

/**
 * Derive circuit parameters based on proof type
 * 
 * @param {Object} params - Input parameters including proofType
 * @returns {Object} Circuit parameters
 */
export function deriveCircuitParameters(params) {
  const { proofType } = params;
  
  switch (proofType) {
    case 'standard':
      return deriveStandardProofParameters(params);
    case 'threshold':
      return deriveThresholdProofParameters(params);
    case 'maximum':
      return deriveMaximumProofParameters(params);
    default:
      throw new Error(`Unknown proof type: ${proofType}`);
  }
}

export default {
  deriveStandardProofParameters,
  deriveThresholdProofParameters,
  deriveMaximumProofParameters,
  deriveCircuitParameters
};