/**
 * JWT Service
 * 
 * Handles generation and verification of JWT tokens for authentication.
 * Supports both wallet-based and email-based authentication with token refresh.
 * 
 * NOTE: This service now uses the unified token service from the common package
 * for consistent token management across the application.
 */

import {
  generateTokenPair as generateTokenPairCore,
  verifyToken as verifyTokenCore,
  refreshTokens as refreshTokensCore,
  revokeTokens as revokeTokensCore,
  TokenPayload as TokenPayloadCore
} from '@proof-of-funds/common/auth/tokenService';
import { prisma } from '@proof-of-funds/db';
import config from '../config';
import logger from '../utils/logger';

// Token types
export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh'
}

// Token payload interface
export interface TokenPayload {
  userId: string;
  walletAddress?: string;
  email?: string;
  permissions: string[];
  tokenId?: string;
  tokenType?: TokenType;
  [key: string]: any;
}

/**
 * Generate a token pair (access token + refresh token)
 * 
 * @param payload - Token payload
 * @param options - Token generation options
 * @returns Object with access and refresh tokens
 */
export async function generateTokenPair(
  payload: TokenPayload,
  options: {
    accessExpiresIn?: string;
    refreshExpiresIn?: string;
  } = {}
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const {
    accessExpiresIn = config.jwt.accessTokenExpiry,
    refreshExpiresIn = config.jwt.refreshTokenExpiry
  } = options;
  
  // Calculate expiry timestamps for logging
  const now = Math.floor(Date.now() / 1000);
  const accessExpiresAt = now + getExpirySeconds(accessExpiresIn);
  const refreshExpiresAt = now + getExpirySeconds(refreshExpiresIn);
  
  // Use the core token service to generate tokens
  const tokens = await generateTokenPairCore(
    {
      ...payload,
      // Include the JWT_SECRET in the config
      secret: config.jwt.secret
    },
    {
      accessExpiresIn,
      refreshExpiresIn
    }
  );
  
  // Log token generation
  logger.debug('Generated token pair', {
    userId: payload.userId,
    accessExpiresAt,
    refreshExpiresAt
  });
  
  return tokens;
}

/**
 * Store token information in database for revocation tracking
 * Uses the dedicated token storage service
 */
async function storeTokens(
  userId: string,
  accessTokenId: string,
  refreshTokenId: string,
  accessExpiresAt: number,
  refreshExpiresAt: number
): Promise<void> {
  // Import the token storage service
  const tokenStorageService = await import('./tokenStorageService');
  
  // Create token info objects
  const tokens = [
    {
      id: accessTokenId,
      type: TokenType.ACCESS,
      expiresAt: accessExpiresAt,
      isRevoked: false,
      createdAt: Math.floor(Date.now() / 1000)
    },
    {
      id: refreshTokenId,
      type: TokenType.REFRESH,
      expiresAt: refreshExpiresAt,
      isRevoked: false,
      createdAt: Math.floor(Date.now() / 1000)
    }
  ];
  
  // Store tokens using the dedicated service
  const success = await tokenStorageService.storeTokens(userId, tokens);
  
  if (!success) {
    logger.error('Failed to store token information', { userId });
    // Continue anyway to avoid blocking authentication
  }
}

/**
 * Refresh an access token using a valid refresh token
 * 
 * @param refreshToken - Refresh token
 * @returns New token pair or null if refresh failed
 */
export async function refreshTokens(
  refreshToken: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
} | null> {
  try {
    // Use the core token service to verify and refresh tokens
    const newTokens = await refreshTokensCore(refreshToken);
    
    if (!newTokens) {
      logger.warn('Token refresh failed - core service returned null');
      return null;
    }
    
    // Get userId from the refreshed token
    const decoded = await verifyTokenCore(newTokens.accessToken);
    
    if (!decoded || !decoded.userId) {
      logger.warn('Could not extract userId from refreshed token');
      return null;
    }
    
    logger.debug('Refreshed token pair', {
      userId: decoded.userId
    });
    
    return {
      ...newTokens,
      userId: decoded.userId
    };
  } catch (error) {
    logger.error('Token refresh failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return null;
  }
}

/**
 * Verify a JWT token
 * 
 * @param token - JWT token to verify
 * @returns Decoded token payload or null if invalid
 */
export function verifyToken(
  token: string
): TokenPayload | null {
  try {
    // Use the core token service to verify the token
    return verifyTokenCore(token, {
      // Pass JWT_SECRET from config
      secret: config.jwt.secret
    }) as TokenPayload | null;
  } catch (error) {
    logger.warn('Token verification failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return null;
  }
}

/**
 * Check if a token is revoked
 * 
 * @param userId - User ID
 * @param tokenId - Token ID
 * @returns True if token is revoked, false otherwise
 */
export async function isTokenRevoked(
  userId: string,
  tokenId: string
): Promise<boolean> {
  // Import the token storage service
  const tokenStorageService = await import('./tokenStorageService');
  
  // Use the dedicated service to check if the token is revoked
  return tokenStorageService.isTokenRevoked(userId, tokenId);
}

/**
 * Revoke a token
 * 
 * @param userId - User ID
 * @param tokenId - Token ID
 * @returns Success status
 */
export async function revokeToken(
  userId: string,
  tokenId: string
): Promise<boolean> {
  // Import the token storage service
  const tokenStorageService = await import('./tokenStorageService');
  
  // Use the dedicated service to revoke the token
  return tokenStorageService.revokeToken(userId, tokenId);
}

/**
 * Revoke all tokens for a user
 * 
 * @param userId - User ID
 * @returns Success status
 */
export async function revokeAllTokens(userId: string): Promise<boolean> {
  // Import the token storage service
  const tokenStorageService = await import('./tokenStorageService');
  
  // Use the dedicated service to revoke all tokens
  return tokenStorageService.revokeAllTokens(userId);
}

/**
 * Convert time string to seconds
 * 
 * @param time - Time string (e.g., '1h', '7d')
 * @returns Time in seconds
 */
function getExpirySeconds(time: string): number {
  const unit = time.charAt(time.length - 1);
  const value = parseInt(time.slice(0, -1), 10);
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    default: return 3600; // Default to 1 hour
  }
}