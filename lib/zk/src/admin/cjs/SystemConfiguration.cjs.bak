/**
 * Admin System Configuration Management - CommonJS Version
 * 
 * This module provides system configuration management functionality for the admin dashboard,
 * including configuration retrieval, modification, and version history tracking.
 * 
 * CommonJS version for compatibility with Node.js environments.
 */

const { rbacSystem, Permission } = require('./RoleBasedAccessControl.cjs');
const { zkErrorLogger } = require('../../zkErrorLogger.mjs');

/**
 * System Configuration Management System
 */
class SystemConfigurationManager {
  constructor() {
    this.currentConfig = null;
    this.configHistory = [];
    
    // Initialize with default configuration
    this.initializeDefaultConfig();
  }
  
  /**
   * Get the current system configuration
   */
  getConfiguration(adminWalletAddress) {
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
  getConfigurationHistory(adminWalletAddress, limit) {
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
  updateConfiguration(configUpdates, adminWalletAddress) {
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
    const changes = [];
    
    // Helper function to detect and record changes
    const trackChanges = (path, oldObj, newObj, prefix = '') => {
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
    const newConfig = {
      ...this.currentConfig,
      version: newVersion,
      settings: updatedSettings,
      createdAt: new Date(),
      createdBy: adminId
    };
    
    // Add history entry
    const historyEntry = {
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
   * Initialize with default configuration
   */
  initializeDefaultConfig() {
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
  getDefaultConfig() {
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
  mergeDeep(target, source) {
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
    
    function isObject(item) {
      return (
        item && 
        typeof item === 'object' && 
        !Array.isArray(item) &&
        !(item instanceof Date)
      );
    }
  }
}

// Create a singleton instance
const systemConfigurationManager = new SystemConfigurationManager();

// Export everything
module.exports = {
  SystemConfigurationManager,
  systemConfigurationManager
};