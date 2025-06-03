/**
 * Token Rotation and Blacklisting Tests
 * 
 * Comprehensive tests for JWT token rotation, blacklisting, and refresh
 * to ensure security integrity of the authentication system.
 */

const jwt = require('jsonwebtoken');
const {
  generateTokenPair,
  verifyToken,
  refreshTokens,
  blacklistToken,
  isTokenBlacklisted
} = require('@proof-of-funds/common/src/auth/tokenManager');

/**
 * Test token pair generation
 */
async function testTokenPairGeneration() {
  console.log('\n--- Testing Token Pair Generation ---');
  
  try {
    // Create user payload
    const userData = {
      walletAddress: '0xTestWalletForTokenRotation',
      role: 'user',
      timestamp: Date.now()
    };
    
    // Generate token pair
    console.log('Generating token pair...');
    const tokenPair = await generateTokenPair(userData);
    
    if (!tokenPair || !tokenPair.accessToken || !tokenPair.refreshToken) {
      console.error('❌ Token pair generation failed - missing tokens');
      return false;
    }
    
    // Decode tokens (without verification) to check contents
    const accessDecoded = jwt.decode(tokenPair.accessToken);
    const refreshDecoded = jwt.decode(tokenPair.refreshToken);
    
    // Verify token contents
    if (!accessDecoded || accessDecoded.type !== 'access' || 
        !refreshDecoded || refreshDecoded.type !== 'refresh') {
      console.error('❌ Token contents invalid - incorrect type');
      return false;
    }
    
    // Verify wallet address is in the tokens
    if (accessDecoded.walletAddress !== userData.walletAddress ||
        refreshDecoded.walletAddress !== userData.walletAddress) {
      console.error('❌ Token contents invalid - incorrect wallet address');
      return false;
    }
    
    // Verify tokens have JTIs (JWT IDs)
    if (!accessDecoded.jti || !refreshDecoded.jti) {
      console.error('❌ Token contents invalid - missing JTI');
      return false;
    }
    
    console.log('✅ Token pair generation successful');
    console.log('Access token expires:', new Date(accessDecoded.exp * 1000).toISOString());
    console.log('Refresh token expires:', new Date(refreshDecoded.exp * 1000).toISOString());
    
    return { accessToken: tokenPair.accessToken, refreshToken: tokenPair.refreshToken };
  } catch (error) {
    console.error('❌ Token pair generation error:', error);
    return false;
  }
}

/**
 * Test token verification
 */
async function testTokenVerification(tokens) {
  console.log('\n--- Testing Token Verification ---');
  
  try {
    if (!tokens || !tokens.accessToken) {
      console.error('❌ No tokens provided for verification');
      return false;
    }
    
    // Verify access token
    console.log('Verifying access token...');
    const accessVerified = await verifyToken(tokens.accessToken);
    
    if (!accessVerified) {
      console.error('❌ Access token verification failed');
      return false;
    }
    
    console.log('✅ Access token successfully verified');
    
    // Verify refresh token
    console.log('Verifying refresh token...');
    const refreshVerified = await verifyToken(tokens.refreshToken);
    
    if (!refreshVerified) {
      console.error('❌ Refresh token verification failed');
      return false;
    }
    
    console.log('✅ Refresh token successfully verified');
    
    return true;
  } catch (error) {
    console.error('❌ Token verification error:', error);
    return false;
  }
}

/**
 * Test token refresh and rotation
 */
async function testTokenRefresh(tokens) {
  console.log('\n--- Testing Token Refresh (Rotation) ---');
  
  try {
    if (!tokens || !tokens.refreshToken) {
      console.error('❌ No refresh token provided');
      return false;
    }
    
    // Get original refresh token details for later comparison
    const originalRefreshDecoded = jwt.decode(tokens.refreshToken);
    
    // Refresh tokens
    console.log('Refreshing tokens...');
    const newTokens = await refreshTokens(tokens.refreshToken);
    
    if (!newTokens || !newTokens.accessToken || !newTokens.refreshToken) {
      console.error('❌ Token refresh failed - missing new tokens');
      return false;
    }
    
    // Verify new tokens are different from original
    if (tokens.accessToken === newTokens.accessToken ||
        tokens.refreshToken === newTokens.refreshToken) {
      console.error('❌ Token refresh failed - tokens not rotated');
      return false;
    }
    
    console.log('✅ Tokens successfully rotated');
    
    // Verify new tokens can be verified
    console.log('Verifying new tokens...');
    const accessVerified = await verifyToken(newTokens.accessToken);
    const refreshVerified = await verifyToken(newTokens.refreshToken);
    
    if (!accessVerified || !refreshVerified) {
      console.error('❌ New tokens verification failed');
      return false;
    }
    
    console.log('✅ New tokens successfully verified');
    
    // Verify original refresh token has been blacklisted
    console.log('Checking if original refresh token was blacklisted...');
    const isBlacklisted = await isTokenBlacklisted(tokens.refreshToken);
    
    if (!isBlacklisted) {
      console.error('❌ Original refresh token not blacklisted');
      return false;
    }
    
    console.log('✅ Original refresh token successfully blacklisted');
    
    // Try to use the blacklisted refresh token again (should fail)
    console.log('Trying to reuse blacklisted refresh token...');
    try {
      const shouldFail = await refreshTokens(tokens.refreshToken);
      if (shouldFail) {
        console.error('❌ Security vulnerability: blacklisted token still usable');
        return false;
      }
    } catch (error) {
      console.log('✅ Correctly rejected blacklisted refresh token');
    }
    
    return newTokens;
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    return false;
  }
}

/**
 * Test token blacklisting
 */
async function testTokenBlacklisting(tokens) {
  console.log('\n--- Testing Token Blacklisting ---');
  
  try {
    if (!tokens || !tokens.accessToken) {
      console.error('❌ No tokens provided for blacklisting');
      return false;
    }
    
    // Blacklist the access token
    console.log('Blacklisting access token...');
    const accessDecoded = jwt.decode(tokens.accessToken);
    await blacklistToken(tokens.accessToken, accessDecoded.exp - Math.floor(Date.now() / 1000));
    
    // Verify the access token is blacklisted
    console.log('Verifying access token is blacklisted...');
    const isAccessBlacklisted = await isTokenBlacklisted(tokens.accessToken);
    
    if (!isAccessBlacklisted) {
      console.error('❌ Access token not blacklisted');
      return false;
    }
    
    console.log('✅ Access token successfully blacklisted');
    
    // Try to verify the blacklisted token (should fail)
    console.log('Trying to verify blacklisted access token...');
    const verificationResult = await verifyToken(tokens.accessToken);
    
    if (verificationResult) {
      console.error('❌ Security vulnerability: blacklisted token still verifiable');
      return false;
    }
    
    console.log('✅ Blacklisted access token correctly rejected during verification');
    
    return true;
  } catch (error) {
    console.error('❌ Token blacklisting error:', error);
    return false;
  }
}

/**
 * Run all token tests in sequence
 */
async function runTokenTests() {
  console.log('======= TOKEN ROTATION AND BLACKLISTING TESTS =======');
  
  try {
    // Generate token pair
    const tokens = await testTokenPairGeneration();
    if (!tokens) {
      console.error('❌ Token tests failed at generation stage');
      return false;
    }
    
    // Verify tokens
    const verificationResult = await testTokenVerification(tokens);
    if (!verificationResult) {
      console.error('❌ Token tests failed at verification stage');
      return false;
    }
    
    // Refresh tokens
    const newTokens = await testTokenRefresh(tokens);
    if (!newTokens) {
      console.error('❌ Token tests failed at refresh stage');
      return false;
    }
    
    // Blacklist tokens
    const blacklistResult = await testTokenBlacklisting(newTokens);
    if (!blacklistResult) {
      console.error('❌ Token tests failed at blacklisting stage');
      return false;
    }
    
    console.log('\n======= TOKEN TEST RESULTS =======');
    console.log('✅ All token rotation and blacklisting tests passed!');
    console.log('============================================');
    
    return true;
  } catch (error) {
    console.error('❌ Error running token tests:', error);
    return false;
  }
}

// Run the tests if executed directly
if (require.main === module) {
  // Mock the jwt module if needed in test environment
  if (!jwt.decode) {
    jwt.decode = (token) => {
      const parts = token.split('.');
      if (parts.length !== 3) {return null;}
      
      try {
        return JSON.parse(Buffer.from(parts[1], 'base64').toString());
      } catch (error) {
        return null;
      }
    };
  }
  
  runTokenTests().then(passed => {
    process.exit(passed ? 0 : 1);
  });
}

module.exports = {
  runTokenTests,
  testTokenPairGeneration,
  testTokenVerification,
  testTokenRefresh,
  testTokenBlacklisting
};