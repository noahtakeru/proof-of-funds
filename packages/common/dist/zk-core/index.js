/**
 * Zero-Knowledge Proof Core Functionality
 * 
 * This module exports the core ZK utility functions from zkUtils.mjs.
 * 
 * @module zk-core
 */

// Initialize logger first to ensure it's available for all operations
import { safeLogger } from '../error-handling/initializeErrorLogger.js';
import { initializeErrorLogger } from '../error-handling/zkErrorHandler.mjs';

// Initialize error handler with our safe logger
try {
  initializeErrorLogger(safeLogger);
} catch (error) {
  console.warn('Error initializing ZK error handler:', error);
  // Continue anyway - fallbacks will be used
}

// Import the actual implementations from zkUtils.mjs
import zkUtilsModule from './zkUtils.mjs';

// Re-export the constants
export const ZK_PROOF_TYPES = {
  STANDARD: 0,
  THRESHOLD: 1,
  MAXIMUM: 2
};

// Re-export the SNARK field size constant
export const SNARK_FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// Re-export the core ZK functions from zkUtils.mjs
export const generateZKProof = zkUtilsModule.generateZKProof;
export const verifyZKProof = zkUtilsModule.verifyZKProof;
export const serializeZKProof = zkUtilsModule.serializeZKProof;
export const deserializeZKProof = zkUtilsModule.deserializeZKProof;

// Export other useful functions
export const generateZKProofHash = zkUtilsModule.generateZKProofHash;
export const getVerificationKey = zkUtilsModule.getVerificationKey;
export const stringifyBigInts = zkUtilsModule.stringifyBigInts;
export const parseBigInts = zkUtilsModule.parseBigInts;

// Function to get the logger
export function getErrorLogger() {
  return safeLogger;
}