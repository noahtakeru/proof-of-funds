/**
 * Real ZK Config
 * 
 * Configuration for the Zero-Knowledge proofs, including circuit paths and proof types.
 */

// Proof types mapping
const proofTypes = {
  0: 'standardProof',   // Standard proof of funds
  1: 'thresholdProof',  // Threshold proof (balance above a threshold)
  2: 'maximumProof'     // Maximum proof (balance below a maximum)
};

// Base paths for circuit files
const basePath = 'public/zk';

// Circuit paths configuration
const circuitPaths = {
  wasmPath: (circuitName) => `${basePath}/${circuitName}/${circuitName}.wasm`,
  zkeyPath: (circuitName) => `${basePath}/${circuitName}/${circuitName}.zkey`,
  vkeyPath: (circuitName) => `${basePath}/${circuitName}/${circuitName}_verification_key.json`
};

// Development mode setting
const devMode = process.env.NODE_ENV !== 'production';

// Configuration for different environments
const config = {
  // Circuit paths
  circuitPaths,
  
  // Proof types
  proofTypes,
  
  // Development mode flag
  devMode,
  
  // Server-side proof generation endpoint
  serverProveEndpoint: '/api/zk/fullProve',
  
  // Server-side proof verification endpoint
  serverVerifyEndpoint: '/api/zk/verify',
  
  // Verification key endpoint
  verificationKeyEndpoint: '/api/zk/verificationKey',
  
  // Max proof size in bytes
  maxProofSize: 10 * 1024, // 10KB
  
  // Timeout for proof generation (in milliseconds)
  proofTimeout: 60000, // 60 seconds
  
  // Rate limiting configuration
  rateLimiting: {
    enabled: true,
    maxRequestsPerMinute: 10,
    maxRequestsPerHour: 100
  }
};

export default config;