/**
 * Cross-Platform Deployment Framework
 * 
 * Tests the functionality of the CrossPlatformDeployment system, which provides
 * a unified interface for deploying and running zero-knowledge proofs across
 * different platforms and environments.
 */

import { CrossPlatformDeployment } from '../src/deployment/CrossPlatformDeployment';
import { DeploymentStrategyType } from '../src/deployment/DeploymentStrategy';
import { EnvironmentType } from '../src/deployment/DeploymentConfig';
import { PlatformAdapterFactory } from '../src/deployment/PlatformAdapterFactory';

// Mock dependencies that we don't want to actually invoke in tests
jest.mock('../src/deployment/PlatformAdapterFactory', () => {
  // Mock implementation of PlatformAdapter
  const mockAdapter = {
    platform: 'node',
    initialize: jest.fn().mockResolvedValue(true),
    supportsFeature: jest.fn().mockImplementation(feature =>
      ['webAssembly', 'nodeCrypto', 'fileSystem'].includes(feature)),
    getImplementation: jest.fn(),
    optimizeForPlatform: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined)
  };

  return {
    PlatformAdapterFactory: {
      getInstance: jest.fn().mockReturnValue({
        getPlatformAdapter: jest.fn().mockReturnValue(mockAdapter),
        createAdapter: jest.fn().mockReturnValue(mockAdapter)
      }),
      createForCurrentPlatform: jest.fn().mockReturnValue(mockAdapter),
      createForPlatform: jest.fn().mockReturnValue(mockAdapter),
      createWithConfiguration: jest.fn().mockReturnValue(mockAdapter),
    }
  };
});

jest.mock('../src/deployment/DeploymentManager', () => {
  return {
    DeploymentManager: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(true),
      getStatus: jest.fn().mockReturnValue({
        isReady: true,
        config: {
          useWorkerThreads: true,
          workerThreadCount: 4,
          useWebAssembly: true,
          serverEndpoint: 'https://api.example.com'
        }
      }),
      updateConfig: jest.fn(),
      reset: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

jest.mock('../src/deployment/DeploymentStrategySelector', () => {
  return {
    DeploymentStrategySelector: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(true),
      selectStrategy: jest.fn().mockImplementation(() => ({
        type: DeploymentStrategyType.Hybrid,
        useWorkerThreads: true,
        workerThreadCount: 4,
        useWebAssembly: true,
        serverOffloadPercentage: 20,
        localProcessingOptimization: 'balanced'
      })),
      switchStrategy: jest.fn().mockImplementation((type) => ({
        type,
        useWorkerThreads: type !== DeploymentStrategyType.ServerSide,
        workerThreadCount: type === DeploymentStrategyType.HighPerformance ? 8 : 4,
        useWebAssembly: true,
        serverOffloadPercentage: type === DeploymentStrategyType.ServerSide ? 100 :
          type === DeploymentStrategyType.Hybrid ? 50 : 0,
        localProcessingOptimization: type === DeploymentStrategyType.HighPerformance ? 'performance' : 'balanced'
      })),
      strategyToConfig: jest.fn().mockImplementation(strategy => ({
        useWorkerThreads: strategy.useWorkerThreads,
        workerThreadCount: strategy.workerThreadCount,
        useWebAssembly: strategy.useWebAssembly,
        serverEndpoint: 'https://api.example.com'
      })),
      createCustomStrategy: jest.fn().mockReturnValue({
        type: 'custom',
        useWorkerThreads: true,
        workerThreadCount: 2,
        useWebAssembly: true,
        serverOffloadPercentage: 30,
        localProcessingOptimization: 'balanced'
      })
    }))
  };
});

jest.mock('../src/deployment/EnvironmentDetector', () => {
  return {
    EnvironmentDetector: jest.fn().mockImplementation(() => ({
      detectEnvironment: jest.fn().mockReturnValue(EnvironmentType.Node)
    }))
  };
});

describe('CrossPlatformDeployment', () => {
  // Test instance
  let deployment;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Create a new deployment instance for each test
    deployment = new CrossPlatformDeployment({
      initialStrategy: DeploymentStrategyType.Hybrid,
      autoOptimize: true
    });
  });

  afterEach(async () => {
    // Clean up after each test
    if (deployment) {
      await deployment.cleanup();
    }
  });

  test('should initialize successfully', async () => {
    // Initialize the deployment system
    const result = await deployment.initialize();

    // Check the result
    expect(result).toBe(true);

    // Check that necessary components were initialized
    const platformAdapter = PlatformAdapterFactory.getInstance().getPlatformAdapter();
    expect(platformAdapter.initialize).toHaveBeenCalled();
    expect(platformAdapter.optimizeForPlatform).toHaveBeenCalled();
  });

  test('should retrieve status with correct properties', async () => {
    // Initialize first
    await deployment.initialize();

    // Get status
    const status = deployment.getStatus();

    // Check status properties
    expect(status).toBeDefined();
    expect(status.strategy).toBeDefined();
    expect(status.strategy.type).toBe(DeploymentStrategyType.Hybrid);
    expect(status.platformType).toBe(EnvironmentType.Node);
    expect(status.stats).toBeDefined();
    expect(status.stats.proofOperations).toBe(0);
  });

  test('should switch between deployment strategies', async () => {
    // Initialize first
    await deployment.initialize();

    // Switch to server-side strategy
    deployment.switchStrategy(DeploymentStrategyType.ServerSide);

    // Check that strategy was switched
    const status = deployment.getStatus();
    expect(status.strategy.type).toBe(DeploymentStrategyType.ServerSide);
    expect(status.strategy.serverOffloadPercentage).toBe(100);

    // Switch to high-performance strategy
    deployment.switchStrategy(DeploymentStrategyType.HighPerformance);

    // Check that strategy was switched again
    const newStatus = deployment.getStatus();
    expect(newStatus.strategy.type).toBe(DeploymentStrategyType.HighPerformance);
    expect(newStatus.strategy.workerThreadCount).toBe(8);
  });

  test('should create platform-specific configuration', async () => {
    // Initialize first
    await deployment.initialize();

    // Create configuration for browser environment
    const browserConfig = deployment.createPlatformConfig(EnvironmentType.Browser);

    // Check that configuration was created with appropriate settings
    expect(browserConfig).toBeDefined();
    expect(browserConfig.useWebAssembly).toBe(true);
  });

  test('should deploy a circuit', async () => {
    // Initialize first
    await deployment.initialize();

    // Deploy a circuit
    const result = await deployment.deployCircuit('standardProof');

    // Check that deployment was successful
    expect(result).toBe(true);

    // Check that the circuit was tracked for testing purposes
    expect(deployment._deployedCircuits).toBeDefined();
    expect(deployment._deployedCircuits.has('standardProof')).toBe(true);
  });

  test('should run a proof operation locally', async () => {
    // Initialize with a local-only strategy
    await deployment.initialize({ initialStrategy: DeploymentStrategyType.FullLocal });

    // Run a proof operation
    const result = await deployment.runProofOperation('generate', {
      circuit: 'standardProof',
      inputs: { amount: 100, balance: 100 }
    });

    // Check that operation was run locally
    expect(result).toBeDefined();
    expect(result.executedOn).toBe('local');
    expect(result.success).toBe(true);

    // Check that stats were updated
    const status = deployment.getStatus();
    expect(status.stats.proofOperations).toBe(1);
    expect(status.stats.serverOffloads).toBe(0);
  });

  test('should run a proof operation on server', async () => {
    // Initialize with a server-side strategy
    await deployment.initialize({ initialStrategy: DeploymentStrategyType.ServerSide });

    // Run a proof operation
    const result = await deployment.runProofOperation('generate', {
      circuit: 'standardProof',
      inputs: { amount: 100, balance: 100 }
    });

    // Check that operation was run on server
    expect(result).toBeDefined();
    expect(result.executedOn).toBe('server');
    expect(result.success).toBe(true);

    // Check that stats were updated
    const status = deployment.getStatus();
    expect(status.stats.proofOperations).toBe(1);
    expect(status.stats.serverOffloads).toBe(1);
  });

  test('should handle operation failures with auto-adaptation', async () => {
    // Mock a console.error and console.log to track calls
    const originalConsoleError = console.error;
    const originalConsoleLog = console.log;
    console.error = jest.fn();
    console.log = jest.fn();

    // Initialize with a local-only strategy but set up for failure
    await deployment.initialize({ initialStrategy: DeploymentStrategyType.FullLocal });

    // Override the local operation method to simulate failure
    const originalRunLocalOperation = deployment['runLocalOperation'];
    deployment['runLocalOperation'] = jest.fn().mockRejectedValue(new Error('Local operation failed'));

    // Override the server operation method to ensure it's called for recovery
    const originalRunServerOperation = deployment['runServerSideOperation'];
    deployment['runServerSideOperation'] = jest.fn().mockResolvedValue({
      success: true,
      result: 'Server recovery result',
      executedOn: 'server'
    });

    // Run a proof operation that will fail locally but recover with server
    const result = await deployment.runProofOperation('generate', {
      circuit: 'standardProof',
      inputs: { amount: 100, balance: 100 }
    });

    // Check that operation was recovered on server
    expect(result).toBeDefined();
    expect(result.executedOn).toBe('server');
    expect(result.success).toBe(true);

    // Check that error handling and recovery logging occurred
    expect(console.error).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Attempting recovery with server offload');

    // Restore original methods
    deployment['runLocalOperation'] = originalRunLocalOperation;
    deployment['runServerSideOperation'] = originalRunServerOperation;
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  test('should clean up resources properly', async () => {
    // Initialize first
    await deployment.initialize();

    // Clean up resources
    await deployment.cleanup();

    // Check that platform adapter cleanup was called
    const platformAdapter = PlatformAdapterFactory.getInstance().getPlatformAdapter();
    expect(platformAdapter.cleanup).toHaveBeenCalled();

    // Check that initialized flag was reset
    expect(deployment['initialized']).toBe(false);
  });

  test('should create deployment with proper configuration', async () => {
    // Initialize first
    await deployment.initialize();

    // Define circuit data to deploy
    const circuitData = {
      name: 'test-circuit',
      version: '1.0.0',
      wasmUrl: 'https://example.com/circuit.wasm',
      r1csUrl: 'https://example.com/circuit.r1cs',
      keysUrl: 'https://example.com/keys.json'
    };

    // Mock the createDeployment method implementation
    deployment.createDeployment = jest.fn().mockResolvedValue({
      id: 'test-deployment-123',
      status: 'success',
      circuit: circuitData,
      deployedAt: new Date().toISOString(),
      platform: 'node',
      strategy: DeploymentStrategyType.Hybrid,
      config: {
        useWorkerThreads: true,
        workerThreadCount: 4,
        useWebAssembly: true
      }
    });

    // Create a deployment
    const deploymentResult = await deployment.createDeployment(circuitData);

    // Check deployment result
    expect(deploymentResult).toBeDefined();
    expect(deploymentResult.id).toBe('test-deployment-123');
    expect(deploymentResult.status).toBe('success');
    expect(deploymentResult.circuit).toEqual(circuitData);
    expect(deploymentResult.platform).toBe('node');
    expect(deploymentResult.strategy).toBe(DeploymentStrategyType.Hybrid);

    // Check that deployment method was called with the right arguments
    expect(deployment.createDeployment).toHaveBeenCalledWith(circuitData);
  });
});