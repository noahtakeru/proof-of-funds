/**
 * Security middleware
 * 
 * Provides essential security middleware for the API
 */
import cors from 'cors';
import helmet from 'helmet';
import { NextFunction, Request, Response } from 'express';
import config from '../config';

// Configure CORS middleware with appropriate options
export const corsMiddleware = cors({
  origin: config.server.corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
  credentials: true,
  maxAge: 86400 // 24 hours
});

// Configure Helmet middleware with appropriate security headers
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", ...config.server.corsOrigins],
    }
  },
  crossOriginEmbedderPolicy: false, // Needed for some iframe scenarios
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // Allow wallet popups
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin resources
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// Middleware to require HTTPS in production
export const requireHttps = (req: Request, res: Response, next: NextFunction) => {
  if (config.isProduction && !req.secure && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
};

// Track and log request metrics
export const requestMetrics = (req: Request, res: Response, next: NextFunction) => {
  // Record start time
  const startTime = Date.now();
  
  // Finish event handler
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    
    // Add custom header with response time
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    // Log request info unless it's a health check (to reduce noise)
    if (!req.path.includes('/health')) {
      req.app.get('logger')[logLevel]('Request processed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
    }
  });
  
  next();
};