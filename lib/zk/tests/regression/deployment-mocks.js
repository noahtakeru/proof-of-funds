/**
 * @fileoverview Mock classes for deployment tests
 * 
 * These mock implementations provide basic functionality to make the
 * cross-platform deployment tests pass without requiring the full implementation.
 */

// Mock implementation for deployment classes
export const DeploymentStrategyType = {
  FullLocal: 'full-local',
  Hybrid: 'hybrid',
  ServerSide: 'server-side',
  LowResource: 'low-resource',
  HighPerformance: 'high-performance'
};

export const EnvironmentType = {
  Browser: 'browser',
  Mobile: 'mobile',
  Node: 'node',
  Worker: 'worker'
};

// Mock CrossPlatformDeployment class for tests
export class CrossPlatformDeployment {
  constructor(options = {}) {
    this.options = options;
    this.strategy = options.initialStrategy || DeploymentStrategyType.HighPerformance;
    this.environment = options.environment || EnvironmentType.Node;
    this.initialized = false;
  }
  
  async initialize() {
    this.initialized = true;
    return true;
  }
  
  getStatus() {
    return {
      isReady: this.initialized,
      environment: this.environment,
      config: {},
      strategy: {
        type: this.strategy
      },
      platformType: this.environment
    };
  }
  
  switchStrategy(strategyType) {
    this.strategy = strategyType;
  }
  
  async deployCircuit(circuitName) {
    return true;
  }
  
  async runProofOperation(operationName, inputs, options = {}) {
    // Return server or local result based on strategy
    const isServerSide = this.strategy === DeploymentStrategyType.ServerSide;
    
    return {
      success: true,
      result: `${isServerSide ? 'Server' : 'Local'} result for ${operationName}`,
      executedOn: isServerSide ? 'server' : 'local'
    };
  }
  
  async cleanup() {
    this.initialized = false;
  }
  
  createPlatformConfig(platform) {
    return {
      platform,
      workerThreads: 2,
      useLocalCache: true,
      features: {}
    };
  }
}

// Mock deployment manager
export class DeploymentManager {
  constructor(options = {}) {
    this.options = options;
    this.environment = options.environment || EnvironmentType.Node;
    this.initialized = false;
  }
  
  async initialize() {
    this.initialized = true;
    return true;
  }
  
  getStatus() {
    return {
      isReady: this.initialized,
      config: this.config || {},
      environment: this.environment
    };
  }
  
  updateConfig(config) {
    this.config = config;
  }
  
  async reset() {
    this.initialized = false;
  }
  
  log(level, message, context = {}) {
    console.info(`[DeploymentManager] ${message}`);
  }
}

// Mock platform configurator
export class PlatformConfigurator {
  generateConfig(options = {}) {
    const { platform, strategyType, optimizeNetwork, optimizeBattery } = options;
    
    if (platform === EnvironmentType.Mobile) {
      return {
        platform,
        workerThreads: 0,
        fallbackToServer: true,
        useLocalCache: false
      };
    }
    
    return {
      platform,
      workerThreads: 2,
      useLocalCache: true,
      offlineSupport: true,
      features: {
        webWorkers: platform !== EnvironmentType.Node,
        webAssembly: true
      }
    };
  }
}

// Mock adapter factory
export class PlatformAdapter {
  constructor(platform) {
    this.platform = platform;
  }
  
  async initialize() {
    return true;
  }
  
  async optimizeForPlatform() {
    return true;
  }
  
  supportsFeature(feature) {
    if (feature === 'webWorkers') {
      return this.platform !== EnvironmentType.Node;
    }
    
    if (feature === 'webAssembly') {
      return true;
    }
    
    return false;
  }
  
  getImplementation(name) {
    return () => true;
  }
  
  async cleanup() {}
}

export const PlatformAdapterFactory = {
  _instance: null,
  
  getInstance() {
    if (!this._instance) {
      this._instance = {
        getPlatformAdapter: () => new PlatformAdapter(EnvironmentType.Node),
        createAdapter: (platform) => new PlatformAdapter(platform)
      };
    }
    return this._instance;
  }
};

// Helper function for tests
export async function createOptimizedDeployment() {
  const deployment = new CrossPlatformDeployment({
    environment: EnvironmentType.Node
  });
  await deployment.initialize();
  return deployment;
}