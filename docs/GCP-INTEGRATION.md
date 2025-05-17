# Google Cloud Platform Integration

This document provides a comprehensive guide for integrating Proof of Funds with Google Cloud Platform. Our application uses GCP for secure storage of cryptographic proof files, secret management, and cloud authentication.

## Prerequisites

- Google Cloud account
- Google Cloud SDK (gcloud) installed
- Node.js 16+ and npm

## Quick Setup

We've provided automated scripts to handle most of the GCP setup. Run:

```bash
# From the frontend package
cd packages/frontend
npm run gcp:setup
```

This script will:
1. Create or verify a GCP project
2. Enable required APIs (Storage, Secret Manager, IAM)
3. Create a service account with appropriate permissions
4. Set up a storage bucket for proof files
5. Configure your environment variables

## Manual Setup

If you prefer to set up GCP manually, follow these steps:

### 1. Create a GCP Project

```bash
# Create project
gcloud projects create proof-of-funds-prod --name="Proof of Funds Production"

# Set as default project
gcloud config set project proof-of-funds-prod
```

### 2. Enable Required APIs

```bash
# Enable APIs
gcloud services enable secretmanager.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable iam.googleapis.com
```

### 3. Create Service Account

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

### 4. Configure Environment

Create or update `.env.local` file with:

```
GCP_PROJECT_ID=proof-of-funds-prod
GOOGLE_APPLICATION_CREDENTIALS=./gcp-credentials.json
GCP_STORAGE_BUCKET=proof-of-funds-prod-zkeys
```

### 5. Create Storage Bucket

```bash
# Create bucket
gsutil mb -l us-central1 gs://proof-of-funds-prod-zkeys

# Set proper permissions
gsutil iam ch serviceAccount:proof-of-funds-sa@proof-of-funds-prod.iam.gserviceaccount.com:objectAdmin gs://proof-of-funds-prod-zkeys
```

## Uploading Proof Files

After setup, upload the zkey files:

```bash
# From the frontend package
npm run gcp:upload-proofs
```

This uploads the zkey files for all circuit types to your GCP bucket.

## Secrets Management

Store sensitive values in Secret Manager instead of environment variables:

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

## Authentication Flow

Our GCP integration provides two authentication methods:

1. **User Authentication**: JWT-based auth for normal users, with wallet signature verification
2. **Service Authentication**: For GCP service-to-service communication using GCP identity

The `gcpAuth.js` utility handles both authentication types seamlessly.

## Deployment Environments

### Vercel

For Vercel deployment:
1. Convert service account JSON to single line
2. Add environment variables:
   - `GCP_SERVICE_ACCOUNT`: The stringified JSON service account key
   - `GCP_PROJECT_ID`: Your GCP project ID

### Google Cloud Run

For Cloud Run deployment:
1. No need to provide service account key - use built-in service identity
2. Set environment variables:
   - `GCP_PROJECT_ID`: Your GCP project ID

## Security Best Practices

1. **Principle of Least Privilege**: Service accounts only have permissions they need
2. **Secure Secret Storage**: Use Secret Manager, not environment variables
3. **Short-lived Credentials**: Use automatic key rotation when possible
4. **Audit Logging**: Enable audit logging for all GCP services

## Troubleshooting

**Permission Denied**
- Check service account has correct IAM roles
- Verify you're using the right project ID

**Authentication Failed**
- Ensure GOOGLE_APPLICATION_CREDENTIALS points to valid file
- Check service account hasn't been deleted or disabled

**Storage Access Issues**
- Verify bucket exists and service account has access
- Check bucket name is correctly specified in environment variables