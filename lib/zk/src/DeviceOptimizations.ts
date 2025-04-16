/**
 * Device-Specific Optimizations for ZK Operations
 * 
 * This module provides optimizations and adaptations for different device types
 * and capability levels, ensuring the best possible performance and user experience
 * across a wide range of hardware.
 * 
 * Features:
 * - Device capability detection and scoring
 * - Adaptive resource allocation based on device capabilities
 * - Performance-based feature toggling
 * - Battery-aware computation scheduling
 * - Progressive enhancement with graceful degradation
 * 
 * Usage:
 * ```typescript
 * import { DeviceOptimizations } from './DeviceOptimizations';
 * 
 * // Get device capability score
 * const score = await DeviceOptimizations.getDeviceScore();
 * 
 * // Get optimization strategy for current device
 * const strategy = DeviceOptimizations.getOptimizationStrategy();
 * 
 * // Check if a feature should be enabled
 * if (DeviceOptimizations.shouldEnableFeature('animations')) {
 *   // Enable animations
 * }
 * ```
 */

import { UserPreferences } from './UserPreferences';

// Device capability tiers
export enum DeviceTier {
  LowEnd = 'low',       // Severely constrained devices
  MidRange = 'medium',  // Limited but capable devices
  HighEnd = 'high'      // Full-featured devices
}

// Feature flags for toggling
export interface FeatureFlags {
  animations: boolean;        // Whether to show animations
  webAssembly: boolean;       // Whether to use WebAssembly
  parallelProcessing: boolean; // Whether to use parallel processing
  autoServerFallback: boolean; // Whether to automatically use server fallback
  detailedProgress: boolean;   // Whether to show detailed progress
  backgroundProcessing: boolean; // Whether to use background processing
  highPrecision: boolean;     // Whether to use high precision calculations
}

// Optimization strategy
export interface OptimizationStrategy {
  tier: DeviceTier;
  maxMemoryUsageMB: number;
  batchSize: number;
  updateFrequencyMs: number;
  timeoutMs: number;
  maxConcurrentOperations: number;
  features: FeatureFlags;
}

// Optimization strategies for different device tiers
const optimizationStrategies: Record<DeviceTier, OptimizationStrategy> = {
  [DeviceTier.LOW]: {
    tier: DeviceTier.LOW,
    maxMemoryUsageMB: 200,
    batchSize: 50,
    updateFrequencyMs: 1000,
    timeoutMs: 90000,
    maxConcurrentOperations: 1,
    features: {
      animations: false,
      webAssembly: true,
      parallelProcessing: false,
      autoServerFallback: true,
      detailedProgress: false,
      backgroundProcessing: false,
      highPrecision: false
    }
  },
  [DeviceTier.MEDIUM]: {
    tier: DeviceTier.MEDIUM,
    maxMemoryUsageMB: 500,
    batchSize: 100,
    updateFrequencyMs: 500,
    timeoutMs: 60000,
    maxConcurrentOperations: 2,
    features: {
      animations: true,
      webAssembly: true,
      parallelProcessing: true,
      autoServerFallback: false,
      detailedProgress: true,
      backgroundProcessing: true,
      highPrecision: false
    }
  },
  [DeviceTier.HIGH]: {
    tier: DeviceTier.HIGH,
    maxMemoryUsageMB: 1000,
    batchSize: 200,
    updateFrequencyMs: 250,
    timeoutMs: 30000,
    maxConcurrentOperations: 4,
    features: {
      animations: true,
      webAssembly: true,
      parallelProcessing: true,
      autoServerFallback: false,
      detailedProgress: true,
      backgroundProcessing: true,
      highPrecision: true
    }
  }
};

/**
 * DeviceOptimizations class for adaptive resource management
 */
export class DeviceOptimizations {
  private static _instance: DeviceOptimizations;
  private _deviceScore: number = 7; // Default to medium score
  private _deviceTier: DeviceTier = DeviceTier.MEDIUM;
  private _strategy: OptimizationStrategy;
  private _isInitialized: boolean = false;

  /**
   * Private constructor (singleton)
   */
  private constructor() {
    this._strategy = optimizationStrategies[this._deviceTier];
  }

  /**
   * Get singleton instance
   */
  private static get instance(): DeviceOptimizations {
    if (!DeviceOptimizations._instance) {
      DeviceOptimizations._instance = new DeviceOptimizations();
    }
    return DeviceOptimizations._instance;
  }

  /**
   * Initialize the device optimization system
   * @returns Promise that resolves when initialization is complete
   */
  public static async initialize(): Promise<void> {
    const instance = DeviceOptimizations.instance;
    if (instance._isInitialized) return;

    // Analyze device capabilities and set score
    instance._deviceScore = await instance.analyzeDeviceCapabilities();
    
    // Determine device tier based on score
    if (instance._deviceScore < 5) {
      instance._deviceTier = DeviceTier.LOW;
    } else if (instance._deviceScore < 8) {
      instance._deviceTier = DeviceTier.MEDIUM;
    } else {
      instance._deviceTier = DeviceTier.HIGH;
    }
    
    // Set optimization strategy based on tier
    instance._strategy = optimizationStrategies[instance._deviceTier];
    
    // Apply any user preference overrides
    instance.applyUserPreferences();
    
    instance._isInitialized = true;
  }

  /**
   * Get the device capability score (0-10)
   * @returns Device score
   */
  public static async getDeviceScore(): Promise<number> {
    const instance = DeviceOptimizations.instance;
    if (!instance._isInitialized) {
      await DeviceOptimizations.initialize();
    }
    return instance._deviceScore;
  }

  /**
   * Get the device tier classification
   * @returns Device tier
   */
  public static async getDeviceTier(): Promise<DeviceTier> {
    const instance = DeviceOptimizations.instance;
    if (!instance._isInitialized) {
      await DeviceOptimizations.initialize();
    }
    return instance._deviceTier;
  }

  /**
   * Get the current optimization strategy
   * @returns Optimization strategy
   */
  public static async getOptimizationStrategy(): Promise<OptimizationStrategy> {
    const instance = DeviceOptimizations.instance;
    if (!instance._isInitialized) {
      await DeviceOptimizations.initialize();
    }
    return { ...instance._strategy }; // Return copy to prevent modification
  }

  /**
   * Check if a specific feature should be enabled
   * @param feature - Feature to check
   * @returns Whether the feature should be enabled
   */
  public static async shouldEnableFeature(feature: keyof FeatureFlags): Promise<boolean> {
    const instance = DeviceOptimizations.instance;
    if (!instance._isInitialized) {
      await DeviceOptimizations.initialize();
    }
    return instance._strategy.features[feature];
  }

  /**
   * Analyze device capabilities and return a score
   * @returns Device capability score (0-10)
   */
  private async analyzeDeviceCapabilities(): Promise<number> {
    // Start with middle score and adjust based on capabilities
    let score = 5;
    
    try {
      // Check for WebAssembly support
      if (typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function') {
        score += 1;
      } else {
        score -= 2; // Major penalty for no WebAssembly
      }
      
      // Check for WebCrypto API
      if (typeof window.crypto !== 'undefined' && typeof window.crypto.subtle !== 'undefined') {
        score += 1;
      } else {
        score -= 1;
      }
      
      // Estimate memory
      const memory = await this.estimateAvailableMemory();
      if (memory > 4) {
        score += 2; // High memory
      } else if (memory > 2) {
        score += 1; // Medium memory
      } else if (memory < 1) {
        score -= 2; // Very low memory
      }
      
      // Run simple CPU benchmark
      const cpuScore = await this.benchmarkCPU();
      score += cpuScore - 5; // Adjust relative to average (5)
      
      // Check for mobile device
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        score -= 1; // Small penalty for mobile
      }
      
      // Account for number of available logical processors
      if (navigator.hardwareConcurrency) {
        if (navigator.hardwareConcurrency >= 8) {
          score += 1;
        } else if (navigator.hardwareConcurrency <= 2) {
          score -= 1;
        }
      }
      
      // Cap to 0-10 range
      return Math.max(0, Math.min(10, score));
    } catch (error) {
      console.warn('Error analyzing device capabilities:', error);
      // Return default moderate score on error
      return 5;
    }
  }

  /**
   * Estimate available device memory in GB
   * @returns Estimated memory in GB
   */
  private async estimateAvailableMemory(): Promise<number> {
    try {
      // Try to use deviceMemory API if available
      if ((navigator as any).deviceMemory) {
        return (navigator as any).deviceMemory;
      }
      
      // Try to use performance.memory in Chrome
      if ((performance as any).memory && (performance as any).memory.jsHeapSizeLimit) {
        return (performance as any).memory.jsHeapSizeLimit / (1024 * 1024 * 1024);
      }
      
      // Fallback estimation by platform
      const userAgent = navigator.userAgent;
      if (/iPhone|iPad|iPod/i.test(userAgent)) {
        return 2; // Assume moderate memory for iOS
      } else if (/Android/i.test(userAgent)) {
        return 2; // Assume moderate memory for Android
      }
      
      // Desktop assumption
      return 4; // Assume 4GB for desktop
    } catch (error) {
      console.warn('Error estimating memory:', error);
      return 2; // Default moderate estimate
    }
  }

  /**
   * Run a simple CPU benchmark to estimate processing power
   * @returns CPU score (0-10)
   */
  private async benchmarkCPU(): Promise<number> {
    try {
      const startTime = performance.now();
      
      // Perform a compute-intensive task
      let result = 0;
      for (let i = 0; i < 1000000; i++) {
        result += Math.sin(i * 0.01) * Math.cos(i * 0.01);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Convert duration to score between 0-10
      // <50ms = 10, >500ms = 0, linear in between
      return Math.max(0, Math.min(10, 10 - (duration / 50)));
    } catch (error) {
      console.warn('Error running CPU benchmark:', error);
      return 5; // Default moderate score
    }
  }

  /**
   * Apply user preference overrides to the strategy
   */
  private applyUserPreferences(): void {
    try {
      // Check if user has explicitly enabled/disabled features
      const showHardwareCapabilities = UserPreferences.get('showHardwareCapabilities');
      const useServerFallback = UserPreferences.get('useServerFallback');
      const enableDetailedProgress = UserPreferences.get('enableDetailedProgress');
      const showTechnicalDetails = UserPreferences.get('showTechnicalDetails');
      
      // Override features based on user preferences
      this._strategy.features.detailedProgress = enableDetailedProgress;
      this._strategy.features.autoServerFallback = useServerFallback;
      
      // Advanced user might want more details
      if (showTechnicalDetails) {
        this._strategy.features.detailedProgress = true;
      }
      
      // Apply custom timeout if set
      const customTimeoutMs = UserPreferences.get('customTimeoutMs');
      if (customTimeoutMs > 0) {
        this._strategy.timeoutMs = customTimeoutMs;
      }
    } catch (error) {
      console.warn('Error applying user preferences:', error);
    }
  }

  /**
   * Get recommended batch size for operations based on device tier
   * @returns Recommended batch size
   */
  public static async getRecommendedBatchSize(): Promise<number> {
    const strategy = await DeviceOptimizations.getOptimizationStrategy();
    return strategy.batchSize;
  }

  /**
   * Get recommended update frequency for progress indicators
   * @returns Update frequency in milliseconds
   */
  public static async getRecommendedUpdateFrequency(): Promise<number> {
    const strategy = await DeviceOptimizations.getOptimizationStrategy();
    return strategy.updateFrequencyMs;
  }

  /**
   * Get recommended timeout for operations
   * @returns Timeout in milliseconds
   */
  public static async getRecommendedTimeout(): Promise<number> {
    const strategy = await DeviceOptimizations.getOptimizationStrategy();
    return strategy.timeoutMs;
  }

  /**
   * Get recommended maximum memory usage
   * @returns Maximum memory usage in MB
   */
  public static async getRecommendedMaxMemory(): Promise<number> {
    const strategy = await DeviceOptimizations.getOptimizationStrategy();
    return strategy.maxMemoryUsageMB;
  }

  /**
   * Check if server fallback should be used
   * @returns Whether server fallback should be used
   */
  public static async shouldUseServerFallback(): Promise<boolean> {
    const strategy = await DeviceOptimizations.getOptimizationStrategy();
    return strategy.features.autoServerFallback;
  }
}

export default DeviceOptimizations;