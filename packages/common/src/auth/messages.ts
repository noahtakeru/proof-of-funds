/**
 * Authentication Message Format Standards
 * 
 * This module provides standardized functions for formatting authentication-related
 * messages consistently across the Proof of Funds application.
 * 
 * It ensures consistency between frontend and backend implementations for:
 * - Wallet signature messages
 * - Authentication error responses
 * - Nonce generation
 */

import crypto from 'crypto';

/**
 * Type definitions
 */
export interface AuthenticationErrorResponse {
  error: string;
  message: string;
  code?: number;
  details?: Record<string, any>;
}

export interface SignatureRequestOptions {
  timestamp?: number;
  nonce?: string;
  applicationName?: string;
  chainId?: number;
  expiresIn?: number; // in seconds
}

/**
 * Standard error codes
 */
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'auth/invalid-credentials',
  INVALID_TOKEN = 'auth/invalid-token',
  EXPIRED_TOKEN = 'auth/expired-token',
  INVALID_SIGNATURE = 'auth/invalid-signature',
  UNAUTHORIZED = 'auth/unauthorized',
  FORBIDDEN = 'auth/forbidden',
  NOT_FOUND = 'auth/not-found',
  TOKEN_REVOKED = 'auth/token-revoked',
  INVALID_REQUEST = 'auth/invalid-request',
  INTERNAL_ERROR = 'auth/internal-error',
}

/**
 * Generate a standard wallet signature message
 * 
 * @param options - Signature request options
 * @returns Formatted signature message
 */
export function formatWalletSignatureMessage(options: SignatureRequestOptions = {}): string {
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
 * Generate a cryptographically secure nonce
 * 
 * @param address - Optional wallet address to make the nonce user-specific
 * @returns Secure nonce string
 */
export function generateNonce(address?: string): string {
  // Create a timestamp-based component for uniqueness
  const timestamp = Date.now().toString();
  
  // Generate random bytes for unpredictability
  const randomBytes = crypto.randomBytes(16).toString('hex');
  
  // Add address as a seed if provided to make it user-specific
  const addressSeed = address ? address.slice(-8) : '';
  
  // Combine components
  const rawNonce = `${timestamp}:${randomBytes}:${addressSeed}`;
  
  // Hash the combined components for fixed length and to obscure raw values
  const hashedNonce = crypto
    .createHash('sha256')
    .update(rawNonce)
    .digest('hex')
    .slice(0, 16); // 16 chars is enough for a nonce
  
  // Return formatted nonce
  return `pof-${hashedNonce}`;
}

/**
 * Format a standard authentication error response
 * 
 * @param code - Error code
 * @param message - Human-readable error message
 * @param details - Additional error details
 * @returns Standardized error response
 */
export function formatAuthError(
  code: AuthErrorCode | string,
  message: string,
  details?: Record<string, any>
): AuthenticationErrorResponse {
  return {
    error: code,
    message,
    details,
  };
}

/**
 * Standard error messages
 */
export const AUTH_ERROR_MESSAGES = {
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
 * @param code - Error code
 * @returns Standard error message
 */
export function getAuthErrorMessage(code: AuthErrorCode | string): string {
  return AUTH_ERROR_MESSAGES[code as AuthErrorCode] || 'Authentication error';
}

/**
 * Create a standard error response
 * 
 * @param code - Error code
 * @param details - Additional error details
 * @returns Standardized error response
 */
export function createAuthError(
  code: AuthErrorCode | string,
  details?: Record<string, any>
): AuthenticationErrorResponse {
  return formatAuthError(code, getAuthErrorMessage(code), details);
}

export default {
  formatWalletSignatureMessage,
  generateNonce,
  formatAuthError,
  getAuthErrorMessage,
  createAuthError,
  AuthErrorCode,
};