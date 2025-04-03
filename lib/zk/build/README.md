# ZK Circuit Build Directory

This directory contains the compiled output from the ZK circuits. These files are generated using the `build-circuits.js` script.

## Contents

- `wasm/` - WebAssembly files for witness generation
- `zkey/` - Proving keys for generating proofs
- `verification_key/` - Verification keys for verifying proofs
- Circuit information files
- Solidity verifier contracts

## Build Process

To build the circuits, run:

```
npm run zk:build-circuits
```

This will compile all circuits in the `circuits/` directory and generate the necessary files for proof generation and verification.