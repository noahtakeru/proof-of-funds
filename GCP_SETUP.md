# GCP Secret Manager Integration Setup

This document provides instructions for setting up the GCP Secret Manager integration for the Proof of Funds application.

## Service Account Keys

The application uses the following service account keys:

1. **Backend Service Account** (`pof-backend-sa@proof-of-funds-455506.iam.gserviceaccount.com`)
   - Used for most operations
   - Default key used if no specific key type is specified

2. **Encryption Service Account** (`pof-encryption-sa@proof-of-funds-455506.iam.gserviceaccount.com`)
   - Used for accessing encryption keys and master seed
   - Has more restricted permissions for enhanced security

3. **Monitoring Service Account** (`pof-monitoring-sa@proof-of-funds-455506.iam.gserviceaccount.com`)
   - Used for monitoring and logging operations
   - Has limited access to secrets

## Setup Process

The application includes a setup script that copies the appropriate service account key file and configures the environment settings.

### Running the Setup Script

```bash
# For development environment with backend service account
node scripts/setup-gcp-keys.js development backend

# For test environment with encryption service account
node scripts/setup-gcp-keys.js test encryption

# For production environment with monitoring service account
node scripts/setup-gcp-keys.js production monitoring
```

The script will:
1. Copy the selected service account key file to `service-account-key.json` in the project root
2. Update the `.env.local` file with appropriate settings
3. Set `USE_MOCK_SECRETS=true` for development environment

### Required Secrets in GCP Secret Manager

For the application to work properly, the following secrets must be created in GCP Secret Manager:

#### Development Environment
- `master-seed-dev` - A hex string (32 bytes) for wallet derivation
- `encryption-keys-dev` - JSON structure with encryption keys
- `api-keys-dev` - JSON structure with API keys

#### Test Environment
- `master-seed-test` - A hex string (32 bytes) for wallet derivation
- `encryption-keys-test` - JSON structure with encryption keys
- `api-keys-test` - JSON structure with API keys

#### Production Environment
- `master-seed` - A hex string (32 bytes) for wallet derivation
- `encryption-keys` - JSON structure with encryption keys
- `api-keys` - JSON structure with API keys

### Encryption Keys Structure

The `encryption-keys` secret should have the following JSON structure:

```json
{
  "current": "key1",
  "keys": {
    "key1": "your-encryption-key-1",
    "key2": "your-encryption-key-2"
  }
}
```

### API Keys Structure

The `api-keys` secret should have the following JSON structure:

```json
{
  "polygon": {
    "rpc": "https://rpc-amoy.polygon.technology",
    "apiKey": "your-polygon-api-key"
  },
  "etherscan": "your-etherscan-api-key"
}
```

## Development with Mock Secrets

For local development without access to GCP Secret Manager, you can use mock secrets:

1. Ensure `USE_MOCK_SECRETS=true` is set in your `.env.local` file
2. The mock secrets are defined in `lib/config/gcp-secrets.js`

## Troubleshooting

### Connection Issues

If you encounter connection issues with GCP Secret Manager:

1. Check that the service account key file is correctly placed at the project root
2. Verify that the service account has the necessary permissions
3. Check the GCP project ID in the `.env.local` file
4. Ensure the Secret Manager API is enabled in your GCP project

### Testing the Connection

You can test the connection to GCP Secret Manager using the test page:

```
http://localhost:3000/test-gcp-secrets
```

This page provides tools to test access to different secrets and view the access logs. 