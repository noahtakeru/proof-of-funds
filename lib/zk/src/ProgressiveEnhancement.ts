/**
 * Progressive Enhancement System for ZK Operations
 * 
 * This module provides a progressive enhancement approach to zero-knowledge
 * proof functionality, ensuring core features work across all devices while
 * advanced features are selectively enabled based on device capabilities.
 * 
 * Features:
 * - Feature detection-based enhancements
 * - Core functionality on all supported devices
 * - Graceful degradation for less capable devices
 * - Server-side fallback mechanism for critical operations
 * - Adaptive UI based on device capabilities
 * 
 * Usage:
 * ```typescript
 * import { ProgressiveEnhancement } from './ProgressiveEnhancement';
 * 
 * // Check if a feature is available
 * if (await ProgressiveEnhancement.isFeatureAvailable('advancedVisualization')) {
 *   // Enable advanced visualization
 * } else {
 *   // Use simplified visualization
 * }
 * 
 * // Get UI component suited for device capabilities
 * const UIComponent = await ProgressiveEnhancement.getOptimalUIComponent('progressIndicator');
 * ```
 */

import { DeviceOptimizations, DeviceTier } from './DeviceOptimizations';
import { UserPreferences } from './UserPreferences';

/**
 * Device capability tiers - explicitly defining here for feature flags implementation
 * This should match the same enum in DeviceOptimizations
 */
export enum DeviceTier {
  LowEnd = 'low',       // Severely constrained devices
  MidRange = 'medium',  // Limited but capable devices
  HighEnd = 'high'      // Full-featured devices
}

/**
 * Feature flags controlling which capabilities are enabled
 */
export interface FeatureFlags {
  advancedVisualization: boolean;  // Rich, animated visualizations
  detailedProgress: boolean;       // Detailed progress tracking
  realTimeUpdates: boolean;        // Real-time progress updates
  parallelProcessing: boolean;     // Parallel execution of operations
  backgroundProcessing: boolean;   // Processing in background threads
  localCaching: boolean;           // Local caching of verification keys
  batchProofGeneration: boolean;   // Generate multiple proofs in batch
  offlineOperation: boolean;       // Operation without network
  complexCircuits: boolean;        // Support for complex ZK circuits
}

// Feature capabilities based on device tier
interface FeatureMap {
  [key: string]: {
    // Minimum device tier required for this feature
    minimumTier: DeviceTier;
    // Whether the feature is critical (server fallback if unavailable)
    critical: boolean;
    // Whether the feature can partially work on lower tiers
    graceful: boolean;
    // Alternative approach for lower tiers
    fallback?: string;
    // Description for documentation
    description: string;
  };
}

// Define available features with their requirements
const features: FeatureMap = {
  // Core proof functionality
  'standardProof': {
    minimumTier: DeviceTier.LOW,
    critical: true,
    graceful: false,
    fallback: 'serverSideProof',
    description: 'Basic standard proof generation and verification'
  },
  'thresholdProof': {
    minimumTier: DeviceTier.LOW,
    critical: true,
    graceful: false,
    fallback: 'serverSideProof',
    description: 'Threshold (minimum amount) proof functionality'
  },
  'maximumProof': {
    minimumTier: DeviceTier.LOW, 
    critical: true,
    graceful: false,
    fallback: 'serverSideProof',
    description: 'Maximum amount proof functionality'
  },
  
  // UI and visualization features
  'advancedVisualization': {
    minimumTier: DeviceTier.MEDIUM,
    critical: false,
    graceful: true,
    fallback: 'basicVisualization',
    description: 'Enhanced visualization with animations and detailed graphics'
  },
  'detailedProgress': {
    minimumTier: DeviceTier.MEDIUM,
    critical: false,
    graceful: true,
    fallback: 'simpleProgress',
    description: 'Detailed progress tracking with step visualization'
  },
  'realTimeUpdates': {
    minimumTier: DeviceTier.MEDIUM,
    critical: false,
    graceful: true,
    fallback: 'periodicUpdates',
    description: 'Real-time progress updates during operations'
  },
  
  // Performance features
  'parallelProcessing': {
    minimumTier: DeviceTier.HIGH,
    critical: false,
    graceful: true,
    description: 'Parallel execution of proof operations'
  },
  'backgroundProcessing': {
    minimumTier: DeviceTier.MEDIUM,
    critical: false,
    graceful: true,
    description: 'Processing in background threads'
  },
  'localCaching': {
    minimumTier: DeviceTier.MEDIUM,
    critical: false,
    graceful: true,
    description: 'Local caching of verification keys and intermediate results'
  },
  
  // Advanced features
  'batchProofGeneration': {
    minimumTier: DeviceTier.HIGH,
    critical: false,
    graceful: true,
    fallback: 'sequentialProcessing',
    description: 'Generate multiple proofs in a single batch operation'
  },
  'offlineOperation': {
    minimumTier: DeviceTier.MEDIUM,
    critical: false,
    graceful: true,
    description: 'Operation without network connectivity'
  },
  'complexCircuits': {
    minimumTier: DeviceTier.HIGH,
    critical: false,
    graceful: false,
    fallback: 'serverSideProof',
    description: 'Support for complex ZK circuits with many constraints'
  }
};

// UI component variants for different device capabilities
const uiComponents = {
  'progressIndicator': {
    [DeviceTier.LowEnd]: 'BasicProgressIndicator',
    [DeviceTier.MidRange]: 'StandardProgressIndicator',
    [DeviceTier.HighEnd]: 'AdvancedProgressIndicator'
  },
  'verificationResult': {
    [DeviceTier.LowEnd]: 'SimpleVerificationResult',
    [DeviceTier.MidRange]: 'StandardVerificationResult',
    [DeviceTier.HighEnd]: 'DetailedVerificationResult'
  },
  'errorDisplay': {
    [DeviceTier.LowEnd]: 'BasicErrorDisplay',
    [DeviceTier.MidRange]: 'InteractiveErrorDisplay',
    [DeviceTier.HighEnd]: 'AdvancedErrorDisplay'
  }
};

/**
 * Progressive Enhancement module
 */
export class ProgressiveEnhancement {
  private static _isInitialized = false;
  private static _deviceTier: DeviceTier = DeviceTier.MEDIUM;
  private static _availableFeatures: Set<string> = new Set();
  private static _detectedCapabilities: Map<string, boolean> = new Map();
  
  /**
   * Initialize the progressive enhancement system
   * @returns Promise that resolves when initialization is complete
   */
  public static async initialize(): Promise<void> {
    if (this._isInitialized) return;
    
    try {
      // Get device tier from DeviceOptimizations
      this._deviceTier = await DeviceOptimizations.getDeviceTier();
      
      // Detect available features based on device tier
      await this._detectFeatures();
      
      this._isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize ProgressiveEnhancement:', error);
      // Default to medium tier if initialization fails
      this._deviceTier = DeviceTier.MEDIUM;
      this._detectFeaturesForTier(this._deviceTier);
      this._isInitialized = true;
    }
  }
  
  /**
   * Check if a specific feature is available on the current device
   * @param featureName - Name of the feature to check
   * @returns Whether the feature is available
   */
  public static async isFeatureAvailable(featureName: string): Promise<boolean> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    
    return this._availableFeatures.has(featureName);
  }
  
  /**
   * Check if a specific feature flag should be enabled based on device capabilities
   * This method is important for feature flags implementation
   * @param feature - Feature flag to check
   * @returns Whether the feature should be enabled
   */
  public static async shouldEnableFeature(feature: keyof FeatureFlags): Promise<boolean> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    
    const flags = await this.getFeatureFlags();
    return flags[feature] || false;
  }
  
  /**
   * Get the fallback for a feature if available
   * @param featureName - Name of the feature
   * @returns Fallback feature name or null if no fallback
   */
  public static async getFeatureFallback(featureName: string): Promise<string | null> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    
    // Check if feature exists
    const feature = features[featureName];
    if (!feature) return null;
    
    // Check if feature is available
    if (this._availableFeatures.has(featureName)) return null;
    
    // Return fallback if defined
    return feature.fallback || null;
  }
  
  /**
   * Get the optimal UI component for the device's capabilities
   * @param componentType - Type of UI component
   * @returns Component identifier suitable for the device
   */
  public static async getOptimalUIComponent(componentType: string): Promise<string> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    
    // Check if component type exists
    const componentVariants = uiComponents[componentType as keyof typeof uiComponents];
    if (!componentVariants) {
      throw new Error(`Unknown UI component type: ${componentType}`);
    }
    
    // Return component variant for current tier
    return componentVariants[this._deviceTier] || componentVariants[DeviceTier.LOW];
  }
  
  /**
   * Check if a critical feature requires server-side fallback
   * @param featureName - Name of the feature to check
   * @returns Whether server-side fallback is required
   */
  public static async requiresServerFallback(featureName: string): Promise<boolean> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    
    // Check if feature exists
    const feature = features[featureName];
    if (!feature) return false;
    
    // If feature is not critical, no fallback required
    if (!feature.critical) return false;
    
    // If feature is available, no fallback required
    if (this._availableFeatures.has(featureName)) return false;
    
    // Feature is critical and not available, server fallback required
    return true;
  }
  
  /**
   * Detect available features based on device capabilities
   */
  private static async _detectFeatures(): Promise<void> {
    try {
      // First detect basic capabilities
      this._detectBaseCapabilities();
      
      // Then determine features based on device tier
      this._detectFeaturesForTier(this._deviceTier);
      
      // Override with user preferences where applicable
      this._applyUserPreferences();
    } catch (error) {
      console.error('Error detecting features:', error);
    }
  }
  
  /**
   * Detect base device capabilities
   */
  private static _detectBaseCapabilities(): void {
    // Reset capabilities
    this._detectedCapabilities.clear();
    
    // WebAssembly support
    this._detectedCapabilities.set(
      'webassembly', 
      typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function'
    );
    
    // Web Crypto API
    this._detectedCapabilities.set(
      'webcrypto',
      typeof window.crypto !== 'undefined' && typeof window.crypto.subtle !== 'undefined'
    );
    
    // Web Workers
    this._detectedCapabilities.set(
      'webworkers',
      typeof Worker === 'function'
    );
    
    // IndexedDB for local storage
    this._detectedCapabilities.set(
      'indexeddb',
      typeof window.indexedDB !== 'undefined'
    );
    
    // Service Workers for offline
    this._detectedCapabilities.set(
      'serviceworkers',
      'serviceWorker' in navigator
    );
    
    // SharedArrayBuffer for advanced memory operations
    this._detectedCapabilities.set(
      'sharedarraybuffer',
      typeof SharedArrayBuffer === 'function'
    );
    
    // Check for mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this._detectedCapabilities.set('mobile', isMobile);
    
    // Check for low memory device
    const isLowMemory = isMobile || ((navigator as any).deviceMemory && (navigator as any).deviceMemory < 4);
    this._detectedCapabilities.set('lowmemory', isLowMemory);
  }
  
  /**
   * Determine available features based on device tier
   * @param tier - Device tier
   */
  private static _detectFeaturesForTier(tier: DeviceTier): void {
    // Reset available features
    this._availableFeatures.clear();
    
    // Add features available for this tier
    for (const [featureName, featureInfo] of Object.entries(features)) {
      // Check if device tier meets minimum requirements
      const tierMeetsRequirement = this._compareTiers(tier, featureInfo.minimumTier) >= 0;
      
      // For features that require specific capabilities, check them
      let capabilitiesAvailable = true;
      
      // Example: parallelProcessing requires webworkers
      if (featureName === 'parallelProcessing' && !this._detectedCapabilities.get('webworkers')) {
        capabilitiesAvailable = false;
      }
      
      // Example: localCaching requires indexeddb
      if (featureName === 'localCaching' && !this._detectedCapabilities.get('indexeddb')) {
        capabilitiesAvailable = false;
      }
      
      // Example: offlineOperation requires serviceworkers
      if (featureName === 'offlineOperation' && !this._detectedCapabilities.get('serviceworkers')) {
        capabilitiesAvailable = false;
      }
      
      // Basic functionality always requires WebAssembly
      if ((featureName === 'standardProof' || featureName === 'thresholdProof' || featureName === 'maximumProof') 
          && !this._detectedCapabilities.get('webassembly')) {
        capabilitiesAvailable = false;
      }
      
      // Add feature if requirements are met
      if (tierMeetsRequirement && capabilitiesAvailable) {
        this._availableFeatures.add(featureName);
      }
    }
  }
  
  /**
   * Apply user preferences to override detected features
   */
  private static _applyUserPreferences(): void {
    try {
      // Check for explicit feature preferences
      const showHardwareCapabilities = UserPreferences.get('showHardwareCapabilities');
      const enableDetailedProgress = UserPreferences.get('enableDetailedProgress');
      
      // Override features based on user preferences
      if (!showHardwareCapabilities) {
        this._availableFeatures.delete('advancedVisualization');
      }
      
      if (!enableDetailedProgress) {
        this._availableFeatures.delete('detailedProgress');
      }
      
      // User preference for server fallback
      const useServerFallback = UserPreferences.get('useServerFallback');
      if (useServerFallback) {
        // Ensure critical features that might not be available locally
        // are marked for server fallback
        for (const [featureName, featureInfo] of Object.entries(features)) {
          if (featureInfo.critical && !this._availableFeatures.has(featureName)) {
            // Add as requiring server fallback
            this._availableFeatures.delete(featureName);
          }
        }
      }
    } catch (error) {
      console.warn('Error applying user preferences to features:', error);
    }
  }
  
  /**
   * Compare device tiers
   * @param tierA - First tier
   * @param tierB - Second tier
   * @returns -1 if A < B, 0 if A = B, 1 if A > B
   */
  private static _compareTiers(tierA: DeviceTier, tierB: DeviceTier): number {
    const tierValues = {
      [DeviceTier.LowEnd]: 0,
      [DeviceTier.MidRange]: 1,
      [DeviceTier.HighEnd]: 2
    };
    
    return tierValues[tierA] - tierValues[tierB];
  }
  
  /**
   * Get a list of all available features
   * @returns Array of available feature names
   */
  public static async getAvailableFeatures(): Promise<string[]> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    
    return Array.from(this._availableFeatures);
  }
  
  /**
   * Get a list of all features requiring server fallback
   * @returns Array of feature names requiring server fallback
   */
  public static async getServerFallbackFeatures(): Promise<string[]> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    
    const fallbackFeatures: string[] = [];
    
    for (const [featureName, featureInfo] of Object.entries(features)) {
      if (featureInfo.critical && !this._availableFeatures.has(featureName)) {
        fallbackFeatures.push(featureName);
      }
    }
    
    return fallbackFeatures;
  }
  
  /**
   * Get current feature flags based on device capabilities
   * @returns Feature flags object
   */
  public static async getFeatureFlags(): Promise<FeatureFlags> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    
    // Default all to false
    const flags: FeatureFlags = {
      advancedVisualization: false,
      detailedProgress: false,
      realTimeUpdates: false,
      parallelProcessing: false,
      backgroundProcessing: false,
      localCaching: false,
      batchProofGeneration: false,
      offlineOperation: false,
      complexCircuits: false
    };
    
    // Set flags based on available features
    if (this._availableFeatures.has('advancedVisualization')) flags.advancedVisualization = true;
    if (this._availableFeatures.has('detailedProgress')) flags.detailedProgress = true;
    if (this._availableFeatures.has('realTimeUpdates')) flags.realTimeUpdates = true;
    if (this._availableFeatures.has('parallelProcessing')) flags.parallelProcessing = true;
    if (this._availableFeatures.has('backgroundProcessing')) flags.backgroundProcessing = true;
    if (this._availableFeatures.has('localCaching')) flags.localCaching = true;
    if (this._availableFeatures.has('batchProofGeneration')) flags.batchProofGeneration = true;
    if (this._availableFeatures.has('offlineOperation')) flags.offlineOperation = true;
    if (this._availableFeatures.has('complexCircuits')) flags.complexCircuits = true;
    
    return flags;
  }

  /**
   * Get detailed information about device capabilities
   * @returns Device capability information
   */
  public static async getDeviceCapabilityReport(): Promise<{
    tier: DeviceTier;
    capabilities: Record<string, boolean>;
    availableFeatures: string[];
    unavailableFeatures: string[];
    serverFallbackFeatures: string[];
  }> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    
    const availableFeatures = Array.from(this._availableFeatures);
    const allFeatures = Object.keys(features);
    const unavailableFeatures = allFeatures.filter(f => !this._availableFeatures.has(f));
    const serverFallbackFeatures = await this.getServerFallbackFeatures();
    
    return {
      tier: this._deviceTier,
      capabilities: Object.fromEntries(this._detectedCapabilities),
      availableFeatures,
      unavailableFeatures,
      serverFallbackFeatures
    };
  }
}

export default ProgressiveEnhancement;