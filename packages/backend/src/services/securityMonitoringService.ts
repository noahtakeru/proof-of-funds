/**
 * Security Monitoring Service
 *
 * Central service for monitoring security events across the application.
 * Provides aggregation, analysis, and dashboard data for security events.
 * 
 * This is a core component of the Phase 2.2 Security Monitoring & Rate Limiting implementation.
 */

import { PrismaClient } from '@prisma/client';
import ipReputationTracker, { IPReputationData, ReputationEvent } from '@proof-of-funds/common/security/ipReputationTracker';
import logger from '../utils/logger';

// Initialize Prisma client
const prisma = new PrismaClient();

// Aggregate security metrics
interface SecurityMetrics {
  // Auth-related metrics
  authFailures: number;
  authSuccesses: number;
  
  // Rate limiting metrics
  rateLimitExceeded: number;
  
  // IP reputation metrics
  blockedIPs: number;
  suspiciousIPs: number;
  
  // Request metrics
  totalRequests: number;
  blockedRequests: number;
  
  // Attack pattern metrics
  suspiciousPatterns: number;
  
  // Time-based metrics
  interval: 'hour' | 'day' | 'week' | 'month';
  from: Date;
  to: Date;
}

// Event for alert system
export interface SecurityAlert {
  id: string;
  timestamp: Date;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  message: string;
  details: Record<string, any>;
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
}

// Alert types for security monitoring
export enum AlertType {
  MULTIPLE_AUTH_FAILURES = 'multiple_auth_failures',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_IP_ACTIVITY = 'suspicious_ip_activity',
  GEO_LOCATION_CHANGE = 'geo_location_change',
  UNUSUAL_ACTIVITY_PATTERN = 'unusual_activity_pattern',
  BLOCKED_COUNTRY_ACCESS = 'blocked_country_access',
  API_KEY_MISUSE = 'api_key_misuse',
  POTENTIAL_ACCOUNT_TAKEOVER = 'potential_account_takeover',
}

/**
 * Security monitoring service
 */
export class SecurityMonitoringService {
  // Cache of recent alerts
  private recentAlerts: SecurityAlert[] = [];
  
  // Maximum number of recent alerts to keep in memory
  private readonly MAX_RECENT_ALERTS = 100;
  
  constructor() {
    // Initialize the service
    this.initializeService().catch(err => {
      logger.error('Failed to initialize security monitoring service', { error: err.message });
    });
  }
  
  /**
   * Initialize the security monitoring service
   */
  private async initializeService(): Promise<void> {
    // Load recent alerts from database
    await this.loadRecentAlerts();
    
    // Set up periodic tasks
    this.setupPeriodicTasks();
    
    logger.info('Security monitoring service initialized');
  }
  
  /**
   * Setup periodic security tasks
   */
  private setupPeriodicTasks(): void {
    // Check for suspicious IPs every 5 minutes
    setInterval(() => this.checkSuspiciousIPs(), 5 * 60 * 1000);
    
    // Run security metrics calculation every hour
    setInterval(() => this.calculateHourlyMetrics(), 60 * 60 * 1000);
    
    // Clean up old alerts weekly
    setInterval(() => this.cleanupOldAlerts(), 7 * 24 * 60 * 60 * 1000);
  }
  
  /**
   * Load recent alerts from the database
   */
  private async loadRecentAlerts(): Promise<void> {
    try {
      // Get the most recent alerts from the database
      const alerts = await prisma.auditLog.findMany({
        where: {
          action: {
            startsWith: 'security.alert.'
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: this.MAX_RECENT_ALERTS
      });
      
      // Convert audit logs to security alerts
      this.recentAlerts = alerts.map(log => {
        const metadata = log.metadata as any || {};
        
        return {
          id: log.id,
          timestamp: log.timestamp,
          type: log.action.replace('security.alert.', ''),
          severity: metadata.severity || 'medium',
          source: metadata.source || 'system',
          message: metadata.message || 'Security alert',
          details: metadata.details || {},
          isResolved: metadata.isResolved || false,
          resolvedAt: metadata.resolvedAt,
          resolvedBy: metadata.resolvedBy,
          resolutionNotes: metadata.resolutionNotes
        };
      });
      
      logger.info(`Loaded ${this.recentAlerts.length} recent security alerts`);
    } catch (error) {
      logger.error('Failed to load recent security alerts', { error: error.message });
    }
  }
  
  /**
   * Check for suspicious IPs and generate alerts
   */
  private async checkSuspiciousIPs(): Promise<void> {
    try {
      // Get suspicious IPs from the reputation tracker
      const suspiciousIPs = await ipReputationTracker.getSuspiciousIPs();
      
      if (suspiciousIPs.length === 0) {
        return;
      }
      
      // Log suspicious IPs for monitoring
      logger.info(`Found ${suspiciousIPs.length} suspicious IPs`);
      
      // Process each suspicious IP for potential alerts
      for (const ip of suspiciousIPs) {
        await this.processSuspiciousIP(ip);
      }
    } catch (error) {
      logger.error('Error checking suspicious IPs', { error: error.message });
    }
  }
  
  /**
   * Process a suspicious IP for alerts
   */
  private async processSuspiciousIP(ipData: IPReputationData): Promise<void> {
    // Skip if the IP is already blocked
    if (ipData.isBlocked) {
      return;
    }
    
    // Count recent suspicious events
    const recentEvents = ipData.events.filter(e => 
      Date.now() - e.timestamp < 60 * 60 * 1000 && // Last hour
      e.impact < 0 // Negative impact events
    );
    
    // If there are multiple suspicious events, create an alert
    if (recentEvents.length >= 5) {
      await this.createAlert({
        type: AlertType.SUSPICIOUS_IP_ACTIVITY,
        severity: 'medium',
        source: 'ip_reputation',
        message: `Suspicious activity from IP with ${recentEvents.length} negative events in the last hour`,
        details: {
          ip: ipData.ip,
          score: ipData.score,
          recentEvents: recentEvents.map(e => e.event),
          country: ipData.country,
          asn: ipData.asn,
          isp: ipData.isp
        }
      });
      
      // If score is very low, block the IP
      if (ipData.score < 20) {
        await ipReputationTracker.blockIP(ipData.ip, 'Automated block due to highly suspicious activity');
        
        // Create a higher severity alert for the block
        await this.createAlert({
          type: AlertType.SUSPICIOUS_IP_ACTIVITY,
          severity: 'high',
          source: 'ip_reputation',
          message: `IP automatically blocked due to highly suspicious activity`,
          details: {
            ip: ipData.ip,
            score: ipData.score,
            recentEvents: recentEvents.map(e => e.event),
            country: ipData.country,
            asn: ipData.asn,
            isp: ipData.isp
          }
        });
      }
    }
  }
  
  /**
   * Calculate hourly security metrics
   */
  private async calculateHourlyMetrics(): Promise<SecurityMetrics> {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    try {
      // Query audit logs for auth events
      const authLogs = await prisma.auditLog.findMany({
        where: {
          action: {
            startsWith: 'auth.'
          },
          timestamp: {
            gte: hourAgo
          }
        }
      });
      
      // Count auth successes and failures
      const authSuccesses = authLogs.filter(log => log.action === 'auth.login.success').length;
      const authFailures = authLogs.filter(log => log.action === 'auth.login.failure').length;
      
      // Query rate limit events
      const rateLimitLogs = await prisma.auditLog.findMany({
        where: {
          action: 'security.rate_limit_exceeded',
          timestamp: {
            gte: hourAgo
          }
        }
      });
      
      // Get current suspicious and blocked IPs
      const suspiciousIPs = await ipReputationTracker.getSuspiciousIPs();
      const blockedIPs = suspiciousIPs.filter(ip => ip.isBlocked);
      
      // Create metrics object
      const metrics: SecurityMetrics = {
        authFailures,
        authSuccesses,
        rateLimitExceeded: rateLimitLogs.length,
        blockedIPs: blockedIPs.length,
        suspiciousIPs: suspiciousIPs.length,
        totalRequests: await this.countTotalRequests(hourAgo),
        blockedRequests: await this.countBlockedRequests(hourAgo),
        suspiciousPatterns: await this.countSuspiciousPatterns(hourAgo),
        interval: 'hour',
        from: hourAgo,
        to: now
      };
      
      // Log metrics for monitoring
      logger.info('Hourly security metrics calculated', { metrics });
      
      // Store metrics in database for historical tracking
      await this.storeMetrics(metrics);
      
      return metrics;
    } catch (error) {
      logger.error('Error calculating hourly security metrics', { error: error.message });
      
      // Return empty metrics on error
      return {
        authFailures: 0,
        authSuccesses: 0,
        rateLimitExceeded: 0,
        blockedIPs: 0,
        suspiciousIPs: 0,
        totalRequests: 0,
        blockedRequests: 0,
        suspiciousPatterns: 0,
        interval: 'hour',
        from: hourAgo,
        to: now
      };
    }
  }
  
  /**
   * Count total requests in a time period
   */
  private async countTotalRequests(since: Date): Promise<number> {
    try {
      // This is a simplified implementation
      // In a real system, this would query a request logging table or metrics system
      
      // For now, query audit logs as a proxy for requests
      const count = await prisma.auditLog.count({
        where: {
          timestamp: {
            gte: since
          }
        }
      });
      
      return count;
    } catch (error) {
      logger.error('Error counting total requests', { error: error.message });
      return 0;
    }
  }
  
  /**
   * Count blocked requests in a time period
   */
  private async countBlockedRequests(since: Date): Promise<number> {
    try {
      // Count security-related blocks
      const count = await prisma.auditLog.count({
        where: {
          OR: [
            { action: 'security.request.blocked' },
            { action: 'security.rate_limit_exceeded' },
            { action: 'security.ip_blocked' }
          ],
          timestamp: {
            gte: since
          }
        }
      });
      
      return count;
    } catch (error) {
      logger.error('Error counting blocked requests', { error: error.message });
      return 0;
    }
  }
  
  /**
   * Count suspicious patterns in a time period
   */
  private async countSuspiciousPatterns(since: Date): Promise<number> {
    try {
      // Count suspicious pattern detections
      const count = await prisma.auditLog.count({
        where: {
          action: 'security.suspicious_pattern',
          timestamp: {
            gte: since
          }
        }
      });
      
      return count;
    } catch (error) {
      logger.error('Error counting suspicious patterns', { error: error.message });
      return 0;
    }
  }
  
  /**
   * Store metrics in the database
   */
  private async storeMetrics(metrics: SecurityMetrics): Promise<void> {
    try {
      // Store metrics as an audit log entry
      await prisma.auditLog.create({
        data: {
          action: 'security.metrics',
          entityType: 'security',
          metadata: metrics as any,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Error storing security metrics', { error: error.message });
    }
  }
  
  /**
   * Clean up old alerts
   */
  private async cleanupOldAlerts(): Promise<void> {
    try {
      // Calculate date threshold (30 days ago)
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - 30);
      
      // Count alerts to be marked as archived
      const count = await prisma.auditLog.count({
        where: {
          action: {
            startsWith: 'security.alert.'
          },
          timestamp: {
            lt: threshold
          },
          metadata: {
            path: ['isArchived'],
            equals: false
          }
        }
      });
      
      if (count === 0) {
        return;
      }
      
      // Update alerts to be archived
      // Note: This is a simplified implementation
      // In a real system, you might use a more efficient batch update
      await prisma.auditLog.updateMany({
        where: {
          action: {
            startsWith: 'security.alert.'
          },
          timestamp: {
            lt: threshold
          },
          metadata: {
            path: ['isArchived'],
            equals: false
          }
        },
        data: {
          metadata: {
            isArchived: true
          }
        }
      });
      
      logger.info(`Archived ${count} old security alerts`);
    } catch (error) {
      logger.error('Error cleaning up old alerts', { error: error.message });
    }
  }
  
  /**
   * Create a new security alert
   */
  public async createAlert(alert: Omit<SecurityAlert, 'id' | 'timestamp' | 'isResolved'>): Promise<SecurityAlert> {
    try {
      // Generate ID and timestamp
      const timestamp = new Date();
      const id = `alert_${timestamp.getTime()}_${Math.random().toString(36).substring(2, 10)}`;
      
      // Create full alert object
      const fullAlert: SecurityAlert = {
        id,
        timestamp,
        isResolved: false,
        ...alert
      };
      
      // Add to recent alerts cache
      this.recentAlerts.unshift(fullAlert);
      
      // Trim cache if needed
      if (this.recentAlerts.length > this.MAX_RECENT_ALERTS) {
        this.recentAlerts.pop();
      }
      
      // Store in database as audit log
      await prisma.auditLog.create({
        data: {
          id,
          action: `security.alert.${alert.type}`,
          entityType: 'security',
          metadata: fullAlert as any,
          timestamp
        }
      });
      
      // Log alert creation
      logger.warn(`Security alert created: ${alert.message}`, {
        alertType: alert.type,
        severity: alert.severity
      });
      
      return fullAlert;
    } catch (error) {
      logger.error('Error creating security alert', { error: error.message, alert });
      
      // Return a minimal alert object on error
      return {
        id: `error_${Date.now()}`,
        timestamp: new Date(),
        type: alert.type,
        severity: alert.severity,
        source: alert.source,
        message: alert.message,
        details: alert.details,
        isResolved: false
      };
    }
  }
  
  /**
   * Resolve a security alert
   */
  public async resolveAlert(alertId: string, resolvedBy: string, notes?: string): Promise<boolean> {
    try {
      // Update the alert in the in-memory cache
      const alertIndex = this.recentAlerts.findIndex(a => a.id === alertId);
      
      if (alertIndex >= 0) {
        this.recentAlerts[alertIndex].isResolved = true;
        this.recentAlerts[alertIndex].resolvedAt = new Date();
        this.recentAlerts[alertIndex].resolvedBy = resolvedBy;
        this.recentAlerts[alertIndex].resolutionNotes = notes;
      }
      
      // Update the alert in the database
      await prisma.auditLog.update({
        where: {
          id: alertId
        },
        data: {
          metadata: {
            isResolved: true,
            resolvedAt: new Date(),
            resolvedBy,
            resolutionNotes: notes
          }
        }
      });
      
      return true;
    } catch (error) {
      logger.error('Error resolving security alert', { error: error.message, alertId });
      return false;
    }
  }
  
  /**
   * Get recent security alerts
   */
  public async getRecentAlerts(limit: number = 10, includeResolved: boolean = false): Promise<SecurityAlert[]> {
    try {
      // If we have enough in the cache, filter and return
      if (this.recentAlerts.length >= limit) {
        return this.recentAlerts
          .filter(alert => includeResolved || !alert.isResolved)
          .slice(0, limit);
      }
      
      // Otherwise, query the database
      const alerts = await prisma.auditLog.findMany({
        where: {
          action: {
            startsWith: 'security.alert.'
          },
          metadata: includeResolved ? undefined : {
            path: ['isResolved'],
            equals: false
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: limit
      });
      
      // Convert audit logs to security alerts
      return alerts.map(log => {
        const metadata = log.metadata as any || {};
        
        return {
          id: log.id,
          timestamp: log.timestamp,
          type: log.action.replace('security.alert.', ''),
          severity: metadata.severity || 'medium',
          source: metadata.source || 'system',
          message: metadata.message || 'Security alert',
          details: metadata.details || {},
          isResolved: metadata.isResolved || false,
          resolvedAt: metadata.resolvedAt,
          resolvedBy: metadata.resolvedBy,
          resolutionNotes: metadata.resolutionNotes
        };
      });
    } catch (error) {
      logger.error('Error getting recent security alerts', { error: error.message });
      return [];
    }
  }
  
  /**
   * Get security metrics for a time period
   */
  public async getMetrics(interval: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<SecurityMetrics> {
    try {
      // Calculate date range
      const now = new Date();
      let from: Date;
      
      switch (interval) {
        case 'hour':
          from = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case 'week':
          from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'day':
        default:
          from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
      }
      
      // Get the most recent metrics entry for this interval
      const metricsLog = await prisma.auditLog.findFirst({
        where: {
          action: 'security.metrics',
          metadata: {
            path: ['interval'],
            equals: interval
          },
          timestamp: {
            gte: from
          }
        },
        orderBy: {
          timestamp: 'desc'
        }
      });
      
      if (metricsLog) {
        // Return the stored metrics
        return metricsLog.metadata as any;
      }
      
      // If no metrics are found, calculate them now
      if (interval === 'hour') {
        return this.calculateHourlyMetrics();
      } else {
        // For other intervals, aggregate multiple hourly metrics
        return this.aggregateMetrics(interval);
      }
    } catch (error) {
      logger.error('Error getting security metrics', { error: error.message });
      
      // Return empty metrics on error
      return {
        authFailures: 0,
        authSuccesses: 0,
        rateLimitExceeded: 0,
        blockedIPs: 0,
        suspiciousIPs: 0,
        totalRequests: 0,
        blockedRequests: 0,
        suspiciousPatterns: 0,
        interval,
        from: new Date(Date.now() - 24 * 60 * 60 * 1000),
        to: new Date()
      };
    }
  }
  
  /**
   * Aggregate multiple hourly metrics into a longer interval
   */
  private async aggregateMetrics(interval: 'day' | 'week' | 'month'): Promise<SecurityMetrics> {
    try {
      // Calculate date range
      const now = new Date();
      let from: Date;
      
      switch (interval) {
        case 'week':
          from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'day':
        default:
          from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
      }
      
      // Get all hourly metrics in the date range
      const metricsLogs = await prisma.auditLog.findMany({
        where: {
          action: 'security.metrics',
          metadata: {
            path: ['interval'],
            equals: 'hour'
          },
          timestamp: {
            gte: from
          }
        },
        orderBy: {
          timestamp: 'desc'
        }
      });
      
      // Aggregate metrics
      const metrics: SecurityMetrics = {
        authFailures: 0,
        authSuccesses: 0,
        rateLimitExceeded: 0,
        blockedIPs: 0,
        suspiciousIPs: 0,
        totalRequests: 0,
        blockedRequests: 0,
        suspiciousPatterns: 0,
        interval,
        from,
        to: now
      };
      
      // Sum up all hourly metrics
      for (const log of metricsLogs) {
        const hourlyMetrics = log.metadata as any;
        
        metrics.authFailures += hourlyMetrics.authFailures || 0;
        metrics.authSuccesses += hourlyMetrics.authSuccesses || 0;
        metrics.rateLimitExceeded += hourlyMetrics.rateLimitExceeded || 0;
        metrics.totalRequests += hourlyMetrics.totalRequests || 0;
        metrics.blockedRequests += hourlyMetrics.blockedRequests || 0;
        metrics.suspiciousPatterns += hourlyMetrics.suspiciousPatterns || 0;
      }
      
      // For IP counts, get the most recent values
      if (metricsLogs.length > 0) {
        const mostRecent = metricsLogs[0].metadata as any;
        metrics.blockedIPs = mostRecent.blockedIPs || 0;
        metrics.suspiciousIPs = mostRecent.suspiciousIPs || 0;
      }
      
      // Store the aggregated metrics
      await this.storeMetrics(metrics);
      
      return metrics;
    } catch (error) {
      logger.error('Error aggregating security metrics', { error: error.message });
      
      // Return empty metrics on error
      return {
        authFailures: 0,
        authSuccesses: 0,
        rateLimitExceeded: 0,
        blockedIPs: 0,
        suspiciousIPs: 0,
        totalRequests: 0,
        blockedRequests: 0,
        suspiciousPatterns: 0,
        interval,
        from: new Date(Date.now() - 24 * 60 * 60 * 1000),
        to: new Date()
      };
    }
  }
}

// Create a singleton instance
const securityMonitoringService = new SecurityMonitoringService();

export default securityMonitoringService;