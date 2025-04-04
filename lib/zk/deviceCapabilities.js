/**
 * deviceCapabilities.js - Detects device capabilities for ZK operations
 * 
 * This module provides functions to detect device capabilities such as available memory,
 * CPU cores, and WebAssembly support. It helps determine if client-side ZK operations
 * are feasible or if server-side fallback should be used.
 * 
 * Version: 1.0.0
 */

// Memory thresholds (in MB)
const MEMORY_THRESHOLDS = {
  LOW: 4 * 1024,     // 4GB - below this is considered low memory
  LIMITED: 8 * 1024, // 8GB - below this is considered limited memory
};

// CPU core thresholds
const CPU_THRESHOLDS = {
  LOW: 2,     // Below 2 cores is considered low
  LIMITED: 4, // Below 4 cores is considered limited
};

/**
 * Device capability result structure
 * @typedef {Object} DeviceCapabilities
 * @property {boolean} supportsWebAssembly - Whether the device supports WebAssembly
 * @property {boolean} supportsWebCrypto - Whether the device supports Web Crypto API
 * @property {boolean} supportsWebWorkers - Whether the device supports Web Workers
 * @property {number|null} availableMemory - Available memory in MB (if detectable)
 * @property {number|null} cpuCores - Number of CPU cores (if detectable)
 * @property {boolean} hasLowMemory - Whether the device has low memory
 * @property {boolean} hasLimitedMemory - Whether the device has limited memory
 * @property {boolean} hasLowCPU - Whether the device has low CPU
 * @property {string} deviceClass - Device class categorization
 * @property {boolean} recommendServerSide - Whether server-side processing is recommended
 * @property {Object} memoryRequirements - Memory requirements for different operations
 */

/**
 * Detect WebAssembly support
 * @returns {boolean} True if WebAssembly is supported
 */
function detectWebAssembly() {
  try {
    // Check for basic WebAssembly support
    if (typeof WebAssembly !== 'object') {
      return false;
    }
    
    // Check if WebAssembly can be instantiated
    const module = new WebAssembly.Module(
      new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])
    );
    const instance = new WebAssembly.Instance(module);
    return typeof instance === 'object';
  } catch (e) {
    return false;
  }
}

/**
 * Detect Web Crypto API support
 * @returns {boolean} True if Web Crypto API is supported
 */
function detectWebCrypto() {
  return !!(
    typeof window !== 'undefined' && 
    window.crypto && 
    window.crypto.subtle
  );
}

/**
 * Detect Web Workers support
 * @returns {boolean} True if Web Workers are supported
 */
function detectWebWorkers() {
  return typeof Worker !== 'undefined';
}

/**
 * Detect device memory
 * @returns {number|null} Available memory in MB or null if not detectable
 */
function detectDeviceMemory() {
  try {
    // Use navigator.deviceMemory if available (Chrome, Edge)
    if (navigator && navigator.deviceMemory) {
      // navigator.deviceMemory returns memory in GB, convert to MB
      return navigator.deviceMemory * 1024;
    }
    
    // Use performance.memory if available (Chrome)
    if (
      performance && 
      performance.memory && 
      performance.memory.jsHeapSizeLimit
    ) {
      // Convert bytes to MB
      return Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024));
    }
    
    // If we can't detect memory, return null
    return null;
  } catch (e) {
    console.warn('Error detecting device memory:', e);
    return null;
  }
}

/**
 * Detect CPU cores
 * @returns {number|null} Number of CPU cores or null if not detectable
 */
function detectCPUCores() {
  try {
    if (navigator && navigator.hardwareConcurrency) {
      return navigator.hardwareConcurrency;
    }
    
    // If we can't detect CPU cores, return null
    return null;
  } catch (e) {
    console.warn('Error detecting CPU cores:', e);
    return null;
  }
}

/**
 * Detect browser type and version
 * @returns {Object} Browser information
 */
function detectBrowser() {
  const userAgent = navigator.userAgent;
  let browser = 'unknown';
  let version = 'unknown';
  
  // Detect Chrome
  if (/Chrome/.test(userAgent) && !/Chromium|Edge|Edg/.test(userAgent)) {
    browser = 'chrome';
    version = userAgent.match(/Chrome\/(\d+\.\d+)/)?.[1] || 'unknown';
  }
  // Detect Firefox
  else if (/Firefox/.test(userAgent)) {
    browser = 'firefox';
    version = userAgent.match(/Firefox\/(\d+\.\d+)/)?.[1] || 'unknown';
  }
  // Detect Safari
  else if (/Safari/.test(userAgent) && !/Chrome|Chromium|Edge|Edg/.test(userAgent)) {
    browser = 'safari';
    version = userAgent.match(/Version\/(\d+\.\d+)/)?.[1] || 'unknown';
  }
  // Detect Edge (new Chromium-based)
  else if (/Edg/.test(userAgent)) {
    browser = 'edge';
    version = userAgent.match(/Edg\/(\d+\.\d+)/)?.[1] || 'unknown';
  }
  // Detect IE
  else if (/Trident/.test(userAgent)) {
    browser = 'ie';
    version = userAgent.match(/rv:(\d+\.\d+)/)?.[1] || 'unknown';
  }
  
  // Detect if mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  return {
    name: browser,
    version,
    isMobile
  };
}

/**
 * Get device class based on capabilities
 * @param {Object} capabilities - Device capabilities
 * @returns {string} Device class: 'high', 'medium', 'low', or 'incompatible'
 */
function getDeviceClass(capabilities) {
  // If essential features are not supported, device is incompatible
  if (!capabilities.supportsWebAssembly || !capabilities.supportsWebCrypto) {
    return 'incompatible';
  }
  
  // High-end device: good memory, cores, and all features
  if (
    !capabilities.hasLowMemory && 
    !capabilities.hasLimitedMemory && 
    !capabilities.hasLowCPU && 
    capabilities.supportsWebWorkers
  ) {
    return 'high';
  }
  
  // Low-end device: low memory or CPU
  if (capabilities.hasLowMemory || capabilities.hasLowCPU) {
    return 'low';
  }
  
  // Medium device: limited memory or limited CPU
  return 'medium';
}

/**
 * Check if server-side processing is recommended
 * @param {Object} capabilities - Device capabilities
 * @param {string} operation - Operation type: 'standard', 'threshold', 'maximum', or 'batch'
 * @returns {boolean} True if server-side processing is recommended
 */
function shouldUseServerSide(capabilities, operation) {
  const deviceClass = capabilities.deviceClass;
  
  // Incompatible devices always use server-side
  if (deviceClass === 'incompatible') {
    return true;
  }
  
  // Low-end devices use server-side for everything except simple verification
  if (deviceClass === 'low') {
    return operation !== 'verify-simple';
  }
  
  // Medium devices use server-side for complex operations
  if (deviceClass === 'medium') {
    return operation === 'batch' || operation === 'maximum';
  }
  
  // Browser-specific rules
  const browser = detectBrowser();
  
  // Safari often has memory issues with WebAssembly
  if (browser.name === 'safari') {
    return operation === 'batch';
  }
  
  // Mobile devices have more constraints
  if (browser.isMobile) {
    return operation === 'batch' || operation === 'maximum';
  }
  
  // High-end devices can handle client-side processing
  return false;
}

/**
 * Calculate memory requirements for different ZK operations
 * @param {string} circuitType - Type of circuit: 'standard', 'threshold', 'maximum'
 * @param {string} operation - Operation type: 'prove', 'verify', 'batch'
 * @param {number} [batchSize=1] - Number of proofs in a batch operation
 * @returns {number} Estimated memory requirement in MB
 */
function calculateMemoryRequirements(circuitType, operation, batchSize = 1) {
  // Base memory requirements in MB for different operations and circuit types
  const baseRequirements = {
    standard: {
      prove: 300,
      verify: 100
    },
    threshold: {
      prove: 500,
      verify: 150
    },
    maximum: {
      prove: 500,
      verify: 150
    }
  };
  
  // Get base requirement
  const base = baseRequirements[circuitType]?.[operation] || 500;
  
  // Batch operations scale with batch size, but not linearly
  if (operation === 'batch') {
    // We use a sublinear scaling factor to account for optimization in batch operations
    return Math.ceil(base * batchSize * 0.7);
  }
  
  return base;
}

/**
 * Get comprehensive device capabilities
 * @returns {DeviceCapabilities} Device capabilities
 */
function getDeviceCapabilities() {
  const supportsWebAssembly = detectWebAssembly();
  const supportsWebCrypto = detectWebCrypto();
  const supportsWebWorkers = detectWebWorkers();
  const availableMemory = detectDeviceMemory();
  const cpuCores = detectCPUCores();
  
  // Determine memory and CPU constraints
  const hasLowMemory = availableMemory !== null ? 
    availableMemory < MEMORY_THRESHOLDS.LOW : false;
  
  const hasLimitedMemory = availableMemory !== null ? 
    availableMemory < MEMORY_THRESHOLDS.LIMITED : false;
  
  const hasLowCPU = cpuCores !== null ? 
    cpuCores < CPU_THRESHOLDS.LOW : false;
  
  const hasLimitedCPU = cpuCores !== null ? 
    cpuCores < CPU_THRESHOLDS.LIMITED : false;
  
  // Compile capabilities
  const capabilities = {
    supportsWebAssembly,
    supportsWebCrypto,
    supportsWebWorkers,
    availableMemory,
    cpuCores,
    hasLowMemory,
    hasLimitedMemory,
    hasLowCPU,
    hasLimitedCPU,
    browser: detectBrowser()
  };
  
  // Get device class
  capabilities.deviceClass = getDeviceClass(capabilities);
  
  // Determine if server-side processing is recommended by default
  capabilities.recommendServerSide = (
    capabilities.deviceClass === 'incompatible' || 
    capabilities.deviceClass === 'low'
  );
  
  // Calculate memory requirements for different operations
  capabilities.memoryRequirements = {
    standard: {
      prove: calculateMemoryRequirements('standard', 'prove'),
      verify: calculateMemoryRequirements('standard', 'verify')
    },
    threshold: {
      prove: calculateMemoryRequirements('threshold', 'prove'),
      verify: calculateMemoryRequirements('threshold', 'verify')
    },
    maximum: {
      prove: calculateMemoryRequirements('maximum', 'prove'),
      verify: calculateMemoryRequirements('maximum', 'verify')
    },
    batch: {
      prove10: calculateMemoryRequirements('standard', 'batch', 10),
      verify10: calculateMemoryRequirements('standard', 'batch', 10)
    }
  };
  
  return capabilities;
}

/**
 * Check if a specific ZK operation can be performed client-side
 * @param {string} operation - Operation to check ('standard-prove', 'threshold-verify', etc.)
 * @returns {boolean} True if the operation can be performed client-side
 */
function canRunClientSide(operation) {
  const capabilities = getDeviceCapabilities();
  
  const [circuitType, operationType] = operation.split('-');
  
  return !shouldUseServerSide(capabilities, operation);
}

export {
  getDeviceCapabilities,
  canRunClientSide,
  MEMORY_THRESHOLDS,
  CPU_THRESHOLDS,
  calculateMemoryRequirements
};

export default {
  getDeviceCapabilities,
  canRunClientSide,
  MEMORY_THRESHOLDS,
  CPU_THRESHOLDS,
  calculateMemoryRequirements
};