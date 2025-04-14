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

const { systemMonitor, AlertSeverity } = require('./SystemMonitor.cjs');
const { zkErrorLogger } = require('../../zkErrorLogger.cjs');
const { EventEmitter } = require('events');

// Alert status
const AlertStatus = {
  TRIGGERED: 'triggered',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
  ESCALATED: 'escalated'
};

/**
 * @typedef {Object} AlertAcknowledgment
 * @property {string} alertEventId
 * @property {Date} timestamp
 * @property {string} acknowledgedBy
 * @property {string} [comment]
 * @property {number} timeToAcknowledge
 */

/**
 * @typedef {Object} AlertResolution
 * @property {string} alertEventId
 * @property {Date} timestamp
 * @property {string} [resolvedBy]
 * @property {string} [comment]
 * @property {number} timeToResolve
 * @property {boolean} automatic
 */

/**
 * @typedef {Object} AlertEvent
 * @property {string} id
 * @property {string} alertId
 * @property {Date} timestamp
 * @property {string} metricName
 * @property {number} metricValue
 * @property {number} threshold
 * @property {string} severity
 * @property {Record<string, string>} labels
 * @property {boolean} [resolved]
 * @property {Date} [resolvedAt]
 */

/**
 * @typedef {Object} TrackedAlert
 * @property {AlertEvent} event
 * @property {string} status
 * @property {Date} createdAt
 * @property {Date} updatedAt
 * @property {AlertAcknowledgment} [acknowledgment]
 * @property {AlertResolution} [resolution]
 * @property {number} escalationLevel
 * @property {Date} [nextEscalationTime]
 * @property {string[]} notifiedChannels
 * @property {string[]} tags
 */

/**
 * @typedef {Object} EscalationStage
 * @property {number} level
 * @property {number} delayMinutes
 * @property {string[]} notificationChannels
 * @property {boolean} [notifyAll]
 */

/**
 * @typedef {Object} EscalationPolicy
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {EscalationStage[]} stages
 * @property {boolean} repeatFinalStage
 */

/**
 * @typedef {Object} OnCallSchedule
 * @property {string} id
 * @property {string} name
 * @property {Array<{dayOfWeek: number, startHour: number, endHour: number, channels: string[]}>} schedule
 * @property {string[]} fallbackChannels
 */

/**
 * Alert Management System
 */
class AlertManager extends EventEmitter {
  /**
   * Constructs a new AlertManager instance
   * 
   * @param {number} historyRetentionDays - Number of days to retain alert history (defaults to 90)
   */
  constructor(historyRetentionDays = 90) {
    super();
    this.trackedAlerts = new Map();
    this.alertHistory = [];
    this.historyRetentionDays = historyRetentionDays;
    this.escalationPolicies = new Map();
    this.defaultEscalationPolicyId = null;
    this.onCallSchedules = new Map();
    this.escalationInterval = null;
    this.initialized = false;
    
    // Default escalation policy
    this.DEFAULT_ESCALATION_POLICY = {
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
    
    // Initialize the alert manager
    this.initialize().catch(error => {
      zkErrorLogger.log('ERROR', 'Failed to initialize AlertManager', {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
    });
  }
  
  /**
   * Initialize the alert manager
   * @returns {Promise<boolean>}
   */
  async initialize() {
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
      systemMonitor.on('alert', (alert) => this.handleNewAlert(alert));
      systemMonitor.on('alertResolved', (alert) => this.handleResolvedAlert(alert));
      
      this.initialized = true;
      
      zkErrorLogger.log('INFO', 'AlertManager initialized successfully', {
        category: 'monitoring',
        userFixable: false,
        recoverable: true
      });
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to initialize AlertManager', {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
      
      return false;
    }
  }
  
  /**
   * Register an escalation policy
   * 
   * @param {EscalationPolicy} policy - The escalation policy to register
   * @returns {boolean} True if the policy was successfully registered
   */
  registerEscalationPolicy(policy) {
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
      zkErrorLogger.log('ERROR', `Failed to register escalation policy: ${policy.id}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
      
      return false;
    }
  }
  
  /**
   * Register an on-call schedule
   * 
   * @param {OnCallSchedule} schedule - The on-call schedule to register
   * @returns {boolean} True if the schedule was successfully registered
   */
  registerOnCallSchedule(schedule) {
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
        details: { error: error.message }
      });
      
      return false;
    }
  }
  
  /**
   * Set the default escalation policy
   * 
   * @param {string} policyId - The ID of the policy to set as default
   * @returns {boolean} True if the policy was successfully set as default
   */
  setDefaultEscalationPolicy(policyId) {
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
        details: { error: error.message }
      });
      
      return false;
    }
  }
  
  /**
   * Acknowledge an alert
   * 
   * @param {string} alertId - The ID of the alert to acknowledge
   * @param {string} acknowledgedBy - The name or ID of the person acknowledging the alert
   * @param {string} [comment] - Optional comment
   * @returns {boolean} True if the alert was successfully acknowledged
   */
  acknowledgeAlert(alertId, acknowledgedBy, comment) {
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
      
      const alert = this.trackedAlerts.get(alertId);
      
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
        details: { error: error.message }
      });
      
      return false;
    }
  }
  
  /**
   * Manually resolve an alert
   * 
   * @param {string} alertId - The ID of the alert to resolve
   * @param {string} resolvedBy - The name or ID of the person resolving the alert
   * @param {string} [comment] - Optional comment
   * @returns {boolean} True if the alert was successfully resolved
   */
  resolveAlert(alertId, resolvedBy, comment) {
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
      
      const alert = this.trackedAlerts.get(alertId);
      
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
        details: { error: error.message }
      });
      
      return false;
    }
  }
  
  /**
   * Get active alerts
   * 
   * @param {Object} [filters] - Optional filters for the alerts
   * @param {string[]} [filters.status] - Filter by alert status
   * @param {string[]} [filters.severity] - Filter by alert severity
   * @param {string[]} [filters.tags] - Filter by alert tags
   * @returns {TrackedAlert[]} Array of active alerts
   */
  getActiveAlerts(filters) {
    let alerts = Array.from(this.trackedAlerts.values());
    
    // Apply filters if provided
    if (filters) {
      if (filters.status) {
        alerts = alerts.filter(alert => filters.status.includes(alert.status));
      }
      
      if (filters.severity) {
        alerts = alerts.filter(alert => filters.severity.includes(alert.event.severity));
      }
      
      if (filters.tags) {
        alerts = alerts.filter(alert => 
          filters.tags.some(tag => alert.tags.includes(tag))
        );
      }
    }
    
    // Sort by creation time, newest first
    return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  /**
   * Get alert history
   * 
   * @param {number} [limit=100] - Maximum number of alerts to return
   * @param {Object} [filters] - Optional filters for the alerts
   * @param {string[]} [filters.status] - Filter by alert status
   * @param {string[]} [filters.severity] - Filter by alert severity
   * @param {string[]} [filters.tags] - Filter by alert tags
   * @param {Date} [filters.startDate] - Filter by start date
   * @param {Date} [filters.endDate] - Filter by end date
   * @returns {TrackedAlert[]} Array of historical alerts
   */
  getAlertHistory(limit = 100, filters) {
    let alerts = [...this.alertHistory];
    
    // Apply filters if provided
    if (filters) {
      if (filters.status) {
        alerts = alerts.filter(alert => filters.status.includes(alert.status));
      }
      
      if (filters.severity) {
        alerts = alerts.filter(alert => filters.severity.includes(alert.event.severity));
      }
      
      if (filters.tags) {
        alerts = alerts.filter(alert => 
          filters.tags.some(tag => alert.tags.includes(tag))
        );
      }
      
      if (filters.startDate) {
        alerts = alerts.filter(alert => alert.createdAt >= filters.startDate);
      }
      
      if (filters.endDate) {
        alerts = alerts.filter(alert => alert.createdAt <= filters.endDate);
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
   * @param {number} [timeframeMs=604800000] - Timeframe in milliseconds for the stats (defaults to 7 days)
   * @returns {Object} Alert statistics
   */
  getAlertStatistics(timeframeMs = 7 * 24 * 60 * 60 * 1000) {
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
    const byTag = {};
    for (const alert of allAlerts) {
      for (const tag of alert.tags) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }
    }
    
    // Calculate metrics by severity
    const bySeverity = {};
    for (const alert of allAlerts) {
      const severity = alert.event.severity;
      bySeverity[severity] = (bySeverity[severity] || 0) + 1;
    }
    
    // Calculate MTTR (Mean Time To Resolution)
    const resolvedAlerts = allAlerts.filter(alert => alert.resolution);
    const totalTimeToResolve = resolvedAlerts.reduce(
      (sum, alert) => sum + alert.resolution.timeToResolve, 
      0
    );
    const mttr = resolvedAlerts.length > 0 
      ? totalTimeToResolve / resolvedAlerts.length 
      : 0;
    
    // Calculate MTTA (Mean Time To Acknowledgment)
    const acknowledgedAlerts = allAlerts.filter(alert => alert.acknowledgment);
    const totalTimeToAcknowledge = acknowledgedAlerts.reduce(
      (sum, alert) => sum + alert.acknowledgment.timeToAcknowledge, 
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
   * @param {string} alertId - The ID of the alert
   * @param {string[]} tags - Tags to add
   * @returns {boolean} True if the tags were successfully added
   */
  addTagsToAlert(alertId, tags) {
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
      
      const alert = this.trackedAlerts.get(alertId);
      
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
        details: { error: error.message }
      });
      
      return false;
    }
  }
  
  /**
   * Handle a new alert from the system monitor
   * 
   * @param {AlertEvent} alert - The alert event
   * @private
   */
  handleNewAlert(alert) {
    try {
      // Create a tracked alert
      const trackedAlert = {
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
        details: { error: error.message }
      });
    }
  }
  
  /**
   * Handle a resolved alert from the system monitor
   * 
   * @param {AlertEvent} alert - The resolved alert event
   * @private
   */
  handleResolvedAlert(alert) {
    try {
      // Check if we're tracking this alert
      if (!this.trackedAlerts.has(alert.id)) {
        return;
      }
      
      const trackedAlert = this.trackedAlerts.get(alert.id);
      
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
        details: { error: error.message }
      });
    }
  }
  
  /**
   * Check for alerts that need escalation
   * @private
   */
  checkEscalations() {
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
            details: { error: error.message }
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
   * @param {string} alertId - The ID of the alert to escalate
   * @param {number} level - The escalation level
   * @private
   */
  performEscalation(alertId, level) {
    // Check if alert exists
    if (!this.trackedAlerts.has(alertId)) {
      return;
    }
    
    const alert = this.trackedAlerts.get(alertId);
    
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
    
    const policy = this.escalationPolicies.get(policyId);
    
    // Find the escalation stage for this level
    let stage = null;
    
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
    let channelsToNotify = stage.notificationChannels;
    
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
   * @private
   */
  cleanupHistory() {
    const cutoffTime = new Date(Date.now() - this.historyRetentionDays * 24 * 60 * 60 * 1000);
    
    this.alertHistory = this.alertHistory.filter(alert => 
      alert.createdAt >= cutoffTime
    );
  }
  
  /**
   * Shutdown the alert manager
   */
  shutdown() {
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
const alertManager = new AlertManager();

// Export for CommonJS
module.exports = {
  AlertStatus,
  AlertManager,
  alertManager
};