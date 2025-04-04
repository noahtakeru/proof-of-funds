/**
 * Secure Input Generator for Zero-Knowledge Circuits
 * 
 * This module enhances the basic input generation with secure handling of
 * private data, encryption, and protected memory operations for ZK circuits.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module is responsible for safely preparing sensitive financial information
 * for our privacy-protecting verification system. Think of it like:
 * 
 * 1. SECURE DOCUMENT PREPARATION: Similar to how an accountant prepares tax documents
 *    with your sensitive financial information, this system prepares your financial
 *    data in a way that keeps private details secure while still allowing verification.
 * 
 * 2. DATA VAULT: Works like a digital vault that encrypts and protects your sensitive
 *    financial information before it's used in the verification process, similar to
 *    how banks secure your personal information during transactions.
 * 
 * 3. INFORMATION SEPARATOR: Functions like a document redaction system that carefully
 *    separates what information should be kept private and what can be shared publicly,
 *    similar to how legal documents are redacted to protect sensitive information.
 * 
 * 4. SECURITY LEVELS: Offers different levels of protection like how a home security
 *    system might have basic, enhanced, and maximum security settings depending on
 *    your needs and comfort level.
 * 
 * Business value: Provides critical protection of users' sensitive financial data,
 * prevents data leakage during the verification process, builds user trust through
 * demonstrable security measures, and minimizes compliance risks related to handling
 * financial information.
 */

import { ethers } from 'ethers';
import { ZK_PROOF_TYPES } from '../../config/constants';
import { addressToBytes, extractPublicInputs } from './zkCircuitInputs';
import secureKeyManager from './SecureKeyManager';
import secureStorage from './secureStorage';

/**
 * Security level options for input generation
 */
export const SECURITY_LEVELS = {
  STANDARD: 'standard',     // Basic security
  ENHANCED: 'enhanced',     // Additional protections
  MAXIMUM: 'maximum'        // Maximum security, more resource intensive
};

/**
 * Generates secure inputs for ZK circuits with protective measures
 * @param {Object} params - Parameters for input generation
 * @param {string} params.walletAddress - Wallet address
 * @param {string} params.amount - Amount for verification
 * @param {number} params.proofType - Proof type from ZK_PROOF_TYPES
 * @param {Object} [params.privateData] - Additional private data
 * @param {Object} [params.walletData] - Wallet data if available
 * @param {Object} [params.securityOptions] - Security options
 * @param {string} [params.securityOptions.level] - Security level
 * @param {boolean} [params.securityOptions.encryptInputs] - Whether to encrypt inputs
 * @param {string} [params.sessionPassword] - Password for encryption
 * @returns {Promise<{inputId: string, publicInputs: Object}>} Secure input ID and public inputs
 */
export const generateSecureInputs = async (params) => {
  const {
    walletAddress,
    amount,
    proofType,
    privateData = {},
    walletData = null,
    securityOptions = {
      level: SECURITY_LEVELS.ENHANCED,
      encryptInputs: true
    },
    sessionPassword = null
  } = params;

  try {
    // Validate required inputs
    if (!walletAddress) throw new Error('Wallet address is required');
    if (!amount) throw new Error('Amount is required');
    if (proofType === undefined) throw new Error('Proof type is required');

    // Generate a secure password if one wasn't provided
    const password = sessionPassword || secureKeyManager.generateSecurePassword();

    // Convert address to bytes for the circuit
    const addressBytes = addressToBytes(walletAddress);

    // Convert amount to a numeric value with proper handling
    let numericAmount;
    try {
      // If amount is in wei (string), convert to numeric
      numericAmount = ethers.BigNumber.from(amount).toString();
    } catch (e) {
      // If conversion fails, assume it's already a number/string
      numericAmount = amount.toString();
    }

    // Calculate address hash using proper cryptographic hash
    const addressHash = ethers.utils.keccak256(walletAddress);

    // Additional security measures based on security level
    let securityMetadata = {};
    if (securityOptions.level === SECURITY_LEVELS.ENHANCED ||
      securityOptions.level === SECURITY_LEVELS.MAXIMUM) {
      // Add nonce for enhanced security
      const nonce = new Uint8Array(16);
      if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(nonce);
      }
      securityMetadata.nonce = Array.from(nonce);

      // Add timestamp
      securityMetadata.timestamp = Date.now();

      // Add additional commitment for maximum security
      if (securityOptions.level === SECURITY_LEVELS.MAXIMUM && walletData) {
        // Create Merkle root from multiple wallet fields for stronger binding
        // This is a simplified version - in production this would use a proper Merkle tree
        const commitment = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ['address', 'uint256', 'bytes32'],
            [walletAddress, numericAmount, addressHash]
          )
        );
        securityMetadata.commitment = commitment;
      }
    }

    // Generate circuit-specific inputs
    let circuitInputs;
    switch (proofType) {
      case ZK_PROOF_TYPES.STANDARD:
        circuitInputs = {
          // Private inputs (only known to the prover)
          privateAmount: numericAmount,
          privateAddress: addressBytes,

          // Public inputs (shared with verifier)
          publicAmount: numericAmount,
          publicAddressHash: addressHash,

          // Security metadata
          ...securityMetadata
        };
        break;

      case ZK_PROOF_TYPES.THRESHOLD:
        circuitInputs = {
          // Private inputs
          privateAmount: numericAmount,
          privateAddress: addressBytes,

          // Public inputs
          thresholdAmount: numericAmount,
          publicAddressHash: addressHash,

          // Security metadata
          ...securityMetadata
        };
        break;

      case ZK_PROOF_TYPES.MAXIMUM:
        circuitInputs = {
          // Private inputs
          privateAmount: numericAmount,
          privateAddress: addressBytes,

          // Public inputs
          maximumAmount: numericAmount,
          publicAddressHash: addressHash,

          // Security metadata
          ...securityMetadata
        };
        break;

      default:
        throw new Error(`Invalid proof type: ${proofType}`);
    }

    // Add any additional private data
    circuitInputs = {
      ...circuitInputs,
      ...privateData
    };

    // Extract public inputs before potential encryption
    const publicInputs = extractPublicInputs(circuitInputs, proofType);

    // Store inputs securely if encryption is enabled
    let inputId = null;
    if (securityOptions.encryptInputs) {
      inputId = await secureStorage.storeCircuitInput(circuitInputs, password);

      // Return the password if it was generated (not provided)
      return {
        inputId,
        publicInputs,
        sessionPassword: sessionPassword ? undefined : password
      };
    }

    // If not encrypting, return full inputs directly (less secure)
    return {
      inputs: circuitInputs,
      publicInputs
    };
  } catch (error) {
    throw new Error(`Secure input generation failed: ${error.message}`);
  }
};

/**
 * Retrieve secure inputs for proof generation
 * @param {string} inputId - ID of the stored inputs
 * @param {string} password - Password for decryption
 * @returns {Promise<Object>} The decrypted circuit inputs
 */
export const getSecureInputs = async (inputId, password) => {
  try {
    return await secureStorage.getCircuitInput(inputId, password);
  } catch (error) {
    throw new Error(`Failed to retrieve secure inputs: ${error.message}`);
  }
};

/**
 * Validate that secure inputs are valid for a specific circuit with enhanced checks
 * @param {Object} inputs - Circuit inputs
 * @param {number} proofType - Proof type from ZK_PROOF_TYPES
 * @returns {boolean} Whether inputs are valid
 */
export const validateSecureInputs = (inputs, proofType) => {
  try {
    // Check if inputs object exists
    if (!inputs) {
      console.error('Secure validation failed: inputs object is null or undefined');
      return false;
    }

    // Check if proofType is valid
    if (proofType === undefined) {
      console.error('Secure validation failed: proofType is undefined');
      return false;
    }

    // Validate common fields that all proof types need
    const hasCommonFields = (
      inputs.privateAddress !== undefined &&
      Array.isArray(inputs.privateAddress) &&
      inputs.publicAddressHash !== undefined
    );

    if (!hasCommonFields) {
      console.error('Secure validation failed: missing common fields');
      return false;
    }

    // Enhanced validation checks
    // Check address byte array length
    if (inputs.privateAddress.length !== 20) { // Ethereum address is 20 bytes
      console.error('Secure validation failed: invalid address byte length');
      return false;
    }

    // Validate proof-specific fields
    switch (proofType) {
      case ZK_PROOF_TYPES.STANDARD:
        // Standard proof requires exact amount fields
        if (inputs.privateAmount === undefined) {
          console.error('Secure validation failed: standard proof requires privateAmount');
          return false;
        }
        if (inputs.publicAmount === undefined) {
          console.error('Secure validation failed: standard proof requires publicAmount');
          return false;
        }
        // Verify public and private amounts match (this is a basic check)
        if (inputs.privateAmount !== inputs.publicAmount) {
          console.error('Secure validation failed: amount mismatch in standard proof');
          return false;
        }
        return true;

      case ZK_PROOF_TYPES.THRESHOLD:
        // Threshold proof requires amount and threshold
        if (inputs.privateAmount === undefined) {
          console.error('Secure validation failed: threshold proof requires privateAmount');
          return false;
        }
        if (inputs.thresholdAmount === undefined) {
          console.error('Secure validation failed: threshold proof requires thresholdAmount');
          return false;
        }
        // Threshold validation: private amount should be >= threshold amount
        try {
          const privateAmountBN = ethers.BigNumber.from(inputs.privateAmount);
          const thresholdAmountBN = ethers.BigNumber.from(inputs.thresholdAmount);
          if (privateAmountBN.lt(thresholdAmountBN)) {
            console.error('Secure validation failed: private amount is less than threshold');
            return false;
          }
        } catch (e) {
          console.error('Secure validation failed: amount comparison error', e);
          return false;
        }
        return true;

      case ZK_PROOF_TYPES.MAXIMUM:
        // Maximum proof requires amount and maximum
        if (inputs.privateAmount === undefined) {
          console.error('Secure validation failed: maximum proof requires privateAmount');
          return false;
        }
        if (inputs.maximumAmount === undefined) {
          console.error('Secure validation failed: maximum proof requires maximumAmount');
          return false;
        }
        // Maximum validation: private amount should be <= maximum amount
        try {
          const privateAmountBN = ethers.BigNumber.from(inputs.privateAmount);
          const maximumAmountBN = ethers.BigNumber.from(inputs.maximumAmount);
          if (privateAmountBN.gt(maximumAmountBN)) {
            console.error('Secure validation failed: private amount exceeds maximum');
            return false;
          }
        } catch (e) {
          console.error('Secure validation failed: amount comparison error', e);
          return false;
        }
        return true;

      default:
        console.error(`Secure validation failed: unknown proof type: ${proofType}`);
        return false;
    }
  } catch (error) {
    console.error('Error during secure input validation:', error);
    return false;
  }
};

/**
 * Securely cleans up input data after use
 * @param {string} inputId - ID of the stored inputs to clean up
 * @returns {Promise<boolean>} Success indicator
 */
export const cleanupSecureInputs = async (inputId) => {
  try {
    if (!inputId) return true;

    // Remove from secure storage
    secureStorage.removeItem(`zk-input-${inputId}`);
    return true;
  } catch (error) {
    console.error('Error cleaning up secure inputs:', error);
    return false;
  }
};

export { addressToBytes } from './zkCircuitInputs';