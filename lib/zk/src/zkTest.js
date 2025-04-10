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
  ErrorCategory, 
  ErrorSeverity,
  InputError, 
  SystemError, 
  ProofError,
  VerificationError,
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
        context: context.context || 'zkTest.js',
        ...context
      });
    } else {
      // Fallback to console if logger not available
      console.error(`[ZKTest] Error: ${error.message}`, context);
    }
  } catch (loggingError) {
    // Last resort if even logging fails
    console.error(`Failed to log error: ${loggingError.message}`);
    console.error(`Original error: ${error.message}`);
  }
};

/**
 * Error specialized for ZK testing operations
 * @extends Error
 */
class ZKTestError extends SystemError {
  /**
   * Create a new ZKTestError
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
        errorType: 'zk_test',
        operationId: context.operationId || `zk_test_${Date.now()}`
      }
    });
    
    this.name = 'ZKTestError';
    this.context = context;
    this.originalError = originalError;
  }
}

/**
 * Generate a test proof with the specified parameters
 * @param {Object} params - Test parameters
 * @param {string} params.walletAddress - Wallet address
 * @param {string} params.amount - Amount for verification
 * @param {number} params.proofType - Proof type from ZK_PROOF_TYPES
 * @returns {Promise<Object>} Generated test proof
 * @throws {InputError} When input parameters are invalid
 * @throws {ProofError} When proof generation fails
 */
export async function generateTestProof(params) {
  const operationId = `generate_test_proof_${Date.now()}`;
  
  try {
    // Validate input parameters
    if (!params || typeof params !== 'object') {
      const error = new InputError('Invalid parameters for test proof generation', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        details: { providedParams: params },
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Provide a valid parameters object'
      });
      
      await logError(error, { context: 'generateTestProof' });
      throw error;
    }
    
    const { walletAddress, amount, proofType = ZK_PROOF_TYPES.STANDARD } = params;
    
    // Validate wallet address
    if (!walletAddress || typeof walletAddress !== 'string') {
      const error = new InputError('Invalid wallet address for test proof', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        details: { 
          providedAddress: walletAddress, 
          expectedType: 'string' 
        },
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Provide a valid wallet address string'
      });
      
      await logError(error, { context: 'generateTestProof' });
      throw error;
    }
    
    // Validate amount
    if (!amount || (typeof amount !== 'string' && typeof amount !== 'number')) {
      const error = new InputError('Invalid amount for test proof', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        details: { 
          providedAmount: amount, 
          expectedType: 'string or number' 
        },
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Provide a valid amount as string or number'
      });
      
      await logError(error, { context: 'generateTestProof' });
      throw error;
    }
    
    // Validate proof type
    if (proofType !== undefined && !Object.values(ZK_PROOF_TYPES).includes(proofType)) {
      const error = new InputError('Invalid proof type for test proof', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        details: { 
          providedType: proofType, 
          validTypes: Object.values(ZK_PROOF_TYPES) 
        },
        recoverable: false,
        userFixable: true,
        recommendedAction: 'Use a valid proof type from ZK_PROOF_TYPES'
      });
      
      await logError(error, { context: 'generateTestProof' });
      throw error;
    }

    // Log operation start (debug level)
    zkErrorLogger.log('INFO', `Generating test proof for ${walletAddress}`, {
      operationId,
      details: { 
        walletAddress,
        amount,
        proofType,
        proofTypeName: Object.keys(ZK_PROOF_TYPES).find(key => ZK_PROOF_TYPES[key] === proofType)
      }
    });

    // Generate the proof
    try {
      const proof = await generateZKProof({
        walletAddress,
        amount,
        proofType
      });
      
      // Log success
      zkErrorLogger.log('INFO', 'Test proof generated successfully', {
        operationId,
        details: { 
          walletAddress,
          proofType,
          proofId: proof.id || 'unknown'
        }
      });
      
      return proof;
    } catch (error) {
      // Convert to ProofError if needed
      const proofError = isZKError(error) ? error : new ProofError(
        `Failed to generate test proof: ${error.message}`,
        {
          code: ErrorCode.PROOF_GENERATION_FAILED,
          operationId,
          recoverable: false,
          details: { 
            walletAddress,
            amount,
            proofType,
            originalError: error.message
          }
        },
        error
      );
      
      await logError(proofError, { 
        context: 'generateTestProof.proofGeneration',
        walletAddress 
      });
      
      throw proofError;
    }
  } catch (error) {
    // If it's already a ZKError, just log it and re-throw
    if (isZKError(error)) {
      await logError(error, { context: 'generateTestProof' });
      throw error;
    }
    
    // Convert generic errors to ZKTestError
    const zkError = new ZKTestError(
      `Unexpected error in test proof generation: ${error.message}`,
      {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        operationId,
        recoverable: false,
        details: { originalError: error.message }
      },
      error
    );
    
    await logError(zkError, { context: 'generateTestProof' });
    throw zkError;
  }
}

/**
 * Generate a temporary wallet and create a test proof with it
 * @param {Object} params - Test parameters
 * @param {string} params.amount - Amount for verification
 * @param {number} params.proofType - Proof type from ZK_PROOF_TYPES
 * @returns {Promise<Object>} Result with wallet and proof
 * @throws {InputError} When input parameters are invalid
 * @throws {SystemError} When wallet generation fails
 * @throws {ProofError} When proof generation fails
 */
export async function generateTestWalletAndProof(params) {
  const operationId = `generate_test_wallet_and_proof_${Date.now()}`;
  
  try {
    // Validate parameters
    if (!params || typeof params !== 'object') {
      const error = new InputError('Invalid parameters for test wallet and proof', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        details: { providedParams: params },
        recoverable: false,
        userFixable: true
      });
      
      await logError(error, { context: 'generateTestWalletAndProof' });
      throw error;
    }
    
    const { amount, proofType = ZK_PROOF_TYPES.STANDARD } = params;
    
    // Validate amount
    if (!amount || (typeof amount !== 'string' && typeof amount !== 'number')) {
      const error = new InputError('Invalid amount for test wallet and proof', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        details: { 
          providedAmount: amount, 
          expectedType: 'string or number' 
        },
        recoverable: false,
        userFixable: true
      });
      
      await logError(error, { context: 'generateTestWalletAndProof' });
      throw error;
    }
    
    // Validate proof type
    if (proofType !== undefined && !Object.values(ZK_PROOF_TYPES).includes(proofType)) {
      const error = new InputError('Invalid proof type for test wallet and proof', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        details: { 
          providedType: proofType, 
          validTypes: Object.values(ZK_PROOF_TYPES) 
        },
        recoverable: false,
        userFixable: true
      });
      
      await logError(error, { context: 'generateTestWalletAndProof' });
      throw error;
    }

    // Log operation start
    zkErrorLogger.log('INFO', 'Generating temporary test wallet and proof', {
      operationId,
      details: { 
        amount, 
        proofType,
        proofTypeName: Object.keys(ZK_PROOF_TYPES).find(key => ZK_PROOF_TYPES[key] === proofType)
      }
    });

    // Generate a temporary wallet
    let wallet;
    try {
      wallet = await generateTemporaryWallet({ chain: 'polygon' });
      
      zkErrorLogger.log('INFO', 'Test wallet generated', {
        operationId,
        details: { 
          address: wallet.address,
          chain: wallet.chain || 'polygon'
        }
      });
    } catch (error) {
      const walletError = isZKError(error) ? error : new SystemError(
        `Failed to generate temporary test wallet: ${error.message}`,
        {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId,
          recoverable: false,
          details: { originalError: error.message }
        },
        error
      );
      
      await logError(walletError, { context: 'generateTestWalletAndProof.walletGeneration' });
      throw walletError;
    }

    // Generate a proof with this wallet
    let proof;
    try {
      proof = await generateTestProof({
        walletAddress: wallet.address,
        amount,
        proofType
      });
    } catch (error) {
      // This is already a ZKError from generateTestProof, so just log and re-throw
      await logError(error, { 
        context: 'generateTestWalletAndProof.proofGeneration',
        walletAddress: wallet.address 
      });
      throw error;
    }

    // Success - return both wallet and proof
    return {
      wallet,
      proof
    };
  } catch (error) {
    // If it's already a ZKError, just log it and re-throw
    if (isZKError(error)) {
      await logError(error, { context: 'generateTestWalletAndProof' });
      throw error;
    }
    
    // Convert generic errors to ZKTestError
    const zkError = new ZKTestError(
      `Unexpected error in test wallet and proof generation: ${error.message}`,
      {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        operationId,
        recoverable: false,
        details: { originalError: error.message }
      },
      error
    );
    
    await logError(zkError, { context: 'generateTestWalletAndProof' });
    throw zkError;
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
    // Validate parameters
    if (!params || typeof params !== 'object') {
      const error = new InputError('Invalid parameters for verification test', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        details: { providedParams: params },
        recoverable: true, // Still return test result object
        userFixable: true
      });
      
      await logError(error, { context: 'runVerificationTest' });
      
      // Instead of throwing, return a failed test result
      return {
        error: error.message,
        testPassed: false,
        errorDetails: {
          code: error.code,
          operationId: operationId
        }
      };
    }
    
    const { amount, proofType = ZK_PROOF_TYPES.STANDARD } = params;
    
    // Log operation start
    zkErrorLogger.log('INFO', 'Starting verification test', {
      operationId,
      details: { 
        amount, 
        proofType,
        proofTypeName: Object.keys(ZK_PROOF_TYPES).find(key => ZK_PROOF_TYPES[key] === proofType)
      }
    });

    // Generate test wallet and proof
    let wallet, proof;
    try {
      const result = await generateTestWalletAndProof({
        amount,
        proofType
      });
      
      wallet = result.wallet;
      proof = result.proof;
    } catch (error) {
      // Log the error
      await logError(error, { 
        context: 'runVerificationTest.generateWalletAndProof',
        operationId
      });
      
      // Return a test failure result rather than throwing
      return {
        error: error.message,
        testPassed: false,
        errorDetails: {
          code: isZKError(error) ? error.code : 'UNKNOWN',
          operationId: isZKError(error) ? error.details?.operationId || operationId : operationId,
          phase: 'generation'
        }
      };
    }

    // Verify the proof
    let isValid;
    try {
      zkErrorLogger.log('INFO', 'Verifying generated proof', {
        operationId,
        details: {
          walletAddress: wallet.address,
          proofType
        }
      });
      
      isValid = await verifyZKProof({
        proof: proof.proof,
        publicSignals: proof.publicSignals,
        proofType
      });
      
      zkErrorLogger.log('INFO', `Proof verification result: ${isValid ? 'Valid' : 'Invalid'}`, {
        operationId,
        details: {
          walletAddress: wallet.address,
          proofType,
          result: isValid
        }
      });
    } catch (error) {
      // Log the verification error
      const verifyError = isZKError(error) ? error : new VerificationError(
        `Proof verification failed: ${error.message}`,
        {
          code: ErrorCode.VERIFICATION_FAILED,
          operationId,
          recoverable: true, // Still return test result
          details: { 
            walletAddress: wallet.address,
            proofType,
            originalError: error.message
          }
        },
        error
      );
      
      await logError(verifyError, { 
        context: 'runVerificationTest.verifyProof',
        walletAddress: wallet.address
      });
      
      // Return a test failure result
      return {
        wallet,
        proof,
        error: verifyError.message,
        testPassed: false,
        errorDetails: {
          code: verifyError.code,
          operationId: operationId,
          phase: 'verification'
        }
      };
    }

    // Return complete test results
    return {
      wallet,
      proof,
      isValid,
      testPassed: isValid === true,
      operationId
    };
  } catch (error) {
    // This should only catch truly unexpected errors
    // Log the error
    const zkError = isZKError(error) ? error : new ZKTestError(
      `Unexpected error in verification test: ${error.message}`,
      {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        operationId,
        recoverable: true,
        details: { originalError: error.message }
      },
      error
    );
    
    await logError(zkError, { context: 'runVerificationTest' });
    
    // Return error result
    return {
      error: zkError.message,
      testPassed: false,
      errorDetails: {
        code: zkError.code,
        operationId: zkError.details?.operationId || operationId,
        phase: 'unexpected'
      }
    };
  }
}

/**
 * Run comprehensive tests for all proof types
 * @returns {Promise<Object>} Comprehensive test results
 */
export async function runAllTests() {
  const operationId = `run_all_tests_${Date.now()}`;
  
  try {
    zkErrorLogger.log('INFO', 'Running comprehensive tests for all proof types', {
      operationId
    });
    
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

    zkErrorLogger.log(allPassed ? 'INFO' : 'WARNING', `All tests passed: ${allPassed}`, {
      operationId,
      details: { 
        standardPassed: results.standard.testPassed,
        thresholdPassed: results.threshold.testPassed,
        maximumPassed: results.maximum.testPassed
      }
    });

    return {
      results,
      allPassed,
      operationId
    };
  } catch (error) {
    // This should only catch truly unexpected errors
    // Log the error
    const zkError = isZKError(error) ? error : new ZKTestError(
      `Unexpected error running all tests: ${error.message}`,
      {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        operationId,
        recoverable: false,
        details: { originalError: error.message }
      },
      error
    );
    
    await logError(zkError, { context: 'runAllTests' });
    
    // Return a failure result
    return {
      error: zkError.message,
      allPassed: false,
      operationId
    };
  }
}

export default {
  generateTestProof,
  generateTestWalletAndProof,
  runVerificationTest,
  runAllTests
};