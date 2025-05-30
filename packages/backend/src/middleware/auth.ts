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
      return res.status(401).json({ error: 'Authorization header missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
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
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      // Attach user info to request
      req.user = {
        id: user.id,
        address: user.address,
        permissions: user.permissions
      };

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: 'Authentication token expired' });
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: 'Invalid authentication token' });
      }
      throw error;
    }
  } catch (error) {
    logger.error('Authentication error:', { error });
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
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has required permissions
    const hasPermission = requiredPermissions.every(permission => 
      req.user!.permissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

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
      return res.status(401).json({ error: 'API key missing' });
    }

    // Find organization with the API key
    const organization = await prisma.organization.findUnique({
      where: { apiKey },
      select: { id: true }
    });

    if (!organization) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Store organization ID in request for later use
    req.headers['x-organization-id'] = organization.id;

    next();
  } catch (error) {
    logger.error('API Key authentication error:', { error });
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};