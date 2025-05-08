/**
 * Utilities for device detection and capability assessment
 */
import { deviceCapabilities } from '@proof-of-funds/common/zk-core';

/**
 * Detect user's device capabilities for optimizing application performance
 * @returns {Object} The detected device capabilities
 */
export function detectDeviceCapabilities() {
  const capabilities = {
    // Memory
    availableMemory: getAvailableMemory(),
    
    // CPU
    cpuCores: getLogicalCoreCount(),
    canUseWorkers: typeof Worker !== 'undefined',
    
    // GPU
    hasWebGLSupport: checkWebGLSupport(),
    
    // Feature detection
    hasWebAssemblySupport: typeof WebAssembly === 'object',
    hasBigIntSupport: typeof BigInt === 'function',
    hasSharedArrayBufferSupport: typeof SharedArrayBuffer === 'function',
    
    // Network capabilities
    connectionType: getConnectionType(),
    
    // Browser info
    browser: detectBrowser(),
    isMobile: isMobileDevice(),
    isTablet: isTabletDevice(),
    isDesktop: !isMobileDevice() && !isTabletDevice(),
  };
  
  // Register with common package for ZK operations
  deviceCapabilities.registerDeviceInfo(capabilities);
  
  return capabilities;
}

/**
 * Get available device memory
 * @returns {number} Available memory in GB or null if not detectable
 */
function getAvailableMemory() {
  // Some browsers support this API
  if (navigator.deviceMemory) {
    return navigator.deviceMemory;
  }
  
  // Fall back to performance API
  if (performance && performance.memory) {
    return Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024 / 1024);
  }
  
  return null;
}

/**
 * Estimate logical CPU core count
 * @returns {number} Estimated core count or null if not detectable
 */
function getLogicalCoreCount() {
  if (navigator.hardwareConcurrency) {
    return navigator.hardwareConcurrency;
  }
  
  return null;
}

/**
 * Check for WebGL support
 * @returns {boolean} Whether WebGL is supported
 */
function checkWebGLSupport() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext && 
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

/**
 * Get network connection type
 * @returns {string} Connection type or 'unknown'
 */
function getConnectionType() {
  if (navigator.connection && navigator.connection.effectiveType) {
    return navigator.connection.effectiveType;
  }
  
  return 'unknown';
}

/**
 * Detect current browser
 * @returns {string} Browser name and version
 */
function detectBrowser() {
  const userAgent = navigator.userAgent;
  
  // Detect common browsers
  if (userAgent.indexOf('Firefox') > -1) {
    return 'Firefox';
  } else if (userAgent.indexOf('Chrome') > -1) {
    return 'Chrome';
  } else if (userAgent.indexOf('Safari') > -1) {
    return 'Safari';
  } else if (userAgent.indexOf('Edge') > -1 || userAgent.indexOf('Edg/') > -1) {
    return 'Edge';
  } else if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) {
    return 'Opera';
  } else if (userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident/') > -1) {
    return 'Internet Explorer';
  }
  
  return 'Unknown';
}

/**
 * Check if current device is mobile
 * @returns {boolean} Whether the device is mobile
 */
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && 
         !isTabletDevice();
}

/**
 * Check if current device is a tablet
 * @returns {boolean} Whether the device is a tablet
 */
function isTabletDevice() {
  return /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
}