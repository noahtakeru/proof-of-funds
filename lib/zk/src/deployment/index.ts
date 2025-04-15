/**
 * @fileoverview Cross-platform deployment module
 * 
 * This module provides a unified interface for deploying and running
 * zero-knowledge proofs across different platforms and environments.
 */

// Core configuration and environment types
export { 
  EnvironmentType,
  DeploymentConfig,
  FeatureFlags,
  baseConfig,
  lowResourceConfig,
  highPerformanceConfig,
  developmentConfig,
  productionConfig
} from './DeploymentConfig';

// Environment and feature detection
export {
  EnvironmentDetector,
  FeatureDetectionResult
} from './EnvironmentDetector';

// Deployment management
export {
  DeploymentManager, 
  DeploymentManagerOptions,
  DeploymentStatus
} from './DeploymentManager';

// Health check system
export {
  HealthCheck,
  HealthCheckStatus,
  HealthCheckResult,
  HealthCheckItemResult
} from './HealthCheck';

// Cross-platform adapter system
export {
  PlatformAdapter,
  PlatformAdapterFactory
} from './PlatformAdapterFactory';

// Deployment strategy selection
export {
  DeploymentStrategySelector,
  DeploymentStrategy,
  DeploymentStrategyType
} from './DeploymentStrategySelector';

// Platform-specific configuration
export {
  PlatformConfigurator,
  PlatformConfigOptions,
  PlatformProfile
} from './PlatformConfigurator';

// Main cross-platform deployment system
export {
  CrossPlatformDeployment,
  CrossPlatformDeploymentOptions,
  ResourceConstraints,
  DeploymentStats
} from './CrossPlatformDeployment';

/**
 * Create and initialize a cross-platform deployment system
 */
export async function createDeployment(options: any = {}): Promise<CrossPlatformDeployment> {
  const deployment = new CrossPlatformDeployment(options);
  await deployment.initialize(options);
  return deployment;
}

/**
 * Detect the current environment and create an optimized deployment
 */
export async function createOptimizedDeployment(): Promise<CrossPlatformDeployment> {
  const detector = new EnvironmentDetector();
  const environment = detector.detectEnvironment();
  const features = detector.detectFeatures();
  
  // Select appropriate strategy based on environment and capabilities
  let strategyType: DeploymentStrategyType;
  
  if (features.isHighEndDevice) {
    strategyType = DeploymentStrategyType.HighPerformance;
  } else if (environment === EnvironmentType.Mobile) {
    strategyType = DeploymentStrategyType.Hybrid;
  } else if (!features.supportsWebWorkers || !features.supportsWebAssembly) {
    strategyType = DeploymentStrategyType.ServerSide;
  } else {
    strategyType = DeploymentStrategyType.FullLocal;
  }
  
  const deployment = new CrossPlatformDeployment({
    environment,
    initialStrategy: strategyType,
    autoOptimize: true,
    adaptToResourceConstraints: true,
    monitorResourceUsage: true
  });
  
  await deployment.initialize();
  
  return deployment;
}