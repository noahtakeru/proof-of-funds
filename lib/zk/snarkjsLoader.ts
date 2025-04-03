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
 * - Mock implementations for testing
 * - Telemetry for monitoring operation success/failure
 * - Performance benchmarking
 */

import { wasmLoader } from './wasmLoader';
import { ZKProofOptions } from './types';
import { createProgressReporter } from './progressTracker';

// Cache the initialized snarkjs instance
let snarkjsInstance: any = null;
let initializationStatus: 'not-started' | 'in-progress' | 'success' | 'failed' = 'not-started';
let initializationError: Error | null = null;

/**
 * Safely imports the snarkjs library
 * @returns Promise resolving to the snarkjs module
 */
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
function recordTelemetry(telemetry: Partial<SnarkjsTelemetry>) {
  // Create a telemetry entry with default values
  const entry: SnarkjsTelemetry = {
    operationId: `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    operation: 'unknown',
    startTime: Date.now(),
    success: false,
    environment: {
      wasmSupported: wasmLoader.isWasmSupported(),
      inWorker: typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope,
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
async function safeImportSnarkjs(): Promise<any> {
  const operationId = recordTelemetry({
    operation: 'import-snarkjs',
    startTime: Date.now()
  });
  
  try {
    // Performance mark for import start
    const importStartTime = Date.now();
    
    // Dynamic import of snarkjs
    const module = await import('snarkjs');
    
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
 * Initializes the snarkjs library
 * Handles runtime availability and provides appropriate fallbacks
 * @returns The initialized snarkjs instance
 */
export async function initializeSnarkJS(options: { 
  forceReInit?: boolean,
  timeout?: number,
  useMock?: boolean,
  onProgress?: (progress: number, status: string) => void,
  retryAttempts?: number
} = {}): Promise<any> {
  const { 
    forceReInit = false, 
    timeout = 10000,
    useMock = false,
    onProgress,
    retryAttempts = 3
  } = options;
  
  // Create a progress reporter
  const progress = createProgressReporter('snarkjs-initialization');
  
  // Helper to report progress
  const reportProgress = (percent: number, message: string) => {
    progress.reportProgress('initialization', percent, message);
    onProgress?.(percent, message);
  };
  
  // Start telemetry for initialization
  const operationId = recordTelemetry({
    operation: 'initialize-snarkjs',
    startTime: Date.now()
  });
  
  // Return the cached instance if available and not forcing reinit
  if (snarkjsInstance && !forceReInit) {
    console.log('Using cached snarkjs instance');
    reportProgress(100, 'Using cached snarkjs instance');
    
    // Update telemetry
    const telemetryIndex = telemetryData.findIndex(t => t.operationId === operationId);
    if (telemetryIndex >= 0) {
      telemetryData[telemetryIndex].success = true;
      telemetryData[telemetryIndex].endTime = Date.now();
    }
    
    return snarkjsInstance;
  }
  
  // Use mock implementation if requested
  if (useMock) {
    console.log('Using mock snarkjs implementation as requested');
    reportProgress(100, 'Using mock snarkjs implementation');
    snarkjsInstance = createMockSnarkjs();
    initializationStatus = 'success';
    
    // Update telemetry
    const telemetryIndex = telemetryData.findIndex(t => t.operationId === operationId);
    if (telemetryIndex >= 0) {
      telemetryData[telemetryIndex].success = true;
      telemetryData[telemetryIndex].endTime = Date.now();
    }
    
    return snarkjsInstance;
  }
  
  // If initialization is already in progress, wait for it to complete
  if (initializationStatus === 'in-progress') {
    console.log('snarkjs initialization already in progress, waiting...');
    reportProgress(10, 'Waiting for existing initialization to complete');
    
    return new Promise((resolve, reject) => {
      let checkCount = 0;
      const maxChecks = timeout / 100; // Check every 100ms
      
      const checkInterval = setInterval(() => {
        checkCount++;
        const progressPercent = Math.min(10 + Math.floor((checkCount / maxChecks) * 80), 90);
        reportProgress(progressPercent, 'Waiting for initialization to complete');
        
        if (initializationStatus === 'success' && snarkjsInstance) {
          clearInterval(checkInterval);
          clearTimeout(timeoutId);
          reportProgress(100, 'Initialization completed');
          
          // Update telemetry
          const telemetryIndex = telemetryData.findIndex(t => t.operationId === operationId);
          if (telemetryIndex >= 0) {
            telemetryData[telemetryIndex].success = true;
            telemetryData[telemetryIndex].endTime = Date.now();
          }
          
          resolve(snarkjsInstance);
        } else if (initializationStatus === 'failed') {
          clearInterval(checkInterval);
          clearTimeout(timeoutId);
          reportProgress(100, 'Initialization failed, using fallback');
          
          // Update telemetry
          const telemetryIndex = telemetryData.findIndex(t => t.operationId === operationId);
          if (telemetryIndex >= 0) {
            telemetryData[telemetryIndex].success = false;
            telemetryData[telemetryIndex].endTime = Date.now();
            telemetryData[telemetryIndex].errorMessage = initializationError?.message || 'Unknown error';
          }
          
          reject(initializationError || new Error('snarkjs initialization failed'));
        }
      }, 100);
      
      // Set timeout to avoid waiting indefinitely
      const timeoutId = setTimeout(() => {
        clearInterval(checkInterval);
        reportProgress(100, 'Initialization timed out, using fallback');
        
        // Update telemetry
        const telemetryIndex = telemetryData.findIndex(t => t.operationId === operationId);
        if (telemetryIndex >= 0) {
          telemetryData[telemetryIndex].success = false;
          telemetryData[telemetryIndex].endTime = Date.now();
          telemetryData[telemetryIndex].errorMessage = `Initialization timed out after ${timeout}ms`;
        }
        
        reject(new Error(`snarkjs initialization timed out after ${timeout}ms`));
      }, timeout);
    });
  }
  
  initializationStatus = 'in-progress';
  initializationError = null;
  
  reportProgress(0, 'Starting snarkjs initialization');
  
  let attemptCount = 0;
  while (attemptCount < retryAttempts) {
    try {
      attemptCount++;
      reportProgress(5, `Initialization attempt ${attemptCount}/${retryAttempts}`);
      
      // Check if WebAssembly is supported
      reportProgress(10, 'Checking WebAssembly support');
      const wasmSupported = wasmLoader.isWasmSupported();
      if (!wasmSupported) {
        reportProgress(15, 'WebAssembly not supported, using server-side fallback');
        throw new Error('WebAssembly is not supported in this environment. Using server-side fallback.');
      }
      
      // Initialize WebAssembly loader
      reportProgress(20, 'Initializing WebAssembly loader');
      await wasmLoader.initialize();
      
      // Check if client-side processing is recommended
      reportProgress(30, 'Checking device capabilities');
      const clientSideRecommended = wasmLoader.isClientSideRecommended();
      if (!clientSideRecommended) {
        reportProgress(35, 'Device capabilities limited, using server-side fallback');
        throw new Error('Device capabilities suggest server-side processing is preferable.');
      }
      
      // Import snarkjs library
      reportProgress(40, 'Importing snarkjs library');
      const snarkjs = await safeImportSnarkjs();
      
      // Check version compatibility
      reportProgress(60, 'Checking snarkjs version compatibility');
      if (SNARKJS_VERSION.current !== 'unknown') {
        const currentParts = SNARKJS_VERSION.current.split('.').map(Number);
        const requiredParts = SNARKJS_VERSION.required.split('.').map(Number);
        
        const isVersionCompatible = 
          currentParts[0] > requiredParts[0] || 
          (currentParts[0] === requiredParts[0] && currentParts[1] >= requiredParts[1]);
        
        if (!isVersionCompatible) {
          console.warn(`snarkjs version ${SNARKJS_VERSION.current} is below required version ${SNARKJS_VERSION.required}`);
        }
      }
      
      // Modern versions may have an initialize method
      reportProgress(70, 'Initializing snarkjs');
      if (typeof snarkjs.initialize === 'function') {
        console.log('Initializing snarkjs with explicit initialize() method');
        snarkjsInstance = await snarkjs.initialize();
      } else {
        // Older versions or direct import
        snarkjsInstance = snarkjs;
      }
      
      // Verify that essential functionality is available
      reportProgress(80, 'Verifying snarkjs functionality');
      const hasCoreFeatures = 
        snarkjsInstance && 
        snarkjsInstance.groth16 && 
        typeof snarkjsInstance.groth16.fullProve === 'function' &&
        snarkjsInstance.wtns && 
        typeof snarkjsInstance.wtns.calculate === 'function';
      
      if (!hasCoreFeatures) {
        throw new Error('Initialized snarkjs instance is missing required functionality');
      }
      
      // Run a simple proof verification test to ensure full functionality
      reportProgress(90, 'Testing snarkjs functionality');
      const testSucceeded = await testSnarkjsFunctionality(snarkjsInstance);
      if (!testSucceeded) {
        throw new Error('snarkjs functionality test failed');
      }
      
      console.log('snarkjs initialized successfully');
      reportProgress(100, 'snarkjs initialized successfully');
      initializationStatus = 'success';
      
      // Update telemetry with success
      const telemetryIndex = telemetryData.findIndex(t => t.operationId === operationId);
      if (telemetryIndex >= 0) {
        telemetryData[telemetryIndex].success = true;
        telemetryData[telemetryIndex].endTime = Date.now();
        telemetryData[telemetryIndex].performanceMarks = {
          attempts: attemptCount
        };
      }
      
      return snarkjsInstance;
    } catch (error) {
      console.error(`Failed to initialize snarkjs (attempt ${attemptCount}/${retryAttempts}):`, error);
      
      // If this was the last attempt or it's a permanent error, use fallback
      if (attemptCount >= retryAttempts || isPermanentError(error)) {
        initializationStatus = 'failed';
        initializationError = error instanceof Error ? error : new Error(String(error));
        
        // Create server-side fallback implementation
        console.warn('Using server-side fallback for snarkjs functionality');
        reportProgress(95, 'Using server-side fallback');
        snarkjsInstance = createServerSideFallback();
        
        initializationStatus = 'success'; // We're providing a fallback, so it's a success
        reportProgress(100, 'Fallback initialization complete');
        
        // Update telemetry with success (fallback)
        const telemetryIndex = telemetryData.findIndex(t => t.operationId === operationId);
        if (telemetryIndex >= 0) {
          telemetryData[telemetryIndex].success = true; // Fallback succeeded
          telemetryData[telemetryIndex].endTime = Date.now();
          telemetryData[telemetryIndex].performanceMarks = {
            attempts: attemptCount,
            usingFallback: true
          };
        }
        
        return snarkjsInstance;
      }
      
      // Wait a bit before retrying (exponential backoff)
      const retryDelay = Math.min(1000 * Math.pow(2, attemptCount - 1), 5000);
      console.log(`Retrying in ${retryDelay}ms...`);
      reportProgress(10 + (attemptCount * 20), `Retrying in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  // Should never reach here, but TypeScript wants a return
  throw new Error('snarkjs initialization failed after all retry attempts');
}

/**
 * Determines if an error is permanent (no point in retrying)
 * @param error The error to check
 * @returns True if the error is permanent
 */
function isPermanentError(error: any): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Check for permanent error conditions
  const permanentErrors = [
    'WebAssembly is not supported',
    'Missing required functionality',
    'Version incompatible',
    'Invalid module',
    'Device capabilities suggest server-side'
  ];
  
  return permanentErrors.some(msg => errorMessage.includes(msg));
}

/**
 * Tests basic snarkjs functionality to ensure it's working
 * @param snarkjs The snarkjs instance to test
 * @returns True if the test succeeded
 */
async function testSnarkjsFunctionality(snarkjs: any): Promise<boolean> {
  try {
    // Test a very simple operation that should always work
    // For example, check if verify function works with a simple input
    const mockValidResult = await snarkjs.groth16.verify(
      { protocol: 'groth16' }, // Mock verification key
      ['1', '2'], // Mock public signals
      { pi_a: ['1', '2', '3'], pi_b: [['1', '2'], ['3', '4']], pi_c: ['5', '6', '7'] } // Mock proof
    );
    
    // This should return false since our mock input is invalid,
    // but the important part is that it runs without errors
    return typeof mockValidResult === 'boolean';
  } catch (error) {
    console.error('snarkjs functionality test failed:', error);
    return false;
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
 * This routes requests to a server API endpoint with retry and telemetry
 * @returns A server-side fallback implementation
 */
export function createServerSideFallback() {
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
    const progress = createProgressReporter(`server-${operation}`);
    
    progress.reportProgress('start', 0, 'Starting server request');
    
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
        progress.reportProgress(
          'request', 
          10 + (attempt / retryAttempts) * 30, 
          `Sending request (attempt ${attempt}/${retryAttempts})`
        );
        
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
        
        progress.reportProgress('processing', 70, 'Processing server response');
        
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
        
        progress.reportProgress('complete', 100, 'Server request completed successfully');
        progress.complete(result);
        
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
          
          progress.reportError('request', lastError);
          throw lastError;
        }
        
        // Wait with exponential backoff before retrying
        const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        progress.reportProgress(
          'backoff', 
          40 + (attempt / retryAttempts) * 20, 
          `Retrying in ${backoffTime}ms...`
        );
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
    useMock?: boolean,
    onProgress?: (progress: number, status: string) => void,
    retryAttempts?: number
  } = {}): Promise<boolean> {
    try {
      await initializeSnarkJS(options);
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