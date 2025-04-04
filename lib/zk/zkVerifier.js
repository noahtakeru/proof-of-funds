/**
 * Zero-Knowledge Proof Verifier
 * 
 * A module for verifying zero-knowledge proofs in the Proof of Funds protocol.
 * This library handles verification of different types of proofs:
 * - Standard proofs (exact amount verification)
 * - Threshold proofs (minimum amount verification) 
 * - Maximum proofs (maximum amount verification)
 * 
 * Provides both client-side and smart contract verification options.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module acts as the verification system for our privacy-protecting proofs.
 * Think of it like a specialized scanner that can check if a document is authentic
 * without seeing all the private details. When someone presents a proof that they have
 * sufficient funds, this module can verify if that proof is valid without ever seeing
 * the actual account balance or private wallet information.
 * 
 * For example:
 * - When a loan application requires proof of $50,000 in assets, this verifier can confirm
 *   the proof is valid without seeing the applicant's actual balances or wallet addresses
 * - When a membership requires having less than 5 BTC, this verifier confirms the user
 *   qualifies without revealing their exact holdings
 * 
 * Business value: Enables third parties to confidently verify a user's financial status
 * (whether they have sufficient funds) without compromising user privacy, thus
 * maintaining the confidentiality of sensitive financial information while providing
 * the trust needed for financial transactions.
 */

import { initialize } from 'snarkjs';
import { deserializeProof } from './zkSerialization';
import { getCircuitData } from './zkCircuits';
import { ZK_PROOF_TYPES } from './zkProofGenerator';
import { ethers } from 'ethers';
import { ZK_VERIFIER_ADDRESS, ZK_VERIFIER_ABI } from '../../config/constants';

// Initialize snarkjs as a singleton
let snarkjsInstance = null;

/**
 * Initializes the snarkjs library
 * @returns {Promise<Object>} The initialized snarkjs instance
 */
export const initializeSnarkJS = async () => {
  if (!snarkjsInstance) {
    console.log('Initializing snarkjs for verification...');
    try {
      snarkjsInstance = await initialize();
      console.log('snarkjs initialized successfully');
    } catch (error) {
      console.error('Failed to initialize snarkjs:', error);
      throw error;
    }
  }
  return snarkjsInstance;
};

/**
 * Verifies a zero-knowledge proof client-side
 * @param {Object} params - Parameters for proof verification
 * @param {string} params.proof - The serialized proof to verify
 * @param {string} params.publicSignals - Public signals from the proof
 * @param {number} params.proofType - Type of proof (from ZK_PROOF_TYPES)
 * @returns {Promise<boolean>} Whether the proof is valid
 */
export const verifyZKProof = async (params) => {
  const { proof, publicSignals, proofType } = params;

  // Validate inputs
  if (!proof) throw new Error('Proof is required');
  if (!publicSignals) throw new Error('Public signals are required');
  if (proofType === undefined) throw new Error('Proof type is required');

  try {
    // Initialize snarkjs if not already initialized
    const snarkjs = await initializeSnarkJS();

    // Deserialize the proof
    const deserializedProof = deserializeProof(proof, publicSignals);

    // Get appropriate verification key based on proof type
    const circuit = getCircuitData(proofType);
    const verificationKey = circuit.vkey;

    console.log(`Verifying ${getProofTypeName(proofType)} proof...`);

    // Verify the proof
    const isValid = await snarkjs.groth16.verify(
      verificationKey,
      deserializedProof.publicSignals,
      deserializedProof.proof
    );

    console.log(`Proof verification result: ${isValid ? 'Valid' : 'Invalid'}`);
    return isValid;
  } catch (error) {
    console.error('Error verifying ZK proof:', error);
    return false;
  }
};

/**
 * Verifies a zero-knowledge proof using the smart contract
 * @param {Object} params - Parameters for contract-based verification
 * @param {string} params.walletAddress - User's wallet address
 * @param {Object|string} params.provider - Ethers provider or RPC URL
 * @returns {Promise<boolean>} Whether the proof is valid according to the contract
 */
export const verifyZKProofOnChain = async (params) => {
  const { walletAddress, provider } = params;

  // Validate inputs
  if (!walletAddress) throw new Error('Wallet address is required');
  if (!provider) throw new Error('Provider is required');

  try {
    // Create ethers provider from string URL if needed
    const ethersProvider = typeof provider === 'string'
      ? new ethers.providers.JsonRpcProvider(provider)
      : provider;

    // Connect to the ZKVerifier contract
    const zkVerifier = new ethers.Contract(
      ZK_VERIFIER_ADDRESS,
      ZK_VERIFIER_ABI,
      ethersProvider
    );

    // Call the verifyZKProof function
    console.log(`Verifying proof for wallet ${walletAddress} on-chain...`);
    const isValid = await zkVerifier.verifyZKProof(walletAddress);

    console.log(`On-chain verification result: ${isValid ? 'Valid' : 'Invalid'}`);
    return isValid;
  } catch (error) {
    console.error('Error verifying ZK proof on-chain:', error);
    return false;
  }
};

/**
 * Gets a human-readable name for a proof type
 * @param {number} proofType - The proof type enum value
 * @returns {string} Human-readable proof type name
 */
const getProofTypeName = (proofType) => {
  switch (proofType) {
    case ZK_PROOF_TYPES.STANDARD:
      return 'Standard';
    case ZK_PROOF_TYPES.THRESHOLD:
      return 'Threshold';
    case ZK_PROOF_TYPES.MAXIMUM:
      return 'Maximum';
    default:
      return 'Unknown';
  }
};

// Export core functionality
export default {
  verifyZKProof,
  verifyZKProofOnChain
};