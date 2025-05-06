# Proof of Funds - Common Package

This package contains common utilities and core functionality used across the Proof of Funds platform. It includes:

- Zero-knowledge proof generation and verification
- Error handling and logging utilities
- Memory management and optimization
- Secure storage mechanisms
- Device capability detection

## Usage

```javascript
import { generateZKProof, verifyZKProof } from '@proof-of-funds/common';

// Generate a zero-knowledge proof
const proof = await generateZKProof(input);

// Verify a zero-knowledge proof
const isValid = await verifyZKProof(proof);
```

## Structure

- `src/error-handling/` - Error handling and logging utilities
- `src/zk-core/` - Core ZK proof functionality
- `src/system/` - System utilities and optimizations

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test
```