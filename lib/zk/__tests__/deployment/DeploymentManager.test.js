/**
 * @jest-environment node
 */

import { 
  DeploymentManager, 
  EnvironmentType
} from '../../src/deployment/index';

// Mock EnvironmentDetector
jest.mock('../../src/deployment/EnvironmentDetector', () => {
  return {
    EnvironmentDetector: jest.fn().mockImplementation(() => {
      return {
        detectEnvironment: jest.fn().mockReturnValue(EnvironmentType.Node),
        detectFeatures: jest.fn().mockReturnValue({
          environment: EnvironmentType.Node,
          supportsWebWorkers: false,
          supportsWebAssembly: true,
          supportsIndexedDB: false,
          supportsServiceWorker: false,
          supportsSharedArrayBuffer: true,
          isSecureContext: true,
          supportsLocalStorage: false,
          cpuCores: 4,
          isHighEndDevice: true,
          hasNetwork: true,
          supportsPersistentStorage: true
        })
      };
    })
  };
});

// Mock HealthCheck
jest.mock('../../src/deployment/HealthCheck', () => {
  return {
    HealthCheck: jest.fn().mockImplementation(() => {
      return {
        runChecks: jest.fn().mockResolvedValue({
          status: 'ok',
          checks: {
            test: {
              name: 'test',
              status: 'ok',
              message: 'Test passed',
              timestamp: Date.now()
            }
          },
          timestamp: Date.now()
        }),
        updateConfig: jest.fn()
      };
    })
  };
});

// Mock deviceCapabilities
jest.mock('../../src/deviceCapabilities', () => {
  return {
    getDeviceCapabilities: jest.fn().mockReturnValue({
      cpuCores: 4,
      memory: 8192,
      storageQuota: 1024 * 1024 * 1024,
      persistentStorage: true,
      cpuPerformance: 'high'
    })
  };
});

// Mock zkCircuitRegistry
jest.mock('../../src/zkCircuitRegistry', () => {
  return {
    zkCircuitRegistry: {
      setBasePath: jest.fn(),
      getBasePath: jest.fn()
    }
  };
});

describe('DeploymentManager', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  test('should initialize with default options', () => {
    const manager = new DeploymentManager();
    expect(manager).toBeDefined();
    
    const status = manager.getStatus();
    expect(status.environment).toBe(EnvironmentType.Node);
    expect(status.isReady).toBe(true);
  });
  
  test('should allow overriding environment type', () => {
    const manager = new DeploymentManager({
      environment: EnvironmentType.Browser
    });
    
    const status = manager.getStatus();
    expect(status.environment).toBe(EnvironmentType.Browser);
  });
  
  test('should allow custom configuration', () => {
    const customConfig = {
      workerThreads: 8,
      memoryLimit: 2048,
      logLevel: 'debug'
    };
    
    const manager = new DeploymentManager({
      config: customConfig
    });
    
    const status = manager.getStatus();
    expect(status.config.workerThreads).toBe(8);
    expect(status.config.memoryLimit).toBe(2048);
    expect(status.config.logLevel).toBe('debug');
  });
  
  test('should run health checks on initialization', async () => {
    const manager = new DeploymentManager();
    
    // Health check is run async in the constructor
    // Let's ensure it's initialized
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const status = manager.getStatus();
    expect(status.healthCheck.status).toBe('ok');
    expect(status.healthCheck.checks.test).toBeDefined();
  });
  
  test('should allow running health checks manually', async () => {
    const manager = new DeploymentManager({
      performInitialHealthCheck: false
    });
    
    // Initial status should have unknown health checks
    const initialStatus = manager.getStatus();
    expect(initialStatus.healthCheck.status).toBe('unknown');
    
    // Run health checks manually
    const healthCheckResult = await manager.runHealthCheck();
    expect(healthCheckResult.status).toBe('ok');
    
    // Updated status should reflect health check results
    const updatedStatus = manager.getStatus();
    expect(updatedStatus.healthCheck.status).toBe('ok');
  });
  
  test('should initialize the deployment', async () => {
    const manager = new DeploymentManager({
      performInitialHealthCheck: false
    });
    
    // Initialize the deployment
    const result = await manager.initialize();
    expect(result).toBe(true);
    
    // Status should show as initialized
    const status = manager.getStatus();
    expect(status.isReady).toBe(true);
  });
  
  test('should update configuration', () => {
    const manager = new DeploymentManager();
    
    // Initial configuration
    const initialStatus = manager.getStatus();
    const initialWorkerThreads = initialStatus.config.workerThreads;
    
    // Update configuration
    manager.updateConfig({
      workerThreads: initialWorkerThreads + 2
    });
    
    // Updated configuration should be reflected in status
    const updatedStatus = manager.getStatus();
    expect(updatedStatus.config.workerThreads).toBe(initialWorkerThreads + 2);
  });
  
  test('should reset to initial state', async () => {
    const manager = new DeploymentManager();
    
    // Update configuration to have a different state
    manager.updateConfig({
      workerThreads: 10,
      memoryLimit: 4096
    });
    
    // Reset to initial state
    await manager.reset();
    
    // Status should reflect reset state
    const status = manager.getStatus();
    expect(status.config.workerThreads).not.toBe(10);
    expect(status.healthCheck.status).toBe('unknown');
  });
  
  test('should check if features are available', () => {
    const manager = new DeploymentManager();
    
    // Check for WebAssembly which should be available in our mock
    expect(manager.hasFeature('webAssembly')).toBe(true);
    
    // Check for WebWorkers which should not be available in our mock
    expect(manager.hasFeature('webWorkers')).toBe(false);
  });
  
  test('should provide recommended configuration', () => {
    const manager = new DeploymentManager();
    
    const recommendedConfig = manager.getRecommendedConfig();
    
    // With our mock values (4 cores, 8GB RAM), we should get:
    expect(recommendedConfig.workerThreads).toBe(3); // cpuCores-1
    expect(recommendedConfig.memoryLimit).toBe(4096); // capped at 4GB
    expect(recommendedConfig.useLocalCache).toBe(true); // enough storage
  });
});