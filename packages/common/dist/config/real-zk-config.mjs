/**
 * Configuration for real ZK implementation (ESM Version)
 * This file provides the correct paths for the real ZK implementation
 */
// Circuit paths configuration
export const circuitPaths = {
    // Base path for all ZK build artifacts
    basePath: 'lib/zk/build',
    // Path to WebAssembly files
    wasmPath: (circuitName) => `lib/zk/build/${circuitName}_js/${circuitName}.wasm`,
    // Path to zkey files
    zkeyPath: (circuitName) => `lib/zk/build/zkey/${circuitName}.zkey`,
    // Path to verification key files
    vkeyPath: (circuitName) => `lib/zk/build/verification_key/${circuitName}.json`,
};
// Circuit names
export const circuitNames = {
    standard: 'standardProof',
    threshold: 'thresholdProof',
    maximum: 'maximumProof'
};
// Proof types mapping
export const proofTypes = {
    0: 'standardProof',
    1: 'thresholdProof',
    2: 'maximumProof'
};
// Default export for compatibility
export default {
    circuitPaths,
    circuitNames,
    proofTypes
};
