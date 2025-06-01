/**
 * Wallet Authentication Logger Middleware
 * 
 * This middleware logs wallet authentication events using the audit log service.
 * It creates a comprehensive audit trail of all wallet-based logins.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '@proof-of-funds/db';
import logger from '../utils/logger';
import { auditLogService } from '../services/auditLogService';
import { AuditEventType, ActorType, AuditAction, AuditStatus, AuditSeverity } from '../models/auditLog';

/**
 * Log a successful wallet authentication using the audit log service
 * 
 * @param req - Express request
 * @param userId - User ID
 * @param walletAddress - Wallet address
 * @param chainId - Chain ID
 * @param signedMessage - Signed message
 * @param signature - Signature
 */
export async function logWalletAuthentication(
  req: Request,
  userId: string,
  walletAddress: string,
  chainId: number,
  signedMessage: string,
  signature: string
): Promise<void> {
  try {
    // Update user's last login time
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() }
    });
    
    // Create audit log entry
    await auditLogService.log({
      eventType: AuditEventType.AUTH_LOGIN,
      actorId: userId,
      actorType: ActorType.USER,
      action: AuditAction.LOGIN,
      status: AuditStatus.SUCCESS,
      details: {
        walletAddress,
        chainId,
        loginType: 'wallet',
        signedMessage, // Include the message that was signed
        signaturePrefix: signature.substring(0, 10) + '...' // First few chars of signature for reference
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
      severity: AuditSeverity.INFO
    });
    
    // Application logging
    logger.info('Wallet authentication successful', {
      userId,
      walletAddress,
      chainId,
      timestamp: new Date()
    });
  } catch (error) {
    // Log error but don't block the authentication process
    logger.error('Failed to log wallet authentication', {
      userId,
      walletAddress,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Try to create audit log entry for the failure
    try {
      await auditLogService.log({
        eventType: AuditEventType.AUTH_LOGIN,
        actorId: userId,
        actorType: ActorType.USER,
        action: AuditAction.LOGIN,
        status: AuditStatus.SUCCESS, // Auth was successful even if logging had issues
        details: {
          walletAddress,
          chainId,
          loginType: 'wallet',
          loggingError: error instanceof Error ? error.message : String(error)
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        severity: AuditSeverity.INFO
      });
    } catch (auditError) {
      logger.error('Failed to create audit log for wallet authentication', {
        userId,
        walletAddress,
        error: auditError instanceof Error ? auditError.message : String(auditError)
      });
    }
  }
}

/**
 * Middleware to log wallet authentication attempts
 */
export function walletAuthLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Store original send method
  const originalSend = res.send;
  
  // Override send method to intercept response
  res.send = function(body) {
    try {
      // Parse response body
      const responseBody = typeof body === 'string' ? JSON.parse(body) : body;
      
      // Check if authentication was successful
      if (responseBody.success && responseBody.user && responseBody.user.id && responseBody.user.walletAddress) {
        // Extract wallet authentication data from request and response
        const { id: userId, walletAddress } = responseBody.user;
        
        // Extract chain ID, message, and signature from request
        const { chainId = 1, message, signature } = req.body;
        
        // Log successful authentication
        logWalletAuthentication(
          req,
          userId,
          walletAddress,
          chainId,
          message,
          signature
        ).catch(error => {
          logger.error('Failed to log wallet authentication in middleware', {
            userId,
            walletAddress,
            error: error instanceof Error ? error.message : String(error)
          });
        });
      }
    } catch (error) {
      // Log error but don't block the response
      logger.error('Error in wallet auth logger middleware', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Call original send method
    return originalSend.call(this, body);
  };
  
  // Continue to next middleware
  next();
}

export default walletAuthLoggerMiddleware;