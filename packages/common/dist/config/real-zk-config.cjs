/**
 * Bridge file for real-zk-config
 * This provides a minimal configuration to break circular dependencies.
 */

// Configuration for circuit file paths
const zkConfig = {
  circuitPaths: {
    standard: {
      wasm: '/lib/zk/circuits/standardProof.wasm',
      zkey: '/lib/zk/circuits/standardProof.zkey',
      vkey: '/lib/zk/circuits/standardProof.vkey.json'
    },
    threshold: {
      wasm: '/lib/zk/circuits/thresholdProof.wasm',
      zkey: '/lib/zk/circuits/thresholdProof.zkey',
      vkey: '/lib/zk/circuits/thresholdProof.vkey.json'
    },
    maximum: {
      wasm: '/lib/zk/circuits/maximumProof.wasm',
      zkey: '/lib/zk/circuits/maximumProof.zkey',
      vkey: '/lib/zk/circuits/maximumProof.vkey.json'
    }
  },
  
  // Constants for proof generation
  constants: {
    memoryLimits: {
      standard: 1024 * 1024 * 1024, // 1GB
      threshold: 1536 * 1024 * 1024, // 1.5GB
      maximum: 2048 * 1024 * 1024 // 2GB
    },
    fieldSize: BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617')
  },
  
  // Verification settings
  verification: {
    serverEndpoint: '/api/zk/verify',
    clientSideVerification: true,
    cacheResults: true
  }
};

module.exports = zkConfig;