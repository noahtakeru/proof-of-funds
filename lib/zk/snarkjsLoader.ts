/**
 * SnarkJS Integration Module
 * 
 * This module provides a robust integration with the snarkjs library,
 * handling its initialization, providing fallbacks, and managing
 * server-side processing when necessary.
 */

import { detectWebAssemblySupport, checkPerformanceCapabilities } from './wasmLoader';
import { ZKProofOptions } from './types';

// Cache the initialized snarkjs instance
let snarkjsInstance: any = null;
let initializationStatus: 'not-started' | 'in-progress' | 'success' | 'failed' = 'not-started';
let initializationError: Error | null = null;

/**
 * Safely imports the snarkjs library
 * @returns Promise resolving to the snarkjs module
 */
async function safeImportSnarkjs(): Promise<any> {
  try {
    // Dynamic import of snarkjs
    const module = await import('snarkjs');
    return module;
  } catch (error) {
    console.error('Failed to import snarkjs:', error);
    throw new Error(`Failed to import snarkjs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Initializes the snarkjs library
 * Handles runtime availability and provides appropriate fallbacks
 * @returns The initialized snarkjs instance
 */
export async function initializeSnarkJS(options: { 
  forceReInit?: boolean,
  timeout?: number
} = {}): Promise<any> {
  const { forceReInit = false, timeout = 10000 } = options;
  
  // Return the cached instance if available and not forcing reinit
  if (snarkjsInstance && !forceReInit) {
    console.log('Using cached snarkjs instance');
    return snarkjsInstance;
  }
  
  // If initialization is already in progress, wait for it to complete
  if (initializationStatus === 'in-progress') {
    console.log('snarkjs initialization already in progress, waiting...');
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (initializationStatus === 'success' && snarkjsInstance) {
          clearInterval(checkInterval);
          clearTimeout(timeoutId);
          resolve(snarkjsInstance);
        } else if (initializationStatus === 'failed') {
          clearInterval(checkInterval);
          clearTimeout(timeoutId);
          reject(initializationError || new Error('snarkjs initialization failed'));
        }
      }, 100);
      
      // Set timeout to avoid waiting indefinitely
      const timeoutId = setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error(`snarkjs initialization timed out after ${timeout}ms`));
      }, timeout);
    });
  }
  
  initializationStatus = 'in-progress';
  initializationError = null;
  
  try {
    // Check if WebAssembly is supported
    const wasmSupport = await detectWebAssemblySupport();
    if (!wasmSupport.supported) {
      throw new Error('WebAssembly is not supported in this environment. Using server-side fallback.');
    }
    
    // Import snarkjs library
    const snarkjs = await safeImportSnarkjs();
    
    // Modern versions may have an initialize method
    if (typeof snarkjs.initialize === 'function') {
      console.log('Initializing snarkjs with explicit initialize() method');
      snarkjsInstance = await snarkjs.initialize();
    } else {
      // Older versions or direct import
      snarkjsInstance = snarkjs;
    }
    
    // Verify that essential functionality is available
    if (!snarkjsInstance.groth16 || !snarkjsInstance.wtns) {
      throw new Error('Initialized snarkjs instance is missing required functionality');
    }
    
    console.log('snarkjs initialized successfully');
    initializationStatus = 'success';
    return snarkjsInstance;
  } catch (error) {
    console.error('Failed to initialize snarkjs:', error);
    initializationStatus = 'failed';
    initializationError = error instanceof Error ? error : new Error(String(error));
    
    // Create server-side fallback implementation
    console.warn('Using server-side fallback for snarkjs functionality');
    snarkjsInstance = createServerSideFallback();
    
    initializationStatus = 'success'; // We're providing a fallback, so it's a success
    return snarkjsInstance;
  }
}

/**
 * Creates a mock snarkjs implementation for development/testing
 * This is only used when snarkjs is not available
 * @returns A mock snarkjs implementation
 */
export function createMockSnarkjs() {
  console.warn('Creating mock snarkjs implementation for development/testing');
  
  return {
    groth16: {
      prove: async () => ({
        proof: { 
          pi_a: ['1', '2', '3'], 
          pi_b: [['4', '5'], ['6', '7'], ['8', '9']], 
          pi_c: ['10', '11', '12'] 
        },
        publicSignals: ['13', '14', '15']
      }),
      verify: async () => true,
      fullProve: async () => ({
        proof: { 
          pi_a: ['1', '2', '3'], 
          pi_b: [['4', '5'], ['6', '7'], ['8', '9']], 
          pi_c: ['10', '11', '12'] 
        },
        publicSignals: ['13', '14', '15']
      })
    },
    wtns: {
      calculate: async () => ({
        witness: [1, 2, 3],
        publicSignals: ['13', '14', '15']
      })
    },
    plonk: {
      prove: async () => ({
        proof: 'mock_plonk_proof',
        publicSignals: ['13', '14', '15']
      }),
      verify: async () => true,
      fullProve: async () => ({
        proof: 'mock_plonk_proof',
        publicSignals: ['13', '14', '15']
      })
    }
  };
}

/**
 * Creates a server-side fallback for snarkjs functionality
 * This routes requests to a server API endpoint
 * @returns A server-side fallback implementation
 */
export function createServerSideFallback() {
  console.log('Creating server-side fallback for snarkjs functionality');
  
  return {
    groth16: {
      // Proxy proof generation to server
      prove: async (zkeyFileName: string, wtnsFileName: string) => {
        console.log('Using server-side fallback for groth16.prove');
        const response = await fetch('/api/zk/prove', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            zkeyFileName,
            wtnsFileName,
            proofSystem: 'groth16'
          })
        });
        
        if (!response.ok) {
          throw new Error(`Server-side proof generation failed: ${response.statusText}`);
        }
        
        return await response.json();
      },
      
      // Proxy proof verification to server
      verify: async (vKeyData: any, publicSignals: any, proof: any) => {
        console.log('Using server-side fallback for groth16.verify');
        const response = await fetch('/api/zk/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vKeyData,
            publicSignals,
            proof,
            proofSystem: 'groth16'
          })
        });
        
        if (!response.ok) {
          throw new Error(`Server-side proof verification failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result.valid;
      },
      
      // Combined proof generation from input
      fullProve: async (input: any, wasmFileName: string, zkeyFileName: string) => {
        console.log('Using server-side fallback for groth16.fullProve');
        const response = await fetch('/api/zk/fullProve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            input,
            wasmFileName,
            zkeyFileName,
            proofSystem: 'groth16'
          })
        });
        
        if (!response.ok) {
          throw new Error(`Server-side full prove failed: ${response.statusText}`);
        }
        
        return await response.json();
      }
    },
    
    wtns: {
      // Proxy witness calculation to server
      calculate: async (input: any, wasmFileName: string) => {
        console.log('Using server-side fallback for wtns.calculate');
        const response = await fetch('/api/zk/calculate-witness', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            input,
            wasmFileName
          })
        });
        
        if (!response.ok) {
          throw new Error(`Server-side witness calculation failed: ${response.statusText}`);
        }
        
        return await response.json();
      }
    },
    
    plonk: {
      // Similar implementations for plonk
      prove: async (zkeyFileName: string, wtnsFileName: string) => {
        // Similar to groth16.prove but with proofSystem: 'plonk'
        console.log('Using server-side fallback for plonk.prove');
        const response = await fetch('/api/zk/prove', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            zkeyFileName,
            wtnsFileName,
            proofSystem: 'plonk'
          })
        });
        
        if (!response.ok) {
          throw new Error(`Server-side plonk proof generation failed: ${response.statusText}`);
        }
        
        return await response.json();
      },
      verify: async (vKeyData: any, publicSignals: any, proof: any) => {
        // Similar to groth16.verify
        console.log('Using server-side fallback for plonk.verify');
        const response = await fetch('/api/zk/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vKeyData,
            publicSignals,
            proof,
            proofSystem: 'plonk'
          })
        });
        
        if (!response.ok) {
          throw new Error(`Server-side plonk verification failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result.valid;
      },
      fullProve: async (input: any, wasmFileName: string, zkeyFileName: string) => {
        // Similar to groth16.fullProve
        console.log('Using server-side fallback for plonk.fullProve');
        const response = await fetch('/api/zk/fullProve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            input,
            wasmFileName,
            zkeyFileName,
            proofSystem: 'plonk'
          })
        });
        
        if (!response.ok) {
          throw new Error(`Server-side plonk full prove failed: ${response.statusText}`);
        }
        
        return await response.json();
      }
    }
  };
}

/**
 * Determines the optimal proof generation location (client or server)
 * based on device capabilities and user preferences
 * @param options User options that may influence the decision
 * @returns The recommended location for proof generation
 */
export async function determineProofGenerationLocation(
  options?: ZKProofOptions
): Promise<'client' | 'server'> {
  // User preference takes precedence if specified
  if (options?.preferredLocation) {
    return options.preferredLocation;
  }
  
  try {
    // Check device capabilities
    const capabilities = await checkPerformanceCapabilities();
    return capabilities.recommendedLocation;
  } catch (error) {
    console.warn('Failed to determine optimal proof generation location:', error);
    // Default to server-side if we can't determine capabilities
    return 'server';
  }
}

/**
 * Resets the snarkjs instance and forces reinitialization
 * Useful for testing or recovering from errors
 */
export async function resetSnarkjs(): Promise<void> {
  snarkjsInstance = null;
  initializationStatus = 'not-started';
  initializationError = null;
  
  // Clear any cached data
  console.log('snarkjs instance reset. Next call to initializeSnarkJS will reinitialize.');
}