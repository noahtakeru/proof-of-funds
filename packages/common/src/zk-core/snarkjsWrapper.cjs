/**
 * SnarkJS Browser-Compatible Wrapper (CommonJS version)
 * 
 * This module provides a wrapper around snarkjs that works in both browser
 * and Node.js environments, handling the differences in module imports and
 * file system access.
 */

// Constants for file system operations - needed for browser compatibility
const FILE_CONSTANTS = {
  O_TRUNC: 512,  // Value from fs.constants.O_TRUNC
  O_CREAT: 64,   // Value from fs.constants.O_CREAT
  O_RDWR: 2,     // Value from fs.constants.O_RDWR
  O_EXCL: 128,   // Value from fs.constants.O_EXCL
  O_RDONLY: 0    // Value from fs.constants.O_RDONLY
};

// In CommonJS, we need to handle the dynamic import differently
async function loadSnarkJS() {
  try {
    // For CommonJS environments
    if (typeof require !== 'undefined') {
      return require('snarkjs');
    }
    
    // For ES Module environments (browser or Node.js ESM)
    const snarkjs = await import('snarkjs');
    return snarkjs;
  } catch (error) {
    console.error('Error loading snarkjs:', error);
    throw new Error(`Failed to load snarkjs: ${error.message}`);
  }
}

/**
 * Wrapper for snarkjs.groth16.fullProve that works in both browser and Node.js
 * @param {Object} input - The input to the circuit
 * @param {string} wasmPath - Path to the WebAssembly file
 * @param {string} zkeyPath - Path to the zkey file
 * @returns {Promise<Object>} - The proof and public signals
 */
async function fullProve(input, wasmPath, zkeyPath) {
  const snarkjs = await loadSnarkJS();
  
  try {
    // Call the actual snarkjs function
    return await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
  } catch (error) {
    // Enhance error with detailed information
    const enhancedError = new Error(`ZK proof generation failed: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.input = input;
    enhancedError.wasmPath = wasmPath;
    enhancedError.zkeyPath = zkeyPath;
    throw enhancedError;
  }
}

/**
 * Wrapper for snarkjs.groth16.verify that works in both browser and Node.js
 * @param {Object} vkeyJson - The verification key
 * @param {Array} publicSignals - The public signals
 * @param {Object} proof - The proof to verify
 * @returns {Promise<boolean>} - Whether the proof is valid
 */
async function verify(vkeyJson, publicSignals, proof) {
  const snarkjs = await loadSnarkJS();
  
  try {
    // Call the actual snarkjs function
    return await snarkjs.groth16.verify(vkeyJson, publicSignals, proof);
  } catch (error) {
    // Enhance error with detailed information
    const enhancedError = new Error(`ZK proof verification failed: ${error.message}`);
    enhancedError.originalError = error;
    throw enhancedError;
  }
}

/**
 * Get file system constants needed for browser compatibility
 * @returns {Object} - File system constants
 */
function getFileConstants() {
  return FILE_CONSTANTS;
}

// Export using CommonJS module.exports
module.exports = {
  groth16: {
    fullProve,
    verify
  },
  getFileConstants,
  fullProve,
  verify,
  FILE_CONSTANTS
};