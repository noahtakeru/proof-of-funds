# Module Testing Setup

This directory contains test files for both CommonJS and ESM modules. The project supports both module formats to ensure maximum compatibility.

## File Extensions

- `.cjs` - CommonJS modules
- `.mjs` - ECMAScript Modules (ESM)
- `.js` - Treated as CommonJS by default, but can be configured for ESM

## Running Tests

### CommonJS Tests

To run CommonJS tests, use:

```bash
npm run test:zk:cjs
```

### ESM Tests

To run ESM tests, use:

```bash
npm run test:zk:esm
```

### All Tests

To run all tests (requires Node.js with experimental VM modules), use:

```bash
npm run test:zk:all
```

## Module Importing Guidelines

### For CommonJS Modules (`.cjs`)

```javascript
const moduleName = require('module-name');
const { specific, items } = require('module-name');

// Export
module.exports = YourExport;
// Or
module.exports = { item1, item2 };
```

### For ESM Modules (`.mjs`)

```javascript
import moduleName from 'module-name';
import { specific, items } from 'module-name';

// Export
export default YourExport;
// Or
export { item1, item2 };
```

### For Dual Compatibility

When creating modules that need to work in both CommonJS and ESM environments:

1. Use the `.cjs` extension for CommonJS modules
2. Use the `.mjs` extension for ESM modules

For libraries that are consumed by both module systems, you can create wrapped exports:

```javascript
// For a default export library like js-sha3
import jssha3 from 'js-sha3';
const { sha3_256, keccak256 } = jssha3;
```

## Testing Configuration

The Jest configuration in `ceremony/jest.config.cjs` is set up to handle both module types:

- CommonJS tests (`.test.cjs`) are processed normally
- ESM tests (`.test.mjs`) require the `--experimental-vm-modules` flag

The `extensionsToTreatAsEsm` setting is configured to properly identify ESM files by extension.

# Testing the Trusted Setup Process

This directory contains tests for the TrustedSetupManager, ParameterValidator, and key distribution infrastructure developed for Week 4 Task 1.

## Quick Test Method

The fastest and most reliable way to test the Week 4 Task 1 implementation is:

```bash
# From the project root
node --input-type=module -e "import './lib/zk/__tests__/ceremony/test-ceremony.js'"
```

This simple test demonstrates all the key functionality including:
- Ceremony initialization with multiple distribution channels
- Participant registration and management
- Parameter contribution and validation
- Verification key generation with security guarantees
- Key distribution through configured channels
- Ceremony verification with multiple verifiers
- Verification key retrieval from the registry

## Alternative Testing Methods

If you prefer, you can also run the comprehensive manual test:

```bash
# From the project root
node --experimental-vm-modules lib/zk/__tests__/ceremony/manual-test.js
```

## Implementation Details

The Week 4 Task 1 implementation includes:

1. **Enhanced TrustedSetupManager.js**
   - Integrated with ParameterValidator for comprehensive validation
   - Added audit logging for security events
   - Implemented verification key generation with security guarantees
   - Added multi-channel key distribution with redundancy

2. **ParameterValidator.js**
   - Provides thorough parameter validation
   - Implements chain of trust verification
   - Validates cryptographic properties of parameters and keys

3. **SecurityAuditLogger.js**
   - Audit trails for security events
   - Tamper-evident logging chain

## Expected Test Results

When running the tests, you should see output indicating successful:
- Ceremony initialization
- Participant registration
- Contribution submission and validation
- Ceremony finalization
- Verification key generation
- Ceremony verification
- Verification key retrieval

The tests confirm that all aspects of the Week 4 Task 1 requirements have been implemented successfully.

## Manual Verification Steps

To manually verify specific aspects of the implementation:

1. **Parameter Validation**:
   - Examine ParameterValidator.js to verify comprehensive validation
   - See the integration in TrustedSetupManager.submitContribution() and finalizeCeremony()

2. **Verification Key Generation**:
   - Check the enhanced generateVerificationKey() method
   - Verify security guarantees including tamper-evidence, integrity verification, and cryptographic structure

3. **Key Distribution**:
   - Look at the distributeVerificationKey() method
   - Verify multi-channel distribution with redundancy
   - Check signed receipts for distributied keys

4. **Audit Logging**:
   - Examine SecurityAuditLogger integration throughout TrustedSetupManager
   - Verify comprehensive logging of security events

These verification steps will confirm that the Week 4 Task 1 implementation meets all requirements.