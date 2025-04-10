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

const { initialize } = require('snarkjs');
const { deserializeProof } = require('./zkProofSerializer.cjs');
const { getCircuitData } = require('./zkCircuits.cjs');
const { ZK_PROOF_TYPES } = require('./zkProofGenerator.cjs');
const { ethers } = require('ethers');
const { ZK_VERIFIER_ADDRESS, ZK_VERIFIER_ABI } = require('../../config/constants.cjs');
const zkErrorHandler = require('./zkErrorHandler.cjs');
const zkErrorLogger = require('./zkErrorLogger.cjs');

// Destructure error classes for easier use
const { 
  VerificationError, 
  VerificationKeyError, 
  VerificationProofError,
  InputError, 
  SystemError,
  NetworkError 
} = zkErrorHandler;

// Error code constants
const { ErrorCode } = zkErrorHandler;

// Initialize snarkjs as a singleton
let snarkjsInstance = null;

/**
 * Initializes the snarkjs library
 * @returns {Promise<Object>} The initialized snarkjs instance
 * @throws {SystemError} If the snarkjs initialization fails
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function prepares the specialized verification system before it can check any proofs.
 * It's like setting up security equipment before guards can start screening visitors.
 * Before we can verify any privacy proofs, we need to initialize the cryptographic
 * tools that will analyze the mathematical correctness of the proofs. This one-time
 * setup ensures that our verification system is ready to accurately determine
 * if a proof is genuine or not.
 */
const initializeSnarkJS = async () => {
  const operationId = `initSnarkJS_${Date.now()}`;
  
  if (!snarkjsInstance) {
    try {
      zkErrorLogger.log('INFO', 'Initializing snarkjs for verification...', { operationId });
      
      snarkjsInstance = await initialize();
      
      zkErrorLogger.log('INFO', 'snarkjs initialized successfully', { operationId });
    } catch (error) {
      const zkError = new SystemError(`Failed to initialize snarkjs: ${error.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        recoverable: false,
        details: { originalError: error.message }
      });
      
      zkErrorLogger.logError(zkError, { context: 'initializeSnarkJS' });
      throw zkError;
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
 * @throws {InputError} If required parameters are missing or invalid
 * @throws {VerificationError} If the verification process fails
 * @throws {VerificationKeyError} If the verification key is missing or invalid
 * @throws {VerificationProofError} If the proof format is invalid
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function examines a privacy proof to determine if it's genuine and valid.
 * It's similar to how a bank teller might use a special UV light and other tools to
 * check if a check or ID is authentic without needing to call the issuing bank.
 * 
 * When someone presents a proof claiming they have sufficient funds:
 * 1. This function decodes the cryptographic proof
 * 2. Applies specialized mathematical tests to verify its authenticity
 * 3. Confirms whether the person truly meets the financial requirements
 * 
 * All of this happens directly in the user's browser or application (client-side),
 * providing an immediate verification result without sending sensitive data
 * to external servers.
 */
const verifyZKProof = async (params) => {
  const operationId = `verifyProof_${Date.now()}`;
  
  try {
    // Validate input parameters
    if (!params || typeof params !== 'object') {
      throw new InputError('Invalid parameters for proof verification', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Provide a valid parameters object'
      });
    }
    
    const { proof, publicSignals, proofType } = params;
    
    // Validate required fields
    if (!proof) {
      throw new InputError('Proof is required', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Provide a valid proof string'
      });
    }
    
    if (!publicSignals) {
      throw new InputError('Public signals are required', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Provide valid public signals'
      });
    }
    
    if (proofType === undefined) {
      throw new InputError('Proof type is required', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Specify a valid proof type'
      });
    }
    
    try {
      // Initialize snarkjs if not already initialized
      const snarkjs = await initializeSnarkJS();
      
      // Deserialize the proof
      let deserializedProof;
      try {
        deserializedProof = deserializeProof(proof, publicSignals);
      } catch (deserializeError) {
        throw new VerificationProofError(`Failed to deserialize proof: ${deserializeError.message}`, {
          code: ErrorCode.VERIFICATION_PROOF_INVALID,
          operationId,
          recoverable: false,
          details: { 
            proofType,
            originalError: deserializeError.message 
          }
        });
      }
      
      // Get appropriate verification key based on proof type
      let circuit;
      let verificationKey;
      try {
        circuit = getCircuitData(proofType);
        verificationKey = circuit.vkey;
        
        if (!verificationKey) {
          throw new VerificationKeyError('Verification key not found for the provided proof type', {
            code: ErrorCode.VERIFICATION_KEY_MISSING,
            operationId,
            recoverable: false,
            details: { proofType }
          });
        }
      } catch (circuitError) {
        if (circuitError instanceof VerificationKeyError) {
          throw circuitError;
        }
        
        throw new VerificationError(`Failed to get circuit data: ${circuitError.message}`, {
          code: ErrorCode.VERIFICATION_FAILED,
          operationId,
          recoverable: false,
          details: { 
            proofType,
            originalError: circuitError.message 
          }
        });
      }
      
      zkErrorLogger.log('INFO', `Verifying ${getProofTypeName(proofType)} proof...`, { 
        operationId, 
        context: 'verifyZKProof',
        proofType
      });
      
      // Verify the proof
      let isValid;
      try {
        isValid = await snarkjs.groth16.verify(
          verificationKey,
          deserializedProof.publicSignals,
          deserializedProof.proof
        );
      } catch (verifyError) {
        throw new VerificationError(`Proof verification calculation failed: ${verifyError.message}`, {
          code: ErrorCode.VERIFICATION_FAILED,
          operationId,
          recoverable: false,
          details: { 
            proofType,
            originalError: verifyError.message 
          }
        });
      }
      
      zkErrorLogger.log(isValid ? 'INFO' : 'WARNING', 
        `Proof verification result: ${isValid ? 'Valid' : 'Invalid'}`, {
          operationId,
          context: 'verifyZKProof',
          proofType,
          result: isValid
        }
      );
      
      return isValid;
    } catch (error) {
      // Re-throw if it's already a ZKError
      if (zkErrorHandler.isZKError(error)) {
        throw error;
      }
      
      // Wrap generic errors in VerificationError
      const zkError = new VerificationError(`Error verifying ZK proof: ${error.message}`, {
        code: ErrorCode.VERIFICATION_FAILED,
        operationId,
        recoverable: false,
        details: { 
          proofType,
          originalError: error.message 
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'verifyZKProof' });
      throw zkError;
    }
  } catch (error) {
    // Log all errors at the top level
    if (zkErrorHandler.isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'verifyZKProof.topLevel' });
    } else {
      const zkError = new VerificationError(`Unexpected error in verification: ${error.message}`, {
        code: ErrorCode.VERIFICATION_FAILED,
        operationId,
        recoverable: false,
        details: { originalError: error.message }
      });
      
      zkErrorLogger.logError(zkError, { context: 'verifyZKProof.topLevel' });
      throw zkError;
    }
    
    // Return false for any error to maintain backward compatibility
    return false;
  }
};

/**
 * Verifies a zero-knowledge proof using the smart contract
 * @param {Object} params - Parameters for contract-based verification
 * @param {string} params.walletAddress - User's wallet address
 * @param {Object|string} params.provider - Ethers provider or RPC URL
 * @returns {Promise<boolean>} Whether the proof is valid according to the contract
 * @throws {InputError} If required parameters are missing
 * @throws {NetworkError} If there are issues with the blockchain connection
 * @throws {VerificationError} If the verification process fails
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function verifies a proof using a blockchain-based verification system instead of
 * doing it locally. It's like having a notary public verify a document instead of checking
 * it yourself - providing an official, third-party verification that others can trust.
 * 
 * When a high level of trust is needed:
 * 1. This function connects to our verification smart contract on the blockchain
 * 2. Submits the proof for verification by this trusted, immutable system
 * 3. Returns the blockchain's determination of whether the proof is valid
 * 
 * This approach is useful for cases where third parties need assurance that the
 * verification was performed correctly and wasn't manipulated, as the blockchain
 * provides a transparent, tamper-proof verification environment.
 */
const verifyZKProofOnChain = async (params) => {
  const operationId = `verifyProofOnChain_${Date.now()}`;
  
  try {
    // Validate input parameters
    if (!params || typeof params !== 'object') {
      throw new InputError('Invalid parameters for on-chain verification', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Provide a valid parameters object'
      });
    }
    
    const { walletAddress, provider } = params;
    
    // Validate required fields
    if (!walletAddress) {
      throw new InputError('Wallet address is required', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Provide a valid wallet address'
      });
    }
    
    if (!provider) {
      throw new InputError('Provider is required', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Provide a valid Ethereum provider or RPC URL'
      });
    }
    
    try {
      // Create ethers provider from string URL if needed
      let ethersProvider;
      try {
        ethersProvider = typeof provider === 'string'
          ? new ethers.providers.JsonRpcProvider(provider)
          : provider;
      } catch (providerError) {
        throw new NetworkError(`Failed to initialize provider: ${providerError.message}`, {
          code: ErrorCode.NETWORK_REQUEST_FAILED,
          operationId,
          recoverable: true,
          userFixable: true,
          recommendedAction: 'Check the provider URL or object format',
          details: { originalError: providerError.message }
        });
      }
      
      // Connect to the ZKVerifier contract
      let zkVerifier;
      try {
        zkVerifier = new ethers.Contract(
          ZK_VERIFIER_ADDRESS,
          ZK_VERIFIER_ABI,
          ethersProvider
        );
      } catch (contractError) {
        throw new NetworkError(`Failed to connect to ZKVerifier contract: ${contractError.message}`, {
          code: ErrorCode.NETWORK_REQUEST_FAILED,
          operationId,
          recoverable: false,
          details: {
            contractAddress: ZK_VERIFIER_ADDRESS,
            originalError: contractError.message
          }
        });
      }
      
      // Call the verifyZKProof function
      zkErrorLogger.log('INFO', `Verifying proof for wallet ${walletAddress.substring(0, 6)}... on-chain`, {
        operationId,
        context: 'verifyZKProofOnChain',
        // Redact full wallet address for privacy
        walletShort: `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`
      });
      
      let isValid;
      try {
        isValid = await zkVerifier.verifyZKProof(walletAddress);
      } catch (verifyError) {
        throw new VerificationError(`On-chain verification failed: ${verifyError.message}`, {
          code: ErrorCode.VERIFICATION_FAILED,
          operationId,
          recoverable: false,
          details: {
            // Redact full wallet address for privacy
            walletShort: `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`,
            originalError: verifyError.message
          }
        });
      }
      
      zkErrorLogger.log(isValid ? 'INFO' : 'WARNING', 
        `On-chain verification result: ${isValid ? 'Valid' : 'Invalid'}`, {
          operationId,
          context: 'verifyZKProofOnChain',
          // Redact full wallet address for privacy
          walletShort: `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`,
          result: isValid
        }
      );
      
      return isValid;
    } catch (error) {
      // Re-throw if it's already a ZKError
      if (zkErrorHandler.isZKError(error)) {
        throw error;
      }
      
      // Wrap generic errors in VerificationError
      const zkError = new VerificationError(`Error verifying ZK proof on-chain: ${error.message}`, {
        code: ErrorCode.VERIFICATION_FAILED,
        operationId,
        recoverable: false,
        details: { 
          // Redact full wallet address for privacy
          walletShort: walletAddress ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` : null,
          originalError: error.message 
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'verifyZKProofOnChain' });
      throw zkError;
    }
  } catch (error) {
    // Log all errors at the top level
    if (zkErrorHandler.isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'verifyZKProofOnChain.topLevel' });
    } else {
      const zkError = new VerificationError(`Unexpected error in on-chain verification: ${error.message}`, {
        code: ErrorCode.VERIFICATION_FAILED,
        operationId,
        recoverable: false,
        details: { originalError: error.message }
      });
      
      zkErrorLogger.logError(zkError, { context: 'verifyZKProofOnChain.topLevel' });
      throw zkError;
    }
    
    // Return false for any error to maintain backward compatibility
    return false;
  }
};

/**
 * Gets a human-readable name for a proof type
 * @param {number} proofType - The proof type enum value
 * @returns {string} Human-readable proof type name
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
        zkErrorLogger.log('WARNING', `Unknown proof type: ${proofType}`, {
          operationId,
          context: 'getProofTypeName'
        });
        return 'Unknown';
    }
  } catch (error) {
    // This should never happen for a simple switch statement, but just in case
    zkErrorLogger.logError(error, { 
      operationId, 
      context: 'getProofTypeName',
      proofType
    });
    return 'Unknown';
  }
};

// Export core functionality
module.exports = {
  verifyZKProof,
  verifyZKProofOnChain,
  initializeSnarkJS
};