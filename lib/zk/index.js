/**
 * Zero-Knowledge Proof Library
 * 
 * This is the main entry point for the Zero-Knowledge Proof of Funds system.
 * It exports all ZK-related functionality from various modules to provide 
 * a clean, unified API for the application.
 * 
 * Key features:
 * - ZK Proof generation using Circom circuits
 * - Proof verification (both client-side and on-chain)
 * - Secure proof encryption and access control
 * - Reference ID generation and management for proof sharing
 * - Temporary wallet management for secure proof generation
 * 
 * Usage example:
 * ```
 * import { generateZKProof, createProofPackage } from './lib/zk';
 * 
 * // Generate a ZK proof
 * const proof = await generateZKProof(walletAddress, balance, threshold, proofType, network);
 * 
 * // Create a shareable package
 * const package = await createProofPackage(proof, walletAddress, amount, proofType, expiryTime);
 * ```
 */

// Import modules
import * as zkProofGenerator from './zkProofGenerator';
import * as zkProofVerifier from './zkProofVerifier';
import * as tempWalletManager from './tempWalletManager';
import * as proofEncryption from './proofEncryption';
import * as referenceId from './referenceId';
import * as referenceStore from './referenceStore';

// Export all modules
export {
  zkProofGenerator,
  zkProofVerifier,
  tempWalletManager,
  proofEncryption,
  referenceId,
  referenceStore
};

// Export specific functions for direct imports
export const {
  generateZKProof,
  encryptProof,
  decryptProof,
  generateProofReferenceId,
  convertBalanceToUSD,
  verifyProofLocally,
  serializeProof,
  deserializeProof,
  createProofPackage,
  createTemporaryWallet
} = zkProofGenerator;

export const {
  verifyProofWithKey,
  verifyProofLocally: verifyProofLocallyFn,
  verifyProofOnChain
} = zkProofVerifier;

export const {
  generateMasterSeed,
  createSecureWalletForProof,
  createAndFundWallet,
  getTemporaryWalletsWithBalances,
  fundTemporaryWallet,
  recycleUnusedWallets,
  getTemporaryWalletByPurpose,
  signWithTemporaryWallet,
  getAllTemporaryWallets,
  deriveTemporaryWallet,
  cleanupOldTemporaryWallets
} = tempWalletManager;

export const {
  generateAccessKey,
  encryptProof: encryptProofWithAES,
  decryptProof: decryptProofWithAES,
  hashAccessKey,
  verifyAccessKey
} = proofEncryption;

export const {
  generateReferenceId,
  formatReferenceId,
  validateReferenceId,
  parseReferenceId,
  referenceIdExists
} = referenceId;

export const {
  storeReferenceId,
  getReference,
  listReferences,
  deleteReference
} = referenceStore;