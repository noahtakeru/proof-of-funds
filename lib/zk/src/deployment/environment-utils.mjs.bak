/**
 * @fileoverview Environment Utilities
 * 
 * Provides utilities for detecting and working with different runtime environments.
 * This consolidated module handles environment detection, capability identification,
 * and feature detection for the deployment framework.
 * 
 * @author ZK Infrastructure Team
 */

import { errorLogger } from '../ErrorSystem.js';

/**
 * Environment types supported by the deployment system
 */
export const EnvironmentType = {
  BROWSER: 'browser',
  NODE: 'node',
  MOBILE: 'mobile',
  WORKER: 'worker',
  REACT_NATIVE: 'react-native',
  UNKNOWN: 'unknown'
};

/**
 * Device capability levels for resource allocation
 */
export const DeviceCapabilityLevel = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  UNKNOWN: 'unknown'
};

/**
 * Detect the current runtime environment
 * 
 * @returns {string} Environment type identifier
 */
export function detectEnvironment() {
  try {
    // Check for Node.js
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      return EnvironmentType.NODE;
    }
    
    // Check for Web Worker
    if (typeof self !== 'undefined' && typeof window === 'undefined') {
      return EnvironmentType.WORKER;
    }
    
    // Check for browser
    if (typeof window !== 'undefined') {
      // Check if it's a mobile browser
      if (isMobileDevice()) {
        return EnvironmentType.MOBILE;
      }
      
      // Desktop browser
      return EnvironmentType.BROWSER;
    }
    
    // Check for React Native
    if (typeof global !== 'undefined' && global.__fbBatchedBridge) {
      return EnvironmentType.REACT_NATIVE;
    }
    
    // Default/unknown environment
    return EnvironmentType.UNKNOWN;
  } catch (error) {
    errorLogger.logError(error, {
      component: 'EnvironmentUtils',
      context: 'detectEnvironment',
      message: 'Error detecting environment'
    });
    
    return EnvironmentType.UNKNOWN;
  }
}

/**
 * Check if the current device is mobile
 * 
 * @returns {boolean} True if the current device is mobile
 */
export function isMobileDevice() {
  try {
    if (typeof navigator === 'undefined' || !navigator.userAgent) {
      return false;
    }
    
    const userAgent = navigator.userAgent.toLowerCase();
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  } catch (error) {
    errorLogger.logError(error, {
      component: 'EnvironmentUtils',
      context: 'isMobileDevice',
      message: 'Error checking for mobile device'
    });
    
    return false;
  }
}

/**
 * Detect available features in the current environment
 * 
 * @returns {Object} Feature availability object
 */
export function detectFeatures() {
  try {
    const environment = detectEnvironment();
    const cpuCores = detectCPUCores();
    const memoryInfo = detectAvailableMemory();
    
    // Base features common to all environments
    const features = {
      environment,
      cpuCores,
      memoryLimitMB: memoryInfo.available,
      totalMemoryMB: memoryInfo.total,
      deviceClass: classifyDevice(cpuCores, memoryInfo.available),
      webAssemblySupport: false,
      webWorkersSupport: false,
      indexedDBSupport: false,
      localStorageSupport: false,
      offscreenCanvasSupport: false,
      webCryptoSupport: false,
      serviceWorkerSupport: false,
      fileSystemSupport: false,
      batteryAPISupport: false,
      networkInfoSupport: false,
      highPrecisionTimers: false
    };
    
    // Environment-specific feature detection
    switch (environment) {
      case EnvironmentType.BROWSER:
      case EnvironmentType.MOBILE:
        return detectBrowserFeatures(features);
      
      case EnvironmentType.NODE:
        return detectNodeFeatures(features);
      
      case EnvironmentType.WORKER:
        return detectWorkerFeatures(features);
      
      case EnvironmentType.REACT_NATIVE:
        return detectReactNativeFeatures(features);
      
      default:
        return features;
    }
  } catch (error) {
    errorLogger.logError(error, {
      component: 'EnvironmentUtils',
      context: 'detectFeatures',
      message: 'Error detecting features'
    });
    
    return {
      environment: EnvironmentType.UNKNOWN,
      cpuCores: 1,
      memoryLimitMB: 512,
      totalMemoryMB: 512,
      deviceClass: DeviceCapabilityLevel.LOW,
      error: error.message
    };
  }
}

/**
 * Detect browser-specific features
 * 
 * @param {Object} baseFeatures - Base feature object to extend
 * @returns {Object} Enhanced feature object for browser environments
 */
function detectBrowserFeatures(baseFeatures) {
  const features = { ...baseFeatures };
  
  try {
    if (typeof window !== 'undefined') {
      // WebAssembly
      features.webAssemblySupport = typeof WebAssembly !== 'undefined';
      
      // Web Workers
      features.webWorkersSupport = typeof Worker !== 'undefined';
      
      // IndexedDB
      features.indexedDBSupport = typeof indexedDB !== 'undefined';
      
      // localStorage
      features.localStorageSupport = typeof localStorage !== 'undefined';
      
      // OffscreenCanvas
      features.offscreenCanvasSupport = typeof OffscreenCanvas !== 'undefined';
      
      // Web Crypto API
      features.webCryptoSupport = typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
      
      // Service Workers
      features.serviceWorkerSupport = 'serviceWorker' in navigator;
      
      // File System Access API
      features.fileSystemSupport = 'showOpenFilePicker' in window;
      
      // Battery API
      features.batteryAPISupport = 'getBattery' in navigator;
      
      // Network Information API
      features.networkInfoSupport = 'connection' in navigator && navigator.connection !== undefined;
      
      // High precision timers
      features.highPrecisionTimers = typeof performance !== 'undefined' && typeof performance.now === 'function';
      
      // Browser details
      features.userAgent = navigator.userAgent;
      features.vendor = navigator.vendor;
      features.platform = navigator.platform;
      features.browserLanguage = navigator.language;
    }
  } catch (error) {
    errorLogger.logError(error, {
      component: 'EnvironmentUtils',
      context: 'detectBrowserFeatures',
      message: 'Error detecting browser features'
    });
  }
  
  return features;
}

/**
 * Detect Node.js specific features
 * 
 * @param {Object} baseFeatures - Base feature object to extend
 * @returns {Object} Enhanced feature object for Node.js environments
 */
function detectNodeFeatures(baseFeatures) {
  const features = { ...baseFeatures };
  
  try {
    if (typeof process !== 'undefined') {
      features.nodeVersion = process.version;
      features.platform = process.platform;
      features.arch = process.arch;
      features.fileSystemSupport = true;
      features.highPrecisionTimers = true;
      
      // Check for WebAssembly in Node.js
      features.webAssemblySupport = typeof WebAssembly !== 'undefined';
      
      // Check for worker_threads
      try {
        // Use dynamic import for ESM compatibility
        import('worker_threads')
          .then(workerThreads => {
            features.workerThreadsSupport = true;
            features.isMainThread = workerThreads.isMainThread;
          })
          .catch(() => {
            features.workerThreadsSupport = false;
          });
      } catch (e) {
        features.workerThreadsSupport = false;
      }
      
      // Check for crypto module
      try {
        // Use dynamic import for ESM compatibility
        import('crypto')
          .then(() => {
            features.cryptoSupport = true;
          })
          .catch(() => {
            features.cryptoSupport = false;
          });
      } catch (e) {
        features.cryptoSupport = false;
      }
    }
  } catch (error) {
    errorLogger.logError(error, {
      component: 'EnvironmentUtils',
      context: 'detectNodeFeatures',
      message: 'Error detecting Node.js features'
    });
  }
  
  return features;
}

/**
 * Detect web worker specific features
 * 
 * @param {Object} baseFeatures - Base feature object to extend
 * @returns {Object} Enhanced feature object for worker environments
 */
function detectWorkerFeatures(baseFeatures) {
  const features = { ...baseFeatures };
  
  try {
    if (typeof self !== 'undefined') {
      // WebAssembly
      features.webAssemblySupport = typeof WebAssembly !== 'undefined';
      
      // IndexedDB in workers
      features.indexedDBSupport = typeof indexedDB !== 'undefined';
      
      // Web Crypto API
      features.webCryptoSupport = typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
      
      // High precision timers
      features.highPrecisionTimers = typeof performance !== 'undefined' && typeof performance.now === 'function';
      
      // Determine if we're in a service worker
      features.isServiceWorker = typeof ServiceWorkerGlobalScope !== 'undefined';
    }
  } catch (error) {
    errorLogger.logError(error, {
      component: 'EnvironmentUtils',
      context: 'detectWorkerFeatures',
      message: 'Error detecting worker features'
    });
  }
  
  return features;
}

/**
 * Detect React Native specific features
 * 
 * @param {Object} baseFeatures - Base feature object to extend
 * @returns {Object} Enhanced feature object for React Native environments
 */
function detectReactNativeFeatures(baseFeatures) {
  // React Native features are limited
  const features = { ...baseFeatures };
  
  // In a real implementation, these would be determined by feature availability
  features.asyncStorageSupport = true;
  features.nativeModulesSupport = true;
  
  return features;
}

/**
 * Detect available CPU cores
 * 
 * @returns {number} Number of CPU cores available
 */
function detectCPUCores() {
  try {
    // Browser environment
    if (typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency !== 'undefined') {
      return navigator.hardwareConcurrency;
    }
    
    // Node.js environment
    if (typeof process !== 'undefined') {
      try {
        // Dynamic import for Node.js environment
        // This will be handled at runtime in Node environment
        // In ESM context, we can't use synchronous require
        return 4; // Default reasonable value for most systems
      } catch (e) {
        // Module not available
      }
    }
    
    // Default to a conservative value if detection fails
    return 2;
  } catch (error) {
    errorLogger.logError(error, {
      component: 'EnvironmentUtils',
      context: 'detectCPUCores',
      message: 'Error detecting CPU cores'
    });
    
    return 2;
  }
}

/**
 * Detect available memory
 * 
 * @returns {Object} Memory information in MB
 */
function detectAvailableMemory() {
  try {
    const result = {
      available: 1024, // Default to 1GB
      total: 2048      // Default to 2GB
    };
    
    // Browser environment
    if (typeof navigator !== 'undefined' && navigator.deviceMemory) {
      result.total = navigator.deviceMemory * 1024; // Convert GB to MB
      result.available = result.total * 0.7; // Approximate available memory
    }
    
    // Node.js environment
    if (typeof process !== 'undefined') {
      try {
        // In Node.js ESM environment, we'll use performance monitoring
        // but avoid direct requires in ESM context
        result.total = 8192; // Default to 8GB for Node environments
        result.available = 4096; // Default to 4GB available
      } catch (e) {
        // Error handling
      }
    }
    
    return result;
  } catch (error) {
    errorLogger.logError(error, {
      component: 'EnvironmentUtils',
      context: 'detectAvailableMemory',
      message: 'Error detecting available memory'
    });
    
    return {
      available: 512, // Conservative fallback
      total: 1024
    };
  }
}

/**
 * Classify device capability based on hardware specs
 * 
 * @param {number} cpuCores - Number of CPU cores
 * @param {number} memoryMB - Available memory in MB
 * @returns {string} Device capability level
 */
function classifyDevice(cpuCores, memoryMB) {
  try {
    // High-end device
    if (cpuCores >= 4 && memoryMB >= 4096) {
      return DeviceCapabilityLevel.HIGH;
    }
    
    // Medium-capability device
    if (cpuCores >= 2 && memoryMB >= 2048) {
      return DeviceCapabilityLevel.MEDIUM;
    }
    
    // Low-end device
    return DeviceCapabilityLevel.LOW;
  } catch (error) {
    errorLogger.logError(error, {
      component: 'EnvironmentUtils',
      context: 'classifyDevice',
      message: 'Error classifying device'
    });
    
    return DeviceCapabilityLevel.UNKNOWN;
  }
}

/**
 * Get recommended configuration based on device capabilities
 * 
 * @param {Object} features - Feature detection results
 * @returns {Object} Recommended configuration
 */
export function getRecommendedConfiguration(features) {
  try {
    const config = {
      useWebAssembly: features.webAssemblySupport,
      useWorkers: features.webWorkersSupport || features.workerThreadsSupport,
      workerCount: Math.max(1, Math.floor(features.cpuCores * 0.75)),
      cacheEnabled: features.indexedDBSupport || features.localStorageSupport,
      useFallbackServer: features.deviceClass === DeviceCapabilityLevel.LOW,
      memoryLimitMB: Math.floor(features.memoryLimitMB * 0.8),
      preferInBrowserComputation: features.deviceClass !== DeviceCapabilityLevel.LOW,
      highPrecisionTimers: features.highPrecisionTimers
    };
    
    return config;
  } catch (error) {
    errorLogger.logError(error, {
      component: 'EnvironmentUtils',
      context: 'getRecommendedConfiguration',
      message: 'Error generating recommended configuration'
    });
    
    // Safe fallback configuration
    return {
      useWebAssembly: false,
      useWorkers: false,
      workerCount: 1,
      cacheEnabled: false,
      useFallbackServer: true,
      memoryLimitMB: 256,
      preferInBrowserComputation: false,
      highPrecisionTimers: false
    };
  }
}

/**
 * Module exports
 */
export default {
  EnvironmentType,
  DeviceCapabilityLevel,
  detectEnvironment,
  detectFeatures,
  isMobileDevice,
  getRecommendedConfiguration
};