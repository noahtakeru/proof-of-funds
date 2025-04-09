/**
 * Proof of Funds Zero-Knowledge Module - CommonJS Version
 * 
 * This is the CommonJS compatibility wrapper for the ESM ZK module.
 * It re-exports all functionality from the ESM version for use with require().
 */

// Import core ZK utilities
const zkUtils = require('./zkUtils.cjs');

// Import error handling system
const zkErrorHandler = require('./zkErrorHandler.cjs');
const zkErrorLogger = require('./zkErrorLogger.cjs');

// Import recovery system
const zkRecovery = require('./zkRecoverySystem.cjs');

// Import proof handling
const CircuitRegistry = require('./zkCircuitRegistry.cjs');
const CircuitParameters = require('./zkCircuitParameterDerivation.cjs');
const SecureInputs = require('./zkSecureInputs.cjs');
const ProofSerializer = require('./zkProofSerializer.cjs');

// Import security modules
const SecureKeyManager = require('./SecureKeyManager.cjs');
const TamperDetection = require('./TamperDetection.cjs');
const SessionSecurity = require('./SessionSecurityManager.cjs');

// Import device and browser compatibility
const { checkBrowserSupport, getDeviceCapabilities } = require('./browserCompatibility.cjs');

// Create a combined export with all components
const combined = {
  // Core utilities
  ...zkUtils,
  
  // Error handling
  ErrorHandler: zkErrorHandler,
  ErrorLogger: zkErrorLogger,
  
  // Recovery system
  Recovery: zkRecovery,
  
  // Circuit components
  CircuitRegistry,
  CircuitParameters,
  SecureInputs,
  ProofSerializer,
  
  // Security
  SecureKeyManager,
  TamperDetection,
  SessionSecurity,
  
  // Browser and device compatibility
  checkBrowserSupport,
  getDeviceCapabilities,
  
  // Also expose the individual modules directly
  zkUtils,
  zkErrorHandler,
  zkErrorLogger,
  zkRecovery
};

// Export the combined object for CommonJS compatibility
module.exports = combined;