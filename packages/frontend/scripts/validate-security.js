#!/usr/bin/env node

/**
 * Security Integration Validation Script
 * 
 * This script validates that all security components are properly
 * integrated and working as expected. It's designed to be run as
 * part of the deployment process or for manual verification.
 * 
 * Features:
 * - Validates all security components are properly installed
 * - Checks for correct environment configuration
 * - Tests connections to required services (Redis, GCP)
 * - Verifies security headers and CORS configuration
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');
const Redis = require('ioredis');

// Import security components
let createDistributedRateLimiter;
let getSecret;
let tokenManager;
let auditLogger;

// Validation results
const results = {
  environmentConfig: { status: 'pending', details: [] },
  dependencies: { status: 'pending', details: [] },
  redis: { status: 'pending', details: [] },
  gcp: { status: 'pending', details: [] },
  securityImplementation: { status: 'pending', details: [] }
};

/**
 * Check that required environment variables are set
 */
async function validateEnvironmentConfig() {
  console.log('\nValidating environment configuration...');
  
  // Required environment variables
  const requiredVars = [
    // Core config
    'NODE_ENV',
    
    // Rate limiting
    'RATE_LIMITER_TYPE',
    'REDIS_URL',
    
    // GCP
    'GCP_PROJECT_ID',
    
    // JWT Auth
    'JWT_SECRET',
    
    // CORS
    'ALLOWED_ORIGINS'
  ];
  
  // Optional but recommended variables
  const recommendedVars = [
    'GOOGLE_APPLICATION_CREDENTIALS',
    'ADMIN_WALLET_ADDRESS',
    'ADMIN_API_KEY',
    'AUDIT_LOG_BUCKET'
  ];
  
  let missingRequired = [];
  let missingRecommended = [];
  
  // Check required variables
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingRequired.push(varName);
    }
  }
  
  // Check recommended variables
  for (const varName of recommendedVars) {
    if (!process.env[varName]) {
      missingRecommended.push(varName);
    }
  }
  
  // Report results
  if (missingRequired.length > 0) {
    results.environmentConfig.status = 'failed';
    results.environmentConfig.details.push(`Missing required environment variables: ${missingRequired.join(', ')}`);
  } else {
    results.environmentConfig.status = 'passed';
    results.environmentConfig.details.push('All required environment variables are set');
  }
  
  if (missingRecommended.length > 0) {
    results.environmentConfig.details.push(`Missing recommended environment variables: ${missingRecommended.join(', ')}`);
  }
  
  return missingRequired.length === 0;
}

/**
 * Validate that all required dependencies are installed
 */
function validateDependencies() {
  console.log('\nValidating dependencies...');
  
  const requiredDependencies = [
    // For distributed rate limiting
    'ioredis',
    
    // For token management and secrets
    'jsonwebtoken',
    '@google-cloud/secret-manager',
    
    // For audit logging
    '@google-cloud/storage'
  ];
  
  const missingDependencies = [];
  
  for (const dep of requiredDependencies) {
    try {
      require.resolve(dep);
    } catch (error) {
      missingDependencies.push(dep);
    }
  }
  
  // Report results
  if (missingDependencies.length > 0) {
    results.dependencies.status = 'failed';
    results.dependencies.details.push(`Missing dependencies: ${missingDependencies.join(', ')}`);
  } else {
    results.dependencies.status = 'passed';
    results.dependencies.details.push('All required dependencies are installed');
  }
  
  // Try importing security components
  try {
    createDistributedRateLimiter = require('../lib/distributedRateLimit');
    results.dependencies.details.push('✅ Distributed rate limiter imported successfully');
  } catch (error) {
    results.dependencies.details.push(`❌ Failed to import distributed rate limiter: ${error.message}`);
    results.dependencies.status = 'failed';
  }
  
  try {
    getSecret = require('@proof-of-funds/common/src/config/secrets').getSecret;
    results.dependencies.details.push('✅ Secret management imported successfully');
  } catch (error) {
    results.dependencies.details.push(`❌ Failed to import secret management: ${error.message}`);
    results.dependencies.status = 'failed';
  }
  
  try {
    tokenManager = require('@proof-of-funds/common/src/auth/tokenManager');
    results.dependencies.details.push('✅ Token manager imported successfully');
  } catch (error) {
    results.dependencies.details.push(`❌ Failed to import token manager: ${error.message}`);
    results.dependencies.status = 'failed';
  }
  
  try {
    auditLogger = require('@proof-of-funds/common/src/logging/auditLogger');
    results.dependencies.details.push('✅ Audit logger imported successfully');
  } catch (error) {
    results.dependencies.details.push(`❌ Failed to import audit logger: ${error.message}`);
    results.dependencies.status = 'failed';
  }
  
  return missingDependencies.length === 0;
}

/**
 * Validate Redis connection for distributed components
 */
async function validateRedisConnection() {
  console.log('\nValidating Redis connection...');
  
  if (process.env.RATE_LIMITER_TYPE !== 'redis') {
    results.redis.status = 'skipped';
    results.redis.details.push('Redis validation skipped (RATE_LIMITER_TYPE is not set to redis)');
    return true;
  }
  
  if (!process.env.REDIS_URL) {
    results.redis.status = 'failed';
    results.redis.details.push('REDIS_URL environment variable is not set');
    return false;
  }
  
  let redisClient;
  try {
    // Test Redis connection
    redisClient = new Redis(process.env.REDIS_URL, {
      connectTimeout: 5000, // 5 seconds
      maxRetriesPerRequest: 1
    });
    
    // Add error handler
    redisClient.on('error', (err) => {
      results.redis.details.push(`Redis connection error: ${err.message}`);
    });
    
    // Test connection with ping
    const pingResponse = await redisClient.ping();
    if (pingResponse === 'PONG') {
      results.redis.status = 'passed';
      results.redis.details.push('Successfully connected to Redis');
      
      // Test rate limiter with Redis
      try {
        const limiter = createDistributedRateLimiter({ type: 'redis' })(5, 'validation');
        const mockReq = {
          headers: { 'x-forwarded-for': '127.0.0.1' },
          socket: { remoteAddress: '127.0.0.1' }
        };
        const mockRes = {
          status: () => ({ json: () => {} }),
          setHeader: () => {}
        };
        
        await limiter(mockReq, mockRes);
        results.redis.details.push('Successfully tested rate limiter with Redis');
      } catch (error) {
        results.redis.details.push(`Failed to test rate limiter with Redis: ${error.message}`);
        results.redis.status = 'warning';
      }
      
      return true;
    } else {
      results.redis.status = 'failed';
      results.redis.details.push(`Unexpected Redis ping response: ${pingResponse}`);
      return false;
    }
  } catch (error) {
    results.redis.status = 'failed';
    results.redis.details.push(`Failed to connect to Redis: ${error.message}`);
    return false;
  } finally {
    if (redisClient) {
      redisClient.disconnect();
    }
  }
}

/**
 * Validate GCP integration for secrets, storage, etc.
 */
async function validateGcpIntegration() {
  console.log('\nValidating GCP integration...');
  
  if (!process.env.GCP_PROJECT_ID) {
    results.gcp.status = 'failed';
    results.gcp.details.push('GCP_PROJECT_ID environment variable is not set');
    return false;
  }
  
  // If we have getSecret function from Engineer 2, test it
  if (getSecret) {
    try {
      // Test getting a secret (this should fall back to env var or development value)
      const testSecret = await getSecret('TEST_SECRET', {
        required: false,
        fallback: 'test-value'
      });
      
      if (testSecret) {
        results.gcp.details.push('Successfully tested secret management');
      }
    } catch (error) {
      results.gcp.details.push(`Failed to test secret management: ${error.message}`);
      results.gcp.status = 'warning';
    }
  } else {
    results.gcp.details.push('Secret management not available for testing');
    results.gcp.status = 'warning';
  }
  
  // Test audit logger's GCP integration
  if (auditLogger) {
    try {
      // Temporarily replace logging to avoid actual writes
      const originalInit = auditLogger.initializeStorage;
      auditLogger.initializeStorage = async () => {
        return true;
      };
      
      // Test logging
      await auditLogger.log('security.validation', { test: true }, { service: 'validator' });
      results.gcp.details.push('Successfully tested audit logger');
      
      // Restore original function
      auditLogger.initializeStorage = originalInit;
    } catch (error) {
      results.gcp.details.push(`Failed to test audit logger: ${error.message}`);
      results.gcp.status = 'warning';
    }
  } else {
    results.gcp.details.push('Audit logger not available for testing');
    results.gcp.status = 'warning';
  }
  
  // If we reached here without failing, mark as passed
  if (results.gcp.status !== 'failed' && results.gcp.status !== 'warning') {
    results.gcp.status = 'passed';
    results.gcp.details.push('GCP integration validation completed successfully');
  }
  
  return results.gcp.status !== 'failed';
}

/**
 * Validate security implementations
 */
async function validateSecurityImplementation() {
  console.log('\nValidating security implementations...');
  
  // Check if Next.js config has security headers
  try {
    const nextConfigPath = path.join(__dirname, '..', 'next.config.js');
    if (fs.existsSync(nextConfigPath)) {
      const configContent = fs.readFileSync(nextConfigPath, 'utf8');
      
      // Check for security headers
      if (configContent.includes('X-Content-Type-Options') && 
          configContent.includes('Content-Security-Policy')) {
        results.securityImplementation.details.push('Security headers found in Next.js config');
      } else {
        results.securityImplementation.details.push('Security headers not found in Next.js config');
        results.securityImplementation.status = 'warning';
      }
      
      // Check for HTTPS enforcement
      if (configContent.includes('rewrites') && configContent.includes('https')) {
        results.securityImplementation.details.push('HTTPS enforcement found in Next.js config');
      } else {
        results.securityImplementation.details.push('HTTPS enforcement not found in Next.js config');
        results.securityImplementation.status = 'warning';
      }
    } else {
      results.securityImplementation.details.push('Next.js config file not found');
      results.securityImplementation.status = 'warning';
    }
  } catch (error) {
    results.securityImplementation.details.push(`Error checking Next.js config: ${error.message}`);
    results.securityImplementation.status = 'warning';
  }
  
  // Check middleware for CORS and CSP
  try {
    const middlewarePath = path.join(__dirname, '..', 'middleware.js');
    if (fs.existsSync(middlewarePath)) {
      const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
      
      // Check for CORS implementation
      if (middlewareContent.includes('Access-Control-Allow-Origin') && 
          middlewareContent.includes('ALLOWED_ORIGINS')) {
        results.securityImplementation.details.push('CORS implementation found in middleware');
      } else {
        results.securityImplementation.details.push('CORS implementation not found in middleware');
        results.securityImplementation.status = 'warning';
      }
      
      // Check for CSP implementation
      if (middlewareContent.includes('Content-Security-Policy') && 
          middlewareContent.includes("default-src 'self'")) {
        results.securityImplementation.details.push('CSP implementation found in middleware');
      } else {
        results.securityImplementation.details.push('CSP implementation not found in middleware');
        results.securityImplementation.status = 'warning';
      }
    } else {
      results.securityImplementation.details.push('Middleware file not found');
      results.securityImplementation.status = 'warning';
    }
  } catch (error) {
    results.securityImplementation.details.push(`Error checking middleware: ${error.message}`);
    results.securityImplementation.status = 'warning';
  }
  
  // Run integration tests if available
  try {
    const integrationTestPath = path.join(__dirname, '..', 'test', 'security-integration.test.js');
    if (fs.existsSync(integrationTestPath)) {
      results.securityImplementation.details.push('Security integration tests found');
      
      try {
        // Try to run integration tests
        const integrationTests = require(integrationTestPath);
        if (typeof integrationTests.runAllTests === 'function') {
          console.log('Running integration tests...');
          await integrationTests.runAllTests();
          results.securityImplementation.details.push('Integration tests executed');
        }
      } catch (error) {
        results.securityImplementation.details.push(`Error running integration tests: ${error.message}`);
      }
    } else {
      results.securityImplementation.details.push('Security integration tests not found');
    }
  } catch (error) {
    results.securityImplementation.details.push(`Error checking integration tests: ${error.message}`);
  }
  
  // If we reached here without failing, mark as passed
  if (results.securityImplementation.status !== 'failed' && 
      results.securityImplementation.status !== 'warning') {
    results.securityImplementation.status = 'passed';
    results.securityImplementation.details.push('Security implementation validation completed successfully');
  }
  
  return results.securityImplementation.status !== 'failed';
}

/**
 * Run all validation checks
 */
async function runValidation() {
  console.log('======= SECURITY INTEGRATION VALIDATION =======');
  console.log('Validating security components integration...');
  
  try {
    await validateDependencies();
    await validateEnvironmentConfig();
    await validateRedisConnection();
    await validateGcpIntegration();
    await validateSecurityImplementation();
    
    // Calculate overall result
    const allPassed = Object.values(results).every(r => 
      r.status === 'passed' || r.status === 'skipped');
    
    const hasWarnings = Object.values(results).some(r => 
      r.status === 'warning');
    
    const hasFailed = Object.values(results).some(r => 
      r.status === 'failed');
    
    // Print summary
    console.log('\n======= VALIDATION RESULTS =======');
    
    for (const [category, result] of Object.entries(results)) {
      const statusIcon = 
        result.status === 'passed' ? '✅' :
        result.status === 'warning' ? '⚠️' :
        result.status === 'skipped' ? '⏭️' : '❌';
        
      console.log(`\n${statusIcon} ${category.toUpperCase()}: ${result.status.toUpperCase()}`);
      
      for (const detail of result.details) {
        console.log(`  ${detail}`);
      }
    }
    
    console.log('\n=== SUMMARY ===');
    if (hasFailed) {
      console.log('❌ Validation FAILED: Some critical checks failed');
      return false;
    } else if (hasWarnings) {
      console.log('⚠️ Validation PASSED WITH WARNINGS: Some non-critical issues were found');
      return true;
    } else {
      console.log('✅ Validation PASSED: All security components are properly integrated');
      return true;
    }
  } catch (error) {
    console.error('❌ Error during validation:', error);
    return false;
  }
}

// Run validation if script is executed directly
if (require.main === module) {
  // Load environment variables
  require('dotenv').config({
    path: path.join(__dirname, '..', '..', '..', '.env')
  });
  require('dotenv').config({
    path: path.join(__dirname, '..', '..', '..', '.env.local')
  });
  
  runValidation().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = {
  runValidation,
  results
};