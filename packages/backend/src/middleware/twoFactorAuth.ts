/**
 * Two-Factor Authentication Middleware
 * 
 * This middleware handles 2FA verification in the authentication flow.
 */

import { Request, Response, NextFunction } from 'express';
import { isTwoFactorRequired } from '../services/twoFactorService';
import logger from '../utils/logger';
import { auditLogService } from '../services/auditLogService';
import { AuditEventType, ActorType, AuditAction, AuditStatus, AuditSeverity } from '../models/auditLog';

/**
 * Extend Express Request type to include 2FA information
 */
declare global {
  namespace Express {
    interface Request {
      twoFactorAuth?: {
        required: boolean;
        verified: boolean;
      };
    }
  }
}

/**
 * Middleware to check if 2FA is required for a user
 * This middleware should be used after the authentication middleware
 */
export const checkTwoFactorRequired = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Initialize default 2FA state
    req.twoFactorAuth = {
      required: false,
      verified: false
    };
    
    // Skip 2FA check if user is not authenticated
    if (!req.user || !req.user.id) {
      return next();
    }
    
    // Check if 2FA is required for this user
    const required = await isTwoFactorRequired(req.user.id);
    
    // Add 2FA status to request
    req.twoFactorAuth.required = required;
    
    // Log 2FA requirement check
    logger.debug('2FA requirement check', {
      userId: req.user.id,
      required,
      path: req.path
    });
    
    next();
  } catch (error) {
    logger.error('Failed to check 2FA requirement', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Default to not requiring 2FA on error to prevent lockouts
    req.twoFactorAuth = {
      required: false,
      verified: false
    };
    
    next();
  }
};

/**
 * Middleware to verify 2FA for protected routes
 * This middleware should be used after the authentication and checkTwoFactorRequired middleware
 * Routes that require 2FA verification should use this middleware
 */
export const requireTwoFactor = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip check if 2FA is not required
    if (!req.twoFactorAuth?.required) {
      return next();
    }
    
    // Check if 2FA has been verified for this session
    if (!req.twoFactorAuth.verified) {
      // Log 2FA verification failure
      if (req.user?.id) {
        auditLogService.log({
          eventType: AuditEventType.TWO_FACTOR_VERIFICATION,
          actorId: req.user.id,
          actorType: ActorType.USER,
          action: AuditAction.ACCESS,
          status: AuditStatus.FAILURE,
          details: {
            reason: '2FA verification required',
            path: req.path,
            method: req.method
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          severity: AuditSeverity.WARNING
        }).catch(err => {
          logger.error('Failed to log 2FA verification audit', { error: err });
        });
      }
      
      return res.status(403).json({
        success: false,
        message: 'Two-factor authentication verification required',
        requiresTwoFactor: true
      });
    }
    
    // Log successful 2FA-verified access
    if (req.user?.id) {
      auditLogService.log({
        eventType: AuditEventType.TWO_FACTOR_VERIFICATION,
        actorId: req.user.id,
        actorType: ActorType.USER,
        action: AuditAction.ACCESS,
        status: AuditStatus.SUCCESS,
        details: {
          path: req.path,
          method: req.method
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        severity: AuditSeverity.INFO
      }).catch(err => {
        logger.error('Failed to log 2FA verification audit', { error: err });
      });
    }
    
    next();
  } catch (error) {
    logger.error('Failed to verify 2FA requirement', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error during 2FA verification'
    });
  }
};

/**
 * Middleware to mark 2FA as verified for the current request
 * This should be called after successful 2FA verification
 */
export const markTwoFactorVerified = (req: Request, res: Response, next: NextFunction) => {
  // Initialize 2FA state if not already present
  if (!req.twoFactorAuth) {
    req.twoFactorAuth = {
      required: false,
      verified: false
    };
  }
  
  // Mark 2FA as verified
  req.twoFactorAuth.verified = true;
  
  next();
};