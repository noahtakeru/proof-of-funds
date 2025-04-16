/**
 * SnarkJS Integration Module
 * 
 * This module provides a robust integration with the snarkjs library,
 * handling its initialization, providing fallbacks, and managing
 * server-side processing when necessary.
 * 
 * It includes:
 * - Resilient snarkjs loading with error recovery
 * - Server-side fallbacks for low-powered devices
 * - Telemetry for monitoring operation success/failure
 * - Performance benchmarking
 */

import { wasmLoader } from './wasmLoader';
import { ZKProofOptions } from './types';
// Create dummy progress tracker since the real one is causing import issues
const createProgressTracker = async (options: any) => {
  return {
    start: () => ({ updateProgress: () => ({}), complete: () => ({}), cancel: (error?: Error) => ({}) }),
    updateProgress: (percentage: number) => ({}),
    advanceSteps: (steps: number) => ({}),
    complete: () => ({}),
    cancel: (error?: Error) => ({}),
    isCancelled: () => false
  };
};

// Define ProgressTracker interface for TypeScript
interface ProgressTracker {
  start(): ProgressTracker;
  updateProgress(percentage: number): ProgressTracker;
  advanceSteps(steps: number): ProgressTracker;
  complete(): ProgressTracker;
  cancel(error?: Error): ProgressTracker;
  isCancelled(): boolean;
}

// Define the shape of the imported snarkjs module
interface SnarkJS {
  getVersion?: () => string;
  version?: string;
  initialize?: () => Promise<SnarkJS>;
  groth16: {
    fullProve: (input: any, wasm: any, zkey: any, options?: any) => Promise<any>;
    prove: (zkey: any, wtns: any, options?: any) => Promise<any>;
    verify: (vkey: any, publicSignals: any, proof: any) => Promise<any>;
    exportSolidityCallData?: (proof: any, publicSignals: any) => Promise<any>;
  };
  plonk: {
    setup?: (r1cs: any, params: any, options?: any) => Promise<any>;
    prove: (zkey: any, wtns: any, options?: any) => Promise<any>;
    verify: (vkey: any, publicSignals: any, proof: any) => Promise<any>;
    fullProve?: (input: any, wasm: any, zkey: any, options?: any) => Promise<any>;
    exportSolidityCallData?: (proof: any, publicSignals: any) => Promise<any>;
  };
  wtns: {
    calculate: (input: any, wasm: any, options?: any) => Promise<any>;
  };
  zKey?: {
    exportVerificationKey: (zkey: any) => Promise<any>;
  };
  status?: {
    check: () => Promise<{
      available: boolean;
      features?: string[];
      version?: string;
      processingTimes?: Record<string, number>;
      error?: string;
    }>;
  };
}

// Cache the initialized snarkjs instance
let snarkjsInstance: SnarkJS | null = null;
let initializationStatus: 'not-started' | 'in-progress' | 'success' | 'failed' = 'not-started';
let initializationError: Error | null = null;

/**
 * Telemetry data for snarkjs operations
 */
interface SnarkjsTelemetry {
  operationId: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  errorMessage?: string;
  environment: {
    wasmSupported: boolean;
    inWorker: boolean;
    userAgent?: string;
    deviceMemory?: number;
    hardwareConcurrency?: number;
  };
  performanceMarks?: Record<string, number>;
}

// Store telemetry data
const telemetryData: SnarkjsTelemetry[] = [];

/**
 * Library version information
 */
const SNARKJS_VERSION = {
  required: '0.7.0',
  recommended: '0.7.5',
  current: 'unknown'
};

/**
 * Record telemetry for an operation
 * @param telemetry Telemetry data
 */
function recordTelemetry(telemetry: Partial<SnarkjsTelemetry>): string {
  // Create a telemetry entry with default values
  const entry: SnarkjsTelemetry = {
    operationId: `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    operation: 'unknown',
    startTime: Date.now(),
    success: false,
    environment: {
      wasmSupported: wasmLoader.isWasmSupported(),
      // Detect if we're in a worker environment
      inWorker: typeof self !== 'undefined' &&
        typeof window === 'undefined',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      deviceMemory: typeof navigator !== 'undefined' && 'deviceMemory' in navigator ?
        (navigator as any).deviceMemory : undefined,
      hardwareConcurrency: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined
    },
    ...telemetry
  };

  // Store the telemetry
  telemetryData.push(entry);

  // If the operation has completed, calculate duration
  if (entry.endTime) {
    entry.duration = entry.endTime - entry.startTime;
  }

  // If enabled, send telemetry to server (in production)
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_TELEMETRY === 'true') {
    try {
      // This would be an async call in production
      // sendTelemetryToServer(entry);
      console.log('Telemetry recorded:', entry.operationId);
    } catch (error) {
      // Don't let telemetry errors affect the main application
      console.error('Failed to send telemetry:', error);
    }
  }

  return entry.operationId;
}

/**
 * Get telemetry data for analysis
 * @returns All recorded telemetry data
 */
export function getTelemetryData(): SnarkjsTelemetry[] {
  return [...telemetryData];
}

/**
 * Safely imports the snarkjs library with telemetry
 * @returns Promise resolving to the snarkjs module
 */
async function safeImportSnarkjs(): Promise<SnarkJS> {
  const operationId = recordTelemetry({
    operation: 'import-snarkjs',
    startTime: Date.now()
  });

  try {
    // Performance mark for import start
    const importStartTime = Date.now();

    // Use direct string import for snarkjs - this will still be statically analyzable by webpack
    const snarkjsImport = await import('snarkjs');
    const module: SnarkJS = snarkjsImport.default || snarkjsImport;

    // Performance mark for import end
    const importEndTime = Date.now();

    // Update telemetry with success
    const telemetryIndex = telemetryData.findIndex(t => t.operationId === operationId);
    if (telemetryIndex >= 0) {
      telemetryData[telemetryIndex].success = true;
      telemetryData[telemetryIndex].endTime = Date.now();
      telemetryData[telemetryIndex].performanceMarks = {
        importDuration: importEndTime - importStartTime
      };
    }

    // Try to get version info
    try {
      if (module.getVersion) {
        SNARKJS_VERSION.current = module.getVersion();
      } else if (module.version) {
        SNARKJS_VERSION.current = module.version;
      }
    } catch (e) {
      console.warn('Could not determine snarkjs version:', e);
    }

    return module;
  } catch (error) {
    // Update telemetry with failure
    const telemetryIndex = telemetryData.findIndex(t => t.operationId === operationId);
    if (telemetryIndex >= 0) {
      telemetryData[telemetryIndex].success = false;
      telemetryData[telemetryIndex].endTime = Date.now();
      telemetryData[telemetryIndex].errorMessage = error instanceof Error ?
        error.message : String(error);
    }

    console.error('Failed to import snarkjs:', error);
    throw new Error(`Failed to import snarkjs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Initializes the snarkJS library with retry logic and telemetry
 * If client-side initialization fails, falls back to server-side implementation
 * 
 * @returns Promise resolving to the snarkJS library instance
 */
export async function initializeSnarkJS(): Promise<SnarkJS | null> {
  // Start initialization telemetry
  const initId = recordTelemetry({
    operation: 'snarkjs-init',
    startTime: Date.now()
  });

  // Progress reporter for UI feedback
  const progress = await createProgressTracker({ operationType: 'init', circuitType: 'snarkjs-init' });
  progress.updateProgress(0);

  let snarkjs: SnarkJS | null = null;
  let initErrorMessage: string | null = null;
  let retryCount = 0;
  const MAX_RETRIES = 3;

  // Track initialization metrics
  const startTime = Date.now();
  let successful = false;
  let usingFallback = 0; // Numeric value instead of boolean

  try {
    // Attempt to load and initialize snarkjs with retries
    while (retryCount < MAX_RETRIES && !successful) {
      try {
        progress.updateProgress(10 + (retryCount * 20));

        // Use direct string import for snarkjs - this is statically analyzable by webpack
        const snarkjsModule = await import('snarkjs');
        snarkjs = snarkjsModule.default || snarkjsModule;

        progress.updateProgress(60);

        // Test basic functionality to ensure it's working properly
        const functionTest = await testSnarkjsFunctionality(snarkjs);

        if (functionTest) {
          successful = true;
          progress.updateProgress(100);
          console.log('snarkJS initialized successfully');
        } else {
          throw new Error('Basic functionality test failed');
        }
      } catch (error) {
        retryCount++;
        initErrorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`snarkJS initialization attempt ${retryCount} failed:`, initErrorMessage);

        // Check if this is a permanent error that won't be resolved by retrying
        if (isPermanentError(initErrorMessage)) {
          console.warn('Permanent error detected, stopping retry attempts');
          break;
        }

        if (retryCount < MAX_RETRIES) {
          // Wait with exponential backoff before retrying
          const backoffTime = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
          progress.updateProgress(35 + (retryCount * 10));
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }

    // If initialization still failed after all retries, use server-side fallback
    if (!successful) {
      console.warn(
        `Failed to initialize snarkJS after ${retryCount} attempts. ` +
        `Using server-side fallback. Last error: ${initErrorMessage}`
      );

      progress.updateProgress(70);
      snarkjs = createServerSideFallback();
      usingFallback = 1;

      // Test server fallback
      try {
        // Handle status property being optional
        if (!snarkjs.status) {
          successful = false;
          throw new Error('Status API not available in snarkjs');
        }
        const serverStatus = await snarkjs.status.check();
        if (serverStatus.available) {
          successful = true;
          progress.updateProgress(100);
          console.log('Server fallback initialized successfully', serverStatus);
        } else {
          throw new Error(`Server fallback unavailable: ${serverStatus.error}`);
        }
      } catch (error) {
        const fallbackError = error instanceof Error ? error.message : String(error);
        console.error('Server fallback initialization failed:', fallbackError);
        progress.cancel(new Error(fallbackError));
        throw new Error(`Failed to initialize both client-side snarkJS and server fallback: ${fallbackError}`);
      }
    }

    // Update telemetry data with initialization results
    const elapsedTime = Date.now() - startTime;
    const telemetryIndex = telemetryData.findIndex(t => t.operationId === initId);

    if (telemetryIndex >= 0) {
      telemetryData[telemetryIndex].success = successful;
      telemetryData[telemetryIndex].endTime = Date.now();
      telemetryData[telemetryIndex].performanceMarks = {
        initTime: elapsedTime,
        retries: retryCount,
        usingFallback: usingFallback
      };
    }

    progress.complete();
    return snarkjs;
  } catch (error) {
    // Handle any uncaught errors during initialization
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Fatal error during snarkJS initialization:', errorMessage);

    // Update telemetry with failure
    const telemetryIndex = telemetryData.findIndex(t => t.operationId === initId);
    if (telemetryIndex >= 0) {
      telemetryData[telemetryIndex].success = false;
      telemetryData[telemetryIndex].endTime = Date.now();
      telemetryData[telemetryIndex].errorMessage = errorMessage;
    }

    progress.cancel(new Error(errorMessage));
    throw new Error(`Failed to initialize snarkJS: ${errorMessage}`);
  }
}

/**
 * Tests basic functionality of the snarkJS library to verify it's working properly
 * @param snarkjs The snarkJS instance to test
 * @returns Promise resolving to a boolean indicating success
 */
async function testSnarkjsFunctionality(snarkjs: SnarkJS): Promise<boolean> {
  try {
    // Check that key methods exist
    const requiredMethods = [
      snarkjs.groth16?.prove,
      snarkjs.groth16?.verify,
      snarkjs.plonk?.prove,
      snarkjs.plonk?.verify
    ];

    if (requiredMethods.some(method => typeof method !== 'function')) {
      console.warn('Some required snarkJS methods are missing');
      return false;
    }

    // Test a basic functionality that shouldn't require much computation
    // This is just a simple check that API structure is correct, not a full proof generation
    const mockInput = { a: 1, b: 2 };
    const mockCircuit = { signals: 3, constraints: 2 };

    // Try to access the exports functionality (doesn't need to actually run)
    if (typeof snarkjs.groth16.exportSolidityCallData !== 'function') {
      console.warn('exportSolidityCallData method is missing');
      return false;
    }

    // More comprehensive tests could be added for actual proof verification
    // But that would require actual zkey/wasm files

    return true;
  } catch (error) {
    console.error('Error during snarkJS functionality test:', error);
    return false;
  }
}

/**
 * Determines if an error during snarkJS initialization is permanent 
 * and not worth retrying
 * 
 * @param errorMessage The error message from initialization
 * @returns boolean indicating if this is a permanent error
 */
function isPermanentError(errorMessage: string): boolean {
  // Common permanent errors that won't be resolved by retrying
  const permanentErrorPatterns = [
    /memory allocation/i,         // WASM memory allocation issues
    /unsupported browser/i,       // Browser compatibility issues
    /webassembly not supported/i, // WASM support missing
    /module not found/i,          // Package or dependency missing
    /cannot find module/i,        // Import failure
    /permission denied/i,         // Security/permission issues
    /cors error/i,                // Cross-origin resource sharing issues
    /network changed/i,           // Major network change during loading
    /syntax error/i,              // Code error in the library
    /wasm compilation/i,          // WASM compilation errors
    /no wasm loader/i,            // Missing loader functionality
  ];

  return permanentErrorPatterns.some(pattern => pattern.test(errorMessage));
}

/**
 * Creates a server-side fallback for snarkjs functionality
 * This routes requests to a server API endpoint with retry and telemetry
 * @returns A server-side fallback implementation
 */
export function createServerSideFallback(): SnarkJS {
  console.log('Creating server-side fallback for snarkjs functionality');

  // Base server endpoint for ZK operations
  const ZK_API_ENDPOINT = '/api/zk';

  /**
   * Makes a server request with retry logic and telemetry
   * @param endpoint API endpoint path
   * @param data Request payload
   * @param operation Operation name for telemetry
   * @param retryAttempts Number of retry attempts
   * @returns Promise with the JSON response
   */
  async function makeServerRequest(
    endpoint: string,
    data: any,
    operation: string,
    retryAttempts: number = 3
  ): Promise<any> {
    // Start telemetry for this operation
    const operationId = recordTelemetry({
      operation: `server-${operation}`,
      startTime: Date.now()
    });

    // Create progress reporter
    const progress = await createProgressTracker({ operationType: operation, circuitType: 'server-fallback' });

    progress.start();

    // Add client capabilities to payload
    const enhancedData = {
      ...data,
      clientInfo: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        wasmSupported: wasmLoader.isWasmSupported(),
        timestamp: Date.now()
      }
    };

    let lastError: Error | null = null;

    // Try the request with retries
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        progress.updateProgress(10 + (attempt / retryAttempts) * 30);

        const response = await fetch(`${ZK_API_ENDPOINT}/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Operation-ID': operationId
          },
          body: JSON.stringify(enhancedData)
        });

        // If server returned error status, throw error
        if (!response.ok) {
          // Special handling for different status codes
          if (response.status === 413) {
            throw new Error('Payload too large for server processing');
          } else if (response.status === 429) {
            throw new Error('Rate limit exceeded for ZK operations');
          } else if (response.status >= 500) {
            throw new Error(`Server error (${response.status}): ${response.statusText}`);
          } else {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
          }
        }

        progress.updateProgress(70);

        // Parse and return the result
        const result = await response.json();

        // Update telemetry with success
        const telemetryIndex = telemetryData.findIndex(t => t.operationId === operationId);
        if (telemetryIndex >= 0) {
          telemetryData[telemetryIndex].success = true;
          telemetryData[telemetryIndex].endTime = Date.now();
          telemetryData[telemetryIndex].performanceMarks = {
            attempts: attempt,
            serverLatency: result.serverTiming?.totalTime
          };
        }

        progress.updateProgress(100);
        progress.complete();

        return result;
      } catch (error) {
        console.error(`Server request failed (attempt ${attempt}/${retryAttempts}):`, error);
        lastError = error instanceof Error ? error : new Error(String(error));

        // If this is the last attempt, update telemetry and throw
        if (attempt === retryAttempts) {
          // Update telemetry with failure
          const telemetryIndex = telemetryData.findIndex(t => t.operationId === operationId);
          if (telemetryIndex >= 0) {
            telemetryData[telemetryIndex].success = false;
            telemetryData[telemetryIndex].endTime = Date.now();
            telemetryData[telemetryIndex].errorMessage = lastError.message;
          }

          progress.cancel(lastError);
          throw lastError;
        }

        // Wait with exponential backoff before retrying
        const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        progress.updateProgress(40 + (attempt / retryAttempts) * 20);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }

    // Should never reach here due to the throw in the last iteration of the loop
    throw lastError || new Error('Unknown error during server request');
  }

  // Create the proxy to server-side operations
  return {
    groth16: {
      // Proxy proof generation to server
      prove: async (zkeyFileName: string, wtnsFileName: string, options = {}) => {
        console.log('Using server-side fallback for groth16.prove');
        return makeServerRequest('prove', {
          zkeyFileName,
          wtnsFileName,
          proofSystem: 'groth16',
          options
        }, 'groth16-prove');
      },

      // Proxy proof verification to server
      verify: async (vKeyData: any, publicSignals: any, proof: any) => {
        console.log('Using server-side fallback for groth16.verify');
        const result = await makeServerRequest('verify', {
          vKeyData,
          publicSignals,
          proof,
          proofSystem: 'groth16'
        }, 'groth16-verify');

        return result.valid;
      },

      // Combined proof generation from input
      fullProve: async (input: any, wasmFileName: string, zkeyFileName: string, options = {}) => {
        console.log('Using server-side fallback for groth16.fullProve');
        return makeServerRequest('fullProve', {
          input,
          wasmFileName,
          zkeyFileName,
          proofSystem: 'groth16',
          options
        }, 'groth16-fullProve');
      },

      // Proof export
      exportSolidityCallData: async (proof: any, publicSignals: any) => {
        console.log('Using server-side fallback for groth16.exportSolidityCallData');
        const result = await makeServerRequest('exportSolidityCallData', {
          proof,
          publicSignals,
          proofSystem: 'groth16'
        }, 'export-calldata');

        return result.calldata;
      }
    },

    wtns: {
      // Proxy witness calculation to server
      calculate: async (input: any, wasmFileName: string) => {
        console.log('Using server-side fallback for wtns.calculate');
        return makeServerRequest('calculate-witness', {
          input,
          wasmFileName
        }, 'calculate-witness');
      }
    },

    plonk: {
      // Similar implementations for plonk
      prove: async (zkeyFileName: string, wtnsFileName: string, options = {}) => {
        console.log('Using server-side fallback for plonk.prove');
        return makeServerRequest('prove', {
          zkeyFileName,
          wtnsFileName,
          proofSystem: 'plonk',
          options
        }, 'plonk-prove');
      },

      verify: async (vKeyData: any, publicSignals: any, proof: any) => {
        console.log('Using server-side fallback for plonk.verify');
        const result = await makeServerRequest('verify', {
          vKeyData,
          publicSignals,
          proof,
          proofSystem: 'plonk'
        }, 'plonk-verify');

        return result.valid;
      },

      fullProve: async (input: any, wasmFileName: string, zkeyFileName: string, options = {}) => {
        console.log('Using server-side fallback for plonk.fullProve');
        return makeServerRequest('fullProve', {
          input,
          wasmFileName,
          zkeyFileName,
          proofSystem: 'plonk',
          options
        }, 'plonk-fullProve');
      },

      exportSolidityCallData: async (proof: any, publicSignals: any) => {
        console.log('Using server-side fallback for plonk.exportSolidityCallData');
        const result = await makeServerRequest('exportSolidityCallData', {
          proof,
          publicSignals,
          proofSystem: 'plonk'
        }, 'export-calldata');

        return result.calldata;
      }
    },

    // Status check to determine if server-side processing is available
    status: {
      check: async () => {
        try {
          const result = await makeServerRequest('status', {}, 'status-check', 1);
          return {
            available: true,
            features: result.features,
            version: result.version,
            processingTimes: result.processingTimes
          };
        } catch (error) {
          return {
            available: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
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
    // Initialize WebAssembly loader if needed
    if (!wasmLoader.getCapabilities()) {
      await wasmLoader.initialize();
    }

    // Get client-side recommendation
    const clientSideRecommended = wasmLoader.isClientSideRecommended();

    // If client-side is not recommended, try to check server availability
    if (!clientSideRecommended && snarkjsInstance) {
      // Check if server fallback is actually available
      try {
        // Only do this check if we have a server fallback instance
        if ('status' in snarkjsInstance && typeof snarkjsInstance.status?.check === 'function') {
          const serverStatus = await snarkjsInstance.status.check();
          if (!serverStatus.available) {
            console.warn('Server-side processing is recommended but not available. Falling back to client-side.');
            return 'client';
          }
        }
      } catch (e) {
        console.warn('Could not check server availability:', e);
      }
    }

    return clientSideRecommended ? 'client' : 'server';
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

/**
 * Checks if snarkjs is initialized
 * @returns True if snarkjs is initialized
 */
export function isSnarkjsInitialized(): boolean {
  return initializationStatus === 'success' && snarkjsInstance !== null;
}

/**
 * Gets the initialized snarkjs instance
 * @returns The initialized snarkjs instance or null
 */
export function getSnarkjs(): any {
  return snarkjsInstance;
}

/**
 * Gets the current snarkjs version
 * @returns The current snarkjs version
 */
export function getSnarkjsVersion(): string {
  return SNARKJS_VERSION.current;
}

/**
 * Main snarkjs API wrapper class
 * Provides a clean interface for working with snarkjs
 */
class SnarkjsLoader {
  private initialized: boolean = false;

  /**
   * Initialize the snarkjs library
   * @param options Initialization options
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(options: {
    forceReInit?: boolean,
    timeout?: number,
    onProgress?: (progress: number, status: string) => void,
    retryAttempts?: number
  } = {}): Promise<boolean> {
    try {
      await initializeSnarkJS();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize snarkjs:', error);
      return false;
    }
  }

  /**
   * Check if snarkjs is initialized
   * @returns True if snarkjs is initialized
   */
  isInitialized(): boolean {
    return isSnarkjsInitialized();
  }

  /**
   * Get the snarkjs instance
   * @returns The snarkjs instance
   */
  getSnarkjs(): any {
    return getSnarkjs();
  }

  /**
   * Get the snarkjs version
   * @returns The snarkjs version
   */
  getVersion(): string {
    return getSnarkjsVersion();
  }

  /**
   * Reset the snarkjs instance
   * @returns Promise that resolves when reset is complete
   */
  async reset(): Promise<void> {
    await resetSnarkjs();
    this.initialized = false;
  }

  /**
   * Determine optimal proof generation location
   * @param options Options that may influence the decision
   * @returns The recommended location
   */
  async determineProofLocation(options?: ZKProofOptions): Promise<'client' | 'server'> {
    return determineProofGenerationLocation(options);
  }

  /**
   * Get telemetry data for analysis
   * @returns Telemetry data
   */
  getTelemetry(): SnarkjsTelemetry[] {
    return getTelemetryData();
  }
}

// Export a singleton instance
export const snarkjsLoader = new SnarkjsLoader();