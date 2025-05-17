/**
 * Authentication utilities for API endpoints
 * 
 * This module provides functions for secure API authentication
 * that integrates with the existing wallet-based auth system.
 */

const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');

// Secret key for JWT signing - in production, set through environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'proof-of-funds-jwt-secret-dev-only';
const JWT_EXPIRY = '24h'; // Token expiry time
const ADMIN_WALLET = process.env.ADMIN_WALLET_ADDRESS || '0xD6bd1eFCE3A2c4737856724f96F39037a3564890'; // Default to service wallet

// Standard signature message for wallet verification
const AUTH_MESSAGE = 'Sign this message to authenticate with Proof of Funds API';

/**
 * Generate a JWT for a wallet address
 * @param {string} walletAddress - Ethereum address
 * @param {string} role - User role (user, admin)
 * @returns {string} - JWT token
 */
function generateToken(walletAddress, role = 'user') {
  if (!walletAddress) {
    throw new Error('Wallet address required to generate token');
  }

  // Normalize the wallet address
  const normalizedAddress = walletAddress.toLowerCase();
  
  // Check if this is an admin wallet
  const isAdmin = normalizedAddress === ADMIN_WALLET.toLowerCase();
  
  // Create payload
  const payload = {
    walletAddress: normalizedAddress,
    role: isAdmin ? 'admin' : role,
    timestamp: Date.now()
  };

  // Sign the token
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY
  });
}

/**
 * Verify a signature from a wallet
 * @param {string} message - The message that was signed
 * @param {string} signature - The signature to verify
 * @param {string} walletAddress - The claimed wallet address
 * @returns {boolean} - Whether the signature is valid
 */
function verifySignature(message, signature, walletAddress) {
  try {
    // Recover the address from the signature
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    
    // Compare with the claimed address (case-insensitive)
    return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Verify a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object|null} - Decoded payload or null if invalid
 */
function verifyToken(token) {
  if (!token) {
    return null;
  }

  try {
    // Verify and decode the token
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
}

/**
 * Extract wallet info from authorization header
 * 
 * Supports both JWT Bearer tokens and wallet signature auth
 * @param {Object} req - Express request object
 * @returns {Object|null} - Auth data or null if invalid
 */
function getAuthFromRequest(req) {
  // Check for token in authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }
  
  // Handle JWT token
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (!token) return null;
    
    return { 
      type: 'jwt',
      data: verifyToken(token)
    };
  }
  
  // Handle API key for admin functions
  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey === process.env.ADMIN_API_KEY) {
    return {
      type: 'apikey',
      data: { role: 'admin' }
    };
  }
  
  return null;
}

/**
 * Flexible authentication middleware for API routes
 * 
 * This works with both JWT tokens from normal auth flow
 * and with the existing wallet-based signature system
 * 
 * @param {Function} handler - API route handler
 * @param {Object} options - Authentication options
 * @returns {Function} - Middleware-wrapped handler
 */
function withAuth(handler, options = {}) {
  const { requireAdmin = false, requireWallet = true } = options;
  
  return async (req, res) => {
    // Get auth data from request
    const auth = getAuthFromRequest(req);
    
    // No auth at all
    if (!auth) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required'
      });
    }
    
    // JWT authentication
    if (auth.type === 'jwt') {
      // Check if token payload is valid
      if (!auth.data) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Invalid authentication token'
        });
      }
      
      // Check for admin if required
      if (requireAdmin && auth.data.role !== 'admin') {
        return res.status(403).json({
          error: 'forbidden',
          message: 'Admin privileges required'
        });
      }
      
      // Check for wallet if required
      if (requireWallet && !auth.data.walletAddress) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Wallet authentication required'
        });
      }
      
      // Add user to request object
      req.user = auth.data;
    }
    
    // API key authentication (admin only)
    if (auth.type === 'apikey') {
      if (requireAdmin && auth.data.role !== 'admin') {
        return res.status(403).json({
          error: 'forbidden',
          message: 'Admin privileges required'
        });
      }
      
      req.user = { role: 'admin' };
    }
    
    // Call the original handler
    return handler(req, res);
  };
}

// Export the functions
module.exports = {
  generateToken,
  verifySignature,
  verifyToken,
  getAuthFromRequest,
  withAuth
};