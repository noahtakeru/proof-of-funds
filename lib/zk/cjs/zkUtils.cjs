/**
 * Real Zero-Knowledge Proof Utility Functions (CommonJS version)
 * 
 * This file is the CommonJS version of zkUtils.js, providing the same functionality
 * but using CommonJS module format for compatibility with require() statements.
 */

// CommonJS equivalent implementations of the functions in zkUtils.js

/**
 * Stringifies a BigInt value for JSON compatibility
 * @param {any} obj - Object that may contain BigInt values
 * @returns {any} Object with BigInt values converted to strings
 */
const stringifyBigInts = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    return obj.map(stringifyBigInts);
  }

  if (typeof obj === 'object') {
    const result = {};
    for (const key in obj) {
      result[key] = stringifyBigInts(obj[key]);
    }
    return result;
  }

  return obj;
};

/**
 * Serializes a ZK proof for transmission or storage
 * @param {Object} proof - The ZK proof object
 * @param {Array} publicSignals - Public signals array
 * @returns {Object} Serialized proof with stringified components
 */
const serializeZKProof = (proof, publicSignals) => {
  return {
    proof: JSON.stringify(proof),
    publicSignals: Array.isArray(publicSignals) ? publicSignals.map(s => s.toString()) : publicSignals
  };
};

/**
 * Deserializes a ZK proof from its string format
 * @param {Object} serializedProof - The serialized proof object
 * @param {Array} serializedPublicSignals - Serialized public signals array
 * @returns {Object} The deserialized proof and signals
 */
const deserializeZKProof = (proofStr, publicSignalsStr) => {
  return {
    proof: typeof proofStr === 'string' ? JSON.parse(proofStr) : proofStr,
    publicSignals: Array.isArray(publicSignalsStr) ? publicSignalsStr : JSON.parse(publicSignalsStr)
  };
};

/**
 * Generates a hash of a ZK proof for verification purposes
 * @param {Object} proof - The ZK proof object
 * @param {Array} publicSignals - Public signals array
 * @returns {string} Hex-encoded hash of the proof
 */
const generateZKProofHash = (proof, publicSignals) => {
  const serialized = JSON.stringify({proof, publicSignals});
  const crypto = require('crypto');
  return "0x" + crypto.createHash('sha256').update(serialized).digest('hex');
};

// CommonJS exports
module.exports = {
  stringifyBigInts,
  serializeZKProof,
  deserializeZKProof,
  generateZKProofHash
};
