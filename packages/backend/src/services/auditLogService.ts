/**
 * Audit Log Service
 * 
 * Provides centralized audit logging functionality for security-relevant events
 */
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { Storage } from '@google-cloud/storage';
import { 
  AuditLog, 
  AuditLogParams,
  AuditLogQueryParams,
  AuditLogQueryResult,
  AuditLogExportParams,
  AuditLogExportResult,
  AuditEventType, 
  ActorType, 
  AuditAction, 
  AuditStatus, 
  AuditSeverity
} from '../models/auditLog';
import logger from '../utils/logger';
import config from '../config';
import fs from 'fs';
import path from 'path';

/**
 * Get audit log config from main config with defaults for testing
 */
const auditLogConfig = config.auditLog || {
  enabled: true,
  retention: {
    days: 365
  },
  gcpBackup: {
    enabled: false,
    bucketName: 'test-bucket'
  }
};

/**
 * Service for handling audit logging
 */
class AuditLogService {
  private prisma: PrismaClient;
  private storage: Storage | null = null;
  
  constructor() {
    this.prisma = new PrismaClient();
    
    // Initialize GCP Storage for backup if configured
    if (auditLogConfig.gcpBackup.enabled && config.gcp.projectId) {
      try {
        this.storage = new Storage({
          projectId: config.gcp.projectId
        });
        
        // Initialize storage bucket if needed
        this.initializeStorageBucket().catch(err => {
          logger.error('Failed to initialize GCP Storage bucket for audit logs', { error: err });
        });
      } catch (error) {
        logger.error('Failed to initialize GCP Storage for audit logs', { error });
      }
    }
  }
  
  /**
   * Initialize GCP Storage bucket for audit logs
   */
  private async initializeStorageBucket(): Promise<void> {
    if (!this.storage) return;
    
    try {
      const bucketName = auditLogConfig.gcpBackup.bucketName;
      const [buckets] = await this.storage.getBuckets();
      const bucketExists = buckets.some(b => b.name === bucketName);
      
      if (!bucketExists) {
        // Create bucket if it doesn't exist
        await this.storage.createBucket(bucketName, {
          location: 'us-central1',
          storageClass: 'STANDARD'
        });
        
        // Set bucket lifecycle policy
        const bucket = this.storage.bucket(bucketName);
        await bucket.setMetadata({
          lifecycle: {
            rule: [
              {
                // Delete logs after retention period
                action: { type: 'Delete' },
                condition: { age: auditLogConfig.retention.days }
              }
            ]
          }
        });
        
        logger.info(`Created GCP Storage bucket for audit logs: ${bucketName}`);
      }
    } catch (error) {
      logger.error('Failed to initialize GCP Storage bucket for audit logs', { error });
    }
  }
  
  /**
   * Log an audit event to the database and optionally to GCP Storage
   */
  async log(params: AuditLogParams): Promise<AuditLog> {
    try {
      const {
        eventType,
        actorId,
        actorType,
        resourceType,
        resourceId,
        action,
        status,
        details = {},
        ipAddress,
        userAgent,
        metadata = {},
        severity = AuditSeverity.INFO
      } = params;
      
      // Sanitize sensitive data
      const sanitizedDetails = this.sanitizeData(details);
      
      // Create audit log entry
      const auditLog: AuditLog = {
        id: uuidv4(),
        timestamp: new Date(),
        eventType,
        actorId,
        actorType,
        resourceType,
        resourceId,
        action,
        status,
        details: sanitizedDetails,
        ipAddress,
        userAgent,
        metadata,
        severity
      };
      
      // Save to database
      await this.prisma.auditLog.create({
        data: {
          id: auditLog.id,
          timestamp: auditLog.timestamp,
          action: auditLog.action,
          entityType: auditLog.resourceType || 'unknown',
          entityId: auditLog.resourceId,
          userId: auditLog.actorId,
          ipAddress: auditLog.ipAddress,
          userAgent: auditLog.userAgent,
          metadata: {
            eventType: auditLog.eventType,
            actorType: auditLog.actorType,
            status: auditLog.status,
            severity: auditLog.severity,
            details: auditLog.details,
            ...auditLog.metadata
          }
        }
      });
      
      // Log to standard logger
      this.logToLogger(auditLog);
      
      // Backup to GCP Storage if enabled
      if (auditLogConfig.gcpBackup.enabled && this.storage) {
        await this.backupToGcp(auditLog).catch(err => {
          logger.error('Failed to backup audit log to GCP Storage', { error: err, auditLogId: auditLog.id });
        });
      }
      
      return auditLog;
    } catch (error) {
      // If audit logging fails, log to standard logger but don't throw
      // This prevents audit logging errors from disrupting application flow
      logger.error('Failed to create audit log entry', { 
        error,
        eventType: params.eventType
      });
      
      // Return a minimal audit log with error info
      return {
        id: uuidv4(),
        timestamp: new Date(),
        eventType: params.eventType,
        actorType: params.actorType || ActorType.SYSTEM,
        action: params.action,
        status: AuditStatus.FAILURE,
        details: { error: 'Audit logging failed' },
        metadata: {},
        severity: AuditSeverity.ERROR
      };
    }
  }
  
  /**
   * Sanitize sensitive data before logging
   */
  private sanitizeData(data: Record<string, any>): Record<string, any> {
    if (!data) return {};
    
    const sanitized = { ...data };
    
    // Fields to redact
    const sensitiveFields = [
      'password', 'secret', 'token', 'key', 'privateKey', 
      'private_key', 'seed', 'mnemonic', 'signature',
      'jwt', 'accessToken', 'refreshToken', 'credential',
      'secret', 'apiKey', 'api_key'
    ];
    
    // Recursively sanitize object
    const sanitizeObject = (obj: Record<string, any>): Record<string, any> => {
      const result: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(obj)) {
        // Check if this is a sensitive field
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          result[key] = '[REDACTED]';
        }
        // Handle nested objects
        else if (value && typeof value === 'object' && !Array.isArray(value)) {
          result[key] = sanitizeObject(value);
        }
        // Handle arrays
        else if (Array.isArray(value)) {
          result[key] = value.map(item => 
            typeof item === 'object' && item !== null ? sanitizeObject(item) : item
          );
        }
        // Handle primitives
        else {
          result[key] = value;
        }
      }
      
      return result;
    };
    
    return sanitizeObject(sanitized);
  }
  
  /**
   * Log to standard logger for console/file output
   */
  private logToLogger(auditLog: AuditLog): void {
    const { eventType, action, status, actorType, actorId, resourceType, resourceId, severity } = auditLog;
    
    const logMessage = `Audit: ${eventType} - ${action} ${status}`;
    const logData = {
      audit: true,
      eventType,
      action,
      status,
      actorType,
      actorId,
      resourceType,
      resourceId
    };
    
    switch (severity) {
      case AuditSeverity.CRITICAL:
      case AuditSeverity.ERROR:
        logger.error(logMessage, logData);
        break;
      case AuditSeverity.WARNING:
        logger.warn(logMessage, logData);
        break;
      default:
        logger.info(logMessage, logData);
    }
  }
  
  /**
   * Backup audit log to GCP Storage
   */
  private async backupToGcp(auditLog: AuditLog): Promise<void> {
    if (!this.storage) {
      return;
    }
    
    const bucket = this.storage.bucket(auditLogConfig.gcpBackup.bucketName);
    
    // Create partition by date and event type
    const date = auditLog.timestamp;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    
    // Create filename with timestamp and ID
    const filename = `${year}/${month}/${day}/${hour}/${auditLog.eventType}/${auditLog.id}.json`;
    
    // Upload log to GCP Storage
    const file = bucket.file(filename);
    await file.save(JSON.stringify(auditLog, null, 2), {
      contentType: 'application/json',
      metadata: {
        eventType: auditLog.eventType,
        timestamp: auditLog.timestamp.toISOString(),
        severity: auditLog.severity
      }
    });
  }
  
  /**
   * Query audit logs with filtering
   */
  async query(params: AuditLogQueryParams): Promise<AuditLogQueryResult> {
    const {
      startDate,
      endDate,
      eventTypes,
      actorId,
      actorType,
      resourceType,
      resourceId,
      action,
      status,
      severity,
      limit = 50,
      offset = 0
    } = params;
    
    // Build filter conditions
    const where: any = {};
    
    if (startDate || endDate) {
      where.timestamp = {};
      
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }
    
    if (actorId) {
      where.userId = actorId;
    }
    
    if (resourceType) {
      where.entityType = resourceType;
    }
    
    if (resourceId) {
      where.entityId = resourceId;
    }
    
    // For metadata-based filters (eventTypes, actorType, status, severity)
    // we need to use metadata filtering
    if (eventTypes || actorType || status || severity || action) {
      where.metadata = {};
      
      if (eventTypes && eventTypes.length > 0) {
        where.metadata.eventType = { in: eventTypes };
      }
      
      if (actorType) {
        where.metadata.actorType = actorType;
      }
      
      if (status) {
        where.metadata.status = status;
      }
      
      if (severity) {
        where.metadata.severity = severity;
      }
      
      if (action) {
        where.action = action;
      }
    }
    
    // Query logs with pagination
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: offset,
        take: limit
      }),
      this.prisma.auditLog.count({ where })
    ]);
    
    // Transform database logs to AuditLog interface
    const transformedLogs = logs.map(log => this.transformDbLogToAuditLog(log));
    
    return { 
      logs: transformedLogs, 
      total 
    };
  }
  
  /**
   * Transform database log to AuditLog interface
   */
  private transformDbLogToAuditLog(dbLog: any): AuditLog {
    const metadata = dbLog.metadata || {};
    
    return {
      id: dbLog.id,
      timestamp: dbLog.timestamp,
      eventType: metadata.eventType || 'unknown',
      actorId: dbLog.userId,
      actorType: metadata.actorType || ActorType.ANONYMOUS,
      resourceType: dbLog.entityType,
      resourceId: dbLog.entityId,
      action: dbLog.action as AuditAction,
      status: metadata.status || AuditStatus.SUCCESS,
      details: metadata.details || {},
      ipAddress: dbLog.ipAddress,
      userAgent: dbLog.userAgent,
      metadata: { ...metadata, details: undefined, eventType: undefined, actorType: undefined, status: undefined, severity: undefined },
      severity: metadata.severity || AuditSeverity.INFO
    };
  }
  
  /**
   * Get a single audit log by ID
   */
  async getById(id: string): Promise<AuditLog | null> {
    const log = await this.prisma.auditLog.findUnique({
      where: { id }
    });
    
    if (!log) {
      return null;
    }
    
    return this.transformDbLogToAuditLog(log);
  }
  
  /**
   * Export audit logs to a file
   */
  async exportLogs(params: AuditLogExportParams): Promise<AuditLogExportResult> {
    const { startDate, endDate, eventTypes, actorId, format = 'json' } = params;
    
    // Query logs without pagination limit
    const { logs } = await this.query({
      startDate,
      endDate,
      eventTypes,
      actorId,
      limit: 10000 // Cap export size
    });
    
    // Create unique filename
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const filename = `audit_export_${timestamp}.${format}`;
    
    // Create export file content
    let content: string;
    if (format === 'csv') {
      // Convert to CSV
      const headers = ['id', 'timestamp', 'eventType', 'actorId', 'actorType', 
                       'resourceType', 'resourceId', 'action', 'status', 
                       'ipAddress', 'severity'];
                       
      content = [
        headers.join(','),
        ...logs.map(log => headers.map(header => {
          const value = (log as any)[header];
          if (value === undefined) return '';
          return value instanceof Date ? value.toISOString() : String(value || '');
        }).join(','))
      ].join('\n');
    } else {
      // JSON format
      content = JSON.stringify(logs, null, 2);
    }
    
    // Store export file
    if (this.storage && auditLogConfig.gcpBackup.enabled) {
      // Store in GCP
      const bucket = this.storage.bucket(auditLogConfig.gcpBackup.bucketName);
      const file = bucket.file(`exports/${filename}`);
      await file.save(content, {
        contentType: format === 'csv' ? 'text/csv' : 'application/json'
      });
      
      // Generate signed URL with expiration
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
      });
      
      return { 
        filename, 
        url,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
    } else {
      // For development, create local file
      const exportPath = path.join(process.cwd(), 'audit_exports');
      if (!fs.existsSync(exportPath)) {
        fs.mkdirSync(exportPath, { recursive: true });
      }
      
      const filePath = path.join(exportPath, filename);
      fs.writeFileSync(filePath, content);
      
      return { 
        filename, 
        url: `file://${filePath}` 
      };
    }
  }
}

// Export singleton instance
export const auditLogService = new AuditLogService();

// Export individual methods for easier mocking in tests
export const { log, query, getById, exportLogs } = auditLogService;