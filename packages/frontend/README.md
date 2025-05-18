# Proof of Funds - Frontend Package

This package contains the frontend web application for the Proof of Funds platform.

## Features

- Wallet connection with MetaMask and other providers
- Fund verification through standard and zero-knowledge proofs
- Multi-chain asset scanning and display
- User-friendly proof management interface
- Google Cloud Platform integration for secure proof management

## Development

### Prerequisites

- Node.js 16+
- Access to the Proof of Funds GCP project
- Service account key file (gcp-sa-key.json in the project root)

### Environment Setup

Create a `.env.local` file with the following configuration:

```
# GCP Configuration
GCP_PROJECT_ID=proof-of-funds-455506
GCP_STORAGE_BUCKET=proof-of-funds-455506-zkeys
GOOGLE_APPLICATION_CREDENTIALS=../../gcp-sa-key.json
```

### Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint
```

## Google Cloud Integration

This project uses Google Cloud Platform for:

1. Storing ZK proof files in Cloud Storage
2. Managing secrets in Secret Manager
3. Secure authentication via service accounts

### GCP Scripts

The following npm scripts are available for GCP management:

```bash
# Test connection to GCP
npm run gcp:connect

# Verify ZK proof files
npm run gcp:verify-zkeys

# Upload proof files to GCP (if needed)
npm run gcp:upload-proofs
```

## Components

- **WalletSelector** - Connect to various wallet providers
- **WalletBalanceProof** - Display and manage proof data
- **ZKVerificationResult** - Display verification results
- **MultiChainAssetDisplay** - Show assets across multiple chains

## Pages

- **/** - Home page with platform introduction
- **/create** - Create new proofs of funds
- **/verify** - Verify existing proofs
- **/manage** - Manage your proofs

## API Endpoints

- **/api/zk/generateProofCloudStorage** - Generates ZK proofs using files from Cloud Storage
- **/api/gcp-status** - Checks GCP connection status (admin-only)

## Documentation

For more detailed information, see:

- [Existing GCP Integration Guide](../../docs/EXISTING-GCP-INTEGRATION.md) - Working with the existing GCP setup
- [GCP Setup Instructions](../../docs/GCP-SETUP.md) - Initial GCP setup (for reference)