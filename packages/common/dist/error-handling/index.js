/**
 * Unified Error Handling System
 * 
 * This is the main entry point for the error handling system.
 * It exports all error handling functionality from the various modules.
 */

// Export core error system
export * from './ErrorSystem';

// Export specialized error handlers
export * from './ZkErrors';
export * from './ApiErrors';

// Export error logger
export { getErrorLogger } from './zkErrorHandler.mjs';

// Import everything for re-export
import ErrorSystem from './ErrorSystem';
import ZkErrors from './ZkErrors';
import ApiErrors from './ApiErrors';

// Configure a default export with commonly used functions
export default {
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