#!/bin/bash
# Configure GCP Project for Proof of Funds

PROJECT_ID="proof-of-funds-455506"

echo "===== Configuring GCP Project: $PROJECT_ID ====="

# 1. Set project ID in environment
echo "Setting environment variables..."
echo "GCP_PROJECT_ID=$PROJECT_ID" >> .env
echo "✅ Added GCP_PROJECT_ID to .env"

# 2. Generate setup instructions using the utility module
echo "Generating setup instructions..."
node -e "
const fs = require('fs');
const { generateSetupInstructions } = require('./gcp-deployment-utils');
const markdown = generateSetupInstructions('$PROJECT_ID');
fs.writeFileSync('gcp-setup-instructions.md', markdown);
console.log('✅ Created gcp-setup-instructions.md');
"

# 3. Update package.json to include GCP client library
echo "Installing Google Cloud Secret Manager client..."
cd packages/backend
npm install @google-cloud/secret-manager
cd ../..

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