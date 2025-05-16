# ZK Circom Debugging Guide

This document provides guidance for debugging the Circom compilation issues encountered during the ZK circuit compilation plan implementation.

## Current Errors

### 1. Circom Parser Error

```
Error: Parse error on line 1:
pragma circom 2.0.0;/* * Standar
---------------^
Expecting 'EOF', 'function', 'IDENTIFIER', '(', ')', 'template', ',', 'if', 'else', 'for', ';', 'while', 'do', 'compute', 'return', 'include', '{', '}', '==>', '-->', '===', '?', ':', '||', '&&', '|', '^', '&', '==', '!=', '<=', '>=', '<', '>', '<<', '>>', '+', '-', '*', '/', '\\', '%', '**', '++', '--', '!', '~', 'DECNUMBER', 'HEXNUMBER', 'var', 'signal', 'component', '[', ']', got '.'
```

This error persists even after rewriting the Circom files with clean formatting. It suggests:

1. An invisible character in the file
2. A possible encoding issue
3. Potential compatibility issues with Circom version 0.5.46

### 2. Powers of Tau Download Issue

The S3 bucket at hermez.s3-eu-west-1.amazonaws.com returned "Access Denied" when attempting to download the Powers of Tau file.

## Debugging Steps

### For Circom Parser Errors:

1. **Check for invisible characters**:
   ```bash
   hexdump -C packages/frontend/public/lib/zk/circuits/standardProof.circom | head -10
   ```

2. **Try different encoding conversions**:
   ```bash
   iconv -f ISO-8859-1 -t UTF-8 file.circom > file_utf8.circom
   ```

3. **Try an alternative Circom version**:
   ```bash
   npm install -g circom@0.5.45  # Try a different version
   ```

4. **Validate with minimal circuit**:
   Create a minimal test circuit like:
   ```
   pragma circom 2.0.0;
   
   template Test() {
       signal output out;
       out <== 1;
   }
   
   component main = Test();
   ```

### For Powers of Tau:

1. **Try alternative sources**:
   ```bash
   # Try IPFS
   curl -L -o ptau_file.ptau https://cloudflare-ipfs.com/ipfs/QmY3XTzMDsmn4KRRxHfXSDX1jKMh61Rb2wJEDXXYnLyU3w
   
   # Or try direct download from Polygon
   curl -L -o ptau_file.ptau https://polygon-hermez.s3.eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau
   ```

2. **Generate a smaller Powers of Tau file for testing**:
   ```bash
   snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
   snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v
   snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
   ```

## Recommendations for Full Resolution

1. **Environment Setup**:
   - Use Docker to set up a controlled environment with specific versions
   - Ensure all dependencies have compatible versions

2. **Circuit Compilation**:
   - Start with simpler circuits to validate the toolchain
   - Incrementally add complexity once basics are working

3. **WebAssembly Generation**:
   - Manually create valid WebAssembly files for testing
   - Properly export all required functions for snarkjs
   
4. **Documentation**:
   - Record all errors and solutions for future reference
   - Create a proper setup guide for new developers

## Token-Agnostic Compliance

This debugging approach maintains compliance with the token-agnostic wallet scanning plan rule #1 by:

1. Exposing and documenting real errors rather than hiding them
2. Not implementing placeholder functionality
3. Creating a path to proper implementation rather than shortcuts

## Next Steps

Once the Circom parser issues are resolved:

1. Complete the full circuit compilation
2. Generate proper WebAssembly files with all required functions
3. Test the ZK proof generation with real inputs
4. Document the full setup process for future developers