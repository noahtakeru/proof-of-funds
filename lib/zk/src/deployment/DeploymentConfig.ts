/**
 * @fileoverview Configuration definitions for deployment environments
 */

/**
 * Types of environments where the application can run
 */
export enum EnvironmentType {
  /** Web browser environment */
  Browser = 'browser',
  /** Node.js environment */
  Node = 'node',
  /** Mobile environment (React Native, etc.) */
  Mobile = 'mobile',
  /** Web Worker environment */
  Worker = 'worker',
  /** Unknown environment */
  Unknown = 'unknown'
}

/**
 * Feature flags for environment capabilities
 */
export interface FeatureFlags {
  /** Whether Web Workers are supported */
  webWorkers: boolean;
  /** Whether WebAssembly is supported */
  webAssembly: boolean;
  /** Whether IndexedDB is supported */
  indexedDB: boolean;
  /** Whether Service Worker is supported */
  serviceWorker: boolean;
  /** Whether SharedArrayBuffer is supported */
  sharedArrayBuffer: boolean;
  /** Whether running in a secure context */
  secureContext: boolean;
  /** Whether localStorage is supported */
  localStorage: boolean;
}

/**
 * Configuration for deployment
 */
export interface DeploymentConfig {
  /** Number of worker threads to use (0 = disabled) */
  workerThreads: number;
  /** Memory limit in MB */
  memoryLimit: number;
  /** Whether to use local cache */
  useLocalCache: boolean;
  /** Whether to support offline operation */
  offlineSupport: boolean;
  /** Whether to fall back to server-side operations when client-side fails */
  fallbackToServer: boolean;
  /** Server endpoint for fallback operations */
  serverEndpoint: string;
  /** Health check interval in milliseconds */
  healthCheckIntervalMs: number;
  /** Timeout for proof generation in milliseconds */
  proofGenerationTimeoutMs: number;
  /** Log level for deployment operations */
  logLevel: 'error' | 'warn' | 'info' | 'debug' | 'none';
  /** Telemetry endpoint (undefined to disable) */
  telemetryEndpoint?: string;
  /** Feature flags for the current environment */
  features: FeatureFlags;
}

/**
 * Base configuration suitable for most environments
 */
export const baseConfig: DeploymentConfig = {
  workerThreads: 2,
  memoryLimit: 512, // MB
  useLocalCache: true,
  offlineSupport: false,
  fallbackToServer: true,
  serverEndpoint: 'https://api.proof-of-funds.example.com/v1',
  healthCheckIntervalMs: 60000, // 1 minute
  proofGenerationTimeoutMs: 60000, // 1 minute
  logLevel: 'info',
  telemetryEndpoint: 'https://telemetry.proof-of-funds.example.com/collect',
  features: {
    webWorkers: true,
    webAssembly: true,
    indexedDB: true,
    serviceWorker: false,
    sharedArrayBuffer: false,
    secureContext: true,
    localStorage: true
  }
};

/**
 * Low-resource configuration for constrained environments
 */
export const lowResourceConfig: DeploymentConfig = {
  ...baseConfig,
  workerThreads: 0,
  memoryLimit: 256,
  useLocalCache: true,
  offlineSupport: false,
  fallbackToServer: true,
  proofGenerationTimeoutMs: 120000, // 2 minutes
  features: {
    ...baseConfig.features,
    serviceWorker: false,
    sharedArrayBuffer: false
  }
};

/**
 * High-performance configuration for powerful environments
 */
export const highPerformanceConfig: DeploymentConfig = {
  ...baseConfig,
  workerThreads: 4,
  memoryLimit: 2048, // 2GB
  useLocalCache: true,
  offlineSupport: true,
  fallbackToServer: false,
  proofGenerationTimeoutMs: 30000, // 30 seconds
  features: {
    ...baseConfig.features,
    serviceWorker: true,
    sharedArrayBuffer: true
  }
};

/**
 * Development configuration with verbose logging
 */
export const developmentConfig: DeploymentConfig = {
  ...baseConfig,
  logLevel: 'debug',
  healthCheckIntervalMs: 10000, // More frequent health checks
  telemetryEndpoint: undefined, // Disable telemetry in development
};

/**
 * Production configuration optimized for reliability
 */
export const productionConfig: DeploymentConfig = {
  ...baseConfig,
  logLevel: 'error', // Only log errors in production
  healthCheckIntervalMs: 300000, // Less frequent health checks (5 minutes)
};