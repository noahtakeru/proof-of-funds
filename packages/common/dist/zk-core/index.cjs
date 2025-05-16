/**
 * Zero-Knowledge Proof Core Functionality
 * 
 * This module exports the core ZK utility functions from zkUtils.mjs.
 * 
 * @module zk-core
 */

// Initialize logger first to ensure it's available for all operations
const { safeLogger } = require('../error-handling/initializeErrorLogger.js');
const { initializeErrorLogger } = require('../error-handling/zkErrorHandler.mjs');

// Initialize error handler with our safe logger
try {
  initializeErrorLogger(safeLogger);
} catch (error) {
  console.warn('Error initializing ZK error handler:', error);
  // Continue anyway - fallbacks will be used
}

// Import the actual implementations from zkUtils.mjs
const zkUtilsModule = require('./zkUtils.mjs');

// Re-export the constants
const ZK_PROOF_TYPES = exports.ZK_PROOF_TYPES = {
  STANDARD: 0,
  THRESHOLD: 1,
  MAXIMUM: 2
};

// Re-export the SNARK field size constant
const SNARK_FIELD_SIZE = exports.SNARK_FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// Re-export the core ZK functions from zkUtils.mjs
const generateZKProof = exports.generateZKProof = zkUtilsModule.generateZKProof;
const verifyZKProof = exports.verifyZKProof = zkUtilsModule.verifyZKProof;
const serializeZKProof = exports.serializeZKProof = zkUtilsModule.serializeZKProof;
const deserializeZKProof = exports.deserializeZKProof = zkUtilsModule.deserializeZKProof;

// Export other useful functions
const generateZKProofHash = exports.generateZKProofHash = zkUtilsModule.generateZKProofHash;
const getVerificationKey = exports.getVerificationKey = zkUtilsModule.getVerificationKey;
const stringifyBigInts = exports.stringifyBigInts = zkUtilsModule.stringifyBigInts;
const parseBigInts = exports.parseBigInts = zkUtilsModule.parseBigInts;

// Function to get the logger
export function getErrorLogger() {
  return safeLogger;
}