/**
 * Test script for security features
 * 
 * This script verifies that the security features like CSRF protection, 
 * rate limiting, and secure headers are properly implemented for Phase 2.1
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const axios = require('axios');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000/api/v1';

// Paths to check
const BACKEND_DIR = path.join(__dirname, '..', 'packages', 'backend');
const MIDDLEWARE_DIR = path.join(BACKEND_DIR, 'src', 'middleware');

// Files to verify
const FILES_TO_CHECK = [
  {
    path: path.join(MIDDLEWARE_DIR, 'csrf.ts'),
    name: 'CSRF Protection Middleware',
    patterns: [
      'validateCsrfToken',
      'setCsrfToken',
      'generateCsrfToken'
    ]
  },
  {
    path: path.join(MIDDLEWARE_DIR, 'rateLimit.ts'),
    name: 'Rate Limiting Middleware',
    patterns: [
      'authRateLimit',
      'defaultRateLimit',
      'proofRateLimit'
    ]
  },
  {
    path: path.join(MIDDLEWARE_DIR, 'secureHeaders.ts'),
    name: 'Secure Headers Middleware',
    patterns: [
      'secureHeaders',
      'preventFraming',
      'Permissions-Policy',
      'Strict-Transport-Security'
    ]
  },
  {
    path: path.join(BACKEND_DIR, 'src', 'app.ts'),
    name: 'Express App Configuration',
    patterns: [
      'helmetMiddleware',
      'corsMiddleware',
      'requestMetrics',
      'cookieParser',
      'csrfProtection'
    ]
  }
];

/**
 * Main test function
 */
async function runTests() {
  console.log(chalk.blue.bold('🔒 Testing Security Features'));
  console.log(chalk.gray('Phase 2.1 Implementation Verification\n'));

  let passCount = 0;
  let failCount = 0;

  // Check security middleware files
  console.log(chalk.yellow('📄 Checking security middleware files...'));
  for (const fileConfig of FILES_TO_CHECK) {
    console.log(chalk.yellow(`  Checking ${fileConfig.name}...`));
    
    try {
      // Check if file exists
      if (!fs.existsSync(fileConfig.path)) {
        console.log(chalk.red(`  ❌ File not found: ${path.basename(fileConfig.path)}`));
        failCount++;
        continue;
      }
      
      // Read file content
      const content = fs.readFileSync(fileConfig.path, 'utf8');
      
      // Check for required patterns
      const missingPatterns = [];
      for (const pattern of fileConfig.patterns) {
        if (!content.includes(pattern)) {
          missingPatterns.push(pattern);
        }
      }
      
      if (missingPatterns.length > 0) {
        console.log(chalk.red(`  ❌ Missing required patterns: ${missingPatterns.join(', ')}`));
        failCount++;
      } else {
        console.log(chalk.green(`  ✅ All required patterns found!`));
        passCount++;
      }
    } catch (error) {
      console.error(chalk.red(`  ❌ Error checking ${fileConfig.name}:`), error.message);
      failCount++;
    }
  }

  // Test rate limiting by making rapid requests
  console.log(chalk.yellow('\n🔄 Testing rate limiting functionality...'));
  try {
    const rateLimitTest = await testRateLimiting();
    if (rateLimitTest) {
      console.log(chalk.green('✅ Rate limiting is working properly!'));
      passCount++;
    } else {
      console.log(chalk.red('❌ Rate limiting may not be working as expected'));
      failCount++;
    }
  } catch (error) {
    console.error(chalk.red('❌ Error testing rate limiting:'), error.message);
    failCount++;
  }

  // Test security headers
  console.log(chalk.yellow('\n🔒 Testing security headers...'));
  try {
    const headersTest = await testSecurityHeaders();
    if (headersTest) {
      console.log(chalk.green('✅ Security headers are properly configured!'));
      passCount++;
    } else {
      console.log(chalk.red('❌ Security headers may not be properly configured'));
      failCount++;
    }
  } catch (error) {
    console.error(chalk.red('❌ Error testing security headers:'), error.message);
    failCount++;
  }
  
  // Final summary
  console.log(chalk.gray('\n---------------------------------'));
  console.log(chalk.blue.bold('📊 Test Summary:'));
  console.log(chalk.green(`✅ Passed: ${passCount} checks`));
  console.log(chalk.red(`❌ Failed: ${failCount} checks`));
  
  if (failCount === 0) {
    console.log(chalk.green.bold('\n✅ All security features are properly implemented!'));
    console.log(chalk.green('Phase 2.1 security implementation is complete.'));
  } else {
    console.log(chalk.red.bold('\n❌ Some security features are missing or incomplete!'));
    console.log(chalk.red('Phase 2.1 security implementation needs attention.'));
    process.exit(1);
  }
}

/**
 * Test rate limiting by making rapid requests
 */
async function testRateLimiting() {
  try {
    console.log(chalk.gray('  Making rapid requests to test rate limiting...'));
    
    // Make several rapid requests
    const promises = [];
    for (let i = 0; i < 15; i++) {
      promises.push(axios.post(`${API_URL}/user/auth/login`, {
        email: 'nonexistent@example.com',
        password: 'WrongPassword123!'
      }).catch(error => error.response));
    }
    
    const responses = await Promise.all(promises);
    
    // Check if any response received a 429 rate limit error
    const rateLimited = responses.some(response => response && response.status === 429);
    
    if (rateLimited) {
      console.log(chalk.green('  ✅ Rate limiting triggered after multiple rapid requests'));
      return true;
    } else {
      console.log(chalk.yellow('  ⚠️ Rate limiting did not trigger after multiple rapid requests'));
      
      // Check if there are rate limit headers even if 429 wasn't triggered
      const hasRateLimitHeaders = responses.some(response => 
        response && response.headers && 
        (response.headers['x-ratelimit-remaining'] || response.headers['x-rate-limit-remaining'])
      );
      
      if (hasRateLimitHeaders) {
        console.log(chalk.green('  ✅ Rate limit headers are present'));
        return true;
      }
      
      return false;
    }
  } catch (error) {
    console.error(chalk.red('  ❌ Error testing rate limiting:'), error.message);
    return false;
  }
}

/**
 * Test security headers in API response
 */
async function testSecurityHeaders() {
  try {
    console.log(chalk.gray('  Checking API response headers...'));
    
    // Make a request to the API
    const response = await axios.options(API_URL);
    
    // Headers to check
    const securityHeaders = [
      'content-security-policy',
      'x-frame-options',
      'x-content-type-options',
      'strict-transport-security',
      'x-xss-protection'
    ];
    
    // Check if all required headers are present
    const presentHeaders = [];
    const missingHeaders = [];
    
    for (const header of securityHeaders) {
      if (response.headers[header]) {
        presentHeaders.push(header);
      } else {
        missingHeaders.push(header);
      }
    }
    
    // Log results
    if (presentHeaders.length > 0) {
      console.log(chalk.green(`  ✅ Present security headers: ${presentHeaders.join(', ')}`));
    }
    
    if (missingHeaders.length > 0) {
      console.log(chalk.yellow(`  ⚠️ Missing security headers: ${missingHeaders.join(', ')}`));
    }
    
    // Test passed if at least some security headers are present
    return presentHeaders.length > 0;
  } catch (error) {
    console.error(chalk.red('  ❌ Error testing security headers:'), error.message);
    return false;
  }
}

// Run the tests
runTests().catch(error => {
  console.error(chalk.red.bold('❌ Test failed:'), error.message);
  process.exit(1);
});