/**
 * @fileoverview Health check system for monitoring deployment status
 */

import { EnvironmentType, DeploymentConfig } from './DeploymentConfig';

/**
 * Status of a health check
 */
export type HealthCheckStatus = 'ok' | 'warning' | 'error' | 'unknown';

/**
 * Result of an individual health check
 */
export interface HealthCheckItemResult {
  /** Name of the check */
  name: string;
  /** Status of the check */
  status: HealthCheckStatus;
  /** Message describing the result */
  message: string;
  /** Timestamp when the check was performed */
  timestamp: number;
  /** Duration of the check in milliseconds */
  durationMs?: number;
  /** Arbitrary metadata about the check */
  metadata?: Record<string, any>;
}

/**
 * Results of a health check run
 */
export interface HealthCheckResult {
  /** Overall status (worst of all checks) */
  status: HealthCheckStatus;
  /** Individual check results */
  checks: Record<string, HealthCheckItemResult>;
  /** Timestamp when the check was performed */
  timestamp: number;
  /** Duration of the entire health check in milliseconds */
  durationMs?: number;
}

/**
 * Manages health checks for the deployment
 */
export class HealthCheck {
  private readonly environment: EnvironmentType;
  private config: DeploymentConfig;
  
  /**
   * Create a new HealthCheck
   */
  constructor(environment: EnvironmentType, config: DeploymentConfig) {
    this.environment = environment;
    this.config = config;
  }
  
  /**
   * Run all health checks
   */
  public async runChecks(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: Record<string, HealthCheckItemResult> = {};
    
    // Run environment-specific checks
    switch (this.environment) {
      case EnvironmentType.Browser:
        Object.assign(checks, await this.runBrowserChecks());
        break;
      case EnvironmentType.Node:
        Object.assign(checks, await this.runNodeChecks());
        break;
      case EnvironmentType.Mobile:
        Object.assign(checks, await this.runMobileChecks());
        break;
      case EnvironmentType.Worker:
        Object.assign(checks, await this.runWorkerChecks());
        break;
    }
    
    // Run common checks for all environments
    Object.assign(checks, await this.runCommonChecks());
    
    // Calculate overall status
    const status = this.calculateOverallStatus(checks);
    
    // Calculate total duration
    const durationMs = Date.now() - startTime;
    
    return {
      status,
      checks,
      timestamp: Date.now(),
      durationMs
    };
  }
  
  /**
   * Update configuration
   */
  public updateConfig(config: DeploymentConfig): void {
    this.config = config;
  }
  
  /**
   * Run checks for browser environment
   */
  private async runBrowserChecks(): Promise<Record<string, HealthCheckItemResult>> {
    const checks: Record<string, HealthCheckItemResult> = {};
    
    // Check for WebAssembly support
    checks.webAssembly = await this.runCheck('WebAssembly', async () => {
      if (typeof WebAssembly === 'undefined') {
        return {
          status: 'error',
          message: 'WebAssembly is not supported in this browser'
        };
      }
      
      try {
        // Try to compile a simple module
        const module = await WebAssembly.compile(new Uint8Array([
          0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00
        ]));
        
        return {
          status: 'ok',
          message: 'WebAssembly is supported',
          metadata: { module: !!module }
        };
      } catch (error) {
        return {
          status: 'error',
          message: `WebAssembly compilation failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    });
    
    // Check for Web Workers if enabled
    if (this.config.workerThreads > 0) {
      checks.webWorkers = await this.runCheck('Web Workers', async () => {
        if (typeof Worker === 'undefined') {
          return {
            status: 'error',
            message: 'Web Workers are not supported in this browser'
          };
        }
        
        try {
          // Create a simple worker to test functionality
          const workerBlob = new Blob([
            'self.addEventListener("message", e => self.postMessage({ received: e.data, result: "ok" }));'
          ], { type: 'application/javascript' });
          
          const workerUrl = URL.createObjectURL(workerBlob);
          const worker = new Worker(workerUrl);
          
          const response = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              worker.terminate();
              reject(new Error('Worker response timeout'));
            }, 2000);
            
            worker.onmessage = e => {
              clearTimeout(timeout);
              resolve(e.data);
              worker.terminate();
              URL.revokeObjectURL(workerUrl);
            };
            
            worker.onerror = err => {
              clearTimeout(timeout);
              reject(err);
              worker.terminate();
              URL.revokeObjectURL(workerUrl);
            };
            
            worker.postMessage('test');
          });
          
          return {
            status: 'ok',
            message: 'Web Workers are functioning correctly',
            metadata: { response }
          };
        } catch (error) {
          return {
            status: this.config.workerThreads > 0 ? 'error' : 'warning',
            message: `Web Worker test failed: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      });
    }
    
    // Check for IndexedDB if local cache is enabled
    if (this.config.useLocalCache) {
      checks.indexedDB = await this.runCheck('IndexedDB', async () => {
        if (typeof indexedDB === 'undefined') {
          return {
            status: this.config.useLocalCache ? 'error' : 'warning',
            message: 'IndexedDB is not supported in this browser'
          };
        }
        
        try {
          const dbName = 'health_check_test_db';
          const storeName = 'health_check_test_store';
          
          // Open a test database
          const request = indexedDB.open(dbName, 1);
          
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            request.onerror = () => reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
            
            request.onupgradeneeded = () => {
              const db = request.result;
              db.createObjectStore(storeName, { keyPath: 'id' });
            };
            
            request.onsuccess = () => resolve(request.result);
          });
          
          // Test write operation
          const transaction = db.transaction(storeName, 'readwrite');
          const store = transaction.objectStore(storeName);
          
          await new Promise<void>((resolve, reject) => {
            const testData = { id: 1, value: 'test' };
            const addRequest = store.add(testData);
            
            addRequest.onerror = () => reject(new Error(`Failed to write to IndexedDB: ${addRequest.error?.message}`));
            addRequest.onsuccess = () => resolve();
          });
          
          // Test read operation
          const readTransaction = db.transaction(storeName, 'readonly');
          const readStore = readTransaction.objectStore(storeName);
          
          const readResult = await new Promise<any>((resolve, reject) => {
            const getRequest = readStore.get(1);
            
            getRequest.onerror = () => reject(new Error(`Failed to read from IndexedDB: ${getRequest.error?.message}`));
            getRequest.onsuccess = () => resolve(getRequest.result);
          });
          
          // Clean up
          db.close();
          indexedDB.deleteDatabase(dbName);
          
          return {
            status: 'ok',
            message: 'IndexedDB is functioning correctly',
            metadata: { readResult }
          };
        } catch (error) {
          return {
            status: this.config.useLocalCache ? 'error' : 'warning',
            message: `IndexedDB test failed: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      });
    }
    
    // Check for localStorage
    checks.localStorage = await this.runCheck('Local Storage', async () => {
      if (typeof localStorage === 'undefined') {
        return {
          status: 'warning',
          message: 'localStorage is not supported in this browser'
        };
      }
      
      try {
        const testKey = 'zkp_health_check_test';
        const testValue = Date.now().toString();
        
        localStorage.setItem(testKey, testValue);
        const storedValue = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        
        if (storedValue !== testValue) {
          return {
            status: 'warning',
            message: 'localStorage is not functioning correctly'
          };
        }
        
        return {
          status: 'ok',
          message: 'localStorage is functioning correctly'
        };
      } catch (error) {
        return {
          status: 'warning',
          message: `localStorage test failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    });
    
    // Network status check
    checks.network = await this.runCheck('Network Status', async () => {
      if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
        const online = navigator.onLine;
        
        if (!online && !this.config.offlineSupport) {
          return {
            status: 'error',
            message: 'Network is offline and offline support is disabled'
          };
        }
        
        if (!online && this.config.offlineSupport) {
          return {
            status: 'warning',
            message: 'Network is offline, running in offline mode'
          };
        }
        
        return {
          status: 'ok',
          message: 'Network is online'
        };
      }
      
      // Can't detect, assume ok
      return {
        status: 'ok',
        message: 'Network status could not be determined'
      };
    });
    
    return checks;
  }
  
  /**
   * Run checks for Node.js environment
   */
  private async runNodeChecks(): Promise<Record<string, HealthCheckItemResult>> {
    const checks: Record<string, HealthCheckItemResult> = {};
    
    // Memory usage check
    checks.memory = await this.runCheck('Memory Usage', async () => {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memoryUsage = process.memoryUsage();
        const usedMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        const totalMb = Math.round(memoryUsage.heapTotal / 1024 / 1024);
        const memoryLimit = this.config.memoryLimit;
        
        if (usedMb > memoryLimit * 0.9) {
          return {
            status: 'error',
            message: `Memory usage is critical: ${usedMb}MB used of ${totalMb}MB total (${memoryLimit}MB limit)`,
            metadata: { memoryUsage }
          };
        }
        
        if (usedMb > memoryLimit * 0.7) {
          return {
            status: 'warning',
            message: `Memory usage is high: ${usedMb}MB used of ${totalMb}MB total (${memoryLimit}MB limit)`,
            metadata: { memoryUsage }
          };
        }
        
        return {
          status: 'ok',
          message: `Memory usage is normal: ${usedMb}MB used of ${totalMb}MB total (${memoryLimit}MB limit)`,
          metadata: { memoryUsage }
        };
      }
      
      return {
        status: 'unknown',
        message: 'Memory usage could not be determined'
      };
    });
    
    return checks;
  }
  
  /**
   * Run checks for mobile environment
   */
  private async runMobileChecks(): Promise<Record<string, HealthCheckItemResult>> {
    const checks: Record<string, HealthCheckItemResult> = {};
    
    // Most of the mobile checks are the same as browser
    Object.assign(checks, await this.runBrowserChecks());
    
    // Battery status check
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      checks.battery = await this.runCheck('Battery Status', async () => {
        try {
          // @ts-ignore - navigator.getBattery() is not standard
          const battery = await navigator.getBattery();
          
          if (battery.charging === false && battery.level < 0.15) {
            return {
              status: 'warning',
              message: `Battery level is low: ${Math.round(battery.level * 100)}% and not charging`,
              metadata: {
                level: battery.level,
                charging: battery.charging
              }
            };
          }
          
          return {
            status: 'ok',
            message: `Battery level: ${Math.round(battery.level * 100)}%${battery.charging ? ' (charging)' : ''}`,
            metadata: {
              level: battery.level,
              charging: battery.charging
            }
          };
        } catch (error) {
          return {
            status: 'unknown',
            message: `Battery status check failed: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      });
    }
    
    return checks;
  }
  
  /**
   * Run checks for worker environment
   */
  private async runWorkerChecks(): Promise<Record<string, HealthCheckItemResult>> {
    const checks: Record<string, HealthCheckItemResult> = {};
    
    // Worker-specific checks
    checks.workerContext = await this.runCheck('Worker Context', async () => {
      if (typeof self !== 'undefined' && 
          typeof window === 'undefined' && 
          self.constructor && 
          self.constructor.name === 'DedicatedWorkerGlobalScope') {
        return {
          status: 'ok',
          message: 'Running in a proper worker context'
        };
      }
      
      return {
        status: 'error',
        message: 'Not running in a proper worker context'
      };
    });
    
    return checks;
  }
  
  /**
   * Run common checks for all environments
   */
  private async runCommonChecks(): Promise<Record<string, HealthCheckItemResult>> {
    const checks: Record<string, HealthCheckItemResult> = {};
    
    // Performance check with a simple ZKP-like operation
    checks.performance = await this.runCheck('Performance', async () => {
      // Simulate a ZKP-like operation with matrix multiplications
      const startTime = Date.now();
      const size = 100; // Size of matrices
      
      // Create matrices
      const matrix1 = new Array(size).fill(0).map(() => new Array(size).fill(0).map(() => Math.random()));
      const matrix2 = new Array(size).fill(0).map(() => new Array(size).fill(0).map(() => Math.random()));
      
      // Multiply matrices
      const result = new Array(size).fill(0).map(() => new Array(size).fill(0));
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          for (let k = 0; k < size; k++) {
            result[i][j] += matrix1[i][k] * matrix2[k][j];
          }
        }
      }
      
      const timeTaken = Date.now() - startTime;
      
      // Evaluate performance - this is a basic synthetic benchmark
      // Adjust thresholds based on expected performance
      if (timeTaken > 2000) {
        return {
          status: 'warning',
          message: `Performance benchmark took ${timeTaken}ms, which is slower than expected`,
          metadata: { timeTaken, operationsPerSecond: size * size * size / (timeTaken / 1000) }
        };
      }
      
      return {
        status: 'ok',
        message: `Performance benchmark completed in ${timeTaken}ms`,
        metadata: { timeTaken, operationsPerSecond: size * size * size / (timeTaken / 1000) }
      };
    });
    
    return checks;
  }
  
  /**
   * Helper method to run an individual check with timing
   */
  private async runCheck(
    name: string, 
    checkFn: () => Promise<{ status: HealthCheckStatus; message: string; metadata?: Record<string, any> }>
  ): Promise<HealthCheckItemResult> {
    const startTime = Date.now();
    
    try {
      const result = await checkFn();
      const durationMs = Date.now() - startTime;
      
      return {
        name,
        status: result.status,
        message: result.message,
        timestamp: Date.now(),
        durationMs,
        metadata: result.metadata
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      return {
        name,
        status: 'error',
        message: `Check failed with error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
        durationMs
      };
    }
  }
  
  /**
   * Calculate overall status from individual check results
   */
  private calculateOverallStatus(checks: Record<string, HealthCheckItemResult>): HealthCheckStatus {
    if (Object.keys(checks).length === 0) {
      return 'unknown';
    }
    
    // If any check has error status, overall status is error
    if (Object.values(checks).some(check => check.status === 'error')) {
      return 'error';
    }
    
    // If any check has warning status, overall status is warning
    if (Object.values(checks).some(check => check.status === 'warning')) {
      return 'warning';
    }
    
    // If any check has unknown status and no errors/warnings, overall status is unknown
    if (Object.values(checks).some(check => check.status === 'unknown')) {
      return 'unknown';
    }
    
    // If all checks are ok, overall status is ok
    return 'ok';
  }
}