# Zero-Knowledge Proof Infrastructure

This module provides a robust zero-knowledge proof system for the Proof of Funds application. It enables users to prove they control funds without revealing exact amounts or complete wallet details.

## Architecture Overview

The ZK infrastructure consists of:

1. **Core Components**
   - TypeScript type definitions (`types.ts`)
   - WebAssembly loading and detection (`wasmLoader.ts`)
   - snarkjs integration (`snarkjsLoader.ts`)
   - Circuit versioning registry (`circuitVersions.ts`)

2. **Circuit Management**
   - Circuit build pipeline (`circuitBuilder.ts`) 
   - Circuit implementations (`circuits/`)
   - Circuit input handling (`zkCircuitInputs.js`)

3. **Proof Generation & Verification**
   - Proof generation (`zkProofGenerator.js`)
   - Proof verification (`zkVerifier.js`)
   - Utilities for ZK operations (`zkUtils.js`)

4. **Testing & Development**
   - Test utilities (`testUtils.ts`)
   - Progress tracking (`progressTracker.ts`)
   - Integration examples (`zkIntegrationExample.js`)
   - Test suite (`__tests__/`)

## Proof Types

The system supports three types of proofs:

1. **Standard Proof** - Proves exact balance amount
2. **Threshold Proof** - Proves balance is at least the specified amount
3. **Maximum Proof** - Proves balance is at most the specified amount

## Usage

```javascript
// Import ZK functionality
import { 
  generateZKProof, 
  verifyZKProof, 
  initializeZkSystem
} from 'lib/zk';

// Initialize the ZK system
await initializeZkSystem();

// Generate a proof
const proof = await generateZKProof(
  walletData,     // Address, private key, etc.
  'standard',     // Proof type (standard, threshold, maximum)
  { amount: '1000000000000000000' }  // 1 ETH in wei
);

// Verify a proof
const isValid = await verifyZKProof(
  proof,          // The proof object
  publicInputs,   // Public inputs for verification
  'standard'      // Proof type
);
```

## WebAssembly Detection & Fallbacks

The system automatically detects WebAssembly support in the client environment. When WebAssembly is not available or when the computational load is too high for the client, the system falls back to server-side processing.

## Circuit Versioning

The infrastructure maintains a version registry that ensures:

1. Backward compatibility with older proofs
2. Clear upgrade paths for circuit improvements
3. Proper mapping between circuit types and implementations

## Development & Testing

For development:

```javascript
// Generate a test wallet
import { generateTestWallet } from 'lib/zk';
const wallet = generateTestWallet();

// Mock proof generation
import { mockProofGeneration } from 'lib/zk';
const mockProof = await mockProofGeneration('standard', {
  address: wallet.address,
  amount: '1000000000000000000'
});

// Track progress of ZK operations
import { createProgressReporter } from 'lib/zk';
const progress = createProgressReporter('operation-name');
progress.reportProgress('step-name', 50, 'Half complete');
```

## Implementation Status

- Phase 1: Core Infrastructure ✓
  - Type definitions ✓
  - WebAssembly handling ✓
  - Circuit versioning ✓
  - Progress tracking ✓

- Phase 2: Circuit Implementation (In Progress)
  - Basic circuit templates ✓
  - Circuit build pipeline ✓
  - Testing utilities ✓
  - Full integration (Pending)

- Phase 3: Production Optimization (Planned)
  - Performance benchmarking
  - Memory optimization
  - Browser compatibility testing
  - Multi-device validation