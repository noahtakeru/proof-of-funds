# ZK Proof Generation - Local Execution Instructions

This document provides step-by-step instructions for generating real ZK proofs on your local machine.

## Prerequisites

1. **Docker Desktop**
   - Install from [Docker's official website](https://www.docker.com/products/docker-desktop/)
   - Make sure Docker is running before proceeding

2. **Git Repository**
   - Ensure you have cloned the repository to your local machine
   - Navigate to the repository root: `cd proof-of-funds`

## Step 1: Run the Full Execution Script

The simplest approach is to run the full execution script which will handle all steps:

```bash
# Make the script executable if needed
chmod +x scripts/zk-full-execution.sh

# Run the script
./scripts/zk-full-execution.sh
```

This script will:
1. Set up the Docker environment
2. Compile the circuit files
3. Generate proving and verification keys
4. Deploy the files to the frontend directory
5. Run tests to verify everything works

## Step 2: Verify the Installation

After the script completes, run the WebAssembly integrity test:

```bash
node tests/zk-proofs/test-wasm-integrity.js
```

You should see all tests passing with a message like:
```
=== Summary ===
✅ All ZK files are valid and ready for proof generation
```

## Step 3: Run a Proof Generation Test

Test that proofs can be generated and verified:

```bash
node tests/zk-proofs/generate-verify-proof.js
```

If successful, you'll see:
```
Proof verification result: VALID ✅
```

## Manual Execution (if needed)

If you need to run steps individually:

### 1. Compile Circuits

```bash
./scripts/compile-circuits.sh
```

### 2. Generate Keys

```bash
./scripts/generate-keys.sh
```

### 3. Deploy to Frontend

```bash
./scripts/deploy-circuits.sh
```

## Troubleshooting

If you encounter issues:

1. **Docker not running**: Ensure Docker Desktop is running
2. **Permission denied**: Make scripts executable with `chmod +x scripts/*.sh`
3. **Missing dependencies**: Run `npm install` to install Node.js dependencies
4. **WebAssembly errors**: These typically indicate issues with the circuit compilation

For detailed error logs, check the Docker output during execution.

## Note on Development vs. Production

The scripts create development-ready ZK circuit files. For production deployment:

1. Use a more comprehensive Powers of Tau ceremony
2. Securely manage the proving keys
3. Consider optimization options in the Circom compilation