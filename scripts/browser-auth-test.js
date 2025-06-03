/**
 * Test script for browser-based authentication with Google Cloud Secret Manager
 * 
 * This script verifies:
 * 1. Service account key is valid
 * 2. Secret Manager API is enabled
 * 3. Proper permissions are configured
 */

const fs = require('fs');
const path = require('path');

// Check if we need to load dotenv
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    require('dotenv').config();
    console.log('✓ Loaded environment variables from .env file');
  } catch (error) {
    console.warn('Warning: dotenv not found or failed to load .env file');
  }
}

// Import modules
let SecretManagerServiceClient;
try {
  ({ SecretManagerServiceClient } = require('@google-cloud/secret-manager'));
} catch (error) {
  console.error('❌ Failed to load Google Cloud Secret Manager client. Please install with:');
  console.error('npm install @google-cloud/secret-manager');
  process.exit(1);
}

// Main function to run the auth test
async function main() {
  try {
    // Verify credentials file exists
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsPath) {
      console.error('❌ GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
      console.error('Please set GOOGLE_APPLICATION_CREDENTIALS to point to your service account key file');
      process.exit(1);
    }

    if (!fs.existsSync(credentialsPath)) {
      console.error(`❌ Credentials file not found: ${credentialsPath}`);
      process.exit(1);
    }

    // Parse credentials to get project ID
    let projectId;
    try {
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      projectId = credentials.project_id;
      console.log(`✓ Loaded credentials for project: ${projectId}`);
    } catch (error) {
      console.error('❌ Failed to parse credentials file:', error.message);
      process.exit(1);
    }

    // Initialize the Secret Manager client
    console.log('🔄 Initializing Secret Manager client...');
    const client = new SecretManagerServiceClient();

    // Try to list secrets to verify permissions
    console.log('🔄 Testing Secret Manager access...');
    const [secrets] = await client.listSecrets({
      parent: `projects/${projectId}`,
    });

    console.log('✓ Successfully connected to Secret Manager API');
    console.log(`✓ Found ${secrets.length} secrets in project ${projectId}`);

    // Try to create a test secret
    const testSecretId = `test-secret-${Date.now()}`;
    const [secret] = await client.createSecret({
      parent: `projects/${projectId}`,
      secretId: testSecretId,
      secret: {
        replication: {
          automatic: {},
        },
      },
    });

    console.log(`✓ Successfully created test secret: ${secret.name}`);

    // Add a test version
    const [version] = await client.addSecretVersion({
      parent: secret.name,
      payload: {
        data: Buffer.from('test-auth-successful'),
      },
    });

    console.log(`✓ Successfully added secret version: ${version.name}`);

    // Access the test version
    const [accessResponse] = await client.accessSecretVersion({
      name: version.name,
    });

    console.log('✓ Successfully accessed secret version');

    // Clean up the test secret
    await client.deleteSecret({
      name: secret.name,
    });

    console.log('✓ Successfully cleaned up test secret');
    console.log('');
    console.log('🎉 Authentication test passed! Your browser setup is working correctly.');
    console.log('You can now proceed with the next step in the setup process.');

    return true;
  } catch (error) {
    console.error('❌ Authentication test failed:', error.message);
    
    if (error.code === 7) {
      console.error('❌ Permission denied. Please ensure your service account has the Secret Manager Admin role.');
    } else if (error.code === 9) {
      console.error('❌ Secret Manager API is not enabled. Please enable it in Google Cloud Console.');
      console.error('https://console.cloud.google.com/flows/enableapi?apiid=secretmanager.googleapis.com');
    }
    
    console.error('');
    console.error('For more information, see the BROWSER-SETUP-GUIDE.md file.');
    process.exit(1);
  }
}

// Run the test
main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});