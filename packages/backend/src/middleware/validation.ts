/**
 * Request validation middleware
 * 
 * Provides schema-based validation for API request data
 */
import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ApiError } from './errorHandler';

/**
 * Validates request against provided validation chains
 * 
 * @param validations Array of express-validator validation chains
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Execute all validations
    await Promise.all(validations.map(validation => validation.run(req)));
    
    // Check for validation errors
    const errors = validationResult(req);
    
    if (errors.isEmpty()) {
      return next();
    }
    
    // Format validation errors
    const formattedErrors = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : undefined,
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined
    }));
    
    // Throw API error with validation details
    next(new ApiError(
      400, 
      'Validation failed', 
      'VALIDATION_ERROR',
      { errors: formattedErrors }
    ));
  };
};

/**
 * Validates content type for specific routes
 * 
 * @param contentType Expected content type
 */
export const validateContentType = (contentType: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestContentType = req.headers['content-type'];
    
    if (!requestContentType || !requestContentType.includes(contentType)) {
      return next(new ApiError(
        415, 
        `Unsupported content type, expected: ${contentType}`,
        'UNSUPPORTED_CONTENT_TYPE'
      ));
    }
    
    next();
  };
};