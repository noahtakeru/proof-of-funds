/**
 * Zero-Knowledge Proof System - Main Export File
 * 
 * This file serves as a centralized export point for all ZK-related functionality,
 * making it easier to import these functions throughout the application with a
 * cleaner import syntax like: import { generateZKProof } from '../lib/zk'
 */

// Import key components
import { ZK_PROOF_TYPES } from '../../config/constants';
import * as zkUtils from './zkUtils';
import * as zkCircuits from './zkCircuits';
import * as zkCircuitInputs from './zkCircuitInputs';
import * as zkTest from './zkTest';

// Re-export components
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

// For convenience, also export as namespaces
export const utils = zkUtils;
export const circuits = zkCircuits;
export const inputs = zkCircuitInputs;
export const test = zkTest;

// Export ZK proof types
export { ZK_PROOF_TYPES };

// Default export with complete API
export default {
  ZK_PROOF_TYPES,
  utils: zkUtils,
  circuits: zkCircuits,
  inputs: zkCircuitInputs,
  test: zkTest,
  
  // Direct access to key functions
  generateZKProof: zkUtils.generateZKProof,
  verifyZKProof: zkUtils.verifyZKProof,
  generateInputs: zkCircuitInputs.generateInputs
};