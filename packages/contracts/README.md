# Proof of Funds Smart Contracts

This directory contains the smart contracts and deployment scripts for the Proof of Funds protocol.

## Migration Notice

This package has been migrated from the original `/smart-contracts` directory as part of the dependency resolution plan. The migration involved:

1. Moving all contract source files to `/packages/contracts/contracts/`
2. Moving all scripts to `/packages/contracts/scripts/`
3. Moving all test files to `/packages/contracts/test/`
4. Creating proper workspace package configuration
5. Setting up proper dependency management with `@proof-of-funds/common`

References to this package should now use `@proof-of-funds/contracts` instead of directly referencing the smart-contracts directory.

## Contracts

- `ProofOfFundsSimple.sol`: A simplified version of the Proof of Funds contract for testing deployment.
- `ProofOfFunds.sol`: The main contract that provides proof of funds verification with privacy features.
- `ZKVerifier.sol`: A contract for zero-knowledge proof verification.

## Development Setup

### Prerequisites

- Node.js 16+ and npm
- Access to a cryptocurrency wallet with testnet funds (for deployment)

### Installation

1. Install dependencies
   ```bash
   npm install
   ```

2. Copy the environment file and add your private key and API keys
   ```bash
   cp ../.env.example .env
   ```

### Compilation

Compile the contracts with:

```bash
npm run compile
```

### Testing

Run the tests with:

```bash
npm run test
```

### Deployment

Deploy to a local Hardhat node:

```bash
npm run deploy:local
```

Deploy to Polygon Amoy testnet:

```bash
npm run deploy:amoy
```

### Verification

Verify the contract on Polygon Amoy testnet:

```bash
npm run verify:amoy
```

## Contract Details

### ProofOfFunds.sol

A contract that allows users to submit proofs of funds without revealing their actual balances. It supports three types of proofs:

1. **Standard Proof**: Verify an exact amount of funds (equality)
2. **Threshold Proof**: Verify a minimum amount of funds (greater than or equal to)
3. **Maximum Proof**: Verify a maximum amount of funds (less than or equal to)

### ZKVerifier.sol

A contract for zero-knowledge proof verification that will be integrated with ProofOfFunds in the future to provide enhanced privacy features.

## Security Considerations

- The private key in the `.env` file should never be committed to version control
- Use a dedicated development/testing wallet for deployments
- Always verify contracts after deployment for transparency 