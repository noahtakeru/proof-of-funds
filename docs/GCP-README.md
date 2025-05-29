# GCP Integration for Proof of Funds Frontend

This document explains how to set up and manage Google Cloud Platform integration for the Proof of Funds frontend.

## Quick Start

```bash
# Install dependencies
npm install

# Set up GCP project and credentials
npm run gcp:setup

# Test GCP configuration
npm run gcp:test

# Upload proof files to GCP storage
npm run gcp:upload-proofs
```

## Available Scripts

The following npm scripts are available for GCP management:

- `npm run gcp:setup` - Set up a new GCP project and configure credentials
- `npm run gcp:test` - Test GCP authentication and services
- `npm run gcp:upload-proofs` - Upload ZK proof files to GCP storage

## Environment Configuration

Create a `.env.local` file with the following variables:

```
# GCP configuration
GCP_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./path/to/gcp-credentials.json
GCP_STORAGE_BUCKET=your-project-id-zkeys

# Optional for secure secrets management
JWT_SECRET=your-jwt-secret
ADMIN_API_KEY=your-admin-api-key
```

## Running in Development

When running in development mode, the app will use the credentials specified in `GOOGLE_APPLICATION_CREDENTIALS`. If this isn't set, it will look for a `gcp-sa-key.json` file in these locations:

1. Current directory
2. Project root directory
3. Packages directory

## GCP Services Used

This integration uses the following GCP services:

1. **Cloud Storage** - Stores ZK proof files securely
2. **Secret Manager** - Securely manages JWT secrets and API keys
3. **IAM & Admin** - Manages service accounts and permissions

## Folder Structure

- `/utils/gcpAuth.js` - GCP authentication utilities
- `/utils/serviceAccountManager.js` - Service account management
- `/scripts/setup-gcp.js` - GCP setup script
- `/scripts/upload-proof-files.js` - Uploads proof files to GCP storage
- `/scripts/test-gcp-setup.js` - Tests GCP configuration
- `/pages/api/gcp-status.js` - API endpoint to check GCP status

## Troubleshooting

If you encounter issues with GCP integration:

1. Run the test script: `npm run gcp:test`
2. Check environment variables are correctly set
3. Verify service account has required permissions
4. Look for error messages in the console

## Further Resources

For more detailed information, refer to:

- [GCP Integration Guide](/docs/GCP-INTEGRATION.md)
- [Google Cloud Platform Documentation](https://cloud.google.com/docs)
- [Google Cloud Storage JavaScript Client](https://cloud.google.com/storage/docs/reference/libraries#client-libraries-install-nodejs)
- [Google Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)