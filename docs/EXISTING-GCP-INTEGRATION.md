# Working with Existing GCP Integration

This document provides details on how to use and maintain the existing Google Cloud Platform integration for Proof of Funds. The project is already set up with a GCP project (`proof-of-funds-455506`) and has working ZK proof files in Cloud Storage.

## Overview

The Proof of Funds application uses Google Cloud Platform for:

1. **Secure Storage** - Stores ZK proof files in Cloud Storage
2. **Secret Management** - Manages sensitive secrets via Secret Manager
3. **Authentication** - Provides service account authentication

## Prerequisites

- Access to the existing GCP project (`proof-of-funds-455506`)
- Service account key file (`gcp-sa-key.json`)
- Node.js 16+ and npm

## Quick Start

1. **Clone the repository** (if you haven't already)
   ```bash
   git clone <repository-url>
   cd proof-of-funds
   ```

2. **Install dependencies**
   ```bash
   cd packages/frontend
   npm install
   ```

3. **Verify GCP connection**
   ```bash
   npm run gcp:connect
   ```

4. **Verify ZKey files in storage**
   ```bash
   npm run gcp:verify-zkeys
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## Configuration

The application uses the following environment variables for GCP integration:

```
# Required variables
GCP_PROJECT_ID=proof-of-funds-455506
GOOGLE_APPLICATION_CREDENTIALS=../../gcp-sa-key.json
GCP_STORAGE_BUCKET=proof-of-funds-455506-zkeys
```

For local development, create a `.env.local` file in the `packages/frontend` directory with the above variables.

## Available Scripts

The following npm scripts are available for working with GCP:

- `npm run gcp:connect` - Test connection to the GCP project
- `npm run gcp:verify-zkeys` - Verify ZKey files in Cloud Storage
- `npm run gcp:upload-proofs` - Upload ZK proof files to GCP storage (if needed)

## Architecture

### Service Account Manager

The `serviceAccountManager.js` utility centralizes GCP authentication:

- Handles different authentication methods (service account key, ADC, etc.)
- Provides authenticated clients for GCP services
- Maintains a cached client for performance

### ZKey Storage Manager

The `zkeyStorageManager.js` utility:

- Downloads ZK proof files from Cloud Storage
- Generates signed URLs for temporary access
- Ensures bucket exists when needed

### GCP Auth

The `gcpAuth.js` utility:

- Integrates with Secret Manager
- Provides secure authentication middleware
- Verifies service identity

## Circuit Files

The application uses three circuit types:

1. `standard.zkey` - Standard proof of funds
2. `threshold.zkey` - Proof funds exceed threshold
3. `maximum.zkey` - Maximum amount proof

These files are stored in the Cloud Storage bucket (`proof-of-funds-455506-zkeys`).

## Secrets

The following secrets are stored in Secret Manager:

- `api-keys` - API keys for external services
- `encryption-keys` - Keys for data encryption
- `master-wallet-seed` - Seed for master wallet
- `zkey-maximum` - Backup of maximum proof zkey
- `zkey-standard` - Backup of standard proof zkey
- `zkey-threshold` - Backup of threshold proof zkey

## Deployment

When deploying the application, ensure:

1. The service account key is available
2. Environment variables are properly set
3. The application has access to GCP services

### Vercel Deployment

For Vercel deployment:

1. Add the GCP service account JSON as an environment variable:
   ```
   GCP_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
   ```

2. Set the project ID:
   ```
   GCP_PROJECT_ID=proof-of-funds-455506
   ```

### Cloud Run Deployment

For Cloud Run deployment:

1. Create a service account with the appropriate permissions:
   ```bash
   gcloud iam service-accounts create proof-of-funds-sa \
     --display-name="Proof of Funds Service Account"
   ```

2. Grant the necessary permissions:
   ```bash
   gcloud projects add-iam-policy-binding proof-of-funds-455506 \
     --member="serviceAccount:proof-of-funds-sa@proof-of-funds-455506.iam.gserviceaccount.com" \
     --role="roles/storage.admin"

   gcloud projects add-iam-policy-binding proof-of-funds-455506 \
     --member="serviceAccount:proof-of-funds-sa@proof-of-funds-455506.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

3. Deploy to Cloud Run with the service account:
   ```bash
   gcloud run deploy proof-of-funds \
     --source . \
     --service-account=proof-of-funds-sa@proof-of-funds-455506.iam.gserviceaccount.com
   ```

## Maintenance

### Key Rotation

Periodically rotate the service account key:

```bash
# Create a new key
gcloud iam service-accounts keys create new-gcp-sa-key.json \
  --iam-account=proof-of-funds-sa@proof-of-funds-455506.iam.gserviceaccount.com

# Update your environment to use the new key
mv new-gcp-sa-key.json gcp-sa-key.json

# Optionally, delete the old key
gcloud iam service-accounts keys delete KEY_ID \
  --iam-account=proof-of-funds-sa@proof-of-funds-455506.iam.gserviceaccount.com
```

### Uploading New ZKey Files

If you need to update or add new ZKey files:

```bash
# Upload a new circuit file
gsutil cp path/to/new-circuit.zkey gs://proof-of-funds-455506-zkeys/new-circuit.zkey

# Or use the script for multiple files
npm run gcp:upload-proofs
```

## Troubleshooting

### Authentication Issues

If you encounter authentication issues:

1. Verify the service account key exists and is valid
2. Check the service account has the necessary permissions
3. Run `npm run gcp:connect` to test connectivity

### Missing Files

If ZKey files are missing:

1. Check the bucket contents:
   ```bash
   gsutil ls gs://proof-of-funds-455506-zkeys
   ```

2. Upload missing files:
   ```bash
   npm run gcp:upload-proofs
   ```

### Permission Denied

If you get permission denied errors:

1. Check IAM permissions in the GCP console
2. Verify the service account has the correct roles
3. Check that the environment variables are set correctly