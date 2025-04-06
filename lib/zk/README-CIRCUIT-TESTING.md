# ZK Circuit Testing Guide

This guide explains how to test the ZK circuits in the Proof of Funds system.

## Prerequisites

1. Install circom compiler (version 2.0.0+):
   ```
   npm install -g circom
   ```

2. Install project dependencies:
   ```
   npm install
   ```

## Test Files

The test files are organized as follows:

- `__tests__/circuits/*.test.js`: Individual circuit tests
- `__tests__/testRunners/`: Test runners for each circuit
- `test-inputs/`: JSON input files for circuit testing
- `build/`: Build artifacts including constraint information

## Running Circuit Tests

### Basic Circuit Tests

To run the basic circuit tests that verify the logic without full compilation:

```
cd lib/zk
npx jest __tests__/circuits/circuitOptimization.test.js
```

This will test whether:
- The circuits meet their constraint count targets
- The circuit logic works with valid inputs
- The circuit logic rejects invalid inputs

### Full Circuit Tests (requires circom)

To run the full circuit tests that actually compile and test the circuits:

```
cd lib/zk
./__tests__/run-circuit-tests.sh
```

This script will:
1. Compile the circuits using circom
2. Generate and verify proofs
3. Check constraint counts
4. Report results

## Test Inputs

The `test-inputs/` directory contains JSON files with test vectors:

- `standardProof_input.json`: Valid input for standard proof 
- `standardProof_invalid.json`: Invalid input for standard proof
- `thresholdProof_input.json`: Valid input for threshold proof
- `thresholdProof_invalid.json`: Invalid input for threshold proof
- `maximumProof_input.json`: Valid input for maximum proof
- `maximumProof_invalid.json`: Invalid input for maximum proof

## Building Circuits

You can build the circuits without running tests using:

```
cd lib/zk
node scripts/build-circuits.cjs
```

This will:
1. Compile circuits to r1cs format
2. Generate WASM files for witness calculation
3. Create zkey files for proving
4. Generate verification keys
5. Output constraint counts

## Troubleshooting

If you encounter issues with circom compilation:

1. Check that circom is installed globally:
   ```
   circom --version
   ```

2. Verify the include paths in circuit files match your project structure.

3. Check for syntax errors in circuit files:
   ```
   circom lib/zk/circuits/standardProof.circom --check
   ```

4. If using a module system that doesn't support ESM, use the CommonJS versions of build scripts:
   ```
   node lib/zk/scripts/build-circuits.cjs
   ```
