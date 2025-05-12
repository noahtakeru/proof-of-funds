/**
 * ZK Module
 * 
 * Exports Zero-Knowledge proof functionality by re-exporting from zk-core
 */

// Import all ZK core functions and types from zk-core
const {
  ZK_PROOF_TYPES,
  generateZKProof,
  verifyZKProof,
  serializeZKProof,
  deserializeZKProof,
  generateZKProofHash,
  getVerificationKey,
  stringifyBigInts,
  parseBigInts,
  SNARK_FIELD_SIZE
} = require('../zk-core/index.js');

// Re-export all ZK functions and types
module.exports = {
  ZK_PROOF_TYPES,
  generateZKProof,
  verifyZKProof,
  serializeZKProof,
  deserializeZKProof,
  generateZKProofHash,
  getVerificationKey,
  stringifyBigInts,
  parseBigInts,
  SNARK_FIELD_SIZE
};

// Export default object for compatibility with both named and default imports
const zkApi = {
  ZK_PROOF_TYPES,
  generateZKProof,
  verifyZKProof,
  serializeZKProof,
  deserializeZKProof,
  generateZKProofHash,
  getVerificationKey,
  stringifyBigInts,
  parseBigInts,
  SNARK_FIELD_SIZE
};

module.exports = zkApi;