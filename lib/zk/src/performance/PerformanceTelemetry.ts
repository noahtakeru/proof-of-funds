/**
 * @fileoverview Performance telemetry for collecting and analyzing metrics
 * 
 * This module provides tools for collecting, analyzing, and reporting 
 * performance metrics for zero-knowledge proof operations.
 */

import { BenchmarkResult, BenchmarkOperationType } from './BenchmarkingSystem';

/**
 * Type of telemetry event
 */
export enum TelemetryEventType {
  /** Performance benchmark result */
  Benchmark = 'benchmark',
  /** Proof generation metrics */
  ProofGeneration = 'proof_generation',
  /** Proof verification metrics */
  ProofVerification = 'proof_verification',
  /** Memory usage metrics */
  MemoryUsage = 'memory_usage',
  /** Error event */
  Error = 'error',
  /** Cache performance metrics */
  Cache = 'cache',
  /** Custom event */
  Custom = 'custom'
}

/**
 * Performance telemetry data point
 */
export interface TelemetryDataPoint {
  /** Type of event */
  type: TelemetryEventType;
  /** Name of the event */
  name: string;
  /** Timestamp when the event occurred */
  timestamp: number;
  /** Duration in milliseconds (if applicable) */
  durationMs?: number;
  /** Memory usage in bytes (if applicable) */
  memoryBytes?: number;
  /** Success flag (if applicable) */
  success?: boolean;
  /** Error message (if applicable) */
  error?: string;
  /** Additional data */
  data?: Record<string, any>;
}

/**
 * Configuration for performance telemetry
 */
export interface TelemetryConfig {
  /** Whether telemetry is enabled */
  enabled: boolean;
  /** Endpoint for reporting telemetry data */
  endpoint?: string;
  /** Maximum number of events to store in memory */
  maxEvents: number;
  /** Batch size for sending telemetry data */
  batchSize: number;
  /** Whether to include user context data */
  includeUserContext: boolean;
  /** Whether to include environment information */
  includeEnvironment: boolean;
  /** Sampling rate (0-1, 1 means collect all events) */
  samplingRate: number;
  /** Additional context to include with all events */
  globalContext?: Record<string, any>;
}

/**
 * Context information about the user environment
 */
interface EnvironmentContext {
  /** User agent string */
  userAgent?: string;
  /** Platform information */
  platform?: string;
  /** Browser information */
  browser?: string;
  /** Device information */
  device?: string;
  /** Screen dimensions */
  screen?: { width: number; height: number };
  /** Language setting */
  language?: string;
  /** Network information */
  network?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
  /** CPU information */
  cpu?: {
    cores?: number;
    architecture?: string;
  };
  /** Memory information */
  memory?: {
    totalJSHeapSize?: number;
    usedJSHeapSize?: number;
    jsHeapSizeLimit?: number;
  };
  /** Timestamp when context was collected */
  timestamp: number;
}

/**
 * Manages performance telemetry collection and reporting
 */
export class PerformanceTelemetry {
  private config: TelemetryConfig;
  private events: TelemetryDataPoint[] = [];
  private environmentContext?: EnvironmentContext;
  private flushPromise: Promise<void> | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  
  /**
   * Create a new performance telemetry instance
   */
  constructor(config?: Partial<TelemetryConfig>) {
    // Default configuration
    this.config = {
      enabled: true,
      maxEvents: 1000,
      batchSize: 50,
      includeUserContext: false,
      includeEnvironment: true,
      samplingRate: 1.0
    };
    
    // Apply custom configuration
    if (config) {
      this.config = {
        ...this.config,
        ...config
      };
    }
    
    // Initialize environment context if enabled
    if (this.config.includeEnvironment) {
      this.environmentContext = this.collectEnvironmentContext();
    }
  }
  
  /**
   * Record a performance telemetry event
   */
  public recordEvent(event: Omit<TelemetryDataPoint, 'timestamp'>): void {
    if (!this.config.enabled) {
      return;
    }
    
    // Apply sampling rate
    if (Math.random() > this.config.samplingRate) {
      return;
    }
    
    // Create full event with timestamp
    const fullEvent: TelemetryDataPoint = {
      ...event,
      timestamp: Date.now()
    };
    
    // Add to events array
    this.events.push(fullEvent);
    
    // Enforce max events limit
    if (this.events.length > this.config.maxEvents) {
      this.events = this.events.slice(-this.config.maxEvents);
    }
    
    // Schedule a flush if endpoint is configured
    if (this.config.endpoint && !this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flush();
      }, 5000); // Flush after 5 seconds of inactivity
    }
  }
  
  /**
   * Record proof generation metrics
   */
  public recordProofGeneration(
    proofType: string,
    durationMs: number,
    memoryBytes?: number,
    success: boolean = true,
    error?: string,
    additionalData?: Record<string, any>
  ): void {
    this.recordEvent({
      type: TelemetryEventType.ProofGeneration,
      name: `generate_${proofType}`,
      durationMs,
      memoryBytes,
      success,
      error,
      data: additionalData
    });
  }
  
  /**
   * Record proof verification metrics
   */
  public recordProofVerification(
    proofType: string,
    durationMs: number,
    success: boolean = true,
    error?: string,
    additionalData?: Record<string, any>
  ): void {
    this.recordEvent({
      type: TelemetryEventType.ProofVerification,
      name: `verify_${proofType}`,
      durationMs,
      success,
      error,
      data: additionalData
    });
  }
  
  /**
   * Record memory usage metrics
   */
  public recordMemoryUsage(
    memoryBytes: number,
    context: string,
    additionalData?: Record<string, any>
  ): void {
    this.recordEvent({
      type: TelemetryEventType.MemoryUsage,
      name: `memory_${context}`,
      memoryBytes,
      data: additionalData
    });
  }
  
  /**
   * Record an error event
   */
  public recordError(
    errorType: string,
    error: Error | string,
    additionalData?: Record<string, any>
  ): void {
    const errorMessage = error instanceof Error ? error.message : error;
    
    this.recordEvent({
      type: TelemetryEventType.Error,
      name: `error_${errorType}`,
      success: false,
      error: errorMessage,
      data: {
        ...additionalData,
        stack: error instanceof Error ? error.stack : undefined
      }
    });
  }
  
  /**
   * Record cache performance metrics
   */
  public recordCachePerformance(
    cacheType: string,
    hits: number,
    misses: number,
    totalEntries: number,
    additionalData?: Record<string, any>
  ): void {
    this.recordEvent({
      type: TelemetryEventType.Cache,
      name: `cache_${cacheType}`,
      data: {
        hits,
        misses,
        hitRate: hits + misses > 0 ? hits / (hits + misses) : 0,
        totalEntries,
        ...additionalData
      }
    });
  }
  
  /**
   * Record a custom event
   */
  public recordCustomEvent(
    name: string,
    data: Record<string, any>,
    durationMs?: number
  ): void {
    this.recordEvent({
      type: TelemetryEventType.Custom,
      name,
      durationMs,
      data
    });
  }
  
  /**
   * Report a benchmark result as telemetry
   */
  public reportBenchmarkResult(result: BenchmarkResult): void {
    // Convert benchmark result to telemetry event
    this.recordEvent({
      type: TelemetryEventType.Benchmark,
      name: `benchmark_${result.name}`,
      durationMs: result.meanDurationMs,
      data: {
        operationType: result.type,
        medianDurationMs: result.medianDurationMs,
        minDurationMs: result.minDurationMs,
        maxDurationMs: result.maxDurationMs,
        p95DurationMs: result.p95DurationMs,
        stdDevDurationMs: result.stdDevDurationMs,
        iterations: result.iterations,
        opsPerSecond: result.opsPerSecond,
        totalDurationMs: result.totalDurationMs,
        ...(result.meanMemoryBytes !== undefined ? { meanMemoryBytes: result.meanMemoryBytes } : {}),
        context: result.context
      }
    });
  }
  
  /**
   * Measure the duration of a function and record it as telemetry
   * 
   * @param type The type of telemetry event
   * @param name The name of the event
   * @param fn The function to measure
   * @param additionalData Additional data to include in the event
   * @returns The result of the function
   */
  public async measure<T>(
    type: TelemetryEventType,
    name: string,
    fn: () => Promise<T>,
    additionalData?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    let error: Error | undefined;
    
    try {
      const result = await fn();
      success = true;
      return result;
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
      throw e;
    } finally {
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      
      this.recordEvent({
        type,
        name,
        durationMs,
        success,
        error: error?.message,
        data: {
          ...additionalData,
          stack: error?.stack
        }
      });
    }
  }
  
  /**
   * Get all collected events
   */
  public getEvents(): TelemetryDataPoint[] {
    return [...this.events];
  }
  
  /**
   * Get environment context information
   */
  public getEnvironmentContext(): EnvironmentContext | undefined {
    return this.environmentContext;
  }
  
  /**
   * Clear all collected events
   */
  public clearEvents(): void {
    this.events = [];
  }
  
  /**
   * Flush events to the configured endpoint
   */
  public async flush(): Promise<void> {
    if (!this.config.enabled || !this.config.endpoint || this.events.length === 0) {
      return;
    }
    
    // If a flush is already in progress, wait for it to complete
    if (this.flushPromise) {
      return this.flushPromise;
    }
    
    // Set up a new flush promise
    this.flushPromise = this.doFlush();
    
    try {
      await this.flushPromise;
    } finally {
      this.flushPromise = null;
    }
  }
  
  /**
   * Internal method to actually perform the flush
   */
  private async doFlush(): Promise<void> {
    if (!this.config.endpoint) {
      return;
    }
    
    // Clone events to avoid modification during sending
    const eventsToSend = [...this.events];
    
    if (eventsToSend.length === 0) {
      return;
    }
    
    // Create payload with context information
    const payload = {
      appVersion: this.getAppVersion(),
      timestamp: Date.now(),
      batchId: this.generateBatchId(),
      environment: this.config.includeEnvironment ? this.environmentContext : undefined,
      context: this.config.globalContext,
      events: eventsToSend
    };
    
    try {
      // Send to endpoint in batches if needed
      const batches = this.splitIntoBatches(eventsToSend, this.config.batchSize);
      
      for (const batch of batches) {
        const batchPayload = {
          ...payload,
          events: batch
        };
        
        await this.sendToEndpoint(this.config.endpoint, batchPayload);
        
        // Remove sent events from the events array
        const sentEventIds = new Set(batch.map(e => `${e.type}:${e.name}:${e.timestamp}`));
        this.events = this.events.filter(e => {
          const eventId = `${e.type}:${e.name}:${e.timestamp}`;
          return !sentEventIds.has(eventId);
        });
      }
    } catch (error) {
      console.error('Failed to send telemetry data:', error);
    }
  }
  
  /**
   * Send telemetry data to the endpoint
   */
  private async sendToEndpoint(endpoint: string, payload: any): Promise<void> {
    try {
      // Use fetch API if available (browser)
      if (typeof fetch === 'function') {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
      } 
      // Use Node.js http/https modules as fallback
      else if (typeof require === 'function') {
        const isHttps = endpoint.startsWith('https:');
        const httpModule = isHttps ? require('https') : require('http');
        const url = new URL(endpoint);
        
        await new Promise<void>((resolve, reject) => {
          const requestOptions = {
            method: 'POST',
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': JSON.stringify(payload).length
            }
          };
          
          const req = httpModule.request(requestOptions, (res: any) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(`HTTP error ${res.statusCode}: ${res.statusMessage}`));
              return;
            }
            
            resolve();
          });
          
          req.on('error', reject);
          req.write(JSON.stringify(payload));
          req.end();
        });
      } else {
        throw new Error('No HTTP client available');
      }
    } catch (error) {
      console.error('Failed to send telemetry data:', error);
    }
  }
  
  /**
   * Collect information about the environment
   */
  private collectEnvironmentContext(): EnvironmentContext {
    const context: EnvironmentContext = {
      timestamp: Date.now()
    };
    
    // Browser environment
    if (typeof navigator !== 'undefined') {
      context.userAgent = navigator.userAgent;
      context.platform = navigator.platform;
      context.language = navigator.language;
      
      if (typeof screen !== 'undefined') {
        context.screen = {
          width: screen.width,
          height: screen.height
        };
      }
      
      // @ts-ignore - Connection API not standard
      if (navigator.connection) {
        context.network = {
          // @ts-ignore - Connection API not standard
          effectiveType: navigator.connection.effectiveType,
          // @ts-ignore - Connection API not standard
          downlink: navigator.connection.downlink,
          // @ts-ignore - Connection API not standard
          rtt: navigator.connection.rtt
        };
      }
      
      if (typeof navigator.hardwareConcurrency !== 'undefined') {
        context.cpu = {
          cores: navigator.hardwareConcurrency
        };
      }
      
      // @ts-ignore - Memory API not standard
      if (typeof performance !== 'undefined' && performance.memory) {
        context.memory = {
          // @ts-ignore - Memory API not standard
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          // @ts-ignore - Memory API not standard
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          // @ts-ignore - Memory API not standard
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
    }
    // Node.js environment
    else if (typeof process !== 'undefined' && process.version) {
      context.platform = `Node.js ${process.version}`;
      
      try {
        const os = require('os');
        context.cpu = {
          cores: os.cpus().length,
          architecture: os.arch()
        };
        
        const memory = process.memoryUsage();
        context.memory = {
          totalJSHeapSize: memory.heapTotal,
          usedJSHeapSize: memory.heapUsed,
          jsHeapSizeLimit: os.totalmem()
        };
      } catch (e) {
        // Ignore if modules not available
      }
    }
    
    return context;
  }
  
  /**
   * Get the application version
   */
  private getAppVersion(): string {
    try {
      if (typeof process !== 'undefined' && process.env && process.env.npm_package_version) {
        return process.env.npm_package_version;
      }
      
      return 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }
  
  /**
   * Generate a unique batch ID
   */
  private generateBatchId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
  
  /**
   * Split an array into batches of a specified size
   */
  private splitIntoBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    
    return batches;
  }
}