/**
 * @jest-environment node
 */

const { 
  CrossPlatformDeployment,
  EnvironmentType,
  DeploymentStrategyType,
  createOptimizedDeployment,
  PlatformConfigurator,
  PlatformAdapterFactory
} = require('../src/deployment');

// Mock console methods to prevent noise in test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

describe('Cross-Platform Deployment Framework', () => {
  test('should create deployment for Node.js environment', async () => {
    const deployment = new CrossPlatformDeployment({
      environment: EnvironmentType.Node
    });
    
    await deployment.initialize();
    const status = deployment.getStatus();
    
    expect(status.environment).toBe(EnvironmentType.Node);
    expect(status.strategy).toBeTruthy();
    expect(status.platformType).toBe(EnvironmentType.Node);
  });
  
  test('should switch deployment strategies', async () => {
    const deployment = new CrossPlatformDeployment({
      environment: EnvironmentType.Node,
      initialStrategy: DeploymentStrategyType.FullLocal
    });
    
    await deployment.initialize();
    let status = deployment.getStatus();
    expect(status.strategy.type).toBe(DeploymentStrategyType.FullLocal);
    
    // Switch to server-side strategy
    deployment.switchStrategy(DeploymentStrategyType.ServerSide);
    status = deployment.getStatus();
    expect(status.strategy.type).toBe(DeploymentStrategyType.ServerSide);
  });
  
  test('should create optimized deployment with correct strategy', async () => {
    const deployment = await createOptimizedDeployment();
    const status = deployment.getStatus();
    
    // NodeJS environment is detected as high-performance
    expect(status.strategy.type).toBe(DeploymentStrategyType.HighPerformance);
    
    await deployment.cleanup();
  });
  
  test('should generate platform-specific configurations', () => {
    const configurator = new PlatformConfigurator();
    
    // Generate browser config
    const browserConfig = configurator.generateConfig({
      platform: EnvironmentType.Browser,
      strategyType: DeploymentStrategyType.Hybrid,
      optimizeNetwork: true
    });
    
    expect(browserConfig.useLocalCache).toBe(true);
    expect(browserConfig.offlineSupport).toBe(true);
    
    // Generate mobile config
    const mobileConfig = configurator.generateConfig({
      platform: EnvironmentType.Mobile,
      strategyType: DeploymentStrategyType.LowResource,
      optimizeBattery: true
    });
    
    expect(mobileConfig.workerThreads).toBe(0);
    expect(mobileConfig.fallbackToServer).toBe(true);
  });
  
  test('should handle platform adapters correctly', async () => {
    // Get platform adapter for Node.js
    const factory = PlatformAdapterFactory.getInstance();
    const adapter = factory.createAdapter(EnvironmentType.Node);
    
    await adapter.initialize();
    expect(adapter.platform).toBe(EnvironmentType.Node);
    
    // Check feature detection
    expect(adapter.supportsFeature('webWorkers')).toBe(false);
    expect(adapter.supportsFeature('webAssembly')).toBe(true);
    
    // Check if implementation exists
    expect(() => adapter.getImplementation('storage')).not.toThrow();
  });
  
  test('should deploy circuits with appropriate strategy', async () => {
    const deployment = new CrossPlatformDeployment({
      environment: EnvironmentType.Node,
      initialStrategy: DeploymentStrategyType.FullLocal
    });
    
    await deployment.initialize();
    
    // Test circuit deployment - this should call mock implementation
    const result = await deployment.deployCircuit('testCircuit');
    expect(result).toBe(true);
    
    await deployment.cleanup();
  });
  
  test('should handle proof operations correctly', async () => {
    const deployment = new CrossPlatformDeployment({
      environment: EnvironmentType.Node,
      initialStrategy: DeploymentStrategyType.FullLocal
    });
    
    await deployment.initialize();
    
    // Run a local proof operation
    const result = await deployment.runProofOperation('testOperation', { test: true });
    expect(result.success).toBe(true);
    expect(result.executedOn).toBe('local');
    
    await deployment.cleanup();
  });
});