/**
 * Authentication utilities for API endpoints
 * 
 * This module provides functions for secure API authentication
 * that integrates with the existing wallet-based auth system.
 */

const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
// Using local shims instead of common package to fix build issues
const { getSecret } = require('./shims/config/secrets');

// Simple implementation of generateTokenPair for the auth module
// This matches the functionality from @proof-of-funds/common/src/auth/tokenManager
async function generateTokenPair(payload, options = {}) {
  const {
    accessExpiresIn = '15m',
    refreshExpiresIn = '7d'
  } = options;

  // Get the JWT secret
  const jwtSecret = await getSecret('JWT_SECRET', { 
    required: true,
    fallback: process.env.NODE_ENV !== 'production' ? 
      'proof-of-funds-jwt-secret-dev-only' : null
  });

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required but not found');
  }

  // Generate access token
  const accessToken = jwt.sign(
    { ...payload, type: 'access' },
    jwtSecret,
    { expiresIn: accessExpiresIn }
  );

  // Generate refresh token
  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    jwtSecret,
    { expiresIn: refreshExpiresIn }
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60 // 15 minutes in seconds
  };
}

// Token expiry time
const JWT_EXPIRY = '24h'; 

// Standard signature message for wallet verification
const AUTH_MESSAGE = 'Sign this message to authenticate with Proof of Funds API';

/**
 * Get admin wallet address from secure storage
 * @returns {Promise<string>} Admin wallet address
 */
async function getAdminWalletAddress() {
  return await getSecret('ADMIN_WALLET_ADDRESS', {
    required: false,
    fallback: '0xD6bd1eFCE3A2c4737856724f96F39037a3564890' // Default to service wallet for dev only
  });
}

/**
 * Get JWT secret securely from environment or Secret Manager
 * @returns {Promise<string>} JWT secret
 */
async function getJwtSecret() {
  const secret = await getSecret('JWT_SECRET', {
    required: true,
    fallback: process.env.NODE_ENV !== 'production' ? 
      'proof-of-funds-jwt-secret-dev-only' : null
  });
  
  if (!secret) {
    throw new Error('JWT_SECRET is required but not found');
  }
  
  return secret;
}

/**
 * Generate a JWT for a wallet address
 * @param {string} walletAddress - Ethereum address
 * @param {string} role - User role (user, admin)
 * @returns {Promise<string>} - JWT token
 */
async function generateToken(walletAddress, role = 'user') {
  if (!walletAddress) {
    throw new Error('Wallet address required to generate token');
  }

  // Normalize the wallet address
  const normalizedAddress = walletAddress.toLowerCase();
  
  // Get admin wallet address
  const ADMIN_WALLET = await getAdminWalletAddress();
  
  // Check if this is an admin wallet
  const isAdmin = normalizedAddress === ADMIN_WALLET.toLowerCase();
  
  // Create payload
  const payload = {
    walletAddress: normalizedAddress,
    role: isAdmin ? 'admin' : role,
    timestamp: Date.now()
  };

  // Get JWT secret securely
  const JWT_SECRET = await getJwtSecret();
  
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
    // Ensure we're using ethers in a version-compatible way
    let recoveredAddress;
    
    // ethers v5 uses utils.verifyMessage, v6 uses verifyMessage on the ethers object
    if (ethers.utils && ethers.utils.verifyMessage) {
      // ethers v5
      recoveredAddress = ethers.utils.verifyMessage(message, signature);
    } else if (ethers.verifyMessage) {
      // ethers v6
      recoveredAddress = ethers.verifyMessage(message, signature);
    } else {
      throw new Error('Incompatible ethers version');
    }
    
    // Compare with the claimed address (case-insensitive)
    return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Verify a JWT token using secure JWT secret retrieval
 * @param {string} token - JWT token to verify
 * @returns {Promise<Object|null>} - Decoded payload or null if invalid
 */
async function verifyToken(token) {
  if (!token) {
    return null;
  }

  try {
    // Get JWT secret securely
    const jwtSecret = await getJwtSecret();
    
    // Verify and decode the token
    return jwt.verify(token, jwtSecret);
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
 * @returns {Promise<Object|null>} - Auth data or null if invalid
 */
async function getAuthFromRequest(req) {
  // Check for token in authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }
  
  // Handle JWT token
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (!token) return null;
    
    const decodedToken = await verifyToken(token);
    return { 
      type: 'jwt',
      data: decodedToken
    };
  }
  
  // Handle API key for admin functions - retrieve from secure storage
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    const storedApiKey = await getSecret('ADMIN_API_KEY', { 
      required: false,
      fallback: process.env.ADMIN_API_KEY 
    });
    
    if (apiKey === storedApiKey) {
      return {
        type: 'apikey',
        data: { role: 'admin' }
      };
    }
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
    const auth = await getAuthFromRequest(req);
    
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

/**
 * Generate token pair (access + refresh) for a wallet address
 * @param {string} walletAddress - Ethereum address 
 * @param {string} role - User role (user, admin)
 * @returns {Promise<Object>} - Token pair with access and refresh tokens
 */
async function generateTokenPairForWallet(walletAddress, role = 'user') {
  if (!walletAddress) {
    throw new Error('Wallet address required to generate tokens');
  }

  // Normalize the wallet address
  const normalizedAddress = walletAddress.toLowerCase();
  
  // Get admin wallet address
  const ADMIN_WALLET = await getAdminWalletAddress();
  
  // Check if this is an admin wallet
  const isAdmin = normalizedAddress === ADMIN_WALLET.toLowerCase();
  
  // Create payload
  const payload = {
    walletAddress: normalizedAddress,
    role: isAdmin ? 'admin' : role,
    timestamp: Date.now()
  };

  // Generate token pair using the token manager
  return await generateTokenPair(payload, {
    accessExpiresIn: '15m',  // 15 minutes for access token
    refreshExpiresIn: '7d'  // 7 days for refresh token
  });
}

// Export the functions
module.exports = {
  generateToken,
  generateTokenPairForWallet,
  verifySignature,
  verifyToken,
  getAuthFromRequest,
  withAuth,
  getJwtSecret,
  getAdminWalletAddress
};