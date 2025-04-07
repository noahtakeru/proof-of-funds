# Secure Circuit Input System

This document describes the secure circuit input generation system implemented as part of the Zero-Knowledge Proof infrastructure. This implementation corresponds to Week 3, Task 2 of the ZK Infrastructure Plan.

## Overview

The Secure Circuit Input Generator provides robust cryptographic security for sensitive data used in zero-knowledge proof generation. It includes:

1. **SecureKeyManager**: Core cryptographic operations using Web Crypto API
2. **secureStorage**: Secure storage with encryption and lifecycle management
3. **zkSecureInputs**: Enhanced circuit input generator with security features

## Key Features

### Cryptographic Security
- Industry-standard AES-GCM encryption with PBKDF2 key derivation
- Proper IV/nonce management for each encryption operation
- Secure random number generation for all cryptographic operations
- Defense against timing attacks in cryptographic operations

### Secure Storage
- In-memory and session-based storage for sensitive data
- Time-limited data access with automatic expiration
- Automatic cleanup of expired or unused data
- Memory protection techniques for sensitive cryptographic material

### Enhanced Input Generation
- Multiple security levels (STANDARD, ENHANCED, MAXIMUM)
- Additional security metadata for stronger proof binding
- Public/private input separation with zero private key exposure
- Comprehensive validation of inputs before proof generation

## Usage Examples

### Generating Secure Circuit Inputs

```javascript
import { ZK_PROOF_TYPES } from '../../config/constants';
import { generateSecureInputs, SECURITY_LEVELS } from '../lib/zk';

// Basic usage
const result = await generateSecureInputs({
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  amount: '1000000000000000000', // 1 ETH in wei
  proofType: ZK_PROOF_TYPES.STANDARD,
  securityOptions: {
    level: SECURITY_LEVELS.ENHANCED,
    encryptInputs: true
  }
});

// The result contains:
// - inputId: ID for retrieving the encrypted inputs later
// - publicInputs: Public parameters for verification
// - sessionPassword: Auto-generated password for decryption (if not provided)

// Using with wallet data for maximum security
const walletResult = await generateSecureInputs({
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  amount: '1000000000000000000',
  proofType: ZK_PROOF_TYPES.THRESHOLD,
  walletData: yourWalletData, // Additional wallet data for stronger binding
  securityOptions: {
    level: SECURITY_LEVELS.MAXIMUM,
    encryptInputs: true
  },
  sessionPassword: 'your-secret-password' // Optional, will be generated if not provided
});
```

### Retrieving and Using Secure Inputs

```javascript
import { getSecureInputs, generateZKProof } from '../lib/zk';

// Retrieve encrypted inputs using ID and password
const circuitInputs = await getSecureInputs(inputId, sessionPassword);

// Use inputs for proof generation
const proof = await generateZKProof({
  inputs: circuitInputs,
  proofType: ZK_PROOF_TYPES.STANDARD
});

// Clean up after use (best practice for security)
await cleanupSecureInputs(inputId);
```

### Directly Using the Security Components

```javascript
import { security } from '../lib/zk';

// Key management
const { keyManager } = security;
const encryptedData = await keyManager.encrypt(sensitiveData, password);
const decryptedData = await keyManager.decrypt(encryptedData, password);

// Secure storage
const { storage } = security;
const walletId = await storage.storeWallet(walletData, password);
const wallet = await storage.getWallet(walletId, password);

// Generate secure password
const securePassword = keyManager.generateSecurePassword(32);
```

## Security Considerations

1. **Memory Management**
   - Sensitive data is only kept in memory for the minimum time required
   - Memory wiping is performed after sensitive operations
   - Key material uses non-extractable CryptoKey objects when possible

2. **Storage Security**
   - Private keys are never stored unencrypted
   - All stored data has automatic expiration
   - Browser tab/window closure triggers cleanup
   - Session storage is used instead of local storage for sensitive data

3. **Input Validation**
   - Comprehensive validation before usage in circuits
   - Strong type checking and boundary condition validation
   - Zero tolerance for invalid inputs that could compromise proof security

## Testing

The implementation includes comprehensive test coverage:

- `SecureKeyManager.test.js`: Tests encryption, decryption, and key handling
- `secureStorage.test.js`: Tests secure storage with lifecycle management
- `zkSecureInputs.test.js`: Tests the enhanced input generation system

Run tests with:

```bash
npm test -- --grep "SecureKeyManager"
npm test -- --grep "secureStorage"
npm test -- --grep "zkSecureInputs"
```

## Integration with Existing Infrastructure

This secure input system fully integrates with the existing ZK infrastructure:

1. It extends the basic input generation capabilities with enhanced security
2. Maintains backward compatibility with existing proof generation functions
3. Adds additional security features for more sensitive operations
4. Follows established patterns for seamless integration