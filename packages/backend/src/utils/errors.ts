/**
 * Custom error classes for the API
 * 
 * Provides standardized error handling across the application
 */

/**
 * API Error for standardized error responses
 */
export class ApiError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

/**
 * Unauthorized Error (401)
 */
export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * Forbidden Error (403)
 */
export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

/**
 * Bad Request Error (400)
 */
export class BadRequestError extends ApiError {
  constructor(message: string = 'Bad request') {
    super(message, 400);
  }
}

/**
 * Validation Error (422)
 */
export class ValidationError extends ApiError {
  details: any;
  
  constructor(message: string = 'Validation error', details: any = {}) {
    super(message, 422);
    this.details = details;
  }
}

/**
 * Rate Limit Error (429)
 */
export class RateLimitError extends ApiError {
  retryAfter: number;
  
  constructor(message: string = 'Too many requests', retryAfter: number = 60) {
    super(message, 429);
    this.retryAfter = retryAfter;
  }
}

/**
 * Service Unavailable Error (503)
 */
export class ServiceUnavailableError extends ApiError {
  constructor(message: string = 'Service unavailable') {
    super(message, 503);
  }
}

/**
 * Internal Server Error (500)
 */
export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error') {
    super(message, 500);
  }
}