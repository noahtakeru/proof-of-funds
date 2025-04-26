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

// We'll import snarkjs dynamically in the initializeSnarkJS function
import { ethers } from 'ethers';
import { generateInputs } from './zkCircuitInputs.mjs';
import { serializeProof } from './zkProofSerializer.mjs';
import { getCircuitData } from './zkCircuits.mjs';

// Import error handling modules
import zkErrorHandler from './zkErrorHandler.mjs';
import zkErrorLogger from './zkErrorLogger.mjs';

// Destructure error classes and related utilities
const {
  ErrorCode,
  ProofError,
  InputError,
  SystemError,
  CompatibilityError
} = zkErrorHandler;

/**
 * Enumeration of supported zero-knowledge proof types
 * Maps proof types to their numeric values for use in smart contracts
 * @constant {Object} ZK_PROOF_TYPES
 * @property {number} STANDARD - Standard proof (exact amount verification)
 * @property {number} THRESHOLD - Threshold proof (minimum amount verification)
 * @property {number} MAXIMUM - Maximum proof (maximum amount verification)
 */
export const ZK_PROOF_TYPES = {
  STANDARD: 0,
  THRESHOLD: 1,
  MAXIMUM: 2
};

/**
 * Initialize the snarkjs library for ZK operations
 * @returns {Promise<Object>} Initialized snarkjs instance
 * @throws {SystemError} If snarkjs fails to initialize
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function sets up the specialized mathematics library that creates our privacy proofs.
 * Think of it like starting up a highly specialized machine at the beginning of a factory shift.
 * Before we can create any privacy proofs, we need to power up the cryptographic engine that
 * performs all the complex calculations. This initialization ensures the mathematical tools
 * are ready to use, properly configured, and can access any required resources. Without this
 * step, we wouldn't be able to create any proofs at all.
 */
async function initializeSnarkJS() {
  const operationId = `initSnarkJS_${Date.now()}`;
  
  try {
    // Dynamically import snarkjs
    return await import('snarkjs');
  } catch (error) {
    const zkError = new SystemError(`Failed to initialize snarkjs: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId,
      recoverable: false,
      details: { 
        originalError: error.message
      }
    });
    
    zkErrorLogger.logError(zkError, { context: 'initializeSnarkJS' });
    throw zkError;
  }
}

/**
 * Generates a zero-knowledge proof for fund verification
 * @param {Object} params - Parameters for proof generation
 * @param {string} params.walletAddress - User's wallet address
 * @param {string} params.amount - Amount for verification (in wei/lamports)
 * @param {number} params.proofType - Type of proof (from ZK_PROOF_TYPES)
 * @param {Object} params.privateData - Additional private data for the proof
 * @returns {Promise<Object>} Generated proof object
 * @throws {InputError} If required parameters are missing or invalid
 * @throws {ProofError} If proof generation fails
 * @throws {SystemError} If system resources are unavailable
 */
export const generateZKProof = async (params) => {
  const operationId = `generateProof_${Date.now()}`;
  
  try {
    // Validate inputs
    if (!params || typeof params !== 'object') {
      throw new InputError('Invalid parameters: params must be an object', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { 
          paramsType: typeof params
        }
      });
    }
    
    const { walletAddress, amount, proofType, privateData } = params;

    // Validate wallet address
    if (!walletAddress || typeof walletAddress !== 'string') {
      throw new InputError('Wallet address is required and must be a string', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { 
          walletAddressProvided: !!walletAddress,
          walletAddressType: typeof walletAddress
        }
      });
    }

    // Validate amount
    if (!amount || (typeof amount !== 'string' && typeof amount !== 'number')) {
      throw new InputError('Amount is required and must be a string or number', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { 
          amountProvided: !!amount,
          amountType: typeof amount
        }
      });
    }

    // Validate proof type
    if (proofType === undefined || !Object.values(ZK_PROOF_TYPES).includes(proofType)) {
      throw new InputError(`Proof type is required and must be one of: ${Object.values(ZK_PROOF_TYPES).join(', ')}`, {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { 
          proofTypeProvided: proofType,
          validProofTypes: Object.values(ZK_PROOF_TYPES)
        }
      });
    }

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
      let circuit;
      try {
        circuit = getCircuitData(proofType);
      } catch (circuitError) {
        throw new ProofError(`Failed to get circuit data: ${circuitError.message}`, {
          code: ErrorCode.PROOF_TYPE_UNSUPPORTED,
          operationId,
          recoverable: false,
          details: { 
            proofType,
            originalError: circuitError.message
          }
        });
      }

      // Generate witness from inputs
      let witnessResult;
      try {
        witnessResult = await snarkjs.wtns.calculate(
          inputs,
          circuit.wasm,
          circuit.r1cs
        );
      } catch (witnessError) {
        throw new ProofError(`Witness calculation failed: ${witnessError.message}`, {
          code: ErrorCode.PROOF_WITNESS_ERROR,
          operationId,
          recoverable: false,
          details: { 
            proofType,
            originalError: witnessError.message
          }
        });
      }

      // Generate proof from witness
      let proofResult;
      try {
        proofResult = await snarkjs.groth16.prove(
          circuit.zkey,
          witnessResult.witness
        );
      } catch (proofGenError) {
        throw new ProofError(`Proof generation failed: ${proofGenError.message}`, {
          code: ErrorCode.PROOF_GENERATION_FAILED,
          operationId,
          recoverable: false,
          details: { 
            proofType,
            originalError: proofGenError.message
          }
        });
      }

      // Serialize the proof for storage and transmission
      let serializedProof;
      try {
        serializedProof = serializeProof(
          proofResult.proof, 
          proofResult.publicSignals,
          { type: getProofTypeName(proofType), version: '1.0.0' },
          { walletAddress, amount }
        );
      } catch (serializeError) {
        throw new ProofError(`Proof serialization failed: ${serializeError.message}`, {
          code: ErrorCode.PROOF_SERIALIZATION_ERROR,
          operationId,
          recoverable: true, // We might be able to retry serialization
          details: { 
            proofType,
            originalError: serializeError.message
          }
        });
      }

      return {
        proof: serializedProof.proof,
        publicSignals: serializedProof.publicSignals,
        proofType
      };
    } catch (error) {
      // If error is already a ZKError, just log and re-throw
      if (zkErrorHandler.isZKError(error)) {
        zkErrorLogger.logError(error, { context: 'generateZKProof' });
        throw error;
      }
      
      // Convert other errors to ProofError
      const zkError = new ProofError(`Error generating ZK proof: ${error.message}`, {
        code: ErrorCode.PROOF_GENERATION_FAILED,
        operationId,
        recoverable: false,
        details: { 
          proofType,
          walletAddress: typeof walletAddress === 'string' ? 
            walletAddress.substring(0, 6) + '...' + walletAddress.substring(walletAddress.length - 4) : null,
          originalError: error.message
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'generateZKProof' });
      throw zkError;
    }
  } catch (error) {
    // Handle top-level errors (like parameter validation)
    if (zkErrorHandler.isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'generateZKProof' });
      throw error;
    }
    
    // Convert other errors to InputError
    const zkError = new InputError(`Error in proof generation parameters: ${error.message}`, {
      code: ErrorCode.INPUT_VALIDATION_FAILED,
      operationId,
      recoverable: false,
      userFixable: true,
      details: { 
        originalError: error.message
      }
    });
    
    zkErrorLogger.logError(zkError, { context: 'generateZKProof' });
    throw zkError;
  }
};

/**
 * Generates a proof hash from ZK proof data
 * @param {Object} params - Parameters for hash generation
 * @param {string} params.walletAddress - User's wallet address
 * @param {Object} params.publicSignals - Public signals from the proof
 * @param {number} params.proofType - Type of proof (from ZK_PROOF_TYPES)
 * @returns {Promise<string>} Generated proof hash
 * @throws {InputError} If required parameters are missing or invalid
 * @throws {ProofError} If hash generation fails
 */
export const generateZKProofHash = async (params) => {
  const operationId = `generateProofHash_${Date.now()}`;
  
  try {
    // Validate inputs
    if (!params || typeof params !== 'object') {
      throw new InputError('Invalid parameters: params must be an object', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { 
          paramsType: typeof params
        }
      });
    }
    
    const { walletAddress, publicSignals, proofType } = params;

    // Validate wallet address
    if (!walletAddress || typeof walletAddress !== 'string') {
      throw new InputError('Wallet address is required and must be a string', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { 
          walletAddressProvided: !!walletAddress,
          walletAddressType: typeof walletAddress
        }
      });
    }

    // Validate public signals
    if (!publicSignals) {
      throw new InputError('Public signals are required', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { 
          publicSignalsProvided: !!publicSignals
        }
      });
    }

    // Validate proof type
    if (proofType === undefined || !Object.values(ZK_PROOF_TYPES).includes(proofType)) {
      throw new InputError(`Proof type is required and must be one of: ${Object.values(ZK_PROOF_TYPES).join(', ')}`, {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { 
          proofTypeProvided: proofType,
          validProofTypes: Object.values(ZK_PROOF_TYPES)
        }
      });
    }

    // Encode data based on proof type
    try {
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
          throw new InputError(`Unsupported proof type: ${proofType}`, {
            code: ErrorCode.INPUT_VALIDATION_FAILED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { 
              proofType,
              validProofTypes: Object.values(ZK_PROOF_TYPES)
            }
          });
      }

      // Generate hash
      return ethers.utils.keccak256(encodedData);
    } catch (error) {
      // If error is already a ZKError, just log and re-throw
      if (zkErrorHandler.isZKError(error)) {
        zkErrorLogger.logError(error, { context: 'generateZKProofHash.encoding' });
        throw error;
      }
      
      // Convert ethers errors to ProofError
      const zkError = new ProofError(`Error generating ZK proof hash: ${error.message}`, {
        code: ErrorCode.PROOF_SERIALIZATION_ERROR,
        operationId,
        recoverable: false,
        details: { 
          proofType,
          walletAddress: typeof walletAddress === 'string' ? 
            walletAddress.substring(0, 6) + '...' + walletAddress.substring(walletAddress.length - 4) : null,
          originalError: error.message
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'generateZKProofHash' });
      throw zkError;
    }
  } catch (error) {
    // Handle top-level errors (like parameter validation)
    if (zkErrorHandler.isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'generateZKProofHash' });
      throw error;
    }
    
    // Convert other errors to InputError
    const zkError = new InputError(`Error in proof hash generation parameters: ${error.message}`, {
      code: ErrorCode.INPUT_VALIDATION_FAILED,
      operationId,
      recoverable: false,
      userFixable: true,
      details: { 
        originalError: error.message
      }
    });
    
    zkErrorLogger.logError(zkError, { context: 'generateZKProofHash' });
    throw zkError;
  }
};

/**
 * Gets a human-readable name for a proof type
 * @param {number} proofType - The proof type enum value
 * @returns {string} Human-readable proof type name
 * @throws {InputError} If proof type is invalid
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function translates technical proof type codes into user-friendly names.
 * It's similar to how a restaurant might use internal codes like "BRG-1" and "BRG-2" 
 * in their ordering system, but customers see "Classic Hamburger" and "Cheeseburger" 
 * on the menu. When our system needs to display what kind of verification is being 
 * performed, this function converts the internal code (0, 1, or 2) into meaningful 
 * names like "Standard," "Threshold," or "Maximum" that users and developers can 
 * easily understand.
 */
const getProofTypeName = (proofType) => {
  const operationId = `getProofTypeName_${Date.now()}`;
  
  try {
    switch (proofType) {
      case ZK_PROOF_TYPES.STANDARD:
        return 'Standard';
      case ZK_PROOF_TYPES.THRESHOLD:
        return 'Threshold';
      case ZK_PROOF_TYPES.MAXIMUM:
        return 'Maximum';
      default:
        throw new InputError(`Invalid proof type: ${proofType}`, {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { 
            proofType,
            validProofTypes: Object.values(ZK_PROOF_TYPES)
          }
        });
    }
  } catch (error) {
    // Only create a new error if it's not already a ZKError
    if (!zkErrorHandler.isZKError(error)) {
      error = new InputError(`Error getting proof type name: ${error.message}`, {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          proofType,
          originalError: error.message
        }
      });
    }
    
    zkErrorLogger.logError(error, { context: 'getProofTypeName' });
    throw error;
  }
};

/**
 * Generates a standard zero-knowledge proof for exact amount verification
 * @param {Object} params - Parameters for standard proof generation
 * @param {string} params.walletAddress - User's wallet address
 * @param {string} params.amount - Exact amount for verification (in wei/lamports)
 * @param {Object} params.privateData - Additional private data for the proof
 * @returns {Promise<Object>} Generated standard proof object
 * @throws {InputError} If required parameters are missing or invalid
 * @throws {ProofError} If proof generation fails
 */
export const generateStandardProof = async (params) => {
  const standardParams = {
    ...params,
    proofType: ZK_PROOF_TYPES.STANDARD
  };
  return generateZKProof(standardParams);
};

/**
 * Generates a threshold zero-knowledge proof for minimum amount verification
 * @param {Object} params - Parameters for threshold proof generation
 * @param {string} params.walletAddress - User's wallet address
 * @param {string} params.amount - Minimum amount threshold (in wei/lamports)
 * @param {Object} params.privateData - Additional private data for the proof
 * @returns {Promise<Object>} Generated threshold proof object
 * @throws {InputError} If required parameters are missing or invalid
 * @throws {ProofError} If proof generation fails
 */
export const generateThresholdProof = async (params) => {
  const thresholdParams = {
    ...params,
    proofType: ZK_PROOF_TYPES.THRESHOLD
  };
  return generateZKProof(thresholdParams);
};

/**
 * Generates a maximum zero-knowledge proof for maximum amount verification
 * @param {Object} params - Parameters for maximum proof generation
 * @param {string} params.walletAddress - User's wallet address
 * @param {string} params.amount - Maximum amount limit (in wei/lamports)
 * @param {Object} params.privateData - Additional private data for the proof
 * @returns {Promise<Object>} Generated maximum proof object
 * @throws {InputError} If required parameters are missing or invalid
 * @throws {ProofError} If proof generation fails
 */
export const generateMaximumProof = async (params) => {
  const maximumParams = {
    ...params,
    proofType: ZK_PROOF_TYPES.MAXIMUM
  };
  return generateZKProof(maximumParams);
};

// Export core functionality
export default {
  ZK_PROOF_TYPES,
  initializeSnarkJS,
  generateZKProof,
  generateZKProofHash,
  generateStandardProof,
  generateThresholdProof,
  generateMaximumProof
};