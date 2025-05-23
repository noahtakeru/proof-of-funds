/**
 * Token Refresh API Endpoint
 * 
 * Securely refreshes access tokens using a valid refresh token.
 * Implements token rotation for enhanced security.
 */

import { validateApiRequest, validators } from '../../../utils/apiValidator';
import { handleApiError } from '../../../utils/apiErrorHandler';
import rateLimiter from '../../../lib/rateLimit';
import auditLogger from '@proof-of-funds/common/logging/auditLogger';
import { refreshTokens } from '@proof-of-funds/common/auth/tokenManager';

// Apply rate limiting (10 attempts per minute)
const applyRateLimit = rateLimiter(10);

export default async function handler(req, res) {
  // Apply rate limiting
  const rateLimitResult = applyRateLimit(req, res);
  if (!rateLimitResult) {
    // Rate limit response already sent by the limiter
    return;
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'method_not_allowed',
      message: 'Only POST method is supported'
    });
  }

  try {
    // Validate request
    const validationSpec = {
      required: ['refreshToken'],
      fields: {
        refreshToken: [validators.isString]
      }
    };
    
    const validation = validateApiRequest(req.body, validationSpec);
    if (!validation.isValid) {
      // Log validation failure
      await auditLogger.log('auth.refresh.validation.failure', 
        { errors: validation.errors },
        auditLogger.getContextFromRequest(req)
      );
      
      return res.status(400).json({
        error: 'invalid_request',
        message: 'Refresh token is required',
        details: validation.errors
      });
    }
    
    // Extract refresh token
    const { refreshToken } = validation.sanitizedData;
    
    // Attempt to refresh the token
    const tokenPair = await refreshTokens(refreshToken);
    
    if (!tokenPair) {
      // Log refresh failure
      await auditLogger.log('auth.refresh.failure', 
        { reason: 'Invalid refresh token' },
        auditLogger.getContextFromRequest(req)
      );
      
      return res.status(401).json({
        error: 'invalid_token',
        message: 'The refresh token is invalid, expired, or has been revoked'
      });
    }
    
    // Log successful token refresh
    await auditLogger.log('auth.refresh.success', 
      { userId: tokenPair.userId },
      auditLogger.getContextFromRequest(req)
    );
    
    // Return new token pair
    return res.status(200).json({
      success: true,
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900 // 15 minutes in seconds
    });
  } catch (error) {
    // Log refresh error
    await auditLogger.log('auth.refresh.error',
      { error: error.message },
      auditLogger.getContextFromRequest(req)
    );
    
    return handleApiError(error, res);
  }
}