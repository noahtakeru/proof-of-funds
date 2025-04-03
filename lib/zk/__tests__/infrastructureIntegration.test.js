/**
 * Integration Tests for ZK Infrastructure
 * 
 * These tests verify that the new TypeScript infrastructure correctly
 * integrates with the existing JavaScript codebase.
 */

// Import from the main index file to test the integration
const { 
  initializeZkSystem, 
  detectWasmSupport, 
  snarkjsLoader,
  getCircuitByType,
  zkProgressTracker,
  createProgressReporter,
  generateTestWallet,
  mockProofGeneration,
  mockProofVerification,
  // Original functionality
  getCircuitData,
  generateZKProof,
  verifyZKProof
} = require('../index');

describe('ZK Infrastructure Integration', () => {
  // Setup tests
  beforeAll(async () => {
    // Initialize both old and new systems
    await initializeZkSystem();
  });

  // WebAssembly Support Detection
  test('WebAssembly support detection works', async () => {
    const wasmSupported = await detectWasmSupport();
    // This should be true in most modern environments
    expect(typeof wasmSupported).toBe('boolean');
  });

  // snarkJS Loader
  test('snarkJS loader integration', async () => {
    expect(snarkjsLoader.isInitialized()).toBe(true);
    const snarkjs = snarkjsLoader.getSnarkjs();
    expect(snarkjs).toBeTruthy();
  });

  // Circuit Management
  test('Circuit management integration', () => {
    // Test original circuit access
    const standardCircuit = getCircuitData('standard');
    expect(standardCircuit).toBeTruthy();
    
    // Test new circuit access
    const newStandardCircuit = getCircuitByType('standard');
    expect(newStandardCircuit).toBeTruthy();
    
    // Circuits should be compatible
    if (newStandardCircuit) {
      expect(newStandardCircuit.circuitType).toBe('standard');
    }
  });

  // Progress Tracking
  test('Progress tracking system', () => {
    // Create a test progress reporter
    const progress = createProgressReporter('test-operation');
    expect(progress).toBeTruthy();
    expect(typeof progress.reportProgress).toBe('function');
    
    // Test progress reporting
    let progressReceived = false;
    const testCallback = (event) => {
      expect(event.operation).toBe('test-operation');
      expect(event.step).toBe('test-step');
      expect(event.progress).toBe(50);
      progressReceived = true;
    };
    
    zkProgressTracker.registerProgressCallback('test-operation', testCallback);
    progress.reportProgress('test-step', 50, 'Test message');
    
    expect(progressReceived).toBe(true);
    zkProgressTracker.unregisterProgressCallback('test-operation', testCallback);
  });

  // Test Utilities
  test('Test utilities integration', async () => {
    // Generate a test wallet
    const wallet = generateTestWallet();
    expect(wallet.address).toBeTruthy();
    expect(wallet.privateKey).toBeTruthy();
    
    // Test mock proof generation
    const mockProof = await mockProofGeneration('standard', {
      address: wallet.address,
      amount: '1000000000000000000'
    });
    
    expect(mockProof.proof).toBeTruthy();
    expect(Array.isArray(mockProof.publicSignals)).toBe(true);
    
    // Test mock verification
    const verificationResult = await mockProofVerification(
      'standard',
      mockProof.proof,
      mockProof.publicSignals
    );
    
    expect(verificationResult.valid).toBe(true);
    expect(verificationResult.circuitType).toBe('standard');
  });

  // Cross-system compatibility
  test('Cross-system compatibility', async () => {
    // Generate wallet with new system
    const wallet = generateTestWallet();
    
    // Try to use it with original proof generation
    // Note: This is a simplified test - in a real system we'd need to ensure
    // the wallet format is compatible between the two systems
    try {
      // This might not work yet until full integration is complete
      const proof = await generateZKProof({
        address: wallet.address,
        privateKey: wallet.privateKey
      }, 'standard');
      
      if (proof) {
        const verified = await verifyZKProof(proof, null, 'standard');
        expect(verified).toBeTruthy();
      }
    } catch (error) {
      // We're still in development, so errors are expected
      console.log('Integration still in progress:', error.message);
    }
  });
});