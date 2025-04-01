# Proof of Funds Circuits

This directory contains the Circom circuits used for zero-knowledge proofs in the Proof of Funds protocol.

## Balance Verification Circuit

The main circuit for Proof of Funds is `balance_verification.circom`, which allows proving statements about a wallet's balance without revealing the actual balance.

### Proof Types

The circuit supports three types of balance verification:

1. **Standard (Equal)**: Proves that a wallet's balance is exactly equal to a specific amount
2. **Threshold (Greater Than or Equal)**: Proves that a wallet's balance is greater than or equal to a threshold
3. **Maximum (Less Than or Equal)**: Proves that a wallet's balance is less than or equal to a maximum amount

### Circuit Structure

```
template BalanceVerification() {
    // Public inputs
    signal input walletAddress;
    signal input threshold;
    signal input proofType;
    
    // Private inputs
    signal input balance;
    
    // Outputs
    signal output addressHash;
    signal output thresholdHash;
    signal output proofTypeOut;
    signal output result;
    
    // Constraints and logic
    ...
}
```

## Compilation Process

There are two ways to compile the circuit:

### Using the Compilation Script

The easiest way to compile the circuit is to use the provided script:

```bash
# Basic compilation (uses existing Powers of Tau if available)
npm run compile:circuit

# Full compilation with new trusted setup
npm run compile:circuit:full

# Compile a specific circuit
node circuits/compile.js --circuit my_circuit_name

# Force recompilation even if outputs exist
node circuits/compile.js --force
```

### Manual Compilation

If you prefer to compile the circuit manually:

1. Install Circom: `npm install -g circom`
2. Install snarkjs: `npm install -g snarkjs`
3. Compile the circuit: `circom balance_verification.circom --r1cs --wasm --sym`
4. Setup the proving system: 
   ```
   snarkjs powersoftau new bn128 14 pot14_0000.ptau -v
   snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau --name="First contribution" -v
   snarkjs powersoftau prepare phase2 pot14_0001.ptau pot14_final.ptau -v
   snarkjs groth16 setup balance_verification.r1cs pot14_final.ptau balance_verification_0000.zkey
   snarkjs zkey contribute balance_verification_0000.zkey balance_verification_0001.zkey --name="Second contribution" -v
   snarkjs zkey export verificationkey balance_verification_0001.zkey verification_key.json
   ```

## Testing the Circuit

To test the circuit with integration tests:

```bash
# First compile the circuit
npm run compile:circuit

# Then run the integration tests
npm run test:circuit
```

The integration tests verify that:
1. The circuit correctly generates proofs for different proof types
2. The proofs can be verified using the verification key
3. The entire proof system works end-to-end

## Directory Structure

- `balance_verification.circom`: The main circuit file
- `balance_verification_js/`: Generated JavaScript files for the circuit
- `balance_verification_final.zkey`: The proving key
- `verification_key.json`: The verification key for verifying proofs

## Integration with JavaScript

The circuit is used in the application through the zkProofGenerator module in `/lib/zk/zkProofGenerator.js`, which provides a clean API for generating and working with proofs:

```javascript
import { generateZKProof } from '../lib/zk/zkProofGenerator';

// Generate a proof
const proof = await generateZKProof(
  walletAddress,
  balance,
  threshold,
  proofType, // 0=standard, 1=threshold, 2=maximum
  network
);
```

## Fallback for Development

For development and testing purposes, the system includes a fallback mechanism in `zkProofGenerator.js` that simulates proofs when the actual circuit files aren't available. This allows for development and testing without needing to compile the circuits.