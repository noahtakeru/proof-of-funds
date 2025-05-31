/**
 * Authentication Routes
 */
import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../../middleware/validation';
import { authRateLimit } from '../../middleware/rateLimit';
import { authAuditMiddleware } from '../../middleware/auditMiddleware';
import * as authController from './controller';

const router = Router();

// Apply rate limiting to all auth routes
router.use(authRateLimit);

/**
 * GET /api/v1/auth/nonce
 * @description Get a nonce for wallet signature authentication
 */
router.post('/nonce',
  validate([
    body('address')
      .isString()
      .isLength({ min: 42, max: 42 })
      .withMessage('Valid Ethereum address is required')
  ]),
  authController.getNonce
);

/**
 * POST /api/v1/auth/authenticate
 * @description Authenticate user with wallet signature
 */
router.post('/authenticate',
  validate([
    body('address')
      .isString()
      .isLength({ min: 42, max: 42 })
      .withMessage('Valid Ethereum address is required'),
    body('signature')
      .isString()
      .withMessage('Valid signature is required'),
    body('nonce')
      .isString()
      .withMessage('Valid nonce is required')
  ]),
  authAuditMiddleware.login,
  authController.authenticate
);

/**
 * POST /api/v1/auth/refresh
 * @description Refresh access token
 */
router.post('/refresh',
  validate([
    body('refreshToken')
      .isString()
      .withMessage('Valid refresh token is required')
  ]),
  authAuditMiddleware.tokenRefresh,
  authController.refreshToken
);

export default router;