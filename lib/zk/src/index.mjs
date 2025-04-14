/**
 * Zero-Knowledge Proof System - Main Export File (ESM Version)
 * 
 * This file serves as a centralized export point for all ZK-related functionality,
 * making it easier to import these functions throughout the application with a
 * cleaner import syntax like: import { generateZKProof } from '../lib/zk'
 * 
 * It provides a unified API for both ESM and CommonJS environments through proper
 * dual-format compatibility and intelligent imports.
 * 
 * ---------- NON-TECHNICAL EXPLANATION ----------
 * This file is the main entry point to our privacy system. It brings together all the different
 * parts of our ZK (Zero-Knowledge) system and makes them available in one place. Think of it
 * like the front desk of a hotel - it gives you access to all the different services available,
 * from basic operations like generating and verifying proofs to more advanced features like
 * memory management and security controls.
 */

// Import error handling system first to ensure all modules can use it
import errorLogger from './zkErrorLogger.mjs';
import { ZKErrorCode, createZKError, ErrorSeverity, ZKError } from './zkErrorHandler.mjs';

// Get error logger instance
const { zkErrorLogger } = errorLogger;

// Import key components from original JS implementation
import { ZK_PROOF_TYPES } from '../../config/constants';
import * as zkUtils from './zkUtils.mjs';
import * as zkCircuits from './zkCircuits';
import * as zkCircuitInputs from './zkCircuitInputs.mjs';
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
import ProgressTracker from './progressTracker.mjs';
import deviceCapabilities from './deviceCapabilities.mjs';
import zkProofSerializer from './zkProofSerializer.mjs';
import zkCircuitRegistry from './zkCircuitRegistry.mjs';
import zkCircuitParameterDerivation from './zkCircuitParameterDerivation.mjs';

// Import Week 3 modules
import temporaryWalletManager from './temporaryWalletManager.mjs';
import memoryManager from './memoryManager.mjs';
import secureKeyManager from './SecureKeyManager.mjs';
import secureStorage from './secureStorage.mjs';
import * as zkSecureInputs from './zkSecureInputs.mjs';
import sessionSecurityManager from './SessionSecurityManager.mjs';
import SecurityAuditLogger from './SecurityAuditLogger.mjs';
import TamperDetection from './TamperDetection.mjs';

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

// Import new cross-platform deployment system
import * as deploymentSystem from './deployment/index.js';

// Import proof size optimization module
import * as proofOptimization from './proof/index.js';

// Import dynamic resource allocation module
import * as resourceManagement from './resources/index.js';

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
  zkCircuitParameterDerivation,
  
  // Week 3 modules
  temporaryWalletManager,
  memoryManager,
  secureKeyManager,
  secureStorage,
  sessionSecurityManager,
  SecurityAuditLogger,
  TamperDetection,
  
  // Week 8.5 modules - Cross-Platform Deployment System
  ...deploymentSystem,
  
  // Week 8.5 modules - Proof Size Optimization
  ...proofOptimization
};

/**
 * Initializes the Zero-Knowledge system for both client and server-side operation
 * This must be called before using any ZK functionality to ensure proper setup
 * 
 * @returns {Promise<boolean>} True if initialization succeeds, false otherwise
 * @throws {ZKError} If critical initialization steps fail and cannot be recovered
 */
export async function initializeZkSystem() {
  try {
    // Check WASM support using new infrastructure
    const wasmSupported = await detectWasmSupport();
    if (!wasmSupported) {
      // Use error logger instead of console.warn
      zkErrorLogger.log('WARNING', 'WebAssembly not supported. ZK proofs will use server-side fallback.', {
        category: 'browser_compatibility',
        userFixable: false,
        recoverable: true,
        details: { wasmSupport: false }
      });
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
      // Use error logger instead of console.warn
      zkErrorLogger.log('WARNING', 'Some ZK circuits are not available in new infrastructure. Falling back to original circuits.', {
        category: 'circuit_availability',
        userFixable: false,
        recoverable: true,
        details: {
          standard: getCircuitByType('standard') !== undefined,
          threshold: getCircuitByType('threshold') !== undefined,
          maximum: getCircuitByType('maximum') !== undefined
        }
      });
    }
    
    return true;
  } catch (error) {
    // Use the error logger instead of console.error
    const zkError = createZKError(
      ZKErrorCode.INITIALIZATION_FAILED,
      `Failed to initialize ZK system: ${error.message}`,
      {
        severity: ErrorSeverity.ERROR,
        details: { originalError: error.message },
        recoverable: false,
        userFixable: false,
        securityCritical: true
      }
    );
    
    zkErrorLogger.logError(zkError, {
      context: 'initializeZkSystem',
      operation: 'system initialization'
    });
    
    return false;
  }
}

/**
 * Utilities namespace containing core functionality
 * Includes crypto utils, format conversion, WASM loading, and browser detection
 * @type {Object}
 */
export const utils = {
  ...zkUtils,
  wasmLoader,
  detectWasmSupport,
  snarkjsLoader,
  deviceCapabilities
};

/**
 * Circuits namespace containing circuit-related functionality 
 * Includes circuit metadata, loading, and versioning
 * @type {Object}
 */
export const circuits = {
  ...zkCircuits,
  getCircuitByType,
  getCircuitByVersion,
  circuitBuilder,
  registry: zkCircuitRegistry
};

/**
 * Inputs namespace for handling ZK circuit inputs
 * Includes secure input preparation, validation, and parameter derivation
 * @type {Object}
 */
export const inputs = {
  ...zkCircuitInputs,
  ...zkSecureInputs,
  parameterDerivation: zkCircuitParameterDerivation,
  secure: zkSecureInputs
};

/**
 * Test utilities namespace for testing and benchmarking
 * Includes test data generation, mock implementation, and benchmarking tools
 * @type {Object}
 */
export const test = {
  ...zkTest,
  generateTestWallet,
  generateTestBalanceData,
  mockProofGeneration,
  mockProofVerification,
  createBenchmark
};

/**
 * Progress tracking namespace for monitoring ZK operations
 * Includes progress reporting and telemetry tools
 * @type {Object}
 */
export const progress = {
  zkProgressTracker,
  createProgressReporter,
  ProgressTracker
};

/**
 * Proof serialization module for converting proofs to/from transportable formats
 * @type {Object}
 */
export const serialization = zkProofSerializer;

/**
 * Parameter derivation module for generating circuit parameters from inputs
 * @type {Object}
 */
export const parameterDerivation = zkCircuitParameterDerivation;

/**
 * Security namespace containing security-related modules
 * Includes key management, storage, audit logging, and tamper detection
 * @type {Object} 
 */
export const security = {
  keyManager: secureKeyManager,
  storage: secureStorage,
  secureInputs: zkSecureInputs,
  sessionManager: sessionSecurityManager,
  auditLogger: SecurityAuditLogger,
  tamperDetection: TamperDetection
};

/**
 * Proof type constants for the different types of ZK proofs supported
 * @type {Object}
 */
export { ZK_PROOF_TYPES };

/**
 * Deployment namespace for cross-platform deployment
 * Includes platform detection, adaptation, and optimized configurations
 * @type {Object}
 */
export const deployment = {
  ...deploymentSystem,
  createDeployment: deploymentSystem.createDeployment,
  createOptimizedDeployment: deploymentSystem.createOptimizedDeployment
};

/**
 * Proof optimization namespace for size reduction and efficient transmission
 * Includes compression, optimized serialization, and selective disclosure
 * @type {Object}
 */
export const proofOptimizer = {
  ...proofOptimization,
  compression: proofOptimization.compression,
  serialization: proofOptimization.serialization,
  disclosure: proofOptimization.disclosure
};

/**
 * Resource management namespace for dynamic resource allocation
 * Includes resource monitoring, allocation, prediction, and adaptive computation
 * @type {Object}
 */
export const resources = {
  ...resourceManagement,
  monitor: resourceManagement.ResourceMonitor,
  allocator: resourceManagement.ResourceAllocator,
  prediction: resourceManagement.ResourcePrediction,
  computation: resourceManagement.AdaptiveComputation
};

/**
 * Default export with complete API
 * This provides a consistent interface for both ESM and CommonJS consumers
 * Exports all functionality in a single object for convenience
 * 
 * @type {Object}
 */
export default {
  ZK_PROOF_TYPES,
  utils,
  security,
  circuits,
  inputs,
  test,
  progress,
  serialization,
  parameterDerivation,
  types,
  deployment,
  proofOptimizer,
  resources,
  
  // Direct access to key functions (both old and new)
  generateZKProof: zkUtils.generateZKProof,
  verifyZKProof: zkUtils.verifyZKProof,
  generateInputs: zkCircuitInputs.generateInputs,
  initializeZkSystem
};