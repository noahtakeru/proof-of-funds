/**
 * Admin Audit Logging System - CommonJS Version
 * 
 * This module provides comprehensive audit logging functionality for the admin dashboard,
 * tracking all administrative actions for security and compliance purposes.
 * 
 * CommonJS version for compatibility with Node.js environments.
 */

const { rbacSystem, Permission } = require('./RoleBasedAccessControl.cjs');
const { zkErrorLogger } = require('../../zkErrorLogger.mjs');

/**
 * Audit Logging System
 */
class AuditLoggingSystem {
  constructor() {
    this.auditLogs = [];
    
    // Initialize with example audit logs for development
    if (process.env.NODE_ENV === 'development') {
      this.initializeExampleLogs();
    }
    
    // Attach to RBAC system to capture all action logs
    this.hookIntoRbacLogSystem();
  }
  
  /**
   * Log an audit event
   */
  logAuditEvent(entry) {
    const logEntry = {
      ...entry,
      timestamp: new Date()
    };
    
    // Add to audit logs
    this.auditLogs.unshift(logEntry);
    
    // Also log to the central error logger for persistence
    zkErrorLogger.log(
      entry.severity === 'info' ? 'INFO' :
      entry.severity === 'warning' ? 'WARNING' : 
      entry.severity === 'error' ? 'ERROR' : 'CRITICAL',
      `Audit: ${entry.action} on ${entry.targetResource} by ${entry.userId}`,
      {
        category: `audit_${entry.category}`,
        userFixable: false,
        recoverable: true,
        details: entry
      }
    );
    
    return logEntry;
  }
  
  /**
   * Search audit logs
   */
  searchAuditLogs(filters, adminWalletAddress, pagination) {
    // Check if admin has permission to view logs
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.VIEW_LOGS)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'search_audit_logs',
        targetResource: 'audit_logs',
        status: 'denied',
        details: { filters }
      });
      
      return null;
    }
    
    // Apply filters
    let filteredLogs = this.auditLogs.filter(log => {
      if (filters.userId && log.userId !== filters.userId) {
        return false;
      }
      
      if (filters.walletAddress && 
          log.walletAddress.toLowerCase() !== filters.walletAddress.toLowerCase()) {
        return false;
      }
      
      if (filters.action && log.action !== filters.action) {
        return false;
      }
      
      if (filters.targetResource && !log.targetResource.includes(filters.targetResource)) {
        return false;
      }
      
      if (filters.status && log.status !== filters.status) {
        return false;
      }
      
      if (filters.startDate && log.timestamp < filters.startDate) {
        return false;
      }
      
      if (filters.endDate && log.timestamp > filters.endDate) {
        return false;
      }
      
      if (filters.category && log.category !== filters.category) {
        return false;
      }
      
      if (filters.severity && log.severity !== filters.severity) {
        return false;
      }
      
      if (filters.ip && log.ip !== filters.ip) {
        return false;
      }
      
      if (filters.containsText) {
        const text = filters.containsText.toLowerCase();
        const logText = JSON.stringify(log).toLowerCase();
        if (!logText.includes(text)) {
          return false;
        }
      }
      
      return true;
    });
    
    const total = filteredLogs.length;
    
    // Apply pagination if specified
    if (pagination) {
      filteredLogs = filteredLogs.slice(
        pagination.skip,
        pagination.skip + pagination.limit
      );
    }
    
    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);
    
    // Log the action
    this.logAuditEvent({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'search_audit_logs',
      targetResource: 'audit_logs',
      status: 'success',
      category: 'security',
      severity: 'info',
      details: {
        filters,
        resultCount: filteredLogs.length,
        totalCount: total
      }
    });
    
    return { logs: filteredLogs, total };
  }
  
  /**
   * Hook into the RBAC log system to capture all action logs
   */
  hookIntoRbacLogSystem() {
    // We will capture the original RBAC logs and enhance them for the audit system
    // This is a simple way to ensure we don't miss any admin actions
    
    // The process here would connect to the RBAC system's logging mechanism
    // Since we can't directly hook into a running system in this example,
    // we'll just rely on calling our methods directly
  }
  
  /**
   * Generate example audit logs for development
   */
  initializeExampleLogs() {
    // Admin users for example logs
    const users = [
      { id: 'super_admin', wallet: '0x0123456789abcdef0123456789abcdef01234567' },
      { id: 'admin_user', wallet: '0x1123456789abcdef0123456789abcdef01234567' }
    ];
    
    // Action templates
    const userActions = [
      { action: 'create_user', target: 'user_', category: 'user_management' },
      { action: 'view_user', target: 'user_', category: 'user_management' }
    ];
    
    const proofActions = [
      { action: 'search_proofs', target: 'proofs', category: 'proof_management' },
      { action: 'view_proof', target: 'proof_', category: 'proof_management' }
    ];
    
    const allActions = [...userActions, ...proofActions];
    
    // Generate 20 random log entries for the CJS version
    for (let i = 0; i < 20; i++) {
      // Pick a random user
      const user = users[Math.floor(Math.random() * users.length)];
      
      // Pick a random action
      const actionTemplate = allActions[Math.floor(Math.random() * allActions.length)];
      
      // Pick a random status - mostly successful with some denied/error
      const status = Math.random() < 0.8 ? 'success' : Math.random() < 0.95 ? 'denied' : 'error';
      
      // Pick a random severity
      const severity = Math.random() < 0.7 ? 'info' : 
                       Math.random() < 0.9 ? 'warning' : 
                       Math.random() < 0.98 ? 'error' : 'critical';
      
      // Generate a random date in the last 30 days
      const timestamp = new Date();
      timestamp.setDate(timestamp.getDate() - Math.floor(Math.random() * 30));
      
      // Generate a random target ID if needed
      const targetId = actionTemplate.target.endsWith('_') 
        ? actionTemplate.target + Math.floor(Math.random() * 100)
        : actionTemplate.target;
      
      // Create log entry
      const logEntry = {
        timestamp,
        userId: user.id,
        walletAddress: user.wallet,
        action: actionTemplate.action,
        targetResource: targetId,
        status,
        category: actionTemplate.category,
        severity,
        details: {
          example: 'This is an example log entry for development purposes'
        }
      };
      
      this.auditLogs.push(logEntry);
    }
    
    // Sort logs by timestamp descending (newest first)
    this.auditLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

// Create a singleton instance
const auditLoggingSystem = new AuditLoggingSystem();

// Export everything
module.exports = {
  AuditLoggingSystem,
  auditLoggingSystem
};