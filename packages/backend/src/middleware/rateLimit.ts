/**
 * Rate limiting middleware
 * 
 * Provides protection against abuse by limiting request rates
 */
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import config from '../config';
import logger from '../utils/logger';

// Default rate limit configuration
const defaultRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  handler: (req: Request, res: Response, next: NextFunction, options: any) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(429).json(options.message);
  }
});

// More strict rate limit for authentication routes
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later'
    }
  },
  handler: (req: Request, res: Response, next: NextFunction, options: any) => {
    logger.warn('Authentication rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(429).json(options.message);
  }
});

// ZK proof generation rate limit
const proofRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 proofs per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'PROOF_RATE_LIMIT_EXCEEDED',
      message: 'Too many proof generations, please try again later'
    }
  },
  handler: (req: Request, res: Response, next: NextFunction, options: any) => {
    logger.warn('Proof generation rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      user: req.user?.id
    });
    res.status(429).json(options.message);
  }
});

export { defaultRateLimit, authRateLimit, proofRateLimit };