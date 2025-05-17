# Fix GCP Permissions Guide

The service account needs additional permissions to use Google Cloud Storage. Follow these steps to fix it:

## Issue
- Your service account has Secret Manager permissions but not Cloud Storage permissions
- The zkey files are too large (>65KB) for Secret Manager, so we need to use Cloud Storage

## Steps to Fix

### 1. Go to IAM Page
Open: https://console.cloud.google.com/iam-admin/iam?project=proof-of-funds-455506

### 2. Find Your Service Account
Look for: `proof-of-funds-zk-sa@proof-of-funds-455506.iam.gserviceaccount.com`

### 3. Add Cloud Storage Permissions
1. Click the pencil icon (Edit) next to your service account
2. Click "ADD ANOTHER ROLE"
3. Search for and add: `Storage Admin`
4. Click "SAVE"

### 4. Alternative: Grant Specific Permissions
If you prefer minimal permissions, grant these specific roles instead:
- `Storage Object Admin` - for uploading/downloading files
- `Storage Legacy Bucket Owner` - for creating buckets

## What This Fixes
- Allows creating Cloud Storage buckets
- Allows uploading large zkey files
- Enables secure file storage for ZK proofs

## After Fixing Permissions
Run the deployment again:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="./gcp-sa-key.json"
node scripts/deploy-keys-to-storage.js
```

## Alternative: Use Firebase Storage
Since you're already using Firebase, you could also use Firebase Storage:
- No additional permissions needed
- Same Google infrastructure
- Simpler setup

Let me know if you'd prefer the Firebase approach instead!