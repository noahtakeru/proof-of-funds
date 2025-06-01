/**
 * Shim for token service in the frontend
 * 
 * This provides a compatible interface with the common token service
 * for the frontend environment. It uses the tokenManager directly
 * since importing the TypeScript module can cause build issues.
 * 
 * The implementation mirrors @proof-of-funds/common/src/auth/tokenService.ts
 * but is adapted for the frontend environment.
 */

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a token pair (access + refresh tokens)
 * 
 * @param {Object} payload - Token payload with user data and permissions
 * @param {Object} options - Token generation options
 * @returns {Object} - Object containing accessToken, refreshToken and expiresIn
 */
async function generateTokenPair(payload, options = {}) {
  const {
    secret,
    accessExpiresIn = '15m',
    refreshExpiresIn = '7d'
  } = options;

  if (!secret) {
    throw new Error('Secret is required for token generation');
  }

  try {
    // Generate token IDs
    const accessTokenId = uuidv4();
    const refreshTokenId = uuidv4();
    
    // Generate access token
    const accessToken = jwt.sign(
      { 
        ...payload, 
        jti: accessTokenId,
        type: 'access' 
      },
      secret,
      { expiresIn: accessExpiresIn }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { 
        ...payload, 
        jti: refreshTokenId,
        type: 'refresh' 
      },
      secret,
      { expiresIn: refreshExpiresIn }
    );

    // Calculate expiry in seconds for consistent API
    const expiresInSeconds = parseExpiryToSeconds(accessExpiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInSeconds
    };
  } catch (error) {
    console.error('Token generation failed:', error);
    throw new Error('Failed to generate authentication tokens');
  }
}

/**
 * Generate a single token
 * 
 * @param {Object} payload - Token payload
 * @param {Object} options - Token generation options
 * @returns {string} - Generated token
 */
async function generateToken(payload, options = {}) {
  const {
    secret,
    expiresIn = '15m',
    type = 'access'
  } = options;

  if (!secret) {
    throw new Error('Secret is required for token generation');
  }

  try {
    // Generate token ID
    const tokenId = uuidv4();
    
    // Sign the token
    return jwt.sign(
      { 
        ...payload, 
        jti: tokenId,
        type 
      },
      secret,
      { expiresIn }
    );
  } catch (error) {
    console.error('Token generation failed:', error);
    throw new Error('Failed to generate authentication token');
  }
}

/**
 * Verify a token
 * 
 * @param {string} token - Token to verify
 * @param {Object} options - Verification options
 * @returns {Object|null} - Decoded token or null if invalid
 */
function verifyToken(token, options = {}) {
  const { 
    secret,
    ignoreExpiration = false
  } = options;

  if (!token) {
    return null;
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, secret, { ignoreExpiration });
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
}

/**
 * Refresh tokens - creates new token pair based on refresh token
 * 
 * @param {string} refreshToken - Current refresh token
 * @param {Object} options - Options including secret
 * @returns {Object|null} - New token pair or null if refresh failed
 */
async function refreshTokens(refreshToken, options = {}) {
  const { secret } = options;

  if (!refreshToken || !secret) {
    return null;
  }

  try {
    // Verify the refresh token first
    const decoded = verifyToken(refreshToken, { 
      secret,
      ignoreExpiration: false 
    });

    if (!decoded || decoded.type !== 'refresh') {
      return null;
    }

    // Create a payload from the refresh token data, excluding jwt metadata
    const { iat, exp, jti, type, ...userData } = decoded;

    // Generate new token pair
    return generateTokenPair(userData, { secret });
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

/**
 * Parse expiry time string to seconds
 * @param {string} expiry - Expiry time string (e.g. '15m', '7d')
 * @returns {number} - Time in seconds
 */
function parseExpiryToSeconds(expiry) {
  const unit = expiry.charAt(expiry.length - 1);
  const value = parseInt(expiry.slice(0, -1), 10);
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    default: return 3600; // Default to 1 hour
  }
}

module.exports = {
  generateTokenPair,
  generateToken,
  verifyToken,
  refreshTokens
};