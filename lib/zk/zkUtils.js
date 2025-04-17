/**
 * zkUtils.js
 * 
 * Utilities for generating and verifying zero-knowledge proofs.
 */

import { ethers } from 'ethers';
import { CircuitType } from './zkCircuitRegistry.js';

/**
 * Generates a zero-knowledge proof
 * 
 * @param {Object} params - Parameters for the proof
 * @param {string} params.walletAddress - Ethereum address of the wallet
 * @param {string} params.amount - Amount to prove (exact, minimum, or maximum)
 * @param {string} params.actualBalance - Actual balance (for threshold/maximum proofs)
 * @param {number} params.proofType - Type of proof (0=standard, 1=threshold, 2=maximum)
 * @returns {Promise<Object>} Generated proof and related data
 */
export async function generateZKProof(params) {
  const { walletAddress, amount, actualBalance, proofType } = params;
  
  // Validate wallet address
  if (!walletAddress || !ethers.utils.isAddress(walletAddress)) {
    throw new Error('Invalid Ethereum address');
  }
  
  // Validate amount
  if (!amount) {
    throw new Error('Amount is required');
  }
  
  try {
    ethers.BigNumber.from(amount);
  } catch (error) {
    throw new Error('Invalid amount format - must be a numeric string');
  }
  
  // Get normalized wallet address
  const normalizedAddress = ethers.utils.getAddress(walletAddress);
  
  // Select circuit type based on proof type
  let circuitType;
  switch (proofType) {
    case 0:
      circuitType = CircuitType.STANDARD;
      break;
    case 1:
      circuitType = CircuitType.THRESHOLD;
      
      // For threshold proofs, validate actual balance
      if (!actualBalance) {
        throw new Error('Actual balance is required for threshold proofs');
      }
      
      try {
        const amountBN = ethers.BigNumber.from(amount);
        const actualBalanceBN = ethers.BigNumber.from(actualBalance);
        
        if (actualBalanceBN.lt(amountBN)) {
          throw new Error('Actual balance is less than threshold');
        }
      } catch (error) {
        if (error.message === 'Actual balance is less than threshold') {
          throw error;
        }
        throw new Error('Invalid balance format - must be a numeric string');
      }
      break;
    case 2:
      circuitType = CircuitType.MAXIMUM;
      
      // For maximum proofs, validate actual balance
      if (!actualBalance) {
        throw new Error('Actual balance is required for maximum proofs');
      }
      
      try {
        const amountBN = ethers.BigNumber.from(amount);
        const actualBalanceBN = ethers.BigNumber.from(actualBalance);
        
        if (actualBalanceBN.gt(amountBN)) {
          throw new Error('Actual balance is greater than maximum');
        }
      } catch (error) {
        if (error.message === 'Actual balance is greater than maximum') {
          throw error;
        }
        throw new Error('Invalid balance format - must be a numeric string');
      }
      break;
    default:
      throw new Error(`Unknown proof type: ${proofType}`);
  }
  
  // In a real implementation, this would compute the actual zero-knowledge proof
  // using a circuit based on the circuitType.
  // For now, we just return a mock result with the necessary fields.
  
  return {
    walletAddress: normalizedAddress,
    proofType,
    amount,
    actualBalance: actualBalance || amount,
    timestamp: Date.now(),
    // These would be the actual proof outputs from a ZK library like snarkjs
    proof: {
      pi_a: ['12345', '67890', '54321'],
      pi_b: [['11111', '22222'], ['33333', '44444'], ['55555', '66666']],
      pi_c: ['77777', '88888', '99999']
    },
    publicSignals: ['12345', normalizedAddress.replace('0x', ''), amount]
  };
}

/**
 * Verifies a zero-knowledge proof
 * 
 * @param {Object} params - Parameters for verification
 * @param {Object} params.proof - Proof object from generateZKProof
 * @param {Array} params.publicSignals - Public signals from generateZKProof
 * @param {number} params.proofType - Type of proof (0=standard, 1=threshold, 2=maximum)
 * @returns {Promise<boolean>} True if the proof is valid
 */
export async function verifyZKProof(params) {
  const { proof, publicSignals, proofType } = params;
  
  // Validate parameters
  if (!proof || !publicSignals) {
    throw new Error('Proof and public signals are required');
  }
  
  // Select circuit type based on proof type
  let circuitType;
  switch (proofType) {
    case 0:
      circuitType = CircuitType.STANDARD;
      break;
    case 1:
      circuitType = CircuitType.THRESHOLD;
      break;
    case 2:
      circuitType = CircuitType.MAXIMUM;
      break;
    default:
      throw new Error(`Unknown proof type: ${proofType}`);
  }
  
  // In a real implementation, this would verify the proof using a ZK library like snarkjs
  // For now, we just return true
  
  return true;
}

/**
 * Serializes a proof for transmission or storage
 * 
 * @param {Object} proof - Proof object from generateZKProof
 * @param {Object} options - Serialization options
 * @param {boolean} options.compress - Whether to compress the proof
 * @returns {string} Serialized proof
 */
export function serializeProof(proof, options = { compress: false }) {
  // Convert the proof to a string
  const proofString = JSON.stringify(proof);
  
  // In a real implementation, we would compress the proof if requested
  if (options.compress) {
    // This would use a compression library
    return `compressed:${proofString}`;
  }
  
  return proofString;
}

/**
 * Deserializes a proof from a string
 * 
 * @param {string} serializedProof - Serialized proof from serializeProof
 * @returns {Object} Deserialized proof
 */
export function deserializeProof(serializedProof) {
  // Check if the proof is compressed
  if (serializedProof.startsWith('compressed:')) {
    // In a real implementation, we would decompress the proof
    const proofString = serializedProof.substring('compressed:'.length);
    return JSON.parse(proofString);
  }
  
  // If not compressed, just parse the JSON
  return JSON.parse(serializedProof);
}

export default {
  generateZKProof,
  verifyZKProof,
  serializeProof,
  deserializeProof
};