/**
 * @fileoverview Deployment adapter for cross-platform deployments
 * 
 * This module provides a base adapter for handling deployments across platforms.
 */

import { EnvironmentType } from './DeploymentConfig';

/**
 * Base deployment adapter with configuration
 */
export class DeploymentAdapter {
  public environment: EnvironmentType | undefined;
  private strategy = {
    memoryLimit: 512,
    timeoutMs: 30000
  };

  /**
   * Create a new deployment adapter
   */
  constructor(config?: any) {
    if (config) {
      this.strategy = config;
    }
  }

  /**
   * Convert a deployment strategy to adapter settings
   */
  public strategyToSettings(strategyType: string): any {
    // Default settings
    const settings = {
      parallelization: 2,
      optimizeFor: 'performance',
      cacheEnabled: true,
      fallbackEnabled: true
    };

    // High performance strategy
    if (strategyType === 'high-performance') {
      settings.parallelization = 4;
      settings.optimizeFor = 'speed';
      settings.cacheEnabled = true;
      settings.fallbackEnabled = false;
    }
    // Server-side strategy
    else if (strategyType === 'server-side') {
      settings.parallelization = 0;
      settings.optimizeFor = 'reliability';
      settings.cacheEnabled = true;
      settings.fallbackEnabled = true;
    }
    // Hybrid strategy
    else if (strategyType === 'hybrid') {
      settings.parallelization = 2;
      settings.optimizeFor = 'balanced';
      settings.cacheEnabled = true;
      settings.fallbackEnabled = true;
    }

    return settings;
  }

  /**
   * Get the adapter configuration
   */
  public getConfiguration(): any {
    return this.strategy;
  }

  /**
   * Get the platform type
   */
  public getPlatformType(): EnvironmentType {
    return this.environment || EnvironmentType.Node;
  }
}