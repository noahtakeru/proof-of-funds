# Proof of Funds - Setup and Usage Guide

This guide explains how to set up, compile, and use the Zero-Knowledge Proof of Funds system. The system allows users to cryptographically prove statements about their wallet balances without revealing the actual balances.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Compiling Circuits](#compiling-circuits)
4. [Running Tests](#running-tests)
5. [Using the ZK Proof System](#using-the-zk-proof-system)
6. [Creating and Verifying Proofs](#creating-and-verifying-proofs)
7. [Integration with GCP Secret Manager](#integration-with-gcp-secret-manager)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 16 or higher
- npm or yarn
- Git repository cloned locally
- For circuit compilation: Circom 2.0 installed globally (`npm install -g circom`)

## Initial Setup

1. Install project dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
# Create a .env file from the template
cp .env.example .env

# Edit the .env file with your configuration
nano .env
```

3. Set up Google Cloud Platform (optional but recommended for production):

```bash
# Follow the steps in GCP_SETUP.md
node scripts/setup-gcp-keys.js
```

## Compiling Circuits

Before you can use the ZK proof system with actual circuits (rather than simulation), you need to compile the circuits:

```bash
# Basic compilation (uses existing Powers of Tau if available)
npm run compile:circuit

# Full compilation with new trusted setup (for production)
npm run compile:circuit:full

# Compile a specific circuit
node circuits/compile.js --circuit my_circuit_name
```

This will generate the necessary circuit files in the `circuits/compiled` directory, including:

- WebAssembly files for circuit execution
- Proving keys for generating proofs
- Verification keys for verifying proofs
- Solidity verifier contract

## Running Tests

To ensure everything is working correctly, run the test suite:

```bash
# Run all tests including smart contracts
npm test

# Run just the ZK-related tests
npm run test:zk

# Run only circuit integration tests
npm run test:circuit
```

The integration tests will verify that:
- The circuit correctly generates proofs for different proof types
- The proofs can be verified using the verification key
- The entire proof system works end-to-end

## Using the ZK Proof System

The ZK proof system can be used from both client-side and server-side code. Here's how to import and use the main functions:

```javascript
// Import from the zk module
import { 
  generateZKProof, 
  createProofPackage,
  verifyProofLocally
} from './lib/zk';
```

## Creating and Verifying Proofs

### Generating a Proof

```javascript
// 1. Generate a ZK proof
const proof = await generateZKProof(
  '0x1234567890abcdef1234567890abcdef12345678', // Wallet address
  '10000000000000000000', // 10 ETH (in wei)
  '5000000000000000000', // 5 ETH threshold (in wei)
  1, // Proof type: 1 = THRESHOLD (>=)
  'ethereum' // Network
);

// 2. Create a complete proof package with encryption
const expiryTime = Date.now() + 86400000; // 1 day from now
const proofPackage = await createProofPackage(
  proof,
  walletAddress,
  balance,
  proofType,
  expiryTime
);

// 3. The reference ID can be shared with others
console.log(`Proof reference ID: ${proofPackage.referenceId}`);
// Access key is needed to decrypt the proof
console.log(`Access key: ${proofPackage.accessKey}`);
```

### Verifying a Proof

```javascript
// Verify a proof locally
const isValid = await verifyProofLocally(proof, walletAddress, proofType);
console.log(`Proof is valid: ${isValid}`);

// Verify a proof on-chain (requires a deployed verifier contract)
const isValidOnChain = await verifyProofOnChain(
  proof, 
  contractAddress, 
  provider
);
```

## Integration with GCP Secret Manager

For secure management of keys and secrets, the system integrates with Google Cloud Platform's Secret Manager:

```javascript
// Import temporary wallet manager functions
import { 
  createSecureWalletForProof,
  fundTemporaryWallet
} from './lib/zk';

// Generate a secure wallet using GCP-stored master seed
const wallet = await createSecureWalletForProof('user-proof-123');

// Fund the temporary wallet for proof generation
await fundTemporaryWallet(wallet.address, '0.01');
```

For detailed setup instructions for GCP, refer to the `GCP_SETUP.md` file.

## Troubleshooting

### Circuit Compilation Issues

If you encounter errors during circuit compilation:

1. Make sure Circom is installed globally: `npm install -g circom`
2. Try the full compilation with `--force` flag: `npm run compile:circuit:full -- --force`
3. Check for syntax errors in the circuit file: `circom --check circuits/balance_verification.circom`

### Test Failures

If integration tests fail:

1. Verify that you've compiled the circuits: `npm run compile:circuit`
2. Check the Jest configuration in `jest.config.js`
3. Make sure dependencies are correctly installed: `npm i`

### Proof Generation Errors

If proof generation fails:

1. Check if the circuit files exist in the correct location
2. Verify that the input values are in the correct format (e.g., BigNumber for balances)
3. Check console errors for specific snarkjs-related issues

For more detailed troubleshooting, consult the documentation in the `/docs` directory.