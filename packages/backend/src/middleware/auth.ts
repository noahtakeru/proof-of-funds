/**
 * Authentication middleware
 * 
 * Provides JWT-based authentication for protected routes
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@proof-of-funds/db';
import config from '../config';
import logger from '../utils/logger';
import { auditLogService } from '../services/auditLogService';
import { AuditEventType, ActorType, AuditAction, AuditStatus, AuditSeverity } from '../models/auditLog';

// Extend Express Request type to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        address: string;
        permissions: string[];
      };
    }
  }
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Audit failed authentication attempt - missing header
      auditLogService.log({
        eventType: AuditEventType.AUTH_LOGIN,
        actorType: ActorType.ANONYMOUS,
        action: AuditAction.LOGIN,
        status: AuditStatus.FAILURE,
        details: {
          reason: 'Missing or invalid authorization header',
          path: req.path,
          method: req.method
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        severity: AuditSeverity.WARNING
      }).catch(err => {
        logger.error('Failed to log authentication audit', { error: err });
      });
      
      return res.status(401).json({ error: 'Authorization header missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      // Audit failed authentication attempt - missing token
      auditLogService.log({
        eventType: AuditEventType.AUTH_LOGIN,
        actorType: ActorType.ANONYMOUS,
        action: AuditAction.LOGIN,
        status: AuditStatus.FAILURE,
        details: {
          reason: 'Authentication token missing',
          path: req.path,
          method: req.method
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        severity: AuditSeverity.WARNING
      }).catch(err => {
        logger.error('Failed to log authentication audit', { error: err });
      });
      
      return res.status(401).json({ error: 'Authentication token missing' });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, config.jwt.secret) as {
        id: string;
        address: string;
        permissions: string[];
      };

      // Find user in database
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, address: true, permissions: true, isActive: true }
      });

      // Check if user exists and is active
      if (!user || !user.isActive) {
        // Audit failed authentication attempt - user not found or inactive
        auditLogService.log({
          eventType: AuditEventType.AUTH_LOGIN,
          actorType: ActorType.ANONYMOUS,
          action: AuditAction.LOGIN,
          status: AuditStatus.FAILURE,
          details: {
            reason: 'User not found or inactive',
            userId: decoded.id,
            path: req.path,
            method: req.method
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          severity: AuditSeverity.WARNING
        }).catch(err => {
          logger.error('Failed to log authentication audit', { error: err });
        });
        
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      // Attach user info to request
      req.user = {
        id: user.id,
        address: user.address,
        permissions: user.permissions
      };
      
      // Log successful authentication
      auditLogService.log({
        eventType: AuditEventType.AUTH_LOGIN,
        actorId: user.id,
        actorType: ActorType.USER,
        action: AuditAction.LOGIN,
        status: AuditStatus.SUCCESS,
        details: {
          path: req.path,
          method: req.method
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        severity: AuditSeverity.INFO
      }).catch(err => {
        logger.error('Failed to log authentication audit', { error: err });
      });

      next();
    } catch (error) {
      // Determine the specific token error
      let reason = 'Invalid token';
      
      if (error instanceof jwt.TokenExpiredError) {
        reason = 'Token expired';
        
        // Audit failed authentication - token expired
        auditLogService.log({
          eventType: AuditEventType.AUTH_LOGIN,
          actorType: ActorType.ANONYMOUS,
          action: AuditAction.LOGIN,
          status: AuditStatus.FAILURE,
          details: {
            reason: 'Authentication token expired',
            path: req.path,
            method: req.method
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          severity: AuditSeverity.WARNING
        }).catch(err => {
          logger.error('Failed to log authentication audit', { error: err });
        });
        
        return res.status(401).json({ error: 'Authentication token expired' });
      }
      
      if (error instanceof jwt.JsonWebTokenError) {
        reason = 'Invalid token';
        
        // Audit failed authentication - invalid token
        auditLogService.log({
          eventType: AuditEventType.AUTH_LOGIN,
          actorType: ActorType.ANONYMOUS,
          action: AuditAction.LOGIN,
          status: AuditStatus.FAILURE,
          details: {
            reason: 'Invalid authentication token',
            path: req.path,
            method: req.method
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          severity: AuditSeverity.WARNING
        }).catch(err => {
          logger.error('Failed to log authentication audit', { error: err });
        });
        
        return res.status(401).json({ error: 'Invalid authentication token' });
      }
      
      throw error;
    }
  } catch (error) {
    logger.error('Authentication error:', { error });
    
    // Audit unhandled authentication error
    auditLogService.log({
      eventType: AuditEventType.AUTH_LOGIN,
      actorType: ActorType.ANONYMOUS,
      action: AuditAction.LOGIN,
      status: AuditStatus.FAILURE,
      details: {
        reason: 'Internal server error during authentication',
        path: req.path,
        method: req.method,
        error: error.message
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      severity: AuditSeverity.ERROR
    }).catch(err => {
      logger.error('Failed to log authentication audit', { error: err });
    });
    
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

/**
 * Middleware to check specific permissions
 * 
 * @param requiredPermissions Array of required permissions
 */
export const checkPermissions = (requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if user exists in request (authentication middleware should have attached it)
    if (!req.user) {
      // Audit permission check failure - no user
      auditLogService.log({
        eventType: AuditEventType.AUTH_LOGIN,
        actorType: ActorType.ANONYMOUS,
        action: AuditAction.EXECUTE,
        status: AuditStatus.FAILURE,
        details: {
          reason: 'Authentication required for permission check',
          requiredPermissions,
          path: req.path,
          method: req.method
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        severity: AuditSeverity.WARNING
      }).catch(err => {
        logger.error('Failed to log permission check audit', { error: err });
      });
      
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has required permissions
    const hasPermission = requiredPermissions.every(permission => 
      req.user!.permissions.includes(permission)
    );

    if (!hasPermission) {
      // Audit permission check failure - insufficient permissions
      auditLogService.log({
        eventType: AuditEventType.AUTH_LOGIN,
        actorId: req.user.id,
        actorType: ActorType.USER,
        action: AuditAction.EXECUTE,
        status: AuditStatus.FAILURE,
        details: {
          reason: 'Insufficient permissions',
          requiredPermissions,
          userPermissions: req.user.permissions,
          path: req.path,
          method: req.method
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        severity: AuditSeverity.WARNING
      }).catch(err => {
        logger.error('Failed to log permission check audit', { error: err });
      });
      
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Log successful permission check
    auditLogService.log({
      eventType: AuditEventType.AUTH_LOGIN,
      actorId: req.user.id,
      actorType: ActorType.USER,
      action: AuditAction.EXECUTE,
      status: AuditStatus.SUCCESS,
      details: {
        requiredPermissions,
        path: req.path,
        method: req.method
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      severity: AuditSeverity.INFO
    }).catch(err => {
      logger.error('Failed to log permission check audit', { error: err });
    });

    next();
  };
};

/**
 * Middleware to authenticate API key from headers
 */
export const authenticateApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      // Audit API key authentication failure - missing key
      auditLogService.log({
        eventType: AuditEventType.AUTH_LOGIN,
        actorType: ActorType.ANONYMOUS,
        action: AuditAction.LOGIN,
        status: AuditStatus.FAILURE,
        details: {
          reason: 'API key missing',
          path: req.path,
          method: req.method
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        severity: AuditSeverity.WARNING
      }).catch(err => {
        logger.error('Failed to log API key authentication audit', { error: err });
      });
      
      return res.status(401).json({ error: 'API key missing' });
    }

    // Find organization with the API key
    const organization = await prisma.organization.findUnique({
      where: { apiKey },
      select: { id: true }
    });

    if (!organization) {
      // Audit API key authentication failure - invalid key
      auditLogService.log({
        eventType: AuditEventType.AUTH_LOGIN,
        actorType: ActorType.ANONYMOUS,
        action: AuditAction.LOGIN,
        status: AuditStatus.FAILURE,
        details: {
          reason: 'Invalid API key',
          path: req.path,
          method: req.method
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        severity: AuditSeverity.WARNING
      }).catch(err => {
        logger.error('Failed to log API key authentication audit', { error: err });
      });
      
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Store organization ID in request for later use
    req.headers['x-organization-id'] = organization.id;
    
    // Log successful API key authentication
    auditLogService.log({
      eventType: AuditEventType.AUTH_LOGIN,
      actorType: ActorType.ORGANIZATION,
      actorId: organization.id,
      action: AuditAction.LOGIN,
      status: AuditStatus.SUCCESS,
      resourceType: 'organization',
      resourceId: organization.id,
      details: {
        path: req.path,
        method: req.method
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      severity: AuditSeverity.INFO
    }).catch(err => {
      logger.error('Failed to log API key authentication audit', { error: err });
    });

    next();
  } catch (error) {
    logger.error('API Key authentication error:', { error });
    
    // Audit unhandled API key authentication error
    auditLogService.log({
      eventType: AuditEventType.AUTH_LOGIN,
      actorType: ActorType.ANONYMOUS,
      action: AuditAction.LOGIN,
      status: AuditStatus.FAILURE,
      details: {
        reason: 'Internal server error during API key authentication',
        path: req.path,
        method: req.method,
        error: error.message
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      severity: AuditSeverity.ERROR
    }).catch(err => {
      logger.error('Failed to log API key authentication audit', { error: err });
    });
    
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};