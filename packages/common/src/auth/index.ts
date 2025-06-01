/**
 * Authentication Utilities
 * 
 * This module exports all authentication-related utilities from the
 * Proof of Funds common package. It provides a unified entry point
 * for authentication services.
 */

import tokenManager from './tokenManager.js';
import tokenService, * as tokenServiceExports from './tokenService';
import * as authMessages from './messages';
import passwordValidation, * as passwordValidationExports from './passwordValidation';

// Re-export all components
export { tokenManager, tokenService, authMessages, passwordValidation };

// Re-export specific types and interfaces from token service
export type {
  TokenPayload,
  TokenPair,
  TokenType,
  TokenGenerationOptions,
  TokenPairGenerationOptions,
  TokenVerificationOptions,
  RefreshTokenOptions,
} from './tokenService';

// Re-export specific types and interfaces from auth messages
export type {
  AuthenticationErrorResponse,
  SignatureRequestOptions,
} from './messages';

// Re-export specific types and interfaces from password validation
export type {
  PasswordValidationResult,
  PasswordValidationOptions,
} from './passwordValidation';

// Re-export error codes
export { AuthErrorCode } from './messages';

// Re-export token service functions
export const {
  generateTokenPair,
  generateToken,
  verifyToken,
  refreshTokens,
  revokeTokens,
  blacklistToken,
  isTokenBlacklisted,
  extractTokenId,
  decodeToken,
  getTokenExpiryTime,
} = tokenServiceExports;

// Re-export auth message functions
export const {
  formatWalletSignatureMessage,
  generateNonce,
  formatAuthError,
  getAuthErrorMessage,
  createAuthError,
} = authMessages;

// Re-export password validation functions
export const {
  validatePassword,
  scorePasswordStrength,
  getPasswordStrengthDescription,
  isPasswordSecure,
} = passwordValidationExports;

// Default export for convenience
export default {
  ...tokenService,
  authMessages,
  passwordValidation,
};