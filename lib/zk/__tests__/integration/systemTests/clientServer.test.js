/**
 * Client/Server Switching Integration Tests
 * 
 * These tests validate that the client/server switching functionality works
 * correctly with real cryptographic operations. They ensure that proofs
 * generated on the client and server are compatible and that the system
 * correctly chooses the optimal execution location.
 */

import { fileURLToPath } from 'url';
import path from 'path';

// Import test vectors
import { getTestWallets, getStandardProofVectors } from '../utils/testVectors.js';
import { isCircuitAvailable, generateProof, verifyProof } from '../utils/testCircuits.js';

// Import ZK Proxy Client
import { ZKProxyClient, EXECUTION_MODES } from '../../../zkProxyClient.js';

// Mock fetch for server-side operations
function createMockFetch() {
  return async (url, options = {}) => {
    if (url.includes('/api/zk/fullProve')) {
      // Use real circuit to generate proof on "server side"
      const { input } = JSON.parse(options.body);
      
      // Map proof type to circuit type
      const circuitTypes = ['standard', 'threshold', 'maximum'];
      const circuitType = circuitTypes[input.proofType];
      
      // Generate real proof using circuit
      const result = await generateProof(input, circuitType);
      
      // Return as if from server
      return {
        ok: true,
        json: async () => result
      };
    }
    
    if (url.includes('/api/zk/verify')) {
      // Use real circuit to verify proof on "server side"
      const { proof, publicSignals, proofType } = JSON.parse(options.body);
      
      // Map proof type to circuit type
      const circuitTypes = ['standard', 'threshold', 'maximum'];
      const circuitType = circuitTypes[proofType];
      
      // Verify with real circuit
      const isValid = await verifyProof(proof, publicSignals, circuitType);
      
      // Return as if from server
      return {
        ok: true,
        json: async () => ({ isValid, verificationTimeMs: 50 })
      };
    }
    
    if (url.includes('/api/zk/status')) {
      return {
        ok: true,
        json: async () => ({
          available: true,
          capabilities: {
            cpu: { cores: 16, load: 0.3 },
            memory: { total: 32768, free: 16384 },
          },
          limits: {
            maxConcurrent: 50,
            maxQueueDepth: 100
          },
          currentState: {
            queueDepth: 0,
            activeOperations: 0
          }
        })
      };
    }
    
    return { 
      ok: false,
      status: 404,
      json: async () => ({ error: 'Endpoint not found' })
    };
  };
}

describe('Client/Server Switching Integration Tests', () => {
  let zkClient;
  
  beforeEach(async () => {
    // Create ZK Proxy Client with mock fetch
    global.fetch = createMockFetch();
    
    zkClient = new ZKProxyClient();
    await zkClient.initialize();
  });
  
  afterEach(() => {
    // Clean up
    delete global.fetch;
  });
  
  test('Client-side proof generation produces valid proofs', async () => {
    // Skip if circuit isn't available
    if (!isCircuitAvailable('standard')) {
      console.warn('Skipping test: Standard circuit artifacts not available');
      return;
    }
    
    // Force client-side execution
    zkClient.setExecutionMode(EXECUTION_MODES.CLIENT_SIDE);
    
    // Use first test vector
    const testVector = getStandardProofVectors()[0];
    
    // Generate proof
    const result = await zkClient.generateProof({
      walletAddress: testVector.walletAddress,
      amount: testVector.amount,
      proofType: 0 // Standard proof
    });
    
    // Verify proof (should be valid)
    const isValid = await zkClient.verifyProof(result.proof, result.publicSignals, 0);
    
    // Assert that proof was generated on client-side and is valid
    expect(result.isClientSide).toBe(true);
    expect(isValid).toBe(true);
  });
  
  test('Server-side proof generation produces valid proofs', async () => {
    // Skip if circuit isn't available
    if (!isCircuitAvailable('standard')) {
      console.warn('Skipping test: Standard circuit artifacts not available');
      return;
    }
    
    // Force server-side execution
    zkClient.setExecutionMode(EXECUTION_MODES.SERVER_SIDE);
    
    // Use first test vector
    const testVector = getStandardProofVectors()[0];
    
    // Generate proof
    const result = await zkClient.generateProof({
      walletAddress: testVector.walletAddress,
      amount: testVector.amount,
      proofType: 0 // Standard proof
    });
    
    // Verify proof (should be valid)
    const isValid = await zkClient.verifyProof(result.proof, result.publicSignals, 0);
    
    // Assert that proof was generated on server-side and is valid
    expect(result.isServerSide).toBe(true);
    expect(isValid).toBe(true);
  });
  
  test('Proofs from client and server are compatible', async () => {
    // Skip if circuit isn't available
    if (!isCircuitAvailable('standard')) {
      console.warn('Skipping test: Standard circuit artifacts not available');
      return;
    }
    
    // Use first test vector
    const testVector = getStandardProofVectors()[0];
    const input = {
      walletAddress: testVector.walletAddress,
      amount: testVector.amount,
      proofType: 0 // Standard proof
    };
    
    // Generate proof on client
    zkClient.setExecutionMode(EXECUTION_MODES.CLIENT_SIDE);
    const clientResult = await zkClient.generateProof(input);
    
    // Generate proof on server
    zkClient.setExecutionMode(EXECUTION_MODES.SERVER_SIDE);
    const serverResult = await zkClient.generateProof(input);
    
    // Verify client proof with server
    const clientProofValidOnServer = await zkClient.verifyProof(
      clientResult.proof, 
      clientResult.publicSignals,
      0
    );
    
    // Verify server proof with client
    zkClient.setExecutionMode(EXECUTION_MODES.CLIENT_SIDE);
    const serverProofValidOnClient = await zkClient.verifyProof(
      serverResult.proof, 
      serverResult.publicSignals,
      0
    );
    
    // Assert that proofs are compatible
    expect(clientProofValidOnServer).toBe(true);
    expect(serverProofValidOnClient).toBe(true);
  });
  
  test('Hybrid mode selects appropriate execution location', async () => {
    // Skip if circuits aren't available
    if (!isCircuitAvailable('standard') || !isCircuitAvailable('maximum')) {
      console.warn('Skipping test: Circuit artifacts not available');
      return;
    }
    
    // Use hybrid mode
    zkClient.setExecutionMode(EXECUTION_MODES.HYBRID);
    
    // Standard proof should use client-side
    const standardResult = await zkClient.generateProof({
      walletAddress: getTestWallets()[0].address,
      amount: getTestWallets()[0].balance,
      proofType: 0 // Standard proof (simpler)
    });
    
    // Maximum proof should use server-side
    const maximumResult = await zkClient.generateProof({
      walletAddress: getTestWallets()[1].address,
      amount: '1000000000000000000',
      actualBalance: getTestWallets()[1].balance,
      proofType: 2 // Maximum proof (more complex)
    });
    
    // Assert correct execution locations were chosen
    expect(standardResult.isClientSide).toBe(true);
    expect(maximumResult.isServerSide).toBe(true);
  });
});