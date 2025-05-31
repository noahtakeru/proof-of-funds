# External Service Configuration

This document provides a centralized reference for all external service configurations, API keys, and deployment details for the Proof of Funds platform. It serves as the authoritative source for Phase 1.6 implementation details.

## Table of Contents

1. [Blockchain Providers](#blockchain-providers)
2. [Google Cloud Platform](#google-cloud-platform)
3. [Smart Contract Deployments](#smart-contract-deployments)
4. [Environment Variables](#environment-variables)
5. [Security Best Practices](#security-best-practices)

## Blockchain Providers

### Moralis API

The platform uses Moralis API for blockchain data access across multiple chains.

- **API Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImI3NTZhNjkxLTRiN2YtNGFiZS04MzI5LWFlNTJkMGY5MTljOSIsIm9yZ0lkIjoiNDM4NjMwIiwidXNlcklkIjoiNDUxMjU4IiwidHlwZUlkIjoiMTc1YjllYzktYmQ3Ni00NWNhLTk1NWItZTBlOTAzNzM1YTlkIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NDMyMzMyNjYsImV4cCI6NDg5ODk5MzI2Nn0.bLFdmNSmPM51zuRhxDmQ-YN1V-II9Mtd-FxdvZHkmys`
- **Integration File**: `packages/common/src/utils/moralisApi.js`
- **Supported Chains**:
  - Ethereum Mainnet
  - Polygon (Mainnet, Mumbai, Amoy)
  - Arbitrum
  - Optimism
  - Binance Smart Chain
  - Avalanche
  - Fantom
  - Base
  - Solana (limited support via API)

### Chain Configuration

Chain configuration is centralized in the following files:

- **Chain Mappings**: `packages/common/src/utils/chainMappings.js`
- **Chain Adapters**: 
  - `packages/frontend/utils/chains/ChainAdapter.ts`
  - `packages/frontend/utils/chains/EVMChainAdapter.ts`
  - `packages/frontend/utils/chains/SolanaChainAdapter.ts`
  - `packages/frontend/utils/chains/BitcoinChainAdapter.ts`

### RPC Endpoints

Default RPC endpoints are configured in `chainMappings.js`:

- **Polygon Amoy**: `https://rpc-amoy.polygon.technology`
- **Ethereum Mainnet**: `https://ethereum.publicnode.com`
- **Polygon Mainnet**: `https://polygon-rpc.com`
- **Arbitrum**: `https://arb1.arbitrum.io/rpc`
- **Optimism**: `https://mainnet.optimism.io`

## Google Cloud Platform

### Project Configuration

- **Project ID**: `proof-of-funds-455506`
- **Service Account**: Credentials in `gcp-sa-key.json` (root directory)
- **Enabled APIs**:
  - Secret Manager
  - Cloud Storage
  - Cloud Functions
  - Cloud Logging

### Cloud Storage

- **Bucket Name**: `proof-of-funds-455506-zkeys`
- **Files Stored**:
  - `standard.zkey` (~596KB)
  - `threshold.zkey` (~1MB)
  - `maximum.zkey` (~892KB)
- **Storage Manager**: `packages/backend/utils/zkeyStorageManager.js`

### Secret Manager

- **Key Management**: `packages/backend/utils/zkeyManager.js`
- **Secrets**:
  - `zkey-standard` - Standard proof ZK key
  - `zkey-threshold` - Threshold proof ZK key
  - `zkey-maximum` - Maximum proof ZK key
  - JWT secret and other credentials (see Environment Variables section)

### API Endpoints

- **Cloud Storage Integration**: `packages/frontend/pages/api/zk/generateProofCloudStorage.js`
- **Test Utilities**:
  - `scripts/test-cloud-storage-util.js` - Test GCP Storage access
  - `scripts/verify-gcp-deployment.js` - Verify GCP deployment

## Smart Contract Deployments

### ReferenceTokenRegistry Contract

- **Network**: Polygon Amoy Testnet (Chain ID: 80002)
- **Contract Address**: `0x19180Cc2d399257F2ea6212A2985eBEcA9EC9970`
- **Transaction Hash**: `0x929a4dbc60efa0060c14aadcae0a877dd3e36be7bfb6549ba854b6336cab6242`
- **Deployment Date**: May 22, 2025
- **Deployment File**: `packages/contracts/deployments/polygon_amoy-2025-05-22T09-05-23.665Z.json`
- **Contract Source**: `packages/contracts/contracts/ReferenceTokenRegistry.sol`
- **Deployment Script**: `packages/contracts/scripts/deploy-reference-registry.js`

### Service Wallet

- **Generation Script**: `generateServiceWallet.js` (root directory)
- **Purpose**: Used for contract interactions and transaction signing
- **Security**: Credentials are stored securely in GCP Secret Manager

## Environment Variables

The following environment variables are required for external service configuration:

```
# GCP Configuration
GCP_PROJECT_ID=proof-of-funds-455506
GOOGLE_APPLICATION_CREDENTIALS=./gcp-sa-key.json
GCP_STORAGE_BUCKET=proof-of-funds-455506-zkeys

# Blockchain Configuration
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
POLYGONSCAN_API_KEY=<polygonscan-api-key>
PRIVATE_KEY=<contract-deployment-private-key>

# API Keys
MORALIS_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Security Best Practices

1. **API Key Protection**:
   - Never commit API keys to the repository
   - Store sensitive keys in GCP Secret Manager
   - Use environment variables for local development

2. **Service Account Management**:
   - Use principle of least privilege for service accounts
   - Rotate service account keys periodically
   - Store service account key securely

3. **Contract Deployment**:
   - Use dedicated wallets for contract deployment
   - Never expose private keys in code or logs
   - Verify contract code on block explorers after deployment

4. **Access Control**:
   - Use IAM roles to limit service account permissions
   - Implement proper authentication for API endpoints
   - Monitor access to secrets and storage resources

5. **Regular Auditing**:
   - Enable audit logging for all GCP services
   - Review access logs periodically
   - Check for unauthorized access attempts

---

This document serves as the central reference for all external service configuration as part of Phase 1.6 implementation. For detailed integration guides, refer to:

- `docs/GCP-INTEGRATION-GUIDE.md` - Comprehensive guide for GCP integration (updated with accurate paths and commands)
- `docs/ZKP-PLATFORM-IMPLEMENTATION-PLAN.md` - Overall implementation plan and progress tracking