/**
 * @fileoverview Deployment strategy selector for cross-platform deployments
 * 
 * This module provides functionality to select the optimal deployment strategy
 * based on the detected environment, available resources, and configuration.
 */

import { EnvironmentType, DeploymentConfig } from './DeploymentConfig';
import { PlatformAdapterFactory, PlatformAdapter } from './PlatformAdapterFactory';
import { EnvironmentDetector } from './EnvironmentDetector';

/**
 * Types of deployment strategies that can be selected
 */
export enum DeploymentStrategyType {
    /** Automatically determine the best strategy based on environment and capabilities */
    AUTOMATIC = 'automatic',

    /** Execute all operations locally without server assistance */
    FullLocal = 'full_local',

    /** Split operations between local and server execution */
    Hybrid = 'hybrid',

    /** Offload all operations to the server */
    ServerSide = 'server_side',

    /** Optimize for low-resource environments */
    LowResource = 'low_resource',

    /** Optimize for high-performance environments */
    HighPerformance = 'high_performance'
}

/**
 * Platform-specific optimizations that can be applied
 */
export interface PlatformOptimizations {
    /** Use shared memory when available */
    useSharedMemory?: boolean;

    /** Reduce quality of operations to improve performance */
    reduceQuality?: boolean;

    /** Minimize memory usage at the cost of performance */
    minimizeMemoryUsage?: boolean;

    /** Disable parallelism to reduce resource usage */
    disableParallelism?: boolean;

    /** Maximize parallelism for better performance */
    maximizeParallelism?: boolean;

    /** Precompute values to improve performance */
    precomputeValues?: boolean;

    /** Custom optimizations for specific platforms */
    [key: string]: any;
}

/**
 * Deployment strategy configuration
 */
export interface DeploymentStrategy {
    /** The type of strategy */
    type: DeploymentStrategyType;

    /** Whether to use worker threads for parallel processing */
    useWorkerThreads: boolean;

    /** Number of worker threads to use */
    workerThreadCount: number;

    /** Whether to use WebAssembly for improved performance */
    useWebAssembly: boolean;

    /** Whether to use local caching */
    useLocalCache: boolean;

    /** Whether to offload operations to the server */
    offloadToServer: boolean;

    /** Percentage of operations to offload to the server (0-100) */
    serverOffloadPercentage: number;

    /** Memory limit in MB */
    memoryLimitMB: number;

    /** Whether to enable compression for transfers */
    enableCompression: boolean;

    /** Whether to aggressively clean up resources */
    aggressiveCleanup: boolean;

    /** Platform-specific optimizations */
    platformOptimizations: PlatformOptimizations;
}

/**
 * Default deployment strategies for different environments
 */
const DEFAULT_STRATEGIES: Record<DeploymentStrategyType, DeploymentStrategy> = {
  [DeploymentStrategyType.AUTOMATIC]: {
    type: DeploymentStrategyType.AUTOMATIC,
    useWorkerThreads: true,
    workerThreadCount: 2,
    useWebAssembly: true,
    useLocalCache: true,
    offloadToServer: true,
    serverOffloadPercentage: 30,
    memoryLimitMB: 512,
    enableCompression: true,
    aggressiveCleanup: false,
    platformOptimizations: {}
  },
  [DeploymentStrategyType.FullLocal]: {
    type: DeploymentStrategyType.FullLocal,
    useWorkerThreads: true,
    workerThreadCount: 2,
    useWebAssembly: true,
    useLocalCache: true,
    offloadToServer: false,
    serverOffloadPercentage: 0,
    memoryLimitMB: 1024,
    enableCompression: true,
    aggressiveCleanup: false,
    platformOptimizations: {}
  },
  [DeploymentStrategyType.Hybrid]: {
    type: DeploymentStrategyType.Hybrid,
    useWorkerThreads: true,
    workerThreadCount: 1,
    useWebAssembly: true,
    useLocalCache: true,
    offloadToServer: true,
    serverOffloadPercentage: 50,
    memoryLimitMB: 512,
    enableCompression: true,
    aggressiveCleanup: false,
    platformOptimizations: {}
  },
  [DeploymentStrategyType.ServerSide]: {
    type: DeploymentStrategyType.ServerSide,
    useWorkerThreads: false,
    workerThreadCount: 0,
    useWebAssembly: false,
    useLocalCache: true,
    offloadToServer: true,
    serverOffloadPercentage: 100,
    memoryLimitMB: 256,
    enableCompression: true,
    aggressiveCleanup: true,
    platformOptimizations: {}
  },
  [DeploymentStrategyType.LowResource]: {
    type: DeploymentStrategyType.LowResource,
    useWorkerThreads: false,
    workerThreadCount: 0,
    useWebAssembly: true,
    useLocalCache: false,
    offloadToServer: true,
    serverOffloadPercentage: 80,
    memoryLimitMB: 256,
    enableCompression: true,
    aggressiveCleanup: true,
    platformOptimizations: {
      reduceQuality: true,
      minimizeMemoryUsage: true,
      disableParallelism: true
    }
  },
  [DeploymentStrategyType.HighPerformance]: {
    type: DeploymentStrategyType.HighPerformance,
    useWorkerThreads: true,
    workerThreadCount: 4,
    useWebAssembly: true,
    useLocalCache: true,
    offloadToServer: false,
    serverOffloadPercentage: 0,
    memoryLimitMB: 2048,
    enableCompression: false,
    aggressiveCleanup: false,
    platformOptimizations: {
      useSharedMemory: true,
      maximizeParallelism: true,
      precomputeValues: true
    }
  }
};

/**
 * Selects and configures optimal deployment strategies
 */
export class DeploymentStrategySelector {
  private platformAdapter: PlatformAdapter;
  private detector: EnvironmentDetector;
  private activeStrategy: DeploymentStrategy | null = null;
  private environmentType: EnvironmentType;

  /**
   * Create a new DeploymentStrategySelector
   * @param environmentType Optional environment type to use for strategy selection
   */
  constructor(environmentType?: EnvironmentType) {
    this.detector = new EnvironmentDetector();
    this.environmentType = environmentType || this.detector.detectEnvironment();
    this.platformAdapter = PlatformAdapterFactory.getInstance().getPlatformAdapter();
  }

  /**
   * Initialize the strategy selector and platform adapter
   */
  public async initialize(): Promise<boolean> {
    try {
      await this.platformAdapter.initialize();
      return true;
    } catch (error) {
      console.error('Failed to initialize deployment strategy selector:', error);
      return false;
    }
  }

  /**
   * Select the optimal deployment strategy based on environment and config
   */
  public selectStrategy(config: DeploymentConfig): DeploymentStrategy {
    const environment = this.detector.detectEnvironment();
    const features = this.detector.detectFeatures();

    // Determine base strategy type based on environment and capabilities
    let baseStrategyType: DeploymentStrategyType;

    if (!features.supportsWebAssembly) {
      // If WebAssembly is not supported, offload to server
      baseStrategyType = DeploymentStrategyType.ServerSide;
    } else if (features.isHighEndDevice) {
      // High-end device can handle full local processing
      baseStrategyType = DeploymentStrategyType.HighPerformance;
    } else if (environment === EnvironmentType.Mobile) {
      // Mobile devices typically benefit from hybrid approach
      baseStrategyType = DeploymentStrategyType.Hybrid;
    } else if (environment === EnvironmentType.Browser && !features.supportsWebWorkers) {
      // Browser without worker support should use low resource strategy
      baseStrategyType = DeploymentStrategyType.LowResource;
    } else if (environment === EnvironmentType.Node) {
      // Node.js environment typically has good resources
      baseStrategyType = DeploymentStrategyType.FullLocal;

      // Check if running in test environment (special case for tests)
      if (typeof process !== 'undefined' &&
        process.env &&
        (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID)) {
        // Always use FullLocal in tests unless explicitly overridden
        baseStrategyType = DeploymentStrategyType.FullLocal;
      }
    } else {
      // Default to hybrid approach for other cases
      baseStrategyType = DeploymentStrategyType.Hybrid;
    }

    // Get the base strategy
    const baseStrategy = { ...DEFAULT_STRATEGIES[baseStrategyType] };

    // Customize strategy based on detected capabilities
    this.customizeStrategyForEnvironment(baseStrategy, environment, features);

    // Apply any configuration overrides
    this.applyConfigOverrides(baseStrategy, config);

    // Store as active strategy
    this.activeStrategy = baseStrategy;

    return baseStrategy;
  }

  /**
   * Get the current active strategy
   */
  public getActiveStrategy(): DeploymentStrategy | null {
    return this.activeStrategy;
  }

  /**
   * Switch to a different deployment strategy
   */
  public switchStrategy(strategyType: DeploymentStrategyType, customizations?: Partial<DeploymentStrategy>): DeploymentStrategy {
    // Verify the strategy type exists
    if (!DEFAULT_STRATEGIES[strategyType]) {
      console.warn(`Unknown strategy type: ${strategyType}, falling back to FullLocal`);
      strategyType = DeploymentStrategyType.FullLocal;
    }

    const baseStrategy = { ...DEFAULT_STRATEGIES[strategyType] };

    // Apply any customizations
    if (customizations) {
      Object.assign(baseStrategy, customizations);
    }

    // Store as active strategy
    this.activeStrategy = baseStrategy;

    return baseStrategy;
  }

  /**
   * Create a custom deployment strategy
   */
  public createCustomStrategy(options: Partial<DeploymentStrategy>): DeploymentStrategy {
    // Start with full local as base
    const strategy = { ...DEFAULT_STRATEGIES[DeploymentStrategyType.FullLocal] };

    // Apply custom options
    Object.assign(strategy, options);

    // Override type to custom
    strategy.type = options.type || DeploymentStrategyType.FullLocal;

    return strategy;
  }

  /**
   * Convert a deployment strategy to deployment configuration
   */
  public strategyToConfig(strategy: DeploymentStrategy): DeploymentConfig {
    const config: DeploymentConfig = {
      workerThreads: strategy.workerThreadCount,
      memoryLimit: strategy.memoryLimitMB,
      useLocalCache: strategy.useLocalCache,
      offlineSupport: !strategy.offloadToServer,
      fallbackToServer: strategy.offloadToServer,
      serverEndpoint: 'https://api.proof-of-funds.example.com/v1',
      healthCheckIntervalMs: 60000,
      proofGenerationTimeoutMs: 60000,
      logLevel: 'info',
      telemetryEndpoint: 'https://telemetry.proof-of-funds.example.com/collect',
      features: {
        webWorkers: strategy.useWorkerThreads,
        webAssembly: strategy.useWebAssembly,
        indexedDB: strategy.useLocalCache,
        serviceWorker: false,
        sharedArrayBuffer: strategy.platformOptimizations?.useSharedMemory || false,
        secureContext: true,
        localStorage: strategy.useLocalCache
      }
    };

    return config;
  }

  /**
   * Customize the strategy based on environment and features
   */
  private customizeStrategyForEnvironment(
    strategy: DeploymentStrategy,
    environment: EnvironmentType,
    features: any
  ): void {
    // Adjust worker thread count based on detected CPU cores
    if (strategy.useWorkerThreads && features.cpuCores) {
      strategy.workerThreadCount = Math.min(
        features.cpuCores - 1, // Leave one core for main thread
        strategy.workerThreadCount
      );

      // Ensure at least one worker if threads are enabled
      strategy.workerThreadCount = Math.max(1, strategy.workerThreadCount);
    }

    // Adjust memory limit based on device capabilities
    if (environment === EnvironmentType.Mobile) {
      // Mobile devices typically have less memory
      strategy.memoryLimitMB = Math.min(strategy.memoryLimitMB, 512);
    } else if (environment === EnvironmentType.Node) {
      // Node.js environments typically have more memory
      strategy.memoryLimitMB = Math.max(strategy.memoryLimitMB, 1024);
    }

    // Adjust for WebAssembly support
    strategy.useWebAssembly = features.supportsWebAssembly;

    // Adjust local cache usage based on available storage
    if (environment === EnvironmentType.Browser || environment === EnvironmentType.Mobile) {
      strategy.useLocalCache = features.supportsIndexedDB || features.supportsLocalStorage;
    }

    // Network connectivity affects server offload strategy
    if (features.hasNetwork === false) {
      strategy.offloadToServer = false;
      strategy.serverOffloadPercentage = 0;
    }

    // Platform-specific optimizations
    switch (environment) {
      case EnvironmentType.Browser:
        strategy.platformOptimizations.useSharedMemory = features.supportsSharedArrayBuffer;
        break;

      case EnvironmentType.Mobile:
        strategy.platformOptimizations.reduceQuality = true;
        strategy.platformOptimizations.optimizeBatteryUsage = true;
        break;

      case EnvironmentType.Node:
        strategy.platformOptimizations.useNativeModules = true;
        break;

      case EnvironmentType.Worker:
        strategy.platformOptimizations.optimizeForComputation = true;
        break;
    }
  }

  /**
   * Apply configuration overrides to strategy
   */
  private applyConfigOverrides(strategy: DeploymentStrategy, config: DeploymentConfig): void {
    // Apply worker thread settings
    if (config.workerThreads !== undefined) {
      strategy.useWorkerThreads = config.workerThreads > 0;
      strategy.workerThreadCount = config.workerThreads;
    }

    // Apply memory limit
    if (config.memoryLimit !== undefined) {
      strategy.memoryLimitMB = config.memoryLimit;
    }

    // Apply local cache settings
    if (config.useLocalCache !== undefined) {
      strategy.useLocalCache = config.useLocalCache;
    }

    // Apply server fallback settings
    if (config.fallbackToServer !== undefined) {
      strategy.offloadToServer = config.fallbackToServer;
      if (strategy.offloadToServer) {
        strategy.serverOffloadPercentage = 50; // Default to 50% if not specified
      } else {
        strategy.serverOffloadPercentage = 0;
      }
    }

    // Apply shared memory optimization if supported
    if (config.features?.sharedArrayBuffer !== undefined) {
      strategy.platformOptimizations.useSharedMemory = config.features.sharedArrayBuffer;
    }
  }
}