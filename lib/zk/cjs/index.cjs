/**
 * Zero Knowledge Proof Infrastructure
 * CommonJS entry point
 */

// Load modules in CommonJS format
const zkUtils = require('./zkUtils.cjs');
const zkErrorHandler = require('./zkErrorHandler.cjs');
const zkErrorLogger = require('./zkErrorLogger.cjs');
const zkRecoverySystem = require('./zkRecoverySystem.cjs');

// Main export for CommonJS
module.exports = {
  // Re-export all modules
  ...zkUtils,
  ...zkErrorHandler,
  ...zkErrorLogger,
  ...zkRecoverySystem,
  
  // Also provide structured access
  zkUtils,
  zkErrorHandler,
  zkErrorLogger,
  zkRecoverySystem
};
