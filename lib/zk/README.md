# Zero-Knowledge Proof of Funds Implementation

This directory contains the core implementation of the Zero-Knowledge Proof of Funds system. It allows users to generate cryptographic proofs about their wallet balances without revealing the actual balance amounts.

## Overview

The Zero-Knowledge (ZK) Proof system consists of the following components:

1. **Circom Circuits** - Cryptographic circuits that define the logic for balance verification
2. **Proof Generation** - JavaScript API for generating proofs using the circuits
3. **Proof Verification** - Functions for verifying proofs both on-chain and off-chain
4. **Proof Encryption** - Encryption/decryption functionality for secure storage and sharing
5. **Reference IDs** - Short, user-friendly identifiers for sharing proofs
6. **Temporary Wallet Management** - Secure wallet creation for generating proofs

## Getting Started

### Prerequisites

- Node.js 16+
- Circom (for circuit compilation)
- SnarkJS

### Compilation

1. First, compile the Circom circuits:

```bash
# Basic compilation
npm run compile:circuit

# Full compilation with new trusted setup
npm run compile:circuit:full
```

### Testing

Run the integration tests to verify the circuit works correctly:

```bash
npm run test:circuit
```

## Core Modules

### zkProofGenerator.js

Main API for generating zero-knowledge proofs. Provides functions like:

- `generateZKProof(walletAddress, balance, threshold, proofType, network)` - Generate a ZK proof
- `createProofPackage(proof, walletAddress, amount, proofType, expiryTime)` - Create a complete proof package
- `encryptProof(proof, accessKey)` - Encrypt a proof for secure storage
- `decryptProof(encryptedProofData, accessKey)` - Decrypt an encrypted proof

### zkProofVerifier.js

Functions for verifying ZK proofs:

- `verifyProofLocally(proofData, walletAddress, proofType)` - Verify a proof client-side
- `verifyProofOnChain(proofData, contractAddress, provider)` - Verify a proof using a smart contract

### proofEncryption.js

Utilities for encrypting and decrypting proofs:

- `generateAccessKey()` - Generate a secure random access key
- `encryptProof(proofData, accessKey)` - Encrypt proof data using AES
- `decryptProof(encryptedProof, accessKey)` - Decrypt encrypted proof data

### referenceId.js

Utilities for working with reference IDs:

- `generateReferenceId(walletAddress, proofType)` - Generate a unique reference ID
- `formatReferenceId(referenceId)` - Format a reference ID for display
- `validateReferenceId(referenceId)` - Validate a reference ID format

### referenceStore.js

Storage mechanism for reference IDs and their metadata:

- `storeReferenceId(referenceId, metadata)` - Store a reference ID with metadata
- `getReferenceIdMetadata(referenceId)` - Retrieve metadata for a reference ID
- `getAllReferenceIds()` - Get all stored reference IDs

### tempWalletManager.js

Manages temporary wallets for secure proof generation:

- `createTemporaryWalletForPurpose(masterSeed, purposeId, options)` - Create a deterministic wallet
- `getWalletForPurpose(purposeId)` - Retrieve an existing temporary wallet
- `archiveWalletForPurpose(purposeId)` - Archive a temporary wallet after use

## Usage Examples

### Generating a Proof

```javascript
import { generateZKProof, createProofPackage } from './lib/zk';

// Generate a ZK proof that the wallet has at least 5 ETH
const proof = await generateZKProof(
  '0x1234567890abcdef1234567890abcdef12345678', // Wallet address
  '10000000000000000000', // 10 ETH (in wei)
  '5000000000000000000', // 5 ETH threshold (in wei)
  1, // Proof type: 1 = THRESHOLD (>=)
  'ethereum' // Network
);

// Create a complete proof package with encryption
const expiryTime = Date.now() + 86400000; // 1 day from now
const proofPackage = await createProofPackage(
  proof,
  walletAddress,
  balance,
  proofType,
  expiryTime
);

// The reference ID can be shared with others
console.log(`Proof reference ID: ${proofPackage.referenceId}`);
// Access key is needed to decrypt the proof
console.log(`Access key: ${proofPackage.accessKey}`);
```

### Verifying a Proof

```javascript
import { verifyProofLocally } from './lib/zk';

// Verify a proof locally
const isValid = await verifyProofLocally(proof, walletAddress, proofType);
console.log(`Proof is valid: ${isValid}`);
```

## Implementation Philosophy

1. **Privacy-First**: No actual balance values are ever leaked or stored unencrypted
2. **Security**: Cryptographic primitives ensure proofs can't be forged
3. **User Experience**: Reference IDs and simple API make the system easy to use
4. **Development-Friendly**: Fallback mechanisms for development without requiring circuit compilation
5. **Full Integration**: Works with Ethereum, Polygon, and other EVM-compatible chains

## Development and Testing

- See `__tests__` directory for comprehensive tests
- Run `npm run test:zk` to run all ZK-related tests

## Advanced Usage

### Custom Circuit Integration

To integrate a custom circuit:

1. Create your circuit in the `/circuits` directory
2. Compile it with `node circuits/compile.js --circuit your_circuit_name`
3. Update the ZK proof generator to use your custom circuit