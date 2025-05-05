/**
 * TypeScript type definitions for deviceCapabilities
 */

/**
 * Device capabilities detection results
 */
export interface DeviceCapabilityResults {
  cpuCores: number;
  cpuClass: 'low' | 'medium' | 'high';
  availableMemory: number;
  memoryLimit: number;
  storageQuota: number;
  persistentStorage: boolean;
  supportsWebAssembly: boolean;
  supportsWebCrypto: boolean;
  supportsWebWorkers: boolean;
  supportsSharedArrayBuffer: boolean;
  supportsIndexedDB: boolean;
  deviceCategory: 'desktop' | 'mobile' | 'tablet' | 'server' | 'unknown';
  connectionType?: string;
  bandwidth?: number;
  offline: boolean;
}

/**
 * WebAssembly capabilities
 */
export interface WebAssemblyCapabilities {
  supported: boolean;
  version: string;
  features: {
    bulkMemory: boolean;
    simd: boolean;
    threads: boolean;
    reference_types: boolean;
    exception_handling: boolean;
  };
}

/**
 * Memory thresholds for different operations
 */
export interface MemoryThresholds {
  STANDARD_PROOF: number;
  MAXIMUM_PROOF: number;
  THRESHOLD_PROOF: number;
  VERIFICATION: number;
  MINIMUM_VIABLE: number;
}

/**
 * CPU thresholds for different operations
 */
export interface CPUThresholds {
  SINGLE_CORE: number;
  DUAL_CORE: number;
  QUAD_CORE: number;
  OCTA_CORE: number;
}

/**
 * Device Capabilities API
 */
export interface DeviceCapabilities {
  /** Constants for memory thresholds */
  MEMORY_THRESHOLDS: MemoryThresholds;
  
  /** Constants for CPU thresholds */
  CPU_THRESHOLDS: CPUThresholds;
  
  /** Detect all device capabilities */
  detectCapabilities(): Promise<DeviceCapabilityResults>;
  
  /** Get current device capabilities */
  getDeviceCapabilities(): DeviceCapabilityResults;
  
  /** Detect WebAssembly support and features */
  detectWebAssembly(): Promise<WebAssemblyCapabilities>;
  
  /** Detect Web Crypto API support */
  detectWebCrypto(): Promise<{ supported: boolean; algorithms: string[] }>;
  
  /** Detect Web Workers support */
  detectWebWorkers(): Promise<{ supported: boolean; maxWorkers: number }>;
  
  /** Detect available memory */
  detectAvailableMemory(): Promise<{ availableMemory: number; memoryLimit: number }>;
  
  /** Detect available storage */
  detectAvailableStorage(): Promise<{ quota: number; persistent: boolean }>;
  
  /** Check if the current device can run a specific proof type */
  canRunProofType(proofType: string): boolean;
  
  /** Get recommended settings for the current device */
  getRecommendedSettings(): {
    useWebWorkers: boolean;
    workerCount: number;
    useCompression: boolean;
    offloadToServer: boolean;
    memoryLimit: number;
  };
  
  /** Monitor resource usage during operations */
  monitorResourceUsage(callback: (usage: {
    cpuUsage: number;
    memoryUsage: number;
    executionTime: number;
  }) => void): { stop: () => void };
}

// Default export for ESM compatibility
const deviceCapabilities: DeviceCapabilities;
export default deviceCapabilities;