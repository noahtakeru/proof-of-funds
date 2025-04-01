# ZK Proof Test Suite

This directory contains automated tests for the ZK Proof Generation system.

## Test Files

- **referenceId.test.js**: Tests the reference ID generation, validation, and management functionality
- **referenceStore.test.js**: Tests the storage and retrieval of reference IDs with metadata
- **proofEncryption.test.js**: Tests the encryption/decryption of proofs using AES
- **zkProofGenerator.test.js**: Tests the generation of ZK proofs, including fallback to simulation
- **zkProofVerifier.test.js**: Tests verification of ZK proofs both locally and on-chain
- **tempWalletManager.test.js**: Tests temporary wallet generation, tracking, and lifecycle management
- **circuit.integration.test.js**: Integration tests using actual compiled circuits with real wallet addresses

## Running Tests

To run all ZK-related tests:

```bash
# npm test script for ZK tests
npm run test:zk
```

To run a specific test file:

```bash
npx jest lib/zk/__tests__/proofEncryption.test.js
```

## Integration Tests with Real Circuits

The integration tests in **circuit.integration.test.js** validate the entire proof system using actual compiled circuits. To run these tests:

1. First compile the circuit:
   ```bash
   npm run compile:circuit
   ```

2. Then run the integration tests:
   ```bash
   npm run test:circuit
   ```

These tests verify that:
- The circuit correctly generates proofs for different proof types (standard, threshold, maximum)
- Proofs can be verified with the verification key
- The proof system works with real wallet addresses and balances
- Encryption/decryption of proofs works correctly
- Proof verification with the Solidity verifier contract works

## Testing Strategy

1. **Unit Tests**: Each module is tested independently to verify its core functionality works as expected.
2. **Mocked Dependencies**: For unit tests, external dependencies (like crypto libraries, blockchain providers) are mocked to ensure tests are fast and deterministic.
3. **Integration Tests**: The circuit.integration.test.js file tests the entire system end-to-end with actual compiled circuits.
4. **Edge Cases**: Tests cover various edge cases such as empty inputs, invalid keys, etc.
5. **Fallbacks**: Tests verify that fallback mechanisms work correctly when primary methods fail.

## Test Coverage

- Reference ID generation and validation
- Proof encryption and decryption  
- ZK proof generation with fallback simulation
- Proof serialization/deserialization
- Temporary wallet management
- Proof verification both locally and on-chain
- Integration testing with actual compiled circuits
- Testing with real wallet addresses and balances

## Implementation Notes

- The test suite uses Jest as the testing framework
- Integration tests skip automatically if circuit files are not found
- For components that interact with browser APIs (Window, localStorage), tests use appropriate mocks
- For integration tests, real snarkjs and circuit operations are used instead of mocks