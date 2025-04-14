# Real Wallet Test Harness

This directory contains the Real Wallet Test Harness for testing ZK proofs with actual wallets on the Polygon Amoy testnet.

## Overview

The test harness consists of three main components:

1. **WalletFixture.js** - Manages test wallets including creation, funding, balance adjustment, and cleanup
2. **TestnetProvider.js** - Connects to Polygon Amoy testnet and handles network-specific operations
3. **ProofVerificationE2E.js** - Runs end-to-end tests for all three proof types (standard, threshold, maximum)

## Requirements

To run these tests, you'll need:

- A funded wallet on Polygon Amoy testnet with at least 0.2 MATIC
- Node.js v14+ and npm installed

## Getting Started

1. **Set up environment**:
   Create a `.env` file in this directory or set the environment variable:
   ```
   POLYGON_AMOY_PRIVATE_KEY=0xYourPrivateKeyHere
   ```

2. **Install dependencies**:
   ```
   npm install dotenv
   ```

3. **Run the tests**:
   ```
   node run-polygon-tests.js
   ```

## Test Results

Test results are saved in the `results` directory:
- JSON file with detailed test data
- Markdown report with test summary and pass/fail information

## Integration with Regression Tests

You can include these tests in the regression test suite by using the `--real-wallet-tests` flag:

```
./lib/zk/tests/regression/run-regression-tests.sh --real-wallet-tests
```

## Test Configuration

You can customize the test behavior by modifying the configuration in `run-polygon-tests.js`:

- `preserveWallets`: Set to `true` to keep test wallets for debugging
- `smartContractTest`: Set to `true` and provide a contract address to test smart contract verification

## Notes

- These tests use real MATIC from your wallet, but only small amounts (0.2 MATIC total)
- The test harness is designed to clean up after itself, returning funds to your wallet
- For CI/CD environments, consider implementing a mock mode that doesn't require real transactions 