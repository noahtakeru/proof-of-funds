/**
 * Two-Factor Authentication API Routes
 * 
 * This file contains API endpoints for managing two-factor authentication.
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../../middleware/auth';
import { twoFactorRateLimit } from '../../middleware/rateLimit';
import { validateCsrfToken } from '../../middleware/csrf';
import * as twoFactorService from '../../services/twoFactorService';
import logger from '../../utils/logger';

const router = express.Router();

/**
 * Initialize 2FA setup
 * POST /api/user/2fa/setup
 * 
 * Generates a new TOTP secret and QR code for the user
 */
router.post('/setup', authenticate, validateCsrfToken, async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get user ID and email/label from request
    const userId = req.user.id;
    const username = req.body.username || req.user.email || '';

    // Initialize 2FA setup
    const result = await twoFactorService.initializeTwoFactor(userId, username);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      secret: result.secret,
      qrCodeUrl: result.qrCodeUrl,
      message: result.message
    });
  } catch (error) {
    logger.error('2FA setup endpoint error', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to set up 2FA. Please try again later.'
    });
  }
});

/**
 * Verify 2FA token during setup
 * POST /api/user/2fa/verify
 * 
 * Verifies a TOTP token and confirms 2FA setup
 */
router.post(
  '/verify',
  authenticate,
  validateCsrfToken,
  [body('token').isString().isLength({ min: 6, max: 10 })],
  async (req, res) => {
    try {
      // Validate request body
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code format',
          errors: errors.array()
        });
      }

      // Ensure user is authenticated
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userId = req.user.id;
      const { token } = req.body;

      // Verify the provided token
      const verificationResult = await twoFactorService.verifyTwoFactorToken(
        userId,
        token
      );

      if (!verificationResult.isValid) {
        return res.status(400).json({
          success: false,
          message: verificationResult.message
        });
      }

      // If verification succeeded, confirm 2FA setup
      const confirmationResult = await twoFactorService.confirmTwoFactor(userId);

      return res.status(200).json({
        success: true,
        message: 'Two-factor authentication has been enabled',
        backupCodes: confirmationResult.backupCodes
      });
    } catch (error) {
      logger.error('2FA verification endpoint error', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to verify 2FA token. Please try again later.'
      });
    }
  }
);

/**
 * Validate 2FA token during login
 * POST /api/user/2fa/validate
 * 
 * Validates a TOTP token during the login process
 * Rate limited to 5 attempts per 30 minutes per IP address
 */
router.post(
  '/validate',
  twoFactorRateLimit,
  validateCsrfToken,
  [body('userId').isUUID(), body('token').isString().isLength({ min: 6, max: 10 })],
  async (req, res) => {
    try {
      // Validate request body
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request parameters',
          errors: errors.array()
        });
      }

      const { userId, token } = req.body;

      // Verify the provided token
      const verificationResult = await twoFactorService.verifyTwoFactorToken(
        userId,
        token
      );

      return res.status(200).json({
        success: verificationResult.isValid,
        message: verificationResult.message
      });
    } catch (error) {
      logger.error('2FA validation endpoint error', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.body.userId
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to validate 2FA token. Please try again later.'
      });
    }
  }
);

/**
 * Disable 2FA
 * POST /api/user/2fa/disable
 * 
 * Disables 2FA for the authenticated user
 */
router.post(
  '/disable',
  authenticate,
  validateCsrfToken,
  [body('token').isString().isLength({ min: 6, max: 10 })],
  async (req, res) => {
    try {
      // Validate request body
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code format',
          errors: errors.array()
        });
      }

      // Ensure user is authenticated
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userId = req.user.id;
      const { token } = req.body;

      // Verify the provided token before allowing 2FA to be disabled
      const verificationResult = await twoFactorService.verifyTwoFactorToken(
        userId,
        token
      );

      if (!verificationResult.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code. For security reasons, you must verify your identity before disabling 2FA.'
        });
      }

      // Disable 2FA
      const disableResult = await twoFactorService.disableTwoFactor(userId);

      return res.status(200).json({
        success: disableResult.success,
        message: disableResult.message
      });
    } catch (error) {
      logger.error('2FA disable endpoint error', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to disable 2FA. Please try again later.'
      });
    }
  }
);

/**
 * Generate new backup codes
 * POST /api/user/2fa/backup-codes
 * 
 * Generates new backup codes for the authenticated user
 */
router.post(
  '/backup-codes',
  authenticate,
  validateCsrfToken,
  [body('token').isString().isLength({ min: 6, max: 10 })],
  async (req, res) => {
    try {
      // Validate request body
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code format',
          errors: errors.array()
        });
      }

      // Ensure user is authenticated
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userId = req.user.id;
      const { token } = req.body;

      // Verify the provided token before generating new backup codes
      const verificationResult = await twoFactorService.verifyTwoFactorToken(
        userId,
        token
      );

      if (!verificationResult.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code. For security reasons, you must verify your identity before generating new backup codes.'
        });
      }

      // Generate new backup codes
      const backupCodesResult = await twoFactorService.generateBackupCodes(userId);

      return res.status(200).json({
        success: backupCodesResult.success,
        message: backupCodesResult.message,
        backupCodes: backupCodesResult.codes
      });
    } catch (error) {
      logger.error('2FA backup codes generation endpoint error', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to generate backup codes. Please try again later.'
      });
    }
  }
);

/**
 * Get 2FA status
 * GET /api/user/2fa/status
 * 
 * Returns the current 2FA status for the authenticated user
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.user.id;

    // Get 2FA status
    const status = await twoFactorService.getTwoFactorStatus(userId);

    return res.status(200).json({
      success: true,
      isEnabled: status.isEnabled,
      isConfirmed: status.isConfirmed,
      backupCodesCount: status.backupCodesCount
    });
  } catch (error) {
    logger.error('2FA status endpoint error', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to get 2FA status. Please try again later.'
    });
  }
});

/**
 * Complete login with 2FA token
 * POST /api/user/2fa/complete-login
 * 
 * Completes the login process with a verified 2FA token
 * Rate limited to 5 attempts per 30 minutes per IP address
 */
router.post(
  '/complete-login',
  twoFactorRateLimit,
  validateCsrfToken,
  [body('userId').isUUID(), body('token').isString().isLength({ min: 6, max: 10 })],
  async (req, res) => {
    try {
      // Validate request body
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request parameters',
          errors: errors.array()
        });
      }

      const { userId, token } = req.body;

      // Verify the provided token
      const verificationResult = await twoFactorService.verifyTwoFactorToken(
        userId,
        token
      );

      if (!verificationResult.isValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid verification code'
        });
      }

      // Get the user details
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          walletAddress: true,
          permissions: true,
          twoFactorEnabled: true
        }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Generate tokens for the authenticated user
      const { generateAccessToken, generateRefreshToken } = await import('../../utils/auth');
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Log successful login with 2FA
      logger.info('User completed login with 2FA', { userId });
      
      // Audit log entry
      await auditLogService.log({
        eventType: AuditEventType.TWO_FACTOR_VERIFICATION,
        actorId: userId,
        actorType: ActorType.USER,
        action: AuditAction.LOGIN,
        status: AuditStatus.SUCCESS,
        details: {
          tokenType: 'TOTP',
          twoFactorUsed: true
        },
        severity: AuditSeverity.INFO
      });

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        tokens: {
          accessToken,
          refreshToken
        },
        user: {
          id: user.id,
          email: user.email,
          walletAddress: user.walletAddress,
          permissions: user.permissions,
          twoFactorEnabled: user.twoFactorEnabled
        }
      });
    } catch (error) {
      logger.error('2FA complete login endpoint error', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.body.userId
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to complete login. Please try again later.'
      });
    }
  }
);

export default router;