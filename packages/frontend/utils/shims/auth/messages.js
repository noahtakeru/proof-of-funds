/**
 * Shim for authentication messages in the frontend
 * 
 * This provides a compatible interface with the common authentication message
 * format standards for the frontend environment.
 * 
 * This implementation mirrors @proof-of-funds/common/src/auth/messages.ts
 * but is adapted for the frontend environment.
 */

/**
 * Generate a standard wallet signature message
 * 
 * @param {Object} options - Signature request options
 * @returns {string} Formatted signature message
 */
function formatWalletSignatureMessage(options = {}) {
  const {
    timestamp = Date.now(),
    nonce = generateNonce(),
    applicationName = 'Proof of Funds',
    chainId,
    expiresIn = 300, // 5 minutes default
  } = options;

  // Calculate expiry time
  const expiryTime = new Date(timestamp + expiresIn * 1000).toISOString();

  // Build signature message
  let message = `Sign this message to authenticate with ${applicationName}.\n\n`;
  message += `Timestamp: ${timestamp}\n`;
  message += `Nonce: ${nonce}\n`;
  message += `Expires: ${expiryTime}\n`;
  
  // Include chain ID if provided
  if (chainId) {
    message += `Chain ID: ${chainId}\n`;
  }

  return message;
}

/**
 * Generate a secure nonce for frontend use
 * 
 * @param {string} address - Optional wallet address to make the nonce user-specific
 * @returns {string} Secure nonce string
 */
function generateNonce(address) {
  // Frontend implementation - simpler but still secure enough
  const timestamp = Date.now();
  const randomPart = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const addressPart = address ? address.slice(-4) : '';
  
  return `pof-${timestamp}-${randomPart}${addressPart ? '-' + addressPart : ''}`;
}

/**
 * Format a standard authentication error response
 * 
 * @param {string} code - Error code
 * @param {string} message - Human-readable error message
 * @param {Object} details - Additional error details
 * @returns {Object} Standardized error response
 */
function formatAuthError(code, message, details) {
  return {
    error: code,
    message,
    details,
  };
}

/**
 * Standard error codes
 */
const AuthErrorCode = {
  INVALID_CREDENTIALS: 'auth/invalid-credentials',
  INVALID_TOKEN: 'auth/invalid-token',
  EXPIRED_TOKEN: 'auth/expired-token',
  INVALID_SIGNATURE: 'auth/invalid-signature',
  UNAUTHORIZED: 'auth/unauthorized',
  FORBIDDEN: 'auth/forbidden',
  NOT_FOUND: 'auth/not-found',
  TOKEN_REVOKED: 'auth/token-revoked',
  INVALID_REQUEST: 'auth/invalid-request',
  INTERNAL_ERROR: 'auth/internal-error',
};

/**
 * Standard error messages
 */
const AUTH_ERROR_MESSAGES = {
  [AuthErrorCode.INVALID_CREDENTIALS]: 'Invalid credentials provided',
  [AuthErrorCode.INVALID_TOKEN]: 'Invalid authentication token',
  [AuthErrorCode.EXPIRED_TOKEN]: 'Authentication token has expired',
  [AuthErrorCode.INVALID_SIGNATURE]: 'Invalid wallet signature',
  [AuthErrorCode.UNAUTHORIZED]: 'Authentication required',
  [AuthErrorCode.FORBIDDEN]: 'You do not have permission to perform this action',
  [AuthErrorCode.NOT_FOUND]: 'User not found',
  [AuthErrorCode.TOKEN_REVOKED]: 'Token has been revoked',
  [AuthErrorCode.INVALID_REQUEST]: 'Invalid authentication request',
  [AuthErrorCode.INTERNAL_ERROR]: 'Internal authentication error',
};

/**
 * Get a standard error message for a given error code
 * 
 * @param {string} code - Error code
 * @returns {string} Standard error message
 */
function getAuthErrorMessage(code) {
  return AUTH_ERROR_MESSAGES[code] || 'Authentication error';
}

/**
 * Create a standard error response
 * 
 * @param {string} code - Error code
 * @param {Object} details - Additional error details
 * @returns {Object} Standardized error response
 */
function createAuthError(code, details) {
  return formatAuthError(code, getAuthErrorMessage(code), details);
}

module.exports = {
  formatWalletSignatureMessage,
  generateNonce,
  formatAuthError,
  getAuthErrorMessage,
  createAuthError,
  AuthErrorCode,
};