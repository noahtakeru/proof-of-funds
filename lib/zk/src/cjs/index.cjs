/**
 * Zero-Knowledge Proof System - Main Export File (CommonJS Version)
 * 
 * This file serves as a centralized export point for all ZK-related functionality,
 * making it easier to import these functions throughout the application with a
 * cleaner import syntax like: const zk = require('../lib/zk')
 * 
 * It provides a unified API for CommonJS environments through proper module
 * compatibility and intelligent requires.
 */

// Error handling first to ensure all modules can use it
const errorLogger = require('./zkErrorLogger.cjs');
const { ZKErrorCode, createZKError, ErrorSeverity, ZKError } = require('./zkErrorHandler.cjs');

// Get error logger instance
const { zkErrorLogger } = errorLogger;

// Core ZK modules - Original functionality 
const constants = require('../../../config/constants');
const { ZK_PROOF_TYPES } = constants;

// ZK utility modules
const zkUtils = require('./zkUtils.cjs');
const zkCircuits = require('./zkCircuits.cjs');
const zkCircuitInputs = require('./zkCircuitInputs.cjs');

// Week 2-3 modules
const ProgressTracker = require('./progressTracker.cjs');
const deviceCapabilities = require('./deviceCapabilities.cjs');
const zkProofSerializer = require('./zkProofSerializer.cjs');
const zkCircuitRegistry = require('./zkCircuitRegistry.cjs');
const zkCircuitParameterDerivation = require('./zkCircuitParameterDerivation.cjs');
const temporaryWalletManager = require('./temporaryWalletManager.cjs');
const memoryManager = require('./memoryManager.cjs');
const secureKeyManager = require('./SecureKeyManager.cjs');
const secureStorage = require('./secureStorage.cjs');
const zkSecureInputs = require('./zkSecureInputs.cjs');
const sessionSecurityManager = require('./SessionSecurityManager.cjs');
const SecurityAuditLogger = require('./SecurityAuditLogger.cjs');
const TamperDetection = require('./TamperDetection.cjs');

// Week 8+ modules
const deploymentSystem = require('./deployment/index.cjs');
const proofOptimization = require('./proof/index.cjs');
const resourceManagement = require('./resources/index.cjs');

// Week 9.5 modules - Admin, Analytics, and Monitoring
const adminSystem = require('./admin/index.cjs');
const analyticsSystem = require('./analytics/index.cjs');
const monitoringSystem = require('./monitoring/index.cjs');

/**
 * Initializes the Zero-Knowledge system for both client and server-side operation
 * This must be called before using any ZK functionality to ensure proper setup
 * 
 * @returns {Promise<boolean>} True if initialization succeeds, false otherwise
 * @throws {ZKError} If critical initialization steps fail and cannot be recovered
 */
async function initializeZkSystem() {
  try {
    // Check WASM support using our device capabilities module
    const wasmSupported = await deviceCapabilities.checkWasmSupport();
    if (!wasmSupported) {
      zkErrorLogger.log('WARNING', 'WebAssembly not supported. ZK proofs will use server-side fallback.', {
        category: 'browser_compatibility',
        userFixable: false,
        recoverable: true,
        details: { wasmSupport: false }
      });
    }
    
    // Initialize snarkjs
    await zkUtils.initializeSnarkJS();
    
    // Initialize monitoring system
    if (monitoringSystem.monitoringSystem) {
      try {
        await monitoringSystem.monitoringSystem.initializeAll();
      } catch (monitoringError) {
        zkErrorLogger.log('WARNING', 'Failed to initialize monitoring system', {
          category: 'monitoring',
          userFixable: false,
          recoverable: true,
          details: { error: monitoringError.message }
        });
      }
    }
    
    return true;
  } catch (error) {
    // Use the error logger
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
 */
const utils = {
  ...zkUtils,
  deviceCapabilities
};

/**
 * Circuits namespace containing circuit-related functionality 
 * Includes circuit metadata, loading, and versioning
 */
const circuits = {
  ...zkCircuits,
  registry: zkCircuitRegistry
};

/**
 * Inputs namespace for handling ZK circuit inputs
 * Includes secure input preparation, validation, and parameter derivation
 */
const inputs = {
  ...zkCircuitInputs,
  ...zkSecureInputs,
  parameterDerivation: zkCircuitParameterDerivation,
  secure: zkSecureInputs
};

/**
 * Security namespace containing security-related modules
 * Includes key management, storage, audit logging, and tamper detection
 */
const security = {
  keyManager: secureKeyManager,
  storage: secureStorage,
  secureInputs: zkSecureInputs,
  sessionManager: sessionSecurityManager,
  auditLogger: SecurityAuditLogger,
  tamperDetection: TamperDetection
};

/**
 * Progress tracking namespace for monitoring ZK operations
 * Includes progress reporting and telemetry tools
 */
const progress = {
  ProgressTracker
};

/**
 * Admin dashboard namespace containing admin-related modules
 * Includes user management, RBAC, proof management, and configuration
 */
const admin = {
  ...adminSystem,
  rbac: adminSystem.rbacSystem,
  userManagement: adminSystem.userManagement,
  proofManagement: adminSystem.proofManagement,
  systemConfig: adminSystem.systemConfig,
  auditLogger: adminSystem.auditLogger
};

/**
 * Analytics namespace containing analytics-related modules
 * Includes BigQuery integration, event tracking, and reporting
 */
const analytics = {
  ...analyticsSystem,
  bigQuery: analyticsSystem.bigQueryAnalytics,
  secretManager: analyticsSystem.gcpSecretManager
};

/**
 * Monitoring namespace containing monitoring-related modules
 * Includes system monitoring, alerting, and executive dashboard
 */
const monitoring = {
  ...monitoringSystem,
  systemMonitor: monitoringSystem.systemMonitor,
  alertManager: monitoringSystem.alertManager,
  executiveDashboard: monitoringSystem.executiveDashboard
};

/**
 * Deployment namespace for cross-platform deployment
 * Includes platform detection, adaptation, and optimized configurations
 */
const deployment = {
  ...deploymentSystem,
  createDeployment: deploymentSystem.createDeployment,
  createOptimizedDeployment: deploymentSystem.createOptimizedDeployment
};

/**
 * Proof optimization namespace for size reduction and efficient transmission
 * Includes compression, optimized serialization, and selective disclosure
 */
const proofOptimizer = {
  ...proofOptimization,
  compression: proofOptimization.compression,
  serialization: proofOptimization.serialization,
  disclosure: proofOptimization.disclosure
};

/**
 * Resource management namespace for dynamic resource allocation
 * Includes resource monitoring, allocation, prediction, and adaptive computation
 */
const resources = {
  ...resourceManagement,
  monitor: resourceManagement.ResourceMonitor,
  allocator: resourceManagement.ResourceAllocator,
  prediction: resourceManagement.ResourcePrediction,
  computation: resourceManagement.AdaptiveComputation
};

// Export the complete API
module.exports = {
  // Constants
  ZK_PROOF_TYPES,
  
  // Core functionality
  generateZKProof: zkUtils.generateZKProof,
  verifyZKProof: zkUtils.verifyZKProof,
  generateInputs: zkCircuitInputs.generateInputs,
  initializeZkSystem,
  
  // Namespaced functionality
  utils,
  circuits,
  inputs,
  security,
  progress,
  serialization: zkProofSerializer,
  parameterDerivation: zkCircuitParameterDerivation,
  admin,
  analytics,
  monitoring,
  deployment,
  proofOptimizer,
  resources,
  
  // Direct exports from original modules
  errorLogger,
  temporaryWalletManager,
  memoryManager
};