# Optimized ZK File Handling

This document describes the optimized approach to handling ZK circuit files in the Proof of Funds platform.

## Background

Previously, ZK circuit files were duplicated in multiple locations throughout the project, leading to:
- Increased repository size
- Synchronization issues when files were updated
- Inconsistent file paths across different environments

## Optimized Approach

We've implemented the following optimizations:

### 1. Single Source of Truth

- The `/circuits` directory at the project root is now the single source of truth for all circuit files
- Circuit files are copied to the necessary locations during the build process using `scripts/prepare-zk-files.js`
- This ensures all deployments use consistent, up-to-date circuit files

### 2. Environment-Aware Path Resolution

- The `CloudStorageStrategy` now uses environment variables for path resolution instead of hardcoded paths
- The `PROJECT_ROOT` environment variable can be set to specify the project root path
- If not set, the system calculates the project root from `process.cwd()`

### 3. Unified API Endpoint

- A new unified API endpoint (`/api/zk/generateProofUnified.js`) replaces the multiple strategy-specific endpoints
- The endpoint accepts a `strategy` parameter to select the appropriate ZK proof strategy
- This reduces code duplication and simplifies API usage

## How to Use

### Setting Up Project Root

Add the following to your `.env.local` file:

```
PROJECT_ROOT=/absolute/path/to/proof-of-funds
```

### Preparing ZK Files

Run the following command to copy circuit files to the necessary locations:

```bash
npm run prepare-zk
```

This command is also automatically run as part of the build process:

```bash
npm run build
```

### Using the Unified API Endpoint

Make POST requests to `/api/zk/generateProofUnified` with the following parameters:

```json
{
  "proofType": "standard", // or "threshold", "maximum"
  "input": {
    "balance": "1000000000000000000",
    "threshold": "1000000000000000000", // optional
    "userAddress": "0x..."
  },
  "strategy": "public" // or "secure", "cloud" (optional, defaults to "public")
}
```

## Maintenance

When updating circuit files:

1. Only update files in the `/circuits` directory
2. Run `npm run prepare-zk` to update copies in other locations
3. Commit both the source files and the copied files

## Future Improvements

- Further consolidation of duplicated utility functions
- Complete removal of hardcoded paths
- Integration with a dedicated asset management solution for larger files