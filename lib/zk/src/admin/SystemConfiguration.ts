/**
 * Admin System Configuration Management
 * 
 * This module provides system configuration management functionality for the admin dashboard,
 * including configuration retrieval, modification, and version history tracking.
 * 
 * The implementation uses the Role-Based Access Control (RBAC) system to enforce
 * access controls based on user roles and permissions.
 */

import { rbacSystem, Permission } from './RoleBasedAccessControl';
import { ZKErrorLogger } from '../zkErrorLogger.js';

// Create logger instance for SystemConfiguration operations
const logger = new ZKErrorLogger({
  logLevel: 'info',
  privacyLevel: 'internal',
  destinations: ['console', 'file']
});

// System configuration interface
export interface SystemConfiguration {
  id: string;
  version: number;
  createdAt: Date;
  createdBy: string;
  settings: {
    // General settings
    siteName: string;
    siteDescription: string;

    // Proof generation settings
    proofValidity: {
      standard: number; // Days
      threshold: number; // Days
      maximum: number; // Days
      zk: number; // Days
    };

    // Verification settings
    verification: {
      cacheResults: boolean;
      cacheLifetime: number; // Hours
      verificationTimeout: number; // Seconds
    };

    // Security settings
    security: {
      userVerificationRequired: boolean;
      minPasswordLength: number;
      twoFactorAuthEnabled: boolean;
      sessionTimeout: number; // Minutes
      rateLimiting: {
        maxRequests: number;
        timeWindow: number; // Seconds
      }
    };

    // Notification settings
    notifications: {
      emailNotifications: boolean;
      adminAlerts: boolean;
      securityAlerts: boolean;
    };

    // Analytics settings
    analytics: {
      enabled: boolean;
      anonymizeIpAddresses: boolean;
      retentionPeriod: number; // Days
    };
  };

  // Custom settings for specific features
  customSettings?: Record<string, any>;
}

// Configuration history entry
export interface ConfigHistoryEntry {
  configId: string;
  version: number;
  timestamp: Date;
  modifiedBy: string;
  changes: {
    path: string;
    previousValue: any;
    newValue: any;
  }[];
}

/**
 * System Configuration Management System
 */
export class SystemConfigurationManager {
  private currentConfig: SystemConfiguration | null = null;
  private configHistory: ConfigHistoryEntry[] = [];

  constructor() {
    // Initialize with default configuration
    this.initializeDefaultConfig();
  }

  /**
   * Get the current system configuration
   */
  public getConfiguration(adminWalletAddress: string): SystemConfiguration | null {
    // Check if admin has permission to view system metrics
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.VIEW_SYSTEM_METRICS)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'view_system_config',
        targetResource: 'system_config',
        status: 'denied'
      });

      return null;
    }

    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);

    // Log the action
    rbacSystem.logAction({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'view_system_config',
      targetResource: 'system_config',
      status: 'success'
    });

    return this.currentConfig;
  }

  /**
   * Get configuration history
   */
  public getConfigurationHistory(
    adminWalletAddress: string,
    limit?: number
  ): ConfigHistoryEntry[] | null {
    // Check if admin has permission to view system metrics
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.VIEW_SYSTEM_METRICS)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'view_config_history',
        targetResource: 'system_config',
        status: 'denied'
      });

      return null;
    }

    // Apply limit if specified
    let history = [...this.configHistory];
    if (limit && limit > 0) {
      history = history.slice(0, limit);
    }

    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);

    // Log the action
    rbacSystem.logAction({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'view_config_history',
      targetResource: 'system_config',
      status: 'success',
      details: { limit }
    });

    return history;
  }

  /**
   * Update system configuration
   */
  public updateConfiguration(
    configUpdates: Partial<SystemConfiguration['settings']>,
    adminWalletAddress: string
  ): SystemConfiguration | null {
    // Check if admin has permission to modify system configuration
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.MODIFY_SYSTEM_CONFIG)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'update_system_config',
        targetResource: 'system_config',
        status: 'denied',
        details: { updates: configUpdates }
      });

      return null;
    }

    if (!this.currentConfig) {
      return null;
    }

    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);
    const adminId = adminRole?.userId || 'unknown';

    // Track changes for history
    const changes: ConfigHistoryEntry['changes'] = [];

    // Helper function to detect and record changes
    const trackChanges = (path: string, oldObj: any, newObj: any, prefix = '') => {
      if (typeof oldObj !== 'object' || typeof newObj !== 'object') {
        // For non-objects, record the change if values are different
        if (oldObj !== newObj) {
          changes.push({
            path: prefix,
            previousValue: oldObj,
            newValue: newObj
          });
        }
        return;
      }

      // For objects, recursively check each property
      for (const key in newObj) {
        if (Object.prototype.hasOwnProperty.call(newObj, key)) {
          const newPath = prefix ? `${prefix}.${key}` : key;

          if (key in oldObj) {
            if (typeof oldObj[key] === 'object' && typeof newObj[key] === 'object') {
              // Recursively track changes for nested objects
              trackChanges(path, oldObj[key], newObj[key], newPath);
            } else if (oldObj[key] !== newObj[key]) {
              // Record change for different primitive values
              changes.push({
                path: newPath,
                previousValue: oldObj[key],
                newValue: newObj[key]
              });
            }
          } else {
            // Record added properties
            changes.push({
              path: newPath,
              previousValue: undefined,
              newValue: newObj[key]
            });
          }
        }
      }

      // Check for removed properties
      for (const key in oldObj) {
        if (
          Object.prototype.hasOwnProperty.call(oldObj, key) &&
          !Object.prototype.hasOwnProperty.call(newObj, key)
        ) {
          const newPath = prefix ? `${prefix}.${key}` : key;
          changes.push({
            path: newPath,
            previousValue: oldObj[key],
            newValue: undefined
          });
        }
      }
    };

    // Create updated settings object by merging with current settings
    const updatedSettings = this.mergeDeep(this.currentConfig.settings, configUpdates);

    // Track changes between old and new settings
    trackChanges('settings', this.currentConfig.settings, updatedSettings);

    // If there are no changes, return the current config
    if (changes.length === 0) {
      return this.currentConfig;
    }

    // Create new configuration version
    const newVersion = this.currentConfig.version + 1;
    const newConfig: SystemConfiguration = {
      ...this.currentConfig,
      version: newVersion,
      settings: updatedSettings,
      createdAt: new Date(),
      createdBy: adminId
    };

    // Add history entry
    const historyEntry: ConfigHistoryEntry = {
      configId: this.currentConfig.id,
      version: newVersion,
      timestamp: new Date(),
      modifiedBy: adminId,
      changes
    };

    // Update current config and add to history
    this.currentConfig = newConfig;
    this.configHistory.unshift(historyEntry);

    // Log the action
    rbacSystem.logAction({
      userId: adminId,
      walletAddress: adminWalletAddress,
      action: 'update_system_config',
      targetResource: 'system_config',
      status: 'success',
      details: {
        version: newVersion,
        changes
      }
    });

    return newConfig;
  }

  /**
   * Revert to a previous configuration version
   */
  public revertToVersion(
    version: number,
    adminWalletAddress: string
  ): SystemConfiguration | null {
    // Check if admin has permission to modify system configuration
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.MODIFY_SYSTEM_CONFIG)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'revert_system_config',
        targetResource: `system_config_v${version}`,
        status: 'denied'
      });

      return null;
    }

    // Find the history entry for the requested version
    const historyEntries = this.configHistory.filter(entry => entry.version <= version);
    if (historyEntries.length === 0 || !this.currentConfig) {
      return null;
    }

    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);
    const adminId = adminRole?.userId || 'unknown';

    // To revert to a specific version, we need to apply all changes in reverse order
    // Start with the default configuration
    let revertedConfig = this.getDefaultConfig();

    // Apply all changes up to the requested version
    for (let i = historyEntries.length - 1; i >= 0; i--) {
      const entry = historyEntries[i];

      // Apply each change in this entry
      for (const change of entry.changes) {
        // Apply the change to the appropriate path
        this.setValueAtPath(revertedConfig.settings, change.path, change.newValue);
      }
    }

    // Create new configuration version
    const newVersion = this.currentConfig.version + 1;
    const newConfig: SystemConfiguration = {
      ...this.currentConfig,
      version: newVersion,
      settings: revertedConfig.settings,
      createdAt: new Date(),
      createdBy: adminId
    };

    // Add history entry for the revert
    const historyEntry: ConfigHistoryEntry = {
      configId: this.currentConfig.id,
      version: newVersion,
      timestamp: new Date(),
      modifiedBy: adminId,
      changes: [{
        path: 'revert',
        previousValue: `v${this.currentConfig.version}`,
        newValue: `v${version}`
      }]
    };

    // Update current config and add to history
    this.currentConfig = newConfig;
    this.configHistory.unshift(historyEntry);

    // Log the action
    rbacSystem.logAction({
      userId: adminId,
      walletAddress: adminWalletAddress,
      action: 'revert_system_config',
      targetResource: `system_config_v${version}`,
      status: 'success',
      details: {
        newVersion,
        revertedFrom: this.currentConfig.version,
        revertedTo: version
      }
    });

    return newConfig;
  }

  /**
   * Get a specific configuration version
   */
  public getConfigurationVersion(
    version: number,
    adminWalletAddress: string
  ): SystemConfiguration | null {
    // Check if admin has permission to view system metrics
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.VIEW_SYSTEM_METRICS)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'view_system_config_version',
        targetResource: `system_config_v${version}`,
        status: 'denied'
      });

      return null;
    }

    // If requested version is current version, return current config
    if (this.currentConfig && this.currentConfig.version === version) {
      return this.currentConfig;
    }

    // Find the history entry for the requested version
    const historyEntries = this.configHistory.filter(entry => entry.version <= version);
    if (historyEntries.length === 0 || !this.currentConfig) {
      return null;
    }

    // Start with the default configuration
    let restoredConfig = this.getDefaultConfig();

    // Apply all changes up to the requested version
    for (let i = historyEntries.length - 1; i >= 0; i--) {
      const entry = historyEntries[i];

      // Skip history entries with version greater than requested
      if (entry.version > version) continue;

      // Apply each change in this entry
      for (const change of entry.changes) {
        // Skip revert changes
        if (change.path === 'revert') continue;

        // Apply the change to the appropriate path
        this.setValueAtPath(restoredConfig.settings, change.path, change.newValue);
      }
    }

    // Construct the restored config
    const configAtVersion: SystemConfiguration = {
      ...this.currentConfig,
      version,
      settings: restoredConfig.settings
    };

    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);

    // Log the action
    rbacSystem.logAction({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'view_system_config_version',
      targetResource: `system_config_v${version}`,
      status: 'success'
    });

    return configAtVersion;
  }

  /**
   * Set environment variables based on configuration
   * This should be used cautiously and only for permitted settings
   */
  public applyConfigToEnvironment(
    adminWalletAddress: string
  ): boolean {
    // Check if admin has permission to modify system configuration
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.MODIFY_SYSTEM_CONFIG)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'apply_config_to_env',
        targetResource: 'system_config',
        status: 'denied'
      });

      return false;
    }

    if (!this.currentConfig) {
      return false;
    }

    // Define which settings are allowed to be applied to environment
    // This is a security measure to prevent sensitive settings from being exposed
    const allowedEnvSettings = [
      'siteName',
      'siteDescription',
      'verification.cacheResults',
      'verification.cacheLifetime',
      'verification.verificationTimeout',
      'analytics.enabled',
      'analytics.anonymizeIpAddresses',
      'analytics.retentionPeriod'
    ];

    // Apply allowed settings to environment
    for (const setting of allowedEnvSettings) {
      const value = this.getValueAtPath(this.currentConfig.settings, setting);
      if (value !== undefined) {
        // Convert setting path to env var format (e.g., verification.cacheResults -> VERIFICATION_CACHE_RESULTS)
        const envVar = `CONFIG_${setting.toUpperCase().replace(/\./g, '_')}`;
        process.env[envVar] = typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
    }

    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);

    // Log the action
    rbacSystem.logAction({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'apply_config_to_env',
      targetResource: 'system_config',
      status: 'success',
      details: {
        appliedSettings: allowedEnvSettings
      }
    });

    return true;
  }

  /**
   * Initialize with default configuration
   */
  private initializeDefaultConfig(): void {
    // Create default configuration
    this.currentConfig = this.getDefaultConfig();

    // Add initial history entry
    this.configHistory.push({
      configId: this.currentConfig.id,
      version: 1,
      timestamp: this.currentConfig.createdAt,
      modifiedBy: 'system',
      changes: [{
        path: 'initialization',
        previousValue: null,
        newValue: 'default_config'
      }]
    });
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): SystemConfiguration {
    return {
      id: `config_${Date.now()}`,
      version: 1,
      createdAt: new Date(),
      createdBy: 'system',
      settings: {
        // General settings
        siteName: 'Arbitr Proof of Funds',
        siteDescription: 'Secure and private verification of fund ownership',

        // Proof generation settings
        proofValidity: {
          standard: 30, // 30 days
          threshold: 60, // 60 days
          maximum: 90, // 90 days
          zk: 60 // 60 days
        },

        // Verification settings
        verification: {
          cacheResults: true,
          cacheLifetime: 24, // 24 hours
          verificationTimeout: 30 // 30 seconds
        },

        // Security settings
        security: {
          userVerificationRequired: true,
          minPasswordLength: 12,
          twoFactorAuthEnabled: true,
          sessionTimeout: 60, // 60 minutes
          rateLimiting: {
            maxRequests: 100,
            timeWindow: 60 // 60 seconds
          }
        },

        // Notification settings
        notifications: {
          emailNotifications: true,
          adminAlerts: true,
          securityAlerts: true
        },

        // Analytics settings
        analytics: {
          enabled: true,
          anonymizeIpAddresses: true,
          retentionPeriod: 90 // 90 days
        }
      }
    };
  }

  /**
   * Deep merge two objects
   */
  private mergeDeep(target: any, source: any): any {
    const output = { ...target };

    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach(key => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.mergeDeep(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;

    function isObject(item: any): boolean {
      return (
        item &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        !(item instanceof Date)
      );
    }
  }

  /**
   * Get value at a nested path in an object
   */
  private getValueAtPath(obj: any, path: string): any {
    return path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
  }

  /**
   * Set value at a nested path in an object
   */
  private setValueAtPath(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    const lastKey = parts.pop()!;

    // Navigate to the parent object
    const parent = parts.reduce((o, key) => {
      if (!o[key] || typeof o[key] !== 'object') {
        o[key] = {};
      }
      return o[key];
    }, obj);

    // Set the value
    parent[lastKey] = value;
  }
}

// Singleton instance management
let instance: SystemConfigurationManager | null = null;

/**
 * Get the singleton instance of the System Configuration Manager
 */
export function getInstance(): SystemConfigurationManager {
  if (!instance) {
    instance = new SystemConfigurationManager();
  }
  return instance;
}

// Create a singleton instance
export const systemConfigurationManager = getInstance();

// Export default for CommonJS compatibility
export default systemConfigurationManager;