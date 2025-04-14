/**
 * @fileoverview Platform-specific configuration generator
 * 
 * This module provides functionality to generate optimal configurations
 * for different platforms and environments, handling the specifics of
 * each platform's capabilities and limitations.
 */

import { EnvironmentType, DeploymentConfig } from './DeploymentConfig';
import { EnvironmentDetector } from './EnvironmentDetector';
import { DeploymentStrategyType } from './DeploymentStrategySelector';

/**
 * Platform-specific configuration options
 */
export interface PlatformConfigOptions {
  /** Target platform */
  platform: EnvironmentType;
  /** Selected strategy type */
  strategyType: DeploymentStrategyType;
  /** Whether to optimize for performance */
  optimizePerformance?: boolean;
  /** Whether to optimize for battery life (mobile) */
  optimizeBattery?: boolean;
  /** Whether to optimize for network usage */
  optimizeNetwork?: boolean;
  /** Whether to optimize for memory usage */
  optimizeMemory?: boolean;
  /** Custom settings to override defaults */
  customSettings?: Partial<DeploymentConfig>;
}

/**
 * Platform configuration profile
 */
export interface PlatformProfile {
  /** Platform name */
  name: string;
  /** Platform description */
  description: string;
  /** Platform capabilities */
  capabilities: Record<string, boolean>;
  /** Recommended settings */
  recommendedSettings: Partial<DeploymentConfig>;
  /** Platform limitations */
  limitations: string[];
}

/**
 * Configuration generator for different platforms
 */
export class PlatformConfigurator {
  private detector: EnvironmentDetector;
  private platformProfiles: Map<EnvironmentType, PlatformProfile>;
  
  /**
   * Create a new PlatformConfigurator
   */
  constructor() {
    this.detector = new EnvironmentDetector();
    this.platformProfiles = new Map();
    this.initializePlatformProfiles();
  }
  
  /**
   * Generate optimal configuration for a specific platform
   */
  public generateConfig(options: PlatformConfigOptions): DeploymentConfig {
    const { platform, strategyType } = options;
    
    // Get base configuration for the platform
    const baseConfig = this.getBasePlatformConfig(platform);
    
    // Apply strategy-specific adjustments
    const strategyConfig = this.applyStrategyConfig(baseConfig, strategyType);
    
    // Apply optimization flags
    let optimizedConfig = strategyConfig;
    if (options.optimizePerformance) {
      optimizedConfig = this.optimizeForPerformance(optimizedConfig, platform);
    }
    if (options.optimizeBattery && platform === EnvironmentType.Mobile) {
      optimizedConfig = this.optimizeForBattery(optimizedConfig);
    }
    if (options.optimizeNetwork) {
      optimizedConfig = this.optimizeForNetwork(optimizedConfig);
    }
    if (options.optimizeMemory) {
      optimizedConfig = this.optimizeForMemory(optimizedConfig);
    }
    
    // Apply any custom settings
    if (options.customSettings) {
      optimizedConfig = {
        ...optimizedConfig,
        ...options.customSettings,
        features: {
          ...optimizedConfig.features,
          ...(options.customSettings.features || {})
        }
      };
    }
    
    return optimizedConfig;
  }
  
  /**
   * Get platform profile containing capabilities and limitations
   */
  public getPlatformProfile(platform: EnvironmentType): PlatformProfile | undefined {
    return this.platformProfiles.get(platform);
  }
  
  /**
   * Get all available platform profiles
   */
  public getAllPlatformProfiles(): PlatformProfile[] {
    return Array.from(this.platformProfiles.values());
  }
  
  /**
   * Detect current platform capabilities and generate profile
   */
  public detectCurrentPlatform(): { platform: EnvironmentType, profile: PlatformProfile } {
    const platform = this.detector.detectEnvironment();
    const features = this.detector.detectFeatures();
    
    // Get base profile for the platform
    const baseProfile = this.platformProfiles.get(platform) || this.platformProfiles.get(EnvironmentType.Unknown)!;
    
    // Update capabilities based on detection
    const updatedProfile: PlatformProfile = {
      ...baseProfile,
      capabilities: {
        ...baseProfile.capabilities,
        webWorkers: features.supportsWebWorkers,
        webAssembly: features.supportsWebAssembly,
        indexedDB: features.supportsIndexedDB,
        serviceWorker: features.supportsServiceWorker,
        sharedArrayBuffer: features.supportsSharedArrayBuffer,
        secureContext: features.isSecureContext,
        localStorage: features.supportsLocalStorage,
        highEndDevice: features.isHighEndDevice,
        networkAvailable: features.hasNetwork
      }
    };
    
    return { platform, profile: updatedProfile };
  }
  
  /**
   * Initialize platform profiles with capabilities and limitations
   */
  private initializePlatformProfiles(): void {
    // Browser profile
    this.platformProfiles.set(EnvironmentType.Browser, {
      name: 'Web Browser',
      description: 'Standard web browser environment',
      capabilities: {
        webWorkers: true,
        webAssembly: true,
        indexedDB: true,
        serviceWorker: true,
        localStorage: true,
        webCrypto: true,
        offlineSupport: true
      },
      recommendedSettings: {
        workerThreads: 2,
        memoryLimit: 512,
        useLocalCache: true,
        offlineSupport: true,
        fallbackToServer: true
      },
      limitations: [
        'Limited processing power compared to server',
        'Memory constraints in low-end devices',
        'Performance varies widely across browsers',
        'SharedArrayBuffer requires COOP/COEP headers'
      ]
    });
    
    // Node.js profile
    this.platformProfiles.set(EnvironmentType.Node, {
      name: 'Node.js',
      description: 'Server-side JavaScript runtime',
      capabilities: {
        nativeModules: true,
        fileSystem: true,
        webAssembly: true,
        workerThreads: true,
        sharedMemory: true,
        nativeCrypto: true
      },
      recommendedSettings: {
        workerThreads: 4,
        memoryLimit: 1024,
        useLocalCache: true,
        offlineSupport: true,
        fallbackToServer: false
      },
      limitations: [
        'No browser APIs like IndexedDB',
        'No Web Workers (uses worker_threads instead)',
        'No service workers'
      ]
    });
    
    // Mobile profile
    this.platformProfiles.set(EnvironmentType.Mobile, {
      name: 'Mobile Browser/App',
      description: 'Mobile environment (browser or webview)',
      capabilities: {
        webWorkers: true,
        webAssembly: true,
        indexedDB: true,
        localStorage: true,
        batteryAPI: true,
        touchInput: true,
        intermittentConnectivity: true
      },
      recommendedSettings: {
        workerThreads: 1,
        memoryLimit: 256,
        useLocalCache: true,
        offlineSupport: true,
        fallbackToServer: true,
        proofGenerationTimeoutMs: 120000
      },
      limitations: [
        'Limited battery life',
        'Memory constraints',
        'CPU performance limitations',
        'Intermittent network connectivity',
        'Background processing limitations'
      ]
    });
    
    // Web Worker profile
    this.platformProfiles.set(EnvironmentType.Worker, {
      name: 'Web Worker',
      description: 'Dedicated thread for computation',
      capabilities: {
        webAssembly: true,
        indexedDB: true,
        dedicatedComputation: true,
        messageChannels: true
      },
      recommendedSettings: {
        workerThreads: 0, // Already in a worker
        memoryLimit: 512,
        useLocalCache: true,
        offlineSupport: false,
        fallbackToServer: false
      },
      limitations: [
        'No DOM access',
        'Limited communication with main thread',
        'Cannot spawn additional workers',
        'No access to some browser APIs'
      ]
    });
    
    // Unknown/fallback profile
    this.platformProfiles.set(EnvironmentType.Unknown, {
      name: 'Unknown Environment',
      description: 'Unrecognized JavaScript environment',
      capabilities: {
        basicJavaScript: true
      },
      recommendedSettings: {
        workerThreads: 0,
        memoryLimit: 256,
        useLocalCache: false,
        offlineSupport: false,
        fallbackToServer: true
      },
      limitations: [
        'Unknown capabilities',
        'Limited feature detection',
        'Conservative resource usage'
      ]
    });
  }
  
  /**
   * Get base configuration for a platform
   */
  private getBasePlatformConfig(platform: EnvironmentType): DeploymentConfig {
    const profile = this.platformProfiles.get(platform);
    
    // Start with default configuration
    const baseConfig: DeploymentConfig = {
      workerThreads: 2,
      memoryLimit: 512,
      useLocalCache: true,
      offlineSupport: false,
      fallbackToServer: true,
      serverEndpoint: 'https://api.proof-of-funds.example.com/v1',
      healthCheckIntervalMs: 60000,
      proofGenerationTimeoutMs: 60000,
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
    
    // Apply profile-specific recommended settings if available
    if (profile?.recommendedSettings) {
      return {
        ...baseConfig,
        ...profile.recommendedSettings,
        features: {
          ...baseConfig.features,
          ...(profile.recommendedSettings.features || {})
        }
      };
    }
    
    return baseConfig;
  }
  
  /**
   * Apply strategy-specific configuration
   */
  private applyStrategyConfig(config: DeploymentConfig, strategy: DeploymentStrategyType): DeploymentConfig {
    switch (strategy) {
      case DeploymentStrategyType.FullLocal:
        return {
          ...config,
          workerThreads: Math.max(config.workerThreads, 2),
          memoryLimit: Math.max(config.memoryLimit, 512),
          useLocalCache: true,
          offlineSupport: true,
          fallbackToServer: false
        };
        
      case DeploymentStrategyType.Hybrid:
        return {
          ...config,
          workerThreads: Math.min(config.workerThreads, 2),
          useLocalCache: true,
          offlineSupport: false,
          fallbackToServer: true
        };
        
      case DeploymentStrategyType.ServerSide:
        return {
          ...config,
          workerThreads: 0,
          memoryLimit: Math.min(config.memoryLimit, 256),
          useLocalCache: true,
          offlineSupport: false,
          fallbackToServer: true
        };
        
      case DeploymentStrategyType.LowResource:
        return {
          ...config,
          workerThreads: 0,
          memoryLimit: Math.min(config.memoryLimit, 256),
          useLocalCache: config.features.localStorage,
          offlineSupport: false,
          fallbackToServer: true,
          proofGenerationTimeoutMs: 120000
        };
        
      case DeploymentStrategyType.HighPerformance:
        return {
          ...config,
          workerThreads: Math.max(config.workerThreads, 4),
          memoryLimit: Math.max(config.memoryLimit, 1024),
          useLocalCache: true,
          offlineSupport: true,
          fallbackToServer: false,
          proofGenerationTimeoutMs: 30000,
          features: {
            ...config.features,
            sharedArrayBuffer: true
          }
        };
        
      default:
        return config;
    }
  }
  
  /**
   * Optimize configuration for performance
   */
  private optimizeForPerformance(config: DeploymentConfig, platform: EnvironmentType): DeploymentConfig {
    const optimized = { ...config };
    
    // Increase worker threads for parallel processing
    if (platform !== EnvironmentType.Worker) {
      optimized.workerThreads = platform === EnvironmentType.Mobile ? 2 : 4;
    }
    
    // Increase memory limit
    optimized.memoryLimit = platform === EnvironmentType.Mobile ? 512 : 1024;
    
    // Enable shared memory if possible
    optimized.features = {
      ...optimized.features,
      sharedArrayBuffer: platform !== EnvironmentType.Mobile
    };
    
    // Use local processing when possible
    optimized.fallbackToServer = false;
    
    // Reduce timeouts for faster feedback
    optimized.proofGenerationTimeoutMs = 30000;
    optimized.healthCheckIntervalMs = 120000; // Less frequent health checks
    
    return optimized;
  }
  
  /**
   * Optimize configuration for battery life (mobile)
   */
  private optimizeForBattery(config: DeploymentConfig): DeploymentConfig {
    const optimized = { ...config };
    
    // Reduce worker threads to save power
    optimized.workerThreads = 0;
    
    // Reduce memory usage
    optimized.memoryLimit = 128;
    
    // Offload computation to server when possible
    optimized.fallbackToServer = true;
    
    // Disable features that consume battery
    optimized.features = {
      ...optimized.features,
      serviceWorker: false,
      sharedArrayBuffer: false
    };
    
    // Increase timeouts to allow for power-saving modes
    optimized.proofGenerationTimeoutMs = 180000;
    optimized.healthCheckIntervalMs = 300000;
    
    return optimized;
  }
  
  /**
   * Optimize configuration for network usage
   */
  private optimizeForNetwork(config: DeploymentConfig): DeploymentConfig {
    const optimized = { ...config };
    
    // Enable local cache to reduce network requests
    optimized.useLocalCache = true;
    
    // Enable offline support
    optimized.offlineSupport = true;
    
    // Only fall back to server when absolutely necessary
    optimized.fallbackToServer = true;
    
    // Use service worker if available for caching
    optimized.features = {
      ...optimized.features,
      serviceWorker: config.features.serviceWorker
    };
    
    // Reduce telemetry
    optimized.telemetryEndpoint = undefined;
    
    // Less frequent health checks
    optimized.healthCheckIntervalMs = 300000;
    
    return optimized;
  }
  
  /**
   * Optimize configuration for memory usage
   */
  private optimizeForMemory(config: DeploymentConfig): DeploymentConfig {
    const optimized = { ...config };
    
    // Reduce worker threads to save memory
    optimized.workerThreads = 0;
    
    // Reduce memory limit
    optimized.memoryLimit = 128;
    
    // Disable features that consume memory
    optimized.features = {
      ...optimized.features,
      sharedArrayBuffer: false
    };
    
    // Offload to server when possible
    optimized.fallbackToServer = true;
    
    return optimized;
  }
}