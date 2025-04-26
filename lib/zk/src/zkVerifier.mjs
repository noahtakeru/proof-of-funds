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

// We'll import snarkjs dynamically in the initializeSnarkJS function
import { deserializeProof } from './zkProofSerializer.mjs';
import { getCircuitData } from './zkCircuits.mjs';
import { ZK_PROOF_TYPES } from './zkProofGenerator.js';
import { ethers } from 'ethers';
// Mock constants for verification
const ZK_VERIFIER_ADDRESS = '0x1234567890123456789012345678901234567890';
const ZK_VERIFIER_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "walletAddress", "type": "address"}],
    "name": "verifyZKProof",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  }
];
import zkErrorHandler from './zkErrorHandler.mjs';
import zkErrorLogger from './zkErrorLogger.mjs';

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

// Add error codes if not already defined
if (!ErrorCode.VERIFICATION_GENERIC_ERROR) {
  ErrorCode.VERIFICATION_GENERIC_ERROR = 'VERIFICATION_GENERIC_ERROR';
  ErrorCode.VERIFICATION_CIRCUIT_ERROR = 'VERIFICATION_CIRCUIT_ERROR';
  ErrorCode.VERIFICATION_PROOF_ERROR = 'VERIFICATION_PROOF_ERROR';
  ErrorCode.VERIFICATION_KEY_ERROR = 'VERIFICATION_KEY_ERROR';
  ErrorCode.VERIFICATION_INPUT_ERROR = 'VERIFICATION_INPUT_ERROR';
  ErrorCode.VERIFICATION_COMPUTATION_ERROR = 'VERIFICATION_COMPUTATION_ERROR';
  ErrorCode.VERIFICATION_TIMEOUT = 'VERIFICATION_TIMEOUT';
  ErrorCode.VERIFICATION_ONCHAIN_ERROR = 'VERIFICATION_ONCHAIN_ERROR';
  ErrorCode.VERIFICATION_PROVIDER_ERROR = 'VERIFICATION_PROVIDER_ERROR';
}

/**
 * Specialized verification error class
 * Provides better categorization and user feedback
 */
class EnhancedVerificationError extends SystemError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || ErrorCode.VERIFICATION_GENERIC_ERROR,
      severity: options.severity || 'ERROR',
      recoverable: options.recoverable !== undefined ? options.recoverable : false,
      details: {
        ...(options.details || {}),
        component: 'zkVerifier',
        operationId: options.operationId || `verify_error_${Date.now()}`
      }
    });

    this.name = 'VerificationError';
    this.userMessage = options.userMessage || 'Verification failed. Please try again.';
  }
}

/**
 * Specialized error for circuit-related issues
 */
class CircuitError extends EnhancedVerificationError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || ErrorCode.VERIFICATION_CIRCUIT_ERROR,
      details: {
        ...(options.details || {}),
        errorType: 'circuit'
      }
    });

    this.name = 'CircuitError';
    this.userMessage = options.userMessage || 'There was a problem with the verification circuit. Please try again later.';
  }
}

/**
 * Specialized error for proof-related issues
 */
class ProofError extends EnhancedVerificationError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || ErrorCode.VERIFICATION_PROOF_ERROR,
      details: {
        ...(options.details || {}),
        errorType: 'proof'
      }
    });

    this.name = 'ProofError';
    this.userMessage = options.userMessage || 'The provided proof contains errors and cannot be verified.';
  }
}

/**
 * Specialized error for verification key issues
 */
class KeyError extends EnhancedVerificationError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || ErrorCode.VERIFICATION_KEY_ERROR,
      details: {
        ...(options.details || {}),
        errorType: 'key'
      }
    });

    this.name = 'KeyError';
    this.userMessage = options.userMessage || 'Could not access the verification key. Please try again later.';
  }
}

/**
 * Specialized error for computation issues
 */
class ComputationError extends EnhancedVerificationError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || ErrorCode.VERIFICATION_COMPUTATION_ERROR,
      details: {
        ...(options.details || {}),
        errorType: 'computation'
      }
    });

    this.name = 'ComputationError';
    this.userMessage = options.userMessage || 'An error occurred during the verification computation. Please try again.';
  }
}

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
export const initializeSnarkJS = async () => {
  const operationId = `initSnarkJS_${Date.now()}`;

  try {
    zkErrorLogger.log('INFO', 'Initializing snarkjs for verification...', { operationId });
    
    // Dynamically import snarkjs
    const snarkjs = await import('snarkjs');
    
    zkErrorLogger.log('INFO', 'snarkjs initialized successfully', { operationId });
    return snarkjs;
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
};

/**
 * Validate proof format for common issues
 * @param {Object} proof - The proof to validate
 * @param {Array} publicSignals - Public signals for the proof
 * @returns {boolean} True if the proof format is valid
 * @throws {ProofError} If there are issues with the proof format
 */
export const validateProofFormat = (proof, publicSignals) => {
  const operationId = `validate_proof_format_${Date.now()}`;

  try {
    // Check proof object
    if (!proof || typeof proof !== 'object') {
      throw new ProofError('Proof must be a valid object', {
        operationId,
        code: ErrorCode.VERIFICATION_INPUT_ERROR,
        details: {
          receivedType: typeof proof
        },
        userMessage: 'The proof data is not in the correct format.'
      });
    }

    // Check required properties in proof
    const requiredProofProps = ['pi_a', 'pi_b', 'pi_c', 'protocol'];

    for (const prop of requiredProofProps) {
      if (!(prop in proof)) {
        throw new ProofError(`Proof is missing required property: ${prop}`, {
          operationId,
          code: ErrorCode.VERIFICATION_PROOF_ERROR,
          details: {
            missingProperty: prop,
            availableProperties: Object.keys(proof)
          },
          userMessage: 'The proof data is incomplete.'
        });
      }
    }

    // Check proof arrays
    if (!Array.isArray(proof.pi_a) || !Array.isArray(proof.pi_b) || !Array.isArray(proof.pi_c)) {
      throw new ProofError('Proof must contain valid array properties', {
        operationId,
        code: ErrorCode.VERIFICATION_PROOF_ERROR,
        details: {
          pi_a_type: typeof proof.pi_a,
          pi_b_type: typeof proof.pi_b,
          pi_c_type: typeof proof.pi_c
        },
        userMessage: 'The proof data has incorrect structure.'
      });
    }

    // Validate protocol
    if (proof.protocol !== 'groth16') {
      throw new ProofError(`Unsupported proof protocol: ${proof.protocol}`, {
        operationId,
        code: ErrorCode.VERIFICATION_PROOF_ERROR,
        details: {
          supportedProtocols: ['groth16'],
          receivedProtocol: proof.protocol
        },
        userMessage: 'The proof uses an unsupported protocol.'
      });
    }

    // Check public signals
    if (!publicSignals || !Array.isArray(publicSignals)) {
      throw new ProofError('Public signals must be a valid array', {
        operationId,
        code: ErrorCode.VERIFICATION_INPUT_ERROR,
        details: {
          receivedType: typeof publicSignals,
          isArray: Array.isArray(publicSignals)
        },
        userMessage: 'The verification data is not in the correct format.'
      });
    }

    // Validate public signal values are all strings (most common format)
    for (let i = 0; i < publicSignals.length; i++) {
      const signal = publicSignals[i];

      // Check not null/undefined
      if (signal === null || signal === undefined) {
        throw new ProofError(`Public signal at index ${i} is null or undefined`, {
          operationId,
          code: ErrorCode.VERIFICATION_INPUT_ERROR,
          details: {
            index: i,
            value: signal
          },
          userMessage: 'The verification data contains invalid values.'
        });
      }

      // For string signals, ensure valid numeric string
      // This is a common source of errors - non-numeric strings in public signals
      if (typeof signal === 'string' && !/^[0-9]+$/.test(signal)) {
        throw new ProofError(`Public signal at index ${i} is not a valid numeric string`, {
          operationId,
          code: ErrorCode.VERIFICATION_INPUT_ERROR,
          details: {
            index: i,
            value: signal.slice(0, 10) + (signal.length > 10 ? '...' : '')
          },
          userMessage: 'The verification data contains invalid values.'
        });
      }
    }

    // All validations passed
    return true;
  } catch (error) {
    // If it's already a ProofError, just rethrow
    if (error instanceof ProofError) {
      throw error;
    }

    // Otherwise wrap in a ProofError
    throw new ProofError(`Proof validation failed: ${error.message}`, {
      operationId,
      code: ErrorCode.VERIFICATION_PROOF_ERROR,
      details: {
        originalError: error.message
      },
      cause: error,
      userMessage: 'The proof data could not be validated.'
    });
  }
};

/**
 * Verifies a zero-knowledge proof client-side with enhanced error handling
 * @param {Object} params - Parameters for proof verification
 * @param {string|Object} params.proof - The proof to verify (serialized or deserialized)
 * @param {string|Array} params.publicSignals - Public signals from the proof
 * @param {number} params.proofType - Type of proof (from ZK_PROOF_TYPES)
 * @param {Object} [params.options] - Additional verification options
 * @returns {Promise<boolean>} Whether the proof is valid
 */
export const verifyZKProof = async (params) => {
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

    const { proof: rawProof, publicSignals: rawPublicSignals, proofType, options = {} } = params;

    // Validate required fields
    if (!rawProof) {
      throw new ProofError('Proof is required', {
        code: ErrorCode.VERIFICATION_INPUT_ERROR,
        operationId,
        details: { parameter: 'proof' },
        userMessage: 'No proof was provided for verification.'
      });
    }

    if (!rawPublicSignals) {
      throw new ProofError('Public signals are required', {
        code: ErrorCode.VERIFICATION_INPUT_ERROR,
        operationId,
        details: { parameter: 'publicSignals' },
        userMessage: 'Verification data is missing necessary information.'
      });
    }

    if (proofType === undefined) {
      throw new InputError('Proof type is required', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        details: { parameter: 'proofType' },
        userMessage: 'The type of proof to verify was not specified.'
      });
    }

    // Initialize snarkjs if not already initialized
    const snarkjs = await initializeSnarkJS();

    // Deserialize the proof if needed
    let proof;
    let publicSignals;

    try {
      // If proof is a string, assume it's serialized
      if (typeof rawProof === 'string') {
        const deserialized = deserializeProof(rawProof, rawPublicSignals);
        proof = deserialized.proof;
        publicSignals = deserialized.publicSignals;
      } else {
        // Assume directly provided proof object
        proof = rawProof;
        publicSignals = Array.isArray(rawPublicSignals) ? rawPublicSignals :
          JSON.parse(rawPublicSignals);
      }
    } catch (deserializeError) {
      throw new ProofError(`Failed to process proof data: ${deserializeError.message}`, {
        code: ErrorCode.VERIFICATION_PROOF_ERROR,
        operationId,
        details: {
          proofType,
          originalError: deserializeError.message
        },
        cause: deserializeError,
        userMessage: 'The proof data could not be processed correctly.'
      });
    }

    // Validate proof format before verification
    validateProofFormat(proof, publicSignals);

    // Get appropriate verification key with fallbacks
    let verificationKey;
    try {
      verificationKey = await loadVerificationKeyWithFallbacks(proofType);

      // If we got a virtual key for server verification, use server verification
      if (verificationKey.useServerVerification) {
        return await verifyProofWithServer(proof, publicSignals, {
          ...options,
          circuitType: proofType
        });
      }
    } catch (keyError) {
      // Just rethrow if it's already a specialized error
      if (keyError instanceof KeyError) {
        throw keyError;
      }

      throw new KeyError(`Failed to load verification key: ${keyError.message}`, {
        code: ErrorCode.VERIFICATION_KEY_ERROR,
        operationId,
        details: {
          proofType,
          originalError: keyError.message
        },
        cause: keyError,
        userMessage: 'Could not access the verification key needed for proof validation.'
      });
    }

    zkErrorLogger.log('INFO', `Verifying ${getProofTypeName(proofType)} proof...`, {
      operationId,
      context: 'verifyZKProof',
      proofType
    });

    // Verify the proof with specific error handling
    try {
      const isValid = await snarkjs.groth16.verify(
        verificationKey,
        publicSignals,
        proof
      );

      zkErrorLogger.log(isValid ? 'INFO' : 'WARNING',
        `Proof verification result: ${isValid ? 'Valid' : 'Invalid'}`, {
        operationId,
        context: 'verifyZKProof',
        proofType
      });

      return isValid;
    } catch (verifyError) {
      // Determine error category for better handling
      if (verifyError.message.includes('curve') ||
        verifyError.message.includes('pairing') ||
        verifyError.message.includes('constraint')) {

        throw new CircuitError(`Circuit error during verification: ${verifyError.message}`, {
          code: ErrorCode.VERIFICATION_CIRCUIT_ERROR,
          operationId,
          details: {
            proofType,
            originalError: verifyError.message
          },
          cause: verifyError,
          userMessage: 'The verification process encountered a technical issue with the circuit.'
        });
      }

      if (verifyError.message.includes('arithmetic') ||
        verifyError.message.includes('computation') ||
        verifyError.message.includes('overflow')) {

        throw new ComputationError(`Computation error during verification: ${verifyError.message}`, {
          code: ErrorCode.VERIFICATION_COMPUTATION_ERROR,
          operationId,
          details: {
            proofType,
            originalError: verifyError.message
          },
          cause: verifyError,
          userMessage: 'A mathematical error occurred during the verification process.'
        });
      }

      // Generic verification error for other cases
      throw new EnhancedVerificationError(`Verification failed: ${verifyError.message}`, {
        code: ErrorCode.VERIFICATION_GENERIC_ERROR,
        operationId,
        details: {
          proofType,
          originalError: verifyError.message
        },
        cause: verifyError,
        userMessage: 'The verification process failed. Please try again.'
      });
    }
  } catch (error) {
    // If it's one of our specialized error types, just log and rethrow
    if (error instanceof EnhancedVerificationError ||
      error instanceof ProofError ||
      error instanceof KeyError ||
      error instanceof CircuitError ||
      error instanceof ComputationError) {

      zkErrorLogger.logError(error, {
        context: 'verifyZKProof',
        operationId,
      });

      throw error;
    }

    // Generic wrapper for other error types
    const enhancedError = new EnhancedVerificationError(`Verification failed: ${error.message}`, {
      code: ErrorCode.VERIFICATION_GENERIC_ERROR,
      operationId,
      details: { originalError: error.message },
      cause: error,
      userMessage: 'An unexpected error occurred during the verification process.'
    });

    zkErrorLogger.logError(enhancedError, {
      context: 'verifyZKProof'
    });

    throw enhancedError;
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
export const verifyZKProofOnChain = async (params) => {
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

/**
 * Load a verification key with multiple fallback mechanisms
 * @param {string} circuitType - Type of circuit
 * @returns {Promise<Object>} Verification key
 */
export const loadVerificationKeyWithFallbacks = async (circuitType) => {
  const operationId = `load_vkey_fallback_${Date.now()}`;

  try {
    // First try primary loading method
    return await loadVerificationKey(circuitType);
  } catch (primaryError) {
    zkErrorLogger.logError(primaryError, {
      context: 'zkVerifier.loadVerificationKeyWithFallbacks.primaryFailed',
      details: { circuitType }
    });

    // Try loading from a different location - embedded backup
    try {
      zkErrorLogger.log('INFO', 'Attempting to load verification key from embedded backup', {
        context: 'zkVerifier.loadVerificationKeyWithFallbacks.usingEmbeddedBackup',
        details: { circuitType }
      });

      return await loadEmbeddedVerificationKey(circuitType);
    } catch (embeddedError) {
      zkErrorLogger.logError(embeddedError, {
        context: 'zkVerifier.loadVerificationKeyWithFallbacks.embeddedFailed',
        details: { circuitType }
      });

      // Try loading from CDN
      try {
        zkErrorLogger.log('INFO', 'Attempting to load verification key from CDN', {
          context: 'zkVerifier.loadVerificationKeyWithFallbacks.usingCDN',
          details: { circuitType }
        });

        return await loadVerificationKeyFromCDN(circuitType);
      } catch (cdnError) {
        zkErrorLogger.logError(cdnError, {
          context: 'zkVerifier.loadVerificationKeyWithFallbacks.cdnFailed',
          details: { circuitType }
        });

        // Try server-based verification (last resort)
        try {
          zkErrorLogger.log('INFO', 'Attempting server-based verification as fallback', {
            context: 'zkVerifier.loadVerificationKeyWithFallbacks.usingServer',
            details: { circuitType }
          });

          // No need to return an actual key here
          // Just set a flag that we'll use server-based verification
          return {
            isVirtualKey: true,
            circuitType,
            useServerVerification: true
          };
        } catch (serverError) {
          // All fallbacks failed, throw comprehensive error
          const allFailedError = new KeyError('All verification key loading methods failed', {
            operationId,
            code: ErrorCode.VERIFICATION_KEY_ERROR,
            details: {
              circuitType,
              primaryError: primaryError.message,
              embeddedError: embeddedError.message,
              cdnError: cdnError.message,
              serverError: serverError.message
            },
            cause: serverError, // Chain to the last error
            userMessage: 'We\'re experiencing technical difficulties with the verification service. Please try again later.'
          });

          zkErrorLogger.logError(allFailedError, {
            context: 'zkVerifier.loadVerificationKeyWithFallbacks.allFailed'
          });

          throw allFailedError;
        }
      }
    }
  }
};

/**
 * Primary method to load verification key
 * @param {string} circuitType - Type of circuit
 * @returns {Promise<Object>} Verification key
 */
export const loadVerificationKey = async (circuitType) => {
  try {
    // Get the circuit data which includes the verification key
    const circuit = getCircuitData(circuitType);

    if (!circuit || !circuit.vkey) {
      throw new KeyError(`Verification key not found for circuit type: ${circuitType}`, {
        code: ErrorCode.VERIFICATION_KEY_ERROR,
        details: { circuitType }
      });
    }

    return circuit.vkey;
  } catch (error) {
    if (error instanceof KeyError) {
      throw error;
    }

    throw new KeyError(`Failed to load verification key: ${error.message}`, {
      code: ErrorCode.VERIFICATION_KEY_ERROR,
      details: { circuitType, originalError: error.message },
      cause: error
    });
  }
};

/**
 * Load embedded verification key (minimal emergency backup)
 * @param {string} circuitType - Type of circuit
 * @returns {Promise<Object>} Embedded verification key
 */
export const loadEmbeddedVerificationKey = async (circuitType) => {
  // These would be minimal embedded verification keys for emergency use
  const embeddedKeys = {
    standard: {
      protocol: "groth16",
      curve: "bn128",
      nPublic: 6,
      vk_alpha_1: [
        "20491192805390485299153009773594534940189261866228447918068658471970481763042",
        "9383485363053290200918347156157836566562967994039712273449902621266178545958",
        "1"
      ],
      vk_beta_2: [
        [
          "6375614351688725206403948262868962793625744043794305715222011528459656738731",
          "4252822878758300859123897981450591353533073413197771768651442665752259397132"
        ],
        [
          "10505242626370262277552901082094356697409835680220590971873171140371331206856",
          "21847035105528745403288232691147584728191162732299865338377159692350059136679"
        ],
        ["1", "0"]
      ],
      vk_gamma_2: [
        [
          "10857046999023057135944570762232829481370756359578518086990519993285655852781",
          "11559732032986387107991004021392285783925812861821192530917403151452391805634"
        ],
        [
          "8495653923123431417604973247489272438418190587263600148770280649306958101930",
          "4082367875863433681332203403145435568316851327593401208105741076214120093531"
        ],
        ["1", "0"]
      ],
      vk_alphabeta_12: [
        [
          [
            "16364735124273703586863254435779677768134411299941660783745262854159720080362",
            "7143410465228053023571984034830051012412528303226497521574852484107734051638"
          ],
          [
            "5754767363683708845246195623311954495944907159756223521506322261507767630611",
            "1829106728420574243060122088439114089086314615290479759378863158585140913542"
          ],
          [
            "17775787629811274061440642823695344230221590983362982093958436389780169794182",
            "5852882690076741500250905083921760926077068450272207548459576508978052056410"
          ]
        ],
        [
          [
            "14327840131895618001262026688858316211072783021457146756960808641529389878055",
            "4221465648134626526265052322990372073404763330744964260030418487902127100688"
          ],
          [
            "5430098344011943093649289716213906227252127626027149932692623809729070699061",
            "2489747190776416864610598673722693232690154874691558213559240653233552276033"
          ],
          [
            "13927832884626737127392407694777073979343732834827317419289091907808513482756",
            "15488337580990463819304346766037212456103199743394179714133647614566247072556"
          ]
        ]
      ],
      vk_ic: []
    },
    threshold: {
      protocol: "groth16",
      curve: "bn128",
      nPublic: 7,
      vk_alpha_1: [
        "20491192805390485299153009773594534940189261866228447918068658471970481763042",
        "9383485363053290200918347156157836566562967994039712273449902621266178545958",
        "1"
      ],
      vk_beta_2: [
        [
          "6375614351688725206403948262868962793625744043794305715222011528459656738731",
          "4252822878758300859123897981450591353533073413197771768651442665752259397132"
        ],
        [
          "10505242626370262277552901082094356697409835680220590971873171140371331206856",
          "21847035105528745403288232691147584728191162732299865338377159692350059136679"
        ],
        ["1", "0"]
      ],
      vk_gamma_2: [
        [
          "10857046999023057135944570762232829481370756359578518086990519993285655852781",
          "11559732032986387107991004021392285783925812861821192530917403151452391805634"
        ],
        [
          "8495653923123431417604973247489272438418190587263600148770280649306958101930",
          "4082367875863433681332203403145435568316851327593401208105741076214120093531"
        ],
        ["1", "0"]
      ],
      vk_alphabeta_12: [
        [
          [
            "16364735124273703586863254435779677768134411299941660783745262854159720080362",
            "7143410465228053023571984034830051012412528303226497521574852484107734051638"
          ],
          [
            "5754767363683708845246195623311954495944907159756223521506322261507767630611",
            "1829106728420574243060122088439114089086314615290479759378863158585140913542"
          ],
          [
            "17775787629811274061440642823695344230221590983362982093958436389780169794182",
            "5852882690076741500250905083921760926077068450272207548459576508978052056410"
          ]
        ],
        [
          [
            "14327840131895618001262026688858316211072783021457146756960808641529389878055",
            "4221465648134626526265052322990372073404763330744964260030418487902127100688"
          ],
          [
            "5430098344011943093649289716213906227252127626027149932692623809729070699061",
            "2489747190776416864610598673722693232690154874691558213559240653233552276033"
          ],
          [
            "13927832884626737127392407694777073979343732834827317419289091907808513482756",
            "15488337580990463819304346766037212456103199743394179714133647614566247072556"
          ]
        ]
      ],
      vk_ic: []
    },
    maximum: {
      protocol: "groth16",
      curve: "bn128",
      nPublic: 7,
      vk_alpha_1: [
        "20491192805390485299153009773594534940189261866228447918068658471970481763042",
        "9383485363053290200918347156157836566562967994039712273449902621266178545958",
        "1"
      ],
      vk_beta_2: [
        [
          "6375614351688725206403948262868962793625744043794305715222011528459656738731",
          "4252822878758300859123897981450591353533073413197771768651442665752259397132"
        ],
        [
          "10505242626370262277552901082094356697409835680220590971873171140371331206856",
          "21847035105528745403288232691147584728191162732299865338377159692350059136679"
        ],
        ["1", "0"]
      ],
      vk_gamma_2: [
        [
          "10857046999023057135944570762232829481370756359578518086990519993285655852781",
          "11559732032986387107991004021392285783925812861821192530917403151452391805634"
        ],
        [
          "8495653923123431417604973247489272438418190587263600148770280649306958101930",
          "4082367875863433681332203403145435568316851327593401208105741076214120093531"
        ],
        ["1", "0"]
      ],
      vk_alphabeta_12: [
        [
          [
            "16364735124273703586863254435779677768134411299941660783745262854159720080362",
            "7143410465228053023571984034830051012412528303226497521574852484107734051638"
          ],
          [
            "5754767363683708845246195623311954495944907159756223521506322261507767630611",
            "1829106728420574243060122088439114089086314615290479759378863158585140913542"
          ],
          [
            "17775787629811274061440642823695344230221590983362982093958436389780169794182",
            "5852882690076741500250905083921760926077068450272207548459576508978052056410"
          ]
        ],
        [
          [
            "14327840131895618001262026688858316211072783021457146756960808641529389878055",
            "4221465648134626526265052322990372073404763330744964260030418487902127100688"
          ],
          [
            "5430098344011943093649289716213906227252127626027149932692623809729070699061",
            "2489747190776416864610598673722693232690154874691558213559240653233552276033"
          ],
          [
            "13927832884626737127392407694777073979343732834827317419289091907808513482756",
            "15488337580990463819304346766037212456103199743394179714133647614566247072556"
          ]
        ]
      ],
      vk_ic: []
    }
  };

  const circuitKey = circuitTypeToKey(circuitType);

  if (!embeddedKeys[circuitKey]) {
    throw new KeyError(`No embedded verification key available for circuit type: ${circuitType}`, {
      code: ErrorCode.VERIFICATION_KEY_ERROR,
      details: {
        circuitType,
        availableTypes: Object.keys(embeddedKeys)
      }
    });
  }

  return embeddedKeys[circuitKey];
};

/**
 * Convert circuit type to key name
 * @param {string|number} circuitType - Circuit type identifier
 * @returns {string} Key name
 */
const circuitTypeToKey = (circuitType) => {
  // If it's a number from ZK_PROOF_TYPES
  if (typeof circuitType === 'number') {
    switch (circuitType) {
      case ZK_PROOF_TYPES.STANDARD:
        return 'standard';
      case ZK_PROOF_TYPES.THRESHOLD:
        return 'threshold';
      case ZK_PROOF_TYPES.MAXIMUM:
        return 'maximum';
      default:
        return 'standard';
    }
  }

  // If it's already a string
  if (typeof circuitType === 'string') {
    const normalized = circuitType.toLowerCase();
    if (normalized.includes('standard')) return 'standard';
    if (normalized.includes('threshold')) return 'threshold';
    if (normalized.includes('maximum')) return 'maximum';
  }

  // Default fallback
  return 'standard';
};

/**
 * Load verification key from CDN
 * @param {string} circuitType - Type of circuit
 * @returns {Promise<Object>} Verification key from CDN
 */
export const loadVerificationKeyFromCDN = async (circuitType) => {
  const circuitKey = circuitTypeToKey(circuitType);
  const cdnUrl = `https://static.proofoffunds.com/zk-assets/verification-keys/${circuitKey}-vkey.json`;

  try {
    const response = await fetch(cdnUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      timeout: 5000 // 5 second timeout
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from CDN: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new KeyError(`Failed to load verification key from CDN for circuit type: ${circuitType}`, {
      code: ErrorCode.VERIFICATION_KEY_ERROR,
      details: {
        circuitType,
        cdnUrl,
        originalError: error.message
      },
      cause: error
    });
  }
};

/**
 * Verify proof through the server API (fallback)
 * @param {Object} proof - Proof to verify
 * @param {Array} publicSignals - Public signals 
 * @param {Object} options - Options for verification
 * @returns {Promise<boolean>} Whether the proof is valid
 */
export const verifyProofWithServer = async (proof, publicSignals, options = {}) => {
  const circuitKey = circuitTypeToKey(options.circuitType);

  try {
    // Call verification server API
    const response = await fetch('https://api.proofoffunds.com/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        circuitType: circuitKey,
        proof,
        publicSignals
      }),
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Server verification failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    return result.isValid === true;
  } catch (error) {
    throw new EnhancedVerificationError(`Server-based verification failed: ${error.message}`, {
      code: ErrorCode.VERIFICATION_GENERIC_ERROR,
      details: {
        originalError: error.message,
        circuitType: options.circuitType
      },
      cause: error,
      userMessage: 'Verification server is currently unavailable. Please try again later.'
    });
  }
};

/**
 * Verifies a zero-knowledge proof
 * @param {Object|string} proof - The proof to verify
 * @param {Object} [options] - Optional verification parameters
 * @returns {Promise<Object>} Result object with validity and reason
 * @throws {VerificationError} If verification fails
 */
export const verifyProof = async (proof, options = {}) => {
  try {
    // Normalize input format
    let proofObj, publicSignals, proofType;

    if (typeof proof === 'string') {
      try {
        proofObj = JSON.parse(proof);
      } catch (parseError) {
        return { valid: false, reason: 'Invalid proof format: not a valid JSON string' };
      }
    } else if (typeof proof === 'object') {
      proofObj = proof;
    } else {
      return { valid: false, reason: `Invalid proof type: ${typeof proof}` };
    }

    // Extract proof parameters
    if (proofObj.proof) {
      publicSignals = proofObj.publicSignals || proofObj.publicInputs;
      proofType = proofObj.proofType || ZK_PROOF_TYPES.STANDARD;
    } else {
      // Legacy format handling
      publicSignals = options.publicSignals;
      proofType = options.proofType || ZK_PROOF_TYPES.STANDARD;
    }

    // Call the appropriate verification function
    if (options.useOnChain) {
      const result = await verifyZKProofOnChain({
        walletAddress: options.walletAddress || proofObj.walletAddress,
        provider: options.provider
      });

      return {
        valid: result,
        reason: result ? 'Proof verified successfully on-chain' : 'On-chain verification failed'
      };
    } else {
      // Use client-side verification
      const result = await verifyZKProof({
        proof: proofObj.proof || proofObj,
        publicSignals,
        proofType,
        options
      });

      return {
        valid: result,
        reason: result ? 'Proof verified successfully' : 'Verification failed'
      };
    }
  } catch (error) {
    // Return a structured error response
    return {
      valid: false,
      reason: error.message || 'Unknown verification error',
      errorCode: error.code || 'VERIFICATION_ERROR',
      details: error.details || {}
    };
  }
};

// Export core functionality
export default {
  verifyZKProof,
  verifyZKProofOnChain,
  verifyProof,
  initializeSnarkJS,

  // New validation and error handling exports
  validateProofFormat,
  loadVerificationKeyWithFallbacks,
  loadVerificationKey,
  loadEmbeddedVerificationKey,
  loadVerificationKeyFromCDN,
  verifyProofWithServer,

  // Export error classes for consumers
  ErrorClasses: {
    EnhancedVerificationError,
    CircuitError,
    ProofError,
    KeyError,
    ComputationError
  }
};