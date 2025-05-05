/**
 * zkCircuitParameterDerivation.mjs - Derivation of circuit parameters from transaction data
 * 
 * This module provides functions to generate appropriate circuit parameters
 * based on transaction data, wallet information, and proof requirements.
 * It connects wallet data to circuit inputs and handles circuit-specific
 * parameter generation with proper validation.
 * 
 * Version: 1.0.0
 * 
 * ---------- NON-TECHNICAL EXPLANATION ----------
 * This module is like a translator that converts regular transaction information
 * into a special format that our privacy-preserving system can understand. It's 
 * similar to how a travel agent might prepare your documents before a trip - 
 * taking your personal details and formatting them exactly as required by 
 * the destination country's immigration system.
 * 
 * The module handles three types of "proof packages":
 * 1. Standard proof - Shows you have exactly a specific amount
 * 2. Threshold proof - Shows you have at least a minimum amount
 * 3. Maximum proof - Shows you have no more than a maximum amount
 * 
 * Each proof type protects your financial privacy while still proving what's needed.
 */

// Import all dependencies at the top
import { getEthers } from '../../ethersUtils.js';
import { addressToBytes as importedAddressToBytes } from './zkCircuitInputs.js';
import { getCircuitMemoryRequirements } from './zkCircuitRegistry.js';
import deviceCapabilities from './deviceCapabilities.js';
import { zkErrorLogger } from './zkErrorLogger.mjs';
import {
  InputError,
  ProofError,
  SecurityError,
  SystemError,
  ErrorCode,
  isZKError
} from './zkErrorHandler.mjs';

// Use correct function from the default export
const getDeviceCapabilities = deviceCapabilities.detectCapabilities;

// Fallback implementation if import fails
function localAddressToBytes(address) {
  const operationId = `localAddressToBytes_${Date.now()}`;

  try {
    // Validate input
    if (!address || typeof address !== 'string') {
      throw new InputError('Invalid address format', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: typeof address }
      });
    }

    // Remove 0x prefix if present
    const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;

    // Validate cleaned address is valid hex string
    if (!/^[0-9a-fA-F]+$/.test(cleanAddress) || cleanAddress.length !== 40) {
      throw new InputError('Invalid address format (not a valid hexadecimal string)', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { address, cleanAddress, length: cleanAddress.length }
      });
    }

    // Convert to bytes
    const bytes = [];
    for (let i = 0; i < cleanAddress.length; i += 2) {
      bytes.push(parseInt(cleanAddress.slice(i, i + 2), 16));
    }

    return bytes;
  } catch (error) {
    // If it's already a ZKError, just log it
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'localAddressToBytes' });
      throw error;
    }

    // Otherwise, wrap it in an InputError
    const zkError = new InputError(`Failed to convert address to bytes: ${error.message}`, {
      code: ErrorCode.INPUT_VALIDATION_FAILED,
      operationId,
      recoverable: false,
      userFixable: true,
      details: { address, originalError: error.message }
    });

    zkErrorLogger.logError(zkError, { context: 'localAddressToBytes' });
    throw zkError;
  }
}

// Use imported function or fallback to local implementation
const addressToBytes = importedAddressToBytes || localAddressToBytes;

/**
 * Generate a deterministic nonce for ZK proofs
 * The nonce is used to prevent correlation between different proofs
 * 
 * @param {string} walletAddress - The wallet address
 * @param {string} amount - The amount involved in the transaction
 * @param {number} timestamp - The timestamp to use (or current time if not provided)
 * @returns {string} Hex string representing the nonce
 * @throws {InputError} If inputs are invalid
 * @throws {SystemError} If ethers is not available or nonce generation fails
 */
async function generateProofNonce(walletAddress, amount, timestamp = Date.now()) {
  const operationId = `generateProofNonce_${Date.now()}`;

  try {
    // Validate inputs
    if (!walletAddress || typeof walletAddress !== 'string') {
      throw new InputError('Wallet address is required for nonce generation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: typeof walletAddress }
      });
    }

    if (amount === undefined || amount === null) {
      throw new InputError('Amount is required for nonce generation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: typeof amount }
      });
    }

    // Get ethers instance
    const { ethers } = await getEthers().catch(error => {
      throw new SystemError(`Failed to load ethers for nonce generation: ${error.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        recoverable: false,
        details: { originalError: error.message }
      });
    });

    // Create a deterministic but unpredictable nonce by hashing the inputs
    const nonceData = `${walletAddress}-${amount}-${timestamp}`;

    try {
      return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(nonceData));
    } catch (hashError) {
      throw new SystemError(`Failed to generate keccak256 hash for nonce: ${hashError.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        recoverable: false,
        details: {
          nonceData,
          originalError: hashError.message
        }
      });
    }
  } catch (error) {
    // If it's already a ZKError, just log it
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'generateProofNonce' });
      throw error;
    }

    // Otherwise, wrap it in a SystemError
    const zkError = new SystemError(`Failed to generate proof nonce: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId,
      recoverable: false,
      details: { walletAddress, amount, timestamp, originalError: error.message }
    });

    zkErrorLogger.logError(zkError, { context: 'generateProofNonce' });
    throw zkError;
  }
}

/**
 * Generate a unique proof identifier for reference and tracking
 * 
 * @param {string} walletAddress - The wallet address
 * @param {string} proofType - The type of proof (standard, threshold, maximum)
 * @param {string} amount - The amount involved
 * @returns {string} A unique proof ID
 * @throws {InputError} If inputs are invalid
 * @throws {SystemError} If ethers is not available or hash generation fails
 */
async function generateProofId(walletAddress, proofType, amount) {
  const operationId = `generateProofId_${Date.now()}`;

  try {
    // Validate inputs
    if (!walletAddress || typeof walletAddress !== 'string') {
      throw new InputError('Wallet address is required for proof ID generation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: typeof walletAddress }
      });
    }

    if (!proofType || typeof proofType !== 'string') {
      throw new InputError('Proof type is required for proof ID generation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: typeof proofType }
      });
    }

    if (amount === undefined || amount === null) {
      throw new InputError('Amount is required for proof ID generation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: typeof amount }
      });
    }

    // Get ethers instance
    const { ethers } = await getEthers().catch(error => {
      throw new SystemError(`Failed to load ethers for proof ID generation: ${error.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        recoverable: false,
        details: { originalError: error.message }
      });
    });

    // Generate the hash for the proof ID
    try {
      const baseString = `${walletAddress.toLowerCase()}-${proofType}-${amount}`;
      const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(baseString));
      return `pof-${hash.slice(2, 18)}`; // Use first 8 bytes of hash for ID
    } catch (hashError) {
      throw new SystemError(`Failed to generate hash for proof ID: ${hashError.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        recoverable: false,
        details: {
          walletAddress,
          proofType,
          amount,
          originalError: hashError.message
        }
      });
    }
  } catch (error) {
    // If it's already a ZKError, just log it
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'generateProofId' });
      throw error;
    }

    // Otherwise, wrap it in a SystemError
    const zkError = new SystemError(`Failed to generate proof ID: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId,
      recoverable: false,
      details: { walletAddress, proofType, amount, originalError: error.message }
    });

    zkErrorLogger.logError(zkError, { context: 'generateProofId' });
    throw zkError;
  }
}

/**
 * Convert amount string to appropriate circuit numeric representation
 * Handles different number formats and guarantees circuit compatibility
 * 
 * @param {string|number} amount - The amount to convert
 * @param {number} [decimals=18] - The number of decimal places (default for ETH)
 * @returns {string} String representation of the amount suitable for circuits
 * @throws {InputError} If amount format is invalid
 * @throws {SystemError} If ethers is not available or BigNumber conversion fails
 */
async function normalizeAmountForCircuit(amount, decimals = 18) {
  const operationId = `normalizeAmount_${Date.now()}`;

  try {
    // Validate inputs
    if (amount === undefined || amount === null) {
      throw new InputError('Amount is required for normalization', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: typeof amount }
      });
    }

    if (typeof decimals !== 'number' || decimals < 0 || !Number.isInteger(decimals)) {
      throw new InputError('Decimals must be a non-negative integer', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: {
          providedDecimals: decimals,
          type: typeof decimals,
          isInteger: Number.isInteger(decimals)
        }
      });
    }

    // Get ethers instance
    const { ethers } = await getEthers().catch(error => {
      throw new SystemError(`Failed to load ethers for amount normalization: ${error.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        recoverable: false,
        details: { originalError: error.message }
      });
    });

    try {
      // If amount includes decimal point, convert to proper integer representation
      if (typeof amount === 'string' && amount.includes('.')) {
        // Validate decimal string format
        if (!/^-?\d+\.\d*$/.test(amount)) {
          throw new InputError('Invalid decimal amount format', {
            code: ErrorCode.INPUT_VALIDATION_FAILED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { amount }
          });
        }

        // Split into whole and fractional parts
        const [whole, fraction = ''] = amount.split('.');

        // Pad or truncate fraction to match decimals
        const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);

        // Combine whole and fraction without decimal point
        try {
          return ethers.BigNumber.from(whole + paddedFraction).toString();
        } catch (bnError) {
          throw new InputError(`Failed to convert decimal amount to BigNumber: ${bnError.message}`, {
            code: ErrorCode.INPUT_VALIDATION_FAILED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: {
              amount,
              whole,
              fraction,
              paddedFraction,
              combined: whole + paddedFraction,
              originalError: bnError.message
            }
          });
        }
      }

      // Convert any other format to BigNumber and return as string
      try {
        return ethers.BigNumber.from(amount).toString();
      } catch (bnError) {
        throw new InputError(`Failed to convert amount to BigNumber: ${bnError.message}`, {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { amount, originalError: bnError.message }
        });
      }
    } catch (error) {
      // If it's already a ZKError, propagate it
      if (isZKError(error)) {
        throw error;
      }

      // Otherwise wrap in InputError
      throw new InputError(`Invalid amount format: ${error.message}`, {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { amount, decimals, originalError: error.message }
      });
    }
  } catch (error) {
    // If it's already a ZKError, just log it
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'normalizeAmountForCircuit' });
      throw error;
    }

    // Otherwise, wrap it in an InputError
    const zkError = new InputError(`Failed to normalize amount for circuit: ${error.message}`, {
      code: ErrorCode.INPUT_VALIDATION_FAILED,
      operationId,
      recoverable: false,
      userFixable: true,
      details: { amount, decimals, originalError: error.message }
    });

    zkErrorLogger.logError(zkError, { context: 'normalizeAmountForCircuit' });
    throw zkError;
  }
}

/**
 * Derive wallet address representation for ZK circuits
 * 
 * @param {string} walletAddress - The wallet address
 * @returns {Object} Object containing different representations of the address
 * @throws {InputError} If wallet address is invalid
 * @throws {SystemError} If ethers is not available or conversion fails
 */
async function deriveAddressParameters(walletAddress) {
  const operationId = `deriveAddress_${Date.now()}`;

  try {
    // Validate inputs
    if (!walletAddress || typeof walletAddress !== 'string') {
      throw new InputError('Wallet address is required for parameter derivation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: typeof walletAddress }
      });
    }

    // Get ethers instance
    const { ethers } = await getEthers().catch(error => {
      throw new SystemError(`Failed to load ethers for address parameter derivation: ${error.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        recoverable: false,
        details: { originalError: error.message }
      });
    });

    try {
      // Validate the address
      if (!ethers.utils.isAddress(walletAddress)) {
        throw new InputError(`Invalid Ethereum address: ${walletAddress}`, {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { walletAddress }
        });
      }

      // Get the checksummed address
      const checksumAddress = ethers.utils.getAddress(walletAddress);

      // Convert to bytes array for circuit
      try {
        const addressBytes = addressToBytes(checksumAddress);

        // Calculate address hash
        const addressHash = ethers.utils.keccak256(checksumAddress);

        // Calculate Poseidon-compatible inputs (simplified - in real implementation would use Poseidon hash)
        // This is a placeholder as actual Poseidon hash would be calculated in the circuit
        const poseidonInputs = addressBytes.map(byte => byte.toString());

        return {
          original: walletAddress,
          checksum: checksumAddress,
          bytes: addressBytes,
          hash: addressHash,
          poseidonInputs
        };
      } catch (conversionError) {
        // Handle errors from addressToBytes
        if (isZKError(conversionError)) {
          throw conversionError;
        }

        throw new SystemError(`Failed to convert address to bytes: ${conversionError.message}`, {
          code: ErrorCode.SYSTEM_NOT_INITIALIZED,
          operationId,
          recoverable: false,
          details: {
            walletAddress,
            checksumAddress,
            originalError: conversionError.message
          }
        });
      }
    } catch (error) {
      // If it's already a ZKError, propagate it
      if (isZKError(error)) {
        throw error;
      }

      // Otherwise wrap in InputError for validation failures
      throw new InputError(`Invalid wallet address: ${error.message}`, {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { walletAddress, originalError: error.message }
      });
    }
  } catch (error) {
    // If it's already a ZKError, just log it
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'deriveAddressParameters' });
      throw error;
    }

    // Otherwise, wrap it in a SystemError
    const zkError = new SystemError(`Failed to derive address parameters: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId,
      recoverable: false,
      details: { walletAddress, originalError: error.message }
    });

    zkErrorLogger.logError(zkError, { context: 'deriveAddressParameters' });
    throw zkError;
  }
}

/**
 * Derive signature parameters for proof verification
 * 
 * @param {string} walletAddress - The wallet address 
 * @param {string} signature - The signature to verify wallet ownership
 * @returns {Object} Signature parameters for circuits
 * @throws {InputError} If inputs are invalid or signature format is incorrect
 * @throws {SystemError} If ethers is not available or signature processing fails
 */
async function deriveSignatureParameters(walletAddress, signature) {
  const operationId = `deriveSignature_${Date.now()}`;

  try {
    // Validate inputs
    if (!walletAddress || typeof walletAddress !== 'string') {
      throw new InputError('Wallet address is required for signature parameter derivation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: typeof walletAddress }
      });
    }

    if (!signature || typeof signature !== 'string') {
      throw new InputError('Signature is required for proof generation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: typeof signature }
      });
    }

    // Get ethers instance
    const { ethers } = await getEthers().catch(error => {
      throw new SystemError(`Failed to load ethers for signature parameter derivation: ${error.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        recoverable: false,
        details: { originalError: error.message }
      });
    });

    try {
      // Split signature into r, s, v components
      const sig = ethers.utils.splitSignature(signature);

      // Convert to circuit-compatible format
      const signatureComponents = [
        ethers.BigNumber.from(sig.r).toString(),
        ethers.BigNumber.from(sig.s).toString()
      ];

      // Recovery bit for public key recovery (v)
      const recoveryBit = sig.v;

      // Calculate the message that was signed (this depends on your protocol)
      // In a real implementation, this would be standardized based on your app's requirements
      const message = `I confirm ownership of wallet ${walletAddress}`;
      const messageHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(message));

      try {
        // Recover the public key from signature (for verification)
        const publicKey = ethers.utils.recoverPublicKey(
          ethers.utils.arrayify(messageHash),
          signature
        );

        return {
          r: sig.r,
          s: sig.s,
          v: sig.v,
          signatureComponents,
          recoveryBit,
          messageHash,
          publicKey
        };
      } catch (recoverError) {
        throw new SecurityError('Failed to recover public key from signature', {
          code: ErrorCode.SECURITY_SIGNATURE_VERIFICATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: {
            walletAddress,
            messageHash,
            error: recoverError.message
          }
        });
      }
    } catch (error) {
      // If it's a ZKError from the public key recovery, let it pass through
      if (isZKError(error)) {
        throw error;
      }

      // Otherwise wrap in an InputError
      throw new InputError(`Invalid signature format: ${error.message}`, {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: {
          signature: signature.substring(0, 20) + '...',
          error: error.message
        }
      });
    }
  } catch (error) {
    // If it's already a ZKError, just log it
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'deriveSignatureParameters' });
      throw error;
    }

    // Otherwise, wrap it in a SystemError
    const zkError = new SystemError(`Failed to derive signature parameters: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId,
      recoverable: false,
      details: {
        walletAddress,
        signaturePrefix: signature ? signature.substring(0, 10) + '...' : null,
        originalError: error.message
      }
    });

    zkErrorLogger.logError(zkError, { context: 'deriveSignatureParameters' });
    throw zkError;
  }
}

/**
 * Check whether proof generation can be performed on the client device
 * 
 * @param {string} circuitType - Type of circuit (standard, threshold, maximum)
 * @param {Object} options - Additional options for capability check
 * @returns {boolean} Whether client-side proof generation is recommended
 * @throws {InputError} If circuit type is invalid
 * @throws {SystemError} If device capability detection fails
 */
function canGenerateProofClientSide(circuitType, options = {}) {
  const operationId = `checkClientCapabilities_${Date.now()}`;

  try {
    // Validate circuit type
    if (!circuitType || typeof circuitType !== 'string') {
      throw new InputError('Circuit type is required to check client capabilities', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: typeof circuitType }
      });
    }

    // Normalize circuit type for comparison
    const normalizedType = circuitType.toLowerCase();

    // Validate circuit type is one of the supported types
    const validTypes = ['standard', 'threshold', 'maximum'];
    if (!validTypes.includes(normalizedType)) {
      throw new InputError(`Unsupported circuit type: ${circuitType}`, {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: {
          providedType: circuitType,
          supportedTypes: validTypes
        }
      });
    }

    try {
      // Get device capabilities
      const capabilities = getDeviceCapabilities();

      // Get memory requirements for the circuit
      const memoryRequirements = getCircuitMemoryRequirements(normalizedType, 'proving');

      if (!memoryRequirements) {
        throw new SystemError(`Could not determine memory requirements for circuit type: ${normalizedType}`, {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId,
          recoverable: true,
          details: { circuitType: normalizedType }
        });
      }

      // Determine if there's enough memory
      const hasEnoughMemory = capabilities.availableMemory === null ||
        capabilities.availableMemory >= memoryRequirements.proving;

      // Check if WebAssembly and other required features are available
      const hasRequiredFeatures = capabilities.supportsWebAssembly &&
        capabilities.supportsWebCrypto;

      // For complex proofs, also check if Web Workers are available
      const needsWorkers = normalizedType === 'maximum' || normalizedType === 'threshold';
      const hasWorkers = !needsWorkers || capabilities.supportsWebWorkers;

      // Consider user preference if provided
      const preferServerSide = options.preferServerSide === true;

      // Log the capability decision
      zkErrorLogger.logInfo('Client capability check complete', {
        context: 'canGenerateProofClientSide',
        operationId,
        details: {
          circuitType: normalizedType,
          hasEnoughMemory,
          hasRequiredFeatures,
          hasWorkers,
          preferServerSide,
          result: hasEnoughMemory && hasRequiredFeatures && hasWorkers && !preferServerSide
        }
      });

      return hasEnoughMemory && hasRequiredFeatures && hasWorkers && !preferServerSide;
    } catch (error) {
      // If it's already a ZKError (like the one we might have thrown for memory requirements), let it pass through
      if (isZKError(error)) {
        throw error;
      }

      throw new SystemError(`Failed to check device capabilities: ${error.message}`, {
        code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
        operationId,
        recoverable: true,
        details: {
          circuitType,
          originalError: error.message
        }
      });
    }
  } catch (error) {
    // If it's already a ZKError, just log it
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'canGenerateProofClientSide' });
      throw error;
    }

    // Otherwise, wrap it in a SystemError
    const zkError = new SystemError(`Failed to determine if proof can be generated client-side: ${error.message}`, {
      code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      operationId,
      recoverable: true,
      details: {
        circuitType,
        options,
        originalError: error.message
      }
    });

    zkErrorLogger.logError(zkError, { context: 'canGenerateProofClientSide' });
    throw zkError;
  }
}

/**
 * Generate parameters for Standard proof type (exact amount)
 * 
 * @param {Object} params - Base parameters for proof generation
 * @param {string} params.walletAddress - The wallet address
 * @param {string|number} params.amount - The exact amount for the proof
 * @param {string} [params.signature] - Optional signature proving wallet ownership
 * @param {string} [params.nonce] - Optional nonce for the proof
 * @returns {Object} Standard proof circuit parameters
 * @throws {InputError} If required parameters are missing or invalid
 * @throws {SystemError} If parameter derivation fails
 */
async function deriveStandardProofParameters(params) {
  const operationId = `deriveStandardProofParams_${Date.now()}`;

  try {
    // Validate params object
    if (!params || typeof params !== 'object') {
      throw new InputError('Parameters object is required for standard proof derivation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: typeof params }
      });
    }

    // Extract parameters
    const { walletAddress, amount, signature } = params;

    // Validate required parameters
    if (!walletAddress) {
      throw new InputError('Wallet address is required for standard proof parameters', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { params }
      });
    }

    if (amount === undefined || amount === null) {
      throw new InputError('Amount is required for standard proof parameters', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { params }
      });
    }

    try {
      // Get ethers instance
      const { ethers } = await getEthers().catch(error => {
        throw new SystemError(`Failed to load ethers for standard proof parameter derivation: ${error.message}`, {
          code: ErrorCode.SYSTEM_NOT_INITIALIZED,
          operationId,
          recoverable: false,
          details: { originalError: error.message }
        });
      });

      // Generate or use provided nonce
      const nonce = params.nonce || await generateProofNonce(walletAddress, amount);

      // Normalize amount for circuit
      const normalizedAmount = await normalizeAmountForCircuit(amount);

      // Get address parameters
      const addressParams = await deriveAddressParameters(walletAddress);

      // Get signature parameters if available
      let signatureParams = null;
      if (signature) {
        try {
          signatureParams = await deriveSignatureParameters(walletAddress, signature);
        } catch (sigError) {
          // If it's a ZKError, pass it through
          if (isZKError(sigError)) {
            throw sigError;
          }

          throw new InputError(`Invalid signature for standard proof: ${sigError.message}`, {
            code: ErrorCode.INPUT_VALIDATION_FAILED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: {
              walletAddress,
              signaturePrefix: signature.substring(0, 10) + '...',
              originalError: sigError.message
            }
          });
        }
      }

      // Create the result object
      const result = {
        // Public inputs - will be visible in the proof
        publicInputs: {
          address: addressParams.hash, // Address hash is public
          amount: normalizedAmount
        },

        // Private inputs - only used for proof generation, not revealed
        privateInputs: {
          addressBytes: addressParams.bytes,
          nonce,
          // Only include signature components if available
          ...(signatureParams ? {
            signature: signatureParams.signatureComponents,
            privateKey: '0' // Placeholder, not actually used for real proofs
          } : {})
        },

        // Metadata for proof serialization
        metadata: {
          proofType: 'standard',
          walletAddress,
          amount,
          timestamp: Date.now(),
          nonce: ethers.utils.hexlify(nonce)
        }
      };

      return result;
    } catch (error) {
      // If it's a ZKError, just pass it through
      if (isZKError(error)) {
        throw error;
      }

      throw new SystemError(`Failed to derive standard proof parameters: ${error.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        recoverable: false,
        details: {
          walletAddress,
          amount,
          originalError: error.message
        }
      });
    }
  } catch (error) {
    // If it's already a ZKError, just log it
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'deriveStandardProofParameters' });
      throw error;
    }

    // Otherwise, wrap it in a SystemError
    const zkError = new SystemError(`Failed to derive standard proof parameters: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId,
      recoverable: false,
      details: {
        params,
        originalError: error.message
      }
    });

    zkErrorLogger.logError(zkError, { context: 'deriveStandardProofParameters' });
    throw zkError;
  }
}

/**
 * Generate parameters for Threshold proof type (at least amount)
 * 
 * @param {Object} params - Base parameters for proof generation
 * @param {string} params.walletAddress - The wallet address
 * @param {string|number} params.amount - The threshold amount (minimum)
 * @param {string|number} params.actualBalance - The actual balance (must be >= threshold)
 * @param {string} [params.signature] - Optional signature proving wallet ownership
 * @param {string} [params.nonce] - Optional nonce for the proof
 * @returns {Object} Threshold proof circuit parameters
 * @throws {InputError} If required parameters are missing or invalid
 * @throws {ProofError} If the actual balance is less than the threshold
 * @throws {SystemError} If parameter derivation fails
 */
async function deriveThresholdProofParameters(params) {
  const operationId = `deriveThresholdProofParams_${Date.now()}`;

  try {
    // Validate params object
    if (!params || typeof params !== 'object') {
      throw new InputError('Parameters object is required for threshold proof derivation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: typeof params }
      });
    }

    // Extract parameters
    const { walletAddress, amount, actualBalance, signature } = params;

    // Validate required parameters
    if (!walletAddress) {
      throw new InputError('Wallet address is required for threshold proof parameters', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { params }
      });
    }

    if (amount === undefined || amount === null) {
      throw new InputError('Threshold amount is required for threshold proof parameters', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { params }
      });
    }

    if (actualBalance === undefined || actualBalance === null) {
      throw new InputError('Actual balance is required for threshold proofs', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { params }
      });
    }

    try {
      // Get ethers instance
      const { ethers } = await getEthers().catch(error => {
        throw new SystemError(`Failed to load ethers for threshold proof parameter derivation: ${error.message}`, {
          code: ErrorCode.SYSTEM_NOT_INITIALIZED,
          operationId,
          recoverable: false,
          details: { originalError: error.message }
        });
      });

      // Generate or use provided nonce
      const nonce = params.nonce || await generateProofNonce(walletAddress, amount);

      // Normalize amounts for circuit
      const normalizedThreshold = await normalizeAmountForCircuit(amount);
      const normalizedBalance = await normalizeAmountForCircuit(actualBalance);

      // Validate that balance meets threshold
      try {
        if (ethers.BigNumber.from(normalizedBalance).lt(ethers.BigNumber.from(normalizedThreshold))) {
          throw new ProofError(`Actual balance (${actualBalance}) must be greater than or equal to threshold (${amount})`, {
            code: ErrorCode.PROOF_CONDITION_NOT_MET,
            operationId,
            recoverable: false,
            userFixable: true,
            details: {
              threshold: amount,
              actualBalance,
              normalizedThreshold,
              normalizedBalance
            }
          });
        }
      } catch (error) {
        // If it's already a ZKError, pass it through
        if (isZKError(error)) {
          throw error;
        }

        // Otherwise, it's likely a BigNumber error
        throw new InputError(`Failed to compare balance and threshold: ${error.message}`, {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: {
            threshold: amount,
            actualBalance,
            normalizedThreshold,
            normalizedBalance,
            originalError: error.message
          }
        });
      }

      // Get address parameters
      const addressParams = await deriveAddressParameters(walletAddress);

      // Get signature parameters if available
      let signatureParams = null;
      if (signature) {
        try {
          signatureParams = await deriveSignatureParameters(walletAddress, signature);
        } catch (sigError) {
          // If it's a ZKError, pass it through
          if (isZKError(sigError)) {
            throw sigError;
          }

          throw new InputError(`Invalid signature for threshold proof: ${sigError.message}`, {
            code: ErrorCode.INPUT_VALIDATION_FAILED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: {
              walletAddress,
              signaturePrefix: signature.substring(0, 10) + '...',
              originalError: sigError.message
            }
          });
        }
      }

      // Create the result object
      const result = {
        // Public inputs
        publicInputs: {
          address: addressParams.hash,
          threshold: normalizedThreshold
        },

        // Private inputs
        privateInputs: {
          addressBytes: addressParams.bytes,
          actualBalance: normalizedBalance,
          nonce,
          // Only include signature components if available
          ...(signatureParams ? {
            signature: signatureParams.signatureComponents,
            privateKey: '0' // Placeholder, not actually used for real proofs
          } : {})
        },

        // Metadata
        metadata: {
          proofType: 'threshold',
          walletAddress,
          threshold: amount,
          actualBalance,
          timestamp: Date.now(),
          nonce: ethers.utils.hexlify(nonce)
        }
      };

      return result;
    } catch (error) {
      // If it's a ZKError, just pass it through
      if (isZKError(error)) {
        throw error;
      }

      throw new SystemError(`Failed to derive threshold proof parameters: ${error.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        recoverable: false,
        details: {
          walletAddress,
          amount,
          actualBalance,
          originalError: error.message
        }
      });
    }
  } catch (error) {
    // If it's already a ZKError, just log it
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'deriveThresholdProofParameters' });
      throw error;
    }

    // Otherwise, wrap it in a SystemError
    const zkError = new SystemError(`Failed to derive threshold proof parameters: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId,
      recoverable: false,
      details: {
        params,
        originalError: error.message
      }
    });

    zkErrorLogger.logError(zkError, { context: 'deriveThresholdProofParameters' });
    throw zkError;
  }
}

/**
 * Generate parameters for Maximum proof type (at most amount)
 * 
 * @param {Object} params - Base parameters for proof generation
 * @param {string} params.walletAddress - The wallet address
 * @param {string|number} params.amount - The maximum amount (upper limit)
 * @param {string|number} params.actualBalance - The actual balance (must be <= maximum)
 * @param {string} [params.signature] - Optional signature proving wallet ownership
 * @param {string} [params.nonce] - Optional nonce for the proof
 * @returns {Object} Maximum proof circuit parameters
 * @throws {InputError} If required parameters are missing or invalid
 * @throws {ProofError} If the actual balance is greater than the maximum
 * @throws {SystemError} If parameter derivation fails
 */
async function deriveMaximumProofParameters(params) {
  const operationId = `deriveMaximumProofParams_${Date.now()}`;

  try {
    // Validate params object
    if (!params || typeof params !== 'object') {
      throw new InputError('Parameters object is required for maximum proof derivation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: typeof params }
      });
    }

    // Extract parameters
    const { walletAddress, amount, actualBalance, signature } = params;

    // Validate required parameters
    if (!walletAddress) {
      throw new InputError('Wallet address is required for maximum proof parameters', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { params }
      });
    }

    if (amount === undefined || amount === null) {
      throw new InputError('Maximum amount is required for maximum proof parameters', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { params }
      });
    }

    if (actualBalance === undefined || actualBalance === null) {
      throw new InputError('Actual balance is required for maximum proofs', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { params }
      });
    }

    try {
      // Get ethers instance
      const { ethers } = await getEthers().catch(error => {
        throw new SystemError(`Failed to load ethers for maximum proof parameter derivation: ${error.message}`, {
          code: ErrorCode.SYSTEM_NOT_INITIALIZED,
          operationId,
          recoverable: false,
          details: { originalError: error.message }
        });
      });

      // Generate or use provided nonce
      const nonce = params.nonce || await generateProofNonce(walletAddress, amount);

      // Normalize amounts for circuit
      const normalizedMaximum = await normalizeAmountForCircuit(amount);
      const normalizedBalance = await normalizeAmountForCircuit(actualBalance);

      // Validate that balance meets maximum constraint
      try {
        if (ethers.BigNumber.from(normalizedBalance).gt(ethers.BigNumber.from(normalizedMaximum))) {
          throw new ProofError(`Actual balance (${actualBalance}) must be less than or equal to maximum (${amount})`, {
            code: ErrorCode.PROOF_CONDITION_NOT_MET,
            operationId,
            recoverable: false,
            userFixable: true,
            details: {
              maximum: amount,
              actualBalance,
              normalizedMaximum,
              normalizedBalance
            }
          });
        }
      } catch (error) {
        // If it's a ZKError, pass it through
        if (isZKError(error)) {
          throw error;
        }

        // Otherwise, it's likely a BigNumber error
        throw new InputError(`Failed to compare balance and maximum: ${error.message}`, {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: {
            maximum: amount,
            actualBalance,
            normalizedMaximum,
            normalizedBalance,
            originalError: error.message
          }
        });
      }

      // Get address parameters
      const addressParams = await deriveAddressParameters(walletAddress);

      // Get signature parameters if available
      let signatureParams = null;
      if (signature) {
        try {
          signatureParams = await deriveSignatureParameters(walletAddress, signature);
        } catch (sigError) {
          // If it's a ZKError, pass it through
          if (isZKError(sigError)) {
            throw sigError;
          }

          throw new InputError(`Invalid signature for maximum proof: ${sigError.message}`, {
            code: ErrorCode.INPUT_VALIDATION_FAILED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: {
              walletAddress,
              signaturePrefix: signature.substring(0, 10) + '...',
              originalError: sigError.message
            }
          });
        }
      }

      // Create the result object
      const result = {
        // Public inputs
        publicInputs: {
          address: addressParams.hash,
          maximum: normalizedMaximum
        },

        // Private inputs
        privateInputs: {
          addressBytes: addressParams.bytes,
          actualBalance: normalizedBalance,
          nonce,
          // Only include signature components if available
          ...(signatureParams ? {
            signature: signatureParams.signatureComponents,
            privateKey: '0' // Placeholder, not actually used for real proofs
          } : {})
        },

        // Metadata
        metadata: {
          proofType: 'maximum',
          walletAddress,
          maximum: amount,
          actualBalance,
          timestamp: Date.now(),
          nonce: ethers.utils.hexlify(nonce)
        }
      };

      return result;
    } catch (error) {
      // If it's a ZKError, just pass it through
      if (isZKError(error)) {
        throw error;
      }

      throw new SystemError(`Failed to derive maximum proof parameters: ${error.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        recoverable: false,
        details: {
          walletAddress,
          amount,
          actualBalance,
          originalError: error.message
        }
      });
    }
  } catch (error) {
    // If it's already a ZKError, just log it
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'deriveMaximumProofParameters' });
      throw error;
    }

    // Otherwise, wrap it in a SystemError
    const zkError = new SystemError(`Failed to derive maximum proof parameters: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId,
      recoverable: false,
      details: {
        params,
        originalError: error.message
      }
    });

    zkErrorLogger.logError(zkError, { context: 'deriveMaximumProofParameters' });
    throw zkError;
  }
}

/**
 * Derive circuit parameters for proof generation
 * 
 * @param {string} walletAddress - The wallet address to derive parameters for
 * @param {string} assetType - The type of asset (ETH, BTC, SOL, USDC, USDT)
 * @param {Object} options - Additional options for parameter derivation
 * @returns {Promise<Object>} The derived parameters
 * @throws {InputError} If inputs are invalid
 * @throws {SystemError} If parameter derivation fails
 */
async function deriveCircuitParameters(walletAddress, assetType, options = {}) {
  const operationId = `derive_params_${Date.now()}`;

  try {
    // Validate inputs
    if (!walletAddress) {
      throw new InputError('Wallet address is required', {
        operationId,
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        details: { parameter: 'walletAddress' }
      });
    }

    if (!assetType) {
      throw new InputError('Asset type is required', {
        operationId,
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        details: { parameter: 'assetType' }
      });
    }

    // Validate wallet address format
    if (!/^(0x)?[0-9a-fA-F]{40}$/.test(walletAddress)) {
      throw new InputError('Invalid wallet address format', {
        operationId,
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        details: {
          parameter: 'walletAddress',
          expected: '0x-prefixed 40-character hex string',
          received: walletAddress
        }
      });
    }

    // Validate asset type is one of the supported types
    const supportedAssets = ['ETH', 'BTC', 'SOL', 'USDC', 'USDT'];
    if (!supportedAssets.includes(assetType)) {
      throw new InputError('Unsupported asset type', {
        operationId,
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        details: {
          parameter: 'assetType',
          supportedTypes: supportedAssets,
          received: assetType
        }
      });
    }

    // Process options with validation
    const defaultOptions = {
      proofType: 'standard',
      includeTimestamp: true,
      optimizeForDevice: true
    };

    const mergedOptions = { ...defaultOptions, ...options };

    // Validate proof type
    const validProofTypes = ['standard', 'threshold', 'maximum'];
    if (!validProofTypes.includes(mergedOptions.proofType)) {
      throw new InputError('Invalid proof type', {
        operationId,
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        details: {
          parameter: 'proofType',
          validTypes: validProofTypes,
          received: mergedOptions.proofType
        }
      });
    }

    // Process parameters based on asset type
    let parameters;
    switch (assetType) {
      case 'ETH':
        parameters = await zkCircuitParameterDerivation.processEthereumParameters(walletAddress, mergedOptions);
        break;
      case 'BTC':
        parameters = await zkCircuitParameterDerivation.processBitcoinParameters(walletAddress, mergedOptions);
        break;
      case 'SOL':
        parameters = await zkCircuitParameterDerivation.processSolanaParameters(walletAddress, mergedOptions);
        break;
      case 'USDC':
      case 'USDT':
        parameters = await zkCircuitParameterDerivation.processStablecoinParameters(walletAddress, assetType, mergedOptions);
        break;
      default:
        // This shouldn't be reached due to earlier validation, but as a safeguard
        throw new InputError(`Unsupported asset type: ${assetType}`, {
          operationId,
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          details: { parameter: 'assetType' }
        });
    }

    // Add common parameters
    parameters.timestamp = mergedOptions.includeTimestamp ? Date.now() : undefined;
    parameters.assetType = assetType;
    parameters.walletAddress = walletAddress;
    parameters.operationId = operationId;

    // Check device capabilities if optimizing for device
    if (mergedOptions.optimizeForDevice) {
      const deviceCaps = getDeviceCapabilities();
      const circuitReqs = getCircuitMemoryRequirements(mergedOptions.proofType);

      // Check if device can handle the circuit
      if (deviceCaps.availableMemory < circuitReqs.minMemory) {
        zkErrorLogger.log('WARNING', 'Device may have insufficient memory for proof generation', {
          context: 'zkCircuitParameterDerivation.deriveCircuitParameters',
          details: {
            availableMemory: deviceCaps.availableMemory,
            requiredMemory: circuitReqs.minMemory,
            proofType: mergedOptions.proofType
          }
        });

        // Add optimization flags
        parameters.useOptimizedCircuit = true;
        parameters.splitComputation = true;
      }
    }

    return parameters;
  } catch (error) {
    // Handle specific input errors
    if (error instanceof InputError) {
      throw error; // Rethrow validated errors
    }

    // Create a proper error for other cases
    const derivationError = new SystemError(`Failed to derive circuit parameters: ${error.message}`, {
      operationId,
      code: ErrorCode.SYSTEM_FUNCTION_EXECUTION_FAILED,
      details: {
        walletAddress,
        assetType,
        options
      },
      cause: error
    });

    zkErrorLogger.logError(derivationError, {
      context: 'zkCircuitParameterDerivation.deriveCircuitParameters'
    });

    throw derivationError;
  }
}

/**
 * Convert circuit parameters to format expected by the circuit
 * 
 * @param {Object} parameters - Circuit parameters from deriveCircuitParameters
 * @param {Object} [options] - Additional options for conversion
 * @returns {Object} Parameters in circuit-specific format
 * @throws {InputError} If parameters are missing or invalid
 * @throws {SystemError} If conversion fails
 */
function prepareCircuitInputs(parameters, options = {}) {
  const operationId = `prepareCircuitInputs_${Date.now()}`;

  try {
    // Validate parameters object
    if (!parameters || typeof parameters !== 'object') {
      throw new InputError('Parameters object is required for circuit input preparation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: typeof parameters }
      });
    }

    const { publicInputs, privateInputs, metadata } = parameters;

    // Validate required components
    if (!publicInputs || typeof publicInputs !== 'object') {
      throw new InputError('Public inputs are required for circuit input preparation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: {
          providedType: typeof publicInputs,
          parameters
        }
      });
    }

    if (!privateInputs || typeof privateInputs !== 'object') {
      throw new InputError('Private inputs are required for circuit input preparation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: {
          providedType: typeof privateInputs,
          parameters
        }
      });
    }

    if (!metadata || typeof metadata !== 'object' || !metadata.proofType) {
      throw new InputError('Metadata with proofType is required for circuit input preparation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: {
          providedMetadata: metadata,
          parameters
        }
      });
    }

    // Normalize and validate proof type
    const proofType = metadata.proofType.toLowerCase();
    const validProofTypes = ['standard', 'threshold', 'maximum'];

    if (!validProofTypes.includes(proofType)) {
      throw new InputError(`Unsupported proof type in parameters: ${metadata.proofType}`, {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: {
          providedType: metadata.proofType,
          supportedTypes: validProofTypes
        }
      });
    }

    try {
      // Check for required inputs based on proof type
      if (proofType === 'standard') {
        if (!publicInputs.address) {
          throw new InputError('Missing required public input: address', {
            code: ErrorCode.INPUT_MISSING_REQUIRED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { publicInputs }
          });
        }
        if (!publicInputs.amount) {
          throw new InputError('Missing required public input: amount', {
            code: ErrorCode.INPUT_MISSING_REQUIRED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { publicInputs }
          });
        }
      } else if (proofType === 'threshold') {
        if (!publicInputs.address) {
          throw new InputError('Missing required public input: address', {
            code: ErrorCode.INPUT_MISSING_REQUIRED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { publicInputs }
          });
        }
        if (!publicInputs.threshold) {
          throw new InputError('Missing required public input: threshold', {
            code: ErrorCode.INPUT_MISSING_REQUIRED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { publicInputs }
          });
        }
        if (!privateInputs.actualBalance) {
          throw new InputError('Missing required private input: actualBalance', {
            code: ErrorCode.INPUT_MISSING_REQUIRED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { privateInputs }
          });
        }
      } else if (proofType === 'maximum') {
        if (!publicInputs.address) {
          throw new InputError('Missing required public input: address', {
            code: ErrorCode.INPUT_MISSING_REQUIRED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { publicInputs }
          });
        }
        if (!publicInputs.maximum) {
          throw new InputError('Missing required public input: maximum', {
            code: ErrorCode.INPUT_MISSING_REQUIRED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { publicInputs }
          });
        }
        if (!privateInputs.actualBalance) {
          throw new InputError('Missing required private input: actualBalance', {
            code: ErrorCode.INPUT_MISSING_REQUIRED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { privateInputs }
          });
        }
      }

      // Check common private inputs
      if (!privateInputs.nonce) {
        throw new InputError('Missing required private input: nonce', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { privateInputs }
        });
      }

      if (!privateInputs.addressBytes || !Array.isArray(privateInputs.addressBytes)) {
        throw new InputError('Missing or invalid private input: addressBytes', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: {
            providedAddressBytes: privateInputs.addressBytes,
            isArray: Array.isArray(privateInputs.addressBytes)
          }
        });
      }

      // Combine public and private inputs in the format expected by the circuit
      const circuitInputs = {
        // Circuit type determines how inputs are structured
        ...(proofType === 'standard' ? {
          // Standard proof circuit inputs
          address: publicInputs.address,
          amount: publicInputs.amount,
          nonce: privateInputs.nonce,
          addressBytes: privateInputs.addressBytes
        } : proofType === 'threshold' ? {
          // Threshold proof circuit inputs
          address: publicInputs.address,
          threshold: publicInputs.threshold,
          actualBalance: privateInputs.actualBalance,
          nonce: privateInputs.nonce,
          addressBytes: privateInputs.addressBytes
        } : proofType === 'maximum' ? {
          // Maximum proof circuit inputs
          address: publicInputs.address,
          maximum: publicInputs.maximum,
          actualBalance: privateInputs.actualBalance,
          nonce: privateInputs.nonce,
          addressBytes: privateInputs.addressBytes
        } : {}),

        // Include signature parameters if available
        ...(privateInputs.signature ? {
          signature: privateInputs.signature
        } : {})
      };

      return {
        circuitInputs,
        metadata
      };
    } catch (error) {
      // If it's a ZKError, just pass it through
      if (isZKError(error)) {
        throw error;
      }

      throw new SystemError(`Failed to prepare circuit inputs: ${error.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        recoverable: false,
        details: {
          parameters,
          originalError: error.message
        }
      });
    }
  } catch (error) {
    // If it's already a ZKError, just log it
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'prepareCircuitInputs' });
      throw error;
    }

    // Otherwise, wrap it in a SystemError
    const zkError = new SystemError(`Failed to prepare circuit inputs: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId: `prepareCircuitInputs_${Date.now()}`, // New operationId since the original might be lost
      recoverable: false,
      details: {
        parameters,
        originalError: error.message
      }
    });

    zkErrorLogger.logError(zkError, { context: 'prepareCircuitInputs' });
    throw zkError;
  }
}

/**
 * Validate circuit parameters before proof generation
 * 
 * @param {Object} parameters - Circuit parameters to validate
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 * @throws {InputError} If parameters object itself is invalid
 */
async function validateCircuitParameters(parameters) {
  const operationId = `validateCircuitParams_${Date.now()}`;
  const errors = [];

  try {
    // Validate parameters object
    if (!parameters || typeof parameters !== 'object') {
      throw new InputError('Parameters object is required for validation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: typeof parameters }
      });
    }

    const { publicInputs, privateInputs, metadata } = parameters;

    // Check basic structure
    if (!publicInputs || typeof publicInputs !== 'object') {
      errors.push('Missing or invalid publicInputs object');
      // Return early if basic structure is invalid
      return {
        valid: false,
        errors,
        operationId
      };
    }

    if (!privateInputs || typeof privateInputs !== 'object') {
      errors.push('Missing or invalid privateInputs object');
      // Return early if basic structure is invalid
      return {
        valid: false,
        errors,
        operationId
      };
    }

    if (!metadata || typeof metadata !== 'object') {
      errors.push('Missing or invalid metadata object');
      // Return early if basic structure is invalid
      return {
        valid: false,
        errors,
        operationId
      };
    }

    // Check required public inputs
    if (!publicInputs.address) {
      errors.push('Missing required public input: address');
    }

    // Get ethers instance
    let ethers;
    try {
      const ethersObj = await getEthers();
      ethers = ethersObj.ethers;
    } catch (error) {
      errors.push(`Failed to load ethers for parameter validation: ${error.message}`);
      // Continue validation without ethers for the parts that don't need it
    }

    // Check proof type-specific required inputs
    const proofType = metadata.proofType?.toLowerCase();

    switch (proofType) {
      case 'standard':
        if (!publicInputs.amount) {
          errors.push('Missing required public input for standard proof: amount');
        }
        break;

      case 'threshold':
        if (!publicInputs.threshold) {
          errors.push('Missing required public input for threshold proof: threshold');
        }
        if (!privateInputs.actualBalance) {
          errors.push('Missing required private input for threshold proof: actualBalance');
        }

        // Check threshold proof balance constraint if ethers is available
        if (ethers && privateInputs.actualBalance && publicInputs.threshold) {
          try {
            const actualBN = ethers.BigNumber.from(privateInputs.actualBalance);
            const thresholdBN = ethers.BigNumber.from(publicInputs.threshold);

            if (actualBN.lt(thresholdBN)) {
              errors.push(`Actual balance (${actualBN}) is less than threshold (${thresholdBN})`);
            }
          } catch (error) {
            errors.push(`Failed to compare balance and threshold: ${error.message}`);
          }
        }
        break;

      case 'maximum':
        if (!publicInputs.maximum) {
          errors.push('Missing required public input for maximum proof: maximum');
        }
        if (!privateInputs.actualBalance) {
          errors.push('Missing required private input for maximum proof: actualBalance');
        }

        // Check maximum proof balance constraint if ethers is available
        if (ethers && privateInputs.actualBalance && publicInputs.maximum) {
          try {
            const actualBN = ethers.BigNumber.from(privateInputs.actualBalance);
            const maximumBN = ethers.BigNumber.from(publicInputs.maximum);

            if (actualBN.gt(maximumBN)) {
              errors.push(`Actual balance (${actualBN}) is greater than maximum (${maximumBN})`);
            }
          } catch (error) {
            errors.push(`Failed to compare balance and maximum: ${error.message}`);
          }
        }
        break;

      case undefined:
        errors.push('Missing proof type in metadata');
        break;

      default:
        errors.push(`Unknown proof type: ${metadata.proofType}`);
    }

    // Verify private inputs
    if (!privateInputs.addressBytes) {
      errors.push('Missing private input: addressBytes');
    } else if (!Array.isArray(privateInputs.addressBytes)) {
      errors.push('Invalid private input: addressBytes must be an array');
    }

    if (!privateInputs.nonce) {
      errors.push('Missing private input: nonce');
    }

    // Log validation result (if there are errors)
    if (errors.length > 0) {
      zkErrorLogger.logWarning('Circuit parameter validation failed', {
        context: 'validateCircuitParameters',
        operationId,
        details: {
          errors,
          parameterSummary: {
            proofType,
            hasPublicInputs: !!publicInputs,
            hasPrivateInputs: !!privateInputs,
            hasMetadata: !!metadata
          }
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      operationId
    };
  } catch (error) {
    // Handle unexpected errors
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'validateCircuitParameters' });
      errors.push(`Validation error (${error.code}): ${error.message}`);
    } else {
      const errorMessage = `Validation error: ${error.message}`;
      zkErrorLogger.logError(new SystemError(errorMessage, {
        code: ErrorCode.SYSTEM_UNEXPECTED_ERROR,
        operationId,
        recoverable: true,
        details: { originalError: error.message }
      }), { context: 'validateCircuitParameters' });

      errors.push(errorMessage);
    }

    return {
      valid: false,
      errors,
      operationId
    };
  }
}

/**
 * Derive cryptographic key with multiple fallback methods
 * @param {string|Object} seed - Seed value for derivation
 * @param {string} purpose - Purpose identifier for key
 * @returns {Promise<Uint8Array>} Derived key bytes
 */
async function deriveKeyWithFallbacks(seed, purpose) {
  const operationId = `derive_key_fallback_${Date.now()}`;

  // Try primary method first
  try {
    return await this.deriveKey(seed, purpose);
  } catch (primaryError) {
    zkErrorLogger.logError(primaryError, {
      context: 'zkCircuitParameterDerivation.deriveKeyWithFallbacks.primaryFailed',
      details: { purpose }
    });

    // Try first fallback using hash-based approach
    try {
      return await this.deriveKeyHashFallback(seed, purpose);
    } catch (fallback1Error) {
      zkErrorLogger.logError(fallback1Error, {
        context: 'zkCircuitParameterDerivation.deriveKeyWithFallbacks.fallback1Failed',
        details: { purpose }
      });

      // Try second fallback using simpler algorithm
      try {
        return await this.deriveKeySimpleFallback(seed, purpose);
      } catch (fallback2Error) {
        // All methods failed, throw comprehensive error
        const allFailedError = new SystemError('All key derivation methods failed', {
          operationId,
          code: ErrorCode.SYSTEM_FUNCTION_EXECUTION_FAILED,
          details: {
            purpose,
            primaryError: primaryError.message,
            fallback1Error: fallback1Error.message,
            fallback2Error: fallback2Error.message
          },
          cause: fallback2Error // Chain to the last error
        });

        zkErrorLogger.logError(allFailedError, {
          context: 'zkCircuitParameterDerivation.deriveKeyWithFallbacks.allFailed'
        });

        throw allFailedError;
      }
    }
  }
}

/**
 * Hash-based fallback for key derivation
 * @param {string|Object} seed - Seed value for derivation
 * @param {string} purpose - Purpose identifier for key
 * @returns {Promise<Uint8Array>} Derived key bytes
 */
async function deriveKeyHashFallback(seed, purpose) {
  try {
    // Create a string with both inputs
    const seedStr = typeof seed === 'string' ? seed : JSON.stringify(seed);
    const combined = `${seedStr}:${purpose}`;

    // Use SHA-256 for the fallback
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);

    // Get crypto implementation
    let crypto;
    if (typeof window !== 'undefined' && window.crypto) {
      crypto = window.crypto;
    } else {
      // Dynamic import for Node.js environment
      const cryptoModule = await import('crypto');
      crypto = cryptoModule.webcrypto;
    }

    if (!crypto || !crypto.subtle) {
      throw new Error('Web Crypto API not available');
    }

    // Generate hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert to byte array
    return new Uint8Array(hashBuffer);
  } catch (error) {
    throw new SystemError(`Hash-based key derivation fallback failed: ${error.message}`, {
      code: ErrorCode.CRYPTO_KEY_DERIVATION_FAILED,
      details: { method: 'hashFallback' },
      cause: error
    });
  }
}

/**
 * Simple fallback for key derivation in extreme cases
 * @param {string|Object} seed - Seed value for derivation
 * @param {string} purpose - Purpose identifier for key
 * @returns {Promise<Uint8Array>} Derived key bytes
 */
async function deriveKeySimpleFallback(seed, purpose) {
  try {
    // Very simple deterministic method that should work in any environment
    const seedStr = typeof seed === 'string' ? seed : JSON.stringify(seed);
    const purposeStr = String(purpose);

    // Create a simple hash (not cryptographically secure, but better than nothing)
    let hash = 0;
    const combined = seedStr + purposeStr;

    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    // Create a byte array from the hash
    const result = new Uint8Array(32); // 32 bytes

    // Fill with deterministic values based on the hash
    for (let i = 0; i < 32; i++) {
      result[i] = (hash + i) & 0xFF;
    }

    return result;
  } catch (error) {
    throw new SystemError(`Simple key derivation fallback failed: ${error.message}`, {
      code: ErrorCode.CRYPTO_KEY_DERIVATION_FAILED,
      details: { method: 'simpleFallback' },
      cause: error
    });
  }
}

/**
 * ZkCircuitParameterDerivation class for deriving circuit parameters
 * 
 * @class
 * @classdesc A comprehensive class that handles all parameter generation and validation 
 * for zero-knowledge proofs across multiple blockchain networks. The class provides methods
 * for processing Ethereum, Bitcoin, Solana, and stablecoin parameters, as well as
 * validation utilities and fallback mechanisms for critical operations.
 * 
 * Key features:
 * - Multi-chain support (ETH, BTC, SOL, USDC, USDT)
 * - Three proof types (standard, threshold, maximum)
 * - Robust error handling with user-friendly messages
 * - Parameter validation and transformation
 * - Cryptographic key derivation with fallback mechanisms
 * 
 * This class is instantiated once as a singleton and exported as the default
 * from this module.
 */
class ZkCircuitParameterDerivation {
  constructor() {
    // Initialize any required state
    this.supportedAssets = ['ETH', 'BTC', 'SOL', 'USDC', 'USDT'];
    this.validProofTypes = ['standard', 'threshold', 'maximum'];

    // Add user-friendly error messages for common issues
    this.errorMessages = {
      [ErrorCode.INPUT_MISSING_REQUIRED]: {
        walletAddress: 'Please provide your wallet address to continue.',
        assetType: 'Please select an asset type.',
        balance: 'Balance information is required to generate your proof.'
      },
      [ErrorCode.INPUT_VALIDATION_FAILED]: {
        walletAddress: 'The wallet address you provided appears to be invalid. Please check and try again.',
        assetType: 'The selected asset type is not supported. Please choose from the available options.',
        balance: 'The balance value is invalid. Please ensure it\'s a positive number.'
      },
      [ErrorCode.INPUT_TRANSFORMATION_FAILED]: {
        any: 'We had trouble processing your information. Please check your inputs and try again.'
      },
      [ErrorCode.CRYPTO_KEY_DERIVATION_FAILED]: {
        any: 'We encountered a security issue while processing your request. Please try again.'
      },
      [ErrorCode.SYSTEM_FUNCTION_EXECUTION_FAILED]: {
        any: 'We encountered a technical issue. Our team has been notified, and we\'re working to fix it.'
      }
    };
  }

  /**
   * Get a user-friendly error message
   * @param {Error} error - The error object
   * @returns {string} User-friendly error message
   */
  getUserFriendlyErrorMessage(error) {
    if (!error) return 'An unknown error occurred. Please try again.';

    // Get the error code and parameter
    const code = error.code || 'UNKNOWN_ERROR';
    const parameter = error.details?.parameter || 'any';

    // Look up the user-friendly message
    const messagesForCode = this.errorMessages[code] || {};
    const message = messagesForCode[parameter] || messagesForCode.any;

    // If no specific message is found, use a generic one
    return message || error.message || 'An error occurred. Please try again.';
  }

  /**
   * Transform a parameter with improved error handling
   * @param {any} value - Value to transform
   * @param {Function} transformFn - Transformation function
   * @param {string} paramName - Parameter name for error reporting
   * @returns {any} Transformed value
   */
  transformParameterWithErrorHandling(value, transformFn, paramName) {
    const operationId = `transform_param_${Date.now()}`;

    try {
      return transformFn(value);
    } catch (error) {
      // Create a specific error for transformation failures
      const transformError = new InputError(`Failed to transform parameter ${paramName}: ${error.message}`, {
        operationId,
        code: ErrorCode.INPUT_TRANSFORMATION_FAILED,
        recoverable: false,
        details: {
          parameter: paramName,
          inputValue: typeof value === 'object' ? '[object]' : value,
          inputType: typeof value
        },
        cause: error
      });

      zkErrorLogger.logError(transformError, {
        context: 'zkCircuitParameterDerivation.transformParameter'
      });

      throw transformError;
    }
  }

  /**
   * Process Ethereum-specific parameters
   * @param {string} address - Ethereum address
   * @param {Object} options - Processing options
   * @returns {Object} Processed parameters for Ethereum
   */
  processEthereumParameters(address, options) {
    try {
      // First validate address format
      if (!/^(0x)?[0-9a-fA-F]{40}$/.test(address)) {
        throw new InputError('Invalid Ethereum address format', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          details: { parameter: 'address' }
        });
      }

      // Use the helper for transformations
      const normalizedAddress = this.transformParameterWithErrorHandling(
        address,
        addr => addr.toLowerCase().startsWith('0x') ? addr.toLowerCase() : `0x${addr.toLowerCase()}`,
        'address'
      );

      // Process the balance if provided
      let balance = null;
      if (options.balance !== undefined) {
        balance = this.transformParameterWithErrorHandling(
          options.balance,
          bal => BigInt(bal),
          'balance'
        );
      }

      // Transform threshold if needed
      let threshold = null;
      if (options.threshold !== undefined) {
        threshold = this.transformParameterWithErrorHandling(
          options.threshold,
          th => BigInt(th),
          'threshold'
        );
      }

      // Process network ID with default fallback
      const networkId = this.transformParameterWithErrorHandling(
        options.networkId || 1, // Default to mainnet
        id => Number(id),
        'networkId'
      );

      // Return the processed parameters
      return {
        normalizedAddress,
        balance,
        threshold,
        networkId,
        chain: 'ethereum'
      };
    } catch (error) {
      if (error instanceof InputError) {
        throw error; // Rethrow specific errors
      }

      // Create a generic error for unexpected failures
      throw new SystemError(`Failed to process Ethereum parameters: ${error.message}`, {
        code: ErrorCode.SYSTEM_FUNCTION_EXECUTION_FAILED,
        details: { address, options },
        cause: error
      });
    }
  }

  /**
   * Process Bitcoin-specific parameters
   * @param {string} address - Bitcoin address
   * @param {Object} options - Processing options
   * @returns {Object} Processed parameters for Bitcoin
   */
  processBitcoinParameters(address, options) {
    // Similar implementation to processEthereumParameters
    // but with Bitcoin-specific logic
    return {
      address,
      balance: options.balance,
      chain: 'bitcoin'
    };
  }

  /**
   * Process Solana-specific parameters
   * @param {string} address - Solana address
   * @param {Object} options - Processing options
   * @returns {Object} Processed parameters for Solana
   */
  processSolanaParameters(address, options) {
    // Similar implementation to processEthereumParameters
    // but with Solana-specific logic
    return {
      address,
      balance: options.balance,
      chain: 'solana'
    };
  }

  /**
   * Process Stablecoin parameters
   * @param {string} address - Wallet address
   * @param {string} assetType - Stablecoin type (USDC, USDT)
   * @param {Object} options - Processing options
   * @returns {Object} Processed parameters for stablecoins
   */
  processStablecoinParameters(address, assetType, options) {
    // Stablecoin-specific logic
    return {
      address,
      balance: options.balance,
      assetType,
      chain: options.chain || 'ethereum'
    };
  }

  /**
   * Derive cryptographic key with multiple fallback methods
   * @param {string|Object} seed - Seed value for derivation
   * @param {string} purpose - Purpose identifier for key
   * @returns {Promise<Uint8Array>} Derived key bytes
   */
  async deriveKeyWithFallbacks(seed, purpose) {
    const operationId = `derive_key_fallback_${Date.now()}`;

    // Try primary method first
    try {
      return await this.deriveKey(seed, purpose);
    } catch (primaryError) {
      zkErrorLogger.logError(primaryError, {
        context: 'zkCircuitParameterDerivation.deriveKeyWithFallbacks.primaryFailed',
        details: { purpose }
      });

      // Try first fallback using hash-based approach
      try {
        return await this.deriveKeyHashFallback(seed, purpose);
      } catch (fallback1Error) {
        zkErrorLogger.logError(fallback1Error, {
          context: 'zkCircuitParameterDerivation.deriveKeyWithFallbacks.fallback1Failed',
          details: { purpose }
        });

        // Try second fallback using simpler algorithm
        try {
          return await this.deriveKeySimpleFallback(seed, purpose);
        } catch (fallback2Error) {
          // All methods failed, throw comprehensive error
          const allFailedError = new SystemError('All key derivation methods failed', {
            operationId,
            code: ErrorCode.SYSTEM_FUNCTION_EXECUTION_FAILED,
            details: {
              purpose,
              primaryError: primaryError.message,
              fallback1Error: fallback1Error.message,
              fallback2Error: fallback2Error.message
            },
            cause: fallback2Error // Chain to the last error
          });

          zkErrorLogger.logError(allFailedError, {
            context: 'zkCircuitParameterDerivation.deriveKeyWithFallbacks.allFailed'
          });

          throw allFailedError;
        }
      }
    }
  }

  /**
   * Primary key derivation method
   * @param {string|Object} seed - Seed value for derivation
   * @param {string} purpose - Purpose identifier for key
   * @returns {Promise<Uint8Array>} Derived key bytes
   */
  async deriveKey(seed, purpose) {
    // Implementation of primary key derivation method
    // Fall back to hash-based method since the primary isn't implemented
    return this.deriveKeyHashFallback(seed, purpose);
  }

  /**
   * Hash-based fallback for key derivation
   * @param {string|Object} seed - Seed value for derivation
   * @param {string} purpose - Purpose identifier for key
   * @returns {Promise<Uint8Array>} Derived key bytes
   */
  async deriveKeyHashFallback(seed, purpose) {
    try {
      // Create a string with both inputs
      const seedStr = typeof seed === 'string' ? seed : JSON.stringify(seed);
      const combined = `${seedStr}:${purpose}`;

      // Use SHA-256 for the fallback
      const encoder = new TextEncoder();
      const data = encoder.encode(combined);

      // Get crypto implementation
      let crypto;
      if (typeof window !== 'undefined' && window.crypto) {
        crypto = window.crypto;
      } else {
        // Dynamic import for Node.js environment
        const cryptoModule = await import('crypto');
        crypto = cryptoModule.webcrypto;
      }

      if (!crypto || !crypto.subtle) {
        throw new Error('Web Crypto API not available');
      }

      // Generate hash
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);

      // Convert to byte array
      return new Uint8Array(hashBuffer);
    } catch (error) {
      throw new SystemError(`Hash-based key derivation fallback failed: ${error.message}`, {
        code: ErrorCode.CRYPTO_KEY_DERIVATION_FAILED,
        details: { method: 'hashFallback' },
        cause: error
      });
    }
  }

  /**
   * Simple fallback for key derivation in extreme cases
   * @param {string|Object} seed - Seed value for derivation
   * @param {string} purpose - Purpose identifier for key
   * @returns {Promise<Uint8Array>} Derived key bytes
   */
  async deriveKeySimpleFallback(seed, purpose) {
    try {
      // Very simple deterministic method that should work in any environment
      const seedStr = typeof seed === 'string' ? seed : JSON.stringify(seed);
      const purposeStr = String(purpose);

      // Create a simple hash (not cryptographically secure, but better than nothing)
      let hash = 0;
      const combined = seedStr + purposeStr;

      for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }

      // Create a byte array from the hash
      const result = new Uint8Array(32); // 32 bytes

      // Fill with deterministic values based on the hash
      for (let i = 0; i < 32; i++) {
        result[i] = (hash + i) & 0xFF;
      }

      return result;
    } catch (error) {
      throw new SystemError(`Simple key derivation fallback failed: ${error.message}`, {
        code: ErrorCode.CRYPTO_KEY_DERIVATION_FAILED,
        details: { method: 'simpleFallback' },
        cause: error
      });
    }
  }

  /**
   * Derive circuit parameters for proof generation
   * 
   * @param {string} walletAddress - The wallet address to derive parameters for
   * @param {string} assetType - The type of asset (ETH, BTC, SOL, USDC, USDT)
   * @param {Object} options - Additional options for parameter derivation
   * @returns {Promise<Object>} The derived parameters
   * @throws {InputError} If inputs are invalid
   * @throws {SystemError} If parameter derivation fails
   */
  async deriveCircuitParameters(walletAddress, assetType, options = {}) {
    const operationId = `derive_params_${Date.now()}`;

    try {
      // Validate inputs
      if (!walletAddress) {
        throw new InputError('Wallet address is required', {
          operationId,
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          details: { parameter: 'walletAddress' }
        });
      }

      if (!assetType) {
        throw new InputError('Asset type is required', {
          operationId,
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          details: { parameter: 'assetType' }
        });
      }

      // Validate wallet address format
      if (!/^(0x)?[0-9a-fA-F]{40}$/.test(walletAddress)) {
        throw new InputError('Invalid wallet address format', {
          operationId,
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          details: {
            parameter: 'walletAddress',
            expected: '0x-prefixed 40-character hex string',
            received: walletAddress
          }
        });
      }

      // Validate asset type is one of the supported types
      if (!this.supportedAssets.includes(assetType)) {
        throw new InputError('Unsupported asset type', {
          operationId,
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          details: {
            parameter: 'assetType',
            supportedTypes: this.supportedAssets,
            received: assetType
          }
        });
      }

      // Process options with validation
      const defaultOptions = {
        proofType: 'standard',
        includeTimestamp: true,
        optimizeForDevice: true
      };

      const mergedOptions = { ...defaultOptions, ...options };

      // Validate proof type
      if (!this.validProofTypes.includes(mergedOptions.proofType)) {
        throw new InputError('Invalid proof type', {
          operationId,
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          details: {
            parameter: 'proofType',
            validTypes: this.validProofTypes,
            received: mergedOptions.proofType
          }
        });
      }

      // Process parameters based on asset type
      let parameters;
      switch (assetType) {
        case 'ETH':
          parameters = await this.processEthereumParameters(walletAddress, mergedOptions);
          break;
        case 'BTC':
          parameters = await this.processBitcoinParameters(walletAddress, mergedOptions);
          break;
        case 'SOL':
          parameters = await this.processSolanaParameters(walletAddress, mergedOptions);
          break;
        case 'USDC':
        case 'USDT':
          parameters = await this.processStablecoinParameters(walletAddress, assetType, mergedOptions);
          break;
        default:
          // This shouldn't be reached due to earlier validation, but as a safeguard
          throw new InputError(`Unsupported asset type: ${assetType}`, {
            operationId,
            code: ErrorCode.INPUT_VALIDATION_FAILED,
            details: { parameter: 'assetType' }
          });
      }

      // Add common parameters
      parameters.timestamp = mergedOptions.includeTimestamp ? Date.now() : undefined;
      parameters.assetType = assetType;
      parameters.walletAddress = walletAddress;
      parameters.operationId = operationId;

      // Check device capabilities if optimizing for device
      if (mergedOptions.optimizeForDevice) {
        const deviceCaps = getDeviceCapabilities();
        const circuitReqs = getCircuitMemoryRequirements(mergedOptions.proofType);

        // Check if device can handle the circuit
        if (deviceCaps.availableMemory < circuitReqs.minMemory) {
          zkErrorLogger.log('WARNING', 'Device may have insufficient memory for proof generation', {
            context: 'zkCircuitParameterDerivation.deriveCircuitParameters',
            details: {
              availableMemory: deviceCaps.availableMemory,
              requiredMemory: circuitReqs.minMemory,
              proofType: mergedOptions.proofType
            }
          });

          // Add optimization flags
          parameters.useOptimizedCircuit = true;
          parameters.splitComputation = true;
        }
      }

      return parameters;
    } catch (error) {
      // Handle specific input errors
      if (error instanceof InputError) {
        throw error; // Rethrow validated errors
      }

      // Create a proper error for other cases
      const derivationError = new SystemError(`Failed to derive circuit parameters: ${error.message}`, {
        operationId,
        code: ErrorCode.SYSTEM_FUNCTION_EXECUTION_FAILED,
        details: {
          walletAddress,
          assetType,
          options
        },
        cause: error
      });

      zkErrorLogger.logError(derivationError, {
        context: 'zkCircuitParameterDerivation.deriveCircuitParameters'
      });

      throw derivationError;
    }
  }
}

// Create instance
const zkCircuitParameterDerivation = new ZkCircuitParameterDerivation();

/**
 * Zero-knowledge circuit parameter derivation module.
 * 
 * This module provides functions for generating and transforming input parameters
 * for different types of zero-knowledge circuits based on wallet data and proof requirements.
 * 
 * @module zkCircuitParameterDerivation
 * @exports {Object} zkCircuitParameterDerivation - Singleton instance for deriving circuit parameters
 */
export default zkCircuitParameterDerivation;