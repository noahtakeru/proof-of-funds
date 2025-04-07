# Week 2 Clarifications for ZK Infrastructure Plan

This document provides clarifications for the ambiguous aspects of Week 2 tasks identified in the ZK Infrastructure Plan.

## Task 1: Basic Circuit Implementation

### Circuit Build Pipeline Clarifications
- **Tool Selection**: Use snarkjs CLI tools for circuit compilation and key generation
- **Storage Location**: 
  - Store circuit source files in `/lib/zk/circuits/`
  - Store compiled artifacts in `/lib/zk/build/`
    - WASM files in `/lib/zk/build/wasm/`
    - ZKey files in `/lib/zk/build/zkey/`
    - Verification keys in `/lib/zk/build/verification_keys/`
- **Build Process Integration**: Create a Node.js script at `/lib/zk/scripts/build-circuits.js` that:
  - Compiles Circom to R1CS
  - Generates WASM binary
  - Performs trusted setup (for development purposes only)
  - Generates verification keys

### Implementation Notes
- Use Circom 2.0 syntax for all circuits
- Implement a simple proof-of-concept for each circuit type without optimization
- Focus on functional correctness rather than constraint minimization (optimization will be Week 5's focus)
- Create clear isolation between circuit types to prevent cross-circuit vulnerabilities

## Task 2: Core Utility Functions

### Memory Usage Detection Clarifications
- **Metrics to Track**:
  - Available device memory (using `navigator.deviceMemory` when available)
  - CPU cores (using `navigator.hardwareConcurrency`)
  - Check for WebWorker support
- **Thresholds**:
  - Consider "low memory" as < 4GB device memory
  - Consider "limited" as < 8GB device memory
- **Graceful Degradation**:
  - For low-memory devices, use server-side fallback automatically
  - For limited memory devices, offer client-side with warning about performance

### Circuit Versioning Clarifications
- Use semantic versioning (MAJOR.MINOR.PATCH)
- Store explicit compatibility information with each circuit version
- Include paths to all artifacts needed for each circuit version
- Implement version compatibility checking to ensure proofs can be verified with available verification keys

## Task 3: Testing Infrastructure

### Testing Framework Clarifications
- Use Jest for unit testing of JavaScript/TypeScript components
- Write simple tests verifying circuit correctness with known inputs
- Set up a test directory structure with:
  - Unit tests for utilities
  - Circuit-specific tests
  - Integration tests for proof generation and verification flow

### Baseline Performance Metrics
- Record execution time for basic operations:
  - Circuit compilation
  - Proof generation
  - Proof verification
- Test on reference hardware and document results
- No need for extensive benchmarking (full profiling will be done in Week 10)

## Implementation Priority

For Week 2, prioritize tasks in this order:
1. Basic circuit implementations for all three proof types
2. Circuit versioning system
3. Serialization/deserialization functions
4. Core utility functions 
5. Testing infrastructure

## Additional Scope Notes

- No need to optimize circuits at this stage - focus on correctness
- Hardware compatibility detection is a baseline implementation only
- Server-side circuit compilation is not needed yet (just local compilation)
- Defer advanced memory management strategies to Week 10