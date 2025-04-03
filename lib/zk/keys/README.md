# ZK Proof Keys Directory

This directory contains the trusted setup keys and verification keys for the ZK proof system. These files are used by the ZK infrastructure to generate and verify zero-knowledge proofs.

## Contents

- `phase1_final.ptau` - Powers of Tau file for the Phase 1 ceremony
- Verification keys (.json) for each circuit
- Proving keys (.zkey) for each circuit

## Auto-Download

The `build-circuits.js` script will automatically download the Phase 1 Powers of Tau file if it's not present.

## Security Note

In a production environment, trusted setup ceremonies should be conducted with multiple participants to ensure security. The automatically downloaded trusted setup is provided for development purposes only.