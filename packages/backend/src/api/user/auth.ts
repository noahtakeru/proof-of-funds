/**
 * Email Authentication API Endpoints
 * 
 * Provides REST API for email-based authentication
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { validate } from '../../middleware/validation';
import { authRateLimit } from '../../middleware/rateLimit';
import { authAuditMiddleware } from '../../middleware/auditMiddleware';
import { authenticate } from '../../middleware/auth';
import * as emailAuthService from '../../services/emailAuthService';
import * as emailVerificationService from '../../services/emailVerificationService';
import { ApiError } from '../../middleware/errorHandler';
import logger from '../../utils/logger';

const router = Router();

// Apply rate limiting to all email auth routes
router.use(authRateLimit);

/**
 * POST /api/user/auth/register
 * Register a new user with email and password
 */
router.post('/register',
  validate([
    body('email')
      .isEmail()
      .withMessage('Valid email address is required')
      .normalizeEmail(),
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
  ]),
  authAuditMiddleware.register,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      
      // Get base URL for verification email
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      // Register user
      const result = await emailAuthService.registerWithEmail(email, password, baseUrl);
      
      return res.status(result.success ? 201 : 400).json({
        success: result.success,
        message: result.message,
        userId: result.success ? result.userId : undefined
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/user/auth/login
 * Log in with email and password
 */
router.post('/login',
  validate([
    body('email')
      .isEmail()
      .withMessage('Valid email address is required')
      .normalizeEmail(),
    body('password')
      .isString()
      .withMessage('Password is required')
  ]),
  authAuditMiddleware.login,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      
      // Login with email
      const result = await emailAuthService.loginWithEmail(email, password);
      
      return res.status(result.success ? 200 : 401).json({
        success: result.success,
        message: result.message,
        ...(result.success && {
          token: result.tokens?.accessToken,
          refreshToken: result.tokens?.refreshToken,
          user: result.user
        })
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/user/auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password',
  validate([
    body('email')
      .isEmail()
      .withMessage('Valid email address is required')
      .normalizeEmail()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      
      // Get base URL for reset email
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      // Request password reset
      const result = await emailAuthService.requestPasswordReset(email, baseUrl);
      
      return res.status(200).json({
        success: result.success,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/user/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password',
  validate([
    body('token')
      .isString()
      .withMessage('Token is required'),
    body('newPassword')
      .isString()
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, newPassword } = req.body;
      
      // Reset password
      const result = await emailAuthService.resetPassword(token, newPassword);
      
      return res.status(result.success ? 200 : 400).json({
        success: result.success,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/user/auth/change-password
 * Change password for authenticated user
 */
router.post('/change-password',
  authenticate,
  validate([
    body('currentPassword')
      .isString()
      .withMessage('Current password is required'),
    body('newPassword')
      .isString()
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      // Ensure user is authenticated
      if (!req.user || !req.user.id) {
        throw new ApiError(401, 'User not authenticated', 'NOT_AUTHENTICATED');
      }
      
      // Change password
      const result = await emailAuthService.changePassword(req.user.id, currentPassword, newPassword);
      
      return res.status(result.success ? 200 : 400).json({
        success: result.success,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/user/auth/verify-email
 * Verify email with token
 */
router.get('/verify-email',
  validate([
    body('token')
      .isString()
      .withMessage('Token is required')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.query.token as string;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification token is required'
        });
      }
      
      // Verify email
      const userId = await emailVerificationService.verifyEmail(token);
      
      return res.status(userId ? 200 : 400).json({
        success: !!userId,
        message: userId 
          ? 'Email verified successfully. You can now log in.' 
          : 'Invalid or expired verification token.'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/user/auth/resend-verification
 * Resend verification email for authenticated user
 */
router.post('/resend-verification',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Ensure user is authenticated
      if (!req.user || !req.user.id) {
        throw new ApiError(401, 'User not authenticated', 'NOT_AUTHENTICATED');
      }
      
      // Get base URL for verification email
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      // Resend verification email
      const success = await emailVerificationService.resendVerificationEmail(req.user.id, baseUrl);
      
      return res.status(success ? 200 : 400).json({
        success,
        message: success 
          ? 'Verification email sent successfully. Please check your inbox.' 
          : 'Failed to send verification email. Please try again later.'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;