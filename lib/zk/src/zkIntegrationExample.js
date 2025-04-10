/**
 * Zero-Knowledge Proof Integration Example
 * 
 * This file demonstrates how to integrate the ZK proof functionality with the 
 * existing Proof of Funds application. It shows how to:
 * 
 * 1. Generate ZK proofs from user wallet data
 * 2. Verify ZK proofs when received
 * 3. Use temporary wallets for proof submission
 * 4. Connect with the UI components
 * 
 * This is intended as a reference for developers integrating this code into
 * the pages/create.js and pages/verify.js components.
 * 
 * ---------- NON-TECHNICAL EXPLANATION ----------
 * 
 * This module is like a cookbook that shows developers how to use our privacy-
 * protection system in the actual application. It provides ready-to-use recipes for:
 * 
 * 1. Creating privacy-protecting proofs from a user's wallet data
 * 2. Checking if a proof is legitimate 
 * 3. Using temporary identities to submit proofs securely
 * 
 * Just as a cookbook doesn't just list ingredients but shows how to combine them
 * into a complete meal, this module demonstrates how to combine our privacy tools
 * into a complete user experience.
 */

import { ZK_PROOF_TYPES } from '../../config/constants';
import { generateZKProof, verifyZKProof } from './zkUtils';
import { generateTemporaryWallet, getBIP44Path } from '../walletHelpers';
import { 
  ErrorCode, 
  ErrorCategory, 
  ErrorSeverity,
  InputError, 
  ProofError,
  VerificationError,
  SystemError,
  isZKError 
} from './zkErrorHandler.js';
import { zkErrorLogger } from './zkErrorLogger.js';

/**
 * Helper to log errors in any try/catch blocks throughout the module
 * @param {Error} error - The error to log
 * @param {Object} context - Context information for the error
 * @returns {Promise<void>}
 * @private
 */
const logError = async (error, context = {}) => {
  try {
    // Log using the dedicated error logger if available
    if (zkErrorLogger && zkErrorLogger.logError) {
      // Ensure we don't cause infinite loops if logger itself has issues
      await zkErrorLogger.logError(error, {
        context: context.context || 'zkIntegrationExample.js',
        ...context
      });
    } else {
      // Fallback to console if logger not available
      console.error(`[ZKIntegration] Error: ${error.message}`, context);
    }
  } catch (loggingError) {
    // Last resort if even logging fails
    console.error(`Failed to log error: ${loggingError.message}`);
    console.error(`Original error: ${error.message}`);
  }
};

/**
 * Error specialized for ZK integration operations
 * @extends SystemError
 */
class ZKIntegrationError extends SystemError {
  /**
   * Create a new ZKIntegrationError
   * @param {string} message - Error message
   * @param {Object} context - Additional context about the error
   * @param {Error} [originalError] - The original error that caused this one
   */
  constructor(message, context = {}, originalError = null) {
    super(message, {
      code: context.code || ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      severity: context.severity || ErrorSeverity.ERROR,
      recoverable: context.recoverable !== undefined ? context.recoverable : true,
      details: {
        ...(context.details || {}),
        errorType: 'zk_integration',
        operationId: context.operationId || `zk_integration_${Date.now()}`
      }
    });
    
    this.name = 'ZKIntegrationError';
    this.context = context;
    this.originalError = originalError;
  }
}

// ------------------------------------------------------------------------------------------
// Example 1: Generate a ZK proof from user wallet data (for pages/create.js)
// ------------------------------------------------------------------------------------------

/**
 * Example of how to generate a ZK proof from user data in the create.js page
 * @param {Object} userData Data from the form
 * @param {string} userData.walletAddress Connected user wallet address
 * @param {string|number} userData.amount Amount to verify (in ETH/MATIC/etc.)
 * @param {string} userData.proofType Standard, threshold, or maximum
 * @param {number} userData.expiryTime Expiry time in seconds
 * @returns {Promise<Object>} Generated proof and submission result
 */
export async function generateProofExample(userData) {
  const operationId = `generate_proof_${Date.now()}`;
  
  try {
    // Validate user data
    if (!userData || typeof userData !== 'object') {
      const error = new InputError('Invalid user data for proof generation', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        details: { providedData: userData },
        recoverable: false,
        userFixable: true
      });
      
      await logError(error, { context: 'generateProofExample' });
      
      return {
        success: false,
        message: 'Invalid user data provided',
        errorCode: error.code,
        operationId
      };
    }
    
    // Extract user data parameters
    const {
      walletAddress, // Connected user wallet address
      amount,        // Amount to verify (in ETH/MATIC/etc.)
      proofType,     // Standard, threshold, or maximum
      expiryTime     // Expiry time in seconds
    } = userData;
    
    // Validate wallet address
    if (!walletAddress || typeof walletAddress !== 'string') {
      const error = new InputError('Invalid wallet address for proof generation', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        details: { 
          providedAddress: walletAddress, 
          expectedType: 'string' 
        },
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Connect a valid wallet before generating proof'
      });
      
      await logError(error, { context: 'generateProofExample' });
      
      return {
        success: false,
        message: 'Please connect a valid wallet',
        errorCode: error.code,
        operationId
      };
    }
    
    // Validate amount
    if (!amount || (typeof amount !== 'string' && typeof amount !== 'number')) {
      const error = new InputError('Invalid amount for proof generation', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        details: { 
          providedAmount: amount, 
          expectedType: 'string or number' 
        },
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Enter a valid amount'
      });
      
      await logError(error, { context: 'generateProofExample' });
      
      return {
        success: false,
        message: 'Please enter a valid amount',
        errorCode: error.code,
        operationId
      };
    }
    
    // Log operation start
    zkErrorLogger.log('INFO', `Creating ZK proof for wallet ${walletAddress}`, {
      operationId,
      details: { 
        walletAddress, 
        amount,
        proofType,
        expiryTime
      }
    });
  
    // 1. Convert amount to wei if needed
    let amountInWei;
    try {
      // Import ethers dynamically 
      const { ethers } = typeof window !== 'undefined' && window.ethers ? 
        { ethers: window.ethers } : 
        await import('ethers');
        
      amountInWei = ethers.utils.parseEther(amount.toString()).toString();
    } catch (error) {
      const parseError = new InputError(`Failed to parse amount to wei: ${error.message}`, {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { 
          providedAmount: amount,
          error: error.message
        },
        recommendedAction: 'Enter a valid numeric amount'
      });
      
      await logError(parseError, { context: 'generateProofExample.parseAmount' });
      
      return {
        success: false,
        message: 'Please enter a valid numeric amount',
        errorCode: parseError.code,
        operationId
      };
    }
    
    // 2. Determine the proof type enum value
    let zkProofType;
    switch (proofType) {
      case 'standard':
        zkProofType = ZK_PROOF_TYPES.STANDARD;
        break;
      case 'threshold':
        zkProofType = ZK_PROOF_TYPES.THRESHOLD;
        break;
      case 'maximum':
        zkProofType = ZK_PROOF_TYPES.MAXIMUM;
        break;
      default:
        zkProofType = ZK_PROOF_TYPES.STANDARD;
        
        // Log that we're using a default value
        zkErrorLogger.log('WARNING', 'Using default proof type (standard)', {
          operationId,
          details: { 
            providedType: proofType,
            usingDefault: true,
            defaultType: 'standard'
          }
        });
    }
    
    // 3. Generate the ZK proof
    let zkProof;
    try {
      zkProof = await generateZKProof({
        walletAddress,
        amount: amountInWei,
        proofType: zkProofType
      });
      
      zkErrorLogger.log('INFO', 'ZK proof generated successfully', {
        operationId,
        details: { 
          walletAddress,
          proofId: zkProof.id || 'unknown'
        }
      });
    } catch (error) {
      // This could already be a ZKError from generateZKProof 
      const proofError = isZKError(error) ? error : new ProofError(
        `Failed to generate ZK proof: ${error.message}`,
        {
          code: ErrorCode.PROOF_GENERATION_FAILED,
          operationId,
          recoverable: false,
          details: { 
            walletAddress,
            amountInWei,
            proofType: zkProofType,
            originalError: error.message
          }
        },
        error
      );
      
      await logError(proofError, { 
        context: 'generateProofExample.generateZKProof',
        walletAddress 
      });
      
      return {
        success: false,
        message: `Failed to generate proof: ${error.message}`,
        errorCode: proofError.code,
        operationId
      };
    }
    
    // 4. Generate a temporary wallet for submitting the proof to the blockchain
    let tempWallet;
    try {
      tempWallet = await generateTemporaryWallet({
        chain: 'polygon'
      });
      
      zkErrorLogger.log('INFO', `Generated temporary wallet for proof submission`, {
        operationId,
        details: { 
          tempAddress: tempWallet.address,
          chain: tempWallet.chain || 'polygon'
        }
      });
    } catch (error) {
      // This could be a ZKError if temporaryWalletManager uses ZKErrorHandler
      const walletError = isZKError(error) ? error : new SystemError(
        `Failed to generate temporary wallet: ${error.message}`,
        {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId,
          recoverable: false,
          details: { originalError: error.message }
        },
        error
      );
      
      await logError(walletError, { 
        context: 'generateProofExample.generateTempWallet' 
      });
      
      // We can still return the proof even if temp wallet fails
      return {
        proof: zkProof,
        success: true,
        partialSuccess: true,
        message: 'Proof generated but temporary wallet creation failed',
        details: {
          error: error.message,
          walletAddress,
          proofId: zkProof.id || 'unknown'
        },
        operationId
      };
    }
    
    // 5. In production, you would now:
    // a. Fund the temporary wallet with a small amount of MATIC
    // b. Submit the proof to the blockchain using the temporary wallet
    // c. Store the proof details for later verification
    
    // 6. Return the proof and submission details
    zkErrorLogger.log('INFO', 'Proof generation and temp wallet creation successful', {
      operationId,
      details: { 
        walletAddress,
        tempWalletAddress: tempWallet.address,
        proofId: zkProof.id || 'unknown'
      }
    });
    
    return {
      proof: zkProof,
      tempWallet: {
        address: tempWallet.address,
        path: tempWallet.path
      },
      success: true,
      message: 'Proof generated and ready for submission',
      operationId
    };
  } catch (error) {
    // This catch block handles unexpected errors not caught by the specific error handlers above
    const integrationError = isZKError(error) ? error : new ZKIntegrationError(
      `Unexpected error in proof generation: ${error.message}`,
      {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        operationId,
        recoverable: false,
        details: { originalError: error.message }
      },
      error
    );
    
    await logError(integrationError, { context: 'generateProofExample' });
    
    return {
      success: false,
      message: `An unexpected error occurred: ${error.message}`,
      errorCode: integrationError.code,
      operationId
    };
  }
}

// ------------------------------------------------------------------------------------------
// Example 2: Verify a ZK proof (for pages/verify.js)
// ------------------------------------------------------------------------------------------

/**
 * Example of how to verify a ZK proof in the verify.js page
 * @param {Object} verificationData Data about the proof to verify
 * @param {string} verificationData.walletAddress Address that created the proof
 * @param {string} verificationData.proofType Type of proof (standard, threshold, maximum)
 * @param {Object} verificationData.proof Serialized proof data
 * @param {Array} verificationData.publicSignals Public signals from the proof
 * @param {string|number} verificationData.amount Amount being verified (in ETH/MATIC/etc.)
 * @returns {Promise<Object>} Verification result
 */
export async function verifyProofExample(verificationData) {
  const operationId = `verify_proof_${Date.now()}`;
  
  try {
    // Validate verification data
    if (!verificationData || typeof verificationData !== 'object') {
      const error = new InputError('Invalid verification data', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        details: { providedData: verificationData },
        recoverable: false,
        userFixable: true
      });
      
      await logError(error, { context: 'verifyProofExample' });
      
      return {
        isValid: false,
        message: 'Invalid verification data provided',
        errorCode: error.code,
        operationId
      };
    }
    
    // Sample verification data
    const {
      walletAddress,  // Address that created the proof
      proofType,      // Type of proof (standard, threshold, maximum)
      proof,          // Serialized proof data
      publicSignals,  // Public signals from the proof
      amount          // Amount being verified (in ETH/MATIC/etc.)
    } = verificationData;
    
    // Validate required fields
    if (!proof || !publicSignals) {
      const error = new InputError('Missing required proof data', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        details: { 
          hasProof: !!proof,
          hasPublicSignals: !!publicSignals
        },
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Provide both proof and publicSignals data'
      });
      
      await logError(error, { context: 'verifyProofExample' });
      
      return {
        isValid: false,
        message: 'Missing required proof data',
        errorCode: error.code,
        operationId
      };
    }
    
    // Log operation start
    zkErrorLogger.log('INFO', `Verifying ZK proof for wallet ${walletAddress || 'unknown'}`, {
      operationId,
      details: { 
        walletAddress: walletAddress || 'unknown',
        proofType,
        hasPublicSignals: !!publicSignals,
        publicSignalsLength: publicSignals?.length
      }
    });
    
    // 1. Determine the proof type enum value
    let zkProofType;
    switch (proofType) {
      case 'standard':
        zkProofType = ZK_PROOF_TYPES.STANDARD;
        break;
      case 'threshold':
        zkProofType = ZK_PROOF_TYPES.THRESHOLD;
        break;
      case 'maximum':
        zkProofType = ZK_PROOF_TYPES.MAXIMUM;
        break;
      default:
        zkProofType = ZK_PROOF_TYPES.STANDARD;
        
        // Log that we're using a default value
        zkErrorLogger.log('WARNING', 'Using default proof type (standard) for verification', {
          operationId,
          details: { 
            providedType: proofType,
            usingDefault: true,
            defaultType: 'standard'
          }
        });
    }
    
    // 2. Verify the ZK proof
    let isValid;
    try {
      isValid = await verifyZKProof({
        proof,
        publicSignals,
        proofType: zkProofType
      });
      
      zkErrorLogger.log('INFO', `Proof verification result: ${isValid ? 'Valid' : 'Invalid'}`, {
        operationId,
        details: { 
          walletAddress: walletAddress || 'unknown',
          proofType: zkProofType,
          isValid
        }
      });
    } catch (error) {
      // This could already be a ZKError from verifyZKProof
      const verifyError = isZKError(error) ? error : new VerificationError(
        `Failed to verify ZK proof: ${error.message}`,
        {
          code: ErrorCode.VERIFICATION_FAILED,
          operationId,
          recoverable: false,
          details: { 
            walletAddress: walletAddress || 'unknown',
            proofType: zkProofType,
            originalError: error.message
          }
        },
        error
      );
      
      await logError(verifyError, { 
        context: 'verifyProofExample.verifyZKProof',
        walletAddress: walletAddress || 'unknown'
      });
      
      return {
        isValid: false,
        message: `Error verifying proof: ${error.message}`,
        errorCode: verifyError.code,
        operationId
      };
    }
    
    // 3. Return the verification result
    if (isValid) {
      zkErrorLogger.log('INFO', 'Proof verification successful', {
        operationId,
        details: { 
          walletAddress: walletAddress || 'unknown',
          proofType: zkProofType
        }
      });
      
      return {
        isValid: true,
        message: 'The proof is valid',
        details: {
          walletAddress: walletAddress || 'unknown',
          amount,
          proofType: proofType,
          verifiedAt: new Date().toISOString()
        },
        operationId
      };
    } else {
      zkErrorLogger.log('WARNING', 'Proof verification failed', {
        operationId,
        details: { 
          walletAddress: walletAddress || 'unknown',
          proofType: zkProofType
        }
      });
      
      return {
        isValid: false,
        message: 'The proof is invalid',
        operationId
      };
    }
  } catch (error) {
    // This catch block handles unexpected errors not caught by the specific error handlers above
    const integrationError = isZKError(error) ? error : new ZKIntegrationError(
      `Unexpected error in proof verification: ${error.message}`,
      {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        operationId,
        recoverable: false,
        details: { originalError: error.message }
      },
      error
    );
    
    await logError(integrationError, { context: 'verifyProofExample' });
    
    return {
      isValid: false,
      message: `An unexpected error occurred during verification: ${error.message}`,
      errorCode: integrationError.code,
      operationId
    };
  }
}

// ------------------------------------------------------------------------------------------
// Integration Guide
// ------------------------------------------------------------------------------------------

/**
 * Guide for integrating ZK functionality with the UI
 */
export const integrationGuide = {
  createPage: `
    To integrate ZK proofs in the create.js page:
    
    1. Import the ZK functionality:
       import { generateZKProof } from '../lib/zk';
       import { generateTemporaryWallet } from '../lib/walletHelpers';
    
    2. Add a ZK option in the proof category selector.
    
    3. When the user selects ZK proof type, collect the same information
       as for regular proofs (amount, expiry, etc.)
    
    4. When submitting, call generateZKProof instead of the regular
       proof generation functions.
    
    5. Generate a temporary wallet for proof submission.
    
    6. Submit the proof to the blockchain using the temporary wallet.
  `,
  
  verifyPage: `
    To integrate ZK verification in the verify.js page:
    
    1. Import the ZK functionality:
       import { verifyZKProof } from '../lib/zk';
    
    2. When verifying a transaction, check if it contains a ZK proof.
    
    3. If it does, use verifyZKProof instead of the regular verification.
    
    4. Display the verification result to the user.
  `,
  
  errorHandling: `
    When integrating ZK functionality, always implement proper error handling:
    
    1. Import error types from zkErrorHandler.js:
       import { InputError, ProofError, VerificationError } from '../lib/zk/zkErrorHandler';
       
    2. Use try/catch blocks around all ZK operations
    
    3. Use zkErrorLogger to log all errors:
       import { zkErrorLogger } from '../lib/zk/zkErrorLogger';
       
    4. Return user-friendly error messages while logging detailed error information
    
    5. Track operations with unique operationIds for debugging
  `
};

export default {
  generateProofExample,
  verifyProofExample,
  integrationGuide
};