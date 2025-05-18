#!/usr/bin/env node

/**
 * Test Google Cloud Storage permissions
 */

const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

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
      }
    } catch (error) {
      console.error(`❌ Failed to check bucket: ${error.message}`);
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
      }
    } catch (error) {
      console.error(`❌ Failed to read file: ${error.message}`);
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
    }
    
    console.log('\n=== Test completed ===');
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the test
testPermissions();