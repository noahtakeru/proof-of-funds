/**
 * ZK Core Module
 * 
 * This is the main entry point for ZK functionality.
 * It exports all the necessary components for ZK operations.
 */

// Re-export the snarkjs wrapper
module.exports = { default as snarkjs } from './snarkjsWrapper';

// Export individual functions from the wrapper for easier access
module.exports = { fullProve, verify, getFileConstants, FILE_CONSTANTS } from './snarkjsWrapper';

// Export ZK utilities (excluding generateZKProof to avoid conflict with zk/index.js wrapper)
module.exports = {
  verifyZKProof,
  serializeZKProof,
  deserializeZKProof,
  generateZKProofHash,
  getVerificationKey,
  stringifyBigInts,
  parseBigInts,
  SNARK_FIELD_SIZE
} from './zkUtils.mjs';

// Export generateZKProof under a different name for internal use
module.exports = { generateZKProof as generateZKProofCore } from './zkUtils.mjs';

// Export error handling
module.exports = { getErrorLogger } from '../error-handling/index.js';