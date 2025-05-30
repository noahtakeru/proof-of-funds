/**
 * Jest Setup After Environment
 * 
 * This file is run after each test file's environment is set up.
 */

// Import Jest matchers for enhanced assertions
require('jest-extended');

// Add custom matchers
expect.extend({
  
  // Custom matcher for JWT tokens
  toBeValidJWT(received) {
    if (typeof received !== 'string') {
      return {
        pass: false,
        message: () => `Expected ${received} to be a string JWT token`
      };
    }
    
    const parts = received.split('.');
    
    if (parts.length !== 3) {
      return {
        pass: false,
        message: () => `Expected JWT to have 3 parts, but got ${parts.length}`
      };
    }
    
    try {
      // Try to decode the payload (middle part)
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      // JWT should have standard claims
      if (!payload.iat || !payload.exp) {
        return {
          pass: false,
          message: () => 'JWT is missing required claims (iat, exp)'
        };
      }
      
      return {
        pass: true,
        message: () => 'JWT is valid'
      };
    } catch (e) {
      return {
        pass: false,
        message: () => `Failed to decode JWT: ${e.message}`
      };
    }
  },
  
  // Custom matcher for database IDs (UUIDs)
  toBeValidDatabaseId(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    return {
      pass,
      message: () => pass
        ? `Expected ${received} not to be a valid database ID (UUID)`
        : `Expected ${received} to be a valid database ID (UUID)`
    };
  }
});

// Set a reasonable timeout for all tests (30 seconds for database operations)
jest.setTimeout(30000);

// Global setup for each test
beforeAll(() => {
  console.log('Starting test with NODE_ENV:', process.env.NODE_ENV);
});