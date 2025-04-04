/**
 * Tests for Memory Manager
 * 
 * These tests verify the functionality of the memory management system,
 * including memory usage monitoring, secure data wiping, and memory-controlled operations.
 */

import { jest } from '@jest/globals';
import {
  suggestGarbageCollection,
  secureMemoryWipe,
  getMemoryUsage,
  checkMemoryAvailability,
  startMemoryMonitoring,
  stopMemoryMonitoring,
  runWithMemoryControl
} from '../memoryManager.js';

// Mock device capabilities
jest.mock('../deviceCapabilities.js', () => ({
  getDeviceCapabilities: jest.fn().mockReturnValue({
    availableMemory: 1024, // Mock 1GB available
    totalMemory: 4096,     // Mock 4GB total
    supportsWebAssembly: true,
    supportsWebCrypto: true,
    supportsWebWorkers: true,
    deviceCategory: 'desktop'
  })
}));

// Test with fake timers for intervals
jest.useFakeTimers();

describe('Memory Manager', () => {
  // Restore original implementation after tests
  let originalConsoleWarn;
  let originalConsoleError;
  let originalProcessMemoryUsage;
  let originalGlobalGc;
  
  beforeEach(() => {
    // Mock console methods to prevent cluttering test output
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    console.warn = jest.fn();
    console.error = jest.fn();
    
    // Mock process.memoryUsage
    if (typeof process !== 'undefined') {
      originalProcessMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 500 * 1024 * 1024,        // 500MB
        heapTotal: 300 * 1024 * 1024,  // 300MB
        heapUsed: 200 * 1024 * 1024,   // 200MB
        external: 50 * 1024 * 1024     // 50MB
      });
    }
    
    // Mock global.gc if it exists
    if (typeof global !== 'undefined' && global.gc) {
      originalGlobalGc = global.gc;
      global.gc = jest.fn();
    }
  });
  
  afterEach(() => {
    // Restore original implementations
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    
    if (typeof process !== 'undefined' && originalProcessMemoryUsage) {
      process.memoryUsage = originalProcessMemoryUsage;
    }
    
    if (typeof global !== 'undefined' && originalGlobalGc) {
      global.gc = originalGlobalGc;
    }
    
    // Stop any monitoring that might be running
    stopMemoryMonitoring();
  });
  
  describe('Memory Usage Tracking', () => {
    it('should return memory usage information', () => {
      const memoryInfo = getMemoryUsage();
      
      // Check structure
      expect(memoryInfo).toHaveProperty('total');
      expect(memoryInfo).toHaveProperty('used');
      expect(memoryInfo).toHaveProperty('available');
      expect(memoryInfo).toHaveProperty('limit');
      
      // Check conversions to MB
      expect(memoryInfo).toHaveProperty('totalMB');
      expect(memoryInfo).toHaveProperty('usedMB');
      expect(memoryInfo).toHaveProperty('availableMB');
      expect(memoryInfo).toHaveProperty('limitMB');
      
      // Verify pressure calculation
      expect(memoryInfo).toHaveProperty('pressurePercentage');
    });
    
    it('should check memory availability against requirements', () => {
      // Check when plenty of memory is available
      const goodResult = checkMemoryAvailability(500);
      expect(goodResult.isAvailable).toBe(true);
      
      // Check when not enough memory is available
      const badResult = checkMemoryAvailability(2000);
      expect(badResult.isAvailable).toBe(false);
      expect(badResult.memoryGapMB).toBeLessThan(0);
    });
    
    it('should monitor memory usage and call callbacks when thresholds are reached', () => {
      // Setup callbacks
      const warningCallback = jest.fn();
      const errorCallback = jest.fn();
      
      // Start monitoring
      const monitor = startMemoryMonitoring(warningCallback, errorCallback, 1000);
      
      // Check structure
      expect(monitor).toHaveProperty('stop');
      expect(monitor).toHaveProperty('checkNow');
      
      // Mock critical memory pressure
      const originalGetMemoryUsage = getMemoryUsage;
      const mockCriticalMemory = {
        total: 300 * 1024 * 1024,
        used: 290 * 1024 * 1024,
        available: 10 * 1024 * 1024, // 10MB - below critical threshold
        limit: 300 * 1024 * 1024,
        totalMB: 300,
        usedMB: 290,
        availableMB: 10,
        limitMB: 300,
        pressurePercentage: 0.97
      };
      
      // Override for testing
      // @ts-ignore
      global.getMemoryUsage = jest.fn().mockReturnValue(mockCriticalMemory);
      
      // Run the check
      monitor.checkNow();
      
      // Error callback should be called, not warning
      expect(errorCallback).toHaveBeenCalledWith(mockCriticalMemory);
      expect(warningCallback).not.toHaveBeenCalled();
      
      // Mock warning-level memory
      const mockWarningMemory = {
        total: 300 * 1024 * 1024,
        used: 230 * 1024 * 1024,
        available: 70 * 1024 * 1024, // 70MB - below warning threshold
        limit: 300 * 1024 * 1024,
        totalMB: 300,
        usedMB: 230,
        availableMB: 70,
        limitMB: 300,
        pressurePercentage: 0.77
      };
      
      // Reset mocks
      errorCallback.mockReset();
      warningCallback.mockReset();
      
      // Override again
      // @ts-ignore
      global.getMemoryUsage = jest.fn().mockReturnValue(mockWarningMemory);
      
      // Run the check
      monitor.checkNow();
      
      // Warning callback should be called, not error
      expect(warningCallback).toHaveBeenCalledWith(mockWarningMemory);
      expect(errorCallback).not.toHaveBeenCalled();
      
      // Restore original
      // @ts-ignore
      global.getMemoryUsage = originalGetMemoryUsage;
      
      // Stop monitoring
      monitor.stop();
    });
    
    it('should stop memory monitoring', () => {
      // Setup monitoring
      const warningCallback = jest.fn();
      const errorCallback = jest.fn();
      startMemoryMonitoring(warningCallback, errorCallback, 1000);
      
      // Stop monitoring
      const stopped = stopMemoryMonitoring();
      
      // Should return true
      expect(stopped).toBe(true);
      
      // Mock critical memory pressure
      const mockCriticalMemory = {
        total: 300 * 1024 * 1024,
        used: 290 * 1024 * 1024,
        available: 10 * 1024 * 1024,
        limit: 300 * 1024 * 1024,
        totalMB: 300,
        usedMB: 290,
        availableMB: 10,
        limitMB: 300,
        pressurePercentage: 0.97
      };
      
      const originalGetMemoryUsage = getMemoryUsage;
      // @ts-ignore
      global.getMemoryUsage = jest.fn().mockReturnValue(mockCriticalMemory);
      
      // Advance timer - should not trigger callbacks after stopping
      jest.advanceTimersByTime(2000);
      
      // No callbacks should be called
      expect(warningCallback).not.toHaveBeenCalled();
      expect(errorCallback).not.toHaveBeenCalled();
      
      // Restore original
      // @ts-ignore
      global.getMemoryUsage = originalGetMemoryUsage;
    });
  });
  
  describe('Memory Operations', () => {
    it('should securely wipe data from memory', () => {
      // Test with Uint8Array
      const array = new Uint8Array(10);
      array.fill(123);
      
      secureMemoryWipe(array);
      
      // Array should be zeroed
      expect(Array.from(array)).toEqual(Array(10).fill(0));
      
      // Test with object
      const obj = {
        secret: 'password',
        nested: {
          moreSecrets: 'api_key'
        }
      };
      
      secureMemoryWipe(obj);
      
      // Object properties should be nullified
      expect(obj.secret).toBeNull();
      expect(obj.nested.moreSecrets).toBeNull();
      
      // Test with array
      const normalArray = [1, 2, { secret: 'hidden' }];
      secureMemoryWipe(normalArray);
      
      // Array should be empty and elements nullified
      expect(normalArray.length).toBe(0);
    });
    
    it('should suggest garbage collection', () => {
      // Mock global.gc if available
      if (typeof global !== 'undefined') {
        global.gc = jest.fn();
      }
      
      // Call function
      const result = suggestGarbageCollection();
      
      // Should always return true
      expect(result).toBe(true);
      
      // Should call global.gc if available
      if (typeof global !== 'undefined' && global.gc) {
        expect(global.gc).toHaveBeenCalled();
      }
    });
    
    it('should run functions with memory control', async () => {
      // Mock function to run
      const testFn = jest.fn().mockResolvedValue('success');
      const cleanup = jest.fn();
      
      // Run with sufficient memory
      const result = await runWithMemoryControl(testFn, 500, { cleanup });
      
      // Function should be called
      expect(testFn).toHaveBeenCalled();
      expect(result).toBe('success');
      
      // Cleanup should be called
      expect(cleanup).toHaveBeenCalled();
      
      // With insufficient memory, should throw error
      await expect(runWithMemoryControl(testFn, 2000)).rejects.toThrow(/Insufficient memory/);
      
      // Unless forceRun is true
      const forceResult = await runWithMemoryControl(testFn, 2000, { forceRun: true });
      expect(forceResult).toBe('success');
      
      // Should handle memory events
      const warningCallback = jest.fn();
      const errorCallback = jest.fn();
      
      // Mock critical memory pressure during operation
      const originalGetMemoryUsage = getMemoryUsage;
      const mockCriticalMemory = {
        total: 300 * 1024 * 1024,
        used: 290 * 1024 * 1024,
        available: 10 * 1024 * 1024,
        limit: 300 * 1024 * 1024,
        totalMB: 300,
        usedMB: 290,
        availableMB: 10,
        limitMB: 300,
        pressurePercentage: 0.97
      };
      
      // Override for testing
      // @ts-ignore
      global.getMemoryUsage = jest.fn().mockReturnValue(mockCriticalMemory);
      
      // Run with callbacks
      await runWithMemoryControl(testFn, 500, {
        onMemoryWarning: warningCallback,
        onMemoryError: errorCallback
      });
      
      // Error callback should be called
      expect(errorCallback).toHaveBeenCalled();
      
      // Restore original
      // @ts-ignore
      global.getMemoryUsage = originalGetMemoryUsage;
    });
  });
});