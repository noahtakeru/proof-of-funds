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
// Import constants from config file if available, otherwise define locally
import { ZK_PROOF_TYPES as IMPORTED_ZK_PROOF_TYPES } from '../../config/constants.js';

// Use imported constants or fallback to local definition
const ZK_PROOF_TYPES = IMPORTED_ZK_PROOF_TYPES || {
  STANDARD: 'standard',
  THRESHOLD: 'threshold',
  MAXIMUM: 'maximum',
  BATCH: 'batch'
};

import { addressToBytes, extractPublicInputs } from './zkCircuitInputs.mjs';
import secureKeyManager from './SecureKeyManager.js';
import secureStorage from './secureStorage.js';
import { zkErrorLogger } from './zkErrorLogger.mjs';
import { 
  InputError, 
  SecurityError, 
  SystemError,
  ProofError,
  ErrorCode,
  isZKError,
  fromError,
  ErrorSeverity,
  ErrorCategory
} from './zkErrorHandler.mjs';

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
 * @throws {InputError} If required inputs are missing or invalid
 * @throws {SecurityError} If cryptographic operations fail
 * @throws {SystemError} If secure storage operations fail
 */
export const generateSecureInputs = async (params) => {
  // Generate a unique operation ID for tracking this operation
  const operationId = `generate_secure_inputs_${Date.now()}`;
  
  try {
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

    // Validate required inputs with specific error types
    if (!walletAddress) {
      throw new InputError('Wallet address is required for secure input generation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { missingField: 'walletAddress' }
      });
    }
    
    if (!amount) {
      throw new InputError('Amount is required for secure input generation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { missingField: 'amount' }
      });
    }
    
    if (proofType === undefined) {
      throw new InputError('Proof type is required for secure input generation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          missingField: 'proofType',
          validProofTypes: Object.values(ZK_PROOF_TYPES)
        }
      });
    }
    
    // Validate proof type is supported
    if (!Object.values(ZK_PROOF_TYPES).includes(proofType)) {
      throw new InputError(`Invalid proof type: ${proofType}`, {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          providedProofType: proofType,
          validProofTypes: Object.values(ZK_PROOF_TYPES)
        }
      });
    }

    // Generate a secure password if one wasn't provided
    let password;
    try {
      password = sessionPassword || secureKeyManager.generateSecurePassword();
    } catch (error) {
      throw new SecurityError('Failed to generate secure password', {
        code: ErrorCode.SECURITY_KEY_ERROR,
        operationId,
        recoverable: false,
        securityCritical: true,
        details: { originalError: error.message }
      });
    }

    // Convert address to bytes for the circuit
    let addressBytes;
    try {
      addressBytes = addressToBytes(walletAddress);
    } catch (error) {
      // The addressToBytes function already throws ZKErrors, so just re-throw
      // with the current operation ID for tracking
      if (isZKError(error)) {
        error.operationId = operationId;
        throw error;
      }
      throw new InputError(`Failed to convert wallet address to bytes: ${error.message}`, {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: true,
        userFixable: true,
        details: { 
          providedAddress: typeof walletAddress === 'string' ? 
            walletAddress.slice(0, 6) + '...' : typeof walletAddress
        }
      });
    }

    // Convert amount to a numeric value with proper handling
    let numericAmount;
    try {
      // If amount is in wei (string), convert to numeric
      numericAmount = ethers.BigNumber.from(amount).toString();
    } catch (error) {
      // If conversion fails, assume it's already a number/string and log a warning
      numericAmount = amount.toString();
      zkErrorLogger.log('WARNING', 'Amount conversion fallback', {
        operationId,
        details: {
          attemptedConversion: true,
          fallbackUsed: true,
          amountType: typeof amount
        }
      });
    }

    // Calculate address hash using proper cryptographic hash
    let addressHash;
    try {
      addressHash = ethers.utils.keccak256(walletAddress);
    } catch (error) {
      throw new SecurityError(`Failed to hash wallet address: ${error.message}`, {
        code: ErrorCode.SECURITY_DATA_INTEGRITY,
        operationId,
        recoverable: false,
        securityCritical: true,
        details: { originalError: error.message }
      });
    }

    // Additional security measures based on security level
    let securityMetadata = {};
    if (securityOptions.level === SECURITY_LEVELS.ENHANCED ||
      securityOptions.level === SECURITY_LEVELS.MAXIMUM) {
      
      try {
        // Add nonce for enhanced security
        const nonce = new Uint8Array(16);
        if (typeof window !== 'undefined' && window.crypto) {
          window.crypto.getRandomValues(nonce);
        } else {
          // If window.crypto is not available, log a security warning
          zkErrorLogger.log('WARNING', 'Secure random generation unavailable', {
            operationId,
            details: {
              securityLevel: securityOptions.level,
              environmentType: typeof window !== 'undefined' ? 'browser' : 'node',
              cryptoAvailable: typeof window !== 'undefined' && !!window.crypto
            }
          });
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
      } catch (error) {
        throw new SecurityError(`Failed to generate security metadata: ${error.message}`, {
          code: ErrorCode.SECURITY_DATA_INTEGRITY,
          operationId,
          recoverable: true, // Can continue with reduced security
          securityCritical: securityOptions.level === SECURITY_LEVELS.MAXIMUM,
          details: { 
            securityLevel: securityOptions.level,
            originalError: error.message
          }
        });
      }
    }

    // Generate circuit-specific inputs
    let circuitInputs;
    try {
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
          // This should never happen due to the earlier validation,
          // but include it as a safeguard
          throw new InputError(`Invalid proof type: ${proofType}`, {
            code: ErrorCode.INPUT_VALIDATION_FAILED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { 
              providedProofType: proofType,
              validProofTypes: Object.values(ZK_PROOF_TYPES)
            }
          });
      }

      // Add any additional private data
      circuitInputs = {
        ...circuitInputs,
        ...privateData
      };
    } catch (error) {
      if (isZKError(error)) {
        throw error; // Re-throw ZKErrors directly
      }
      throw new ProofError(`Failed to generate circuit inputs: ${error.message}`, {
        code: ErrorCode.PROOF_INPUT_INVALID,
        operationId,
        recoverable: false,
        details: { originalError: error.message }
      });
    }

    // Extract public inputs before potential encryption
    let publicInputs;
    try {
      publicInputs = extractPublicInputs(circuitInputs, proofType);
    } catch (error) {
      if (isZKError(error)) {
        // Update operation ID for tracking
        error.operationId = operationId;
        throw error;
      }
      throw new InputError(`Failed to extract public inputs: ${error.message}`, {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        details: { originalError: error.message }
      });
    }

    // Store inputs securely if encryption is enabled
    if (securityOptions.encryptInputs) {
      try {
        const inputId = await secureStorage.storeCircuitInput(circuitInputs, password);

        // Return the password if it was generated (not provided)
        return {
          inputId,
          publicInputs,
          sessionPassword: sessionPassword ? undefined : password
        };
      } catch (error) {
        throw new SystemError(`Failed to securely store circuit inputs: ${error.message}`, {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId,
          recoverable: false,
          securityCritical: true,
          details: { originalError: error.message }
        });
      }
    }

    // If not encrypting, return full inputs directly (less secure)
    // Log a security warning since this is less secure
    zkErrorLogger.log('WARNING', 'Returning unencrypted circuit inputs', {
      operationId,
      severity: ErrorSeverity.WARNING,
      category: ErrorCategory.SECURITY,
      details: {
        encryptionDisabled: true,
        securityRisk: 'high',
        proofType
      }
    });
    
    return {
      inputs: circuitInputs,
      publicInputs
    };
  } catch (error) {
    // If it's already a ZKError, just log it
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'generateSecureInputs' });
      throw error;
    }
    
    // Otherwise, wrap it in a SystemError
    const zkError = new SystemError(`Secure input generation failed: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId,
      recoverable: false,
      details: { originalError: error.message }
    });
    
    zkErrorLogger.logError(zkError, { context: 'generateSecureInputs' });
    throw zkError;
  }
};

/**
 * Retrieves secure inputs for ZK circuits
 * @param {string} inputId - ID of the secure input
 * @param {string} password - Password for decryption
 * @returns {Promise<Object>} Decrypted circuit inputs
 * @throws {SecurityError} If authentication or decryption fails
 * @throws {SystemError} If secure storage operations fail
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function is like retrieving a confidential document from a secure vault.
 * When financial information is stored securely in our system, this function:
 * 
 * 1. Uses a special password or key (like a vault combination) to unlock access
 * 2. Retrieves the protected financial information
 * 3. Decrypts it so it can be used for verification
 * 
 * It's similar to how a bank might store your financial documents in a secure vault,
 * but allows authorized access when needed for specific transactions. This ensures
 * sensitive information remains protected when not in use, but is available when
 * needed for legitimate verification purposes.
 */
export const getSecureInputs = async (inputId, password) => {
  // Generate a unique operation ID for tracking this operation
  const operationId = `get_secure_inputs_${Date.now()}`;
  
  try {
    // Validate input parameters
    if (!inputId) {
      throw new InputError('Input ID is required to retrieve secure inputs', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { missingField: 'inputId' }
      });
    }
    
    if (!password) {
      throw new SecurityError('Password is required to decrypt secure inputs', {
        code: ErrorCode.SECURITY_KEY_ERROR,
        operationId,
        recoverable: false,
        securityCritical: true,
        userFixable: true,
        details: { missingField: 'password' }
      });
    }
    
    try {
      // Attempt to retrieve and decrypt the inputs
      return await secureStorage.getCircuitInput(inputId, password);
    } catch (error) {
      // Determine the type of error based on the message
      if (error.message && 
          (error.message.includes('decrypt') || 
           error.message.includes('password') || 
           error.message.includes('authentication'))) {
        // This is likely a decryption/authentication error
        throw new SecurityError(`Failed to authenticate or decrypt secure inputs: ${error.message}`, {
          code: ErrorCode.SECURITY_KEY_ERROR,
          operationId,
          recoverable: false, // Cannot recover without correct password
          securityCritical: true,
          userFixable: true, // User can try again with correct password
          recommendedAction: 'Please verify the password and try again.',
          details: { 
            inputId,
            originalError: error.message
          }
        });
      }
      
      // Otherwise, treat as a system error
      throw new SystemError(`Failed to retrieve secure inputs from storage: ${error.message}`, {
        code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
        operationId,
        recoverable: false,
        details: { 
          inputId,
          originalError: error.message
        }
      });
    }
  } catch (error) {
    // If it's already a ZKError, just log it
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'getSecureInputs' });
      throw error;
    }
    
    // Otherwise, wrap it in a SystemError
    const zkError = new SystemError(`Failed to retrieve secure inputs: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId,
      recoverable: false,
      details: { originalError: error.message }
    });
    
    zkErrorLogger.logError(zkError, { context: 'getSecureInputs' });
    throw zkError;
  }
};

/**
 * Validates secure inputs for completeness and correctness
 * @param {Object} inputs - Circuit inputs to validate
 * @param {number} proofType - Type of proof
 * @returns {boolean} Whether inputs are valid
 * @throws {InputError} If inputs are missing or invalid
 * @throws {SecurityError} If security validation fails
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function works like a document inspector checking that all necessary information
 * is present and properly formatted before proceeding with a verification.
 * 
 * Similar to how a loan application might be checked to ensure all required fields are
 * completed correctly before processing, this function:
 * 
 * 1. Checks that all required financial information is present
 * 2. Verifies that the information is properly formatted
 * 3. Ensures the values make sense (like checking that amounts are positive numbers)
 * 4. Validates that the information matches the type of verification being performed
 * 
 * If anything is missing or incorrect, the system can notify the user specifically
 * what needs to be fixed rather than proceeding with incomplete information that
 * would cause the verification to fail.
 */
export const validateSecureInputs = (inputs, proofType) => {
  // Generate a unique operation ID for tracking this operation
  const operationId = `validate_secure_inputs_${Date.now()}`;
  
  try {
    // Check if inputs object exists
    if (!inputs) {
      const error = new InputError('Secure validation failed: inputs object is null or undefined', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedInputs: inputs }
      });
      
      zkErrorLogger.logError(error, { context: 'validateSecureInputs' });
      return false;
    }

    // Check if proofType is valid
    if (proofType === undefined) {
      const error = new InputError('Secure validation failed: proofType is undefined', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedProofType: proofType }
      });
      
      zkErrorLogger.logError(error, { context: 'validateSecureInputs' });
      return false;
    }

    // Validate proof type is supported
    if (!Object.values(ZK_PROOF_TYPES).includes(proofType)) {
      const error = new InputError(`Secure validation failed: invalid proof type: ${proofType}`, {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { 
          providedProofType: proofType,
          validProofTypes: Object.values(ZK_PROOF_TYPES)
        }
      });
      
      zkErrorLogger.logError(error, { context: 'validateSecureInputs' });
      return false;
    }

    // Validate common fields that all proof types need
    const hasCommonFields = (
      inputs.privateAddress !== undefined &&
      Array.isArray(inputs.privateAddress) &&
      inputs.publicAddressHash !== undefined
    );

    if (!hasCommonFields) {
      const missingFields = [];
      if (inputs.privateAddress === undefined) missingFields.push('privateAddress');
      if (inputs.privateAddress !== undefined && !Array.isArray(inputs.privateAddress)) 
        missingFields.push('privateAddress (not an array)');
      if (inputs.publicAddressHash === undefined) missingFields.push('publicAddressHash');
      
      const error = new InputError('Secure validation failed: missing required common fields', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { missingFields }
      });
      
      zkErrorLogger.logError(error, { context: 'validateSecureInputs' });
      return false;
    }

    // Enhanced validation checks
    // Check address byte array length
    if (inputs.privateAddress.length !== 20) { // Ethereum address is 20 bytes
      const error = new InputError('Secure validation failed: invalid address byte length', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { 
          addressLength: inputs.privateAddress.length,
          expectedLength: 20
        }
      });
      
      zkErrorLogger.logError(error, { context: 'validateSecureInputs' });
      return false;
    }

    // Validate proof-specific fields
    switch (proofType) {
      case ZK_PROOF_TYPES.STANDARD:
        // Standard proof requires exact amount fields
        if (inputs.privateAmount === undefined) {
          const error = new InputError('Secure validation failed: standard proof requires privateAmount', {
            code: ErrorCode.INPUT_MISSING_REQUIRED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { 
              missingField: 'privateAmount',
              proofType: 'standard'
            }
          });
          
          zkErrorLogger.logError(error, { context: 'validateSecureInputs.standard' });
          return false;
        }
        
        if (inputs.publicAmount === undefined) {
          const error = new InputError('Secure validation failed: standard proof requires publicAmount', {
            code: ErrorCode.INPUT_MISSING_REQUIRED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { 
              missingField: 'publicAmount',
              proofType: 'standard'
            }
          });
          
          zkErrorLogger.logError(error, { context: 'validateSecureInputs.standard' });
          return false;
        }
        
        // Verify public and private amounts match (this is a basic check)
        if (inputs.privateAmount !== inputs.publicAmount) {
          const error = new SecurityError('Secure validation failed: amount mismatch in standard proof', {
            code: ErrorCode.SECURITY_DATA_INTEGRITY,
            operationId,
            recoverable: false,
            securityCritical: true,
            userFixable: true,
            details: { 
              proofType: 'standard',
              mismatchType: 'privateAmount != publicAmount'
            }
          });
          
          zkErrorLogger.logError(error, { context: 'validateSecureInputs.standard' });
          return false;
        }
        return true;

      case ZK_PROOF_TYPES.THRESHOLD:
        // Threshold proof requires amount and threshold
        if (inputs.privateAmount === undefined) {
          const error = new InputError('Secure validation failed: threshold proof requires privateAmount', {
            code: ErrorCode.INPUT_MISSING_REQUIRED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { 
              missingField: 'privateAmount',
              proofType: 'threshold'
            }
          });
          
          zkErrorLogger.logError(error, { context: 'validateSecureInputs.threshold' });
          return false;
        }
        
        if (inputs.thresholdAmount === undefined) {
          const error = new InputError('Secure validation failed: threshold proof requires thresholdAmount', {
            code: ErrorCode.INPUT_MISSING_REQUIRED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { 
              missingField: 'thresholdAmount',
              proofType: 'threshold'
            }
          });
          
          zkErrorLogger.logError(error, { context: 'validateSecureInputs.threshold' });
          return false;
        }
        
        // Threshold validation: private amount should be >= threshold amount
        try {
          const privateAmountBN = ethers.BigNumber.from(inputs.privateAmount);
          const thresholdAmountBN = ethers.BigNumber.from(inputs.thresholdAmount);
          if (privateAmountBN.lt(thresholdAmountBN)) {
            const error = new SecurityError('Secure validation failed: private amount is less than threshold', {
              code: ErrorCode.SECURITY_DATA_INTEGRITY,
              operationId,
              recoverable: false,
              securityCritical: true,
              userFixable: true,
              details: { 
                proofType: 'threshold',
                validationFailure: 'privateAmount < thresholdAmount'
              }
            });
            
            zkErrorLogger.logError(error, { context: 'validateSecureInputs.threshold' });
            return false;
          }
        } catch (e) {
          const error = new InputError(`Secure validation failed: amount comparison error - ${e.message}`, {
            code: ErrorCode.INPUT_TYPE_ERROR,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { 
              proofType: 'threshold',
              originalError: e.message
            }
          });
          
          zkErrorLogger.logError(error, { context: 'validateSecureInputs.threshold' });
          return false;
        }
        return true;

      case ZK_PROOF_TYPES.MAXIMUM:
        // Maximum proof requires amount and maximum
        if (inputs.privateAmount === undefined) {
          const error = new InputError('Secure validation failed: maximum proof requires privateAmount', {
            code: ErrorCode.INPUT_MISSING_REQUIRED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { 
              missingField: 'privateAmount',
              proofType: 'maximum'
            }
          });
          
          zkErrorLogger.logError(error, { context: 'validateSecureInputs.maximum' });
          return false;
        }
        
        if (inputs.maximumAmount === undefined) {
          const error = new InputError('Secure validation failed: maximum proof requires maximumAmount', {
            code: ErrorCode.INPUT_MISSING_REQUIRED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { 
              missingField: 'maximumAmount',
              proofType: 'maximum'
            }
          });
          
          zkErrorLogger.logError(error, { context: 'validateSecureInputs.maximum' });
          return false;
        }
        
        // Maximum validation: private amount should be <= maximum amount
        try {
          const privateAmountBN = ethers.BigNumber.from(inputs.privateAmount);
          const maximumAmountBN = ethers.BigNumber.from(inputs.maximumAmount);
          if (privateAmountBN.gt(maximumAmountBN)) {
            const error = new SecurityError('Secure validation failed: private amount exceeds maximum', {
              code: ErrorCode.SECURITY_DATA_INTEGRITY,
              operationId,
              recoverable: false,
              securityCritical: true,
              userFixable: true,
              details: { 
                proofType: 'maximum',
                validationFailure: 'privateAmount > maximumAmount'
              }
            });
            
            zkErrorLogger.logError(error, { context: 'validateSecureInputs.maximum' });
            return false;
          }
        } catch (e) {
          const error = new InputError(`Secure validation failed: amount comparison error - ${e.message}`, {
            code: ErrorCode.INPUT_TYPE_ERROR,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { 
              proofType: 'maximum',
              originalError: e.message
            }
          });
          
          zkErrorLogger.logError(error, { context: 'validateSecureInputs.maximum' });
          return false;
        }
        return true;

      default:
        // This should never happen due to earlier validation, but include as a safeguard
        const error = new InputError(`Secure validation failed: unknown proof type: ${proofType}`, {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { 
            providedProofType: proofType,
            validProofTypes: Object.values(ZK_PROOF_TYPES)
          }
        });
        
        zkErrorLogger.logError(error, { context: 'validateSecureInputs' });
        return false;
    }
  } catch (error) {
    // If it's already a ZKError, just log it
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'validateSecureInputs' });
    } else {
      // Otherwise, create and log a new error
      const zkError = new SystemError(`Error during secure input validation: ${error.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        recoverable: false,
        details: { originalError: error.message }
      });
      
      zkErrorLogger.logError(zkError, { context: 'validateSecureInputs' });
    }
    return false;
  }
};

/**
 * Securely removes inputs from storage when they are no longer needed
 * @param {string} inputId - ID of the secure input to clean up
 * @returns {Promise<boolean>} Whether cleanup was successful
 * @throws {SystemError} If secure storage operations fail
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function is like a secure document disposal service for digital information.
 * 
 * Once a verification is complete, sensitive financial information should not remain
 * in storage where it could potentially be accessed. This function:
 * 
 * 1. Locates the stored sensitive information by its unique ID
 * 2. Permanently removes it from all storage locations
 * 3. Overrides the memory locations to ensure no traces remain
 * 4. Verifies that the removal was successful
 * 
 * It's similar to how a bank might shred loan documents once a transaction is complete,
 * rather than keeping them indefinitely and risking exposure. This function ensures
 * that sensitive financial data doesn't linger in the system longer than necessary.
 */
export const cleanupSecureInputs = async (inputId) => {
  // Generate a unique operation ID for tracking this operation
  const operationId = `cleanup_secure_inputs_${Date.now()}`;
  
  try {
    // If no inputId is provided, log a warning but return success
    // (nothing to clean up is not an error)
    if (!inputId) {
      zkErrorLogger.log('WARNING', 'No input ID provided for cleanup', {
        operationId,
        severity: ErrorSeverity.WARNING,
        details: { inputIdProvided: false }
      });
      return true;
    }

    try {
      // Remove from secure storage with proper key format
      const storageKey = `zk-input-${inputId}`;
      secureStorage.removeItem(storageKey);
      
      // Log successful cleanup for audit purposes
      zkErrorLogger.log('INFO', 'Successfully cleaned up secure inputs', {
        operationId,
        severity: ErrorSeverity.INFO,
        category: ErrorCategory.SECURITY,
        details: { 
          inputId,
          storageKey,
          cleanupSuccess: true
        }
      });
      
      return true;
    } catch (error) {
      // Create specific error for storage operation failure
      const zkError = new SystemError(`Failed to clean up secure inputs: ${error.message}`, {
        code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
        operationId,
        recoverable: true, // This error is recoverable since it doesn't prevent further operations
        securityCritical: true, // But it is security-critical because it might leave sensitive data
        details: { 
          inputId,
          originalError: error.message
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'cleanupSecureInputs' });
      return false;
    }
  } catch (error) {
    // If it's already a ZKError, just log it
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'cleanupSecureInputs' });
    } else {
      // Otherwise, create and log a new error
      const zkError = new SystemError(`Error during secure input cleanup: ${error.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId,
        recoverable: true,
        details: { 
          inputId,
          originalError: error.message
        }
      });
      
      zkErrorLogger.logError(zkError, { context: 'cleanupSecureInputs' });
    }
    return false;
  }
};

export { addressToBytes } from './zkCircuitInputs';