/**
 * Unified Error Handling System
 * 
 * This is the main entry point for the error handling system.
 * It exports all error handling functionality from the various modules.
 */

// Export core error system
Object.assign(exports, require('./ErrorSystem'));

// Export specialized error handlers
Object.assign(exports, require('./ZkErrors'));
Object.assign(exports, require('./ApiErrors'));

// Export error logger
module.exports = { getErrorLogger } from './zkErrorHandler.mjs';

// Import everything for re-const ErrorSystem = exports.ErrorSystem = require('./ErrorSystem');
const ZkErrors = require('./ZkErrors');
const ApiErrors = require('./ApiErrors');

// Configure a default export with commonly used functions
module.exports = {
  // Core error system
  ...ErrorSystem,
  
  // ZK-specific errors
  ...ZkErrors,
  
  // API-specific errors
  ...ApiErrors,
  
  // Common error handlers
  handleApiError: ApiErrors.handleApiError,
  handleZkError: ZkErrors.handleZkError,
  handleClientError: ErrorSystem.handleClientError,
  
  // Validation
  validateApiRequest: ApiErrors.validateApiRequest,
  validators: ApiErrors.validators
};