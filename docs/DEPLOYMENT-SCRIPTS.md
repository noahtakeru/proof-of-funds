# Deployment Scripts Guide

This guide provides comprehensive documentation for the deployment scripts used in the Proof of Funds system, with a focus on the consolidated and preferred approaches.

## Key Deployment

### Preferred Approach: `deploy-keys.js`

The `deploy-keys.js` script is the consolidated and recommended way to deploy ZK keys to different storage backends. It supports multiple storage options and has intelligent handling based on file sizes.

```bash
node scripts/deploy-keys.js [options]
```

#### Options:

- `--storage=<type>`: Storage type to use
  - `secret-manager`: Use GCP Secret Manager (size limit: 64KB)
  - `cloud-storage`: Use GCP Cloud Storage (no size limit)
  - `auto`: Automatically select based on file size (default)
- `--circuits=<list>`: Comma-separated list of circuits to deploy (default: `standard,threshold,maximum`)
- `--force`: Force upload even if file exceeds size limits
- `--help`: Show help message

#### Examples:

```bash
# Deploy all circuits using automatic storage selection
node scripts/deploy-keys.js

# Deploy only the standard circuit to Secret Manager
node scripts/deploy-keys.js --storage=secret-manager --circuits=standard

# Deploy all circuits to Cloud Storage
node scripts/deploy-keys.js --storage=cloud-storage

# Force deployment to Secret Manager even for large files
node scripts/deploy-keys.js --storage=secret-manager --force
```

### Legacy Scripts (Deprecated)

The following scripts are maintained for backward compatibility but are deprecated. New code should use `deploy-keys.js` directly.

#### `deploy-keys-to-gcp.js`

Wrapper around `deploy-keys.js` that deploys keys to GCP Secret Manager.

```bash
node scripts/deploy-keys-to-gcp.js
```

#### `deploy-keys-to-storage.js`

Wrapper around `deploy-keys.js` that deploys keys to GCP Cloud Storage.

```bash
node scripts/deploy-keys-to-storage.js
```

## Environment Configuration

### Required Environment Variables

The deployment scripts require the following environment variables:

- `GCP_PROJECT_ID`: Google Cloud Platform project ID
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to the GCP service account key file
- `GCP_STORAGE_BUCKET` (optional): Custom storage bucket name for Cloud Storage

### Environment File

Create a `.env.local` file in the project root with these variables:

```
GCP_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account-key.json
GCP_STORAGE_BUCKET=your-bucket-name
```

## Storage Backends

### Secret Manager

- Best for small files (< 64KB)
- Higher security level
- Versioning support
- Access control via IAM

### Cloud Storage

- Supports files of any size
- Cost-effective for larger files
- Can be configured with various access controls
- Supports CDN integration

## Troubleshooting

If you encounter issues with the deployment scripts:

1. Verify your GCP credentials are correctly set up
2. Check that the circuit files exist in the expected locations
3. Ensure you have the necessary permissions in GCP
4. Run `node scripts/test-cloud-storage-permissions.js` to verify permissions
5. Check for detailed error messages in the console output

## Next Steps After Deployment

After successfully deploying your keys:

1. Update your API endpoints to use the appropriate storage backend
2. Remove local zkey files from public directories for security
3. Test the storage implementation with your application
4. Set up proper access controls in GCP

---

_This guide consolidates information about all deployment scripts in the codebase. The recommended approach is to use the `deploy-keys.js` script directly for all new deployments._