/**
 * Login API endpoint
 * 
 * This endpoint authenticates users via wallet signature
 * and issues JWT token pairs (access + refresh) for API access.
 * 
 * Integrates with the enhanced secure token management system
 * that supports token refresh and revocation for improved security.
 */

import { ethers } from 'ethers';
import { verifySignature, generateTokenPairForWallet, getAdminWalletAddress } from '../../../utils/auth';
import { validateApiRequest, validators } from '../../../utils/apiValidator';
import { handleApiError } from '../../../utils/apiErrorHandler';
import rateLimiter from '../../../lib/rateLimit';
import auditLogger from '@proof-of-funds/common/logging/auditLogger';

// Apply strict rate limiting to auth endpoints (3 attempts per minute)
const applyRateLimit = rateLimiter(3);

// Message for signature verification - consistent with main app
const SIGNATURE_MESSAGE = 'Sign this message to authenticate with Proof of Funds API';

export default async function handler(req, res) {
  // Apply rate limiting
  const rateLimitResult = applyRateLimit(req, res);
  if (!rateLimitResult) {
    // Rate limit exceeded response is handled by the limiter
    return;
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate request body
    const validationSpec = {
      required: ['walletAddress', 'signature'],
      fields: {
        walletAddress: [validators.isAddress],
        signature: [validators.isString],
        message: [validators.isString] // Optional custom message
      }
    };
    
    const validation = validateApiRequest(req.body, validationSpec);
    
    if (!validation.isValid) {
      // Log validation failure
      await auditLogger.log('auth.validation.failure', 
        { errors: validation.errors },
        auditLogger.getContextFromRequest(req)
      );
      
      return res.status(400).json({
        error: 'invalid_request',
        message: 'Invalid input parameters',
        details: validation.errors
      });
    }
    
    // Extract validated data
    const { walletAddress, signature, message = SIGNATURE_MESSAGE } = validation.sanitizedData;
    
    // Verify signature
    const isValid = verifySignature(message, signature, walletAddress);
    if (!isValid) {
      // Log signature verification failure
      await auditLogger.log('auth.signature.failure', 
        { walletAddress },
        auditLogger.getContextFromRequest(req)
      );
      
      return res.status(401).json({
        error: 'invalid_signature',
        message: 'Authentication failed: Invalid signature'
      });
    }
    
    // Determine if this is an admin wallet by securely retrieving admin address
    const adminWalletAddress = await getAdminWalletAddress();
    const isAdmin = adminWalletAddress && 
                    walletAddress.toLowerCase() === adminWalletAddress.toLowerCase();
    
    // Generate token pair (access + refresh) with appropriate role
    const tokenPair = await generateTokenPairForWallet(walletAddress, isAdmin ? 'admin' : 'user');
    
    // Log successful login
    await auditLogger.log('auth.login.success', 
      { walletAddress, role: isAdmin ? 'admin' : 'user' },
      auditLogger.getContextFromRequest(req)
    );
    
    // Return tokens and user data
    return res.status(200).json({
      success: true,
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900, // 15 minutes in seconds
      user: {
        walletAddress,
        role: isAdmin ? 'admin' : 'user'
      }
    });
  } catch (error) {
    // Log authentication error
    await auditLogger.log('auth.login.error',
      { error: error.message },
      auditLogger.getContextFromRequest(req)
    );
    
    return handleApiError(error, res);
  }
}