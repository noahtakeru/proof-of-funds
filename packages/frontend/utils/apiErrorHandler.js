/**
 * Enhanced API Error Handler
 * 
 * Standardized, secure error handling for API endpoints with 
 * proper error messages that don't leak sensitive information.
 * Part of the Proof of Funds security implementation.
 * 
 * This file now uses the unified error handling system.
 */

import { handleApiError as unifiedHandleApiError } from '@proof-of-funds/common/src/error-handling';

/**
 * Handle API errors consistently and securely
 * @param {Error} error - The error that occurred
 * @param {object} res - The response object from Next.js
 * @returns {object} - The response with appropriate error details
 */
export function handleApiError(error, res) {
  return unifiedHandleApiError(error, res);
}

// Export as default for backwards compatibility
export default handleApiError;