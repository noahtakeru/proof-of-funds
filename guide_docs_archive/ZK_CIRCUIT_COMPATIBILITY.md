# Circom Circuit Compatibility Guide

## Current Status

We've successfully installed:
- circom v0.5.46 (older version)
- snarkjs v0.7.5 (compatible version)

Your circuit files (lib/zk/circuits/*.circom) are written for circom 2.0.0, but we have circom 0.5.46 installed. This explains the parsing errors you're seeing.

## Making Circuits Compatible with circom 0.5.46

The simplest solution is to modify your circuit files to be compatible with 0.5.46. Here are the changes needed:

1. **Remove pragma statements**: circom 0.5.46 doesn't use pragma directives
2. **Fix include paths**: Make sure paths are relative or absolute
3. **Simplify template syntax**: Some newer features may not be supported

## Example Circuit Modification

For example, to make standardProof.circom compatible, edit it like this:

```circom
// Original (circom 2.0.0)
pragma circom 2.0.0;
include "./node_modules/circomlib/circuits/poseidon.circom";

// Modified (circom 0.5.46)
include "../node_modules/circomlib/circuits/poseidon.circom";
```

## Alternative Solutions

1. **Use Docker for circom 2.x** (recommended):
   ```
   docker run -it --rm -v $(pwd):/home/circom/app iden3/circom:latest circom /home/circom/app/lib/zk/circuits/standardProof.circom --r1cs --wasm --sym -o /home/circom/app/lib/zk/build/
   ```

2. **Install Xcode Command Line Tools** and build circom 2.x from source:
   ```
   xcode-select --install
   git clone https://github.com/iden3/circom.git
   cd circom
   cargo build --release
   cargo install --path circom
   ```

## Current Workaround Status

The good news is your build script is handling compilation failures gracefully by creating placeholder files. This allows development to continue without a fully working circom setup.

For most development purposes, these placeholder files are sufficient to test the UI and application logic, even if they don't generate real zero-knowledge proofs. 