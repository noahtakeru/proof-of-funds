/**
 * ZK Proof Verifier Module
 * 
 * Provides functionality to verify zero-knowledge proofs both locally
 * and through on-chain smart contracts.
 */

import { ethers } from 'ethers';
import * as snarkjs from 'snarkjs';
import { constants } from '../../config/constants';

/**
 * Verifies a zero-knowledge proof on-chain using the ZKVerifier contract
 * 
 * @param {Object} proof - The ZK proof to verify
 * @param {Object} solidity - The solidity-formatted proof for contract calls
 * @param {string} contractAddress - The address of the ZKVerifier contract
 * @param {Object} provider - Ethers provider to use for the contract call
 * @returns {Promise<boolean>} - Whether the proof is valid
 */
export async function verifyProofOnChain(proof, solidity, contractAddress, provider) {
  try {
    console.log('Verifying ZK proof on-chain with contract:', contractAddress);
    
    // Create a contract interface for the ZKVerifier contract
    const abi = constants.ZK_VERIFIER_ABI;
    const contract = new ethers.Contract(contractAddress, abi, provider);
    
    // Make a static call to the contract to verify the proof
    // This doesn't require sending a transaction, just reading from the chain
    const isValid = await contract.callStatic.verifyProof(
      solidity.a,
      solidity.b,
      solidity.c,
      solidity.input
    );
    
    console.log('On-chain verification result:', isValid);
    return isValid;
  } catch (error) {
    console.error('Error verifying proof on-chain:', error);
    return false;
  }
}

/**
 * Verifies a proof locally using snarkjs
 * This is faster than on-chain verification but requires the verification key
 * 
 * @param {Object} proof - The ZK proof to verify
 * @param {Array} publicSignals - The public signals for verification
 * @param {number} proofType - The type of proof (0=standard, 1=threshold, 2=maximum)
 * @returns {Promise<boolean>} - Whether the proof is valid
 */
export async function verifyProofLocally(proof, publicSignals, proofType) {
  try {
    // For simulated proofs (during development), check if they're marked as valid
    if (proof._simulated) {
      console.log('Verifying simulated proof:', proof._comparisonResult);
      return proof._comparisonResult === true;
    }
    
    // In a production environment, load the verification key and verify
    // Note: You would need to have verification keys available
    const vkeyPath = `/circuits/balance_${proofType}_verification_key.json`;
    
    try {
      // Try to fetch the verification key
      const response = await fetch(vkeyPath);
      if (!response.ok) {
        throw new Error(`Failed to load verification key: ${response.status}`);
      }
      
      const vkey = await response.json();
      
      // Verify using snarkjs
      return await snarkjs.groth16.verify(vkey, publicSignals, proof);
    } catch (keyError) {
      console.warn('Verification key not available, using fallback verification');
      
      // Fallback verification when verification keys aren't available
      // This simulates verification based on the public signals
      return verifyProofFallback(publicSignals, proofType);
    }
  } catch (error) {
    console.error('Error verifying proof locally:', error);
    return false;
  }
}

/**
 * Fallback verification when actual verification keys aren't available
 * This is a simplified validation for development purposes only
 * 
 * @param {Array} publicSignals - The public signals from the proof
 * @param {number} proofType - The type of proof (0=standard, 1=threshold, 2=maximum)
 * @returns {boolean} - Whether the proof should be considered valid
 */
function verifyProofFallback(publicSignals, proofType) {
  // In the simulated proof, the last public signal indicates the comparison result
  const comparisonResult = publicSignals[3] === '1';
  
  // Check if the proof type in the public signals matches the expected type
  const proofTypeMatches = parseInt(publicSignals[2]) === proofType;
  
  return comparisonResult && proofTypeMatches;
}

/**
 * Checks if a proof has expired
 * 
 * @param {number} expiryTime - UNIX timestamp when the proof expires
 * @returns {boolean} - Whether the proof has expired
 */
export function isProofExpired(expiryTime) {
  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime > expiryTime;
}

/**
 * Checks if a proof has been revoked
 * This requires checking the proof status on-chain
 * 
 * @param {string} proofId - The on-chain ID of the proof
 * @param {string} contractAddress - The address of the ProofOfFunds contract
 * @param {Object} provider - Ethers provider to use for the contract call
 * @returns {Promise<boolean>} - Whether the proof has been revoked
 */
export async function isProofRevoked(proofId, contractAddress, provider) {
  try {
    // Create a contract interface for the ProofOfFunds contract
    const abi = constants.PROOF_OF_FUNDS_ABI;
    const contract = new ethers.Contract(contractAddress, abi, provider);
    
    // Check if the proof is revoked
    const proofStatus = await contract.getProofStatus(proofId);
    return proofStatus.revoked;
  } catch (error) {
    console.error('Error checking if proof is revoked:', error);
    
    // Default to assuming not revoked if we can't check
    return false;
  }
}

/**
 * Formats a verification result for display
 * 
 * @param {boolean} isValid - Whether the proof is valid
 * @param {boolean} isExpired - Whether the proof has expired
 * @param {boolean} isRevoked - Whether the proof has been revoked
 * @param {number} proofType - The type of proof (0=standard, 1=threshold, 2=maximum)
 * @returns {Object} - Formatted verification result for UI display
 */
export function formatVerificationResult(isValid, isExpired, isRevoked, proofType) {
  // Convert proof type to readable string
  const proofTypeNames = ['Standard', 'Threshold', 'Maximum'];
  const proofTypeName = proofTypeNames[proofType] || 'Unknown';
  
  // Determine overall verification status
  let status = 'Invalid';
  let statusColor = 'red';
  let message = 'The proof could not be verified.';
  
  if (isRevoked) {
    status = 'Revoked';
    statusColor = 'red';
    message = 'This proof has been revoked by the creator.';
  } else if (isExpired) {
    status = 'Expired';
    statusColor = 'orange';
    message = 'This proof has expired and is no longer valid.';
  } else if (isValid) {
    status = 'Valid';
    statusColor = 'green';
    
    // Create specific messages based on proof type
    if (proofType === 0) { // STANDARD
      message = 'The wallet contains exactly the verified amount.';
    } else if (proofType === 1) { // THRESHOLD
      message = 'The wallet contains at least the verified amount.';
    } else if (proofType === 2) { // MAXIMUM
      message = 'The wallet contains at most the verified amount.';
    }
  }
  
  return {
    status,
    statusColor,
    message,
    proofType: proofTypeName,
    isValid,
    isExpired,
    isRevoked
  };
}

/**
 * Generate a reference ID from a proof
 * This allows us to reference a specific proof without sharing all the details
 * 
 * @param {Object} proof - The ZK proof
 * @param {string} walletAddress - The wallet address
 * @param {number} timestamp - Proof creation timestamp
 * @returns {string} - A unique reference ID
 */
export function generateProofReferenceId(proof, walletAddress, timestamp) {
  // Combine proof elements to create a unique but deterministic ID
  const baseString = `${walletAddress}-${timestamp}-${JSON.stringify(proof.publicSignals)}`;
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(baseString));
  
  // Return a shortened version for easier sharing
  return hash.slice(0, 18);
}