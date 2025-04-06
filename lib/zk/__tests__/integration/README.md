# ZK Proof Integration Tests

This directory contains integration tests that use real cryptographic operations to validate the Zero-Knowledge Proof infrastructure. Unlike the mock-based tests in the parent directory, these tests perform actual proof generation and verification using the snarkjs library and real circuit implementations.

## Purpose

The integration tests serve several important purposes:

1. **Validate Real Cryptographic Operations**: Ensure that our ZK proof generation and verification works correctly with real cryptographic operations.

2. **Verify Mock Fidelity**: Confirm that our mock implementations accurately reflect the behavior of real implementations.

3. **Measure Performance**: Benchmark the performance of cryptographic operations in different environments.

4. **Test Cross-Component Integration**: Verify that different components of the ZK system work together correctly.

5. **Ensure Test Validity**: Address concerns about tests "faking it" by validating with real cryptography.

## Test Structure

The integration tests follow a similar structure to the mock-based tests, but use real implementations instead of mocks:

```
integration/
  ├── circuitTests/                        # Tests for individual circuits
  │   ├── standardProof.test.js            # Tests for standard proof circuit
  │   ├── thresholdProof.test.js           # Tests for threshold proof circuit
  │   └── maximumProof.test.js             # Tests for maximum proof circuit
  ├── mockValidation/                      # Tests comparing mock vs. real behavior
  │   ├── proofGeneration.test.js          # Compares general proof generation
  │   ├── thresholdProofValidation.test.js # Compares threshold proof behavior
  │   └── maximumProofValidation.test.js   # Compares maximum proof behavior
  ├── systemTests/                         # End-to-end system tests
  │   └── clientServer.test.js             # Tests client/server switching
  ├── utils/                               # Utilities for integration testing
  │   ├── testCircuits.js                  # Circuit loading utilities
  │   └── testVectors.js                   # Real test vectors
  ├── runIntegrationTests.js               # Custom test runner
  └── README.md                            # This file
```

## Implementation Status

✅ = Implemented and Tested | 🔄 = In Progress | ⏳ = Planned

### Phase 1: Basic Circuit Tests ✅

- ✅ Set up real circuit loading
- ✅ Create test vectors for each circuit type
- ✅ Implement standard proof tests
- ✅ Implement threshold proof tests
- ✅ Implement maximum proof tests

### Phase 2: Mock Validation Tests ✅

- ✅ Create general proof generation validation tests
- ✅ Create threshold proof validation tests
- ✅ Create maximum proof validation tests
- ✅ Document behavior differences
- ✅ Update mocks to better match real behavior

### Phase 3: End-to-End System Tests ✅

- ✅ Implement client/server switching tests
- ✅ Create server-side execution tests
- ✅ Create client-side execution tests
- ✅ Validate cross-environment compatibility

## Running Integration Tests

These tests use real cryptographic operations and are significantly slower than mock-based tests. Use our custom test runner to execute them:

```bash
# Run all integration tests
node runIntegrationTests.js

# Run specific category of tests
node runIntegrationTests.js --category circuit
node runIntegrationTests.js --category mock-validation
node runIntegrationTests.js --category system

# Skip tests that require real circuit builds
node runIntegrationTests.js --skip-real

# Show detailed output
node runIntegrationTests.js --verbose
```

## Test Runner Features

The custom test runner (`runIntegrationTests.js`) offers several useful features:

1. **Category Selection**: Run specific categories of tests
2. **Circuit Availability Check**: Automatically skip tests if circuits aren't available
3. **Verbose Output**: Detailed output for debugging
4. **Independent Execution**: Run tests without Jest dependencies
5. **Consistent Environment**: Ensures consistent test environment variables

## Adding New Integration Tests

When adding new integration tests:

1. Ensure they use real cryptographic operations, not mocks
2. Include test vectors that cover both valid and invalid cases
3. Document expected outputs and behaviors
4. Include performance measurements where relevant
5. Compare with mock behavior where appropriate
6. Make sure tests skip gracefully when circuit artifacts aren't available

## Test Data

Integration tests use the following types of test data:

1. **Real Circuit Artifacts**: WASM and zkey files for each circuit
2. **Verification Keys**: Real verification keys for proof verification
3. **Test Wallets**: Dedicated test wallets with known addresses and balances
4. **Test Vectors**: Known inputs with expected valid/invalid outputs

All test data should be deterministic and reproducible to ensure consistent test results.