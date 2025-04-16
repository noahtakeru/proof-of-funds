# Zero-Knowledge Proof System API Reference

## Overview

This document provides comprehensive documentation for the Zero-Knowledge infrastructure API. The ZK system allows applications to create, manage, and verify zero-knowledge proofs while ensuring privacy, security, and compliance.

## Table of Contents

1. [Core Components](#core-components)
2. [Proof Generation](#proof-generation)
3. [Proof Verification](#proof-verification)
4. [Key Management](#key-management)
5. [Resource Management](#resource-management)
6. [Security Features](#security-features)
7. [Advanced Features](#advanced-features)
8. [Platform Integration](#platform-integration)
9. [Utility Functions](#utility-functions)

## Core Components

### zkUtils

The central module providing core zero-knowledge functionality.

```typescript
// Import for ES modules
import zkUtils from '../zkUtils.mjs';

// Import for CommonJS
const zkUtils = require('../zkUtils.js');
```

#### Methods

##### `generateZKProof(input, options)`

Generates a zero-knowledge proof based on the provided input and options.

**Parameters:**
- `input` (Object): Input data for proof generation
  - `walletAddress` (String): The wallet address to create proof for
  - `amount` (Number): The amount to prove
  - `timestamp` (Number, optional): Timestamp for the proof, defaults to current time
  - `metadata` (Object, optional): Additional metadata to include in the proof
- `options` (Object, optional): Configuration options
  - `circuit` (String, optional): Circuit type to use ('standard', 'threshold', 'maximum')
  - `clientMode` (Boolean, optional): Whether to force client-side execution
  - `callback` (Function, optional): Progress callback function
  - `timeout` (Number, optional): Maximum time (ms) to wait for proof generation
  - `compression` (Boolean, optional): Whether to compress the proof

**Returns:** Promise<Object>
- `proof` (String): The generated proof in encoded format
- `publicSignals` (Array): Public signals associated with the proof
- `metadata` (Object): Metadata about the proof generation
- `verificationKey` (Object): The verification key needed to verify this proof

**Example:**
```javascript
const result = await zkUtils.generateZKProof({
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  amount: 1000,
  metadata: { purpose: 'verification' }
}, {
  circuit: 'standard',
  clientMode: true
});

console.log(`Proof generated: ${result.proof.substring(0, 20)}...`);
```

##### `verifyZKProof(proof, publicSignals, options)`

Verifies a zero-knowledge proof against its public signals.

**Parameters:**
- `proof` (String): The proof to verify
- `publicSignals` (Array): Public signals associated with the proof
- `options` (Object, optional): Configuration options
  - `verificationKey` (Object, optional): Verification key to use
  - `onChain` (Boolean, optional): Whether to verify on-chain
  - `cacheResults` (Boolean, optional): Whether to cache verification results
  - `timeout` (Number, optional): Maximum time (ms) to wait for verification

**Returns:** Promise<Object>
- `valid` (Boolean): Whether the proof is valid
- `metadata` (Object): Metadata about the verification
- `executionDetails` (Object): Details about the verification execution

**Example:**
```javascript
const isValid = await zkUtils.verifyZKProof(
  proofData.proof,
  proofData.publicSignals,
  { cacheResults: true }
);

if (isValid.valid) {
  console.log('Proof verified successfully');
} else {
  console.error('Proof verification failed');
}
```

##### `getZKCircuits()`

Returns information about available circuits.

**Returns:** Array<Object>
- Array of circuit objects with the following properties:
  - `id` (String): Circuit identifier
  - `name` (String): Human-readable name
  - `description` (String): Description of the circuit
  - `version` (String): Circuit version
  - `capabilities` (Array): Features/capabilities of the circuit

**Example:**
```javascript
const circuits = zkUtils.getZKCircuits();
circuits.forEach(circuit => {
  console.log(`Circuit: ${circuit.name} (v${circuit.version})`);
});
```

## Proof Generation

### ProofGenerator

Specialized module for generating proofs with advanced options.

```typescript
import { ProofGenerator } from '../ProofGenerator.js';
```

#### Methods

##### `createProof(circuit, inputs, options)`

Creates a proof using the specified circuit and inputs.

**Parameters:**
- `circuit` (String): Circuit identifier
- `inputs` (Object): Circuit-specific inputs
- `options` (Object, optional): Additional options
  - `optimizationLevel` (Number, optional): Optimization level (1-3)
  - `memoryLimit` (Number, optional): Memory limit in MB
  - `timeout` (Number, optional): Timeout in milliseconds

**Returns:** Promise<Object>
- `proof` (String): The generated proof
- `publicSignals` (Array): Public signals for verification
- `metadata` (Object): Additional metadata

##### `batchProofGeneration(requests, options)`

Generates multiple proofs in a batch for efficiency.

**Parameters:**
- `requests` (Array): Array of proof requests
- `options` (Object, optional): Batch processing options
  - `maxConcurrent` (Number, optional): Maximum concurrent operations
  - `prioritizeBy` (String, optional): Prioritization strategy ('fifo', 'size', 'custom')

**Returns:** Promise<Array<Object>>
- Array of proof results in the same order as requests

## Proof Verification

### VerificationPathways

Module providing multiple verification pathways for redundancy and flexibility.

```typescript
import { VerificationPathways } from '../VerificationPathways.js';
```

#### Methods

##### `verifyOnchain(proof, publicSignals, contract, options)`

Verifies a proof using on-chain verification.

**Parameters:**
- `proof` (String): The proof to verify
- `publicSignals` (Array): Public signals for the proof
- `contract` (Object): Contract instance to use for verification
- `options` (Object, optional): Verification options
  - `gasLimit` (Number, optional): Gas limit for verification
  - `maxRetries` (Number, optional): Maximum number of retry attempts

**Returns:** Promise<Object>
- `valid` (Boolean): Whether the proof is valid
- `txHash` (String): Transaction hash of the verification
- `details` (Object): Detailed verification results

##### `verifyOffchain(proof, publicSignals, verificationKey, options)`

Verifies a proof off-chain using client-side libraries.

**Parameters:**
- `proof` (String): The proof to verify
- `publicSignals` (Array): Public signals for the proof
- `verificationKey` (Object): Verification key
- `options` (Object, optional): Verification options

**Returns:** Promise<Object>
- `valid` (Boolean): Whether the proof is valid
- `details` (Object): Detailed verification results

### VerificationCache

Caches verification results to avoid redundant verification.

```typescript
import { VerificationCache } from '../VerificationCache.js';
```

#### Methods

##### `cacheVerificationResult(proofHash, result, options)`

Caches a verification result for future reference.

**Parameters:**
- `proofHash` (String): Hash of the proof as identifier
- `result` (Object): Verification result
- `options` (Object, optional): Caching options
  - `ttl` (Number, optional): Time-to-live in seconds

**Returns:** Boolean
- Whether the result was successfully cached

##### `getVerificationResult(proofHash)`

Retrieves a cached verification result if available.

**Parameters:**
- `proofHash` (String): Hash of the proof to look up

**Returns:** Object|null
- Cached verification result or null if not found

## Key Management

### SecureKeyManager

Manages cryptographic keys securely.

```typescript
import { SecureKeyManager } from '../SecureKeyManager.js';
```

#### Methods

##### `generateKey(type, options)`

Generates a new cryptographic key.

**Parameters:**
- `type` (String): Key type ('signing', 'encryption', 'hmac')
- `options` (Object, optional): Key generation options
  - `strength` (Number, optional): Key strength in bits
  - `algorithm` (String, optional): Specific algorithm to use

**Returns:** Promise<Object>
- `id` (String): Unique identifier for the key
- `publicKey` (String): Public component of the key (if applicable)
- `metadata` (Object): Key metadata

##### `storeKey(key, options)`

Securely stores a key.

**Parameters:**
- `key` (Object): Key to store
- `options` (Object, optional): Storage options
  - `protected` (Boolean, optional): Whether to apply additional protection
  - `metadata` (Object, optional): Additional metadata

**Returns:** Promise<String>
- Key identifier

##### `retrieveKey(keyId, options)`

Retrieves a stored key.

**Parameters:**
- `keyId` (String): Key identifier
- `options` (Object, optional): Retrieval options
  - `format` (String, optional): Output format ('pem', 'jwk', 'raw')

**Returns:** Promise<Object>
- The retrieved key

## Resource Management

### ResourceMonitor

Monitors and manages system resources during ZK operations.

```typescript
import { ResourceMonitor } from '../ResourceMonitor.js';
```

#### Methods

##### `initialize(resources, options)`

Initializes resource monitoring.

**Parameters:**
- `resources` (Array<String>): Resources to monitor ('cpu', 'memory', 'storage', 'network')
- `options` (Object, optional): Monitoring options
  - `samplingInterval` (Number, optional): Sampling interval in milliseconds
  - `thresholds` (Object, optional): Resource usage thresholds

**Returns:** Promise<Boolean>
- Whether initialization was successful

##### `startMonitoring(operationId)`

Starts monitoring resources for a specific operation.

**Parameters:**
- `operationId` (String): Identifier for the operation being monitored

**Returns:** Promise<Object>
- Monitoring session details

##### `getResourceUsage(resource, options)`

Gets current or historical resource usage.

**Parameters:**
- `resource` (String): Resource to query ('cpu', 'memory', 'storage', 'network')
- `options` (Object, optional): Query options
  - `timeframe` (String, optional): Timeframe to query ('current', 'last5min', 'last1hour')
  - `format` (String, optional): Output format ('raw', 'percentage', 'formatted')

**Returns:** Promise<Object>
- Resource usage data

### ResourceAllocator

Intelligently allocates resources based on operation requirements and availability.

```typescript
import { ResourceAllocator } from '../ResourceAllocator.js';
```

#### Methods

##### `allocateResources(operation, requirements, options)`

Allocates resources for a ZK operation.

**Parameters:**
- `operation` (String): Operation identifier
- `requirements` (Object): Resource requirements
  - `cpu` (Number, optional): CPU allocation (0-100%)
  - `memory` (Number, optional): Memory allocation in MB
  - `priority` (Number, optional): Operation priority (1-10)
- `options` (Object, optional): Allocation options
  - `strategy` (String, optional): Allocation strategy ('conservative', 'balanced', 'aggressive')
  - `timeout` (Number, optional): Allocation timeout in milliseconds

**Returns:** Promise<Object>
- Allocation result with resource handles

##### `releaseResources(allocationId)`

Releases previously allocated resources.

**Parameters:**
- `allocationId` (String): Allocation identifier to release

**Returns:** Promise<Boolean>
- Whether resources were successfully released

### AdaptiveComputation

Adapts computational strategy based on available resources.

```typescript
import { AdaptiveComputation } from '../AdaptiveComputation.js';
```

#### Methods

##### `selectStrategy(operation, context)`

Selects the optimal computation strategy for an operation.

**Parameters:**
- `operation` (String): Operation identifier
- `context` (Object): Execution context
  - `deviceCapabilities` (Object): Device capability information
  - `networkCondition` (String): Network condition status
  - `userPreferences` (Object): User preferences for execution

**Returns:** Object
- The selected computation strategy

##### `executeWithStrategy(operation, inputs, strategy)`

Executes an operation using the specified strategy.

**Parameters:**
- `operation` (String): Operation to execute
- `inputs` (Object): Operation inputs
- `strategy` (Object): Computation strategy to use

**Returns:** Promise<Object>
- Operation result

## Security Features

### TamperDetection

Provides tamper detection for cryptographic materials.

```typescript
import { TamperDetection } from '../TamperDetection.js';
```

#### Methods

##### `generateTamperProof(data, options)`

Generates tamper-proofing materials for data.

**Parameters:**
- `data` (Buffer|Object): Data to tamper-proof
- `options` (Object, optional): Tamper-proofing options
  - `algorithm` (String, optional): Hashing algorithm to use
  - `includeTiming` (Boolean, optional): Whether to include timing information

**Returns:** Object
- Tamper-proofing materials

##### `verifyIntegrity(data, tamperProof)`

Verifies the integrity of data against tamper-proofing materials.

**Parameters:**
- `data` (Buffer|Object): Data to verify
- `tamperProof` (Object): Tamper-proofing materials

**Returns:** Object
- Verification result

### SecurityAuditLogger

Logs security-relevant events for audit purposes.

```typescript
import { SecurityAuditLogger } from '../SecurityAuditLogger.js';
```

#### Methods

##### `log(event, details, options)`

Logs a security event.

**Parameters:**
- `event` (String): Event name
- `details` (Object): Event details
- `options` (Object, optional): Logging options
  - `severity` (String, optional): Event severity ('info', 'warning', 'error', 'critical')
  - `includeStack` (Boolean, optional): Whether to include stack trace
  - `persistent` (Boolean, optional): Whether to store persistently

**Returns:** String
- Log entry ID

##### `getAuditLog(options)`

Retrieves audit log entries.

**Parameters:**
- `options` (Object, optional): Query options
  - `timeframe` (String, optional): Timeframe to query
  - `severity` (String|Array, optional): Severity level(s) to include
  - `limit` (Number, optional): Maximum entries to return
  - `offset` (Number, optional): Offset for pagination

**Returns:** Array<Object>
- Matching audit log entries

## Advanced Features

### CircuitOptimizer

Optimizes circuit execution for improved performance.

```typescript
import { CircuitOptimizer } from '../CircuitOptimizer.js';
```

#### Methods

##### `optimizeCircuit(circuit, options)`

Optimizes a circuit for better performance.

**Parameters:**
- `circuit` (Object): Circuit to optimize
- `options` (Object, optional): Optimization options
  - `level` (Number, optional): Optimization level (1-3)
  - `target` (String, optional): Optimization target ('size', 'speed', 'balanced')

**Returns:** Promise<Object>
- Optimized circuit

##### `analyzeCircuit(circuit)`

Analyzes a circuit for optimization opportunities.

**Parameters:**
- `circuit` (Object): Circuit to analyze

**Returns:** Promise<Object>
- Analysis results with optimization suggestions

### ProofCompressor

Provides compression for proofs to reduce size.

```typescript
import { ProofCompressor } from '../ProofCompressor.js';
```

#### Methods

##### `compress(proof, options)`

Compresses a proof to reduce its size.

**Parameters:**
- `proof` (String|Object): Proof to compress
- `options` (Object, optional): Compression options
  - `algorithm` (String, optional): Compression algorithm
  - `level` (Number, optional): Compression level (1-9)

**Returns:** Promise<Object>
- Compressed proof

##### `decompress(compressedProof)`

Decompresses a previously compressed proof.

**Parameters:**
- `compressedProof` (String|Object): Compressed proof

**Returns:** Promise<Object>
- Original proof

## Platform Integration

### PlatformAdapterFactory

Creates platform-specific adapters for different environments.

```typescript
import { PlatformAdapterFactory } from '../PlatformAdapterFactory.js';
```

#### Methods

##### `createAdapter(platform, options)`

Creates a platform-specific adapter.

**Parameters:**
- `platform` (String): Target platform ('browser', 'node', 'react-native')
- `options` (Object, optional): Adapter options
  - `capabilities` (Object, optional): Capability overrides
  - `features` (Array, optional): Features to include

**Returns:** Object
- Platform-specific adapter

##### `detectPlatform()`

Detects the current platform.

**Returns:** String
- Detected platform identifier

### CrossPlatformDeployment

Manages deployment across different platforms.

```typescript
import { CrossPlatformDeployment } from '../CrossPlatformDeployment.js';
```

#### Methods

##### `deployToEnvironment(artifact, environment, options)`

Deploys an artifact to a specific environment.

**Parameters:**
- `artifact` (Object): Artifact to deploy
- `environment` (String): Target environment
- `options` (Object, optional): Deployment options

**Returns:** Promise<Object>
- Deployment result

##### `validateEnvironment(environment, requirements)`

Validates that an environment meets requirements.

**Parameters:**
- `environment` (String): Environment to validate
- `requirements` (Object): Required capabilities

**Returns:** Promise<Object>
- Validation results

## Utility Functions

### zkErrorLogger

Handles logging and error management for the ZK system.

```typescript
import zkErrorLogger from '../zkErrorLogger.mjs';
```

#### Methods

##### `log(level, message, options)`

Logs a message with the specified level.

**Parameters:**
- `level` (String): Log level ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')
- `message` (String): Log message
- `options` (Object, optional): Logging options
  - `category` (String, optional): Log category
  - `userFixable` (Boolean, optional): Whether the issue is user-fixable
  - `recoverable` (Boolean, optional): Whether the system can recover from the issue
  - `details` (Object, optional): Additional details

**Returns:** void

**Example:**
```javascript
zkErrorLogger.log('WARNING', 'Resource allocation approaching limits', {
  category: 'performance',
  userFixable: true,
  recoverable: true,
  details: { 
    memoryUsage: '85%',
    recommendation: 'Consider closing other applications'
  }
});
```

### ParameterValidator

Validates parameters for ZK operations.

```typescript
import { ParameterValidator } from '../ParameterValidator.js';
```

#### Methods

##### `validate(parameters, schema, options)`

Validates parameters against a schema.

**Parameters:**
- `parameters` (Object): Parameters to validate
- `schema` (Object): Validation schema
- `options` (Object, optional): Validation options
  - `strict` (Boolean, optional): Whether to enforce strict validation
  - `allowUnknown` (Boolean, optional): Whether to allow unknown fields

**Returns:** Object
- Validation result

**Example:**
```javascript
const isValid = ParameterValidator.validate(
  { amount: 1000, walletAddress: '0x123...' },
  { 
    amount: { type: 'number', required: true, min: 1 },
    walletAddress: { type: 'string', required: true, pattern: /^0x[a-fA-F0-9]{40}$/ }
  }
);

if (isValid.valid) {
  // Parameters are valid
} else {
  console.error('Validation failed:', isValid.errors);
}
```

## Type Definitions

### Common Types

```typescript
// Proof data structure
interface ZKProof {
  proof: string;
  publicSignals: string[];
  metadata: {
    circuit: string;
    timestamp: number;
    version: string;
    parameters?: Record<string, any>;
  };
}

// Verification result
interface VerificationResult {
  valid: boolean;
  executionDetails: {
    executionTime: number;
    executionPath: string;
    executionLocation: 'client' | 'server' | 'blockchain';
  };
  metadata?: Record<string, any>;
}

// Resource allocation request
interface ResourceRequest {
  cpu?: number;
  memory?: number;
  priority?: number;
  operation: string;
  estimatedDuration?: number;
}
```

## Error Handling

All API methods follow consistent error handling practices:

1. Return `Promise` objects that reject with appropriate error information
2. Error objects include:
   - `code`: Specific error code for programmatic handling
   - `message`: Human-readable error message
   - `details`: Additional error details where applicable
   - `recoverable`: Boolean indicating if the operation can be retried
   - `userFixable`: Boolean indicating if user action can resolve the issue

Example error handling:

```javascript
try {
  const proof = await zkUtils.generateZKProof({
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    amount: 1000
  });
  // Success case handling
} catch (error) {
  if (error.code === 'RESOURCE_EXHAUSTED' && error.userFixable) {
    console.warn('Resource limits reached. Try closing other applications or use server mode.');
  } else if (error.recoverable) {
    console.warn('Temporary issue detected. Retrying...');
    // Implement retry logic
  } else {
    console.error('Critical error:', error.message, error.details);
  }
}
```

## Best Practices

1. **Resource Management**: Always release resources when done with operations
2. **Error Handling**: Implement appropriate error handling for all API calls
3. **Platform Detection**: Use platform detection APIs to ensure compatibility
4. **Verification**: Use multiple verification pathways for critical applications
5. **Security**: Follow security best practices when handling sensitive data
6. **Caching**: Leverage verification caching for repeated verifications
7. **Types**: Use TypeScript type definitions for improved developer experience

## Browser Compatibility

The ZK infrastructure is compatible with:

- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

For older browsers, server-side fallbacks are automatically engaged. 