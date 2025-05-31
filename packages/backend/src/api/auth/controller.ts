/**
 * Authentication Controller
 * 
 * Handles user authentication via wallet signatures
 */
import { Request, Response, NextFunction } from 'express';
import { prisma, transaction } from '@proof-of-funds/db';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import config from '../../config';
import logger from '../../utils/logger';
import { ApiError } from '../../middleware/errorHandler';
import { verifySignature } from '../../utils/crypto';
import { generateNonce } from '../../utils/auth';
import { auditLogService } from '../../services/auditLogService';
import { AuditEventType, ActorType, AuditAction, AuditStatus, AuditSeverity } from '../../models/auditLog';

/**
 * Generate a nonce for wallet signature authentication
 */
export const getNonce = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      throw new ApiError(400, 'Wallet address is required', 'MISSING_ADDRESS');
    }

    // Generate a nonce
    const nonce = generateNonce(address);
    
    // Log nonce generation
    await auditLogService.log({
      eventType: AuditEventType.AUTH_LOGIN,
      actorType: ActorType.ANONYMOUS,
      action: AuditAction.EXECUTE,
      status: AuditStatus.PENDING,
      details: {
        address,
        action: 'nonce_generation'
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      severity: AuditSeverity.INFO
    });
    
    // Return the nonce
    res.status(200).json({
      nonce,
      message: `Sign this message to authenticate: ${nonce}`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Authenticate user based on wallet signature
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address, signature, nonce } = req.body;
    
    if (!address || !signature || !nonce) {
      throw new ApiError(400, 'Address, signature, and nonce are required', 'MISSING_PARAMS');
    }

    // Verify the signature
    const message = `Sign this message to authenticate: ${nonce}`;
    const isValid = await verifySignature(message, signature, address);
    
    if (!isValid) {
      // Log failed authentication attempt
      await auditLogService.log({
        eventType: AuditEventType.AUTH_LOGIN,
        actorType: ActorType.ANONYMOUS,
        action: AuditAction.LOGIN,
        status: AuditStatus.FAILURE,
        details: {
          address,
          reason: 'Invalid signature'
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        severity: AuditSeverity.WARNING
      });
      
      throw new ApiError(401, 'Invalid signature', 'INVALID_SIGNATURE');
    }

    // Find or create user
    const user = await transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: { address },
        select: {
          id: true,
          address: true,
          permissions: true,
          isActive: true,
          lastLoginAt: true
        }
      });

      if (!user) {
        // Create new user
        user = await tx.user.create({
          data: {
            id: uuidv4(),
            address,
            permissions: ['USER'], // Default permission
            lastLoginAt: new Date()
          },
          select: {
            id: true,
            address: true,
            permissions: true,
            isActive: true,
            lastLoginAt: true
          }
        });

        logger.info('New user created via wallet authentication', {
          userId: user.id,
          address: user.address
        });
      } else {
        // Update last login time
        await tx.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        });
      }

      return user;
    });

    // Check if user is active
    if (!user.isActive) {
      // Log inactive account access attempt
      await auditLogService.log({
        eventType: AuditEventType.AUTH_LOGIN,
        actorType: ActorType.USER,
        actorId: user.id,
        action: AuditAction.LOGIN,
        status: AuditStatus.FAILURE,
        details: {
          address: user.address,
          reason: 'Inactive account'
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        severity: AuditSeverity.WARNING
      });
      
      throw new ApiError(403, 'User account is inactive', 'INACTIVE_ACCOUNT');
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        address: user.address,
        permissions: user.permissions
      },
      config.jwt.secret,
      { expiresIn: config.jwt.accessTokenExpiry }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      {
        id: user.id,
        type: 'refresh'
      },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshTokenExpiry }
    );
    
    // Log successful authentication
    await auditLogService.log({
      eventType: AuditEventType.AUTH_LOGIN,
      actorType: ActorType.USER,
      actorId: user.id,
      action: AuditAction.LOGIN,
      status: AuditStatus.SUCCESS,
      details: {
        address: user.address,
        isNewUser: user.lastLoginAt === null
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      severity: AuditSeverity.INFO
    });

    res.status(200).json({
      token,
      refreshToken,
      user: {
        id: user.id,
        address: user.address,
        permissions: user.permissions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new ApiError(400, 'Refresh token is required', 'MISSING_REFRESH_TOKEN');
    }

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.secret) as {
        id: string;
        type: string;
      };

      // Check if it's a refresh token
      if (decoded.type !== 'refresh') {
        throw new ApiError(400, 'Invalid token type', 'INVALID_TOKEN_TYPE');
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          address: true,
          permissions: true,
          isActive: true
        }
      });

      if (!user || !user.isActive) {
        throw new ApiError(401, 'User not found or inactive', 'INVALID_USER');
      }

      // Generate new access token
      const newToken = jwt.sign(
        {
          id: user.id,
          address: user.address,
          permissions: user.permissions
        },
        config.jwt.secret,
        { expiresIn: config.jwt.accessTokenExpiry }
      );
      
      // Log token refresh
      await auditLogService.log({
        eventType: AuditEventType.AUTH_TOKEN_REFRESH,
        actorType: ActorType.USER,
        actorId: user.id,
        action: AuditAction.EXECUTE,
        status: AuditStatus.SUCCESS,
        details: {
          address: user.address
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        severity: AuditSeverity.INFO
      });

      res.status(200).json({
        token: newToken,
        user: {
          id: user.id,
          address: user.address,
          permissions: user.permissions
        }
      });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(401, 'Refresh token expired', 'TOKEN_EXPIRED');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(401, 'Invalid refresh token', 'INVALID_TOKEN');
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};