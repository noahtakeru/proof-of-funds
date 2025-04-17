/**
 * Admin Audit Logger for ZK System
 * 
 * This module provides comprehensive audit logging capabilities for administrative
 * actions within the ZK proof system, ensuring compliance with regulations and
 * providing a detailed audit trail for all administrative operations.
 */

import * as crypto from 'crypto';
import { ZKErrorLogger } from '../zkErrorLogger.js';

// Create a proper logger instance for audit logging
const logger = new ZKErrorLogger({
  privacyLevel: 'internal',
  logLevel: 'info',
  destinations: ['console', 'file']
});

/**
 * AuditEvent types that can be logged
 */
export enum AuditEventType {
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  ROLE_ASSIGNED = 'role_assigned',
  ROLE_REVOKED = 'role_revoked',
  PERMISSION_GRANTED = 'permission_granted',
  PERMISSION_REVOKED = 'permission_revoked',
  CONFIG_CHANGED = 'config_changed',
  PROOF_ACCESSED = 'proof_accessed',
  PROOF_MODIFIED = 'proof_modified',
  PROOF_DELETED = 'proof_deleted',
  SYSTEM_STARTUP = 'system_startup',
  SYSTEM_SHUTDOWN = 'system_shutdown',
  BACKUP_CREATED = 'backup_created',
  BACKUP_RESTORED = 'backup_restored',
  SECURITY_VIOLATION = 'security_violation'
}

/**
 * Interface for audit log entries
 */
export interface AuditLogEntry {
  timestamp: string;
  eventId: string;
  eventType: AuditEventType | string;
  userId: string;
  username: string;
  ipAddress: string;
  userAgent: string;
  resource: string;
  action: string;
  status: 'success' | 'failure' | 'denied' | 'error';
  details: Record<string, any>;
  category?: 'user_management' | 'proof_management' | 'system_config' | 'security' | 'authentication' | 'other';
  severity?: 'info' | 'warning' | 'error' | 'critical';
  compliance?: {
    pii?: boolean;
    regulatory?: string[];
    retention?: number; // Days to retain this log entry
  };
  metadata?: Record<string, any>;
  hash?: string; // Make hash optional to allow deletion
  previousEntryHash: string;
}

/**
 * Audit log search filters
 */
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

/**
 * Audit log statistics
 */
export interface AuditLogStatistics {
  totalEntries: number;
  byStatus: Record<'success' | 'denied' | 'error', number>;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  topActions: Array<{ action: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
  recentDeniedActions: AuditLogEntry[];
}

/**
 * Class for audit logging admin operations
 */
export class AuditLogger {
  private logEntries: AuditLogEntry[] = [];
  private lastEntryHash: string = '';

  /**
   * Creates a new AuditLogger instance
   */
  constructor() {
    // Initialize the chain with a genesis entry
    this.createGenesisEntry();
  }

  /**
   * Create the initial genesis entry for the audit log chain
   * @private
   */
  private createGenesisEntry(): void {
    const timestamp = new Date().toISOString();
    const genesisEntry: AuditLogEntry = {
      timestamp,
      eventId: `genesis_${timestamp.replace(/[-:.TZ]/g, '')}`,
      eventType: AuditEventType.SYSTEM_STARTUP,
      userId: 'system',
      username: 'system',
      ipAddress: '127.0.0.1',
      userAgent: 'AuditLogger/1.0',
      resource: 'system',
      action: 'initialization',
      status: 'success',
      details: { message: 'Audit log chain initialized' },
      category: 'system_config',
      severity: 'info',
      hash: '',
      previousEntryHash: 'genesis'
    };

    // Calculate hash for the genesis entry
    genesisEntry.hash = this.calculateEntryHash(genesisEntry);
    this.lastEntryHash = genesisEntry.hash;

    // Store the genesis entry
    this.logEntries.push(genesisEntry);

    // Log the initialization
    logger.info('Audit logging initialized', {
      eventId: genesisEntry.eventId
    });
  }

  /**
   * Calculates a hash for an audit log entry
   * 
   * @param entry The entry to hash
   * @returns Hash of the entry
   * @private
   */
  private calculateEntryHash(entry: AuditLogEntry): string {
    // Create a copy without the hash field
    const entryForHashing = { ...entry };
    delete entryForHashing.hash;

    // Convert to string and hash
    const entryString = JSON.stringify(entryForHashing);
    return crypto.createHash('sha256').update(entryString).digest('hex');
  }

  /**
   * Logs an audit event
   * 
   * @param eventType Type of audit event
   * @param userId ID of the user performing the action
   * @param username Username of the user
   * @param ipAddress IP address of the user
   * @param userAgent User agent of the client
   * @param resource Resource being accessed
   * @param action Action being performed
   * @param status Success or failure
   * @param details Additional details
   * @returns The created audit log entry
   */
  public logEvent(
    eventType: AuditEventType | string,
    userId: string,
    username: string,
    ipAddress: string,
    userAgent: string,
    resource: string,
    action: string,
    status: 'success' | 'failure' | 'denied' | 'error',
    details: Record<string, any> = {}
  ): AuditLogEntry {
    const timestamp = new Date().toISOString();
    const eventId = `audit_${timestamp.replace(/[-:.TZ]/g, '')}_${Math.random().toString(36).substring(2, 7)}`;

    // Determine category and severity from event type
    const category = this.getCategoryFromEventType(eventType);
    const severity = this.getSeverityFromStatus(status);

    // Create the new entry
    const entry: AuditLogEntry = {
      timestamp,
      eventId,
      eventType,
      userId,
      username,
      ipAddress,
      userAgent,
      resource,
      action,
      status,
      details,
      category,
      severity,
      hash: '',
      previousEntryHash: this.lastEntryHash
    };

    // Calculate the hash
    entry.hash = this.calculateEntryHash(entry);
    this.lastEntryHash = entry.hash;

    // Store the entry
    this.logEntries.push(entry);

    // Log the event
    if (status === 'success') {
      logger.info(`Audit: ${action} on ${resource} by ${username}`, {
        eventId,
        eventType,
        userId,
        resource
      });
    } else {
      logger.warn(`Audit: Failed ${action} on ${resource} by ${username}`, {
        eventId,
        eventType,
        userId,
        resource,
        details
      });
    }

    return entry;
  }

  /**
   * Determine the category based on event type
   * @private
   */
  private getCategoryFromEventType(eventType: AuditEventType | string): AuditLogEntry['category'] {
    const userEvents = [
      AuditEventType.USER_LOGIN,
      AuditEventType.USER_LOGOUT,
      AuditEventType.USER_CREATED,
      AuditEventType.USER_UPDATED,
      AuditEventType.USER_DELETED
    ];

    const proofEvents = [
      AuditEventType.PROOF_ACCESSED,
      AuditEventType.PROOF_MODIFIED,
      AuditEventType.PROOF_DELETED
    ];

    const configEvents = [
      AuditEventType.CONFIG_CHANGED,
      AuditEventType.SYSTEM_STARTUP,
      AuditEventType.SYSTEM_SHUTDOWN
    ];

    const securityEvents = [
      AuditEventType.SECURITY_VIOLATION,
      AuditEventType.ROLE_ASSIGNED,
      AuditEventType.ROLE_REVOKED,
      AuditEventType.PERMISSION_GRANTED,
      AuditEventType.PERMISSION_REVOKED
    ];

    if (userEvents.includes(eventType as AuditEventType)) {
      return 'user_management';
    } else if (proofEvents.includes(eventType as AuditEventType)) {
      return 'proof_management';
    } else if (configEvents.includes(eventType as AuditEventType)) {
      return 'system_config';
    } else if (securityEvents.includes(eventType as AuditEventType)) {
      return 'security';
    } else if (eventType === AuditEventType.USER_LOGIN || eventType === AuditEventType.USER_LOGOUT) {
      return 'authentication';
    }

    return 'other';
  }

  /**
   * Determine severity based on status
   * @private
   */
  private getSeverityFromStatus(status: string): AuditLogEntry['severity'] {
    switch (status) {
      case 'error':
        return 'error';
      case 'denied':
        return 'warning';
      case 'failure':
        return 'warning';
      default:
        return 'info';
    }
  }

  /**
   * Verifies the integrity of the audit log chain
   * 
   * @returns Object with verification result and any invalid entries
   */
  public verifyLogIntegrity(): { valid: boolean; invalidEntries: AuditLogEntry[] } {
    const invalidEntries: AuditLogEntry[] = [];

    // Skip if we only have the genesis entry
    if (this.logEntries.length <= 1) {
      return { valid: true, invalidEntries };
    }

    let previousHash = this.logEntries[0].hash;

    // Check each entry after the genesis
    for (let i = 1; i < this.logEntries.length; i++) {
      const entry = this.logEntries[i];

      // Check previous hash linkage
      if (entry.previousEntryHash !== previousHash) {
        invalidEntries.push(entry);
        continue;
      }

      // Check the entry's own hash
      const calculatedHash = this.calculateEntryHash(entry);
      if (calculatedHash !== entry.hash) {
        invalidEntries.push(entry);
      }

      previousHash = entry.hash;
    }

    return {
      valid: invalidEntries.length === 0,
      invalidEntries
    };
  }

  /**
   * Gets all audit log entries
   * 
   * @returns Array of audit log entries
   */
  public getLogEntries(): AuditLogEntry[] {
    return [...this.logEntries];
  }

  /**
   * Gets audit logs with filtering, sorting, and pagination support
   * 
   * @param options Options for retrieving logs
   * @returns Paginated audit log entries with metadata
   */
  public getAuditLogs(options: {
    filters?: AuditLogSearchFilters;
    page?: number;
    pageSize?: number;
    sortBy?: keyof AuditLogEntry;
    sortDirection?: 'asc' | 'desc';
    includeDetails?: boolean;
    anonymize?: boolean;
  } = {}): {
    logs: AuditLogEntry[];
    pagination: {
      currentPage: number;
      pageSize: number;
      totalPages: number;
      totalItems: number;
    };
    metadata: {
      timestamp: string;
      filters: AuditLogSearchFilters | null;
      sortBy: string | null;
      sortDirection: string | null;
    }
  } {
    // Default values
    const page = options.page || 1;
    const pageSize = options.pageSize || 50;
    const sortBy = options.sortBy || 'timestamp';
    const sortDirection = options.sortDirection || 'desc';

    // Get filtered logs
    let filteredLogs = options.filters ? this.searchLogs(options.filters) : [...this.logEntries];

    // Sort logs
    filteredLogs = this.sortLogs(filteredLogs, sortBy, sortDirection);

    // Calculate pagination
    const totalItems = filteredLogs.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);

    // Get logs for current page
    let paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    // Process logs if needed
    if (options.anonymize) {
      paginatedLogs = paginatedLogs.map(log => this.anonymizeLogEntry(log));
    }

    // Optionally remove sensitive details
    if (options.includeDetails === false) {
      paginatedLogs = paginatedLogs.map(log => {
        const { details, ...rest } = log;
        return {
          ...rest,
          details: { sensitive: 'Redacted for security reasons' }
        };
      });
    }

    return {
      logs: paginatedLogs,
      pagination: {
        currentPage: page,
        pageSize,
        totalPages,
        totalItems
      },
      metadata: {
        timestamp: new Date().toISOString(),
        filters: options.filters || null,
        sortBy: sortBy as string,
        sortDirection
      }
    };
  }

  /**
   * Sorts audit logs by the specified field and direction
   * 
   * @param logs Logs to sort
   * @param sortBy Field to sort by
   * @param sortDirection Direction to sort
   * @returns Sorted logs
   * @private
   */
  private sortLogs(
    logs: AuditLogEntry[],
    sortBy: keyof AuditLogEntry,
    sortDirection: 'asc' | 'desc'
  ): AuditLogEntry[] {
    return [...logs].sort((a, b) => {
      // Handle different data types appropriately
      let valueA = a[sortBy];
      let valueB = b[sortBy];

      // For nested objects, return unsorted
      if (typeof valueA === 'object' || typeof valueB === 'object') {
        return 0;
      }

      // For dates, convert to timestamps
      if (sortBy === 'timestamp') {
        const timeA = new Date(valueA as string).getTime();
        const timeB = new Date(valueB as string).getTime();
        return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }

      // For string comparisons
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortDirection === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }

      // For number comparisons (handle by converting to numbers)
      const numA = Number(valueA);
      const numB = Number(valueB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      // Default comparison (as strings)
      const strA = String(valueA);
      const strB = String(valueB);
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }

  /**
   * Gets audit log entries filtered by criteria
   * 
   * @param filters Filters to apply
   * @returns Filtered audit log entries
   */
  public getFilteredLogs(filters: Partial<AuditLogEntry>): AuditLogEntry[] {
    return this.logEntries.filter(entry => {
      for (const [key, value] of Object.entries(filters)) {
        if (entry[key as keyof AuditLogEntry] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Search audit logs using the search filters
   * 
   * @param filters Search filters to apply
   * @returns Matching audit log entries
   */
  public searchLogs(filters: AuditLogSearchFilters): AuditLogEntry[] {
    return this.logEntries.filter(entry => {
      // Check user ID
      if (filters.userId && entry.userId !== filters.userId) {
        return false;
      }

      // Check action
      if (filters.action && entry.action !== filters.action) {
        return false;
      }

      // Check resource
      if (filters.targetResource && entry.resource !== filters.targetResource) {
        return false;
      }

      // Check status
      if (filters.status && entry.status !== filters.status) {
        return false;
      }

      // Check category
      if (filters.category && entry.category !== filters.category) {
        return false;
      }

      // Check severity
      if (filters.severity && entry.severity !== filters.severity) {
        return false;
      }

      // Check IP address
      if (filters.ip && entry.ipAddress !== filters.ip) {
        return false;
      }

      // Check date range
      if (filters.startDate) {
        const entryDate = new Date(entry.timestamp);
        if (entryDate < filters.startDate) {
          return false;
        }
      }

      if (filters.endDate) {
        const entryDate = new Date(entry.timestamp);
        if (entryDate > filters.endDate) {
          return false;
        }
      }

      // Check text content
      if (filters.containsText) {
        const textToSearch = filters.containsText.toLowerCase();
        const entryText = JSON.stringify(entry).toLowerCase();
        if (!entryText.includes(textToSearch)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Generate statistics from the audit log
   * 
   * @param dateRange Optional date range to limit statistics
   * @returns Audit log statistics
   */
  public generateStatistics(dateRange?: { start: Date; end: Date }): AuditLogStatistics {
    let logsToAnalyze = this.logEntries;

    // Filter by date range if provided
    if (dateRange) {
      logsToAnalyze = logsToAnalyze.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= dateRange.start && logDate <= dateRange.end;
      });
    }

    // Initialize counters
    const byStatus: Record<string, number> = {
      success: 0,
      denied: 0,
      error: 0
    };

    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const actionCounts: Record<string, number> = {};
    const userCounts: Record<string, number> = {};
    const recentDeniedActions: AuditLogEntry[] = [];

    // Process each log entry
    for (const log of logsToAnalyze) {
      // Count by status
      if (log.status in byStatus) {
        byStatus[log.status]++;
      }

      // Count by category
      if (log.category) {
        byCategory[log.category] = (byCategory[log.category] || 0) + 1;
      }

      // Count by severity
      if (log.severity) {
        bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;
      }

      // Count actions
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;

      // Count users
      userCounts[log.userId] = (userCounts[log.userId] || 0) + 1;

      // Collect denied actions
      if (log.status === 'denied' || log.status === 'error') {
        recentDeniedActions.push(log);
      }
    }

    // Sort and limit top actions
    const topActions = Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    // Sort and limit top users
    const topUsers = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count }));

    // Sort recent denied actions by timestamp (newest first)
    const sortedDeniedActions = recentDeniedActions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    return {
      totalEntries: logsToAnalyze.length,
      byStatus: byStatus as Record<'success' | 'denied' | 'error', number>,
      byCategory,
      bySeverity,
      topActions,
      topUsers,
      recentDeniedActions: sortedDeniedActions
    };
  }

  /**
   * Exports audit logs to JSON format
   * 
   * @returns JSON string of audit logs
   */
  public exportLogsToJson(): string {
    return JSON.stringify({
      exportTimestamp: new Date().toISOString(),
      entries: this.logEntries
    }, null, 2);
  }

  /**
   * Exports audit logs filtered by specified criteria and format
   * 
   * @param options Export options
   * @param options.filters Filters to apply to the logs
   * @param options.format Format of the export ('json', 'csv', 'pdf')
   * @param options.includeDetails Whether to include detailed information
   * @param options.anonymize Whether to anonymize sensitive information
   * @param options.dateRange Date range for logs to export
   * @returns Object containing the exported logs and metadata
   */
  public exportAuditLogs(options: {
    filters?: AuditLogSearchFilters;
    format?: 'json' | 'csv' | 'pdf';
    includeDetails?: boolean;
    anonymize?: boolean;
    dateRange?: { start: Date; end: Date };
  } = {}): {
    data: string;
    format: string;
    filename: string;
    metadata: {
      timestamp: string;
      entriesCount: number;
      filters: any;
      exportedBy: string;
    };
  } {
    // Apply filters to get logs to export
    let logsToExport = [...this.logEntries];

    // Apply date range filter
    if (options.dateRange) {
      logsToExport = logsToExport.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= options.dateRange!.start && logDate <= options.dateRange!.end;
      });
    }

    // Apply search filters
    if (options.filters) {
      logsToExport = this.searchLogs(options.filters);
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
    let data: string;
    let contentType: string;

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
   * Anonymize a log entry by removing PII
   * @private
   */
  private anonymizeLogEntry(entry: AuditLogEntry): AuditLogEntry {
    const anonymized = { ...entry };

    // Replace user identifiers
    anonymized.userId = this.hashForAnonymization(entry.userId);
    anonymized.username = this.hashForAnonymization(entry.username);

    // Anonymize IP address (keep first part)
    const ipParts = entry.ipAddress.split('.');
    if (ipParts.length === 4) {
      anonymized.ipAddress = `${ipParts[0]}.${ipParts[1]}.*.*`;
    }

    // Strip identifiers from user agent
    anonymized.userAgent = entry.userAgent.replace(/\/[\d\.]+/g, '/x.x.x');

    // Check if details contain sensitive information and anonymize
    if (anonymized.details) {
      const sensitiveKeys = ['email', 'phone', 'address', 'fullName', 'password', 'key', 'secret', 'token'];

      const anonymizedDetails = { ...anonymized.details };
      for (const key of Object.keys(anonymizedDetails)) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          anonymizedDetails[key] = '[REDACTED]';
        }
      }

      anonymized.details = anonymizedDetails;
    }

    return anonymized;
  }

  /**
   * Convert logs to CSV format
   * @private
   */
  private convertLogsToCSV(logs: AuditLogEntry[]): string {
    // Define headers
    const headers = [
      'Timestamp',
      'Event ID',
      'Event Type',
      'User ID',
      'Username',
      'IP Address',
      'Resource',
      'Action',
      'Status',
      'Category',
      'Severity'
    ];

    // Create header row
    let csv = headers.join(',') + '\n';

    // Add each log entry
    for (const log of logs) {
      const row = [
        log.timestamp,
        log.eventId,
        log.eventType,
        log.userId,
        log.username,
        log.ipAddress,
        this.escapeCSV(log.resource),
        this.escapeCSV(log.action),
        log.status,
        log.category || '',
        log.severity || ''
      ];

      csv += row.join(',') + '\n';
    }

    return csv;
  }

  /**
   * Escape a string for CSV
   * @private
   */
  private escapeCSV(str: string): string {
    if (!str) return '';

    // If string contains commas, quotes, or newlines, wrap in quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      // Double up any quotes
      str = str.replace(/"/g, '""');
      // Wrap in quotes
      return `"${str}"`;
    }

    return str;
  }

  /**
   * Create a hash for anonymization
   * @private
   */
  private hashForAnonymization(value: string): string {
    if (!value) return '';

    // Create a hash but only use part of it to maintain consistency
    const hash = crypto.createHash('sha256').update(value).digest('hex');
    return hash.substring(0, 8);
  }

  /**
   * Initialize example logs for development environment
   * @private
   */
  private initializeExampleLogs(): void {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    // Example logs for testing
    const exampleEvents = [
      {
        eventType: AuditEventType.USER_LOGIN,
        userId: 'user123',
        username: 'testuser',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        resource: 'authentication',
        action: 'login',
        status: 'success' as const,
        details: { method: 'password' }
      },
      {
        eventType: AuditEventType.PROOF_ACCESSED,
        userId: 'user123',
        username: 'testuser',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        resource: 'proof/123',
        action: 'view',
        status: 'success' as const,
        details: { proofId: '123' }
      },
      {
        eventType: AuditEventType.PERMISSION_GRANTED,
        userId: 'admin456',
        username: 'admin',
        ipAddress: '192.168.1.2',
        userAgent: 'Mozilla/5.0',
        resource: 'role/editor',
        action: 'permission_add',
        status: 'success' as const,
        details: { permission: 'EDIT_PROOFS', role: 'editor' }
      }
    ];

    // Add example logs
    for (const event of exampleEvents) {
      this.logEvent(
        event.eventType,
        event.userId,
        event.username,
        event.ipAddress,
        event.userAgent,
        event.resource,
        event.action,
        event.status,
        event.details
      );
    }
  }
}

// Create singleton instance
const auditLogger = new AuditLogger();

/**
 * Get the singleton instance of the audit logger
 * @returns The audit logger instance
 */
export function getAuditLogger(): AuditLogger {
  return auditLogger;
}