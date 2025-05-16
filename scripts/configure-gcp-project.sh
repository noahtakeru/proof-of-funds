#!/bin/bash
# Configure GCP Project for Proof of Funds

PROJECT_ID="proof-of-funds-455506"

echo "===== Configuring GCP Project: $PROJECT_ID ====="

# 1. Set project ID in environment
echo "Setting environment variables..."
echo "GCP_PROJECT_ID=$PROJECT_ID" >> .env
echo "✅ Added GCP_PROJECT_ID to .env"

# 2. Create setup instructions
cat > gcp-setup-instructions.md << 'EOF'
# GCP Setup Instructions for proof-of-funds-455506

## 1. Enable Required APIs

Run these commands in Google Cloud Shell or with gcloud CLI:

```bash
# Set project
gcloud config set project proof-of-funds-455506

# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Verify it's enabled
gcloud services list --enabled | grep secretmanager
```

## 2. Create Service Account (if needed)

```bash
# Create service account
gcloud iam service-accounts create proof-of-funds-zk-sa \
  --display-name="Proof of Funds ZK Service Account" \
  --project=proof-of-funds-455506

# Grant Secret Manager permissions
gcloud projects add-iam-policy-binding proof-of-funds-455506 \
  --member="serviceAccount:proof-of-funds-zk-sa@proof-of-funds-455506.iam.gserviceaccount.com" \
  --role="roles/secretmanager.admin"

# Create and download service account key
gcloud iam service-accounts keys create ./gcp-sa-key.json \
  --iam-account=proof-of-funds-zk-sa@proof-of-funds-455506.iam.gserviceaccount.com \
  --project=proof-of-funds-455506
```

## 3. Configure Application Default Credentials

For local development:

```bash
# Option 1: Use service account key
export GOOGLE_APPLICATION_CREDENTIALS="./gcp-sa-key.json"

# Option 2: Use your personal credentials
gcloud auth application-default login
```

## 4. Test Secret Manager Access

```bash
# Create a test secret
echo "test-value" | gcloud secrets create test-secret \
  --data-file=- \
  --project=proof-of-funds-455506

# Read it back
gcloud secrets versions access latest \
  --secret=test-secret \
  --project=proof-of-funds-455506

# Delete test secret
gcloud secrets delete test-secret \
  --project=proof-of-funds-455506
```

## 5. Deploy ZK Keys

Once APIs are enabled and authentication is configured:

```bash
# Deploy zkeys to Google Cloud Secret Manager
node scripts/deploy-keys-to-gcp.js
```

## 6. Update Application Code

Update your API endpoints to use the secure versions:

```javascript
// Instead of: /api/zk/generateProof
// Use: /api/zk/generateProofSecure
```

## Next Steps

1. Enable the Secret Manager API (required)
2. Set up authentication (service account or personal)
3. Deploy the zkeys
4. Test the secure endpoints
5. Remove local zkey files from public directories
EOF

echo "✅ Created gcp-setup-instructions.md"

# 3. Update package.json to include GCP client library
echo "Installing Google Cloud Secret Manager client..."
cd packages/backend
npm install @google-cloud/secret-manager
cd ../..

# 4. Create deployment verification script
cat > scripts/verify-gcp-deployment.js << 'EOF'
/**
 * Verify GCP deployment is working correctly
 */

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

async function verifyDeployment() {
  console.log('===== Verifying GCP Deployment =====');
  
  const projectId = process.env.GCP_PROJECT_ID;
  if (!projectId) {
    console.error('❌ GCP_PROJECT_ID not set in environment');
    process.exit(1);
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
  } catch (error) {
    console.error('❌ Deployment verification failed:', error.message);
    console.error('\nMake sure to:');
    console.error('1. Enable the Secret Manager API');
    console.error('2. Set up authentication');
    console.error('3. Check the setup instructions in gcp-setup-instructions.md');
  }
}

verifyDeployment().catch(console.error);
EOF

echo "✅ Created verification script"

echo "
===== Setup Complete =====

Next steps:
1. Review gcp-setup-instructions.md
2. Enable the Secret Manager API in GCP Console
3. Set up authentication (see instructions)
4. Run: node scripts/verify-gcp-deployment.js
5. Deploy zkeys: node scripts/deploy-keys-to-gcp.js

Your project ID is configured as: $PROJECT_ID
"