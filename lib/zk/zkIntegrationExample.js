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
 */

import { ZK_PROOF_TYPES } from '../../config/constants';
import { generateZKProof, verifyZKProof } from './zkUtils';
import { generateTemporaryWallet, getBIP44Path } from '../walletHelpers';

// ------------------------------------------------------------------------------------------
// Example 1: Generate a ZK proof from user wallet data (for pages/create.js)
// ------------------------------------------------------------------------------------------

/**
 * Example of how to generate a ZK proof from user data in the create.js page
 * @param {Object} userData Data from the form
 * @returns {Promise<Object>} Generated proof and submission result
 */
export async function generateProofExample(userData) {
  // Sample user data from the form
  const {
    walletAddress, // Connected user wallet address
    amount,        // Amount to verify (in ETH/MATIC/etc.)
    proofType,     // Standard, threshold, or maximum
    expiryTime     // Expiry time in seconds
  } = userData;
  
  console.log(`Creating ZK proof for wallet ${walletAddress} with amount ${amount}`);
  
  try {
    // 1. Convert amount to wei if needed
    const amountInWei = ethers.utils.parseEther(amount).toString();
    
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
    }
    
    // 3. Generate the ZK proof
    const zkProof = await generateZKProof({
      walletAddress,
      amount: amountInWei,
      proofType: zkProofType
    });
    
    console.log('ZK proof generated successfully');
    
    // 4. Generate a temporary wallet for submitting the proof to the blockchain
    const tempWallet = await generateTemporaryWallet({
      chain: 'polygon'
    });
    
    console.log(`Generated temporary wallet: ${tempWallet.address}`);
    
    // 5. In production, you would now:
    // a. Fund the temporary wallet with a small amount of MATIC
    // b. Submit the proof to the blockchain using the temporary wallet
    // c. Store the proof details for later verification
    
    // 6. Return the proof and submission details
    return {
      proof: zkProof,
      tempWallet: {
        address: tempWallet.address,
        path: tempWallet.path
      },
      success: true,
      message: 'Proof generated and ready for submission'
    };
  } catch (error) {
    console.error('Error generating proof:', error);
    return {
      success: false,
      message: `Error generating proof: ${error.message}`
    };
  }
}

// ------------------------------------------------------------------------------------------
// Example 2: Verify a ZK proof (for pages/verify.js)
// ------------------------------------------------------------------------------------------

/**
 * Example of how to verify a ZK proof in the verify.js page
 * @param {Object} verificationData Data about the proof to verify
 * @returns {Promise<Object>} Verification result
 */
export async function verifyProofExample(verificationData) {
  // Sample verification data
  const {
    walletAddress,  // Address that created the proof
    proofType,      // Type of proof (standard, threshold, maximum)
    proof,          // Serialized proof data
    publicSignals,  // Public signals from the proof
    amount          // Amount being verified (in ETH/MATIC/etc.)
  } = verificationData;
  
  console.log(`Verifying ZK proof for wallet ${walletAddress}`);
  
  try {
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
    }
    
    // 2. Verify the ZK proof
    const isValid = await verifyZKProof({
      proof,
      publicSignals,
      proofType: zkProofType
    });
    
    // 3. Return the verification result
    if (isValid) {
      console.log('Proof verification successful!');
      return {
        isValid: true,
        message: 'The proof is valid',
        details: {
          walletAddress,
          amount,
          proofType: proofType,
          verifiedAt: new Date().toISOString()
        }
      };
    } else {
      console.log('Proof verification failed');
      return {
        isValid: false,
        message: 'The proof is invalid'
      };
    }
  } catch (error) {
    console.error('Error verifying proof:', error);
    return {
      isValid: false,
      message: `Error verifying proof: ${error.message}`
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
  `
};

export default {
  generateProofExample,
  verifyProofExample,
  integrationGuide
};