# Zero-Knowledge Proofs Implementation

This document provides an overview of the Zero-Knowledge (ZK) proof system implemented in the Proof of Funds application.

## Overview

The ZK proof system allows users to prove they have at least a certain balance without revealing their exact holdings. Three types of proofs are supported:

1. **Standard Proof**: Prove a wallet has at least a minimum balance
2. **Threshold Proof**: Prove a wallet's balance across a specific network meets a threshold
3. **Maximum Proof**: Prove the maximum balance across multiple networks meets a threshold

## Implementation Files

### Circuit Files
- `circuits/standard/standardProof.circom`: Standard proof circuit
- `circuits/threshold/thresholdProof.circom`: Threshold proof circuit
- `circuits/maximum/maximumProof.circom`: Maximum proof circuit
- `circuits/bitify.circom`: Utilities for binary operations
- `circuits/comparators.circom`: Comparison operations for circuit constraints

### Docker Environment
- `docker/zk-compiler/Dockerfile`: Docker setup for Circom compilation
- `docker/zk-compiler/docker-compose.yml`: Container configuration
- `docker/zk-compiler/entrypoint.sh`: Entry point script for the container

### Scripts
- `scripts/zk-full-execution.sh`: Main execution script for all steps
- `scripts/compile-circuits.sh`: Circom compilation script
- `scripts/generate-keys.sh`: Key generation script
- `scripts/deploy-circuits.sh`: Frontend deployment script

### API Endpoints
- `packages/frontend/pages/api/zk/generateProof.js`: Proof generation endpoint
- `packages/frontend/pages/api/zk/verify.js`: Proof verification endpoint

### Tests
- `tests/zk-proofs/test-wasm-integrity.js`: WebAssembly integrity test
- `tests/zk-proofs/generate-verify-proof.js`: Proof generation test

## Getting Started

### Requirements
- Docker Desktop installed and running
- Node.js (version 16+)

### Installation

1. **Run the full execution script**:
   ```bash
   ./scripts/zk-full-execution.sh
   ```
   
   This will:
   - Build the Docker container
   - Compile the circuit files
   - Generate proving and verification keys
   - Deploy files to the frontend

2. **Verify the installation**:
   ```bash
   node tests/zk-proofs/test-wasm-integrity.js
   ```

See `LOCAL-EXECUTION-INSTRUCTIONS.md` for detailed installation steps.

## Using ZK Proofs in the Application

### Generating a Proof

```javascript
// Frontend example
const generateProof = async (walletAddress, amount, proofType) => {
  const response = await fetch('/api/zk/generateProof', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, amount, proofType })
  });
  
  return await response.json();
};
```

### Verifying a Proof

```javascript
// Frontend example
const verifyProof = async (proof, publicSignals, proofType) => {
  const response = await fetch('/api/zk/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proof, publicSignals, proofType })
  });
  
  return await response.json();
};
```

## Architecture

The ZK proof system follows a three-step process:

1. **Circuit Compilation**: Circom circuits are compiled to WebAssembly
2. **Proof Generation**: snarkjs generates proofs using the circuits and inputs
3. **Proof Verification**: Proofs are verified using the verification key

The implementation uses Groth16 as the proving system and bn128 as the elliptic curve.

## Further Resources

- [Circom Documentation](https://docs.circom.io/)
- [snarkjs Documentation](https://github.com/iden3/snarkjs)
- [Groth16 Protocol](https://eprint.iacr.org/2016/260.pdf)