# Google Cloud Platform Integration Guide

This consolidated guide covers all aspects of Google Cloud Platform integration for the Proof of Funds project.

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Project Setup](#project-setup)
4. [Service Configuration](#service-configuration)
5. [Development](#development)
6. [Deployment](#deployment)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)
9. [References](#references)

## Introduction

Proof of Funds uses Google Cloud Platform for:
- Secure storage of ZK proof files (zkeys)
- Secret management for credentials and API keys
- Authenticated API endpoints
- Secure cloud infrastructure

## Quick Start

For a quick setup of GCP integration:

```bash
# Install dependencies
npm install

# Test GCP configuration
node scripts/test-cloud-storage-util.js

# Test complete setup
node scripts/test-complete-setup.js

# Upload proof files to GCP storage
node scripts/deploy-keys.js --storage=cloud-storage
```

## Project Setup

### Creating a New Project

```bash
# Using gcloud CLI
gcloud projects create proof-of-funds-prod --name="Proof of Funds Production"

# Set as default project
gcloud config set project proof-of-funds-prod
```

### Enable Required APIs

```bash
# Enable APIs
gcloud services enable secretmanager.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable iam.googleapis.com
```

### Service Account Setup

```bash
# Create service account
gcloud iam service-accounts create proof-of-funds-sa \
  --display-name="Proof of Funds Service Account"

# Grant permissions
gcloud projects add-iam-policy-binding proof-of-funds-prod \
  --member="serviceAccount:proof-of-funds-sa@proof-of-funds-prod.iam.gserviceaccount.com" \
  --role="roles/secretmanager.admin"

gcloud projects add-iam-policy-binding proof-of-funds-prod \
  --member="serviceAccount:proof-of-funds-sa@proof-of-funds-prod.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Create and download key
gcloud iam service-accounts keys create ./gcp-credentials.json \
  --iam-account=proof-of-funds-sa@proof-of-funds-prod.iam.gserviceaccount.com
```

### Environment Configuration

Create or update `.env.local` file with:

```
GCP_PROJECT_ID=proof-of-funds-455506
GOOGLE_APPLICATION_CREDENTIALS=./gcp-sa-key.json
GCP_STORAGE_BUCKET=proof-of-funds-455506-zkeys
```

## Service Configuration

### Cloud Storage Setup

```bash
# Create bucket
gsutil mb -l us-central1 gs://proof-of-funds-prod-zkeys

# Set proper permissions
gsutil iam ch serviceAccount:proof-of-funds-sa@proof-of-funds-prod.iam.gserviceaccount.com:objectAdmin gs://proof-of-funds-prod-zkeys
```

### Secret Manager Setup

Store sensitive values in Secret Manager:

```bash
# Create a secret
gcloud secrets create jwt-secret --replication-policy="automatic"
echo "your-secure-random-jwt-secret" | gcloud secrets versions add jwt-secret --data-file=-

# Create admin API key
gcloud secrets create admin-api-key --replication-policy="automatic"
echo "your-secure-admin-api-key" | gcloud secrets versions add admin-api-key --data-file=-
```

Access these secrets in code:

```javascript
const { getSecret } = require('./utils/gcpAuth');

// Get secret
const jwtSecret = await getSecret('jwt-secret');
```

### Uploading ZK Proof Files

After setting up Cloud Storage:

```bash
# From the project root
node scripts/deploy-keys.js --storage=cloud-storage
```

This uploads the zkey files for all circuit types (standard, threshold, maximum) to your GCP bucket. You can also use Secret Manager for smaller files:

```bash
# For smaller files that fit in Secret Manager (<64KB)
node scripts/deploy-keys.js --storage=secret-manager

# Auto-detect best storage based on file size
node scripts/deploy-keys.js --storage=auto
```

### File Storage Considerations

ZK proof files are too large for Secret Manager (which has a 65KB limit):
- standardProof.zkey: 596KB
- maximumProof.zkey: 892KB
- thresholdProof.zkey: 1.0MB

Therefore, we use Cloud Storage for zkey files and Secret Manager for credentials and other smaller secrets.

## Development

### Running in Development

When running in development mode, the app will use the credentials specified in `GOOGLE_APPLICATION_CREDENTIALS`. If this isn't set, it will look for a `gcp-sa-key.json` file in these locations:

1. Current directory
2. Project root directory
3. Packages directory

### Folder Structure

- `/packages/backend/utils/zkeyProvider.ts` - Unified ZKey provider interface
- `/packages/backend/utils/zkeySecretManagerProvider.ts` - GCP Secret Manager implementation
- `/packages/backend/utils/zkeyCloudStorageProvider.ts` - Cloud Storage implementation
- `/scripts/deploy-keys.js` - Deploys keys to GCP (single consolidated script)
- `/scripts/test-cloud-storage-util.js` - Tests GCP storage configuration
- `/scripts/test-complete-setup.js` - Tests complete GCP integration
- `/packages/frontend/pages/api/zk/generateProofCloudStorage.js` - Secure API endpoint

### Testing GCP Integration

Run the comprehensive test suite:

```bash
# Test Cloud Storage specifically
node scripts/test-cloud-storage-util.js

# Test just permissions
node scripts/test-cloud-storage-util.js permissions

# Test complete setup including API endpoints
node scripts/test-complete-setup.js
```

## Deployment

### Vercel Deployment

For Vercel deployment:
1. Convert service account JSON to single line
2. Add environment variables:
   - `GCP_SERVICE_ACCOUNT`: The stringified JSON service account key
   - `GCP_PROJECT_ID`: Your GCP project ID

### Google Cloud Run Deployment

For Cloud Run deployment:
1. No need to provide service account key - use built-in service identity
2. Set environment variables:
   - `GCP_PROJECT_ID`: Your GCP project ID

### Deployment Checklist

- [x] Enable GCP APIs
- [x] Create service account
- [x] Add Cloud Storage permissions
- [x] Upload zkey files
- [x] Update frontend code
- [x] Remove public keys
- [x] Test implementation

## Security Best Practices

1. **Principle of Least Privilege**: Service accounts only have permissions they need
2. **Secure Secret Storage**: Use Secret Manager, not environment variables
3. **Short-lived Credentials**: Use automatic key rotation when possible
4. **Audit Logging**: Enable audit logging for all GCP services
5. **Never commit** service account keys to git
6. **Rotate keys** periodically
7. **Monitor access** - check Secret Manager and Cloud Storage logs
8. **Separate environments** - use different projects for dev/prod

## Troubleshooting

### Common Issues

**Permission Denied**
- Check service account has correct IAM roles
- Verify you're using the right project ID

**Authentication Failed**
- Ensure GOOGLE_APPLICATION_CREDENTIALS points to valid file
- Check service account hasn't been deleted or disabled

**Storage Access Issues**
- Verify bucket exists and service account has access
- Check bucket name is correctly specified in environment variables

**"API not enabled" Error**
- Make sure you've enabled the required APIs
- Wait 1-2 minutes after enabling
- Check if billing is enabled for the project

**"Project not found" Error**
- Verify project ID is correct
- Ensure you're logged into the right Google account
- Check `gcloud config get-value project`

### Diagnostic Tests

Run the test scripts to identify issues:

```bash
# Test Cloud Storage access
node scripts/test-cloud-storage-util.js

# Test complete setup
node scripts/test-complete-setup.js
```

## References

- [Google Cloud Platform Documentation](https://cloud.google.com/docs)
- [Google Cloud Storage JavaScript Client](https://cloud.google.com/storage/docs/reference/libraries#client-libraries-install-nodejs)
- [Google Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)

---

_This guide consolidates information from multiple source documents including GCP-SETUP.md, GCP-COMPLETE-GUIDE.md, GCP-DEPLOYMENT-CHECKLIST.md, and GCP-SETUP-COMPLETE.md, which have been deprecated in favor of this comprehensive guide._