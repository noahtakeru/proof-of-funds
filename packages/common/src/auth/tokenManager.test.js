/**
 * Token Manager - Tests
 * 
 * Comprehensive tests for the token management system to ensure
 * token generation, verification, refresh, and revocation work correctly.
 */

// Import modules for testing
const { 
  generateTokenPair, 
  verifyToken, 
  refreshTokens, 
  blacklistToken, 
  isBlacklisted 
} = require('./tokenManager');

// Mock functions and dependencies
jest.mock('../config/secrets', () => {
  return {
    getSecret: jest.fn().mockImplementation((key) => {
      if (key === 'JWT_SECRET') {
        return Promise.resolve('test-jwt-secret-for-unit-tests');
      }
      return Promise.resolve(null);
    })
  };
});

// Tests for token management
describe('Token Management System', () => {
  // Setup
  const testPayload = {
    walletAddress: '0x123456789abcdef',
    role: 'user',
    userId: 'user-123'
  };
  
  // Test token pair generation
  test('generates valid token pairs', async () => {
    const tokenPair = await generateTokenPair(testPayload);
    
    // Check token structure
    expect(tokenPair).toHaveProperty('accessToken');
    expect(tokenPair).toHaveProperty('refreshToken');
    expect(typeof tokenPair.accessToken).toBe('string');
    expect(typeof tokenPair.refreshToken).toBe('string');
    
    // Verify both tokens
    const accessTokenData = await verifyToken(tokenPair.accessToken);
    const refreshTokenData = await verifyToken(tokenPair.refreshToken);
    
    // Check token types
    expect(accessTokenData.type).toBe('access');
    expect(refreshTokenData.type).toBe('refresh');
    
    // Check token payloads
    expect(accessTokenData.walletAddress).toBe(testPayload.walletAddress);
    expect(refreshTokenData.walletAddress).toBe(testPayload.walletAddress);
    expect(accessTokenData.role).toBe(testPayload.role);
    expect(refreshTokenData.role).toBe(testPayload.role);
  });
  
  // Test token verification
  test('verifies valid tokens', async () => {
    const tokenPair = await generateTokenPair(testPayload);
    const verified = await verifyToken(tokenPair.accessToken);
    
    expect(verified).not.toBe(null);
    expect(verified.walletAddress).toBe(testPayload.walletAddress);
    expect(verified.role).toBe(testPayload.role);
  });
  
  // Test token blacklisting
  test('detects blacklisted tokens', async () => {
    const tokenPair = await generateTokenPair(testPayload);
    const { accessToken } = tokenPair;
    
    // Token should be valid initially
    const verifiedBeforeBlacklist = await verifyToken(accessToken);
    expect(verifiedBeforeBlacklist).not.toBe(null);
    
    // Get token data to extract jti and exp
    const decoded = await verifyToken(accessToken);
    
    // Blacklist the token
    await blacklistToken(decoded.jti, decoded.exp);
    
    // Check if token is in blacklist
    const isTokenBlacklisted = await isBlacklisted(decoded.jti);
    expect(isTokenBlacklisted).toBe(true);
    
    // Token verification should fail for blacklisted tokens
    const verified = await verifyToken(accessToken);
    expect(verified).toBe(null);
  });
  
  // Test token refresh
  test('refreshes tokens and blacklists used refresh tokens', async () => {
    const initialTokens = await generateTokenPair(testPayload);
    
    // Get the original refresh token data
    const originalRefreshToken = await verifyToken(initialTokens.refreshToken);
    
    // Refresh the tokens
    const newTokens = await refreshTokens(initialTokens.refreshToken);
    
    // Check that we got new tokens
    expect(newTokens).toHaveProperty('accessToken');
    expect(newTokens).toHaveProperty('refreshToken');
    expect(newTokens.accessToken).not.toBe(initialTokens.accessToken);
    expect(newTokens.refreshToken).not.toBe(initialTokens.refreshToken);
    
    // The old refresh token should be blacklisted now
    const isOldRefreshTokenBlacklisted = await isBlacklisted(originalRefreshToken.jti);
    expect(isOldRefreshTokenBlacklisted).toBe(true);
    
    // Old refresh token should not work anymore
    const refreshAttempt = await refreshTokens(initialTokens.refreshToken);
    expect(refreshAttempt).toBe(null);
    
    // New tokens should be valid
    const newAccessTokenData = await verifyToken(newTokens.accessToken);
    const newRefreshTokenData = await verifyToken(newTokens.refreshToken);
    
    expect(newAccessTokenData).not.toBe(null);
    expect(newRefreshTokenData).not.toBe(null);
  });
  
  // Test for invalid tokens
  test('rejects invalid tokens', async () => {
    // Completely invalid
    const invalidResult = await verifyToken('not-a-real-token');
    expect(invalidResult).toBe(null);
    
    // Tampered token
    const tokenPair = await generateTokenPair(testPayload);
    const tamperedToken = tokenPair.accessToken.substring(0, tokenPair.accessToken.length - 5) + 'xxxxx';
    const tamperedResult = await verifyToken(tamperedToken);
    expect(tamperedResult).toBe(null);
  });
});