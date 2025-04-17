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
   * Exports audit logs in various formats with filtering and anonymization options
   * @param {Object} options Export options 
   * @returns {Object} Exported data and metadata
   */
  exportAuditLogs(options = {}) {
    // Apply filters to get logs to export
    let logsToExport = [...this.auditLogs];
    
    // Apply date range filter
    if (options.dateRange) {
      logsToExport = logsToExport.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= options.dateRange.start && logDate <= options.dateRange.end;
      });
    }
    
    // Apply search filters
    if (options.filters) {
      logsToExport = this.searchAuditLogs(options.filters, 'SYSTEM', null).logs;
    }
    
    // Sort by timestamp (newest first)
    logsToExport.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Anonymize if requested
    if (options.anonymize) {
      logsToExport = logsToExport.map(log => this.anonymizeLogEntry(log));
    }
    
    // Remove details if not requested
    if (options.includeDetails === false) {
      logsToExport = logsToExport.map(log => {
        const { details, ...rest } = log;
        return {
          ...rest,
          details: { message: 'Details omitted' }
        };
      });
    }
    
    // Determine format (default to JSON)
    const format = options.format || 'json';
    let data;
    let contentType;
    
    switch (format) {
      case 'csv':
        data = this.convertLogsToCSV(logsToExport);
        contentType = 'text/csv';
        break;
      case 'pdf':
        // For PDF we'd normally use a library like PDFKit
        // Since we're not adding dependencies, return a message
        data = JSON.stringify({
          message: 'PDF export would be implemented with PDFKit or similar library',
          logCount: logsToExport.length
        });
        contentType = 'application/json';
        break;
      case 'json':
      default:
        data = JSON.stringify({
          exportTimestamp: new Date().toISOString(),
          entries: logsToExport
        }, null, 2);
        contentType = 'application/json';
    }
    
    // Generate timestamp string for filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `audit-logs-export-${timestamp}.${format}`;
    
    // Return the export result
    return {
      data,
      format: contentType,
      filename,
      metadata: {
        timestamp: new Date().toISOString(),
        entriesCount: logsToExport.length,
        filters: options.filters || {},
        exportedBy: 'system'
      }
    };
  }
  
  /**
   * Anonymize a log entry
   * @private
   */
  anonymizeLogEntry(log) {
    const anonymized = { ...log };
    
    // Hash the user ID for anonymization
    if (anonymized.userId) {
      anonymized.userId = this.hashForAnonymization(anonymized.userId);
    }
    
    // Hash the wallet address for anonymization
    if (anonymized.walletAddress) {
      anonymized.walletAddress = anonymized.walletAddress.substring(0, 6) + '...' + 
        anonymized.walletAddress.substring(anonymized.walletAddress.length - 4);
    }
    
    // Redact potentially sensitive information in details
    if (anonymized.details) {
      const redactedDetails = { ...anonymized.details };
      
      // List of keys that might contain PII
      const sensitiveKeys = ['email', 'name', 'phone', 'address', 'ip', 'location'];
      
      // Redact sensitive fields
      Object.keys(redactedDetails).forEach(key => {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          redactedDetails[key] = '[REDACTED]';
        }
      });
      
      anonymized.details = redactedDetails;
    }
    
    return anonymized;
  }
  
  /**
   * Hash a value for anonymization
   * @private
   */
  hashForAnonymization(value) {
    // Simple hash function for demonstration
    // In a real implementation, we would use a cryptographic hash
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return 'anon_' + Math.abs(hash).toString(16).substring(0, 8);
  }
  
  /**
   * Convert logs to CSV format
   * @private
   */
  convertLogsToCSV(logs) {
    // Define headers
    const headers = [
      'Timestamp',
      'User ID',
      'Wallet Address',
      'Action',
      'Resource',
      'Status',
      'Category',
      'Severity'
    ];
    
    // Create CSV content
    let csv = headers.join(',') + '\n';
    
    // Add each log entry
    for (const log of logs) {
      const row = [
        log.timestamp,
        log.userId,
        log.walletAddress,
        log.action,
        log.targetResource,
        log.status,
        log.category || '',
        log.severity || ''
      ];
      
      // Escape fields with commas
      const escapedRow = row.map(field => {
        if (typeof field === 'string' && field.includes(',')) {
          return `"${field}"`;
        }
        return field;
      });
      
      csv += escapedRow.join(',') + '\n';
    }
    
    return csv;
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