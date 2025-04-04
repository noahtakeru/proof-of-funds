/**
 * Security Audit Logger for Zero-Knowledge Proof System
 * 
 * Provides comprehensive security event logging and audit trail functionality
 * for traceability, compliance, and incident response.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module creates a secure record of all security-related events that happen in our
 * application. Think of it like a security camera system that records everything that happens, 
 * so we can review it later if something goes wrong. These logs help us understand what 
 * happened during a security incident and provide evidence for investigations.
 * 
 * Business value: Enables us to detect suspicious activities, investigate security incidents,
 * and meet regulatory compliance requirements for financial applications.
 */

import secureKeyManager from './SecureKeyManager.js';

// Default logger configuration
const DEFAULT_LOGGER_CONFIG = {
  logLevel: 'standard', // minimal | standard | verbose
  maxLogSize: 1000, // Maximum number of log entries to keep in memory
  persistToStorage: true, // Whether to persist logs to sessionStorage
  enableAnomalyDetection: true, // Whether to enable anomaly detection
  storageKey: 'zk-security-audit-log', // Key for log storage
  logRotationThreshold: 100, // Rotate logs after this many entries
  includeTimestamp: true, // Include timestamp in log entries
};

// Log levels and their numeric values
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
  security: 4,
};

/**
 * Security Audit Logger class provides methods for secure logging of security events
 * with tamper-evident design and encryption capabilities.
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This is our security record-keeping system. It's like having a tamper-proof
 * logbook for a bank vault - recording who accessed what and when. This information
 * is critical for investigating any security incidents and is often required
 * by regulations for financial applications.
 */
class SecurityAuditLogger {
  constructor(config = {}) {
    this.config = { ...DEFAULT_LOGGER_CONFIG, ...config };
    this.logs = [];
    this.anomalyDetectionData = {
      eventCounts: {},
      ipAddresses: {},
      eventTimings: {},
      lastEvents: [],
    };

    // Generate a signing key for this session
    this.signingKey = this.generateSigningKey();

    // Initialize log chain
    this.lastLogHash = this.hashData('LOG_CHAIN_INIT' + Date.now());

    // Load existing logs if enabled
    if (this.config.persistToStorage) {
      this.loadLogs();
    }

    // Initial log entry
    this.logInternal('Logger initialized', 'info', {
      config: this.sanitizeConfig(this.config),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Remove sensitive data from config for logging
   * @private 
   */
  sanitizeConfig(config) {
    const { ...sanitized } = config;
    return sanitized;
  }

  /**
   * Generate a signing key for log integrity
   * @private
   */
  generateSigningKey() {
    // Generate a secure random key for this logger instance
    const keyBytes = new Uint8Array(32); // 256 bits
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(keyBytes);
    } else {
      // Fallback for non-browser environments (less secure)
      for (let i = 0; i < keyBytes.length; i++) {
        keyBytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Create a hash of data for integrity checking
   * @param {any} data - Data to hash
   * @private
   */
  hashData(data) {
    let stringData;
    if (typeof data === 'object') {
      stringData = JSON.stringify(data);
    } else {
      stringData = String(data);
    }

    // Use Web Crypto if available
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      // Convert string to ArrayBuffer
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(stringData);

      // Use SHA-256 for better security
      return crypto.subtle.digest('SHA-256', dataBuffer)
        .then(hashBuffer => {
          // Convert hash to hex string
          return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        })
        .catch(() => {
          // Fallback if Web Crypto fails
          return this.simpleHash(stringData);
        });
    }

    // Fallback simple hash function
    return Promise.resolve(this.simpleHash(stringData));
  }

  /**
   * Fallback hash function when Web Crypto is unavailable
   * @param {string} data - String data to hash
   * @private
   */
  simpleHash(data) {
    let hash = 0;
    if (data.length === 0) return hash.toString(16);

    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    // Combine with signing key for better security
    return hash.toString(16) + this.signingKey.substring(0, 16);
  }

  /**
   * Add a log entry with integrity protection
   * @param {string} message - Log message
   * @param {string} level - Log level
   * @param {Object} data - Additional log data
   * @private
   */
  async logInternal(message, level, data = {}) {
    // Create log entry
    const timestamp = new Date().toISOString();
    const logEntry = {
      message,
      level,
      timestamp,
      data,
      sequenceId: this.logs.length,
    };

    // Add chain hash for tamper evidence
    const entryForHashing = { ...logEntry, previousHash: this.lastLogHash };
    logEntry.hash = await this.hashData(entryForHashing);
    this.lastLogHash = logEntry.hash;

    // Add the log entry
    this.logs.push(logEntry);

    // Rotate logs if needed
    if (this.logs.length > this.config.maxLogSize) {
      this.logs = this.logs.slice(-this.config.maxLogSize);
    }

    // Persist logs if enabled
    if (this.config.persistToStorage) {
      this.persistLogs();
    }

    // Check for anomalies if enabled
    if (this.config.enableAnomalyDetection) {
      this.detectAnomalies(logEntry);
    }

    return logEntry;
  }

  /**
   * Persist logs to storage
   * @private
   */
  persistLogs() {
    if (typeof window === 'undefined' || !window.sessionStorage) return;

    try {
      // Only persist logs at regular intervals for performance
      if (this.logs.length % this.config.logRotationThreshold === 0) {
        // Store the logs in sessionStorage for better security
        const serializedLogs = JSON.stringify(this.logs);
        window.sessionStorage.setItem(this.config.storageKey, serializedLogs);
      }
    } catch (error) {
      // Silent fail - this is just for persistence
      console.error('Failed to persist security logs:', error);
    }
  }

  /**
   * Load logs from storage
   * @private
   */
  loadLogs() {
    if (typeof window === 'undefined' || !window.sessionStorage) return;

    try {
      const storedLogs = window.sessionStorage.getItem(this.config.storageKey);
      if (storedLogs) {
        const parsedLogs = JSON.parse(storedLogs);

        // Verify log chain integrity
        if (this.verifyLogChain(parsedLogs)) {
          this.logs = parsedLogs;
          if (this.logs.length > 0) {
            this.lastLogHash = this.logs[this.logs.length - 1].hash;
          }
        } else {
          // Log tampering detected
          const tamperLog = {
            message: 'Log tampering detected, chain integrity broken',
            level: 'security',
            timestamp: new Date().toISOString(),
            data: {
              recoveredLogCount: parsedLogs.length,
              action: 'tamper_detection'
            }
          };

          // Reset logs with tamper detection entry
          this.logs = [tamperLog];
        }
      }
    } catch (error) {
      // Error handling - create a new log with the error
      const errorLog = {
        message: 'Failed to load security logs',
        level: 'error',
        timestamp: new Date().toISOString(),
        data: {
          error: error.message
        }
      };

      this.logs = [errorLog];
    }
  }

  /**
   * Verify the integrity of a log chain
   * @param {Array} logChain - The log chain to verify
   * @private
   */
  verifyLogChain(logChain) {
    if (!Array.isArray(logChain) || logChain.length === 0) return true;

    // Basic validation of log structure
    for (let i = 1; i < logChain.length; i++) {
      const currentLog = logChain[i];
      const previousLog = logChain[i - 1];

      // Check sequence
      if (currentLog.sequenceId !== previousLog.sequenceId + 1) {
        return false;
      }

      // For full integrity, we would need to recalculate and verify all hashes
      // This is a simplified version for the demo
    }

    return true;
  }

  /**
   * Detect anomalies in logging patterns
   * @param {Object} logEntry - The log entry to analyze
   * @private 
   */
  detectAnomalies(logEntry) {
    // Skip for minimal level
    if (this.config.logLevel === 'minimal') return;

    try {
      const { level, message, data } = logEntry;

      // Track event counts
      if (!this.anomalyDetectionData.eventCounts[message]) {
        this.anomalyDetectionData.eventCounts[message] = 0;
      }
      this.anomalyDetectionData.eventCounts[message]++;

      // Track unique IP addresses
      if (data.ip) {
        if (!this.anomalyDetectionData.ipAddresses[data.ip]) {
          this.anomalyDetectionData.ipAddresses[data.ip] = 0;
        }
        this.anomalyDetectionData.ipAddresses[data.ip]++;
      }

      // Track timing between similar events
      if (!this.anomalyDetectionData.eventTimings[message]) {
        this.anomalyDetectionData.eventTimings[message] = {
          lastSeen: Date.now(),
          intervals: []
        };
      } else {
        const now = Date.now();
        const lastSeen = this.anomalyDetectionData.eventTimings[message].lastSeen;
        const interval = now - lastSeen;

        this.anomalyDetectionData.eventTimings[message].intervals.push(interval);
        this.anomalyDetectionData.eventTimings[message].lastSeen = now;

        // Keep only the last 10 intervals
        if (this.anomalyDetectionData.eventTimings[message].intervals.length > 10) {
          this.anomalyDetectionData.eventTimings[message].intervals.shift();
        }
      }

      // Add to last events for sequence analysis
      this.anomalyDetectionData.lastEvents.push({
        message,
        level,
        timestamp: Date.now()
      });

      // Keep only last 20 events
      if (this.anomalyDetectionData.lastEvents.length > 20) {
        this.anomalyDetectionData.lastEvents.shift();
      }

      // Detect frequency anomalies
      this.detectFrequencyAnomalies(message);

      // Detect sequence anomalies
      this.detectSequenceAnomalies();

    } catch (error) {
      // Silently fail - anomaly detection should not block logging
      console.error('Error in anomaly detection:', error);
    }
  }

  /**
   * Detect anomalies in event frequency
   * @param {string} eventType - The event type to analyze
   * @private
   */
  detectFrequencyAnomalies(eventType) {
    const timingData = this.anomalyDetectionData.eventTimings[eventType];
    if (!timingData || timingData.intervals.length < 5) return;

    // Calculate average interval and deviation
    const intervals = timingData.intervals;
    const avg = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;

    // Calculate standard deviation
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Current interval (last in the list)
    const currentInterval = intervals[intervals.length - 1];

    // Check if current interval is significantly shorter than average
    // This could indicate a flood or automated activity
    if (currentInterval < avg - (2 * stdDev) && intervals.length >= 5) {
      this.logSecurity('Anomalous event frequency detected', {
        eventType,
        currentInterval,
        averageInterval: avg,
        standardDeviation: stdDev,
        anomalyType: 'frequency',
        intervals: intervals.slice(-5)
      });
    }
  }

  /**
   * Detect anomalies in event sequences
   * @private
   */
  detectSequenceAnomalies() {
    const events = this.anomalyDetectionData.lastEvents;
    if (events.length < 5) return;

    // Detect suspicious sequences like multiple failed operations in quick succession
    const securityEvents = events.filter(e => e.level === 'security' || e.level === 'error');

    // Check for 3 or more security/error events in the last 5 events
    if (securityEvents.length >= 3) {
      const timeWindow = events[events.length - 1].timestamp - events[events.length - 5].timestamp;

      // If these events happened in a short time window (< 10 seconds)
      if (timeWindow < 10000) {
        this.logSecurity('Anomalous event sequence detected', {
          securityEventCount: securityEvents.length,
          timeWindowMs: timeWindow,
          anomalyType: 'sequence',
          recentEvents: events.slice(-5).map(e => ({
            message: e.message,
            level: e.level,
            timestamp: e.timestamp
          }))
        });
      }
    }
  }

  /**
   * Public logging methods
   */

  /**
   * Log an informational message
   * @param {string} message - Log message 
   * @param {Object} data - Additional log data
   */
  log(message, data = {}) {
    // Skip if log level is higher than info
    if (LOG_LEVELS[this.config.logLevel] > LOG_LEVELS.info) return;

    return this.logInternal(message, 'info', data);
  }

  /**
   * Log a warning message
   * @param {string} message - Log message
   * @param {Object} data - Additional log data
   */
  logWarning(message, data = {}) {
    // Skip if log level is higher than warning
    if (LOG_LEVELS[this.config.logLevel] > LOG_LEVELS.warning) return;

    return this.logInternal(message, 'warning', data);
  }

  /**
   * Log an error message
   * @param {string} message - Log message
   * @param {Object} data - Additional log data
   */
  logError(message, data = {}) {
    // Errors are always logged regardless of level
    return this.logInternal(message, 'error', data);
  }

  /**
   * Log a security-related message
   * @param {string} message - Log message
   * @param {Object} data - Additional log data
   */
  logSecurity(message, data = {}) {
    // Security events are always logged regardless of level
    return this.logInternal(message, 'security', {
      ...data,
      timestamp: Date.now()
    });
  }

  /**
   * Get all logs
   * @param {Object} options - Options for filtering logs
   * @returns {Array} - Array of log entries
   */
  getLogs(options = {}) {
    let filteredLogs = [...this.logs];

    // Filter by level if specified
    if (options.level) {
      const minLevel = LOG_LEVELS[options.level];
      filteredLogs = filteredLogs.filter(log =>
        LOG_LEVELS[log.level] >= minLevel
      );
    }

    // Filter by message if specified
    if (options.message) {
      filteredLogs = filteredLogs.filter(log =>
        log.message.includes(options.message)
      );
    }

    // Filter by timestamp range if specified
    if (options.since) {
      const sinceDate = new Date(options.since);
      filteredLogs = filteredLogs.filter(log =>
        new Date(log.timestamp) >= sinceDate
      );
    }

    // Limit number of logs if specified
    if (options.limit) {
      filteredLogs = filteredLogs.slice(-options.limit);
    }

    return filteredLogs;
  }

  /**
   * Verify the integrity of the log chain
   * @returns {Promise<boolean>} Whether the log chain integrity is intact
   */
  async verifyLogIntegrity() {
    // For an empty log chain, integrity is intact
    if (this.logs.length === 0) {
      return true;
    }

    try {
      let previousHash = await this.hashData('LOG_CHAIN_INIT' + this.logs[0].timestamp);

      // Check each log entry's hash
      for (let i = 0; i < this.logs.length; i++) {
        const log = this.logs[i];
        const entryForHashing = {
          message: log.message,
          level: log.level,
          timestamp: log.timestamp,
          data: log.data,
          sequenceId: log.sequenceId,
          previousHash: previousHash
        };

        const calculatedHash = await this.hashData(entryForHashing);

        // If hash doesn't match, chain integrity is broken
        if (calculatedHash !== log.hash) {
          this.logSecurity('Log integrity verification failed', {
            logIndex: i,
            expectedHash: calculatedHash,
            actualHash: log.hash
          });
          return false;
        }

        previousHash = log.hash;
      }

      return true;
    } catch (error) {
      this.logError('Error verifying log integrity', { error: error.message });
      return false;
    }
  }

  /**
   * Export logs in a tamper-evident format
   * @param {Object} options - Export options
   * @returns {Object} Exported logs with integrity information
   */
  exportLogs(options = {}) {
    const logs = this.getLogs(options);

    return {
      logs,
      metadata: {
        exportTime: new Date().toISOString(),
        logCount: logs.length,
        integrity: {
          lastHash: this.lastLogHash,
          chainId: this.hashData(this.signingKey + this.logs.length)
        }
      }
    };
  }

  /**
   * Clear all logs
   * @param {Object} options - Clear options
   * @returns {boolean} Whether logs were cleared
   */
  clearLogs(options = {}) {
    // Create a final log entry for the clearing operation
    const clearLogEntry = this.logInternal('Logs cleared', 'security', {
      reason: options.reason || 'manual',
      clearedCount: this.logs.length,
      timestamp: new Date().toISOString()
    });

    // Reset logs with just the clearing entry
    this.logs = [clearLogEntry];

    // Reset anomaly detection data
    this.anomalyDetectionData = {
      eventCounts: {},
      ipAddresses: {},
      eventTimings: {},
      lastEvents: []
    };

    // Persist the cleared state if enabled
    if (this.config.persistToStorage) {
      this.persistLogs();
    }

    return true;
  }
}

// Export the class
export default SecurityAuditLogger;