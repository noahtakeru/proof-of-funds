# CIRCOM Implementation Guide

This guide provides detailed instructions for implementing real, functional ZK circuits in the Proof of Funds system.

## Core Issues with Current Implementation

The current implementation has several critical issues that need to be addressed:

1. **Placeholder Files**: The build script is generating placeholder files instead of real circuit artifacts.
2. **Circom Compilation Failures**: The circom compiler is failing to compile the circuit files.
3. **Dependency Issues**: Circuit files may have incorrect dependencies or include paths.
4. **Syntax Errors**: There may be syntax errors in the circom circuit files.
5. **Cryptographic Implementations**: The circuits use simplified placeholders instead of real cryptographic operations.

## Step 1: Fix Circuit Files

First, we need to fix the circom circuit files to ensure they compile correctly:

### 1.1. Clean up syntax errors in circuit files

Check for syntax errors in the circuit files. Common issues include:

- Missing semicolons
- Incorrect template syntax
- Invalid math expressions
- Improper component instantiations

Example of fixing a syntax error:

```circom
// BEFORE: Missing semicolon
component hasher = Poseidon(2)
hasher.inputs[0] <== input;

// AFTER: Fixed syntax
component hasher = Poseidon(2);
hasher.inputs[0] <== input;
```

### 1.2. Fix include paths

Ensure that include paths are correct and that the referenced files exist:

```circom
// BEFORE: Incorrect include path
include "../circomlib/circuits/poseidon.circom";

// AFTER: Fixed include path (using patched version)
include "../patched-circomlib/circuits/poseidon.circom";
```

### 1.3. Replace placeholder cryptographic operations

Replace placeholder operations with real implementations:

```circom
// BEFORE: Placeholder signature verification
signal signatureValid;
signatureValid <== 1;

// AFTER: Real signature verification
component signatureVerifier = EdDSAVerifier();
signatureVerifier.enabled <== 1;
signatureVerifier.pubKey[0] <== pubKeyX;
signatureVerifier.pubKey[1] <== pubKeyY;
signatureVerifier.message <== messageHash;
signatureVerifier.signature[0] <== sigR8x;
signatureVerifier.signature[1] <== sigR8y;
signatureVerifier.signature[2] <== sigS;
signatureValid <== signatureVerifier.valid;
```

## Step 2: Use Clean Circuit Files

The repository contains clean circuit files in the `circuits-clean/` directory that may compile more successfully:

```bash
# Copy clean circuit files to the circuits directory
cp -f lib/zk/circuits-clean/*.circom lib/zk/circuits/
```

## Step 3: Fix Build Script

The build script needs to be modified to handle errors better and provide more detailed output:

### 3.1. Create improved build script

Create a new file `lib/zk/scripts/real-build-circuits.cjs` with improved error handling:

```javascript
// Additional error handling and logging for circom compilation
try {
  console.log('Running circom with verbose output...');
  execSync(
    `circom ${circuitPath} --r1cs --wasm --sym -o ${BUILD_DIR} --verbose`,
    { stdio: 'inherit' }
  );
} catch (error) {
  console.error('Circom compilation failed with error:', error.message);
  console.log('Trying alternate compilation approach...');
  // Try with different options or give a more helpful error message
  throw new Error('Circuit compilation failed. See error message for details.');
}
```

### 3.2. Fix dependency issues

Ensure all necessary dependencies are properly installed:

```bash
# Install circom globally
npm install -g circom@2.1.4

# Install snarkjs globally
npm install -g snarkjs@0.7.0

# Install local dependencies
cd lib/zk
npm install circomlib@2.0.5
```

## Step 4: Use Patched Circomlib

The repository contains patched versions of circomlib components that are compatible with our circuits:

```bash
# Use patched circuits for compilation
./lib/zk/patch-circuits.sh
```

## Step 5: Step-by-Step Compilation Approach

Follow this approach to systematically fix and compile the circuits:

### 5.1. Start with a minimal circuit

Begin with a minimal circuit to verify the compilation process works:

```bash
# Compile minimal circuit
circom lib/zk/minimal-circuits/minimal.circom --r1cs --wasm --sym -o lib/zk/build
```

### 5.2. Add complexity incrementally

Once the minimal circuit compiles, gradually add more complexity:

1. Add signal inputs and outputs
2. Add basic constraints
3. Add component instantiations
4. Add cryptographic operations

### 5.3. Debug compilation issues

When compilation fails, use these approaches:

1. Check the error message for line numbers and syntax issues
2. Comment out complex parts to isolate the problem
3. Use the `--verbose` flag with circom for more detailed output
4. Try compiling with different circom versions

## Step 6: Use Docker Environment (Alternative Approach)

If local compilation continues to fail, use the provided Docker environment:

```bash
# Build the Docker image
cd lib/zk
docker build -t zk-compiler .

# Run compilation in Docker container
docker run -v $(pwd):/app zk-compiler ./build-patched-circuits.sh
```

The Dockerfile contains a properly configured environment for compiling circom circuits.

## Step 7: Verify Compiled Artifacts

After successful compilation, verify that the artifacts are real:

### 7.1. Check WebAssembly file

A real WebAssembly file will have a binary format starting with the magic number `\0asm`:

```javascript
// Check if WebAssembly file is real
const fs = require('fs');
const wasmPath = 'lib/zk/build/wasm/standardProof_js/standardProof.wasm';
const wasmContent = fs.readFileSync(wasmPath);
console.log('WebAssembly magic number:', wasmContent.slice(0, 4).toString('hex'));
// Should output: 0061736d (the hex for \0asm)
```

### 7.2. Check r1cs file

A real r1cs file will be binary, not plain text:

```javascript
const r1csPath = 'lib/zk/build/standardProof.r1cs';
const r1csContent = fs.readFileSync(r1csPath);
console.log('r1cs file is binary:', !r1csContent.toString('utf8').includes('Placeholder'));
```

## Step 8: Generate Real Proving Keys

Generate real proving keys using snarkjs:

```javascript
const { execSync } = require('child_process');
const path = require('path');

const CIRCUITS_DIR = path.join(__dirname, 'circuits');
const BUILD_DIR = path.join(__dirname, 'build');
const KEYS_DIR = path.join(__dirname, 'keys');
const PHASE1_PATH = path.join(KEYS_DIR, 'phase1_final.ptau');

async function generateKeys(circuitName) {
  const r1csPath = path.join(BUILD_DIR, `${circuitName}.r1cs`);
  const zkeyPath = path.join(BUILD_DIR, 'zkey', `${circuitName}.zkey`);
  
  // Generate initial zkey
  await execSync(`snarkjs zkey new "${r1csPath}" "${PHASE1_PATH}" "${zkeyPath}.tmp"`);
  
  // Contribute to ceremony (add randomness)
  await execSync(`snarkjs zkey contribute "${zkeyPath}.tmp" "${zkeyPath}" -e="random$(Date.now())"`);
  
  // Export verification key
  await execSync(`snarkjs zkey export verificationkey "${zkeyPath}" "${BUILD_DIR}/verification_key/${circuitName}.json"`);
  
  console.log(`Generated keys for ${circuitName}`);
}

// Generate keys for all circuits
generateKeys('standardProof');
generateKeys('thresholdProof');
generateKeys('maximumProof');
```

## Step 9: Test Real Implementations

Use the debug.js script to test the real implementations:

```bash
node lib/zk/scripts/debug.js
```

This script will:
1. Check if circuit artifacts are real or placeholders
2. Test witness generation using proper inputs
3. Attempt proof generation and verification
4. Provide detailed diagnostic information

## Conclusion

Following these steps should resolve the issues with the placeholder implementations and result in a fully functional ZK proof system with real WebAssembly modules, proper cryptographic operations, and correct proof generation and verification.

Remember that real ZK implementation requires:
1. Correctly compiled circuit files
2. Real WebAssembly modules (not placeholders)
3. Properly generated proving and verification keys
4. Actual cryptographic operations (not simplified placeholders)

Good luck with your implementation!