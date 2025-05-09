/**
 * SnarkJS Loader module
 * 
 * This module provides utilities for dynamically loading and initializing snarkjs
 * for Zero-Knowledge proof generation and verification.
 */

// Flag to track initialization status
let initialized = false;
let snarkjs = null;

/**
 * Dynamically load and initialize snarkjs
 * @param {Object} options - Initialization options
 * @param {boolean} options.serverSide - Whether to initialize for server-side use
 * @param {number} options.maxRetries - Maximum number of retries for initialization
 * @returns {Promise<boolean>} Whether initialization was successful
 */
async function initialize(options = {}) {
  const serverSide = options.serverSide || false;
  const maxRetries = options.maxRetries || 3;
  
  if (initialized && snarkjs) {
    return true;
  }

  let retries = 0;
  while (retries < maxRetries) {
    try {
      // Attempt to load the actual snarkjs library
      if (serverSide) {
        try {
          // Server-side loading with require
          snarkjs = require('snarkjs');
        } catch (requireError) {
          throw new Error(`Failed to load snarkjs with require: ${requireError.message}`);
        }
      } else {
        try {
          // Client-side loading with dynamic import
          snarkjs = await import('snarkjs');
        } catch (importError) {
          throw new Error(`Failed to load snarkjs with dynamic import: ${importError.message}`);
        }
      }
      
      // Verify the loaded library has the expected methods
      if (!snarkjs || !snarkjs.groth16 || typeof snarkjs.groth16.fullProve !== 'function') {
        throw new Error('Loaded snarkjs does not contain expected methods (groth16.fullProve)');
      }
      if (!snarkjs.groth16.verify || typeof snarkjs.groth16.verify !== 'function') {
        throw new Error('Loaded snarkjs does not contain expected methods (groth16.verify)');
      }
      
      initialized = true;
      console.log('snarkjs loaded successfully');
      return true;
    } catch (error) {
      console.error(`Error initializing snarkjs (attempt ${retries + 1}/${maxRetries}):`, error);
      retries++;
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  const error = new Error(`Failed to initialize snarkjs after ${maxRetries} attempts`);
  console.error(error);
  throw error;
}

/**
 * Check if snarkjs is initialized
 * @returns {boolean} Whether snarkjs is initialized
 */
function isInitialized() {
  return initialized && snarkjs !== null;
}

/**
 * Get the initialized snarkjs instance
 * @returns {Object} The snarkjs instance
 * @throws {Error} If snarkjs is not initialized
 */
function getSnarkjs() {
  if (!initialized || !snarkjs) {
    throw new Error('snarkjs not initialized. Call initialize() first.');
  }
  return snarkjs;
}

/**
 * Generate a full ZK proof
 * @param {Object} input - The input to the circuit
 * @param {string} wasmPath - Path to the circuit WASM file
 * @param {string} zkeyPath - Path to the proving key
 * @param {Object} options - Additional options for proof generation
 * @returns {Promise<Object>} The generated proof
 * @throws {Error} If snarkjs is not initialized or if proof generation fails
 */
async function fullProve(input, wasmPath, zkeyPath, options = {}) {
  if (!initialized || !snarkjs) {
    throw new Error('snarkjs not initialized. Call initialize() first.');
  }
  
  if (!input) {
    throw new Error('Missing required parameter: input');
  }
  
  if (!wasmPath) {
    throw new Error('Missing required parameter: wasmPath');
  }
  
  if (!zkeyPath) {
    throw new Error('Missing required parameter: zkeyPath');
  }
  
  try {
    // Verify files exist if we're in a Node.js environment
    if (typeof window === 'undefined' && typeof require !== 'undefined') {
      const fs = require('fs');
      if (!fs.existsSync(wasmPath)) {
        throw new Error(`WASM file not found: ${wasmPath}`);
      }
      if (!fs.existsSync(zkeyPath)) {
        throw new Error(`zkey file not found: ${zkeyPath}`);
      }
    }
    
    // Call the actual snarkjs fullProve method
    const result = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath, options);
    
    if (!result || !result.proof || !result.publicSignals) {
      throw new Error('Proof generation did not return expected results');
    }
    
    return result;
  } catch (error) {
    const enhancedError = new Error(`Failed to generate proof: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.input = input;
    enhancedError.wasmPath = wasmPath;
    enhancedError.zkeyPath = zkeyPath;
    throw enhancedError;
  }
}

/**
 * Verify a ZK proof
 * @param {Object} verificationKey - The verification key
 * @param {Array} publicSignals - The public signals
 * @param {Object} proof - The proof to verify
 * @returns {Promise<boolean>} Whether the proof is valid
 * @throws {Error} If snarkjs is not initialized or if verification fails
 */
async function verify(verificationKey, publicSignals, proof) {
  if (!initialized || !snarkjs) {
    throw new Error('snarkjs not initialized. Call initialize() first.');
  }
  
  if (!verificationKey) {
    throw new Error('Missing required parameter: verificationKey');
  }
  
  if (!publicSignals) {
    throw new Error('Missing required parameter: publicSignals');
  }
  
  if (!proof) {
    throw new Error('Missing required parameter: proof');
  }
  
  try {
    // Call the actual snarkjs verify method
    const result = await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
    return result;
  } catch (error) {
    const enhancedError = new Error(`Failed to verify proof: ${error.message}`);
    enhancedError.originalError = error;
    throw enhancedError;
  }
}

// For backward compatibility
async function load() {
  if (!initialized) {
    await initialize({ serverSide: typeof window === 'undefined' });
  }
  return getSnarkjs();
}

export const snarkjsLoader = {
  initialize,
  isInitialized,
  getSnarkjs,
  fullProve,
  verify,
  load
};