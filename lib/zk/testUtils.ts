/**
 * Testing utilities for ZK proof functions
 * Provides helper functions for generating test data, mocking proof generation,
 * and validating proof outputs in a controlled environment
 */

import { ethers } from 'ethers';
import type { 
  ProofParameters, 
  VerificationResult, 
  CircuitType,
  CircuitVersion
} from './types';
import { getCircuitByType, getCircuitByVersion } from './circuitVersions';

/**
 * Generate mock wallet data for testing
 * @returns An object with wallet address and private key
 */
export function generateTestWallet() {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey
  };
}

/**
 * Generate mock balance data for testing
 * @param amount The balance amount to use
 * @returns An object representing wallet balance data
 */
export function generateTestBalanceData(amount: string) {
  return {
    address: generateTestWallet().address,
    amount,
    token: 'ETH',
    timestamp: Date.now()
  };
}

/**
 * Mock proof generator for testing
 * @param circuitType The type of circuit to use
 * @param params The parameters for the proof
 * @returns A mock proof result
 */
export async function mockProofGeneration(
  circuitType: CircuitType,
  params: ProofParameters
): Promise<{ proof: string; publicSignals: string[] }> {
  // Get the appropriate circuit for this proof type
  const circuit = getCircuitByType(circuitType);
  
  // In a real proof, we'd use the actual circuit data
  // For testing, we'll create a deterministic mock based on the inputs
  const mockProof = {
    proof: `mock_proof_${circuitType}_${JSON.stringify(params).slice(0, 20)}`,
    publicSignals: [
      `signal_${params.address || 'unknown'}_${Date.now()}`,
      `signal_${params.amount || '0'}_${Date.now()}`
    ]
  };
  
  return new Promise(resolve => {
    // Simulate async proof generation
    setTimeout(() => resolve(mockProof), 100);
  });
}

/**
 * Mock proof verification for testing
 * @param circuitType The type of circuit used
 * @param proof The proof to verify
 * @param publicSignals The public signals from the proof
 * @returns A mock verification result
 */
export async function mockProofVerification(
  circuitType: CircuitType,
  proof: string,
  publicSignals: string[]
): Promise<VerificationResult> {
  // Simulate verification process
  // In tests, we'll consider all mock proofs valid unless they contain "invalid"
  const isValid = !proof.includes('invalid');
  
  return {
    valid: isValid,
    circuitType,
    verifiedAt: new Date().toISOString(),
    verificationMethod: 'test-mock',
    errorMessage: isValid ? undefined : 'Mock verification failure'
  };
}

/**
 * Create benchmarking wrapper for ZK functions
 * @param fn The function to benchmark
 * @returns The wrapped function with timing information
 */
export function createBenchmark<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => Promise<{ result: Awaited<ReturnType<T>>, timing: { start: number, end: number, duration: number } }> {
  return async (...args: Parameters<T>) => {
    const start = performance.now();
    const result = await fn(...args);
    const end = performance.now();
    
    return {
      result,
      timing: {
        start,
        end,
        duration: end - start
      }
    };
  };
}

/**
 * Test helper to validate the structure of a proof
 * @param proof The proof object to validate
 * @returns Boolean indicating if the proof structure is valid
 */
export function validateProofStructure(proof: any): boolean {
  // Check basic proof structure properties that should be present
  if (!proof || typeof proof !== 'object') return false;
  if (!proof.proof || typeof proof.proof !== 'string') return false;
  if (!Array.isArray(proof.publicSignals)) return false;
  
  return true;
}

/**
 * Verify that appropriate circuit files exist for testing
 * @param circuitVersion The circuit version to verify
 * @returns Boolean indicating if all required files exist
 */
export async function verifyCircuitFilesExist(circuitVersion: CircuitVersion): Promise<boolean> {
  try {
    const circuit = getCircuitByVersion(circuitVersion);
    
    // In a real implementation, we would check if files actually exist
    // For now, we'll simulate this check
    return !!circuit; 
  } catch (error) {
    return false;
  }
}