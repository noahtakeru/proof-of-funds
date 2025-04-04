/**
 * Zero-Knowledge Proof Utilities
 * 
 * Core utilities for ZK proof generation and verification in the Proof of Funds protocol.
 * This module integrates with the existing UI components in pages/create.js and pages/verify.js
 * by providing ZK alternatives to the standard proof functions.
 */

// Use dynamic import for snarkjs to handle failures gracefully
import { ethers } from 'ethers';
import { ZK_PROOF_TYPES } from '../../config/constants';
import CryptoJS from 'crypto-js';

// Singleton for snarkjs instance
let snarkjsInstance = null;

/**
 * Initializes the snarkjs library - only loads once
 * @returns {Promise<Object>} The initialized snarkjs instance
 */
export const initializeSnarkJS = async () => {
  if (!snarkjsInstance) {
    console.log('Initializing snarkjs...');
    try {
      // Try to dynamically import snarkjs
      const snarkjs = await import('snarkjs').catch(e => null);

      if (snarkjs) {
        // Modern versions may have an initialize method
        if (typeof snarkjs.initialize === 'function') {
          snarkjsInstance = await snarkjs.initialize();
          console.log('snarkjs initialized successfully with initialize()');
        } else {
          // Older versions or direct import may not need initialization
          snarkjsInstance = snarkjs;
          console.log('snarkjs loaded without initialization');
        }
      } else {
        // Fall back to mock if snarkjs is not available
        throw new Error('snarkjs not available');
      }
    } catch (error) {
      console.error('Failed to initialize snarkjs:', error);
      // Always provide a mock implementation to ensure testing works
      console.log('Creating mock snarkjs implementation for development/testing');
      snarkjsInstance = createMockSnarkjs();
    }
  }
  return snarkjsInstance;
};

/**
 * Creates a mock snarkjs implementation for development
 * @returns {Object} A mock snarkjs implementation
 */
const createMockSnarkjs = () => {
  return {
    groth16: {
      prove: async () => ({
        proof: {
          pi_a: ['1', '2', '3'],
          pi_b: [['4', '5'], ['6', '7'], ['8', '9']],
          pi_c: ['10', '11', '12']
        },
        publicSignals: ['13', '14', '15']
      }),
      verify: async () => true
    },
    wtns: {
      calculate: async () => ({
        witness: [1, 2, 3],
        publicSignals: ['13', '14', '15']
      })
    }
  };
};

/**
 * Generates a zero-knowledge proof for fund verification
 * Integrates with the existing proof generation workflow in create.js
 * 
 * @param {Object} params Parameters for proof generation
 * @param {string} params.walletAddress - User's wallet address
 * @param {string} params.amount - Amount to verify (in wei/lamports)
 * @param {number} params.proofType - Type of proof (from ZK_PROOF_TYPES)
 * @returns {Promise<Object>} Generated proof object
 */
export const generateZKProof = async (params) => {
  const { walletAddress, amount, proofType } = params;

  // Validate inputs
  if (!walletAddress) throw new Error('Wallet address is required');
  if (!amount) throw new Error('Amount is required');
  if (proofType === undefined) throw new Error('Proof type is required');

  try {
    // Initialize snarkjs if not already done
    const snarkjs = await initializeSnarkJS();

    // In a full implementation, we would:
    // 1. Use a real circuit based on the proof type
    // 2. Generate inputs for the circuit
    // 3. Execute the ZK proof generation

    console.log(`Generating ${getProofTypeName(proofType)} ZK proof for wallet ${walletAddress}, amount ${amount}`);

    // For now, we'll create a placeholder proof structure
    // In production, this would come from actual snarkjs circuit execution
    const { proof, publicSignals } = await executeZKProofGeneration(walletAddress, amount, proofType);

    // Serialize the proof data for storage/transmission
    const serializedProof = serializeZKProof(proof, publicSignals);

    return {
      walletAddress,
      proofType,
      amount,
      timestamp: Date.now(),
      // The serialized proof data
      proof: serializedProof.proof,
      publicSignals: serializedProof.publicSignals
    };
  } catch (error) {
    console.error('Error generating ZK proof:', error);
    throw new Error(`Failed to generate ZK proof: ${error.message}`);
  }
};

/**
 * Executes the actual ZK proof generation
 * @param {string} walletAddress - User's wallet address 
 * @param {string} amount - Amount to verify
 * @param {number} proofType - Type of proof
 * @returns {Promise<Object>} Raw proof and public signals
 */
async function executeZKProofGeneration(walletAddress, amount, proofType) {
  const snarkjs = await initializeSnarkJS();

  // In development mode or if testing, we return a deterministic proof
  // This would be replaced with actual circuit execution in production
  if (process.env.NODE_ENV === 'development' || typeof window === 'undefined') {
    // Create a deterministic "proof" based on inputs for testing
    console.log('Using development mode ZK proof generation');

    // Create a hash of the inputs to simulate a unique proof
    const inputHash = CryptoJS.SHA256(`${walletAddress}-${amount}-${proofType}`).toString();

    // Create a deterministic proof structure based on the hash
    return {
      proof: {
        pi_a: [inputHash.substring(0, 10), inputHash.substring(10, 20), "1"],
        pi_b: [
          [inputHash.substring(20, 30), inputHash.substring(30, 40)],
          [inputHash.substring(40, 50), inputHash.substring(50, 60)],
          ["1", "0"]
        ],
        pi_c: [inputHash.substring(60, 70), inputHash.substring(70, 80), "1"],
        protocol: "groth16"
      },
      publicSignals: [
        walletAddress.toLowerCase(),  // Address as a public signal
        amount,                       // Amount as a public signal
        Date.now().toString()         // Timestamp as a public signal
      ]
    };
  }

  // In production, we would:
  // 1. Load the appropriate circuit files (wasm, r1cs, zkey)
  // 2. Generate witness from inputs
  // 3. Generate proof from witness

  throw new Error('Production ZK proof generation not yet implemented');
}

/**
 * Verifies a zero-knowledge proof
 * @param {Object} params Parameters for proof verification
 * @param {string} params.proof - The serialized proof to verify
 * @param {string} params.publicSignals - The serialized public signals
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
    // Initialize snarkjs if not already done
    const snarkjs = await initializeSnarkJS();

    // Deserialize the proof data
    const deserializedData = deserializeZKProof(proof, publicSignals);

    console.log(`Verifying ${getProofTypeName(proofType)} ZK proof`);

    // In development mode, we'll always return true
    // In production, we would validate against the appropriate verification key
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode: ZK proof verification always returns true');
      return true;
    }

    // This would be properly implemented in production
    throw new Error('Production ZK proof verification not yet implemented');
  } catch (error) {
    console.error('Error verifying ZK proof:', error);
    return false;
  }
};

/**
 * Serializes a ZK proof and public signals for storage or transmission
 * Converts the complex proof structure into a format that can be stored in a database
 * or transmitted over a network connection.
 * 
 * @param {Object} proof - The raw proof object from snarkjs
 * @param {Array<string>} publicSignals - The public signals array from proof generation
 * @returns {Object} An object with serialized proof and publicSignals as strings
 */
export const serializeZKProof = (proof, publicSignals) => {
  // Validate inputs
  if (!proof) throw new Error('Proof is required for serialization');
  if (!publicSignals) throw new Error('Public signals are required for serialization');

  try {
    // Convert proof object to a JSON string
    const proofString = JSON.stringify(proof);

    // Convert public signals array to a JSON string
    const publicSignalsString = JSON.stringify(publicSignals);

    return {
      proof: proofString,
      publicSignals: publicSignalsString,
      format: 'json',
      version: '1.0.0'
    };
  } catch (error) {
    console.error('Error serializing ZK proof:', error);
    throw new Error(`Failed to serialize proof: ${error.message}`);
  }
};

/**
 * Deserializes a ZK proof and public signals from storage or transmission format
 * Converts the serialized strings back into the complex objects needed for verification.
 * 
 * @param {string} serializedProof - The serialized proof string
 * @param {string} serializedPublicSignals - The serialized public signals string
 * @returns {Object} An object with the deserialized proof object and publicSignals array
 */
export const deserializeZKProof = (serializedProof, serializedPublicSignals) => {
  // Validate inputs
  if (!serializedProof) throw new Error('Serialized proof is required for deserialization');
  if (!serializedPublicSignals) throw new Error('Serialized public signals are required for deserialization');

  try {
    // Parse proof string back to object
    const proof = JSON.parse(serializedProof);

    // Parse public signals string back to array
    const publicSignals = JSON.parse(serializedPublicSignals);

    return {
      proof,
      publicSignals
    };
  } catch (error) {
    console.error('Error deserializing ZK proof:', error);
    throw new Error(`Failed to deserialize proof: ${error.message}`);
  }
};

/**
 * Generates a hash for a ZK proof for verification purposes
 * This hash can be used as a unique identifier for the proof
 * 
 * @param {Object} params - Parameters for hash generation
 * @param {string} params.walletAddress - User's wallet address
 * @param {string} params.amount - Amount being verified
 * @param {number} params.proofType - Type of proof (from ZK_PROOF_TYPES)
 * @param {number} params.timestamp - Optional timestamp (defaults to current time)
 * @returns {string} A hash string that uniquely identifies the proof
 */
export const generateZKProofHash = async (params) => {
  const { walletAddress, publicSignals, proofType } = params;

  // Validate inputs
  if (!walletAddress) throw new Error('Wallet address is required');
  if (!publicSignals) throw new Error('Public signals are required');
  if (proofType === undefined) throw new Error('Proof type is required');

  // Different encoding based on proof type, similar to the contract logic
  let encodedData;
  const { utils } = ethers;

  switch (proofType) {
    case ZK_PROOF_TYPES.STANDARD:
      encodedData = utils.solidityPack(
        ['address', 'string', 'uint8'],
        [walletAddress, publicSignals, proofType]
      );
      break;
    case ZK_PROOF_TYPES.THRESHOLD:
      encodedData = utils.solidityPack(
        ['address', 'string', 'uint8', 'string'],
        [walletAddress, publicSignals, proofType, 'threshold']
      );
      break;
    case ZK_PROOF_TYPES.MAXIMUM:
      encodedData = utils.solidityPack(
        ['address', 'string', 'uint8', 'string'],
        [walletAddress, publicSignals, proofType, 'maximum']
      );
      break;
    default:
      throw new Error(`Invalid proof type: ${proofType}`);
  }

  // Generate hash
  return utils.keccak256(encodedData);
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

// Export all functions
export default {
  initializeSnarkJS,
  generateZKProof,
  verifyZKProof,
  serializeZKProof,
  deserializeZKProof,
  generateZKProofHash
};