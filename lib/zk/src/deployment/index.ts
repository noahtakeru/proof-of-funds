/**
 * @fileoverview Cross-platform deployment module
 * 
 * This module provides a unified interface for deploying and running
 * zero-knowledge proofs across different platforms and environments.
 */

import { EnvironmentType } from './DeploymentConfig';
import { DeploymentStrategyType } from './DeploymentStrategy';

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

// Deployment strategy
export {
  DeploymentStrategyType
} from './DeploymentStrategy';

export type {
  DeploymentStrategy
} from './DeploymentStrategy';

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
  DeploymentStrategySelector
} from './DeploymentStrategySelector';

// Platform-specific configuration
export {
  PlatformConfigurator
} from './PlatformConfigurator';

export type {
  PlatformConfigOptions,
  PlatformProfile
} from './PlatformConfigurator';

// Deployment adapter
export {
  DeploymentAdapter
} from './DeploymentAdapter';

// Main cross-platform deployment system
export {
  CrossPlatformDeployment
} from './CrossPlatformDeployment';

export type {
  CrossPlatformDeploymentOptions,
  ResourceConstraints,
  DeploymentStats
} from './CrossPlatformDeployment';

/**
 * Map environment name to environment type
 */
function getEnvironmentType(environment?: string): EnvironmentType {
  switch (environment) {
    case 'production':
      return EnvironmentType.PRODUCTION;
    case 'staging':
      return EnvironmentType.STAGING;
    case 'test':
      return EnvironmentType.TEST;
    case 'development':
    default:
      return EnvironmentType.DEVELOPMENT;
  }
}

/**
 * Create a deployment manager with the specified configuration
 */
export function createDeployment(options: {
  environment?: 'development' | 'production' | 'staging' | 'test';
  platform?: 'node' | 'browser' | 'mobile' | 'auto';
  logLevel?: 'info' | 'error' | 'warn' | 'debug' | 'none';
  maxConcurrentDeployments?: number;
  deploymentRetries?: number;
  serverEndpoint?: string;
  initialStrategy?: DeploymentStrategyType;
  autoOptimize?: boolean;
  adaptToResourceConstraints?: boolean;
  monitorResourceUsage?: boolean;
}) {
  const { CrossPlatformDeployment } = require('./CrossPlatformDeployment');
  return new CrossPlatformDeployment({
    ...options
  });
}

// Default export with explicitly created object
export default {
  createDeployment,
  EnvironmentType: EnvironmentType,
  DeploymentStrategyType: DeploymentStrategyType
};