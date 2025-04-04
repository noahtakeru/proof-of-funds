/**
 * Zero-Knowledge Proof System - Main Export File
 * 
 * This file serves as a centralized export point for all ZK-related functionality,
 * making it easier to import these functions throughout the application with a
 * cleaner import syntax like: import { generateZKProof } from '../lib/zk'
 * 
 * UPDATE: This file now integrates both the original JavaScript modules and the
 * new TypeScript infrastructure modules, allowing for a gradual migration.
 */

// Import key components from original JS implementation
import { ZK_PROOF_TYPES } from '../../config/constants';
import * as zkUtils from './zkUtils';
import * as zkCircuits from './zkCircuits';
import * as zkCircuitInputs from './zkCircuitInputs';
import * as zkTest from './zkTest';

// Import new TypeScript infrastructure components
// Note: TypeScript files can be imported directly in JavaScript projects
import * as types from './types';
import { wasmLoader, detectWasmSupport } from './wasmLoader';
import { snarkjsLoader } from './snarkjsLoader';
import { 
  getCircuitByType, 
  getCircuitByVersion, 
  mapProofTypeToString,
  mapStringToProofType 
} from './circuitVersions';
import { circuitBuilder } from './circuitBuilder';
import { zkProgressTracker, createProgressReporter } from './progressTracker';
import {
  generateTestWallet,
  generateTestBalanceData,
  mockProofGeneration,
  mockProofVerification,
  createBenchmark
} from './testUtils';

// Import newly added Week 2 modules
import ProgressTracker from './progressTracker.js';
import deviceCapabilities from './deviceCapabilities.js';
import zkProofSerializer from './zkProofSerializer.js';
import zkCircuitRegistry from './zkCircuitRegistry.js';
import zkCircuitParameterDerivation from './zkCircuitParameterDerivation.js';

// Re-export original JS components
export { 
  // Core proof functionality
  generateZKProof,
  verifyZKProof,
  serializeZKProof,
  deserializeZKProof,
  generateZKProofHash,
  initializeSnarkJS
} from './zkUtils';

export {
  // Circuit management
  getCircuitData,
  getCircuitCode,
  CIRCUIT_NAMES
} from './zkCircuits';

export {
  // Input handling
  generateInputs,
  extractPublicInputs,
  validateInputs,
  addressToBytes
} from './zkCircuitInputs';

export {
  // Testing utilities
  generateTestProof,
  generateTestWalletAndProof,
  runVerificationTest,
  runAllTests
} from './zkTest';

// Re-export new TypeScript infrastructure components
export {
  // Types (these will be used by TypeScript consumers only)
  types,
  
  // New infrastructure
  wasmLoader,
  detectWasmSupport,
  snarkjsLoader,
  getCircuitByType,
  getCircuitByVersion,
  mapProofTypeToString,
  mapStringToProofType,
  circuitBuilder,
  zkProgressTracker,
  createProgressReporter,
  
  // New testing utilities
  generateTestWallet,
  generateTestBalanceData,
  mockProofGeneration,
  mockProofVerification,
  createBenchmark,
  
  // Week 2 modules
  ProgressTracker,
  deviceCapabilities,
  zkProofSerializer,
  zkCircuitRegistry,
  zkCircuitParameterDerivation
};

/**
 * Initialize the ZK system
 * This should be called before using any ZK functionality.
 * Integrates with both old and new ZK infrastructure.
 * @returns Promise that resolves when initialization is complete
 */
export async function initializeZkSystem() {
  try {
    // Check WASM support using new infrastructure
    const wasmSupported = await detectWasmSupport();
    if (!wasmSupported) {
      console.warn('WebAssembly not supported. ZK proofs will use server-side fallback.');
    }
    
    // Initialize snarkjs with new infrastructure
    await snarkjsLoader.initialize();
    
    // Also initialize old infrastructure
    await zkUtils.initializeSnarkJS();
    
    // Verify circuit availability
    const allCircuitsAvailable = 
      getCircuitByType('standard') !== undefined && 
      getCircuitByType('threshold') !== undefined && 
      getCircuitByType('maximum') !== undefined;
    
    if (!allCircuitsAvailable) {
      console.warn('Some ZK circuits are not available in new infrastructure. Falling back to original circuits.');
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initialize ZK system:', error);
    return false;
  }
}

// For convenience, also export as namespaces
export const utils = {
  ...zkUtils,
  wasmLoader,
  detectWasmSupport,
  snarkjsLoader,
  deviceCapabilities
};

export const circuits = {
  ...zkCircuits,
  getCircuitByType,
  getCircuitByVersion,
  circuitBuilder,
  registry: zkCircuitRegistry
};

export const inputs = {
  ...zkCircuitInputs,
  parameterDerivation: zkCircuitParameterDerivation
};

export const test = {
  ...zkTest,
  generateTestWallet,
  generateTestBalanceData,
  mockProofGeneration,
  mockProofVerification,
  createBenchmark
};

export const progress = {
  zkProgressTracker,
  createProgressReporter,
  ProgressTracker
};

export const serialization = zkProofSerializer;
export const parameterDerivation = zkCircuitParameterDerivation;

// Export ZK proof types
export { ZK_PROOF_TYPES };

// Default export with complete API
export default {
  ZK_PROOF_TYPES,
  utils: {
    ...zkUtils,
    wasmLoader,
    detectWasmSupport,
    snarkjsLoader,
    deviceCapabilities
  },
  circuits: {
    ...zkCircuits,
    getCircuitByType,
    getCircuitByVersion,
    circuitBuilder,
    registry: zkCircuitRegistry
  },
  inputs: {
    ...zkCircuitInputs,
    parameterDerivation: zkCircuitParameterDerivation
  },
  test: {
    ...zkTest,
    generateTestWallet,
    generateTestBalanceData,
    mockProofGeneration,
    mockProofVerification,
    createBenchmark
  },
  progress: {
    zkProgressTracker,
    createProgressReporter,
    ProgressTracker
  },
  serialization: zkProofSerializer,
  // Types export (for TypeScript users)
  types,
  
  // Direct access to key functions (both old and new)
  generateZKProof: zkUtils.generateZKProof,
  verifyZKProof: zkUtils.verifyZKProof,
  generateInputs: zkCircuitInputs.generateInputs,
  initializeZkSystem
};