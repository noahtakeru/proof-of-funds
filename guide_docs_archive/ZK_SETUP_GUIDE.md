# Zero-Knowledge Proof Setup Guide

## Overview

This guide explains how to set up and use the zero-knowledge proof system in the Proof of Funds project.

## Current Status

The project has the following ZK components installed:

✅ **snarkjs**: Installed and working (v0.7.5)  
✅ **circom**: Installed (v0.5.46) but has version compatibility issues

## Version Compatibility Issue

The circuit files in this project are written for circom 2.0.0, but we've installed circom 0.5.46, which is an older version. There are two ways to resolve this:

1. **Modify Circuit Files**: Update the circuit files to be compatible with circom 0.5.46 by removing the `pragma circom 2.0.0;` line and making any other necessary syntax changes.

2. **Install circom 2.x**: Install circom 2.x using one of the approaches below.

## Setup Options for circom 2.x

### Option 1: Using Docker (Recommended)

Docker provides the most consistent environment for working with circom:

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Use the official circom Docker image:
   ```
   docker run -it --rm -v $(pwd):/home/circom/app iden3/circom:latest circom --version
   ```
3. To compile circuits, run:
   ```
   docker run -it --rm -v $(pwd):/home/circom/app iden3/circom:latest circom /home/circom/app/lib/zk/circuits/standardProof.circom --r1cs --wasm --sym -o /home/circom/app/lib/zk/build/
   ```

### Option 2: Build From Source

For native performance:

1. Install Rust and Cargo:
   ```
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
2. Install Xcode Command Line Tools (if not installed):
   ```
   xcode-select --install
   ```
3. Clone and build circom 2.x:
   ```
   git clone https://github.com/iden3/circom.git
   cd circom
   cargo build --release
   cargo install --path circom
   cd ..
   ```

### Option 3: Use Placeholder Files (For Development)

The project is designed to work with placeholder files for development:

1. Run the build script with the .mjs extension:
   ```
   node lib/zk/scripts/build-circuits.mjs
   ```
2. This creates placeholder files that allow the system to run in mock mode

## Current Setup Status

We currently have:
1. circom 0.5.46 installed via npm (deprecated version)
2. snarkjs 0.7.5 installed and working
3. Placeholder files generated for development

The build script is successfully creating placeholder files when circom compilation fails, which allows development to continue without a fully working circom setup.

## Using ZK Proofs in the Project

1. **Generate Proofs**: Use the `generateZKProof` function from `lib/zk/zkProofGenerator.js`
2. **Verify Proofs**: Use the `verifyZKProof` function from `lib/zk/zkVerifier.js`

Example usage:
```javascript
import { generateZKProof, ZK_PROOF_TYPES } from './lib/zk/zkProofGenerator.js';

// Generate a standard proof (exact balance)
const proof = await generateZKProof({
  walletAddress: '0x1234567890123456789012345678901234567890',
  amount: '1000000000000000000', // 1 ETH in wei
  proofType: ZK_PROOF_TYPES.STANDARD,
  privateData: {
    nonce: '123456789',
    signature: ['0', '0']
  }
});
```

## Running Tests

Currently, some tests fail due to Jest configuration issues with ESM modules, but the core functionality works.

To test ZK proof generation:
```
node test-zk-proof.js
```

To test snarkjs:
```
node test-snarkjs.js
```

## Next Steps

1. To get circom working fully:
   - Install circom 2.x using Docker (recommended)
   - OR complete the Command Line Tools installation (via Xcode popup) and build from source
   - OR modify circuit files to be compatible with circom 0.5.46

2. Run the circuit build script to generate real circuit files after resolving version compatibility

3. Use the ZK proof generation and verification system in your application

## Resources

- [circom Documentation](https://docs.circom.io/)
- [snarkjs Documentation](https://github.com/iden3/snarkjs)
- [Zero-Knowledge Proofs Overview](https://zkproof.org/2020/07/28/zero-knowledge-proofs-an-intuitive-explanation/) 