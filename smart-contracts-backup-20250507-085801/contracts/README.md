# Proof of Funds Smart Contracts

This directory contains the smart contracts for the Arbitr Proof of Funds platform, enabling users to create verifiable proofs of cryptocurrency holdings.

## Contracts Overview

### ProofOfFunds.sol

A contract that allows users to submit proofs of funds without revealing their actual balances. It supports three types of proofs:

- **Standard Proof**: Verifies that a user has exactly the specified amount
- **Threshold Proof**: Verifies that a user has at least the specified amount
- **Maximum Proof**: Verifies that a user has at most the specified amount

The contract includes features like:
- Cryptographic proof generation and verification
- Time-bound proofs with expiration
- Revocation capabilities
- Signature verification
- Circuit breaker (pause/unpause) functionality
- Access control for admin functions

### ZKVerifier.sol

A complementary contract for zero-knowledge proofs that provides enhanced privacy. This contract:
- Stores and manages zero-knowledge proofs
- Enables verification without revealing actual amounts
- Supports the same proof types as ProofOfFunds

## Deployment Guide

### Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your:
   - Polygon API key (for contract verification)
   - RPC URLs
   - Private key (for deployment)

### Deployment Steps

1. **Local Testing**
   ```bash
   npx hardhat test
   ```

2. **Deploy to Polygon Amoy Testnet**
   ```bash
   npx hardhat run scripts/deploy-proof-of-funds.js --network amoy
   ```

3. **Update Constants File**
   After deployment, update the `CONTRACT_ADDRESS` value in `config/constants.js` with the deployed contract address.

### Contract Verification

Contract verification happens automatically during deployment, but you can manually verify with:

```bash
npx hardhat verify --network amoy <CONTRACT_ADDRESS>
```

## Interacting with the Contracts

### Creating a Proof

1. Generate a proof hash using the user's address, amount, and proof type
2. Submit the proof with an expiry time and signature
3. Store the returned proof ID for later verification

### Verifying a Proof

1. Call the appropriate verification function based on proof type:
   - `verifyStandardProof` for exact amount verification
   - `verifyThresholdProof` for minimum amount verification
   - `verifyMaximumProof` for maximum amount verification

2. The verification function will return `true` if the proof is valid and matches the claimed amount

## Security Considerations

- All proofs expire after their set expiry time
- Proofs can be revoked by their creators
- The contract can be paused in case of emergency
- The contract includes reentrancy protection for all state-changing functions
- Access control ensures only authorized users can perform restricted operations

## Deployment History

Deployment records are stored in the `deployments` directory, with details including:
- Network
- Contract address
- Deployment timestamp
- Deploying account

## Upgrading Contracts

While these contracts are not currently upgradeable, future versions could implement proxy patterns for upgradeability.

---

For additional questions or support, contact: support@arbitr.finance 