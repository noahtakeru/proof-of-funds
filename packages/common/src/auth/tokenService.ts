/**
 * Unified Token Service
 * 
 * This module provides a consistent TypeScript interface for token management
 * across the Proof of Funds application, wrapping the underlying
 * implementation in tokenManager.js.
 * 
 * Features:
 * - Type-safe interfaces for token operations
 * - Consistent error handling
 * - Support for both access and refresh tokens
 * - Token blacklisting and revocation
 */

import tokenManager from './tokenManager.js';

// Type definitions
export interface TokenPayload {
  userId: string;
  walletAddress?: string;
  email?: string;
  permissions?: string[];
  tokenId?: string;
  tokenType?: TokenType;
  role?: string;
  secret?: string;
  [key: string]: any;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType?: string;
}

export type TokenType = 'access' | 'refresh';

export interface TokenGenerationOptions {
  expiresIn?: string;
  type?: TokenType;
  secret?: string;
}

export interface TokenPairGenerationOptions {
  accessExpiresIn?: string;
  refreshExpiresIn?: string;
  secret?: string;
}

export interface TokenVerificationOptions {
  ignoreExpiration?: boolean;
  checkBlacklist?: boolean;
  secret?: string;
}

export interface RefreshTokenOptions {
  secret?: string;
}

/**
 * Generate a token pair (access + refresh tokens)
 * 
 * @param payload Data to include in the token
 * @param options Token generation options
 * @returns Token pair
 */
export async function generateTokenPair(
  payload: TokenPayload,
  options: TokenPairGenerationOptions = {}
): Promise<TokenPair> {
  return tokenManager.generateTokenPair({
    ...payload,
    // Ensure consistent payload structure
    userId: payload.userId,
    walletAddress: payload.walletAddress,
    email: payload.email,
    permissions: payload.permissions || [],
    secret: payload.secret || options.secret
  });
}

/**
 * Generate a single token
 * 
 * @param payload Data to include in the token
 * @param options Token generation options
 * @returns Generated token
 */
export async function generateToken(
  payload: TokenPayload,
  options: TokenGenerationOptions = {}
): Promise<string> {
  return tokenManager.generateToken(payload, {
    expiresIn: options.expiresIn || '15m',
    type: options.type || 'access',
    secret: options.secret
  });
}

/**
 * Verify a token
 * 
 * @param token Token to verify
 * @param options Verification options
 * @returns Decoded token payload or null if invalid
 */
export async function verifyToken(
  token: string,
  options: TokenVerificationOptions = {}
): Promise<TokenPayload | null> {
  try {
    return await tokenManager.verifyToken(token, options);
  } catch (error) {
    return null;
  }
}

/**
 * Refresh an access token using a refresh token
 * 
 * @param refreshToken Refresh token
 * @param options Refresh options
 * @returns New token pair or null if refresh failed
 */
export async function refreshTokens(
  refreshToken: string,
  options: RefreshTokenOptions = {}
): Promise<TokenPair | null> {
  try {
    if (options.secret) {
      // If secret is provided in options, pass it to the token manager
      return await tokenManager.refreshTokens(refreshToken, options);
    }
    return await tokenManager.refreshTokens(refreshToken);
  } catch (error) {
    return null;
  }
}

/**
 * Revoke tokens (logout)
 * 
 * @param accessToken Access token to revoke
 * @param refreshToken Refresh token to revoke
 * @returns Success status
 */
export async function revokeTokens(
  accessToken: string,
  refreshToken: string
): Promise<boolean> {
  try {
    return await tokenManager.revokeTokens(accessToken, refreshToken);
  } catch (error) {
    return false;
  }
}

/**
 * Blacklist a token
 * 
 * @param token Token to blacklist
 * @param expiryInSeconds How long to keep in blacklist
 * @returns Success status
 */
export async function blacklistToken(
  token: string,
  expiryInSeconds: number
): Promise<boolean> {
  try {
    return await tokenManager.blacklistToken(token, expiryInSeconds);
  } catch (error) {
    return false;
  }
}

/**
 * Check if a token is blacklisted
 * 
 * @param token Token to check
 * @returns True if blacklisted
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  try {
    return await tokenManager.isTokenBlacklisted(token);
  } catch (error) {
    // Fail secure - treat errors as blacklisted
    return true;
  }
}

/**
 * Extract token ID from a token
 * 
 * @param token Token to extract ID from
 * @returns Token ID or null if invalid
 */
export function extractTokenId(token: string): string | null {
  try {
    const decoded = tokenManager.decodeToken(token);
    return decoded?.jti || null;
  } catch (error) {
    return null;
  }
}

/**
 * Decode a token without verification
 * 
 * @param token Token to decode
 * @returns Decoded payload or null if invalid
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    return tokenManager.decodeToken(token);
  } catch (error) {
    return null;
  }
}

/**
 * Get token expiry time in seconds
 * 
 * @param token Token to check
 * @returns Seconds until expiry or 0 if expired/invalid
 */
export function getTokenExpiryTime(token: string): number {
  try {
    const decoded = tokenManager.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return 0;
    }
    
    const now = Math.floor(Date.now() / 1000);
    const expiry = decoded.exp - now;
    
    return expiry > 0 ? expiry : 0;
  } catch (error) {
    return 0;
  }
}

// Export all functions as named exports
export {
  // Extended utility functions
  extractTokenId,
  decodeToken,
  getTokenExpiryTime
};

// Export both named exports and default
export default {
  generateTokenPair,
  generateToken,
  verifyToken,
  refreshTokens,
  revokeTokens,
  blacklistToken,
  isTokenBlacklisted,
  extractTokenId,
  decodeToken,
  getTokenExpiryTime
};