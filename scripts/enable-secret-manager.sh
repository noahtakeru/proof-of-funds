#!/bin/bash
# Script to guide through Secret Manager API enablement

PROJECT_ID="proof-of-funds-455506"

echo "===== Enabling Secret Manager API for $PROJECT_ID ====="
echo ""
echo "Please follow these steps:"
echo ""
echo "Option 1: Via Web Console"
echo "1. Go to: https://console.cloud.google.com/apis/library/secretmanager.googleapis.com?project=$PROJECT_ID"
echo "2. Click 'ENABLE' button"
echo ""
echo "Option 2: Via Cloud Shell/CLI"
echo "Run this command:"
echo "gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID"
echo ""
echo "Option 3: Direct Link"
echo "Click here to enable: https://console.cloud.google.com/flows/enableapi?apiid=secretmanager.googleapis.com&project=$PROJECT_ID"
echo ""
echo "After enabling, press Enter to continue..."
read

echo "Testing if Secret Manager API is enabled..."
echo "Running verification script..."

# Try to run the verification
node scripts/verify-gcp-deployment.js