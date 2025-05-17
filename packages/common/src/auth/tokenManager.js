/**
 * Token Management System
 * 
 * Provides secure JWT token generation, verification, refresh and revocation
 * capabilities for the Proof of Funds application.
 * 
 * Features:
 * - Generates access and refresh token pairs
 * - Verifies tokens against a blacklist
 * - Manages token revocation through Redis in production
 * - Provides in-memory blacklisting for development environments
 * - Implements secure token refresh logic
 */

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getSecret } = require('../config/secrets');
const Redis = require('ioredis');

// In-memory token blacklist for development
const inMemoryBlacklist = new Set();

// Redis connection for production (lazy-loaded)
let redisClient = null;

/**
 * Initialize Redis client for token blacklisting in production
 */
async function getRedisClient() {
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  if (!redisClient) {
    try {
      const redisUrl = await getSecret('REDIS_URL', { 
        required: true,
        fallback: 'redis://localhost:6379'
      });
      
      redisClient = new Redis(redisUrl, {
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
      });

      redisClient.on('error', (err) => {
        console.error('Redis connection error:', err);
      });
    } catch (error) {
      console.error('Failed to initialize Redis client:', error);
      throw new Error('Token blacklisting service unavailable');
    }
  }

  return redisClient;
}

/**
 * Add a token to the blacklist
 * @param {string} token - The token to blacklist
 * @param {number} expiryInSeconds - How long to keep the token in the blacklist
 */
async function blacklistToken(token, expiryInSeconds) {
  try {
    // Extract jti (JWT ID) from token
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.jti) {
      throw new Error('Invalid token format - missing jti');
    }
    
    const tokenId = decoded.jti;
    
    // Use Redis in production, memory in development
    if (process.env.NODE_ENV === 'production') {
      const redis = await getRedisClient();
      await redis.set(`blacklist:${tokenId}`, '1', 'EX', expiryInSeconds);
    } else {
      inMemoryBlacklist.add(tokenId);
      
      // Auto-remove from in-memory blacklist after expiry
      setTimeout(() => {
        inMemoryBlacklist.delete(tokenId);
      }, expiryInSeconds * 1000);
    }
    
    return true;
  } catch (error) {
    console.error('Error blacklisting token:', error);
    throw new Error('Failed to blacklist token');
  }
}

/**
 * Check if a token is blacklisted
 * @param {string} token - The token to check
 * @returns {Promise<boolean>} - True if blacklisted, false otherwise
 */
async function isTokenBlacklisted(token) {
  try {
    // Extract jti (JWT ID) from token
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.jti) {
      throw new Error('Invalid token format - missing jti');
    }
    
    const tokenId = decoded.jti;
    
    // Check Redis in production, memory in development
    if (process.env.NODE_ENV === 'production') {
      const redis = await getRedisClient();
      const exists = await redis.exists(`blacklist:${tokenId}`);
      return exists === 1;
    } else {
      return inMemoryBlacklist.has(tokenId);
    }
  } catch (error) {
    console.error('Error checking token blacklist:', error);
    // Fail secure - treat errors as blacklisted
    return true;
  }
}

/**
 * Generate a JWT token with the given payload and options
 * @param {Object} payload - The data to include in the token
 * @param {Object} options - Token generation options
 * @returns {Promise<string>} - The generated token
 */
async function generateToken(payload, options = {}) {
  try {
    const {
      expiresIn = '15m', // Default 15 minutes for access tokens
      secret = null,
      type = 'access',
    } = options;
    
    // Generate a unique token ID
    const jti = uuidv4();
    
    // Get the appropriate secret
    const secretKey = secret || await getSecret('JWT_SECRET', { 
      required: true,
      fallback: process.env.JWT_SECRET_FALLBACK
    });
    
    if (!secretKey) {
      throw new Error('JWT secret not available');
    }
    
    // Create the token with the jti claim
    const token = jwt.sign(
      { 
        ...payload, 
        jti,
        type 
      }, 
      secretKey, 
      { expiresIn }
    );
    
    return token;
  } catch (error) {
    console.error('Error generating token:', error);
    throw new Error('Failed to generate authentication token');
  }
}

/**
 * Generate an access and refresh token pair
 * @param {Object} userData - User data to include in the tokens
 * @returns {Promise<Object>} - Object containing access and refresh tokens
 */
async function generateTokenPair(userData) {
  try {
    // Generate access token (short-lived)
    const accessToken = await generateToken(userData, {
      expiresIn: '15m',
      type: 'access'
    });
    
    // Generate refresh token (longer-lived)
    const refreshToken = await generateToken(userData, {
      expiresIn: '7d', // 7 days
      type: 'refresh'
    });
    
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  } catch (error) {
    console.error('Error generating token pair:', error);
    throw new Error('Failed to generate authentication tokens');
  }
}

/**
 * Verify a JWT token
 * @param {string} token - The token to verify
 * @param {Object} options - Verification options
 * @returns {Promise<Object>} - The decoded token payload if valid
 */
async function verifyToken(token, options = {}) {
  try {
    const {
      secret = null,
      ignoreExpiration = false,
      checkBlacklist = true
    } = options;
    
    // First check if token is blacklisted
    if (checkBlacklist && await isTokenBlacklisted(token)) {
      throw new Error('Token has been revoked');
    }
    
    // Get the appropriate secret
    const secretKey = secret || await getSecret('JWT_SECRET', { 
      required: true,
      fallback: process.env.JWT_SECRET_FALLBACK
    });
    
    if (!secretKey) {
      throw new Error('JWT secret not available');
    }
    
    // Verify the token
    const decoded = jwt.verify(token, secretKey, { ignoreExpiration });
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Refresh an access token using a valid refresh token
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<Object>} - New token pair
 */
async function refreshTokens(refreshToken) {
  try {
    // Verify the refresh token is valid and not blacklisted
    const decoded = await verifyToken(refreshToken, {
      checkBlacklist: true
    });
    
    // Ensure it's a refresh token
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    // Create a payload from the refresh token data, excluding jwt metadata
    const { iat, exp, jti, type, ...userData } = decoded;
    
    // Blacklist the used refresh token to prevent reuse
    const tokenExp = decoded.exp - Math.floor(Date.now() / 1000);
    await blacklistToken(refreshToken, tokenExp > 0 ? tokenExp : 3600); // Default 1h if expired
    
    // Generate new token pair
    return generateTokenPair(userData);
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw new Error('Failed to refresh authentication token');
  }
}

/**
 * Revoke a user's tokens (logout)
 * @param {string} accessToken - The current access token
 * @param {string} refreshToken - The current refresh token
 * @returns {Promise<boolean>} - True if successful
 */
async function revokeTokens(accessToken, refreshToken) {
  try {
    // Extract expiry information from tokens
    const accessTokenData = jwt.decode(accessToken);
    const refreshTokenData = jwt.decode(refreshToken);
    
    // Calculate seconds remaining for blacklisting
    const accessExp = accessTokenData && accessTokenData.exp 
      ? accessTokenData.exp - Math.floor(Date.now() / 1000)
      : 900; // Default 15 minutes if can't determine
    
    const refreshExp = refreshTokenData && refreshTokenData.exp
      ? refreshTokenData.exp - Math.floor(Date.now() / 1000)
      : 604800; // Default 7 days if can't determine
    
    // Blacklist both tokens
    await Promise.all([
      blacklistToken(accessToken, accessExp > 0 ? accessExp : 3600),
      blacklistToken(refreshToken, refreshExp > 0 ? refreshExp : 604800)
    ]);
    
    return true;
  } catch (error) {
    console.error('Error revoking tokens:', error);
    throw new Error('Failed to logout user');
  }
}

module.exports = {
  generateToken,
  generateTokenPair,
  verifyToken,
  refreshTokens,
  revokeTokens,
  blacklistToken,
  isTokenBlacklisted,
  // For backward compatibility
  refreshAccessToken: refreshTokens
};