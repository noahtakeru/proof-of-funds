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

/**
 * Generate a test proof with the specified parameters
 * @param {Object} params - Test parameters
 * @param {string} params.walletAddress - Wallet address
 * @param {string} params.amount - Amount for verification
 * @param {number} params.proofType - Proof type from ZK_PROOF_TYPES
 * @returns {Promise<Object>} Generated test proof
 */
export async function generateTestProof(params) {
  const { walletAddress, amount, proofType = ZK_PROOF_TYPES.STANDARD } = params;

  try {
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
    console.error('Error generating test proof:', error);
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
  const { amount, proofType = ZK_PROOF_TYPES.STANDARD } = params;

  try {
    // Generate a temporary wallet
    console.log('Generating temporary test wallet...');
    const wallet = await generateTemporaryWallet({ chain: 'polygon' });
    console.log(`Test wallet generated: ${wallet.address}`);

    // Generate a proof with this wallet
    const proof = await generateTestProof({
      walletAddress: wallet.address,
      amount,
      proofType
    });

    return {
      wallet,
      proof
    };
  } catch (error) {
    console.error('Error generating test wallet and proof:', error);
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
  const { amount, proofType = ZK_PROOF_TYPES.STANDARD } = params;

  try {
    console.log('Starting verification test...');

    // Generate test wallet and proof
    const { wallet, proof } = await generateTestWalletAndProof({
      amount,
      proofType
    });

    // Verify the proof
    console.log('Verifying generated proof...');
    const isValid = await verifyZKProof({
      proof: proof.proof,
      publicSignals: proof.publicSignals,
      proofType
    });

    console.log(`Proof verification result: ${isValid ? 'Valid' : 'Invalid'}`);

    return {
      wallet,
      proof,
      isValid,
      testPassed: isValid === true
    };
  } catch (error) {
    console.error('Verification test failed:', error);
    return {
      error: error.message,
      testPassed: false
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