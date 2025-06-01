/**
 * Enhanced Rate Limiting Middleware
 *
 * Comprehensive rate limiting that integrates with the IP reputation system
 * and applies different limits based on reputation score and endpoint sensitivity.
 * 
 * This is a core component of the Phase 2.2 Security Monitoring & Rate Limiting implementation.
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory, IRateLimiterOptions } from 'rate-limiter-flexible';
import { Redis } from 'ioredis';
import ipReputationTracker, { ReputationEvent } from '@proof-of-funds/common/security/ipReputationTracker';
import config from '../config';
import logger from '../utils/logger';

// Redis client for rate limiting
let redisClient: Redis | null = null;

// Try to initialize Redis
try {
  if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
    });
    console.log('Redis client initialized for enhanced rate limiting');
  }
} catch (error) {
  console.error('Failed to initialize Redis for rate limiting:', error);
  redisClient = null;
}

// Rate limiter types by resource
const rateLimiters = new Map<string, RateLimiterRedis | RateLimiterMemory>();

/**
 * Create a rate limiter for a specific resource
 * 
 * @param resource The resource identifier
 * @param options The rate limiter options
 * @returns A rate limiter instance
 */
function getRateLimiter(resource: string, options: IRateLimiterOptions): RateLimiterRedis | RateLimiterMemory {
  // Check if we already have a limiter for this resource
  if (rateLimiters.has(resource)) {
    return rateLimiters.get(resource)!;
  }
  
  // Create a new rate limiter
  let rateLimiter;
  
  // Use Redis if available, otherwise use memory
  if (redisClient) {
    rateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: `pof:ratelimit:${resource}:`,
      ...options
    });
  } else {
    rateLimiter = new RateLimiterMemory(options);
  }
  
  // Store for reuse
  rateLimiters.set(resource, rateLimiter);
  return rateLimiter;
}

/**
 * Calculate points to consume based on reputation score
 * Lower reputation = higher points consumption (stricter limits)
 * 
 * @param reputationScore The IP reputation score
 * @returns Points to consume for this request
 */
async function calculatePointsToConsume(reputationScore: number): Promise<number> {
  if (reputationScore >= 80) return 1;    // Good reputation: normal consumption
  if (reputationScore >= 50) return 2;    // Neutral reputation: 2x consumption
  if (reputationScore >= 30) return 4;    // Suspicious reputation: 4x consumption
  return 10;                             // Bad reputation: 10x consumption
}

/**
 * Enhanced rate limiting factory function
 * 
 * @param options Rate limiting options
 * @returns Middleware function
 */
export function createEnhancedRateLimiter(options: {
  resource: string;
  points?: number;
  duration?: number;
  blockDuration?: number;
}) {
  const {
    resource,
    points = 60,     // Default: 60 points per duration
    duration = 60,   // Default: 60 seconds (1 minute)
    blockDuration = 60 * 15  // Default: 15 minutes block on exceeded limit
  } = options;
  
  // Create rate limiter
  const rateLimiter = getRateLimiter(resource, {
    points,
    duration,
    blockDuration
  });
  
  // Return middleware function
  return async (req: Request, res: Response, next: NextFunction) => {
    // Get IP address
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    
    // Get user ID if authenticated
    const userId = (req as any).user?.id || 'anonymous';
    
    // Create a key that combines IP and user ID
    const key = `${ip}:${userId}`;
    
    try {
      // Get reputation score for this IP
      const reputationScore = await ipReputationTracker.getScore(ip);
      
      // Check if the IP is blocked
      const isBlocked = await ipReputationTracker.isBlocked(ip);
      
      // If the IP is blocked, reject immediately
      if (isBlocked) {
        // Log the blocked request
        logger.warn('Request from blocked IP rejected', {
          ip,
          userId,
          resource,
          reputationScore
        });
        
        // Set headers
        res.setHeader('Retry-After', blockDuration);
        
        // Return error
        return res.status(403).json({
          error: {
            code: 'IP_BLOCKED',
            message: 'Access denied due to suspicious activity'
          }
        });
      }
      
      // Calculate points to consume based on reputation
      const pointsToConsume = await calculatePointsToConsume(reputationScore);
      
      // Try to consume points
      const rateLimiterRes = await rateLimiter.consume(key, pointsToConsume);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', points);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimiterRes.remainingPoints));
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString());
      
      // Continue to the next middleware
      next();
    } catch (error) {
      // Check if this is a rate limit rejection error
      if (error.name === 'RateLimiterRes') {
        // Record rate limit exceeded event
        await ipReputationTracker.recordEvent(ip, ReputationEvent.RATE_LIMIT_EXCEEDED, {
          resource,
          userId
        });
        
        // Log the rate limit exceeded
        logger.warn('Rate limit exceeded', {
          ip,
          userId,
          resource,
          msBeforeNext: error.msBeforeNext
        });
        
        // Set headers
        res.setHeader('Retry-After', Math.ceil(error.msBeforeNext / 1000));
        res.setHeader('X-RateLimit-Limit', points);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + error.msBeforeNext).toISOString());
        
        // Return error
        return res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
            retryAfter: Math.ceil(error.msBeforeNext / 1000)
          }
        });
      }
      
      // For other errors, log and continue (fail open)
      logger.error('Rate limiting error', {
        ip,
        userId,
        resource,
        error: error.message
      });
      
      // Continue to the next middleware
      next();
    }
  };
}

// Pre-configured rate limiters for common resources

/**
 * Default API rate limit for most endpoints
 */
export const defaultRateLimit = createEnhancedRateLimiter({
  resource: 'default',
  points: config.rateLimit.maxRequests,
  duration: Math.floor(config.rateLimit.windowMs / 1000),
  blockDuration: 60 * 15 // 15 minutes
});

/**
 * Strict rate limit for authentication endpoints
 */
export const authRateLimit = createEnhancedRateLimiter({
  resource: 'auth',
  points: 10,              // 10 requests per 15 minutes
  duration: 60 * 15,       // 15 minutes
  blockDuration: 60 * 60   // 1 hour block
});

/**
 * Rate limit for proof generation endpoints
 */
export const proofRateLimit = createEnhancedRateLimiter({
  resource: 'proof',
  points: 20,              // 20 proofs per hour
  duration: 60 * 60,       // 1 hour
  blockDuration: 60 * 60 * 3 // 3 hour block
});

/**
 * Rate limit for verification endpoints
 */
export const verificationRateLimit = createEnhancedRateLimiter({
  resource: 'verification',
  points: 60,              // 60 verifications per minute
  duration: 60,            // 1 minute
  blockDuration: 60 * 30   // 30 minute block
});

/**
 * Rate limit for API access endpoints
 */
export const apiRateLimit = createEnhancedRateLimiter({
  resource: 'api',
  points: 300,             // 300 requests per minute
  duration: 60,            // 1 minute
  blockDuration: 60 * 15   // 15 minute block
});

// Export pre-configured rate limiters
export { createEnhancedRateLimiter };