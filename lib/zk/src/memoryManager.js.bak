/**
 * Memory Management for Zero-Knowledge Operations
 * 
 * Pure ESM version that acts as a re-export of the .mjs implementation.
 * This file ensures proper ESM compatibility and avoids mixing module formats.
 */

// Import the actual implementation from the .mjs file
import memoryManagerModule from './memoryManager.mjs';

// Re-export everything from the module
export const {
  suggestGarbageCollection,
  secureMemoryWipe,
  getMemoryUsage,
  checkMemoryAvailability,
  startMemoryMonitoring,
  stopMemoryMonitoring,
  runWithMemoryControl
} = memoryManagerModule;

// Default export for compatibility
export default memoryManagerModule;