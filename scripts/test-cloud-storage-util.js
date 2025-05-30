#!/usr/bin/env node

/**
 * Consolidated Cloud Storage Testing Utility
 * 
 * This script combines functionality from:
 * - test-cloud-storage.js: Tests the ZKeyStorageManager integration
 * - test-cloud-storage-permissions.js: Tests raw GCP permissions and access
 */

require('dotenv').config();
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const ZKeyStorageManager = require('../packages/backend/utils/zkeyStorageManager');

// Available test modes
const TEST_MODES = {
  PERMISSIONS: 'permissions',
  STORAGE_MANAGER: 'storage-manager',
  ALL: 'all'
};

/**
 * Test Google Cloud Storage permissions
 * @returns {Promise<boolean>} Success indicator
 */
async function testPermissions() {
  try {
    console.log('=== Testing Google Cloud Storage Permissions ===\n');
    
    // Load environment variables
    const projectId = process.env.GCP_PROJECT_ID || 'proof-of-funds-455506';
    const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                   path.join(__dirname, '..', 'gcp-sa-key.json');
    
    console.log(`Project ID: ${projectId}`);
    console.log(`Key File: ${keyFile}`);
    console.log(`Key exists: ${fs.existsSync(keyFile)}`);
    
    // Initialize storage
    const storage = new Storage({
      projectId: projectId,
      keyFilename: keyFile
    });
    
    const bucketName = `${projectId}-zkeys`;
    console.log(`\nBucket Name: ${bucketName}`);
    
    // Test 1: List buckets
    console.log('\n1. Testing bucket listing...');
    try {
      const [buckets] = await storage.getBuckets();
      console.log(`✅ Successfully listed ${buckets.length} buckets`);
      const targetBucket = buckets.find(b => b.name === bucketName);
      if (targetBucket) {
        console.log(`✅ Found target bucket: ${bucketName}`);
      } else {
        console.log(`❌ Target bucket not found: ${bucketName}`);
      }
    } catch (error) {
      console.error(`❌ Failed to list buckets: ${error.message}`);
      return false;
    }
    
    // Test 2: Check bucket access
    console.log('\n2. Testing bucket access...');
    try {
      const bucket = storage.bucket(bucketName);
      const [exists] = await bucket.exists();
      if (exists) {
        console.log(`✅ Bucket exists and is accessible`);
      } else {
        console.log(`❌ Bucket does not exist: ${bucketName}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Failed to check bucket: ${error.message}`);
      return false;
    }
    
    // Test 3: List files in bucket
    console.log('\n3. Testing file listing...');
    try {
      const bucket = storage.bucket(bucketName);
      const [files] = await bucket.getFiles();
      console.log(`✅ Successfully listed ${files.length} files in bucket`);
      files.forEach(file => {
        console.log(`   - ${file.name} (${file.metadata.size} bytes)`);
      });
    } catch (error) {
      console.error(`❌ Failed to list files: ${error.message}`);
      return false;
    }
    
    // Test 4: Try to read a specific file
    console.log('\n4. Testing file read (standard.zkey)...');
    try {
      const bucket = storage.bucket(bucketName);
      const file = bucket.file('standard.zkey');
      const [exists] = await file.exists();
      
      if (exists) {
        console.log('✅ File exists, testing download...');
        const [metadata] = await file.getMetadata();
        console.log(`   Size: ${metadata.size} bytes`);
        console.log(`   Created: ${metadata.timeCreated}`);
        
        // Test downloading a small chunk
        const stream = file.createReadStream({ start: 0, end: 1000 });
        let downloaded = 0;
        
        stream.on('data', (chunk) => {
          downloaded += chunk.length;
        });
        
        stream.on('end', () => {
          console.log(`✅ Successfully downloaded ${downloaded} bytes`);
        });
        
        stream.on('error', (error) => {
          console.error(`❌ Download error: ${error.message}`);
        });
        
        await new Promise((resolve) => stream.on('end', resolve));
      } else {
        console.log('❌ File does not exist: standard.zkey');
        return false;
      }
    } catch (error) {
      console.error(`❌ Failed to read file: ${error.message}`);
      return false;
    }
    
    // Test 5: Check IAM permissions
    console.log('\n5. Testing IAM permissions...');
    try {
      const bucket = storage.bucket(bucketName);
      const [permissions] = await bucket.iam.testPermissions([
        'storage.buckets.get',
        'storage.objects.get',
        'storage.objects.list',
        'storage.objects.create'
      ]);
      console.log('✅ Permissions granted:');
      permissions.forEach(p => console.log(`   - ${p}`));
    } catch (error) {
      console.error(`❌ Failed to check permissions: ${error.message}`);
      return false;
    }
    
    console.log('\n=== Permissions test completed successfully ===');
    return true;
  } catch (error) {
    console.error('Fatal error:', error);
    return false;
  }
}

/**
 * Test the ZKeyStorageManager implementation
 * @returns {Promise<boolean>} Success indicator
 */
async function testStorageManager() {
  console.log('===== Testing ZKeyStorageManager Implementation =====\n');
  
  try {
    const storageManager = new ZKeyStorageManager();
    const circuits = ['standard', 'threshold', 'maximum'];
    let allSuccessful = true;
    
    for (const circuit of circuits) {
      try {
        console.log(`Testing ${circuit} zkey...`);
        
        // Try to download the zkey
        const zkeyData = await storageManager.getZKey(circuit);
        console.log(`✅ Successfully downloaded ${circuit} zkey (${zkeyData.length} bytes)`);
        
        // Generate a signed URL
        const signedUrl = await storageManager.getSignedUrl(circuit);
        console.log(`✅ Generated signed URL for ${circuit}`);
        console.log(`   URL: ${signedUrl.substring(0, 50)}...`);
        
      } catch (error) {
        console.error(`❌ Error testing ${circuit}:`, error.message);
        allSuccessful = false;
      }
    }
    
    console.log('\n===== Storage Manager Test Complete =====');
    return allSuccessful;
  } catch (error) {
    console.error('Fatal error:', error);
    return false;
  }
}

/**
 * Main function to run the tests
 * @param {string} mode - Test mode (permissions, storage-manager, or all)
 */
async function runTests(mode) {
  console.log(`Running test mode: ${mode}`);
  let permissionsSuccess = true;
  let managerSuccess = true;
  
  if (mode === TEST_MODES.PERMISSIONS || mode === TEST_MODES.ALL) {
    permissionsSuccess = await testPermissions();
  }
  
  if (mode === TEST_MODES.STORAGE_MANAGER || mode === TEST_MODES.ALL) {
    managerSuccess = await testStorageManager();
  }
  
  if (mode === TEST_MODES.ALL) {
    console.log('\n===== OVERALL TEST RESULTS =====');
    console.log(`GCP Permissions: ${permissionsSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Storage Manager: ${managerSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Overall Status: ${permissionsSuccess && managerSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  }
  
  process.exit((permissionsSuccess && managerSuccess) ? 0 : 1);
}

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const modeArg = args[0] || TEST_MODES.ALL;
  
  if (!Object.values(TEST_MODES).includes(modeArg)) {
    console.error(`Invalid test mode: ${modeArg}`);
    console.error(`Available modes: ${Object.values(TEST_MODES).join(', ')}`);
    process.exit(1);
  }
  
  return modeArg;
}

// Run the test
if (require.main === module) {
  const mode = parseArgs();
  runTests(mode);
}

module.exports = {
  testPermissions,
  testStorageManager,
  runTests,
  TEST_MODES
};