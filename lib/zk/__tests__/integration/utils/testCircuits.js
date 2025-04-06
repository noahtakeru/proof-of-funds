/**
 * Utilities for working with test circuits
 * 
 * This module provides helper functions for loading and working with
 * real ZK circuits during integration testing.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ZK_ROOT = path.join(__dirname, '../../..');
const CIRCUIT_DIR = path.join(ZK_ROOT, 'circuits');
const BUILD_DIR = path.join(ZK_ROOT, 'build');

/**
 * Get the path to circuit artifacts
 * @param {string} circuitType - The type of circuit (standard, threshold, maximum)
 * @returns {Object} Object with paths to circuit artifacts
 */
export function getCircuitPath(circuitType) {
  return {
    sourcePath: path.join(CIRCUIT_DIR, `${circuitType}Proof.circom`),
    wasmPath: path.join(BUILD_DIR, `${circuitType}/${circuitType}Proof.wasm`),
    zkeyPath: path.join(BUILD_DIR, `${circuitType}/${circuitType}Proof.zkey`),
    vkeyPath: path.join(BUILD_DIR, `${circuitType}/verification_key.json`)
  };
}

/**
 * Check if a circuit is available for testing
 * @param {string} circuitType - The type of circuit (standard, threshold, maximum)
 * @returns {boolean} Whether the circuit is available
 */
export function isCircuitAvailable(circuitType) {
  const paths = getCircuitPath(circuitType);
  
  try {
    return (
      fs.existsSync(paths.wasmPath) &&
      fs.existsSync(paths.zkeyPath) &&
      fs.existsSync(paths.vkeyPath)
    );
  } catch (error) {
    console.warn(`Error checking circuit availability: ${error.message}`);
    return false;
  }
}

/**
 * Load a circuit for testing
 * @param {string} circuitType - The type of circuit (standard, threshold, maximum)
 * @returns {Object} The loaded circuit or null if not available
 */
export async function loadCircuit(circuitType) {
  if (!isCircuitAvailable(circuitType)) {
    console.warn(`Circuit artifacts not available for ${circuitType}`);
    return null;
  }
  
  const paths = getCircuitPath(circuitType);
  
  try {
    // Load verification key
    const vkeyJson = fs.readFileSync(paths.vkeyPath, 'utf-8');
    const vkey = JSON.parse(vkeyJson);
    
    // Import snarkjs
    const snarkjs = await import('snarkjs');
    
    return {
      type: circuitType,
      paths,
      vkey,
      snarkjs
    };
  } catch (error) {
    console.error(`Error loading circuit: ${error.message}`);
    return null;
  }
}

/**
 * Generate a proof using a real circuit
 * @param {Object} input - The circuit input
 * @param {string} circuitType - The type of circuit
 * @returns {Object} The generated proof
 */
export async function generateProof(input, circuitType) {
  const circuit = await loadCircuit(circuitType);
  if (!circuit) {
    throw new Error(`Circuit not available: ${circuitType}`);
  }
  
  // Generate proof using real snarkjs
  return await circuit.snarkjs.groth16.fullProve(
    input, 
    circuit.paths.wasmPath, 
    circuit.paths.zkeyPath
  );
}

/**
 * Verify a proof using a real verification key
 * @param {Object} proof - The proof to verify
 * @param {Array} publicSignals - The public signals
 * @param {string} circuitType - The type of circuit
 * @returns {boolean} Whether the proof is valid
 */
export async function verifyProof(proof, publicSignals, circuitType) {
  const circuit = await loadCircuit(circuitType);
  if (!circuit) {
    throw new Error(`Circuit not available: ${circuitType}`);
  }
  
  // Verify using real snarkjs
  return await circuit.snarkjs.groth16.verify(
    circuit.vkey, 
    publicSignals, 
    proof
  );
}

export default {
  getCircuitPath,
  isCircuitAvailable,
  loadCircuit,
  generateProof,
  verifyProof
};