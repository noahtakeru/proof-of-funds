/**
 * Zero-Knowledge Proof System Test Module
 * 
 * This file provides utility functions to test the zero-knowledge proof system.
 * It includes functions to generate test proofs, validate the system, and
 * ensure all components are working together properly.
 * 
 * ---------- NON-TECHNICAL EXPLANATION ----------
 * 
 * This module is like a testing laboratory for our privacy-protection system.
 * 
 * Imagine you've built a machine that creates special envelopes that can prove 
 * you have enough money in your account without showing your balance. Before 
 * releasing this to customers, you need to test if it works correctly:
 * 
 * 1. Can it create a test envelope (proof) for different amounts and accounts?
 * 2. Can it verify that these envelopes are legitimate?
 * 3. Can it handle all types of verification: exact amounts, minimum amounts,
 *    and maximum amounts?
 * 
 * This testing module helps developers run these checks quickly to make sure
 * everything is working correctly before real users depend on it. It simulates
 * real-world usage with temporary wallets and various test scenarios, like a
 * quality control department running tests before a product ships.
 */

import { ZK_PROOF_TYPES } from '../../config/constants';
import { generateZKProof, verifyZKProof } from './zkUtils';
import { generateInputs } from './zkCircuitInputs';
import { getBIP44Path, generateTemporaryWallet } from '../walletHelpers';
import { 
  ErrorCode, 
  ErrorSeverity, 
  SystemError,
  ProofError,
  InputError,
  isZKError
} from './zkErrorHandler.js';
import { zkErrorLogger } from './zkErrorLogger.js';

/**
 * Custom error class for ZK testing errors
 * @extends SystemError
 */
class ZKTestError extends SystemError {
  /**
   * Create a new ZK test error
   * @param {string} message - Error message
   * @param {Object} options - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      code: options.code || ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      severity: options.severity || ErrorSeverity.ERROR,
      recoverable: options.recoverable !== undefined ? options.recoverable : true,
      details: {
        ...(options.details || {}),
        component: 'ZKTestModule',
        operationId: options.operationId || `zk_test_${Date.now()}`
      }
    });
    
    this.name = 'ZKTestError';
  }
}

/**
 * Helper function to log errors consistently
 * @param {Error} error - The error to log
 * @param {Object} additionalInfo - Additional context information
 * @returns {Error} The error for chaining
 */
function logError(error, additionalInfo = {}) {
  // Convert to ZKTestError if it's not already a specialized error
  if (!isZKError(error)) {
    const operationId = additionalInfo.operationId || `zk_test_error_${Date.now()}`;
    error = new ZKTestError(error.message || 'Unknown error in ZK test module', {
      operationId,
      details: {
        originalError: error,
        ...additionalInfo
      }
    });
  }
  
  // Log the error using zkErrorLogger
  zkErrorLogger.logError(error, additionalInfo);
  return error;
}

/**
 * Generate a test proof with the specified parameters
 * @param {Object} params - Test parameters
 * @param {string} params.walletAddress - Wallet address
 * @param {string} params.amount - Amount for verification
 * @param {number} params.proofType - Proof type from ZK_PROOF_TYPES
 * @returns {Promise<Object>} Generated test proof
 */
export async function generateTestProof(params) {
  const operationId = `generate_test_proof_${Date.now()}`;
  
  try {
    // Validate inputs
    if (!params) {
      const inputError = new InputError('Missing parameters for test proof generation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        severity: ErrorSeverity.ERROR,
        details: {
          providedParams: params
        }
      });
      logError(inputError);
      throw inputError;
    }
    
    const { walletAddress, amount, proofType = ZK_PROOF_TYPES.STANDARD } = params;
    
    if (!walletAddress) {
      const walletError = new InputError('Wallet address is required for test proof generation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        severity: ErrorSeverity.ERROR,
        details: {
          providedWallet: walletAddress,
          amount,
          proofType
        }
      });
      logError(walletError);
      throw walletError;
    }
    
    if (!amount) {
      const amountError = new InputError('Amount is required for test proof generation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        severity: ErrorSeverity.ERROR,
        details: {
          walletAddress,
          providedAmount: amount,
          proofType
        }
      });
      logError(amountError);
      throw amountError;
    }

    console.log(`Generating test proof for ${walletAddress} with amount ${amount}, type ${proofType}`);

    // Generate the proof
    const proof = await generateZKProof({
      walletAddress,
      amount,
      proofType
    });

    console.log('Test proof generated successfully');
    return proof;
  } catch (error) {
    // If it's not already a handled error, wrap it as a ZK proof error
    if (!isZKError(error)) {
      error = new ProofError('Failed to generate test proof', {
        code: ErrorCode.PROOF_GENERATION_FAILED,
        operationId,
        severity: ErrorSeverity.ERROR,
        recoverable: false,
        details: {
          params,
          originalError: error
        }
      });
    }
    
    // Log the error with detailed context
    logError(error, {
      operation: 'generateTestProof',
      params
    });
    
    console.error('Error generating test proof:', error.message);
    throw error;
  }
}

/**
 * Generate a temporary wallet and create a test proof with it
 * @param {Object} params - Test parameters
 * @param {string} params.amount - Amount for verification
 * @param {number} params.proofType - Proof type from ZK_PROOF_TYPES
 * @returns {Promise<Object>} Result with wallet and proof
 */
export async function generateTestWalletAndProof(params) {
  const operationId = `generate_test_wallet_and_proof_${Date.now()}`;
  
  try {
    // Validate inputs
    if (!params) {
      const inputError = new InputError('Missing parameters for test wallet and proof generation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        severity: ErrorSeverity.ERROR,
        details: {
          providedParams: params
        }
      });
      logError(inputError);
      throw inputError;
    }
    
    const { amount, proofType = ZK_PROOF_TYPES.STANDARD } = params;
    
    if (!amount) {
      const amountError = new InputError('Amount is required for test wallet and proof generation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        severity: ErrorSeverity.ERROR,
        details: {
          providedAmount: amount,
          proofType
        }
      });
      logError(amountError);
      throw amountError;
    }

    // Generate a temporary wallet
    console.log('Generating temporary test wallet...');
    let wallet;
    try {
      wallet = await generateTemporaryWallet({ chain: 'polygon' });
      console.log(`Test wallet generated: ${wallet.address}`);
    } catch (walletError) {
      const wrappedError = new ZKTestError('Failed to generate temporary test wallet', {
        code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
        operationId: `${operationId}_wallet_generation`,
        severity: ErrorSeverity.ERROR,
        recoverable: false,
        details: {
          chain: 'polygon',
          originalError: walletError
        }
      });
      logError(wrappedError);
      throw wrappedError;
    }

    // Generate a proof with this wallet
    let proof;
    try {
      proof = await generateTestProof({
        walletAddress: wallet.address,
        amount,
        proofType
      });
    } catch (proofError) {
      // This error is already logged by generateTestProof
      // Re-throw with context about the wallet generation step
      throw new ProofError('Failed to generate proof with test wallet', {
        code: proofError.code || ErrorCode.PROOF_GENERATION_FAILED,
        operationId,
        severity: ErrorSeverity.ERROR,
        recoverable: false,
        details: {
          wallet: wallet.address,
          amount,
          proofType,
          walletGenerationSucceeded: true,
          originalError: proofError
        }
      });
    }

    return {
      wallet,
      proof
    };
  } catch (error) {
    // If it's not already a handled error, wrap it
    if (!isZKError(error)) {
      error = new ZKTestError('Error generating test wallet and proof', {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        operationId,
        severity: ErrorSeverity.ERROR,
        recoverable: false,
        details: {
          params,
          originalError: error
        }
      });
    }
    
    // Log the error with context
    logError(error, {
      operation: 'generateTestWalletAndProof',
      params
    });
    
    console.error('Error generating test wallet and proof:', error.message);
    throw error;
  }
}

/**
 * Run a full verification test
 * @param {Object} params - Test parameters
 * @param {string} params.amount - Amount for verification
 * @param {number} params.proofType - Proof type from ZK_PROOF_TYPES
 * @returns {Promise<Object>} Test results
 */
export async function runVerificationTest(params) {
  const operationId = `run_verification_test_${Date.now()}`;
  
  try {
    // Validate inputs
    if (!params) {
      const inputError = new InputError('Missing parameters for verification test', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        severity: ErrorSeverity.ERROR,
        details: {
          providedParams: params
        }
      });
      logError(inputError);
      
      return {
        error: inputError.message,
        testPassed: false,
        errorDetails: inputError.toLogFormat()
      };
    }
    
    const { amount, proofType = ZK_PROOF_TYPES.STANDARD } = params;
    
    if (!amount) {
      const amountError = new InputError('Amount is required for verification test', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        severity: ErrorSeverity.ERROR,
        details: {
          providedAmount: amount,
          proofType
        }
      });
      logError(amountError);
      
      return {
        error: amountError.message,
        testPassed: false,
        errorDetails: amountError.toLogFormat()
      };
    }
    
    console.log('Starting verification test...');

    // Generate test wallet and proof
    let wallet, proof;
    try {
      ({ wallet, proof } = await generateTestWalletAndProof({
        amount,
        proofType
      }));
    } catch (genError) {
      // This error is already logged by generateTestWalletAndProof
      logError(genError, {
        operation: 'runVerificationTest.generateTestWalletAndProof',
        operationId: `${operationId}_generate_phase`
      });
      
      return {
        error: genError.message,
        testPassed: false,
        phase: 'generation',
        errorDetails: isZKError(genError) ? genError.toLogFormat() : genError
      };
    }

    // Verify the proof
    console.log('Verifying generated proof...');
    let isValid;
    try {
      isValid = await verifyZKProof({
        proof: proof.proof,
        publicSignals: proof.publicSignals,
        proofType
      });
    } catch (verifyError) {
      const wrappedError = new ZKTestError('Proof verification failed', {
        code: ErrorCode.VERIFICATION_FAILED,
        operationId: `${operationId}_verify_phase`,
        severity: ErrorSeverity.ERROR,
        recoverable: false,
        details: {
          wallet: wallet.address,
          amount,
          proofType,
          proofGenerated: true,
          originalError: verifyError
        }
      });
      
      logError(wrappedError);
      
      return {
        wallet,
        proof,
        error: wrappedError.message,
        testPassed: false,
        phase: 'verification',
        errorDetails: wrappedError.toLogFormat()
      };
    }

    console.log(`Proof verification result: ${isValid ? 'Valid' : 'Invalid'}`);

    // If verification failed but didn't throw an error, log it as a warning
    if (!isValid) {
      const invalidProofError = new ZKTestError('Proof verification returned invalid result', {
        code: ErrorCode.VERIFICATION_PROOF_INVALID, 
        operationId,
        severity: ErrorSeverity.WARNING,
        recoverable: true,
        details: {
          wallet: wallet.address,
          amount,
          proofType,
          proofGenerated: true,
          verificationResult: isValid
        }
      });
      
      logError(invalidProofError);
    }

    return {
      wallet,
      proof,
      isValid,
      testPassed: isValid === true
    };
  } catch (error) {
    // If it's not already a handled error, wrap it
    if (!isZKError(error)) {
      error = new ZKTestError('Unexpected error during verification test', {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        operationId,
        severity: ErrorSeverity.ERROR,
        recoverable: false,
        details: {
          params,
          originalError: error
        }
      });
    }
    
    // Log the error with context
    logError(error, {
      operation: 'runVerificationTest',
      params
    });
    
    console.error('Verification test failed:', error.message);
    
    return {
      error: error.message,
      testPassed: false,
      errorDetails: isZKError(error) ? error.toLogFormat() : error
    };
  }
}

/**
 * Run comprehensive tests for all proof types
 * @returns {Promise<Object>} Comprehensive test results
 */
export async function runAllTests() {
  const results = {
    standard: await runVerificationTest({
      amount: '1000000000000000000', // 1 ETH in wei
      proofType: ZK_PROOF_TYPES.STANDARD
    }),

    threshold: await runVerificationTest({
      amount: '5000000000000000000', // 5 ETH in wei
      proofType: ZK_PROOF_TYPES.THRESHOLD
    }),

    maximum: await runVerificationTest({
      amount: '10000000000000000000', // 10 ETH in wei
      proofType: ZK_PROOF_TYPES.MAXIMUM
    })
  };

  const allPassed =
    results.standard.testPassed &&
    results.threshold.testPassed &&
    results.maximum.testPassed;

  console.log(`All tests passed: ${allPassed}`);

  return {
    results,
    allPassed
  };
}

export default {
  generateTestProof,
  generateTestWalletAndProof,
  runVerificationTest,
  runAllTests
};