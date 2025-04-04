/**
 * Zero-Knowledge Proof Generator
 * 
 * A module for generating zero-knowledge proofs for the Proof of Funds protocol.
 * This library integrates with snarkjs to provide ZK circuit functionality for various proof types:
 * - Standard proofs (exact amount verification)
 * - Threshold proofs (minimum amount verification) 
 * - Maximum proofs (maximum amount verification)
 * 
 * The library handles circuit compilation, witness generation, and proof creation
 * in a browser-friendly way.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module is the central engine that creates our privacy-protecting verifications.
 * Think of it like a specialized camera that can take a picture proving you own something
 * valuable, without revealing exactly what you own. When users want to prove they have 
 * funds without showing their exact balance, this module creates a mathematical "proof" 
 * that others can verify without seeing the private details.
 * 
 * For example:
 * - A user can prove they have exactly 5,000 USDC without showing their wallet
 * - A user can prove they have at least $10,000 in ETH without revealing their exact balance
 * - A user can prove they have less than 1 BTC without showing how much they actually own
 * 
 * Business value: Enables users to demonstrate they have sufficient funds for transactions,
 * applications, or financial requirements without compromising their privacy or revealing
 * their exact financial position.
 */

import { initialize } from 'snarkjs';
import { ethers } from 'ethers';
import { generateInputs } from './zkCircuitInputs';
import { serializeProof } from './zkSerialization';
import { getCircuitData } from './zkCircuits';

// Enum for proof types to match smart contract
export const ZK_PROOF_TYPES = {
  STANDARD: 0,
  THRESHOLD: 1,
  MAXIMUM: 2
};

// Initialize snarkjs as a singleton
let snarkjsInstance = null;

/**
 * Initializes the snarkjs library
 * @returns {Promise<Object>} The initialized snarkjs instance
 */
export const initializeSnarkJS = async () => {
  if (!snarkjsInstance) {
    console.log('Initializing snarkjs...');
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
 * Generates a zero-knowledge proof for fund verification
 * @param {Object} params - Parameters for proof generation
 * @param {string} params.walletAddress - User's wallet address
 * @param {string} params.amount - Amount for verification (in wei/lamports)
 * @param {number} params.proofType - Type of proof (from ZK_PROOF_TYPES)
 * @param {Object} params.privateData - Additional private data for the proof
 * @returns {Promise<Object>} Generated proof object
 */
export const generateZKProof = async (params) => {
  const { walletAddress, amount, proofType, privateData } = params;

  // Validate inputs
  if (!walletAddress) throw new Error('Wallet address is required');
  if (!amount) throw new Error('Amount is required');
  if (proofType === undefined) throw new Error('Proof type is required');

  try {
    // Initialize snarkjs if not already initialized
    const snarkjs = await initializeSnarkJS();

    // Generate circuit inputs based on proof type
    const inputs = await generateInputs({
      walletAddress,
      amount,
      proofType,
      privateData
    });

    // Get appropriate circuit based on proof type
    const circuit = getCircuitData(proofType);

    console.log(`Generating ${getProofTypeName(proofType)} proof...`);

    // Generate witness from inputs
    console.log('Calculating witness...');
    const { witness, publicSignals } = await snarkjs.wtns.calculate(
      inputs,
      circuit.wasm,
      circuit.r1cs
    );

    // Generate proof from witness
    console.log('Generating proof from witness...');
    const { proof, publicSignals: proofPublicSignals } = await snarkjs.groth16.prove(
      circuit.zkey,
      witness
    );

    // Serialize the proof for storage and transmission
    const serializedProof = serializeProof(proof, proofPublicSignals);

    return {
      proof: serializedProof.proof,
      publicSignals: serializedProof.publicSignals,
      proofType
    };
  } catch (error) {
    console.error('Error generating ZK proof:', error);
    throw error;
  }
};

/**
 * Generates a proof hash from ZK proof data
 * @param {Object} params - Parameters for hash generation
 * @param {string} params.walletAddress - User's wallet address
 * @param {Object} params.publicSignals - Public signals from the proof
 * @param {number} params.proofType - Type of proof (from ZK_PROOF_TYPES)
 * @returns {Promise<string>} Generated proof hash
 */
export const generateZKProofHash = async (params) => {
  const { walletAddress, publicSignals, proofType } = params;

  // Validate inputs
  if (!walletAddress) throw new Error('Wallet address is required');
  if (!publicSignals) throw new Error('Public signals are required');
  if (proofType === undefined) throw new Error('Proof type is required');

  try {
    // Encode data based on proof type
    const abiCoder = new ethers.utils.AbiCoder();
    let encodedData;

    switch (proofType) {
      case ZK_PROOF_TYPES.STANDARD:
        encodedData = abiCoder.encode(
          ['address', 'bytes', 'uint8'],
          [walletAddress, publicSignals, proofType]
        );
        break;
      case ZK_PROOF_TYPES.THRESHOLD:
        encodedData = abiCoder.encode(
          ['address', 'bytes', 'uint8', 'string'],
          [walletAddress, publicSignals, proofType, 'threshold']
        );
        break;
      case ZK_PROOF_TYPES.MAXIMUM:
        encodedData = abiCoder.encode(
          ['address', 'bytes', 'uint8', 'string'],
          [walletAddress, publicSignals, proofType, 'maximum']
        );
        break;
      default:
        throw new Error(`Unsupported proof type: ${proofType}`);
    }

    // Generate hash
    return ethers.utils.keccak256(encodedData);
  } catch (error) {
    console.error('Error generating ZK proof hash:', error);
    throw error;
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
  ZK_PROOF_TYPES,
  initializeSnarkJS,
  generateZKProof,
  generateZKProofHash
};