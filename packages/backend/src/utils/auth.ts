/**
 * Authentication Utilities
 * 
 * Helper functions for authentication processes
 */
import crypto from 'crypto';

/**
 * Generate a secure nonce for authentication
 * 
 * @param address Wallet address for which to generate nonce
 * @returns Secure nonce string
 */
export const generateNonce = (address: string): string => {
  // Create a timestamp-based component for uniqueness
  const timestamp = Date.now().toString();
  
  // Generate random bytes for unpredictability
  const randomBytes = crypto.randomBytes(16).toString('hex');
  
  // Add address as a seed to make it user-specific
  const addressSeed = address.slice(-8);
  
  // Combine components
  const rawNonce = `${timestamp}:${randomBytes}:${addressSeed}`;
  
  // Hash the combined components for fixed length and to obscure raw values
  const hashedNonce = crypto
    .createHash('sha256')
    .update(rawNonce)
    .digest('hex')
    .slice(0, 32);
  
  // Return formatted nonce
  return `pof-${hashedNonce}`;
};

/**
 * Audit log event types for authentication events
 */
export enum AuthAuditEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
}

/**
 * Create an audit log entry for authentication events
 * 
 * @param userId User ID
 * @param eventType Type of authentication event
 * @param metadata Additional event metadata
 * @param ipAddress IP address of client
 * @param userAgent User agent of client
 */
export const createAuthAuditLog = async (
  userId: string,
  eventType: AuthAuditEventType,
  metadata: any = {},
  ipAddress?: string,
  userAgent?: string
) => {
  try {
    // Import here to avoid circular dependency
    const { prisma } = require('@proof-of-funds/db');
    
    await prisma.auditLog.create({
      data: {
        action: eventType,
        entityType: 'User',
        entityId: userId,
        userId,
        ipAddress,
        userAgent,
        metadata,
        timestamp: new Date()
      }
    });
  } catch (error) {
    // Log but don't fail the request if audit logging fails
    console.error('Failed to create auth audit log', error);
  }
};