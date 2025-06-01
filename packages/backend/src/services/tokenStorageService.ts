/**
 * Token Storage Service
 * 
 * This service provides dedicated storage for authentication tokens,
 * separating them from user preferences to improve maintainability.
 * 
 * In phase 3, this will be migrated to a dedicated database table.
 */

import { prisma } from '@proof-of-funds/db';
import logger from '../utils/logger';
import { TokenType } from './jwtService';

/**
 * Token information interface
 */
export interface TokenInfo {
  id: string;
  type: TokenType;
  expiresAt: number;
  isRevoked: boolean;
  createdAt?: number;
  metadata?: Record<string, any>;
}

/**
 * Store token information in database for revocation tracking
 * 
 * @param userId - User ID
 * @param tokens - Array of token information to store
 */
export async function storeTokens(
  userId: string,
  tokens: TokenInfo[]
): Promise<boolean> {
  try {
    // Get user's existing token data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true }
    });
    
    if (!user) {
      logger.error(`User ${userId} not found when storing tokens`);
      return false;
    }
    
    // Parse settings
    const settings = typeof user.settings === 'string' 
      ? JSON.parse(user.settings as string) 
      : user.settings || {};
    
    // Initialize tokens array if it doesn't exist
    if (!settings.tokens) {
      settings.tokens = [];
    }
    
    // Add new tokens with timestamp
    const now = Math.floor(Date.now() / 1000);
    const newTokens = tokens.map(token => ({
      ...token,
      createdAt: token.createdAt || now
    }));
    
    // Add new tokens to the array
    settings.tokens = [...settings.tokens, ...newTokens];
    
    // Clean up expired tokens (keep last 10 tokens)
    settings.tokens = settings.tokens
      .filter((token: TokenInfo) => token.expiresAt > now || token.isRevoked)
      .slice(-10);
    
    // Update user settings
    await prisma.user.update({
      where: { id: userId },
      data: { settings }
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to store token information', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return false;
  }
}

/**
 * Check if a token is revoked
 * 
 * @param userId - User ID
 * @param tokenId - Token ID
 * @returns Whether the token is revoked
 */
export async function isTokenRevoked(
  userId: string,
  tokenId: string
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true }
    });
    
    if (!user) {
      logger.warn(`User ${userId} not found when checking token revocation`);
      return true; // Fail secure - treat as revoked
    }
    
    // Parse settings
    const settings = typeof user.settings === 'string' 
      ? JSON.parse(user.settings as string) 
      : user.settings || {};
    
    // Check if token exists and is revoked
    if (!settings.tokens) {
      return false; // No tokens stored, assume not revoked
    }
    
    const token = settings.tokens.find((t: TokenInfo) => t.id === tokenId);
    
    // If token not found, it was probably cleaned up (expired)
    if (!token) {
      return true; // Fail secure - treat as revoked
    }
    
    return token.isRevoked === true;
  } catch (error) {
    logger.error('Failed to check token revocation', {
      userId,
      tokenId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // In case of error, assume token is revoked for security
    return true;
  }
}

/**
 * Revoke a specific token
 * 
 * @param userId - User ID
 * @param tokenId - Token ID
 * @returns Success status
 */
export async function revokeToken(
  userId: string,
  tokenId: string
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true }
    });
    
    if (!user) {
      logger.warn(`User ${userId} not found when revoking token`);
      return false;
    }
    
    // Parse settings
    const settings = typeof user.settings === 'string' 
      ? JSON.parse(user.settings as string) 
      : user.settings || {};
    
    // Check if tokens array exists
    if (!settings.tokens) {
      logger.warn(`No tokens found for user ${userId} when revoking token`);
      return false;
    }
    
    // Find token index
    const tokenIndex = settings.tokens.findIndex((t: TokenInfo) => t.id === tokenId);
    if (tokenIndex === -1) {
      logger.warn(`Token ${tokenId} not found for user ${userId} when revoking`);
      return false;
    }
    
    // Mark token as revoked
    settings.tokens[tokenIndex].isRevoked = true;
    
    // Update user settings
    await prisma.user.update({
      where: { id: userId },
      data: { settings }
    });
    
    logger.info(`Token ${tokenId} revoked for user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Failed to revoke token', {
      userId,
      tokenId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return false;
  }
}

/**
 * Revoke all tokens for a user
 * 
 * @param userId - User ID
 * @returns Success status
 */
export async function revokeAllTokens(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true }
    });
    
    if (!user) {
      logger.warn(`User ${userId} not found when revoking all tokens`);
      return false;
    }
    
    // Parse settings
    const settings = typeof user.settings === 'string' 
      ? JSON.parse(user.settings as string) 
      : user.settings || {};
    
    // Check if tokens array exists
    if (!settings.tokens || settings.tokens.length === 0) {
      logger.info(`No tokens to revoke for user ${userId}`);
      return true; // Consider success if no tokens to revoke
    }
    
    // Mark all tokens as revoked
    settings.tokens = settings.tokens.map((token: TokenInfo) => ({
      ...token,
      isRevoked: true
    }));
    
    // Update user settings
    await prisma.user.update({
      where: { id: userId },
      data: { settings }
    });
    
    logger.info(`All tokens revoked for user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Failed to revoke all tokens', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return false;
  }
}

/**
 * Get all tokens for a user
 * 
 * @param userId - User ID
 * @returns Array of token information
 */
export async function getUserTokens(userId: string): Promise<TokenInfo[]> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true }
    });
    
    if (!user) {
      logger.warn(`User ${userId} not found when getting tokens`);
      return [];
    }
    
    // Parse settings
    const settings = typeof user.settings === 'string' 
      ? JSON.parse(user.settings as string) 
      : user.settings || {};
    
    // Return tokens array or empty array if not found
    return settings.tokens || [];
  } catch (error) {
    logger.error('Failed to get user tokens', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return [];
  }
}

/**
 * Clean up expired tokens for a user
 * 
 * @param userId - User ID
 * @returns Number of tokens removed
 */
export async function cleanupExpiredTokens(userId: string): Promise<number> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true }
    });
    
    if (!user) {
      logger.warn(`User ${userId} not found when cleaning up tokens`);
      return 0;
    }
    
    // Parse settings
    const settings = typeof user.settings === 'string' 
      ? JSON.parse(user.settings as string) 
      : user.settings || {};
    
    // Check if tokens array exists
    if (!settings.tokens || settings.tokens.length === 0) {
      return 0;
    }
    
    const now = Math.floor(Date.now() / 1000);
    const originalCount = settings.tokens.length;
    
    // Remove expired tokens
    settings.tokens = settings.tokens.filter((token: TokenInfo) => 
      token.expiresAt > now || token.isRevoked
    );
    
    const removedCount = originalCount - settings.tokens.length;
    
    if (removedCount > 0) {
      // Update user settings if tokens were removed
      await prisma.user.update({
        where: { id: userId },
        data: { settings }
      });
      
      logger.info(`Removed ${removedCount} expired tokens for user ${userId}`);
    }
    
    return removedCount;
  } catch (error) {
    logger.error('Failed to clean up expired tokens', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return 0;
  }
}

export default {
  storeTokens,
  isTokenRevoked,
  revokeToken,
  revokeAllTokens,
  getUserTokens,
  cleanupExpiredTokens
};