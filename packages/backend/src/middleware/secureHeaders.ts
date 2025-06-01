/**
 * Secure Headers Middleware
 * 
 * Configures additional security headers beyond those provided by Helmet
 */

import { Request, Response, NextFunction } from 'express';
import config from '../config';

/**
 * Apply additional security headers not covered by helmet
 */
export function secureHeaders(req: Request, res: Response, next: NextFunction): void {
  // Set permissions policy (formerly feature policy)
  // Restricts which browser features the application can use
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), camera=(), microphone=(), payment=(), usb=(), bluetooth=(), magnetometer=(), accelerometer=(), gyroscope=()'
  );
  
  // Set cache control headers for dynamic content
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
  } else {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  // Set strict transport security header in production
  if (config.isProduction) {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Set cross-domain policies
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Clear site data on logout routes
  if (req.path.endsWith('/logout') && req.method === 'POST') {
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
  }
  
  next();
}

/**
 * Middleware to prevent clickjacking by setting X-Frame-Options
 */
export function preventFraming(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Frame-Options', 'DENY');
  next();
}

/**
 * Full secure headers middleware bundle
 */
export const secureHeadersBundle = [secureHeaders, preventFraming];