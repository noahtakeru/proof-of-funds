/**
 * Admin Audit Logger for ZK System
 * 
 * This module provides comprehensive audit logging capabilities for administrative
 * actions within the ZK proof system, ensuring compliance with regulations and
 * providing a detailed audit trail for all administrative operations.
 */

import { rbacSystem, Permission, ActionLogEntry } from './RoleBasedAccessControl';
import zkErrorLogger from '../zkErrorLogger.mjs';
const { zkErrorLogger: logger } = zkErrorLogger;

// Extended audit log entry interface with additional metadata for compliance
export interface AuditLogEntry extends ActionLogEntry {
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  category: 'user_management' | 'proof_management' | 'system_config' | 'security' | 'authentication' | 'other';
  severity: 'info' | 'warning' | 'error' | 'critical';
  compliance?: {
    pii?: boolean;
    regulatory?: string[];
    retention?: number; // Days to retain this log entry
  };
  metadata?: Record<string, any>;
}

// Audit log search filters
export interface AuditLogSearchFilters {
  userId?: string;
  walletAddress?: string;
  action?: string;
  targetResource?: string;
  status?: 'success' | 'denied' | 'error';
  startDate?: Date;
  endDate?: Date;
  category?: AuditLogEntry['category'];
  severity?: AuditLogEntry['severity'];
  ip?: string;
  containsText?: string;
}

// Audit log statistics
export interface AuditLogStatistics {
  totalEntries: number;
  byStatus: Record<'success' | 'denied' | 'error', number>;
  byCategory: Record<AuditLogEntry['category'], number>;
  bySeverity: Record<AuditLogEntry['severity'], number>;
  topActions: Array<{ action: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
  recentDeniedActions: AuditLogEntry[];
}

/**
 * Audit Logging System
 */
export class AuditLoggingSystem {
  private auditLogs: AuditLogEntry[] = [];

  constructor() {
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
  public logAuditEvent(entry: Omit<AuditLogEntry, 'timestamp'>): AuditLogEntry {
    const logEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date()
    };

    // Add to audit logs
    this.auditLogs.unshift(logEntry);

    // Also log to the central error logger for persistence
    logger.log(
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
  public searchAuditLogs(
    filters: AuditLogSearchFilters,
    adminWalletAddress: string,
    pagination?: { skip: number; limit: number }
  ): { logs: AuditLogEntry[]; total: number } | null {
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
   * Get audit log statistics
   */
  public getAuditLogStatistics(
    adminWalletAddress: string,
    dateRange?: { startDate: Date; endDate: Date }
  ): AuditLogStatistics | null {
    // Check if admin has permission to view logs
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.VIEW_LOGS)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'view_audit_statistics',
        targetResource: 'audit_logs',
        status: 'denied',
        details: { dateRange }
      });

      return null;
    }

    // Filter logs by date range if specified
    let logsToAnalyze = this.auditLogs;
    if (dateRange) {
      logsToAnalyze = this.auditLogs.filter(
        log => log.timestamp >= dateRange.startDate && log.timestamp <= dateRange.endDate
      );
    }

    // Count by status
    const byStatus = {
      success: 0,
      denied: 0,
      error: 0
    };

    // Count by category
    const byCategory = {
      user_management: 0,
      proof_management: 0,
      system_config: 0,
      security: 0,
      authentication: 0,
      other: 0
    };

    // Count by severity
    const bySeverity = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0
    };

    // Count actions
    const actionCounts: Record<string, number> = {};

    // Count users
    const userCounts: Record<string, number> = {};

    // Get recent denied actions
    const recentDeniedActions: AuditLogEntry[] = [];

    // Analyze logs
    for (const log of logsToAnalyze) {
      // Count by status
      byStatus[log.status]++;

      // Count by category
      byCategory[log.category]++;

      // Count by severity
      bySeverity[log.severity]++;

      // Count actions
      if (actionCounts[log.action]) {
        actionCounts[log.action]++;
      } else {
        actionCounts[log.action] = 1;
      }

      // Count users
      if (userCounts[log.userId]) {
        userCounts[log.userId]++;
      } else {
        userCounts[log.userId] = 1;
      }

      // Track recent denied actions
      if (log.status === 'denied' && recentDeniedActions.length < 10) {
        recentDeniedActions.push(log);
      }
    }

    // Sort and limit top actions
    const topActions = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Sort and limit top users
    const topUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Compile statistics
    const statistics: AuditLogStatistics = {
      totalEntries: logsToAnalyze.length,
      byStatus,
      byCategory,
      bySeverity,
      topActions,
      topUsers,
      recentDeniedActions
    };

    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);

    // Log the action
    this.logAuditEvent({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'view_audit_statistics',
      targetResource: 'audit_logs',
      status: 'success',
      category: 'security',
      severity: 'info',
      details: { dateRange }
    });

    return statistics;
  }

  /**
   * Export audit logs for compliance
   */
  public exportAuditLogs(
    filters: AuditLogSearchFilters,
    adminWalletAddress: string,
    format: 'json' | 'csv' = 'json'
  ): string | null {
    // Check if admin has permission to view logs
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.VIEW_LOGS)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'export_audit_logs',
        targetResource: 'audit_logs',
        status: 'denied',
        details: { filters, format }
      });

      return null;
    }

    // Search logs with the given filters
    const searchResult = this.searchAuditLogs(filters, adminWalletAddress);

    if (!searchResult) {
      return null;
    }

    const { logs } = searchResult;

    // Format according to requested format
    let exportData: string;

    if (format === 'csv') {
      // Create CSV export
      const headers = [
        'timestamp',
        'userId',
        'walletAddress',
        'action',
        'targetResource',
        'status',
        'category',
        'severity',
        'ip',
        'userAgent',
        'sessionId',
        'details'
      ].join(',');

      const rows = logs.map(log => [
        log.timestamp.toISOString(),
        log.userId,
        log.walletAddress,
        log.action,
        log.targetResource,
        log.status,
        log.category,
        log.severity,
        log.ip || '',
        log.userAgent ? `"${log.userAgent.replace(/"/g, '""')}"` : '',
        log.sessionId || '',
        log.details ? `"${JSON.stringify(log.details).replace(/"/g, '""')}"` : ''
      ].join(','));

      exportData = [headers, ...rows].join('\n');
    } else {
      // Create JSON export
      exportData = JSON.stringify(logs, null, 2);
    }

    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);

    // Log the action
    this.logAuditEvent({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'export_audit_logs',
      targetResource: 'audit_logs',
      status: 'success',
      category: 'security',
      severity: 'info',
      details: {
        filters,
        format,
        logCount: logs.length
      }
    });

    return exportData;
  }

  /**
   * Hook into the RBAC log system to capture all action logs
   */
  private hookIntoRbacLogSystem(): void {
    // We will capture the original RBAC logs and enhance them for the audit system
    // This is a simple way to ensure we don't miss any admin actions

    // The process here would connect to the RBAC system's logging mechanism
    // Since we can't directly hook into a running system in this example,
    // we'll just rely on calling our methods directly
  }

  /**
   * Generate example audit logs for development
   */
  private initializeExampleLogs(): void {
    // Admin users for example logs
    const users = [
      { id: 'super_admin', wallet: '0x0123456789abcdef0123456789abcdef01234567' },
      { id: 'admin_user', wallet: '0x1123456789abcdef0123456789abcdef01234567' },
      { id: 'system_manager', wallet: '0x2123456789abcdef0123456789abcdef01234567' },
      { id: 'proof_manager', wallet: '0x3123456789abcdef0123456789abcdef01234567' }
    ];

    // Action templates
    const userActions = [
      { action: 'create_user', target: 'user_', category: 'user_management' },
      { action: 'update_user_roles', target: 'user_', category: 'user_management' },
      { action: 'view_user', target: 'user_', category: 'user_management' },
      { action: 'delete_user', target: 'user_', category: 'user_management' },
      { action: 'search_users', target: 'users', category: 'user_management' }
    ];

    const proofActions = [
      { action: 'search_proofs', target: 'proofs', category: 'proof_management' },
      { action: 'view_proof', target: 'proof_', category: 'proof_management' },
      { action: 'verify_proof', target: 'proof_', category: 'proof_management' },
      { action: 'invalidate_proof', target: 'proof_', category: 'proof_management' }
    ];

    const configActions = [
      { action: 'view_system_config', target: 'system_config', category: 'system_config' },
      { action: 'update_system_config', target: 'system_config', category: 'system_config' },
      { action: 'view_config_history', target: 'system_config', category: 'system_config' }
    ];

    const securityActions = [
      { action: 'view_audit_logs', target: 'audit_logs', category: 'security' },
      { action: 'search_audit_logs', target: 'audit_logs', category: 'security' },
      { action: 'export_audit_logs', target: 'audit_logs', category: 'security' },
      { action: 'login', target: 'admin_portal', category: 'authentication' },
      { action: 'logout', target: 'admin_portal', category: 'authentication' },
      { action: 'failed_login', target: 'admin_portal', category: 'authentication' }
    ];

    const allActions = [...userActions, ...proofActions, ...configActions, ...securityActions];

    // Generate 100 random log entries
    for (let i = 0; i < 100; i++) {
      // Pick a random user
      const user = users[Math.floor(Math.random() * users.length)];

      // Pick a random action
      const actionTemplate = allActions[Math.floor(Math.random() * allActions.length)];

      // Pick a random status - mostly successful with some denied/error
      const statusRoll = Math.random();
      const status = statusRoll < 0.8 ? 'success' : statusRoll < 0.95 ? 'denied' : 'error';

      // Pick a random severity - mostly info with some warnings/errors
      const severityRoll = Math.random();
      const severity = severityRoll < 0.7 ? 'info' :
        severityRoll < 0.9 ? 'warning' :
          severityRoll < 0.98 ? 'error' : 'critical';

      // Generate a random date in the last 30 days
      const timestamp = new Date();
      timestamp.setDate(timestamp.getDate() - Math.floor(Math.random() * 30));
      timestamp.setHours(
        Math.floor(Math.random() * 24),
        Math.floor(Math.random() * 60),
        Math.floor(Math.random() * 60)
      );

      // Generate a random target ID if needed
      const targetId = actionTemplate.target.endsWith('_')
        ? actionTemplate.target + Math.floor(Math.random() * 100)
        : actionTemplate.target;

      // Generate a random IP address
      const ip = `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;

      // Generate user agent from common options
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:95.0) Gecko/20100101 Firefox/95.0',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Mobile/15E148 Safari/604.1'
      ];
      const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

      // Generate a random session ID
      const sessionId = `session_${Math.random().toString(36).substring(2, 9)}`;

      // Create log entry
      const logEntry: AuditLogEntry = {
        timestamp,
        userId: user.id,
        walletAddress: user.wallet,
        action: actionTemplate.action,
        targetResource: targetId,
        status: status as any,
        category: actionTemplate.category as any,
        severity: severity as any,
        ip,
        userAgent,
        sessionId,
        details: {
          example: 'This is an example log entry for development purposes'
        }
      };

      // Add compliance info for some logs
      if (Math.random() < 0.3) {
        logEntry.compliance = {
          pii: Math.random() < 0.5,
          regulatory: Math.random() < 0.3 ? ['GDPR', 'CCPA'] : undefined,
          retention: 365 * 2 // 2 years
        };
      }

      this.auditLogs.push(logEntry);
    }

    // Sort logs by timestamp descending (newest first)
    this.auditLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

// Create a singleton instance
export const auditLoggingSystem = new AuditLoggingSystem();

// Export default for CommonJS compatibility
export default auditLoggingSystem;