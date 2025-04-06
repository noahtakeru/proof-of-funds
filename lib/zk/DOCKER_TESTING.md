# Docker Testing Guide for Circuit Optimization

This guide explains how to use Docker to test the optimized ZK circuits with a real circom installation.

## Prerequisites

- Docker and Docker Compose must be installed on your system
- Basic familiarity with Docker commands

## Quick Start

Run this single command from the project root to test the circuits:

```bash
docker-compose -f lib/zk/docker-compose.yml up --build
```

This will:
1. Build a Docker image with circom installed
2. Compile the optimized circuits
3. Run the tests to validate the circuits
4. Report the constraint counts

## Manual Testing

If you want more control over the testing process, you can run the container interactively:

```bash
# Build the Docker image
docker-compose -f lib/zk/docker-compose.yml build

# Run the container interactively
docker-compose -f lib/zk/docker-compose.yml run --rm zk-circuit-tester bash
```

Inside the container, you can run:

```bash
# Navigate to the zk directory
cd lib/zk

# Build circuits
node scripts/build-circuits.js

# Run tests
node test-circuits.cjs
```

## Understanding the Results

After compilation, check the constraint counts in the generated info files:

```bash
cat build/standardProof_info.json
cat build/thresholdProof_info.json
cat build/maximumProof_info.json
```

Verify that the constraint counts meet our targets:
- Standard Proof: <10,000 constraints
- Threshold Proof: <15,000 constraints
- Maximum Proof: <15,000 constraints

## Examining Circuit Output

To examine the compiled circuits in detail, you can:

```bash
# Look at r1cs information
npx snarkjs r1cs info build/standardProof.r1cs

# Export r1cs to JSON for detailed inspection
npx snarkjs r1cs export json build/standardProof.r1cs build/standardProof.r1cs.json
```

## Running Complete Tests

For a full test cycle including proof generation and verification:

```bash
# Generate witness
cd lib/zk
node build/wasm/standardProof_js/generate_witness.js build/wasm/standardProof_js/standardProof.wasm test-inputs/standardProof_input.json witness.wtns

# Generate proof
npx snarkjs groth16 prove build/zkey/standardProof.zkey witness.wtns proof.json public.json

# Verify proof
npx snarkjs groth16 verify build/verification_key/standardProof.json public.json proof.json
```

## Troubleshooting

If you encounter issues:

1. Check that Docker is properly installed and running
2. Ensure you're running the commands from the project root directory
3. Verify that the volume mapping is working correctly
4. Check for any error messages during the build process

## Cleaning Up

To remove the containers and images when done:

```bash
docker-compose -f lib/zk/docker-compose.yml down --rmi all
```