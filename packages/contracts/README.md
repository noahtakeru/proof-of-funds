# Proof of Funds - Contracts Package

This package contains the smart contracts used in the Proof of Funds platform.

> **Note**: Phase 3 of the dependency resolution plan has migrated the contract interfaces to this package and resolved previous Hardhat dependency issues.

## Contracts

- `ProofOfFunds.sol` - Main contract for standard proof verification
- `ZKVerifier.sol` - Contract for zero-knowledge proof verification
- `ProofOfFundsSimple.sol` - Simplified contract for basic verification

## Development

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to local hardhat network
npm run deploy:local

# Deploy to Polygon Amoy testnet
npm run deploy:amoy
```

## Contract Addresses

### Polygon Amoy Testnet
- ProofOfFunds: [Contract Address]
- ZKVerifier: [Contract Address]

## Documentation

For more details on the contract functionality, see the NatSpec comments in the contract source code.