/**
 * ZK Proof Library Index
 * 
 * Exports all ZK-related functionality from a centralized entry point.
 */

// Import modules
import * as zkProofGenerator from './zkProofGenerator';
import * as zkProofVerifier from './zkProofVerifier';
import * as tempWalletManager from './tempWalletManager';
import * as proofEncryption from './proofEncryption';

// Export all modules
export {
  zkProofGenerator,
  zkProofVerifier,
  tempWalletManager,
  proofEncryption
};

// Export specific functions for direct imports
export const {
  generateZKProof,
  encryptProof,
  decryptProof,
  generateProofReferenceId,
  convertBalanceToUSD,
  verifyProofLocally
} = zkProofGenerator;

export const {
  verifyProofOnChain,
  isProofExpired,
  isProofRevoked,
  formatVerificationResult
} = zkProofVerifier;

export const {
  generateMasterSeed,
  createTemporaryWalletForPurpose,
  getTemporaryWalletByPurpose,
  archiveTemporaryWallet,
  getAllTemporaryWallets,
  deriveTemporaryWallet,
  cleanupOldTemporaryWallets
} = tempWalletManager;

export const {
  generateAccessKey,
  createProofSharingPackage,
  validateProofPackage
} = proofEncryption;