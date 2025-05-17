#!/usr/bin/env node

/**
 * GCP Setup Test
 * 
 * Tests GCP authentication and configuration
 * Provides helpful troubleshooting guidance
 */

const { initGcpAuth, getSecretManagerClient } = require('../utils/gcpAuth');
const { getAuthenticatedStorageClient } = require('../utils/serviceAccountManager');

// Load environment variables from .env file in development
try {
  require('dotenv').config({ path: '.env.local' });
  console.log('Loaded environment from .env.local');
} catch (error) {
  console.log('No .env.local file found, using existing environment variables');
}

/**
 * Check environment variables
 */
function checkEnvironment() {
  console.log('\n== Checking Environment Variables ==');
  
  const requiredVars = [
    'GCP_PROJECT_ID'
  ];
  
  const criticalVars = [
    'GOOGLE_APPLICATION_CREDENTIALS',
    'GCP_SERVICE_ACCOUNT'
  ];
  
  let allRequiredPresent = true;
  let anyCriticalPresent = false;
  
  // Check required variables
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      console.log(`✅ ${varName}: ${process.env[varName]}`);
    } else {
      console.error(`❌ ${varName} not found - required for GCP integration`);
      allRequiredPresent = false;
    }
  }
  
  // Check that at least one critical variable is present
  for (const varName of criticalVars) {
    if (process.env[varName]) {
      console.log(`✅ ${varName}: Found`);
      anyCriticalPresent = true;
    } else {
      console.log(`ℹ️ ${varName} not found`);
    }
  }
  
  if (!anyCriticalPresent) {
    console.error('❌ At least one of the following is required: GOOGLE_APPLICATION_CREDENTIALS or GCP_SERVICE_ACCOUNT');
    return false;
  }
  
  return allRequiredPresent;
}

/**
 * Test storage access
 */
async function testStorageAccess() {
  console.log('\n== Testing Storage Access ==');
  
  try {
    // Initialize storage client
    console.log('Initializing storage client...');
    const storage = await getAuthenticatedStorageClient();
    
    // Check project ID
    const projectId = process.env.GCP_PROJECT_ID || 'proof-of-funds-455506';
    console.log(`Using project ID: ${projectId}`);
    
    // Bucket operations
    const bucketName = process.env.GCP_STORAGE_BUCKET || `${projectId}-zkeys`;
    console.log(`Testing access to bucket: ${bucketName}`);
    
    const bucket = storage.bucket(bucketName);
    const [exists] = await bucket.exists();
    
    if (exists) {
      console.log(`✅ Bucket ${bucketName} exists`);
      
      // List files in bucket
      const [files] = await bucket.getFiles();
      console.log(`✅ Found ${files.length} files in bucket`);
      
      // List first 5 files
      if (files.length > 0) {
        console.log('Files in bucket:');
        files.slice(0, 5).forEach(file => {
          console.log(`  - ${file.name}`);
        });
        
        if (files.length > 5) {
          console.log(`  ... and ${files.length - 5} more`);
        }
      }
    } else {
      console.error(`❌ Bucket ${bucketName} does not exist`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Storage test failed:', error.message);
    return false;
  }
}

/**
 * Test secret manager
 */
async function testSecretManager() {
  console.log('\n== Testing Secret Manager Access ==');
  
  try {
    // Initialize secret manager client
    console.log('Initializing Secret Manager client...');
    const client = await getSecretManagerClient();
    
    // List secrets
    const projectId = process.env.GCP_PROJECT_ID || 'proof-of-funds-455506';
    console.log(`Listing secrets in project: ${projectId}`);
    
    const [secrets] = await client.listSecrets({
      parent: `projects/${projectId}`
    });
    
    console.log(`✅ Found ${secrets.length} secrets in project`);
    
    // List secret names (not values for security reasons)
    if (secrets.length > 0) {
      console.log('Secrets in project:');
      secrets.forEach(secret => {
        const name = secret.name.split('/').pop();
        console.log(`  - ${name}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Secret Manager test failed:', error.message);
    
    // Special guidance for common errors
    if (error.message.includes('Permission denied')) {
      console.log('\nTroubleshooting tips:');
      console.log('- Check service account permissions (IAM)');
      console.log('- Ensure service account has secretmanager.secretAccessor role');
    }
    
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Testing GCP Setup for Proof of Funds');
  console.log('======================================');
  
  // Check environment
  const envCheck = checkEnvironment();
  if (!envCheck) {
    console.error('\n❌ Environment check failed. Fix environment variables before continuing.');
    process.exit(1);
  }
  
  // Initialize GCP auth
  try {
    console.log('\n== Testing GCP Authentication ==');
    const authStatus = await initGcpAuth();
    
    if (authStatus.initialized) {
      console.log('✅ GCP authentication initialized successfully');
    } else {
      console.error('❌ GCP authentication failed:', authStatus.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ GCP authentication initialization failed:', error.message);
    process.exit(1);
  }
  
  // Test storage access
  const storageSuccess = await testStorageAccess();
  
  // Test Secret Manager
  const secretSuccess = await testSecretManager();
  
  // Results
  console.log('\n== Summary ==');
  console.log('GCP Environment Check:', envCheck ? '✅ Passed' : '❌ Failed');
  console.log('Storage Access Test:', storageSuccess ? '✅ Passed' : '❌ Failed');
  console.log('Secret Manager Test:', secretSuccess ? '✅ Passed' : '❌ Failed');
  
  if (envCheck && storageSuccess && secretSuccess) {
    console.log('\n✅ GCP setup appears to be working correctly!');
  } else {
    console.log('\n⚠️ Some GCP tests failed. See errors above for details.');
    process.exit(1);
  }
}

// Run the tests
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});