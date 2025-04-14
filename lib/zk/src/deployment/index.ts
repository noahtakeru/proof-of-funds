/**
 * @fileoverview Export deployment-related functionality
 */

export { DeploymentManager, DeploymentStatus } from './DeploymentManager';
export { EnvironmentType, DeploymentConfig, FeatureFlags } from './DeploymentConfig';
export { EnvironmentDetector, FeatureDetectionResult } from './EnvironmentDetector';
export { HealthCheck, HealthCheckStatus, HealthCheckResult, HealthCheckItemResult } from './HealthCheck';

// Re-export specific configurations for convenience
export { 
  baseConfig, 
  lowResourceConfig, 
  highPerformanceConfig,
  developmentConfig,
  productionConfig
} from './DeploymentConfig';