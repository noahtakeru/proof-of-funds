/**
 * CSRF Protection Middleware
 * 
 * Provides Cross-Site Request Forgery protection for the API
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';
import config from '../config';

// Constant for CSRF token validation
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

// Environment checks
const skipInDevelopment = !config.isProduction && process.env.DISABLE_CSRF === 'true';

/**
 * Generate a secure random CSRF token
 * @returns Randomly generated token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware to set CSRF token cookie
 */
export function setCsrfToken(req: Request, res: Response, next: NextFunction): void {
  // Skip in development if enabled
  if (skipInDevelopment) {
    return next();
  }
  
  // Only set token on initial page load
  if (req.method === 'GET' && !req.xhr && req.headers.accept?.includes('text/html')) {
    const token = generateCsrfToken();
    
    // Set CSRF cookie with appropriate security settings
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    });
    
    // Store token in request for templates
    res.locals.csrfToken = token;
  }
  
  next();
}

/**
 * Middleware to validate CSRF token
 * This should be applied to all state-changing routes (POST, PUT, DELETE)
 */
export function validateCsrfToken(req: Request, res: Response, next: NextFunction): void {
  // Skip in development if enabled
  if (skipInDevelopment) {
    return next();
  }
  
  // Skip validation for GET and HEAD requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Get tokens from cookie and header
  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME.toLowerCase()] as string;
  
  // Validate presence of tokens
  if (!cookieToken || !headerToken) {
    logger.warn('CSRF validation failed: missing token', {
      path: req.path,
      method: req.method,
      hasCookieToken: !!cookieToken,
      hasHeaderToken: !!headerToken,
      ip: req.ip
    });
    
    return res.status(403).json({
      error: {
        code: 'INVALID_CSRF',
        message: 'Invalid or missing CSRF token'
      }
    });
  }
  
  // Validate token match
  if (cookieToken !== headerToken) {
    logger.warn('CSRF validation failed: token mismatch', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    
    return res.status(403).json({
      error: {
        code: 'INVALID_CSRF',
        message: 'Invalid CSRF token'
      }
    });
  }
  
  // Token is valid, continue
  next();
}

/**
 * Full CSRF protection middleware
 * Combines setting and validating CSRF tokens
 */
export const csrfProtection = [setCsrfToken, validateCsrfToken];