# Circuit Testing Guide

This guide provides instructions for testing the optimized ZK circuits.

## Simplified Testing (No Dependencies Required)

For quick validation of the circuit logic without installing additional dependencies:

```bash
cd /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk
node test-circuits.cjs
```

This script validates the circuit logic using the test input files without requiring circom or snarkjs installation.

## Complete Testing (Requires Circom & SnarkJS)

For complete testing including compilation, proof generation, and verification:

1. Install Circom and SnarkJS:
```bash
npm install -g circom
npm install -g snarkjs
```

2. Clone the repository (if you haven't already):
```bash
git clone https://github.com/yourusername/proof-of-funds.git
cd proof-of-funds
```

## Step 1: Build the Circuits

```bash
cd lib/zk
node scripts/build-circuits.js
```

This will compile all three circuit types (standardProof, thresholdProof, maximumProof) and generate the necessary files in the `build` directory.

## Step 2: Check Constraint Count

After building, check the constraint count in the generated info files:

```bash
cat build/standardProof_info.json
cat build/thresholdProof_info.json
cat build/maximumProof_info.json
```

Verify that the constraint counts meet our targets:
- Standard Proof: <10,000 constraints
- Threshold Proof: <15,000 constraints
- Maximum Proof: <15,000 constraints

## Step 3: Generate Test Inputs

Create a directory for test inputs:

```bash
mkdir -p test-inputs
```

### Sample Test Input for Standard Proof

Create `test-inputs/standardProof_input.json`:

```json
{
  "address": "123456789012345678901234567890123456789",
  "amount": "1000000000000000000",
  "nonce": "123456789",
  "actualBalance": "1000000000000000000",
  "signature": ["1", "2"],
  "walletSecret": "987654321"
}
```

### Sample Test Input for Threshold Proof

Create `test-inputs/thresholdProof_input.json`:

```json
{
  "address": "123456789012345678901234567890123456789",
  "threshold": "1000000000000000000",
  "nonce": "123456789",
  "actualBalance": "2000000000000000000",
  "signature": ["1", "2"],
  "walletSecret": "987654321"
}
```

### Sample Test Input for Maximum Proof

Create `test-inputs/maximumProof_input.json`:

```json
{
  "address": "123456789012345678901234567890123456789",
  "maximum": "2000000000000000000",
  "nonce": "123456789",
  "actualBalance": "1000000000000000000", 
  "signature": ["1", "2"],
  "walletSecret": "987654321"
}
```

## Step 4: Generate and Verify Proofs

Run the following commands to test each circuit:

### Standard Proof

```bash
# Generate witness
node build/wasm/standardProof_js/generate_witness.js build/wasm/standardProof_js/standardProof.wasm test-inputs/standardProof_input.json witness.wtns

# Generate proof
snarkjs groth16 prove build/zkey/standardProof.zkey witness.wtns proof.json public.json

# Verify proof
snarkjs groth16 verify build/verification_key/standardProof.json public.json proof.json
```

### Threshold Proof

```bash
# Generate witness
node build/wasm/thresholdProof_js/generate_witness.js build/wasm/thresholdProof_js/thresholdProof.wasm test-inputs/thresholdProof_input.json witness.wtns

# Generate proof
snarkjs groth16 prove build/zkey/thresholdProof.zkey witness.wtns proof.json public.json

# Verify proof
snarkjs groth16 verify build/verification_key/thresholdProof.json public.json proof.json
```

### Maximum Proof

```bash
# Generate witness
node build/wasm/maximumProof_js/generate_witness.js build/wasm/maximumProof_js/maximumProof.wasm test-inputs/maximumProof_input.json witness.wtns

# Generate proof
snarkjs groth16 prove build/zkey/maximumProof.zkey witness.wtns proof.json public.json

# Verify proof
snarkjs groth16 verify build/verification_key/maximumProof.json public.json proof.json
```

## Step 5: Automated Testing with Jest

You can also run automated tests using our Jest test suite:

```bash
cd lib/zk
npm test -- --grep "Circuit Tests"
```

## Step 6: Invalid Input Testing

To test that the circuits correctly reject invalid inputs, create test files with invalid data:

### Invalid Standard Proof (amount mismatch)

Create `test-inputs/standardProof_invalid.json`:

```json
{
  "address": "123456789012345678901234567890123456789",
  "amount": "1000000000000000000",
  "nonce": "123456789",
  "actualBalance": "2000000000000000000",
  "signature": ["1", "2"],
  "walletSecret": "987654321"
}
```

### Invalid Threshold Proof (below threshold)

Create `test-inputs/thresholdProof_invalid.json`:

```json
{
  "address": "123456789012345678901234567890123456789",
  "threshold": "2000000000000000000",
  "nonce": "123456789",
  "actualBalance": "1000000000000000000",
  "signature": ["1", "2"],
  "walletSecret": "987654321"
}
```

### Invalid Maximum Proof (above maximum)

Create `test-inputs/maximumProof_invalid.json`:

```json
{
  "address": "123456789012345678901234567890123456789",
  "maximum": "1000000000000000000",
  "nonce": "123456789",
  "actualBalance": "2000000000000000000", 
  "signature": ["1", "2"],
  "walletSecret": "987654321"
}
```

Run the tests with invalid inputs and verify that they fail as expected.

## Step 7: Gas Cost Estimation

To estimate gas costs for on-chain verification:

```bash
# Generate Solidity verifier
snarkjs zkey export solidityverifier build/zkey/standardProof.zkey verifier.sol

# Simulate gas usage (requires truffle)
truffle exec scripts/estimate-gas.js
```

## Troubleshooting

### Common Issues

1. **Error: ENOENT: no such file or directory**
   - Ensure you're in the correct directory
   - Check that all files exist at the expected paths

2. **Error: witness generation failed**
   - Verify your input JSON matches the circuit requirements
   - Check for typos in signal names

3. **Error: verification failed**
   - This is expected for invalid inputs
   - For valid inputs, ensure circuit constraints are satisfied

4. **Error: circom command not found**
   - Ensure circom is installed globally
   - Try running `which circom` to verify installation

### Getting Help

If you encounter issues not covered here, please:
1. Check the error message carefully
2. Look for issues in your input data
3. Verify that Circom and SnarkJS are properly installed

## Advanced Testing

For more advanced testing, consider:

1. **Batch Proof Generation**: Test generating multiple proofs
2. **Performance Testing**: Measure time to generate proofs on different hardware
3. **Memory Usage**: Monitor memory consumption during proof generation

## Conclusion

These tests verify that our optimized circuits:
1. Generate valid proofs for valid inputs
2. Reject invalid inputs
3. Meet our constraint count targets
4. Maintain the security properties and functionality requirements

Once all tests pass, the circuits are ready for integration into the main application.