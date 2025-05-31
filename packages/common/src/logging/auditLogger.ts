/**
 * Security Audit Logger
 * 
 * A centralized system for security event logging with Google Cloud Storage integration.
 * This module provides structured security event logging with automatic sanitization
 * of sensitive data and configurable storage options.
 * 
 * Features:
 * - Structured logging with TypeScript interfaces
 * - Automatic redaction of sensitive data
 * - Encrypted storage options
 * - Configurable retention policies
 * - Environment-specific behavior
 * - Request context capture utilities
 */

import { Storage, Bucket, File } from '@google-cloud/storage';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Log event severity levels
 */
export enum LogSeverity {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  NOTICE = 'NOTICE',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
  ALERT = 'ALERT',
  EMERGENCY = 'EMERGENCY'
}

/**
 * Log event category types
 */
export enum LogCategory {
  AUTH = 'auth',
  ACCESS = 'access',
  DATA = 'data',
  ADMIN = 'admin',
  ZK_PROOF = 'zk_proof',
  SYSTEM = 'system',
  SECURITY = 'security'
}

/**
 * Request context interface
 */
export interface RequestContext {
  ip: string;
  userAgent?: string;
  userId?: string;
  walletAddress?: string;
  path?: string;
  method?: string;
  referrer?: string;
  sessionId?: string;
  requestId?: string;
  [key: string]: any;
}

/**
 * Log entry interface
 */
export interface LogEntry {
  timestamp: string;
  requestId: string;
  eventType: string;
  environment: string;
  severity: LogSeverity;
  category: LogCategory;
  context: RequestContext;
  data: any;
  encrypted?: boolean;
}

/**
 * Audit logger options interface
 */
export interface AuditLoggerOptions {
  projectId?: string;
  bucketName?: string;
  localBackupPath?: string;
  localBackup?: boolean;
  encryptionEnabled?: boolean;
  encryptionKey?: string;
  retentionDays?: number;
  logRotationPeriod?: 'daily' | 'hourly' | 'monthly';
  compressLogs?: boolean;
}

/**
 * Secure audit logger for Proof of Funds
 */
export class AuditLogger {
  private options: AuditLoggerOptions;
  private storage: Storage | null = null;
  private bucket: Bucket | null = null;
  private encryptionKey: Buffer | null = null;
  private initialized: boolean = false;
  private initPromise: Promise<boolean> | null = null;
  private localLogQueue: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  
  constructor(options: AuditLoggerOptions = {}) {
    this.options = {
      projectId: process.env.GCP_PROJECT_ID || 'proof-of-funds-455506',
      bucketName: process.env.AUDIT_LOG_BUCKET || `${process.env.GCP_PROJECT_ID || 'proof-of-funds-455506'}-audit-logs`,
      localBackupPath: path.join(os.tmpdir(), 'proof-of-funds-audit-logs'),
      localBackup: process.env.NODE_ENV !== 'production',
      encryptionEnabled: process.env.ENCRYPT_AUDIT_LOGS === 'true' || process.env.NODE_ENV === 'production',
      retentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '365', 10),
      logRotationPeriod: (process.env.AUDIT_LOG_ROTATION || 'daily') as 'daily' | 'hourly' | 'monthly',
      compressLogs: process.env.COMPRESS_AUDIT_LOGS === 'true',
      ...options
    };
    
    // Generate or load encryption key
    if (this.options.encryptionEnabled) {
      if (this.options.encryptionKey) {
        // Use provided key
        this.encryptionKey = Buffer.from(this.options.encryptionKey, 'hex');
      } else if (process.env.AUDIT_LOG_ENCRYPTION_KEY) {
        // Use environment variable key
        this.encryptionKey = Buffer.from(process.env.AUDIT_LOG_ENCRYPTION_KEY, 'hex');
      } else {
        // Generate key from project ID (for development only)
        const hash = createHash('sha256');
        hash.update(this.options.projectId || 'proof-of-funds');
        this.encryptionKey = hash.digest();
      }
    }
    
    // Ensure local backup directory exists
    if (this.options.localBackup && this.options.localBackupPath) {
      try {
        if (!fs.existsSync(this.options.localBackupPath)) {
          fs.mkdirSync(this.options.localBackupPath, { recursive: true });
        }
      } catch (error) {
        console.error('Failed to create local backup directory:', error);
      }
    }
    
    // Initialize GCP client if in production
    if (process.env.NODE_ENV === 'production') {
      this.initPromise = this.initializeStorage();
    } else {
      this.initPromise = Promise.resolve(false);
    }
    
    // Setup periodic log flushing for local backup
    if (this.options.localBackup) {
      this.flushInterval = setInterval(() => this.flushLocalLogs(), 5000);
    }
  }
  
  /**
   * Initialize GCP Storage client
   */
  async initializeStorage(): Promise<boolean> {
    if (this.initialized) return true;
    
    try {
      this.storage = new Storage({
        projectId: this.options.projectId
      });
      
      // Check if bucket exists
      const [buckets] = await this.storage.getBuckets();
      const bucketExists = buckets.some(b => b.name === this.options.bucketName);
      
      if (!bucketExists) {
        // Create bucket if it doesn't exist
        await this.storage.createBucket(this.options.bucketName, {
          location: 'us-central1',
          storageClass: 'STANDARD'
        });
        
        // Set bucket lifecycle policy
        const bucket = this.storage.bucket(this.options.bucketName);
        await bucket.setMetadata({
          lifecycle: {
            rule: [
              {
                // Delete logs after specified retention period
                action: { type: 'Delete' },
                condition: { age: this.options.retentionDays }
              }
            ]
          }
        });
        
        this.bucket = bucket;
      } else {
        this.bucket = this.storage.bucket(this.options.bucketName);
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize audit storage:', error);
      return false;
    }
  }
  
  /**
   * Encrypt sensitive data
   */
  private encryptData(data: any): { encryptedData: string, iv: string } {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }
    
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    const jsonData = JSON.stringify(data);
    
    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encryptedData: encrypted,
      iv: iv.toString('hex')
    };
  }
  
  /**
   * Decrypt data
   */
  decryptData(encryptedData: string, iv: string): any {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }
    
    const decipher = createDecipheriv(
      'aes-256-cbc', 
      this.encryptionKey, 
      Buffer.from(iv, 'hex')
    );
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }
  
  /**
   * Sanitize sensitive data for logging
   * Recursively sanitizes nested objects and arrays
   */
  sanitizeData(data: any): any {
    if (!data) return {};
    
    // List of sensitive fields to redact
    const sensitiveFields = [
      'password', 'secret', 'token', 'key', 'privateKey', 
      'private_key', 'seed', 'mnemonic', 'signature',
      'jwt', 'accessToken', 'refreshToken', 'auth', 
      'authorization', 'credential', 'apiKey', 'api_key',
      'credit_card', 'creditCard', 'ssn', 'social',
      'passport', 'license', 'address', 'phone'
    ];
    
    // Function to deeply sanitize objects and arrays
    const sanitizeDeep = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      
      // Handle different data types
      if (typeof obj !== 'object') return obj;
      
      // Handle arrays
      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeDeep(item));
      }
      
      // Handle plain objects
      const sanitized = { ...obj };
      
      for (const [key, value] of Object.entries(sanitized)) {
        // Check if this is a sensitive field
        const isSensitive = sensitiveFields.some(field => 
          key.toLowerCase().includes(field.toLowerCase())
        );
        
        if (isSensitive && value) {
          // Redact sensitive values
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          // Recursively sanitize nested objects
          sanitized[key] = sanitizeDeep(value);
        }
      }
      
      return sanitized;
    };
    
    return sanitizeDeep(data);
  }
  
  /**
   * Create a log filename based on the current rotation policy
   */
  private getLogFilename(eventType: string, requestId: string): string {
    const date = new Date();
    let dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = date.toISOString().split('T')[1].replace(/:/g, '-').split('.')[0]; // HH-MM-SS
    
    // Parse event type for better categorization
    const [category, ...eventParts] = eventType.split('.');
    
    switch (this.options.logRotationPeriod) {
      case 'hourly':
        // Add hour to the path
        const hour = date.getUTCHours().toString().padStart(2, '0');
        return `${dateStr}/${hour}/${category}/${eventType}/${timeStr}_${requestId}.json`;
      
      case 'monthly':
        // Use year and month only
        dateStr = dateStr.substring(0, 7); // YYYY-MM
        return `${dateStr}/${category}/${eventType}/${date.getUTCDate()}_${timeStr}_${requestId}.json`;
      
      case 'daily':
      default:
        // Default daily rotation
        return `${dateStr}/${category}/${eventType}/${timeStr}_${requestId}.json`;
    }
  }
  
  /**
   * Save log to local backup
   */
  private async saveToLocalBackup(logEntry: LogEntry, filename: string): Promise<boolean> {
    if (!this.options.localBackupPath) return false;
    
    try {
      // Ensure directory structure exists
      const filePath = path.join(this.options.localBackupPath, filename);
      const dirPath = path.dirname(filePath);
      
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // Write log to file
      fs.writeFileSync(
        filePath, 
        JSON.stringify(logEntry, null, 2), 
        { encoding: 'utf8' }
      );
      
      return true;
    } catch (error) {
      console.error('Failed to write local audit log backup:', error);
      // Queue for later retry
      this.localLogQueue.push(logEntry);
      return false;
    }
  }
  
  /**
   * Flush queued logs to local backup
   */
  private async flushLocalLogs(): Promise<void> {
    if (this.localLogQueue.length === 0) return;
    
    const logsToProcess = [...this.localLogQueue];
    this.localLogQueue = [];
    
    for (const logEntry of logsToProcess) {
      try {
        const filename = this.getLogFilename(
          logEntry.eventType, 
          logEntry.requestId
        );
        
        await this.saveToLocalBackup(logEntry, filename);
      } catch (error) {
        console.error('Failed to flush log entry:', error);
        // Put back in queue for next attempt
        this.localLogQueue.push(logEntry);
      }
    }
  }
  
  /**
   * Log a security event
   */
  async log(
    eventType: string,
    eventData: any = {},
    context: Partial<RequestContext> = {},
    severity: LogSeverity = LogSeverity.INFO
  ): Promise<boolean> {
    try {
      // Wait for storage initialization if needed
      if (this.initPromise && !this.initialized) {
        await this.initPromise;
      }
      
      // Create log entry
      const timestamp = new Date().toISOString();
      const requestId = context.requestId || randomBytes(16).toString('hex');
      
      // Determine category from event type
      const category = eventType.split('.')[0] as keyof typeof LogCategory;
      const logCategory = Object.values(LogCategory).includes(category as LogCategory)
        ? category as LogCategory
        : LogCategory.SYSTEM;
      
      // Create base log entry
      const logEntry: LogEntry = {
        timestamp,
        requestId,
        eventType,
        environment: process.env.NODE_ENV || 'development',
        severity,
        category: logCategory,
        context: {
          ip: context.ip || 'unknown',
          userAgent: context.userAgent || 'unknown',
          userId: context.userId || 'anonymous',
          walletAddress: context.walletAddress,
          path: context.path || 'unknown',
          method: context.method || 'unknown',
          ...context
        },
        data: this.sanitizeData(eventData),
        encrypted: false
      };
      
      // Local logging for development or backup
      if (this.options.localBackup) {
        const filename = this.getLogFilename(eventType, requestId);
        await this.saveToLocalBackup(logEntry, filename);
        
        // Also log to console in development
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[AUDIT] ${severity}:${eventType}:`, JSON.stringify(logEntry, null, 2));
        }
      }
      
      // In production, log to GCP Storage
      if (process.env.NODE_ENV === 'production' && this.storage && this.bucket) {
        try {
          const filename = this.getLogFilename(eventType, requestId);
          
          // Encrypt sensitive data if enabled
          let fileContent: string;
          let metadata: Record<string, string> = {
            eventType,
            timestamp,
            severity,
            category: logCategory
          };
          
          if (this.options.encryptionEnabled && this.encryptionKey) {
            // Only encrypt the data portion
            const { encryptedData, iv } = this.encryptData(logEntry.data);
            
            const encryptedLogEntry = {
              ...logEntry,
              data: encryptedData,
              iv,
              encrypted: true
            };
            
            fileContent = JSON.stringify(encryptedLogEntry, null, 2);
            metadata.encrypted = 'true';
            metadata.iv = iv;
          } else {
            fileContent = JSON.stringify(logEntry, null, 2);
          }
          
          // Write log to GCP Storage
          const file = this.bucket.file(filename);
          await file.save(fileContent, {
            contentType: 'application/json',
            metadata: {
              metadata
            }
          });
        } catch (error) {
          console.error('Failed to write audit log to GCP:', error);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Audit logging error:', error);
      return false;
    }
  }
  
  /**
   * Log a debug event
   */
  async debug(eventType: string, eventData: any = {}, context: Partial<RequestContext> = {}): Promise<boolean> {
    return this.log(eventType, eventData, context, LogSeverity.DEBUG);
  }
  
  /**
   * Log an info event
   */
  async info(eventType: string, eventData: any = {}, context: Partial<RequestContext> = {}): Promise<boolean> {
    return this.log(eventType, eventData, context, LogSeverity.INFO);
  }
  
  /**
   * Log a warning event
   */
  async warning(eventType: string, eventData: any = {}, context: Partial<RequestContext> = {}): Promise<boolean> {
    return this.log(eventType, eventData, context, LogSeverity.WARNING);
  }
  
  /**
   * Log an error event
   */
  async error(eventType: string, eventData: any = {}, context: Partial<RequestContext> = {}): Promise<boolean> {
    return this.log(eventType, eventData, context, LogSeverity.ERROR);
  }
  
  /**
   * Log a critical event
   */
  async critical(eventType: string, eventData: any = {}, context: Partial<RequestContext> = {}): Promise<boolean> {
    return this.log(eventType, eventData, context, LogSeverity.CRITICAL);
  }
  
  /**
   * Get context data from an Express request
   */
  getContextFromRequest(req: any): RequestContext {
    return {
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'],
      userId: req.user?.id || 'anonymous',
      walletAddress: req.user?.walletAddress,
      path: req.url || req.path,
      method: req.method,
      referrer: req.headers['referer'] || req.headers['referrer'],
      sessionId: req.session?.id,
      requestId: req.id || req.headers['x-request-id']
    };
  }
  
  /**
   * Search audit logs in GCP Storage
   */
  async searchLogs(
    options: {
      startDate?: Date,
      endDate?: Date,
      eventType?: string,
      category?: LogCategory,
      userId?: string,
      walletAddress?: string,
      severity?: LogSeverity,
      limit?: number
    }
  ): Promise<LogEntry[]> {
    if (!this.storage || !this.bucket) {
      throw new Error('Storage not initialized');
    }
    
    try {
      const startDate = options.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to last 24 hours
      const endDate = options.endDate || new Date();
      
      // Format dates for prefix search
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      // Build prefix path
      let prefix = '';
      
      if (startDateStr === endDateStr) {
        // Search in single day
        prefix = `${startDateStr}/`;
        
        // Add category if specified
        if (options.category) {
          prefix += `${options.category}/`;
          
          // Add event type if specified
          if (options.eventType) {
            prefix += `${options.eventType}/`;
          }
        }
      } else {
        // For date ranges, we'll filter after listing
        prefix = '';
      }
      
      // List files in bucket with prefix
      const [files] = await this.bucket.getFiles({ prefix });
      
      // Filter and process files
      const results: LogEntry[] = [];
      const limit = options.limit || 100;
      
      for (const file of files) {
        // Skip if we've reached the limit
        if (results.length >= limit) break;
        
        // Check if file matches date range for multi-day searches
        if (startDateStr !== endDateStr) {
          const filePath = file.name;
          const fileDate = filePath.split('/')[0];
          
          if (fileDate < startDateStr || fileDate > endDateStr) {
            continue;
          }
          
          // Check category filter
          if (options.category && !filePath.includes(`/${options.category}/`)) {
            continue;
          }
          
          // Check event type filter
          if (options.eventType && !filePath.includes(`/${options.eventType}/`)) {
            continue;
          }
        }
        
        // Download and parse file
        const [content] = await file.download();
        const logEntry: LogEntry = JSON.parse(content.toString('utf8'));
        
        // Apply additional filters
        if (
          (options.userId && logEntry.context.userId !== options.userId) ||
          (options.walletAddress && logEntry.context.walletAddress !== options.walletAddress) ||
          (options.severity && logEntry.severity !== options.severity)
        ) {
          continue;
        }
        
        // Decrypt data if encrypted
        if (logEntry.encrypted && this.encryptionKey) {
          try {
            const decryptedData = this.decryptData(
              logEntry.data as unknown as string,
              (logEntry as any).iv
            );
            logEntry.data = decryptedData;
            logEntry.encrypted = false;
            delete (logEntry as any).iv;
          } catch (error) {
            console.error('Failed to decrypt log data:', error);
            // Keep encrypted data as-is
          }
        }
        
        results.push(logEntry);
      }
      
      // Sort by timestamp (newest first)
      results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      return results.slice(0, limit);
    } catch (error) {
      console.error('Failed to search audit logs:', error);
      return [];
    }
  }
  
  /**
   * Clean up resources on application shutdown
   */
  async shutdown(): Promise<void> {
    // Flush any pending logs
    if (this.localLogQueue.length > 0) {
      await this.flushLocalLogs();
    }
    
    // Clear flush interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}

// Create singleton instance
const auditLogger = new AuditLogger();

export default auditLogger;