/**
 * Comprehensive tests for the Dynamic Resource Allocation components:
 * - ResourceMonitor
 * - ResourceAllocator
 * - AdaptiveComputation
 * - ResourcePrediction
 */

const { ResourceMonitor } = require('../../src/resources/cjs/ResourceMonitor.cjs');
const { deviceCapabilities } = require('../../src/deviceCapabilities');

// Mock device capabilities
jest.mock('../../src/deviceCapabilities', () => ({
  deviceCapabilities: {
    getMemoryLimit: jest.fn().mockReturnValue(8 * 1024 * 1024 * 1024), // 8 GB
    getCpuCores: jest.fn().mockReturnValue(8), // 8 cores
    getStorageLimit: jest.fn().mockReturnValue(512 * 1024 * 1024 * 1024), // 512 GB
    getNetworkBandwidth: jest.fn().mockReturnValue(10 * 1024 * 1024), // 10 MB/s
    hasGpu: jest.fn().mockReturnValue(false),
    isInBrowser: jest.fn().mockReturnValue(false),
    isWebWorker: jest.fn().mockReturnValue(false),
    isMobile: jest.fn().mockReturnValue(false),
    isNodeJS: jest.fn().mockReturnValue(true),
    getOsInfo: jest.fn().mockReturnValue({ platform: 'linux', version: '10' }),
  }
}));

describe('ResourceMonitor', () => {
  let resourceMonitor;

  beforeEach(() => {
    resourceMonitor = new ResourceMonitor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('initializes with default configuration', () => {
    expect(resourceMonitor).toBeDefined();
  });

  test('samples resources successfully', async () => {
    const resources = await resourceMonitor.sampleResources();
    expect(resources).toBeDefined();
    expect(resources.memory).toBeDefined();
    expect(resources.cpu).toBeDefined();
  });

  test('registers and calls callback on resource updates', async () => {
    const callbackMock = jest.fn();
    resourceMonitor.registerCallback(callbackMock);
    
    // Simulate a resource update
    await resourceMonitor.sampleResources();
    
    // Force a callback trigger
    await resourceMonitor.notifyListeners();
    
    expect(callbackMock).toHaveBeenCalled();
  });

  test('unregisters callbacks correctly', async () => {
    const callbackMock = jest.fn();
    const callbackId = resourceMonitor.registerCallback(callbackMock);
    
    resourceMonitor.unregisterCallback(callbackId);
    
    // Force a callback trigger
    await resourceMonitor.notifyListeners();
    
    expect(callbackMock).not.toHaveBeenCalled();
  });

  test('handles battery information correctly when available', async () => {
    // Mock battery API if available
    const originalNavigator = global.navigator;
    global.navigator = { 
      ...originalNavigator,
      getBattery: jest.fn().mockResolvedValue({
        level: 0.75,
        charging: true,
        chargingTime: 1800,
        dischargingTime: 3600
      })
    };
    
    const batteryAwareMonitor = new ResourceMonitor({ enableBatteryMonitoring: true });
    const resources = await batteryAwareMonitor.sampleResources();
    
    expect(resources.battery).toBeDefined();
    if (resources.battery) {
      expect(resources.battery.level).toBeCloseTo(75); // 75%
      expect(resources.battery.charging).toBe(true);
    }
    
    // Restore original navigator
    global.navigator = originalNavigator;
  });

  test('handles system load calculation', async () => {
    const load = await resourceMonitor.getSystemLoad();
    expect(typeof load).toBe('number');
    expect(load).toBeGreaterThanOrEqual(0);
    expect(load).toBeLessThanOrEqual(1);
  });
});

