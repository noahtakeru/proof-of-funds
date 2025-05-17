/**
 * Security Audit Logger
 * 
 * A centralized system for security event logging with Google Cloud Storage integration.
 * This module provides structured security event logging with automatic sanitization
 * of sensitive data and configurable storage options.
 */

const { Storage } = require('@google-cloud/storage');
const crypto = require('crypto');

/**
 * Secure audit logger for Proof of Funds
 */
class AuditLogger {
  constructor(options = {}) {
    this.options = {
      projectId: process.env.GCP_PROJECT_ID || 'proof-of-funds-455506',
      bucketName: process.env.AUDIT_LOG_BUCKET || `${process.env.GCP_PROJECT_ID || 'proof-of-funds-455506'}-audit-logs`,
      localBackup: process.env.NODE_ENV !== 'production',
      ...options
    };
    
    // Initialize GCP client if in production
    if (process.env.NODE_ENV === 'production') {
      this.initializeStorage().catch(err => {
        console.error('Failed to initialize audit storage:', err);
      });
    }
  }
  
  /**
   * Initialize GCP Storage client
   */
  async initializeStorage() {
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
                // Delete logs after 1 year
                action: { type: 'Delete' },
                condition: { age: 365 }
              }
            ]
          }
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize audit storage:', error);
      return false;
    }
  }
  
  /**
   * Log a security event
   * @param {string} eventType - Type of event
   * @param {Object} eventData - Event data
   * @param {Object} context - Event context
   * @returns {Promise<boolean>} - Success indicator
   */
  async log(eventType, eventData = {}, context = {}) {
    try {
      // Create log entry
      const timestamp = new Date().toISOString();
      const requestId = crypto.randomBytes(16).toString('hex');
      
      const logEntry = {
        timestamp,
        requestId,
        eventType,
        environment: process.env.NODE_ENV || 'development',
        context: {
          ip: context.ip || 'unknown',
          userAgent: context.userAgent || 'unknown',
          userId: context.userId || 'anonymous',
          path: context.path || 'unknown',
          method: context.method || 'unknown',
          ...context
        },
        data: this.sanitizeData(eventData)
      };
      
      // Local logging for development or backup
      if (this.options.localBackup || process.env.NODE_ENV !== 'production') {
        console.log(`[AUDIT] ${eventType}:`, JSON.stringify(logEntry));
      }
      
      // In production, log to GCP Storage
      if (process.env.NODE_ENV === 'production' && this.storage) {
        try {
          const bucket = this.storage.bucket(this.options.bucketName);
          
          // Create log filename with timestamp and UUID
          const date = new Date();
          const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
          const timeStr = date.toISOString().split('T')[1].replace(/:/g, '-').split('.')[0]; // HH-MM-SS
          
          const filename = `${dateStr}/${eventType}/${timeStr}_${requestId}.json`;
          
          // Write log to GCP Storage
          const file = bucket.file(filename);
          await file.save(JSON.stringify(logEntry, null, 2), {
            contentType: 'application/json',
            metadata: {
              eventType,
              timestamp
            }
          });
        } catch (error) {
          console.error('Failed to write audit log to GCP:', error);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Audit logging error:', error);
      return false;
    }
  }
  
  /**
   * Sanitize sensitive data for logging
   * @param {Object} data - Data to sanitize
   * @returns {Object} - Sanitized data
   */
  sanitizeData(data) {
    if (!data) return {};
    
    // Create a copy of the data
    const sanitized = { ...data };
    
    // List of sensitive fields to redact
    const sensitiveFields = [
      'password', 'secret', 'token', 'key', 'privateKey', 
      'private_key', 'seed', 'mnemonic', 'signature',
      'jwt', 'accessToken', 'refreshToken'
    ];
    
    // Sanitize top-level fields
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  /**
   * Get context data from an Express request
   * @param {Object} req - Express request
   * @returns {Object} - Context data
   */
  getContextFromRequest(req) {
    return {
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      userId: req.user?.walletAddress || req.user?.id || 'anonymous',
      path: req.url,
      method: req.method
    };
  }
}

// Create singleton instance
const auditLogger = new AuditLogger();

module.exports = auditLogger;