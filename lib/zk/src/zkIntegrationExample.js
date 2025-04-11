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
  // Ensure we have a valid error object
  if (!error) {
    error = new ZKIntegrationError('Unknown error occurred', {
      code: ErrorCode.SYSTEM_UNKNOWN_ERROR,
      severity: ErrorSeverity.ERROR,
      details: { providedError: 'null or undefined' }
    });
  }
  
  // Normalize error context
  const normalizedContext = {
    module: 'zkIntegrationExample',
    function: context.context || context.function || 'unknown',
    operationId: context.operationId || error.details?.operationId || `zk_integration_${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...context
  };
  
  try {
    // Log using the dedicated error logger if available
    if (zkErrorLogger && zkErrorLogger.logError) {
      // Ensure we don't cause infinite loops if logger itself has issues
      await zkErrorLogger.logError(error, normalizedContext);
    } else {
      // Fallback to console if logger not available
      console.error(`[ZKIntegration] Error: ${error.message}`, {
        errorName: error.name,
        errorCode: error.code,
        ...normalizedContext
      });
    }
  } catch (loggingError) {
    // Last resort if even logging fails
    console.error(`Failed to log error: ${loggingError.message}`);
    console.error(`Original error: ${error.message || '(No message)'}`);
    
    // Attempt a simpler logging approach as final fallback
    try {
      console.error('[ZKIntegration] Error logging failed', {
        errorMessage: error.message || '(No message)',
        errorName: error.name,
        context: normalizedContext.function
      });
    } catch (e) {
      // Nothing more we can do at this point
    }
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
   * @param {Object} options - Additional options for the error
   * @param {number} [options.code] - Error code from ErrorCode enum
   * @param {string} [options.severity] - Error severity from ErrorSeverity enum
   * @param {boolean} [options.recoverable] - Whether the error is recoverable
   * @param {string} [options.operationId] - Unique ID for the operation that caused the error
   * @param {Object} [options.details] - Additional error details
   * @param {string} [options.userFixable] - Whether the user can fix this error
   * @param {string} [options.recommendedAction] - Recommended action to fix the error
   * @param {Error} [options.originalError] - The original error that caused this one
   */
  constructor(message, options = {}) {
    // Generate a unique operation ID if not provided
    const operationId = options.operationId || `zk_integration_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    super(message, {
      code: options.code || ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      severity: options.severity || ErrorSeverity.ERROR,
      recoverable: options.recoverable !== undefined ? options.recoverable : true,
      details: {
        ...(options.details || {}),
        component: 'ZKIntegration',
        errorType: 'zk_integration',
        errorTimestamp: new Date().toISOString(),
        operationId
      }
    });
    
    this.name = 'ZKIntegrationError';
    this.userFixable = options.userFixable;
    this.recommendedAction = options.recommendedAction;
    this.operationId = operationId;
    
    // Track original error for debugging
    if (options.originalError) {
      this.originalError = options.originalError;
      this.originalStack = options.originalError.stack;
      
      // Copy any additional properties from original error that might be useful
      if (options.originalError.code && !this.code) {
        this.originalErrorCode = options.originalError.code;
      }
    }
    
    // Capture current stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ZKIntegrationError);
    }
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
  const operationId = `generate_proof_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  try {
    // Create logging context for this operation
    const logContext = {
      function: 'generateProofExample',
      operationId,
      startTime: new Date().toISOString()
    };
    
    // Validate user data
    if (!userData || typeof userData !== 'object') {
      const error = new InputError('Invalid user data for proof generation', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        severity: ErrorSeverity.ERROR,
        details: { 
          providedData: typeof userData === 'object' ? 'null' : typeof userData,
          validationStage: 'initial'
        },
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Provide valid userData object'
      });
      
      await logError(error, logContext);
      
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
    
    // Update log context with user data
    logContext.userData = {
      walletAddress: walletAddress ? 
        `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` : 
        'undefined',
      hasAmount: !!amount,
      proofType,
      hasExpiryTime: !!expiryTime
    };
    
    // Validate wallet address
    if (!walletAddress || typeof walletAddress !== 'string') {
      const error = new InputError('Invalid wallet address for proof generation', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        severity: ErrorSeverity.ERROR,
        details: { 
          providedAddress: walletAddress || 'undefined', 
          expectedType: 'string',
          validationStage: 'wallet_address'
        },
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Connect a valid wallet before generating proof'
      });
      
      await logError(error, logContext);
      
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
        severity: ErrorSeverity.ERROR,
        details: { 
          providedAmount: amount || 'undefined', 
          providedType: amount ? typeof amount : 'undefined',
          expectedType: 'string or number',
          validationStage: 'amount'
        },
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Enter a valid amount'
      });
      
      await logError(error, logContext);
      
      return {
        success: false,
        message: 'Please enter a valid amount',
        errorCode: error.code,
        operationId
      };
    }
    
    // Log operation start with structured data
    zkErrorLogger.log('INFO', `Creating ZK proof for wallet ${walletAddress}`, {
      operationId,
      component: 'ZKIntegration',
      operation: 'generateProofExample',
      details: { 
        walletAddress, 
        amount,
        proofType,
        expiryTime,
        timestamp: new Date().toISOString()
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
      
      // Add to context
      logContext.amountInWei = amountInWei;
    } catch (error) {
      const parseError = new InputError(`Failed to parse amount to wei: ${error.message}`, {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        severity: ErrorSeverity.ERROR,
        recoverable: false,
        userFixable: true,
        details: { 
          providedAmount: amount,
          providedType: typeof amount,
          error: error.message,
          validationStage: 'amount_conversion'
        },
        recommendedAction: 'Enter a valid numeric amount',
        originalError: error
      });
      
      await logError(parseError, {
        ...logContext,
        function: 'generateProofExample.parseAmount',
        stage: 'amount_parsing'
      });
      
      return {
        success: false,
        message: 'Please enter a valid numeric amount',
        errorCode: parseError.code,
        operationId,
        details: {
          reason: error.message
        }
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
          component: 'ZKIntegration',
          details: { 
            providedType: proofType,
            usingDefault: true,
            defaultType: 'standard',
            stage: 'proof_type_determination'
          }
        });
    }
    
    // Update log context with proof type
    logContext.zkProofType = zkProofType;
    logContext.stage = 'before_proof_generation';
    
    // 3. Generate the ZK proof
    let zkProof;
    try {
      // Log start of proof generation
      zkErrorLogger.log('INFO', 'Starting ZK proof generation', {
        operationId,
        component: 'ZKIntegration',
        details: {
          walletAddress,
          amountInWei,
          proofType: zkProofType,
          stage: 'proof_generation_start'
        }
      });
      
      // Start timer for performance tracking
      const startTime = Date.now();
      
      zkProof = await generateZKProof({
        walletAddress,
        amount: amountInWei,
        proofType: zkProofType
      });
      
      // Track performance
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      zkErrorLogger.log('INFO', 'ZK proof generated successfully', {
        operationId,
        component: 'ZKIntegration',
        details: { 
          walletAddress,
          proofId: zkProof.id || 'unknown',
          durationMs: duration,
          stage: 'proof_generation_complete'
        }
      });
      
      // Update log context with proof info
      logContext.hasProof = true;
      logContext.proofId = zkProof.id || 'unknown';
      logContext.proofDurationMs = duration;
      logContext.stage = 'after_proof_generation';
    } catch (error) {
      // Update log context with error info
      logContext.stage = 'proof_generation_failed';
      logContext.errorType = error.name || typeof error;
      
      // This could already be a ZKError from generateZKProof 
      const proofError = isZKError(error) ? error : new ProofError(
        `Failed to generate ZK proof: ${error.message}`,
        {
          code: ErrorCode.PROOF_GENERATION_FAILED,
          operationId,
          severity: ErrorSeverity.ERROR,
          recoverable: false,
          details: { 
            walletAddress,
            amountInWei,
            proofType: zkProofType,
            stage: 'proof_generation',
            errorTime: new Date().toISOString()
          },
          originalError: error
        }
      );
      
      await logError(proofError, { 
        ...logContext,
        function: 'generateProofExample.generateZKProof',
      });
      
      return {
        success: false,
        message: `Failed to generate proof: ${error.message}`,
        errorCode: proofError.code,
        operationId,
        details: {
          walletAddress: walletAddress.substring(0, 6) + '...' + walletAddress.substring(walletAddress.length - 4),
          proofType
        }
      };
    }
    
    // Update context for next operation
    logContext.stage = 'before_temp_wallet_generation';
    
    // 4. Generate a temporary wallet for submitting the proof to the blockchain
    let tempWallet;
    try {
      // Log start of wallet generation
      zkErrorLogger.log('INFO', 'Starting temporary wallet generation', {
        operationId,
        component: 'ZKIntegration',
        details: {
          stage: 'temp_wallet_generation_start',
          chain: 'polygon'
        }
      });
      
      // Start timer for performance tracking
      const startTime = Date.now();
      
      tempWallet = await generateTemporaryWallet({
        chain: 'polygon'
      });
      
      // Track performance
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      zkErrorLogger.log('INFO', `Generated temporary wallet for proof submission`, {
        operationId,
        component: 'ZKIntegration',
        details: { 
          tempAddress: tempWallet.address,
          chain: tempWallet.chain || 'polygon',
          durationMs: duration,
          stage: 'temp_wallet_generation_complete'
        }
      });
      
      // Update log context with wallet info
      logContext.hasTempWallet = true;
      logContext.tempWalletAddress = tempWallet.address;
      logContext.walletDurationMs = duration;
      logContext.stage = 'after_temp_wallet_generation';
    } catch (error) {
      // Update log context with error info
      logContext.stage = 'temp_wallet_generation_failed';
      logContext.errorType = error.name || typeof error;
      
      // This could be a ZKError if temporaryWalletManager uses ZKErrorHandler
      const walletError = isZKError(error) ? error : new SystemError(
        `Failed to generate temporary wallet: ${error.message}`,
        {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          severity: ErrorSeverity.WARNING, // Not critical - we can continue
          operationId,
          recoverable: true,  // We can still return the proof
          details: { 
            stage: 'temp_wallet_generation',
            errorTime: new Date().toISOString(),
            affectsSubmission: true,
            allowsVerification: true
          },
          originalError: error
        }
      );
      
      await logError(walletError, { 
        ...logContext,
        function: 'generateProofExample.generateTempWallet' 
      });
      
      // We can still return the proof even if temp wallet fails
      return {
        proof: zkProof,
        success: true,
        partialSuccess: true,
        message: 'Proof generated but temporary wallet creation failed',
        details: {
          error: error.message,
          walletAddress: walletAddress.substring(0, 6) + '...' + walletAddress.substring(walletAddress.length - 4),
          proofId: zkProof.id || 'unknown'
        },
        operationId
      };
    }
    
    // 5. In production, you would now:
    // a. Fund the temporary wallet with a small amount of MATIC
    // b. Submit the proof to the blockchain using the temporary wallet
    // c. Store the proof details for later verification
    
    // Update log context for final step
    logContext.stage = 'success';
    logContext.completionTime = new Date().toISOString();
    
    // 6. Return the proof and submission details
    zkErrorLogger.log('INFO', 'Proof generation and temp wallet creation successful', {
      operationId,
      component: 'ZKIntegration',
      operation: 'generateProofExample',
      details: { 
        walletAddress,
        tempWalletAddress: tempWallet.address,
        proofId: zkProof.id || 'unknown',
        completionTime: new Date().toISOString(),
        totalDurationMs: Date.now() - new Date(logContext.startTime).getTime()
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
        severity: ErrorSeverity.ERROR,
        operationId,
        recoverable: false,
        details: { 
          stage: 'unknown',
          component: 'ZKIntegration',
          operation: 'generateProofExample',
          errorTime: new Date().toISOString()
        },
        originalError: error
      }
    );
    
    await logError(integrationError, { 
      function: 'generateProofExample',
      stage: 'uncaught_error',
      operationId
    });
    
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
  const operationId = `verify_proof_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  try {
    // Create logging context for this operation
    const logContext = {
      function: 'verifyProofExample',
      operationId,
      startTime: new Date().toISOString()
    };
    
    // Validate verification data
    if (!verificationData || typeof verificationData !== 'object') {
      const error = new InputError('Invalid verification data', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        severity: ErrorSeverity.ERROR,
        operationId,
        details: { 
          providedData: typeof verificationData === 'object' ? 'null' : typeof verificationData,
          validationStage: 'initial'
        },
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Provide valid verification data object'
      });
      
      await logError(error, logContext);
      
      return {
        isValid: false,
        message: 'Invalid verification data provided',
        errorCode: error.code,
        operationId
      };
    }
    
    // Extract verification data parameters
    const {
      walletAddress,  // Address that created the proof
      proofType,      // Type of proof (standard, threshold, maximum)
      proof,          // Serialized proof data
      publicSignals,  // Public signals from the proof
      amount          // Amount being verified (in ETH/MATIC/etc.)
    } = verificationData;
    
    // Update log context with verification data
    logContext.verificationData = {
      hasWalletAddress: !!walletAddress,
      walletAddressFragment: walletAddress ? 
        `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` :
        'unknown',
      proofType,
      hasProof: !!proof,
      hasPublicSignals: !!publicSignals,
      publicSignalsLength: publicSignals?.length,
      hasAmount: !!amount
    };
    
    // Validate required fields
    if (!proof || !publicSignals) {
      const error = new InputError('Missing required proof data', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        severity: ErrorSeverity.ERROR,
        operationId,
        details: { 
          hasProof: !!proof,
          hasPublicSignals: !!publicSignals,
          validationStage: 'required_fields'
        },
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Provide both proof and publicSignals data'
      });
      
      await logError(error, logContext);
      
      return {
        isValid: false,
        message: 'Missing required proof data',
        errorCode: error.code,
        operationId
      };
    }
    
    // Log operation start with structured data
    zkErrorLogger.log('INFO', `Verifying ZK proof for wallet ${walletAddress || 'unknown'}`, {
      operationId,
      component: 'ZKIntegration',
      operation: 'verifyProofExample',
      details: { 
        walletAddress: walletAddress || 'unknown',
        proofType,
        hasPublicSignals: !!publicSignals,
        publicSignalsLength: publicSignals?.length,
        timestamp: new Date().toISOString()
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
          component: 'ZKIntegration',
          details: { 
            providedType: proofType,
            usingDefault: true,
            defaultType: 'standard',
            stage: 'proof_type_determination'
          }
        });
    }
    
    // Update log context with proof type
    logContext.zkProofType = zkProofType;
    logContext.stage = 'before_proof_verification';
    
    // 2. Verify the ZK proof
    let isValid;
    try {
      // Log start of verification
      zkErrorLogger.log('INFO', 'Starting ZK proof verification', {
        operationId,
        component: 'ZKIntegration',
        details: {
          walletAddress: walletAddress || 'unknown',
          proofType: zkProofType,
          publicSignalsLength: publicSignals?.length,
          stage: 'verification_start'
        }
      });
      
      // Start timer for performance tracking
      const startTime = Date.now();
      
      isValid = await verifyZKProof({
        proof,
        publicSignals,
        proofType: zkProofType
      });
      
      // Track performance
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      zkErrorLogger.log('INFO', `Proof verification result: ${isValid ? 'Valid' : 'Invalid'}`, {
        operationId,
        component: 'ZKIntegration',
        details: { 
          walletAddress: walletAddress || 'unknown',
          proofType: zkProofType,
          isValid,
          durationMs: duration,
          stage: 'verification_complete'
        }
      });
      
      // Update log context with verification info
      logContext.isValid = isValid;
      logContext.verificationDurationMs = duration;
      logContext.stage = 'after_proof_verification';
    } catch (error) {
      // Update log context with error info
      logContext.stage = 'verification_failed';
      logContext.errorType = error.name || typeof error;
      
      // This could already be a ZKError from verifyZKProof
      const verifyError = isZKError(error) ? error : new VerificationError(
        `Failed to verify ZK proof: ${error.message}`,
        {
          code: ErrorCode.VERIFICATION_FAILED,
          severity: ErrorSeverity.ERROR,
          operationId,
          recoverable: false,
          details: { 
            walletAddress: walletAddress || 'unknown',
            proofType: zkProofType,
            stage: 'proof_verification',
            errorTime: new Date().toISOString()
          },
          originalError: error
        }
      );
      
      await logError(verifyError, { 
        ...logContext,
        function: 'verifyProofExample.verifyZKProof'
      });
      
      return {
        isValid: false,
        message: `Error verifying proof: ${error.message}`,
        errorCode: verifyError.code,
        operationId,
        details: {
          reason: error.message,
          proofType
        }
      };
    }
    
    // Update log context for final step
    logContext.stage = isValid ? 'success' : 'verification_invalid';
    logContext.completionTime = new Date().toISOString();
    
    // 3. Return the verification result
    if (isValid) {
      zkErrorLogger.log('INFO', 'Proof verification successful', {
        operationId,
        component: 'ZKIntegration',
        operation: 'verifyProofExample',
        details: { 
          walletAddress: walletAddress || 'unknown',
          proofType: zkProofType,
          completionTime: new Date().toISOString(),
          totalDurationMs: Date.now() - new Date(logContext.startTime).getTime()
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
      zkErrorLogger.log('WARNING', 'Proof verification failed - invalid proof', {
        operationId,
        component: 'ZKIntegration',
        operation: 'verifyProofExample',
        details: { 
          walletAddress: walletAddress || 'unknown',
          proofType: zkProofType,
          completionTime: new Date().toISOString(),
          totalDurationMs: Date.now() - new Date(logContext.startTime).getTime()
        }
      });
      
      return {
        isValid: false,
        message: 'The proof is invalid',
        details: {
          walletAddress: walletAddress ? 
            `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` : 
            'unknown',
          proofType,
          verifiedAt: new Date().toISOString()
        },
        operationId
      };
    }
  } catch (error) {
    // This catch block handles unexpected errors not caught by the specific error handlers above
    const integrationError = isZKError(error) ? error : new ZKIntegrationError(
      `Unexpected error in proof verification: ${error.message}`,
      {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        severity: ErrorSeverity.ERROR,
        operationId,
        recoverable: false,
        details: { 
          stage: 'unknown',
          component: 'ZKIntegration',
          operation: 'verifyProofExample',
          errorTime: new Date().toISOString()
        },
        originalError: error
      }
    );
    
    await logError(integrationError, { 
      function: 'verifyProofExample',
      stage: 'uncaught_error',
      operationId
    });
    
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