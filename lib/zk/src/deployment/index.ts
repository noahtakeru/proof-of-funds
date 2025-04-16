/**
 * @fileoverview Cross-platform deployment module
 * 
 * This module provides a unified interface for deploying and running
 * zero-knowledge proofs across different platforms and environments.
 */

// Core configuration and environment types
export { 
  EnvironmentType,
  baseConfig,
  lowResourceConfig,
  highPerformanceConfig,
  developmentConfig,
  productionConfig
} from './DeploymentConfig';

export type { 
  DeploymentConfig,
  FeatureFlags
} from './DeploymentConfig';

// Environment and feature detection
export {
  EnvironmentDetector
} from './EnvironmentDetector';

export type {
  FeatureDetectionResult
} from './EnvironmentDetector';

// Deployment management
export {
  DeploymentManager
} from './DeploymentManager';

export type {
  DeploymentManagerOptions,
  DeploymentStatus
} from './DeploymentManager';

// Health check system
export {
  HealthCheck
} from './HealthCheck';

export type {
  HealthCheckStatus,
  HealthCheckResult,
  HealthCheckItemResult
} from './HealthCheck';

// Cross-platform adapter system
export {
  PlatformAdapterFactory
} from './PlatformAdapterFactory';

export type {
  PlatformAdapter
} from './PlatformAdapterFactory';

// Deployment strategy selection
export {
  DeploymentStrategySelector,
  DeploymentStrategyType
} from './DeploymentStrategySelector';

export type {
  DeploymentStrategy
} from './DeploymentStrategySelector';

// Platform-specific configuration
export {
  PlatformConfigurator
} from './PlatformConfigurator';

export type {
  PlatformConfigOptions,
  PlatformProfile
} from './PlatformConfigurator';

// Main cross-platform deployment system
export {
  CrossPlatformDeployment
} from './CrossPlatformDeployment';

export type {
  CrossPlatformDeploymentOptions,
  ResourceConstraints,
  DeploymentStats
} from './CrossPlatformDeployment';

// Import for function return type
import { CrossPlatformDeployment as CPD } from './CrossPlatformDeployment';
import { EnvironmentDetector } from './EnvironmentDetector';
import { DeploymentStrategyType } from './DeploymentStrategySelector';
import { EnvironmentType } from './DeploymentConfig';

/**
 * Create and initialize a cross-platform deployment system
 */
export async function createDeployment(options: any = {}): Promise<CPD> {
  const deployment = new CPD(options);
  await deployment.initialize(options);
  return deployment;
}

/**
 * Detect the current environment and create an optimized deployment
 */
export async function createOptimizedDeployment(): Promise<CPD> {
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
  
  const deployment = new CPD({
    environment,
    initialStrategy: strategyType,
    autoOptimize: true,
    adaptToResourceConstraints: true,
    monitorResourceUsage: true
  });
  
  await deployment.initialize();
  
  return deployment;
}