/**
 * Alert Management System
 * 
 * Advanced alert management system that provides alert routing, escalation policies,
 * custom notification channels, alert acknowledgment, and status tracking.
 * 
 * Key features:
 * - Alert routing and escalation
 * - Multiple notification channels (email, webhook, SMS)
 * - Alert acknowledgment and resolution tracking
 * - Integration with monitoring system
 * - Alert history and reporting
 */

import { systemMonitor, AlertSeverity, AlertEvent } from './SystemMonitor';
// Create mock logger
const zkErrorLogger = {
  log: (level: string, message: string, meta?: any) => {
    console.log(`[${level}] ${message}`, meta);
  },
  logError: (error: Error, meta?: any) => {
    console.error(`[ERROR] ${error.message}`, meta);
  }
};
import { EventEmitter } from 'events';

// Alert status
export enum AlertStatus {
  TRIGGERED = 'triggered',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated'
}

// Alert acknowledgment
export interface AlertAcknowledgment {
  alertEventId: string;
  timestamp: Date;
  acknowledgedBy: string;
  comment?: string;
  timeToAcknowledge: number; // ms from trigger to acknowledgment
}

// Alert resolution
export interface AlertResolution {
  alertEventId: string;
  timestamp: Date;
  resolvedBy?: string;
  comment?: string;
  timeToResolve: number; // ms from trigger to resolution
  automatic: boolean; // Whether the alert was automatically resolved
}

// Alert with tracking info
export interface TrackedAlert {
  event: AlertEvent;
  status: AlertStatus;
  createdAt: Date;
  updatedAt: Date;
  acknowledgment?: AlertAcknowledgment;
  resolution?: AlertResolution;
  escalationLevel: number;
  nextEscalationTime?: Date;
  notifiedChannels: string[];
  tags: string[];
}

// Escalation policy
export interface EscalationPolicy {
  id: string;
  name: string;
  description: string;
  stages: EscalationStage[];
  repeatFinalStage: boolean;
}

// Notification Channel types
export enum NotificationChannelType {
  EMAIL = 'email',
  SMS = 'sms',
  WEBHOOK = 'webhook',
  SLACK = 'slack',
  TEAMS = 'teams',
  PAGERDUTY = 'pagerduty'
}

// Notification Channel
export interface NotificationChannel {
  id: string;
  name: string;
  type: NotificationChannelType;
  config: Record<string, any>;
  active: boolean;
}

// Escalation stage
export interface EscalationStage {
  level: number;
  delayMinutes: number;
  notificationChannels: string[];
  notifyAll?: boolean; // If true, notify all channels, not just the ones specified
}

// On-call schedule
export interface OnCallSchedule {
  id: string;
  name: string;
  schedule: Array<{
    dayOfWeek: number; // 0-6 (Sunday to Saturday)
    startHour: number; // 0-23
    endHour: number; // 0-23
    channels: string[];
  }>;
  fallbackChannels: string[];
}

/**
 * Alert Management System
 */
export class AlertManager extends EventEmitter {
  private trackedAlerts: Map<string, TrackedAlert> = new Map();
  private alertHistory: TrackedAlert[] = [];
  private historyRetentionDays: number;
  private escalationPolicies: Map<string, EscalationPolicy> = new Map();
  private defaultEscalationPolicyId: string | null = null;
  private onCallSchedules: Map<string, OnCallSchedule> = new Map();
  private escalationInterval: NodeJS.Timeout | null = null;
  private initialized: boolean = false;
  
  // Default escalation policy
  private readonly DEFAULT_ESCALATION_POLICY: EscalationPolicy = {
    id: 'default_escalation_policy',
    name: 'Default Escalation Policy',
    description: 'The default escalation policy used when no specific policy is assigned',
    stages: [
      {
        level: 1,
        delayMinutes: 0, // Immediate notification
        notificationChannels: ['default_email'],
        notifyAll: false
      },
      {
        level: 2,
        delayMinutes: 30, // 30 minutes after initial alert
        notificationChannels: ['default_email'],
        notifyAll: true
      }
    ],
    repeatFinalStage: true
  };
  
  /**
   * Constructs a new AlertManager instance
   * 
   * @param historyRetentionDays - Number of days to retain alert history (defaults to 90)
   */
  constructor(historyRetentionDays: number = 90) {
    super();
    this.historyRetentionDays = historyRetentionDays;
    
    // Initialize the alert manager
    this.initialize().catch(error => {
      zkErrorLogger.log('ERROR', 'Failed to initialize AlertManager', {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error instanceof Error ? error.message : String(error) }
      });
    });
  }
  
  /**
   * Initialize the alert manager
   */
  public async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    try {
      // Register the default escalation policy
      this.registerEscalationPolicy(this.DEFAULT_ESCALATION_POLICY);
      this.defaultEscalationPolicyId = this.DEFAULT_ESCALATION_POLICY.id;
      
      // Start the escalation interval (check every minute)
      this.escalationInterval = setInterval(() => this.checkEscalations(), 60000);
      
      // Subscribe to the system monitor alerts
      systemMonitor.on('alert', (alert: AlertEvent) => this.handleNewAlert(alert));
      systemMonitor.on('alertResolved', (alert: AlertEvent) => this.handleResolvedAlert(alert));
      
      this.initialized = true;
      
      zkErrorLogger.log('INFO', 'AlertManager initialized successfully', {
        category: 'monitoring',
        userFixable: false,
        recoverable: true
      });
      
      return true;
    } catch (error) {
      // Safely extract error message
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      zkErrorLogger.log('ERROR', 'Failed to initialize AlertManager', {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: errorMessage }
      });
      
      return false;
    }
  }
  
  /**
   * Register an escalation policy
   * 
   * @param policy - The escalation policy to register
   * @returns True if the policy was successfully registered
   */
  public registerEscalationPolicy(policy: EscalationPolicy): boolean {
    try {
      // Check if policy with this ID already exists
      if (this.escalationPolicies.has(policy.id)) {
        zkErrorLogger.log('WARNING', `Escalation policy already exists: ${policy.id}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        
        // Update the existing policy
        this.escalationPolicies.set(policy.id, policy);
        return true;
      }
      
      // Store the policy
      this.escalationPolicies.set(policy.id, policy);
      
      // If this is the first policy, set it as the default
      if (this.escalationPolicies.size === 1) {
        this.defaultEscalationPolicyId = policy.id;
      }
      
      return true;
    } catch (error) {
      // Safely extract error message
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      zkErrorLogger.log('ERROR', `Failed to register escalation policy: ${policy.id}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: errorMessage }
      });
      
      return false;
    }
  }
  
  /**
   * Register an on-call schedule
   * 
   * @param schedule - The on-call schedule to register
   * @returns True if the schedule was successfully registered
   */
  public registerOnCallSchedule(schedule: OnCallSchedule): boolean {
    try {
      // Check if schedule with this ID already exists
      if (this.onCallSchedules.has(schedule.id)) {
        zkErrorLogger.log('WARNING', `On-call schedule already exists: ${schedule.id}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        
        // Update the existing schedule
        this.onCallSchedules.set(schedule.id, schedule);
        return true;
      }
      
      // Store the schedule
      this.onCallSchedules.set(schedule.id, schedule);
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to register on-call schedule: ${schedule.id}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error instanceof Error ? error.message : String(error) }
      });
      
      return false;
    }
  }
  
  /**
   * Create an alert manually
   * 
   * @param alert - The alert details
   * @returns The created alert ID or null if creation failed
   */
  public createAlert(alert: {
    metricName: string;
    severity: AlertSeverity;
    value: number;
    threshold: number;
    message: string;
    source?: string;
    tags?: string[];
  }): string | null {
    try {
      // Generate a unique ID for the alert
      const alertId = `manual-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Create the alert event
      const alertEvent: AlertEvent = {
        id: alertId,
        alertId: alertId, // Use the same ID for both id and alertId for manual alerts
        metricName: alert.metricName,
        metricValue: alert.value, // Using value as metricValue
        severity: alert.severity,
        timestamp: new Date(),
        threshold: alert.threshold,
        labels: { // Create labels from message and source
          message: alert.message,
          source: alert.source || 'manual'
        }
      };
      
      // Process it through the normal alert flow
      this.handleNewAlert(alertEvent);
      
      // Add any provided tags
      if (alert.tags && alert.tags.length > 0) {
        this.addTagsToAlert(alertId, alert.tags);
      }
      
      return alertId;
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to create manual alert', {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error instanceof Error ? error.message : String(error), alert }
      });
      
      return null;
    }
  }
  
  /**
   * Set the default escalation policy
   * 
   * @param policyId - The ID of the policy to set as default
   * @returns True if the policy was successfully set as default
   */
  public setDefaultEscalationPolicy(policyId: string): boolean {
    try {
      // Check if policy exists
      if (!this.escalationPolicies.has(policyId)) {
        zkErrorLogger.log('WARNING', `Escalation policy does not exist: ${policyId}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      // Set as default
      this.defaultEscalationPolicyId = policyId;
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to set default escalation policy: ${policyId}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error instanceof Error ? error.message : String(error) }
      });
      
      return false;
    }
  }
  
  /**
   * Acknowledge an alert
   * 
   * @param alertId - The ID of the alert to acknowledge
   * @param acknowledgedBy - The name or ID of the person acknowledging the alert
   * @param comment - Optional comment
   * @returns True if the alert was successfully acknowledged
   */
  public acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string,
    comment?: string
  ): boolean {
    try {
      // Check if alert exists and is not already resolved
      if (!this.trackedAlerts.has(alertId)) {
        zkErrorLogger.log('WARNING', `Alert does not exist: ${alertId}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      const alert = this.trackedAlerts.get(alertId)!;
      
      // Check if alert is already resolved
      if (alert.status === AlertStatus.RESOLVED) {
        zkErrorLogger.log('WARNING', `Alert is already resolved: ${alertId}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      // Check if alert is already acknowledged
      if (alert.status === AlertStatus.ACKNOWLEDGED) {
        // Update the acknowledgment
        alert.acknowledgment = {
          alertEventId: alertId,
          timestamp: new Date(),
          acknowledgedBy,
          comment,
          timeToAcknowledge: Date.now() - alert.createdAt.getTime()
        };
        
        alert.updatedAt = new Date();
        
        // Save the updated alert
        this.trackedAlerts.set(alertId, alert);
        
        return true;
      }
      
      // Acknowledge the alert
      alert.status = AlertStatus.ACKNOWLEDGED;
      alert.acknowledgment = {
        alertEventId: alertId,
        timestamp: new Date(),
        acknowledgedBy,
        comment,
        timeToAcknowledge: Date.now() - alert.createdAt.getTime()
      };
      
      alert.updatedAt = new Date();
      
      // Save the updated alert
      this.trackedAlerts.set(alertId, alert);
      
      // Emit event
      this.emit('alertAcknowledged', alert);
      
      // Log the acknowledgment
      zkErrorLogger.log('INFO', `Alert acknowledged: ${alertId}`, {
        category: 'monitoring',
        userFixable: false,
        recoverable: true,
        details: { 
          alertId,
          acknowledgedBy,
          timeToAcknowledge: alert.acknowledgment.timeToAcknowledge
        }
      });
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to acknowledge alert: ${alertId}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error instanceof Error ? error.message : String(error) }
      });
      
      return false;
    }
  }
  
  /**
   * Manually resolve an alert
   * 
   * @param alertId - The ID of the alert to resolve
   * @param resolvedBy - The name or ID of the person resolving the alert
   * @param comment - Optional comment
   * @returns True if the alert was successfully resolved
   */
  public resolveAlert(
    alertId: string,
    resolvedBy: string,
    comment?: string
  ): boolean {
    try {
      // Check if alert exists and is not already resolved
      if (!this.trackedAlerts.has(alertId)) {
        zkErrorLogger.log('WARNING', `Alert does not exist: ${alertId}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      const alert = this.trackedAlerts.get(alertId)!;
      
      // Check if alert is already resolved
      if (alert.status === AlertStatus.RESOLVED) {
        zkErrorLogger.log('WARNING', `Alert is already resolved: ${alertId}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      // Resolve the alert
      alert.status = AlertStatus.RESOLVED;
      alert.resolution = {
        alertEventId: alertId,
        timestamp: new Date(),
        resolvedBy,
        comment,
        timeToResolve: Date.now() - alert.createdAt.getTime(),
        automatic: false
      };
      
      alert.updatedAt = new Date();
      
      // Save the updated alert
      this.trackedAlerts.set(alertId, alert);
      
      // Move to history
      this.alertHistory.push(alert);
      
      // Remove from active alerts
      this.trackedAlerts.delete(alertId);
      
      // Emit event
      this.emit('alertResolved', alert);
      
      // Log the resolution
      zkErrorLogger.log('INFO', `Alert manually resolved: ${alertId}`, {
        category: 'monitoring',
        userFixable: false,
        recoverable: true,
        details: { 
          alertId,
          resolvedBy,
          timeToResolve: alert.resolution.timeToResolve
        }
      });
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to resolve alert: ${alertId}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error instanceof Error ? error.message : String(error) }
      });
      
      return false;
    }
  }
  
  /**
   * Manually escalate an alert to the next level or a specific level
   * 
   * @param alertId - The ID of the alert to escalate
   * @param options - Escalation options
   * @returns True if the alert was successfully escalated
   */
  public escalateAlert(
    alertId: string,
    options: {
      toLevel?: number;
      escalatedBy?: string;
      reason?: string;
      notificationChannels?: string[];
    } = {}
  ): boolean {
    try {
      // Check if alert exists and is not already resolved
      if (!this.trackedAlerts.has(alertId)) {
        zkErrorLogger.log('WARNING', `Alert does not exist: ${alertId}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      const alert = this.trackedAlerts.get(alertId)!;
      
      // Check if alert is already resolved
      if (alert.status === AlertStatus.RESOLVED) {
        zkErrorLogger.log('WARNING', `Cannot escalate resolved alert: ${alertId}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      // Get current escalation level
      const currentLevel = alert.escalationLevel;
      
      // Determine the target level
      const targetLevel = options.toLevel || (currentLevel + 1);
      
      if (targetLevel <= currentLevel) {
        zkErrorLogger.log('WARNING', `Target escalation level (${targetLevel}) is not higher than current level (${currentLevel})`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      // Get the escalation policy to use
      const policyId = this.defaultEscalationPolicyId;
      if (!policyId || !this.escalationPolicies.has(policyId)) {
        zkErrorLogger.log('WARNING', 'No escalation policy available', {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      const policy = this.escalationPolicies.get(policyId)!;
      
      // Check if the target level exists in the policy
      let validLevel = targetLevel <= policy.stages.length;
      if (!validLevel && policy.repeatFinalStage) {
        // If we can repeat the final stage, any level above the max is valid
        validLevel = true;
      }
      
      if (!validLevel) {
        zkErrorLogger.log('WARNING', `Invalid escalation level: ${targetLevel}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      // Update the alert status
      alert.status = AlertStatus.ESCALATED;
      alert.escalationLevel = targetLevel;
      alert.updatedAt = new Date();
      
      // Clear any scheduled escalation
      alert.nextEscalationTime = undefined;
      
      // Store who escalated the alert if provided
      if (options.escalatedBy) {
        alert.tags.push(`escalated-by:${options.escalatedBy}`);
      }
      
      // Store reason if provided
      if (options.reason) {
        alert.tags.push(`escalation-reason:${options.reason}`);
      }
      
      // Save the updated alert
      this.trackedAlerts.set(alertId, alert);
      
      // Perform the escalation notification
      if (options.notificationChannels && options.notificationChannels.length > 0) {
        // Use the provided notification channels
        alert.notifiedChannels = [...alert.notifiedChannels, ...options.notificationChannels];
        alert.notifiedChannels = [...new Set(alert.notifiedChannels)]; // Remove duplicates
      } else {
        // Use policy-based escalation
        this.performEscalation(alertId, targetLevel);
      }
      
      // Emit event
      this.emit('alertEscalated', alert);
      
      // Log the manual escalation
      zkErrorLogger.log('INFO', `Alert manually escalated: ${alertId} from level ${currentLevel} to ${targetLevel}`, {
        category: 'monitoring',
        userFixable: false,
        recoverable: true,
        details: { 
          alertId,
          previousLevel: currentLevel,
          newLevel: targetLevel,
          escalatedBy: options.escalatedBy,
          reason: options.reason
        }
      });
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to escalate alert: ${alertId}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error instanceof Error ? error.message : String(error) }
      });
      
      return false;
    }
  }
  
  /**
   * Get active alerts
   * 
   * @param filters - Optional filters for the alerts
   * @returns Array of active alerts
   */
  public getActiveAlerts(filters?: {
    status?: AlertStatus[],
    severity?: AlertSeverity[],
    tags?: string[]
  }): TrackedAlert[] {
    let alerts = Array.from(this.trackedAlerts.values());
    
    // Apply filters if provided
    if (filters) {
      if (filters.status) {
        alerts = alerts.filter(alert => filters.status!.includes(alert.status));
      }
      
      if (filters.severity) {
        alerts = alerts.filter(alert => filters.severity!.includes(alert.event.severity as AlertSeverity));
      }
      
      if (filters.tags) {
        alerts = alerts.filter(alert => 
          filters.tags!.some(tag => alert.tags.includes(tag))
        );
      }
    }
    
    // Sort by creation time, newest first
    return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  /**
   * Get alert history
   * 
   * @param limit - Maximum number of alerts to return (defaults to 100)
   * @param filters - Optional filters for the alerts
   * @returns Array of historical alerts
   */
  public getAlertHistory(
    limit: number = 100,
    filters?: {
      status?: AlertStatus[],
      severity?: AlertSeverity[],
      tags?: string[],
      startDate?: Date,
      endDate?: Date
    }
  ): TrackedAlert[] {
    let alerts = [...this.alertHistory];
    
    // Apply filters if provided
    if (filters) {
      if (filters.status) {
        alerts = alerts.filter(alert => filters.status!.includes(alert.status));
      }
      
      if (filters.severity) {
        alerts = alerts.filter(alert => filters.severity!.includes(alert.event.severity as AlertSeverity));
      }
      
      if (filters.tags) {
        alerts = alerts.filter(alert => 
          filters.tags!.some(tag => alert.tags.includes(tag))
        );
      }
      
      if (filters.startDate) {
        alerts = alerts.filter(alert => alert.createdAt >= filters.startDate!);
      }
      
      if (filters.endDate) {
        alerts = alerts.filter(alert => alert.createdAt <= filters.endDate!);
      }
    }
    
    // Sort by creation time, newest first
    return alerts
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  
  /**
   * Get alert statistics
   * 
   * @param timeframeMs - Timeframe in milliseconds for the stats (defaults to 7 days)
   * @returns Alert statistics
   */
  public getAlertStatistics(timeframeMs: number = 7 * 24 * 60 * 60 * 1000): {
    total: number;
    resolved: number;
    acknowledged: number;
    triggered: number;
    escalated: number;
    byTag: Record<string, number>;
    bySeverity: Record<string, number>;
    mttr: number; // Mean Time To Resolution
    mtta: number; // Mean Time To Acknowledgment
  } {
    const now = Date.now();
    const cutoffTime = now - timeframeMs;
    
    // Get alerts within the timeframe
    const activeAlerts = Array.from(this.trackedAlerts.values())
      .filter(alert => alert.createdAt.getTime() >= cutoffTime);
    
    const historyAlerts = this.alertHistory
      .filter(alert => alert.createdAt.getTime() >= cutoffTime);
    
    const allAlerts = [...activeAlerts, ...historyAlerts];
    
    // Calculate counts
    const total = allAlerts.length;
    const resolved = allAlerts.filter(alert => alert.status === AlertStatus.RESOLVED).length;
    const acknowledged = allAlerts.filter(alert => alert.status === AlertStatus.ACKNOWLEDGED).length;
    const triggered = allAlerts.filter(alert => alert.status === AlertStatus.TRIGGERED).length;
    const escalated = allAlerts.filter(alert => alert.status === AlertStatus.ESCALATED).length;
    
    // Calculate metrics by tag
    const byTag: Record<string, number> = {};
    for (const alert of allAlerts) {
      for (const tag of alert.tags) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }
    }
    
    // Calculate metrics by severity
    const bySeverity: Record<string, number> = {};
    for (const alert of allAlerts) {
      const severity = alert.event.severity;
      bySeverity[severity] = (bySeverity[severity] || 0) + 1;
    }
    
    // Calculate MTTR (Mean Time To Resolution)
    const resolvedAlerts = allAlerts.filter(alert => alert.resolution);
    const totalTimeToResolve = resolvedAlerts.reduce(
      (sum, alert) => sum + alert.resolution!.timeToResolve, 
      0
    );
    const mttr = resolvedAlerts.length > 0 
      ? totalTimeToResolve / resolvedAlerts.length 
      : 0;
    
    // Calculate MTTA (Mean Time To Acknowledgment)
    const acknowledgedAlerts = allAlerts.filter(alert => alert.acknowledgment);
    const totalTimeToAcknowledge = acknowledgedAlerts.reduce(
      (sum, alert) => sum + alert.acknowledgment!.timeToAcknowledge, 
      0
    );
    const mtta = acknowledgedAlerts.length > 0 
      ? totalTimeToAcknowledge / acknowledgedAlerts.length 
      : 0;
    
    return {
      total,
      resolved,
      acknowledged,
      triggered,
      escalated,
      byTag,
      bySeverity,
      mttr,
      mtta
    };
  }
  
  /**
   * Add tags to an alert
   * 
   * @param alertId - The ID of the alert
   * @param tags - Tags to add
   * @returns True if the tags were successfully added
   */
  public addTagsToAlert(alertId: string, tags: string[]): boolean {
    try {
      // Check if alert exists
      if (!this.trackedAlerts.has(alertId)) {
        zkErrorLogger.log('WARNING', `Alert does not exist: ${alertId}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      const alert = this.trackedAlerts.get(alertId)!;
      
      // Add tags (avoid duplicates)
      for (const tag of tags) {
        if (!alert.tags.includes(tag)) {
          alert.tags.push(tag);
        }
      }
      
      alert.updatedAt = new Date();
      
      // Save the updated alert
      this.trackedAlerts.set(alertId, alert);
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to add tags to alert: ${alertId}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error instanceof Error ? error.message : String(error) }
      });
      
      return false;
    }
  }
  
  /**
   * Handle a new alert from the system monitor
   * 
   * @param alert - The alert event
   */
  private handleNewAlert(alert: AlertEvent): void {
    try {
      // Create a tracked alert
      const trackedAlert: TrackedAlert = {
        event: alert,
        status: AlertStatus.TRIGGERED,
        createdAt: new Date(),
        updatedAt: new Date(),
        escalationLevel: 1,
        notifiedChannels: [],
        tags: []
      };
      
      // Set default tags based on severity
      switch (alert.severity) {
        case AlertSeverity.CRITICAL:
          trackedAlert.tags.push('critical');
          break;
        case AlertSeverity.ERROR:
          trackedAlert.tags.push('error');
          break;
        case AlertSeverity.WARNING:
          trackedAlert.tags.push('warning');
          break;
        case AlertSeverity.INFO:
          trackedAlert.tags.push('info');
          break;
      }
      
      // Save the alert
      this.trackedAlerts.set(alert.id, trackedAlert);
      
      // Perform initial notification based on escalation policy
      this.performEscalation(alert.id, 1);
      
      // Emit event
      this.emit('newAlert', trackedAlert);
      
      // Log the new alert
      zkErrorLogger.log('INFO', `New alert tracked: ${alert.id}`, {
        category: 'monitoring',
        userFixable: false,
        recoverable: true,
        details: { 
          alertId: alert.id,
          severity: alert.severity,
          metricName: alert.metricName
        }
      });
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to handle new alert: ${alert.id}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error instanceof Error ? error.message : String(error) }
      });
    }
  }
  
  /**
   * Handle a resolved alert from the system monitor
   * 
   * @param alert - The resolved alert event
   */
  private handleResolvedAlert(alert: AlertEvent): void {
    try {
      // Check if we're tracking this alert
      if (!this.trackedAlerts.has(alert.id)) {
        return;
      }
      
      const trackedAlert = this.trackedAlerts.get(alert.id)!;
      
      // Mark as resolved
      trackedAlert.status = AlertStatus.RESOLVED;
      trackedAlert.resolution = {
        alertEventId: alert.id,
        timestamp: new Date(),
        timeToResolve: Date.now() - trackedAlert.createdAt.getTime(),
        automatic: true
      };
      
      trackedAlert.updatedAt = new Date();
      
      // Move to history
      this.alertHistory.push(trackedAlert);
      
      // Remove from active alerts
      this.trackedAlerts.delete(alert.id);
      
      // Emit event
      this.emit('alertResolved', trackedAlert);
      
      // Log the resolution
      zkErrorLogger.log('INFO', `Alert automatically resolved: ${alert.id}`, {
        category: 'monitoring',
        userFixable: false,
        recoverable: true,
        details: { 
          alertId: alert.id,
          timeToResolve: trackedAlert.resolution.timeToResolve
        }
      });
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to handle resolved alert: ${alert.id}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error instanceof Error ? error.message : String(error) }
      });
    }
  }
  
  /**
   * Check for alerts that need escalation
   */
  private checkEscalations(): void {
    const now = Date.now();
    
    for (const [alertId, alert] of this.trackedAlerts.entries()) {
      // Skip resolved or acknowledged alerts
      if (alert.status === AlertStatus.RESOLVED || 
          alert.status === AlertStatus.ACKNOWLEDGED) {
        continue;
      }
      
      // Check if it's time to escalate
      if (alert.nextEscalationTime && now >= alert.nextEscalationTime.getTime()) {
        try {
          // Escalate the alert
          const nextLevel = alert.escalationLevel + 1;
          this.performEscalation(alertId, nextLevel);
          
          // Update alert status
          alert.status = AlertStatus.ESCALATED;
          alert.updatedAt = new Date();
          this.trackedAlerts.set(alertId, alert);
          
          // Emit event
          this.emit('alertEscalated', alert);
          
          // Log the escalation
          zkErrorLogger.log('INFO', `Alert escalated: ${alertId} to level ${nextLevel}`, {
            category: 'monitoring',
            userFixable: false,
            recoverable: true,
            details: { 
              alertId,
              escalationLevel: nextLevel,
              timeSinceCreation: now - alert.createdAt.getTime()
            }
          });
        } catch (error) {
          zkErrorLogger.log('ERROR', `Failed to escalate alert: ${alertId}`, {
            category: 'monitoring',
            userFixable: true,
            recoverable: true,
            details: { error: error instanceof Error ? error.message : String(error) }
          });
        }
      }
    }
    
    // Clean up old alerts from history
    this.cleanupHistory();
  }
  
  /**
   * Perform escalation for an alert
   * 
   * @param alertId - The ID of the alert to escalate
   * @param level - The escalation level
   */
  private performEscalation(alertId: string, level: number): void {
    // Check if alert exists
    if (!this.trackedAlerts.has(alertId)) {
      return;
    }
    
    const alert = this.trackedAlerts.get(alertId)!;
    
    // Get the escalation policy to use (default if none specified)
    const policyId = this.defaultEscalationPolicyId;
    if (!policyId || !this.escalationPolicies.has(policyId)) {
      zkErrorLogger.log('WARNING', 'No escalation policy available', {
        category: 'monitoring',
        userFixable: true,
        recoverable: true
      });
      return;
    }
    
    const policy = this.escalationPolicies.get(policyId)!;
    
    // Find the escalation stage for this level
    let stage: EscalationStage | null = null;
    
    if (level <= policy.stages.length) {
      stage = policy.stages.find(s => s.level === level) || null;
    } else if (policy.repeatFinalStage) {
      // Use the final stage if we've gone beyond the defined stages
      stage = policy.stages[policy.stages.length - 1];
    }
    
    if (!stage) {
      zkErrorLogger.log('WARNING', `No escalation stage found for level ${level}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true
      });
      return;
    }
    
    // Update the alert's escalation level
    alert.escalationLevel = level;
    
    // Set the next escalation time
    if (level < policy.stages.length || policy.repeatFinalStage) {
      alert.nextEscalationTime = new Date(Date.now() + stage.delayMinutes * 60 * 1000);
    } else {
      alert.nextEscalationTime = undefined;
    }
    
    // Determine which channels to notify
    let channelsToNotify: string[] = stage.notificationChannels;
    
    // If notifyAll is true, include all channels from previous stages
    if (stage.notifyAll) {
      for (let i = 0; i < level - 1; i++) {
        if (i < policy.stages.length) {
          channelsToNotify = [...channelsToNotify, ...policy.stages[i].notificationChannels];
        }
      }
      // Remove duplicates
      channelsToNotify = [...new Set(channelsToNotify)];
    }
    
    // Record which channels were notified
    alert.notifiedChannels = [...alert.notifiedChannels, ...channelsToNotify];
    alert.notifiedChannels = [...new Set(alert.notifiedChannels)]; // Remove duplicates
    
    // Update the alert
    this.trackedAlerts.set(alertId, alert);
    
    // Log the notification
    zkErrorLogger.log('INFO', `Alert notification sent: ${alertId} (level ${level})`, {
      category: 'monitoring',
      userFixable: false,
      recoverable: true,
      details: { 
        alertId,
        escalationLevel: level,
        channels: channelsToNotify
      }
    });
  }
  
  /**
   * Clean up old alerts from history
   */
  private cleanupHistory(): void {
    const cutoffTime = new Date(Date.now() - this.historyRetentionDays * 24 * 60 * 60 * 1000);
    
    this.alertHistory = this.alertHistory.filter(alert => 
      alert.createdAt >= cutoffTime
    );
  }
  
  /**
   * Shutdown the alert manager
   */
  public shutdown(): void {
    // Stop the escalation interval
    if (this.escalationInterval) {
      clearInterval(this.escalationInterval);
      this.escalationInterval = null;
    }
    
    // Log shutdown
    zkErrorLogger.log('INFO', 'AlertManager shutdown', {
      category: 'monitoring',
      userFixable: false,
      recoverable: true
    });
  }
}

// Create singleton instance
export const alertManager = new AlertManager();

// Export default for CommonJS compatibility
export default alertManager;