/**
 * Token Storage API
 * 
 * Provides endpoints for securely storing authentication tokens in HttpOnly cookies
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { validateCsrfToken } from '../../middleware/csrf';
import logger from '../../utils/logger';
import config from '../../config';

const router = Router();

// Cookie security settings
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'strict' as const,
  maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
  path: '/',
  domain: undefined // Uses the domain from the request
};

// Cookie names
const ACCESS_TOKEN_COOKIE = 'pof_access_token';
const REFRESH_TOKEN_COOKIE = 'pof_refresh_token';

/**
 * Store tokens in HttpOnly cookies
 * POST /api/auth/store-tokens
 */
router.post(
  '/store-tokens',
  validateCsrfToken,
  [
    body('accessToken').isString().isJWT(),
    body('refreshToken').isString().isJWT()
  ],
  (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid token format',
          errors: errors.array()
        });
      }

      const { accessToken, refreshToken } = req.body;

      // Set tokens as HttpOnly cookies
      res.cookie(ACCESS_TOKEN_COOKIE, accessToken, COOKIE_OPTIONS);
      res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);

      return res.status(200).json({
        success: true,
        message: 'Tokens stored securely'
      });
    } catch (error) {
      logger.error('Error storing tokens', {
        error: error instanceof Error ? error.message : String(error),
        ip: req.ip
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to store tokens'
      });
    }
  }
);

/**
 * Get token information
 * GET /api/auth/token-info
 */
router.get('/token-info', (req: Request, res: Response) => {
  try {
    // Check if tokens exist in cookies
    const accessToken = req.cookies[ACCESS_TOKEN_COOKIE];
    const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE];

    // Only provide minimal token info for security
    const tokenInfo = accessToken ? {
      sub: 'present',
      exp: 'present'
    } : null;

    return res.status(200).json({
      success: true,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      tokenInfo
    });
  } catch (error) {
    logger.error('Error getting token info', {
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to get token info'
    });
  }
});

/**
 * Clear token cookies
 * POST /api/auth/clear-tokens
 */
router.post('/clear-tokens', (req: Request, res: Response) => {
  try {
    // Clear token cookies
    res.clearCookie(ACCESS_TOKEN_COOKIE, { ...COOKIE_OPTIONS, maxAge: 0 });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { ...COOKIE_OPTIONS, maxAge: 0 });

    return res.status(200).json({
      success: true,
      message: 'Tokens cleared successfully'
    });
  } catch (error) {
    logger.error('Error clearing tokens', {
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to clear tokens'
    });
  }
});

export default router;