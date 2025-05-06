# Proof of Funds - Frontend Package

This package contains the frontend web application for the Proof of Funds platform.

## Features

- Wallet connection with MetaMask and other providers
- Fund verification through standard and zero-knowledge proofs
- Multi-chain asset scanning and display
- User-friendly proof management interface

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint
```

## Components

- **WalletSelector** - Connect to various wallet providers
- **WalletBalanceProof** - Display and manage proof data
- **ZKVerificationResult** - Display verification results
- **MultiChainAssetDisplay** - Show assets across multiple chains

## Pages

- **/** - Home page with platform introduction
- **/create** - Create new proofs of funds
- **/verify** - Verify existing proofs
- **/manage** - Manage your proofs