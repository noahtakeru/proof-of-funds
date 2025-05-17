#!/bin/bash
# Complete GCP setup after browser configuration

echo "===== Completing GCP Setup ====="
echo ""

# Check if the key file exists
if [ ! -f "./gcp-sa-key.json" ]; then
    echo "❌ Error: gcp-sa-key.json not found!"
    echo "Please download your service account key from GCP Console first."
    echo "See BROWSER-SETUP-GUIDE.md for instructions."
    exit 1
fi

# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS="./gcp-sa-key.json"
echo "✅ Set GOOGLE_APPLICATION_CREDENTIALS"

# Test authentication
echo ""
echo "Testing authentication..."
node scripts/browser-auth-test.js

# If test passes, deploy keys
if [ $? -eq 0 ]; then
    echo ""
    echo "Deploying zkey files to GCP..."
    node scripts/deploy-keys-to-gcp.js
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Setup complete! Your zkeys are now in Google Cloud."
        echo ""
        echo "Next steps:"
        echo "1. Update your frontend to use /api/zk/generateProofSecure"
        echo "2. Run: rm packages/frontend/public/lib/zk/circuits/*.zkey"
        echo "3. Test your application"
    fi
else
    echo ""
    echo "❌ Authentication test failed. Please check:"
    echo "1. Your service account has Secret Manager Admin role"
    echo "2. The JSON key file is valid"
    echo "3. The Secret Manager API is enabled"
fi