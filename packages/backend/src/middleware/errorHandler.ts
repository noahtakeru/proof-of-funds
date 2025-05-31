/**
 * Global error handling middleware
 * 
 * Provides centralized error handling for the API
 */
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import logger from '../utils/logger';
import config from '../config';
import { auditLogService } from '../services/auditLogService';
import { AuditEventType, ActorType, AuditAction, AuditStatus, AuditSeverity } from '../models/auditLog';

// Custom error class for API errors
export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(statusCode: number, message: string, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Global error handler middleware
 */
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Default error values
  let statusCode = 500;
  let errorMessage = 'Internal server error';
  let errorCode = 'INTERNAL_ERROR';
  let errorDetails = undefined;

  // Log the error
  logger.error('API Error:', { 
    error: err.message, 
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  // Create audit log for errors (focus on server errors and auth errors)
  if (statusCode >= 500 || statusCode === 401 || statusCode === 403) {
    const severity = statusCode >= 500 ? AuditSeverity.ERROR : AuditSeverity.WARNING;
    
    auditLogService.log({
      eventType: AuditEventType.SYSTEM_ERROR,
      actorType: req.user?.id ? ActorType.USER : ActorType.ANONYMOUS,
      actorId: req.user?.id,
      action: AuditAction.EXECUTE,
      status: AuditStatus.FAILURE,
      details: {
        path: req.path,
        method: req.method,
        statusCode,
        errorCode,
        errorMessage,
        // Don't include stack trace in audit log for security reasons
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      severity
    }).catch(logError => {
      // Log error but don't fail request handling
      logger.error('Failed to create error audit log', { error: logError });
    });
  }

  // Handle specific error types
  if (err instanceof ApiError) {
    // Our custom API error
    statusCode = err.statusCode;
    errorMessage = err.message;
    errorCode = err.code;
    errorDetails = err.details;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Prisma database errors
    statusCode = 400;
    errorCode = `DB_ERROR_${err.code}`;
    
    // Handle specific Prisma error codes
    switch (err.code) {
      case 'P2002': // Unique constraint violation
        errorMessage = 'Unique constraint violation';
        errorDetails = { fields: err.meta?.target as string[] };
        break;
      case 'P2025': // Record not found
        statusCode = 404;
        errorMessage = 'Record not found';
        break;
      default:
        errorMessage = 'Database error';
    }
  } else if (err instanceof SyntaxError && 'body' in err) {
    // JSON parsing error
    statusCode = 400;
    errorMessage = 'Invalid JSON in request body';
    errorCode = 'INVALID_JSON';
  }

  // Send response
  const response: any = {
    error: {
      code: errorCode,
      message: errorMessage
    }
  };

  // Include error details in non-production environments or when explicitly allowed
  if ((errorDetails && !config.isProduction) || (errorDetails && process.env.INCLUDE_ERROR_DETAILS === 'true')) {
    response.error.details = errorDetails;
  }

  // Include stack trace in development only
  if (config.isDevelopment && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * 404 Not Found handler for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
  logger.info(`Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.path}`
    }
  });
};