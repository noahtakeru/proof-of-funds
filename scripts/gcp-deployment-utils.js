/**
 * GCP Deployment Utilities
 * Common utilities for GCP deployment verification and configuration
 */

require('dotenv').config();
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

/**
 * Verify GCP deployment is working correctly
 * @param {string} [customProjectId] - Optional project ID to override environment variable
 * @returns {Promise<boolean>} True if verification succeeded
 */
async function verifyDeployment(customProjectId) {
  console.log('===== Verifying GCP Deployment =====');
  
  const projectId = customProjectId || process.env.GCP_PROJECT_ID;
  if (!projectId) {
    console.error('❌ GCP_PROJECT_ID not set in environment');
    return false;
  }
  
  console.log(`Project ID: ${projectId}`);
  
  const client = new SecretManagerServiceClient();
  
  try {
    // Test creating a secret
    const parent = `projects/${projectId}`;
    const secretId = 'test-deployment-secret';
    
    console.log('Creating test secret...');
    await client.createSecret({
      parent,
      secretId,
      secret: {
        replication: {
          automatic: {},
        },
      },
    });
    
    // Add a version
    console.log('Adding secret version...');
    await client.addSecretVersion({
      parent: `${parent}/secrets/${secretId}`,
      payload: {
        data: Buffer.from('test-value'),
      },
    });
    
    // Read it back
    console.log('Reading secret...');
    const [version] = await client.accessSecretVersion({
      name: `${parent}/secrets/${secretId}/versions/latest`,
    });
    
    const payload = version.payload.data.toString();
    console.log(`Secret value: ${payload}`);
    
    // Clean up
    console.log('Cleaning up test secret...');
    await client.deleteSecret({
      name: `${parent}/secrets/${secretId}`,
    });
    
    console.log('✅ GCP deployment verified successfully!');
    return true;
  } catch (error) {
    console.error('❌ Deployment verification failed:', error.message);
    console.error('\nMake sure to:');
    console.error('1. Enable the Secret Manager API');
    console.error('2. Set up authentication');
    console.error('3. Check the setup instructions in gcp-setup-instructions.md');
    return false;
  }
}

/**
 * Generate setup instructions markdown for a GCP project
 * @param {string} projectId - GCP project ID
 * @returns {string} Markdown content with setup instructions
 */
function generateSetupInstructions(projectId) {
  return `# GCP Setup Instructions for ${projectId}

## 1. Enable Required APIs

Run these commands in Google Cloud Shell or with gcloud CLI:

\`\`\`bash
# Set project
gcloud config set project ${projectId}

# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Verify it's enabled
gcloud services list --enabled | grep secretmanager
\`\`\`

## 2. Create Service Account (if needed)

\`\`\`bash
# Create service account
gcloud iam service-accounts create proof-of-funds-zk-sa \\
  --display-name="Proof of Funds ZK Service Account" \\
  --project=${projectId}

# Grant Secret Manager permissions
gcloud projects add-iam-policy-binding ${projectId} \\
  --member="serviceAccount:proof-of-funds-zk-sa@${projectId}.iam.gserviceaccount.com" \\
  --role="roles/secretmanager.admin"

# Create and download service account key
gcloud iam service-accounts keys create ./gcp-sa-key.json \\
  --iam-account=proof-of-funds-zk-sa@${projectId}.iam.gserviceaccount.com \\
  --project=${projectId}
\`\`\`

## 3. Configure Application Default Credentials

For local development:

\`\`\`bash
# Option 1: Use service account key
export GOOGLE_APPLICATION_CREDENTIALS="./gcp-sa-key.json"

# Option 2: Use your personal credentials
gcloud auth application-default login
\`\`\`

## 4. Test Secret Manager Access

\`\`\`bash
# Create a test secret
echo "test-value" | gcloud secrets create test-secret \\
  --data-file=- \\
  --project=${projectId}

# Read it back
gcloud secrets versions access latest \\
  --secret=test-secret \\
  --project=${projectId}

# Delete test secret
gcloud secrets delete test-secret \\
  --project=${projectId}
\`\`\`

## 5. Deploy ZK Keys

Once APIs are enabled and authentication is configured:

\`\`\`bash
# Deploy zkeys to Google Cloud Secret Manager
node scripts/deploy-keys-to-gcp.js
\`\`\`

## 6. Update Application Code

Update your API endpoints to use the secure versions:

\`\`\`javascript
// Instead of: /api/zk/generateProof
// Use: /api/zk/generateProofSecure
\`\`\`

## Next Steps

1. Enable the Secret Manager API (required)
2. Set up authentication (service account or personal)
3. Deploy the zkeys
4. Test the secure endpoints
5. Remove local zkey files from public directories`;
}

// Run verification if called directly
if (require.main === module) {
  verifyDeployment().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  verifyDeployment,
  generateSetupInstructions
};