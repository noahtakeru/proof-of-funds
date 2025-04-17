/**
 * DeploymentConfig.cjs
 * 
 * CommonJS version of deployment configuration for the ZK system.
 * Provides environment types, feature flags, and default configurations
 * for different deployment scenarios.
 */

/**
 * Types of environments where the application can run
 */
const EnvironmentType = {
  /** Web browser environment */
  BROWSER: 'browser',
  /** Node.js environment */
  NODE: 'node',
  /** Mobile environment (React Native, etc.) */
  MOBILE_BROWSER: 'mobile_browser',
  /** Server environment */
  SERVER: 'server',
  /** Web Worker environment */
  WORKER: 'worker',
  /** Unknown environment */
  UNKNOWN: 'unknown'
};

/**
 * Default feature flags for environment capabilities
 */
const defaultFeatures = {
  /** Whether Web Workers are supported */
  webWorkers: true,
  /** Whether WebAssembly is supported */
  webAssembly: true,
  /** Whether IndexedDB is supported */
  indexedDB: true,
  /** Whether Service Worker is supported */
  serviceWorker: false,
  /** Whether SharedArrayBuffer is supported */
  sharedArrayBuffer: false,
  /** Whether running in a secure context */
  secureContext: true,
  /** Whether localStorage is supported */
  localStorage: true
};

/**
 * Base configuration suitable for most environments
 */
const baseConfig = {
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
  features: { ...defaultFeatures }
};

/**
 * Low-resource configuration for constrained environments
 */
const lowResourceConfig = {
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
    sharedArrayBuffer: false,
    webWorkers: false
  }
};

/**
 * High-performance configuration for powerful environments
 */
const highPerformanceConfig = {
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
const developmentConfig = {
  ...baseConfig,
  logLevel: 'debug',
  healthCheckIntervalMs: 10000, // More frequent health checks
  telemetryEndpoint: undefined, // Disable telemetry in development
};

/**
 * Production configuration optimized for reliability
 */
const productionConfig = {
  ...baseConfig,
  logLevel: 'error', // Only log errors in production
  healthCheckIntervalMs: 300000, // Less frequent health checks (5 minutes)
};

/**
 * Detect the current environment type
 */
function detectEnvironment() {
  if (typeof window !== 'undefined') {
    // Browser environment
    if (typeof navigator !== 'undefined' && navigator.userAgent && 
        (navigator.userAgent.includes('Mobile') || navigator.userAgent.includes('Android'))) {
      return EnvironmentType.MOBILE_BROWSER;
    }
    return EnvironmentType.BROWSER;
  } else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    // Node.js environment
    return EnvironmentType.NODE;
  } else if (typeof self !== 'undefined' && self.WorkerGlobalScope) {
    // Web Worker environment
    return EnvironmentType.WORKER;
  } else {
    return EnvironmentType.UNKNOWN;
  }
}

/**
 * Get the appropriate configuration for the current environment
 */
function getConfigForEnvironment(environmentType, performanceLevel = 'medium') {
  switch (environmentType) {
    case EnvironmentType.BROWSER:
      return performanceLevel === 'high' ? highPerformanceConfig : baseConfig;
    case EnvironmentType.MOBILE_BROWSER:
      return lowResourceConfig;
    case EnvironmentType.NODE:
    case EnvironmentType.SERVER:
      return highPerformanceConfig;
    case EnvironmentType.WORKER:
      return performanceLevel === 'low' ? lowResourceConfig : baseConfig;
    default:
      return baseConfig;
  }
}

/**
 * Get detected environment configuration
 */
function getDetectedConfig(performanceLevel = 'medium') {
  const environmentType = detectEnvironment();
  return getConfigForEnvironment(environmentType, performanceLevel);
}

// Export all components
module.exports = {
  EnvironmentType,
  baseConfig,
  lowResourceConfig,
  highPerformanceConfig,
  developmentConfig,
  productionConfig,
  detectEnvironment,
  getConfigForEnvironment,
  getDetectedConfig
};