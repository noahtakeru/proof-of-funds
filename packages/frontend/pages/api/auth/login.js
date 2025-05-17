/**
 * Login API endpoint
 * 
 * This endpoint authenticates users via wallet signature
 * and issues a JWT token for API access.
 * 
 * Integrates with the existing wallet-based authentication
 * system used in the Proof of Funds application.
 */

import { ethers } from 'ethers';
import { generateToken, verifySignature } from '../../../utils/auth';
import { validateApiRequest, validators } from '../../../utils/apiValidator';
import { handleApiError } from '../../../utils/apiErrorHandler';
import rateLimiter from '../../../lib/rateLimit';

// Apply strict rate limiting to auth endpoints (3 attempts per minute)
const applyRateLimit = rateLimiter(3);

// Message for signature verification - consistent with main app
const SIGNATURE_MESSAGE = 'Sign this message to authenticate with Proof of Funds API';

// Admin wallet address - should be set in environment variables
const ADMIN_WALLET_ADDRESS = process.env.ADMIN_WALLET_ADDRESS || 
                             process.env.SERVICE_WALLET_PRIVATE_KEY_AMOY && 
                             new ethers.Wallet(process.env.SERVICE_WALLET_PRIVATE_KEY_AMOY).address;

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
      return res.status(400).json({
        error: 'Invalid input parameters',
        details: validation.errors
      });
    }
    
    // Extract validated data
    const { walletAddress, signature, message = SIGNATURE_MESSAGE } = validation.sanitizedData;
    
    // Verify signature
    const isValid = verifySignature(message, signature, walletAddress);
    if (!isValid) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid signature'
      });
    }
    
    // Determine if this is an admin wallet
    const isAdmin = ADMIN_WALLET_ADDRESS && 
                   walletAddress.toLowerCase() === ADMIN_WALLET_ADDRESS.toLowerCase();
    
    // Generate JWT token with appropriate role
    const token = generateToken(walletAddress, isAdmin ? 'admin' : 'user');
    
    // Return token and user data
    return res.status(200).json({
      success: true,
      token,
      user: {
        walletAddress,
        role: isAdmin ? 'admin' : 'user'
      }
    });
  } catch (error) {
    return handleApiError(error, res);
  }
}