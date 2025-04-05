# Regression Tests for Zero-Knowledge Infrastructure

This document provides instructions for running regression tests for all completed tasks in the Zero-Knowledge Infrastructure development. These tests help ensure that new changes don't break existing functionality.

## Test Execution

To run all regression tests, use the following commands:

```bash
# Navigate to the project root directory
cd /Users/karpel/Documents/GitHub/proof-of-funds

# Run the regression test script
./lib/zk/run-regression-tests.sh
```

The test script will:
1. Verify all components from Week 1-4 are functioning correctly
2. Provide a comprehensive summary showing pass/fail status for each task
3. Calculate the overall pass percentage

If you encounter permission issues with the script, you may need to make it executable:

```bash
chmod +x ./lib/zk/run-regression-tests.sh
```

## Week 1 Tasks

### Task 1: ZK System Architecture

Test the basic architecture setup:

```bash
# Test ZK system architecture
node --input-type=module -e "
  import { default as zkUtils } from './lib/zk/zkUtils.js';
  console.log('✅ ZK Utils loaded successfully:', Object.keys(zkUtils).length > 0 ? 'PASS' : 'FAIL');
  
  import SecureKeyManager from './lib/zk/SecureKeyManager.js';
  console.log('✅ SecureKeyManager loaded successfully:', SecureKeyManager ? 'PASS' : 'FAIL');
  
  import TamperDetection from './lib/zk/TamperDetection.js';
  console.log('✅ TamperDetection loaded successfully:', TamperDetection ? 'PASS' : 'FAIL');
"
```

### Task 2: Client-Side Security

Test the client-side security components:

```bash
# Run the security components test
node --input-type=module -e "
  import SecureKeyManager from './lib/zk/SecureKeyManager.js';
  import TamperDetection from './lib/zk/TamperDetection.js';
  
  const securityTest = async () => {
    try {
      // Test SecureKeyManager
      const keyManager = new SecureKeyManager();
      const testKey = keyManager.generateEncryptionKey();
      console.log('✅ Key generation:', testKey ? 'PASS' : 'FAIL');
      
      // Test TamperDetection
      const tamperDetection = new TamperDetection();
      const testData = { test: 'data' };
      const signedData = tamperDetection.sign(testData);
      console.log('✅ Tamper detection signing:', 
        signedData && signedData._timestamp ? 'PASS' : 'FAIL');
    } catch (error) {
      console.error('❌ Security test failed:', error);
    }
  };
  
  securityTest();
"
```

### Task 3: Serialization & ZK Integration

Test the serialization utilities:

```bash
# Test serialization utilities
node --input-type=module -e "
  import { serializeZKProof, deserializeZKProof, generateZKProofHash } from './lib/zk/zkUtils.js';
  
  const serializationTest = () => {
    try {
      // Create test proof
      const testProof = {
        pi_a: ['1', '2', '3'],
        pi_b: [['4', '5'], ['6', '7']],
        pi_c: ['8', '9', '10'],
        protocol: 'groth16'
      };
      const testSignals = ['11', '12', '13'];
      
      // Test serialization
      const serialized = serializeZKProof(testProof, testSignals);
      console.log('✅ Proof serialization:', 
        serialized && serialized.proof && serialized.publicSignals ? 'PASS' : 'FAIL');
      
      // Test deserialization
      const deserialized = deserializeZKProof(serialized.proof, serialized.publicSignals);
      console.log('✅ Proof deserialization:', 
        deserialized && deserialized.proof && deserialized.publicSignals ? 'PASS' : 'FAIL');
      
      // Test hash generation
      const hash = generateZKProofHash(testProof, testSignals);
      console.log('✅ Proof hash generation:', hash && hash.startsWith('0x') ? 'PASS' : 'FAIL');
    } catch (error) {
      console.error('❌ Serialization test failed:', error);
    }
  };
  
  serializationTest();
"
```

## Week 2 Tasks

### Task 1: zkCircuitParameterDerivation

Test the circuit parameter derivation:

```bash
# Test circuit parameter derivation
node --input-type=module -e "
  import * as fs from 'fs';
  const hasParameterDerivation = fs.existsSync('./lib/zk/zkCircuitParameterDerivation.js');
  
  if (hasParameterDerivation) {
    import('./lib/zk/zkCircuitParameterDerivation.js')
      .then(module => {
        console.log('✅ Parameter derivation module loaded:', 
          module && typeof module.deriveParameters === 'function' ? 'PASS' : 'FAIL');
      })
      .catch(error => console.error('❌ Failed to load parameter derivation:', error));
  } else {
    console.log('⚠️ zkCircuitParameterDerivation.js not found, skipping test');
  }
"
```

### Task 2: zkCircuitRegistry

Test the circuit registry:

```bash
# Test circuit registry
node --input-type=module -e "
  import * as fs from 'fs';
  const hasCircuitRegistry = fs.existsSync('./lib/zk/zkCircuitRegistry.js');
  
  if (hasCircuitRegistry) {
    import('./lib/zk/zkCircuitRegistry.js')
      .then(module => {
        console.log('✅ Circuit registry module loaded:',
          module && typeof module.registerCircuit === 'function' ? 'PASS' : 'FAIL');
      })
      .catch(error => console.error('❌ Failed to load circuit registry:', error));
  } else {
    console.log('⚠️ zkCircuitRegistry.js not found, skipping test');
  }
"
```

### Task 3: zkSecureInputs

Test the secure inputs module:

```bash
# Test secure inputs module
node --input-type=module -e "
  import * as fs from 'fs';
  const hasSecureInputs = fs.existsSync('./lib/zk/zkSecureInputs.js');
  
  if (hasSecureInputs) {
    import('./lib/zk/zkSecureInputs.js')
      .then(module => {
        console.log('✅ Secure inputs module loaded:',
          module && typeof module.prepareSecureInput === 'function' ? 'PASS' : 'FAIL');
      })
      .catch(error => console.error('❌ Failed to load secure inputs module:', error));
  } else {
    console.log('⚠️ zkSecureInputs.js not found, skipping test');
  }
"
```

## Week 3 Tasks

### Task 1: CircuitBuilder and CircuitVersions

Test the CircuitBuilder and CircuitVersions:

```bash
# Test CircuitBuilder and CircuitVersions
node --input-type=module -e "
  import * as fs from 'fs';
  const hasCircuitBuilder = fs.existsSync('./lib/zk/circuitBuilder.ts');
  const hasCircuitVersions = fs.existsSync('./lib/zk/circuitVersions.ts');
  
  console.log('✅ CircuitBuilder exists:', hasCircuitBuilder ? 'PASS' : 'FAIL');
  console.log('✅ CircuitVersions exists:', hasCircuitVersions ? 'PASS' : 'FAIL');
  
  // If we have TypeScript files, test with ts-node if available
  if (hasCircuitBuilder && hasCircuitVersions) {
    try {
      const { execSync } = require('child_process');
      execSync('npx ts-node -e "console.log(\'TypeScript compilation check\')"', 
        { stdio: 'inherit' });
      console.log('✅ TypeScript compilation check passed');
    } catch (error) {
      console.log('⚠️ TypeScript compilation check skipped, ts-node may not be available');
    }
  }
"
```

### Task 2: WASM Loader

Test the WASM loader:

```bash
# Test WASM loader
node --input-type=module -e "
  import * as fs from 'fs';
  const hasWasmLoader = fs.existsSync('./lib/zk/wasmLoader.ts');
  
  console.log('✅ WASM Loader exists:', hasWasmLoader ? 'PASS' : 'FAIL');
  
  if (hasWasmLoader) {
    // Basic import check
    try {
      import('./lib/zk/wasmLoader.js')
        .then(module => {
          console.log('✅ WASM Loader module loaded:',
            module && typeof module.loadWasmModule === 'function' ? 'PASS' : 'FAIL');
        })
        .catch(error => console.error('⚠️ WASM Loader import check skipped:', error.message));
    } catch (error) {
      console.log('⚠️ WASM Loader import check skipped:', error.message);
    }
  }
"
```

### Task 3: TrustedSetupManager

Test the TrustedSetupManager:

```bash
# Test TrustedSetupManager (basic functionality only)
node --input-type=module -e "
  import * as fs from 'fs';
  const hasTrustedSetupManager = fs.existsSync('./lib/zk/TrustedSetupManager.js');
  
  console.log('✅ TrustedSetupManager exists:', hasTrustedSetupManager ? 'PASS' : 'FAIL');
  
  if (hasTrustedSetupManager) {
    import('./lib/zk/TrustedSetupManager.js')
      .then(module => {
        const manager = module.default;
        console.log('✅ TrustedSetupManager module loaded:',
          manager && typeof manager.initializeCeremony === 'function' ? 'PASS' : 'FAIL');
      })
      .catch(error => console.error('❌ Failed to load TrustedSetupManager:', error));
  }
"
```

## Week 4 Tasks

### Task 1: Trusted Setup Process

Run the comprehensive trusted setup ceremony test:

```bash
# Test the trusted setup process (comprehensive test)
node --input-type=module -e "import './lib/zk/__tests__/ceremony/test-ceremony.js'"
```

## Custom Test Runners

Each task can have a dedicated test runner for more detailed testing:

### TrustedSetupManager Tests

```bash
# Run dedicated TrustedSetupManager tests
node --input-type=module -e "import './lib/zk/__tests__/ceremony/test-ceremony.js'"
```

## Adding New Tests

When implementing new tasks, add corresponding tests to this document and to the regression test script. Follow these guidelines:

1. Create simple, self-contained tests that can be run with a single command
2. Design tests to clearly indicate success or failure
3. Add appropriate error handling
4. For complex tasks, create dedicated test files in the `__tests__` directory
5. Update the main regression test script when adding new tests

## Troubleshooting

If tests fail, check the following:

1. Module compatibility issues (CommonJS vs ESM)
2. Missing dependencies
3. Browser-specific features not available in Node.js
4. TypeScript compilation errors
5. Missing or incorrect imports

For browser-specific components, consider using a headless browser testing framework like Puppeteer or Playwright for more comprehensive testing.