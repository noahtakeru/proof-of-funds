/**
 * @fileoverview DeploymentManager for handling multi-platform deployments
 * 
 * This class provides a unified interface for managing deployments across
 * different platforms (browser, Node.js, mobile) with environment-specific
 * configurations and built-in health checks.
 */

import { EnvironmentType, DeploymentConfig, FeatureFlags } from './DeploymentConfig';
import { EnvironmentDetector } from './EnvironmentDetector';
import { HealthCheck, HealthCheckResult } from './HealthCheck';
import { zkCircuitRegistry } from '../zkCircuitRegistry';
import { getDeviceCapabilities } from '../deviceCapabilities';

/**
 * Options for initializing the deployment manager
 */
export interface DeploymentManagerOptions {
  /** Custom environment override */
  environment?: EnvironmentType;
  /** Custom configuration override */
  config?: Partial<DeploymentConfig>;
  /** Whether to perform health checks on startup */
  performInitialHealthCheck?: boolean;
  /** Custom circuit registry path */
  circuitRegistryPath?: string;
  /** Log level for deployment operations */
  logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'none';
  /** Whether to enable telemetry */
  enableTelemetry?: boolean;
}

/**
 * Deployment status information
 */
export interface DeploymentStatus {
  /** Current environment */
  environment: EnvironmentType;
  /** Active configuration */
  config: DeploymentConfig;
  /** Health check results */
  healthCheck: HealthCheckResult;
  /** Feature availability */
  features: Record<string, boolean>;
  /** Whether the deployment is ready */
  isReady: boolean;
  /** Any warnings or issues */
  warnings: string[];
}

/**
 * Manages deployment across multiple platforms
 */
export class DeploymentManager {
  private environment: EnvironmentType;
  private config: DeploymentConfig;
  private detector: EnvironmentDetector;
  private healthCheck: HealthCheck;
  private isInitialized: boolean = false;
  private warnings: string[] = [];
  private features: Record<string, boolean> = {};
  private lastHealthCheckResult: HealthCheckResult | null = null;
  private readonly logLevel: string;
  private readonly enableTelemetry: boolean;

  /**
   * Create a new DeploymentManager
   */
  constructor(options: DeploymentManagerOptions = {}) {
    this.detector = new EnvironmentDetector();
    this.environment = options.environment || this.detector.detectEnvironment();
    this.config = this.createConfig(this.environment, options.config);
    this.healthCheck = new HealthCheck(this.environment, this.config);
    this.logLevel = options.logLevel || 'info';
    this.enableTelemetry = options.enableTelemetry !== undefined ? options.enableTelemetry : true;
    
    // If circuit registry path is provided, configure it
    if (options.circuitRegistryPath) {
      this.configureCircuitRegistry(options.circuitRegistryPath);
    }
    
    // Detect available features
    this.detectFeatures();
    
    // Perform initial health check if requested
    if (options.performInitialHealthCheck !== false) {
      this.runHealthCheck();
    }
    
    this.isInitialized = true;
    this.log('info', `DeploymentManager initialized for ${this.environment} environment`);
  }
  
  /**
   * Initialize the deployment
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      this.log('warn', 'DeploymentManager already initialized');
      return true;
    }
    
    try {
      // Run health checks
      const health = await this.runHealthCheck();
      
      // Initialize based on environment
      switch (this.environment) {
        case EnvironmentType.Browser:
          await this.initializeBrowserEnvironment();
          break;
        case EnvironmentType.Node:
          await this.initializeNodeEnvironment();
          break;
        case EnvironmentType.Mobile:
          await this.initializeMobileEnvironment();
          break;
        case EnvironmentType.Worker:
          await this.initializeWorkerEnvironment();
          break;
        default:
          throw new Error(`Unsupported environment: ${this.environment}`);
      }
      
      this.isInitialized = true;
      this.log('info', `Deployment successfully initialized for ${this.environment}`);
      return true;
    } catch (error) {
      this.log('error', `Failed to initialize deployment: ${error instanceof Error ? error.message : String(error)}`);
      this.warnings.push(`Initialization error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  
  /**
   * Get current deployment status
   */
  public getStatus(): DeploymentStatus {
    return {
      environment: this.environment,
      config: this.config,
      healthCheck: this.lastHealthCheckResult || { 
        status: 'unknown',
        checks: {},
        timestamp: Date.now() 
      },
      features: this.features,
      isReady: this.isInitialized,
      warnings: [...this.warnings]
    };
  }
  
  /**
   * Run health checks for the current deployment
   */
  public async runHealthCheck(): Promise<HealthCheckResult> {
    this.log('info', 'Running deployment health checks');
    const result = await this.healthCheck.runChecks();
    this.lastHealthCheckResult = result;
    
    // Process warnings from health check
    if (result.status === 'warning' || result.status === 'error') {
      for (const check of Object.values(result.checks)) {
        if (check.status === 'warning' || check.status === 'error') {
          this.warnings.push(`Health check '${check.name}': ${check.message}`);
        }
      }
    }
    
    return result;
  }
  
  /**
   * Update configuration for the current deployment
   */
  public updateConfig(config: Partial<DeploymentConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    
    // Update health check with new config
    this.healthCheck.updateConfig(this.config);
    this.log('info', 'Deployment configuration updated');
  }
  
  /**
   * Reset the deployment manager to initial state
   */
  public async reset(): Promise<void> {
    this.isInitialized = false;
    this.warnings = [];
    this.lastHealthCheckResult = null;
    
    // Re-detect environment
    this.environment = this.detector.detectEnvironment();
    this.config = this.createConfig(this.environment);
    
    // Re-detect features
    this.detectFeatures();
    
    this.log('info', 'DeploymentManager reset to initial state');
  }
  
  /**
   * Check if specific features are available in the current environment
   */
  public hasFeature(featureName: keyof FeatureFlags): boolean {
    return this.features[featureName] === true;
  }
  
  /**
   * Get recommended configuration based on environment capabilities
   */
  public getRecommendedConfig(): DeploymentConfig {
    const deviceCaps = getDeviceCapabilities();
    const baseConfig = this.createConfig(this.environment);
    
    // Adjust settings based on device capabilities
    return {
      ...baseConfig,
      workerThreads: deviceCaps.cpuCores > 2 ? Math.min(deviceCaps.cpuCores - 1, 4) : 0,
      memoryLimit: Math.min(deviceCaps.memory * 0.7, 4096), // 70% of available memory or 4GB max
      useLocalCache: deviceCaps.storageQuota > 50 * 1024 * 1024, // 50MB minimum
      offlineSupport: deviceCaps.persistentStorage,
      proofGenerationTimeoutMs: deviceCaps.cpuPerformance === 'high' ? 
        30000 : deviceCaps.cpuPerformance === 'medium' ? 
        60000 : 120000
    };
  }
  
  /**
   * Configure circuit registry path
   */
  private configureCircuitRegistry(path: string): void {
    try {
      zkCircuitRegistry.setBasePath(path);
      this.log('info', `Circuit registry path configured: ${path}`);
    } catch (error) {
      this.log('error', `Failed to configure circuit registry: ${error instanceof Error ? error.message : String(error)}`);
      this.warnings.push(`Circuit registry error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Create environment-specific configuration
   */
  private createConfig(
    environment: EnvironmentType, 
    overrides?: Partial<DeploymentConfig>
  ): DeploymentConfig {
    // Base configuration
    const baseConfig: DeploymentConfig = {
      workerThreads: 2,
      memoryLimit: 512, // MB
      useLocalCache: true,
      offlineSupport: false,
      fallbackToServer: true,
      serverEndpoint: 'https://api.proof-of-funds.example.com/v1',
      healthCheckIntervalMs: 60000, // 1 minute
      proofGenerationTimeoutMs: 60000, // 1 minute
      logLevel: this.logLevel as DeploymentConfig['logLevel'],
      telemetryEndpoint: this.enableTelemetry ? 'https://telemetry.proof-of-funds.example.com/collect' : undefined,
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
    
    // Environment-specific adjustments
    let envConfig: DeploymentConfig;
    
    switch (environment) {
      case EnvironmentType.Browser:
        envConfig = {
          ...baseConfig,
          workerThreads: 1, // Most browsers benefit from 1 worker to keep UI responsive
          features: {
            ...baseConfig.features,
            serviceWorker: true,
          }
        };
        break;
        
      case EnvironmentType.Node:
        envConfig = {
          ...baseConfig,
          workerThreads: 4, // Node.js can use more threads effectively
          memoryLimit: 1024, // More memory available in Node.js environments
          features: {
            ...baseConfig.features,
            webWorkers: false,
            indexedDB: false,
            serviceWorker: false,
            localStorage: false,
            sharedArrayBuffer: true
          }
        };
        break;
        
      case EnvironmentType.Mobile:
        envConfig = {
          ...baseConfig,
          workerThreads: 1, // Conservative for mobile
          memoryLimit: 256, // Conservative for mobile
          proofGenerationTimeoutMs: 120000, // Longer timeout for mobile
          features: {
            ...baseConfig.features,
            serviceWorker: false,
            sharedArrayBuffer: false
          }
        };
        break;
        
      case EnvironmentType.Worker:
        envConfig = {
          ...baseConfig,
          workerThreads: 0, // Already in a worker
          features: {
            ...baseConfig.features,
            serviceWorker: false
          }
        };
        break;
        
      default:
        envConfig = baseConfig;
    }
    
    // Apply any overrides
    if (overrides) {
      return {
        ...envConfig,
        ...overrides,
        features: {
          ...envConfig.features,
          ...(overrides.features || {})
        }
      };
    }
    
    return envConfig;
  }
  
  /**
   * Detect features available in the current environment
   */
  private detectFeatures(): void {
    const detectedFeatures = this.detector.detectFeatures();
    
    // Update features configuration based on detection
    this.config.features = {
      ...this.config.features,
      webWorkers: detectedFeatures.supportsWebWorkers,
      webAssembly: detectedFeatures.supportsWebAssembly,
      indexedDB: detectedFeatures.supportsIndexedDB,
      serviceWorker: detectedFeatures.supportsServiceWorker,
      sharedArrayBuffer: detectedFeatures.supportsSharedArrayBuffer,
      secureContext: detectedFeatures.isSecureContext,
      localStorage: detectedFeatures.supportsLocalStorage
    };
    
    // Copy to features record for external use
    this.features = {
      webWorkers: this.config.features.webWorkers,
      webAssembly: this.config.features.webAssembly,
      indexedDB: this.config.features.indexedDB,
      serviceWorker: this.config.features.serviceWorker,
      sharedArrayBuffer: this.config.features.sharedArrayBuffer,
      secureContext: this.config.features.secureContext,
      localStorage: this.config.features.localStorage
    };
    
    this.log('info', `Feature detection completed: ${Object.entries(this.features)
      .filter(([, value]) => value)
      .map(([key]) => key)
      .join(', ')}`);
  }
  
  /**
   * Initialize browser-specific environment
   */
  private async initializeBrowserEnvironment(): Promise<void> {
    this.log('info', 'Initializing browser environment');
    
    // Register service worker if supported and enabled
    if (this.config.features.serviceWorker && 'serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        this.log('info', `Service worker registered with scope: ${registration.scope}`);
      } catch (error) {
        this.log('warn', `Service worker registration failed: ${error instanceof Error ? error.message : String(error)}`);
        this.warnings.push(`Service worker registration failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Initialize IndexedDB if needed
    if (this.config.useLocalCache && this.config.features.indexedDB) {
      // IndexedDB initialization would go here
      this.log('info', 'IndexedDB cache initialized');
    }
  }
  
  /**
   * Initialize Node.js-specific environment
   */
  private async initializeNodeEnvironment(): Promise<void> {
    this.log('info', 'Initializing Node.js environment');
    
    // Node.js specific setup
    // No special initialization needed for now
  }
  
  /**
   * Initialize mobile-specific environment
   */
  private async initializeMobileEnvironment(): Promise<void> {
    this.log('info', 'Initializing mobile environment');
    
    // Mobile-specific setup
    // Check for background processing limits
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        // @ts-ignore - navigator.getBattery() is not standard
        const battery = await navigator.getBattery();
        if (battery.charging === false && battery.level < 0.15) {
          // Low battery, reduce resource usage
          this.updateConfig({
            workerThreads: 0,
            memoryLimit: 128
          });
          this.log('warn', 'Low battery detected, reducing resource usage');
          this.warnings.push('Low battery detected, performance may be limited');
        }
      } catch (error) {
        this.log('debug', `Battery status check failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  
  /**
   * Initialize web worker-specific environment
   */
  private async initializeWorkerEnvironment(): Promise<void> {
    this.log('info', 'Initializing worker environment');
    
    // Worker-specific setup
    // No special initialization needed for now
  }
  
  /**
   * Log a message with appropriate level
   */
  private log(level: 'error' | 'warn' | 'info' | 'debug', message: string): void {
    const levels = { error: 0, warn: 1, info: 2, debug: 3, none: 4 };
    const configLevel = this.logLevel || 'info';
    
    if (levels[level] <= levels[configLevel]) {
      if (level === 'error') {
        console.error(`[DeploymentManager] ${message}`);
      } else if (level === 'warn') {
        console.warn(`[DeploymentManager] ${message}`);
      } else if (level === 'info') {
        console.info(`[DeploymentManager] ${message}`);
      } else {
        console.debug(`[DeploymentManager] ${message}`);
      }
    }
  }
}