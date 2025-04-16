# Zero-Knowledge Proof System: User Guide

## Introduction

Welcome to the Zero-Knowledge Proof System user guide. This document will walk you through the process of creating, verifying, and managing zero-knowledge proofs to prove ownership of funds without revealing sensitive information.

## Table of Contents

1. [What Are Zero-Knowledge Proofs?](#what-are-zero-knowledge-proofs)
2. [Getting Started](#getting-started)
3. [Common Use Cases](#common-use-cases)
4. [Step-by-Step Guides](#step-by-step-guides)
5. [Troubleshooting](#troubleshooting)
6. [Frequently Asked Questions](#frequently-asked-questions)
7. [Best Practices](#best-practices)
8. [Security Considerations](#security-considerations)

## What Are Zero-Knowledge Proofs?

Zero-Knowledge Proofs (ZKPs) are cryptographic methods that allow one party (the prover) to prove to another party (the verifier) that a statement is true without revealing any additional information beyond the validity of the statement itself.

For example, using our system, you can prove you have at least $10,000 in your wallet without revealing:
- The exact amount in your wallet
- The source of your funds
- Your transaction history
- Other assets you may own

This technology enables privacy-preserving verification for a wide range of applications.

## Getting Started

### System Requirements

The Zero-Knowledge Proof System works across multiple platforms with the following requirements:

**Web Browsers:**
- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

**Mobile:**
- iOS 13+ (via WebView or Safari)
- Android 8+ (via WebView or Chrome)

**Desktop:**
- Node.js 14+ (for desktop applications)
- Electron 12+ (for desktop GUI applications)

For optimal performance, we recommend:
- At least 4GB of RAM
- Modern multi-core processor
- Stable internet connection

### Installation

#### Web Integration

Add the ZK library to your web application:

```html
<!-- Add the ZK library to your HTML -->
<script src="https://cdn.example.com/zk-system/v1.3.2/zk-bundle.min.js"></script>

<!-- Or use ES modules -->
<script type="module">
  import { zkUtils } from 'https://cdn.example.com/zk-system/v1.3.2/zk-module.mjs';
</script>
```

#### NPM Installation

For Node.js applications:

```bash
# Install the ZK library
npm install @proof-of-funds/zk-system

# Or using yarn
yarn add @proof-of-funds/zk-system
```

Then import it in your application:

```javascript
// ES Modules
import { zkUtils } from '@proof-of-funds/zk-system';

// CommonJS
const { zkUtils } = require('@proof-of-funds/zk-system');
```

## Common Use Cases

The Zero-Knowledge Proof System can be used for a variety of applications:

### 1. Proof of Funds

Prove you have a minimum balance without revealing the exact amount.

```javascript
// Generate a proof of minimum balance
const proofResult = await zkUtils.generateZKProof({
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  amount: 10000, // Minimum amount to prove
  metadata: { purpose: 'loan-application' }
});
```

### 2. Proof of Ownership

Prove you own a wallet without revealing its contents.

```javascript
// Generate a proof of ownership
const proofResult = await zkUtils.generateZKProof({
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  ownershipOnly: true
});
```

### 3. Threshold Verification

Prove your balance is within a certain range.

```javascript
// Generate a proof that balance is between 10,000 and 50,000
const proofResult = await zkUtils.generateZKProof({
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  minAmount: 10000,
  maxAmount: 50000
}, {
  circuit: 'threshold'
});
```

### 4. Reputation Verification

Prove your account meets certain criteria without revealing specific details.

```javascript
// Generate a proof that account meets criteria
const proofResult = await zkUtils.generateZKProof({
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  criteria: {
    accountAge: { min: 90 }, // Account is at least 90 days old
    transactionCount: { min: 5 }, // At least 5 transactions
    successfulTransactions: { ratio: 0.95 } // 95% successful transactions
  }
}, {
  circuit: 'reputation'
});
```

## Step-by-Step Guides

### Creating Your First Proof of Funds

Follow these steps to create a proof of funds:

1. **Connect your wallet**

   Before generating a proof, you need to connect your wallet:

   ```javascript
   // Connect wallet (using a wallet provider like MetaMask or WalletConnect)
   const walletProvider = await zkUtils.connectWallet({
     providers: ['metamask', 'walletconnect']
   });

   // Get the connected wallet address
   const walletAddress = walletProvider.getAddress();
   ```

2. **Set up proof parameters**

   Define what you want to prove:

   ```javascript
   // Define proof parameters
   const proofParams = {
     walletAddress: walletAddress,
     amount: 5000, // Prove you have at least 5000 units of currency
     timestamp: Date.now(), // Current time
     metadata: {
       purpose: 'housing-application',
       applicant: 'anonymous-user-123'
     }
   };
   ```

3. **Generate the proof**

   Create the zero-knowledge proof:

   ```javascript
   // Show progress to the user
   const progressCallback = (progress) => {
     console.log(`Proof generation: ${progress.percent}% complete`);
     // Update UI with progress.percent
   };

   // Generate the proof
   try {
     const proofResult = await zkUtils.generateZKProof(proofParams, {
       circuit: 'standard',
       callback: progressCallback,
       timeout: 60000 // 60 second timeout
     });

     console.log('Proof generated successfully!');
     console.log('Proof ID:', proofResult.metadata.proofId);
   } catch (error) {
     console.error('Proof generation failed:', error.message);
     // Handle error based on error.code
   }
   ```

4. **Save or share the proof**

   Once generated, you can save or share the proof:

   ```javascript
   // Save proof to local storage
   localStorage.setItem('lastProof', JSON.stringify(proofResult));

   // Or share proof with a service
   const shareResult = await zkUtils.shareProof(proofResult, {
     destination: 'api',
     endpoint: 'https://example.com/verify-proof'
   });
   ```

### Verifying a Proof

To verify a proof someone has shared with you:

1. **Receive the proof**

   ```javascript
   // Get proof from an API, file upload, or direct input
   const receivedProof = getProofFromSource();
   ```

2. **Verify the proof**

   ```javascript
   // Verify the proof
   try {
     const verificationResult = await zkUtils.verifyZKProof(
       receivedProof.proof,
       receivedProof.publicSignals,
       {
         cacheResults: true // Cache results to avoid redundant verifications
       }
     );

     if (verificationResult.valid) {
       console.log('Proof is valid!');
       console.log('Verified statement:', verificationResult.metadata.statement);
     } else {
       console.error('Proof verification failed');
     }
   } catch (error) {
     console.error('Verification error:', error.message);
   }
   ```

3. **Check proof details (optional)**

   ```javascript
   // Extract and check details from the proof
   const proofDetails = zkUtils.extractProofDetails(receivedProof);

   console.log('Proof was generated at:', new Date(proofDetails.timestamp));
   console.log('Minimum amount proven:', proofDetails.minAmount);
   console.log('Proof expires at:', new Date(proofDetails.expiresAt));
   ```

### Working with Smart Contracts

To verify proofs on-chain using smart contracts:

1. **Set up the contract connection**

   ```javascript
   // Connect to the verification contract
   const verificationContract = await zkUtils.connectContract({
     address: '0x7654321098765432109876543210987654321098',
     network: 'ethereum'
   });
   ```

2. **Submit a proof for on-chain verification**

   ```javascript
   // Verify on-chain
   try {
     const onChainResult = await zkUtils.verifyOnChain(
       proofResult.proof,
       proofResult.publicSignals,
       verificationContract
     );

     console.log('On-chain verification transaction:', onChainResult.txHash);
     console.log('Gas used:', onChainResult.gasUsed);
   } catch (error) {
     console.error('On-chain verification failed:', error.message);
   }
   ```

## Troubleshooting

### Common Issues and Solutions

#### Proof Generation Takes Too Long

**Issue**: Proof generation is taking an unusually long time to complete.

**Solutions**:
1. **Check your device resources**:
   - Close other resource-intensive applications
   - Ensure your device meets the minimum requirements
   
2. **Use server-side generation**:
   ```javascript
   const proofResult = await zkUtils.generateZKProof(proofParams, {
     serverMode: true // Force server-side execution
   });
   ```

3. **Check internet connection**:
   - Ensure you have a stable internet connection
   - Try a different network if possible

4. **Try a different browser**:
   - Some browsers perform better than others for cryptographic operations
   - Chrome and Firefox generally offer the best performance

#### Proof Verification Fails

**Issue**: A proof that should be valid is failing verification.

**Solutions**:
1. **Check proof expiration**:
   ```javascript
   // Check if proof has expired
   const isExpired = zkUtils.isProofExpired(receivedProof);
   if (isExpired) {
     console.log('This proof has expired and needs to be regenerated');
   }
   ```

2. **Verify against the correct network**:
   - Ensure you're verifying against the same network the proof was created for
   - Network mismatch can cause verification failures

3. **Check verification key**:
   - Make sure you're using the correct verification key
   - If verifying on-chain, check the contract has the latest verification key

4. **Try multiple verification paths**:
   ```javascript
   // Try both off-chain and on-chain verification
   const offChainResult = await zkUtils.verifyOffChain(proof, publicSignals);
   const onChainResult = await zkUtils.verifyOnChain(proof, publicSignals, contract);
   
   console.log('Off-chain verification:', offChainResult.valid);
   console.log('On-chain verification:', onChainResult.valid);
   ```

#### Wallet Connection Issues

**Issue**: Unable to connect to wallet.

**Solutions**:
1. **Check wallet extension**:
   - Ensure your wallet extension is installed and unlocked
   - Try refreshing the page

2. **Try alternative connection method**:
   ```javascript
   // Try an alternative connection method
   const walletProvider = await zkUtils.connectWallet({
     providers: ['walletconnect'], // Use WalletConnect instead
     timeout: 120000 // Longer timeout
   });
   ```

3. **Check browser compatibility**:
   - Ensure your browser supports the wallet extension
   - Try a different browser if issues persist

### Error Codes Reference

| Error Code | Description | Solution |
|------------|-------------|----------|
| `WALLET_CONNECTION_FAILED` | Failed to connect to wallet | Check wallet extension is installed and unlocked |
| `INSUFFICIENT_RESOURCES` | Not enough device resources | Close other applications or use server mode |
| `PROOF_GENERATION_TIMEOUT` | Proof generation took too long | Increase timeout or use server mode |
| `VERIFICATION_FAILED` | Proof verification failed | Check proof integrity and verification key |
| `NETWORK_ERROR` | Network request failed | Check internet connection and try again |
| `INVALID_PARAMETERS` | Invalid parameters provided | Check parameter format and values |
| `SECURITY_ERROR` | Security-related error occurred | Check browser security settings |

### Diagnostic Tools

Use these built-in diagnostic tools to troubleshoot issues:

```javascript
// Run system diagnostics
const diagnostics = await zkUtils.runDiagnostics({
  checkWallet: true,
  checkNetwork: true,
  checkResources: true
});

console.log('System diagnostics:', diagnostics);

// Check browser compatibility
const compatibility = zkUtils.checkBrowserCompatibility();
console.log('Browser compatibility:', compatibility);

// Test proof generation performance
const perfTest = await zkUtils.testPerformance({
  operation: 'proof-generation',
  duration: 5000 // 5 seconds test
});

console.log('Performance test results:', perfTest);
```

## Frequently Asked Questions

### How long does it take to generate a proof?

The time it takes to generate a proof depends on the complexity of the proof and the resources available on your device. For simple proofs, it may take a few seconds, while more complex proofs may take several minutes.

### Can I verify a proof without connecting to a wallet?

Yes, you can verify a proof without connecting to a wallet. However, to generate a proof, you need to connect to a wallet.

### What is the difference between on-chain and off-chain verification?

On-chain verification involves verifying the proof on the blockchain, while off-chain verification involves verifying the proof off the blockchain. On-chain verification is more secure but may require a higher gas fee.

## Best Practices

### Always verify proofs

Always verify proofs before accepting them. This ensures the proof is valid and has not been tampered with.

### Use strong passwords

Use strong passwords for your wallet and other sensitive information.

### Keep your wallet safe

Keep your wallet safe and do not share it with anyone.

## Security Considerations

### Protect your private keys

Protect your private keys and do not share them with anyone.

### Use secure networks

Use secure networks when interacting with the Zero-Knowledge Proof System.

### Keep your software up to date

Keep your software up to date to ensure you have the latest security features. 