# Client-Side Security System

This document describes the client-side security system implemented as part of the Zero-Knowledge Proof infrastructure. This implementation corresponds to Week 3, Task 3 of the ZK Infrastructure Plan.

## Overview

The Client-Side Security System provides robust protection for sensitive operations in the browser environment, focusing on session management, key rotation, secure auditing, and tamper detection. It includes:

1. **SessionSecurityManager**: Comprehensive session-based security manager
2. **SecurityAuditLogger**: Tamper-evident security event logging system
3. **TamperDetection**: Cryptographic integrity protection and tamper detection

## Key Components

### Session Security Manager

The `SessionSecurityManager` provides comprehensive session-based security, including:

- **Secure Session Management**
  - Session-based key storage with `sessionStorage`
  - Automatic session expiration with configurable lifetimes
  - Activity tracking with idle session termination
  - Browser tab/window closure detection

- **Key Management**
  - Scheduled key rotation based on time intervals
  - Forced key rotation after sensitive operations
  - Secure destruction with verification
  - Complete key lifecycle management

- **Session Protection**
  - Integrity verification for session data
  - Tamper detection with immediate action
  - Protection against cross-tab interference
  - Defense against visibility state attacks

### Security Audit Logger

The `SecurityAuditLogger` provides tamper-evident security event logging:

- **Tamper-Evident Logging**
  - Chained hash structure for log integrity
  - Cryptographic signatures for log entries
  - Detection of log manipulation
  - Secure log storage and retrieval

- **Comprehensive Event Logging**
  - Detailed categorization of events (info, warning, error, security)
  - Rich context for security events
  - Timestamps and sequence validation
  - Exportable logs with integrity verification

- **Anomaly Detection**
  - Event frequency analysis
  - Suspicious sequence detection
  - Time pattern analysis
  - Contextual anomaly identification

### Tamper Detection

`TamperDetection` provides cryptographic integrity protection:

- **Data Integrity Protection**
  - HMAC-based integrity verification for stored data
  - Cryptographic signatures using the Web Crypto API
  - Canary values for breach detection
  - Multiple layers of integrity checking

- **Protection Against Various Attacks**
  - Defense against replay attacks
  - Prevention of timing attacks with constant-time comparisons
  - Protection against cross-tab/window manipulation
  - Detection of storage injection attacks

## Usage Examples

### Session Management

```javascript
import { security } from '../lib/zk';
const { sessionManager } = security;

// Initialize a secure session
await sessionManager.initializeSession({
  userId: 'user123', // Optional identifier for logging
  persistSessionInfo: true // Whether to persist minimal session info
});

// Check if a session is active
if (sessionManager.isSessionActive()) {
  // Get session information
  const info = sessionManager.getSessionInfo();
  console.log(`Session expires in ${info.remainingTime / 1000} seconds`);
  
  // Extend the session if needed
  sessionManager.extendSession();
}

// Store sensitive data securely in the session
const result = await sessionManager.storeData(walletData, {
  type: 'wallet', // 'wallet' or 'input'
  metadata: { /* additional metadata */ }
});

// Get the key ID for later retrieval
const { keyId } = result;

// Retrieve the data later
const { data: retrievedWallet, newKeyId } = await sessionManager.retrieveData(keyId, {
  isSensitiveOperation: true // Will trigger key rotation if enabled
});

// When done, terminate the session
await sessionManager.terminateSession('completed');
```

### Security Audit Logging

```javascript
import { security } from '../lib/zk';
import SecurityAuditLogger from '../lib/zk/SecurityAuditLogger';

// Create a logger with custom settings
const logger = new SecurityAuditLogger({
  logLevel: 'standard', // minimal, standard, verbose
  persistToStorage: true,
  enableAnomalyDetection: true
});

// Log different types of events
await logger.log('User operation completed', { userId: 'user123' });
await logger.logWarning('Rate limit approaching', { currentRate: 95 });
await logger.logError('Operation failed', { error: 'Connection timeout' });
await logger.logSecurity('Authentication failure', { 
  userId: 'user123', 
  attemptCount: 3,
  severity: 'medium'
});

// Get filtered logs
const securityEvents = logger.getLogs({ 
  level: 'security',
  since: '2023-01-01T00:00:00Z',
  limit: 100
});

// Verify log integrity
const isIntact = await logger.verifyLogIntegrity();
if (!isIntact) {
  console.error('Log tampering detected!');
}

// Export logs for analysis
const exportedLogs = logger.exportLogs();
```

### Tamper Detection

```javascript
import { security } from '../lib/zk';
import TamperDetection from '../lib/zk/TamperDetection';

// Create tamper detection with custom settings
const tamperDetection = new TamperDetection({
  enabled: true,
  canaryCount: 3
});

// Protect data with integrity checks
const sensitiveData = { userId: 'user123', balance: '1000.00' };
const secretKey = 'very-secure-key';
const protectedData = await tamperDetection.protect(sensitiveData, secretKey);

// Store the protected data
localStorage.setItem('protected-data', JSON.stringify(protectedData));

// Later, retrieve and verify
const retrievedData = JSON.parse(localStorage.getItem('protected-data'));
const isValid = await tamperDetection.verify(retrievedData, secretKey);

if (!isValid) {
  console.error('Data tampering detected!');
}

// For remote data transmission
const signedData = await tamperDetection.signForRemote(userData, secretKey);
// ...send to server...

// On server (or another client)
const isValidSignature = await tamperDetection.verifyRemoteSignature(
  receivedData, 
  secretKey
);
```

## Security Considerations

1. **Browser Storage Limitations**
   - Session storage is cleared when the browser tab is closed
   - Storage quotas may limit the amount of data that can be stored
   - Private browsing modes may have additional restrictions

2. **Key Management**
   - All cryptographic keys are stored in memory only
   - Session passwords are never exposed outside secure modules
   - Key rotation helps mitigate risks of key compromise

3. **Defense in Depth**
   - Multiple layers of protection work together
   - Integrity checking, tamper detection, and audit logging form a comprehensive security system
   - Even if one security mechanism fails, others provide backup protection

4. **Client-Side Security Limitations**
   - Browser environments are inherently less secure than server environments
   - Advanced threats like malicious browser extensions or compromised devices can defeat client-side protections
   - This system provides "best effort" protection in the browser context

## Integration with Existing Components

This client-side security system integrates smoothly with:

1. **Temporary Wallet Architecture** (Week 3, Task 1)
   - Provides secure session context for temporary wallets
   - Enhances security with automatic key rotation
   - Adds audit logging for wallet operations

2. **Secure Key Storage** (Week 3, Task 2)
   - Builds on the secure key storage mechanisms
   - Adds session-based management with auto-destruction
   - Enhances security with integrity verification

3. **ZK Proof Generation**
   - Provides secure context for proof generation
   - Protects sensitive inputs and intermediates
   - Ensures cleanup after proof generation

## Testing

The implementation includes comprehensive test coverage:

- `SessionSecurityManager.test.js`: Tests for session management, key rotation, and security features
- `SecurityAuditLogger.test.js`: Tests for security logging, anomaly detection, and log integrity
- `TamperDetection.test.js`: Tests for data integrity protection and tampering detection

You can also test the client-side security features interactively using the included HTML test page:
`test-client-side-security.html`