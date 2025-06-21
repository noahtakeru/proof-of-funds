/**
 * ZK Core Module
 *
 * This is the main entry point for ZK functionality.
 * It exports all the necessary components for ZK operations.
 */
// Re-export the snarkjs wrapper
export { default as snarkjs } from './snarkjsWrapper';
// Export individual functions from the wrapper for easier access
export { fullProve, verify, getFileConstants, FILE_CONSTANTS } from './snarkjsWrapper';
// Export ZK utilities (excluding generateZKProof to avoid conflict with zk/index.js wrapper)
export { verifyZKProof, serializeZKProof, deserializeZKProof, generateZKProofHash, getVerificationKey, stringifyBigInts, parseBigInts, SNARK_FIELD_SIZE } from './zkUtils.mjs';
// Export generateZKProof under a different name for internal use
export { generateZKProof as generateZKProofCore } from './zkUtils.mjs';
// Export error handling
export { getErrorLogger } from '../error-handling/index.js';
