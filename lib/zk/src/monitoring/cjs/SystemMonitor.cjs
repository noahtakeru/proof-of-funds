/**
 * System Monitoring Service
 * 
 * Comprehensive monitoring system for tracking application health, performance metrics,
 * and critical events with alerting capabilities.
 * 
 * Key features:
 * - Real-time performance metrics collection
 * - Threshold-based alerting
 * - Resource usage tracking
 * - Integration with admin dashboard
 * - Time-series metrics storage
 * - Integration with GCP monitoring
 */

const { bigQueryAnalytics } = require('../../analytics/cjs/BigQueryAnalytics.cjs');
const { zkErrorLogger } = require('../../zkErrorLogger.cjs');
const { EventEmitter } = require('events');

// Metric types
const MetricType = {
  COUNTER: 'counter',  // Values that only increase (e.g., request count)
  GAUGE: 'gauge',      // Values that can go up and down (e.g., memory usage)
  HISTOGRAM: 'histogram', // Distribution of values in buckets
  SUMMARY: 'summary'   // Statistical summary (min, max, avg, percentiles)
};

// Alert severity levels
const AlertSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * @typedef {Object} MetricDataPoint
 * @property {Date} timestamp
 * @property {number} value
 * @property {Record<string, string>} labels
 */

/**
 * @typedef {Object} MetricDefinition
 * @property {string} name
 * @property {string} type
 * @property {string} description
 * @property {string} [unit]
 * @property {string[]} [labels]
 * @property {number} [interval]
 * @property {number} [aggregationPeriod]
 */

/**
 * @typedef {Object} AlertDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} metricName
 * @property {Object} condition
 * @property {string} condition.operator
 * @property {number} condition.threshold
 * @property {number} [condition.duration]
 * @property {string} severity
 * @property {Record<string, string>} [labels]
 * @property {string[]} [notificationChannels]
 * @property {number} [cooldownPeriod]
 * @property {boolean} enabled
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
 * @typedef {Object} NotificationChannel
 * @property {string} id
 * @property {string} name
 * @property {'email'|'webhook'|'sms'|'slack'|'pagerduty'} type
 * @property {Record<string, any>} configuration
 * @property {boolean} enabled
 */

/**
 * System Monitoring Service
 */
class SystemMonitor extends EventEmitter {
  /**
   * Constructs a new SystemMonitor instance
   * 
   * @param {number} retentionPeriodMs - Time in ms to retain metric data (defaults to 7 days)
   */
  constructor(retentionPeriodMs = 7 * 24 * 60 * 60 * 1000) {
    super();
    this.metrics = new Map();
    this.metricData = new Map();
    this.alerts = new Map();
    this.activeAlerts = new Map();
    this.notificationChannels = new Map();
    this.collectionIntervals = new Map();
    this.evaluationInterval = null;
    this.initialized = false;
    this.retentionPeriodMs = retentionPeriodMs;
    this.systemInfo = {};
    
    // Default metrics
    this.DEFAULT_METRICS = [
      {
        name: 'system.cpu.usage',
        type: MetricType.GAUGE,
        description: 'CPU usage percentage',
        unit: '%',
        interval: 30000, // 30 seconds
      },
      {
        name: 'system.memory.usage',
        type: MetricType.GAUGE,
        description: 'Memory usage percentage',
        unit: '%',
        interval: 30000,
      },
      {
        name: 'app.requests.total',
        type: MetricType.COUNTER,
        description: 'Total number of requests',
        interval: 60000, // 1 minute
      },
      {
        name: 'app.errors.total',
        type: MetricType.COUNTER,
        description: 'Total number of errors',
        interval: 60000,
      },
      {
        name: 'app.latency',
        type: MetricType.HISTOGRAM,
        description: 'Request latency in milliseconds',
        unit: 'ms',
        interval: 60000,
      },
      {
        name: 'proof.generation.count',
        type: MetricType.COUNTER,
        description: 'Number of proofs generated',
        labels: ['proof_type', 'network'],
        interval: 60000,
      },
      {
        name: 'proof.verification.count',
        type: MetricType.COUNTER,
        description: 'Number of proofs verified',
        labels: ['proof_type', 'network', 'result'],
        interval: 60000,
      },
      {
        name: 'proof.generation.duration',
        type: MetricType.HISTOGRAM,
        description: 'Proof generation duration in milliseconds',
        unit: 'ms',
        labels: ['proof_type', 'network'],
        interval: 60000,
      }
    ];
    
    // Default alerts
    this.DEFAULT_ALERTS = [
      {
        id: 'high_cpu_usage',
        name: 'High CPU Usage',
        description: 'CPU usage is above 85% for more than 5 minutes',
        metricName: 'system.cpu.usage',
        condition: {
          operator: '>',
          threshold: 85,
          duration: 300000, // 5 minutes
        },
        severity: AlertSeverity.WARNING,
        cooldownPeriod: 1800000, // 30 minutes
        enabled: true,
      },
      {
        id: 'critical_memory_usage',
        name: 'Critical Memory Usage',
        description: 'Memory usage is above 90% for more than 3 minutes',
        metricName: 'system.memory.usage',
        condition: {
          operator: '>',
          threshold: 90,
          duration: 180000, // 3 minutes
        },
        severity: AlertSeverity.ERROR,
        cooldownPeriod: 900000, // 15 minutes
        enabled: true,
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'Error rate is above 5% of total requests for more than 2 minutes',
        metricName: 'app.errors.total',
        condition: {
          operator: '>',
          threshold: 5, // 5% (this is special case, calculated as percentage)
          duration: 120000, // 2 minutes
        },
        severity: AlertSeverity.ERROR,
        cooldownPeriod: 600000, // 10 minutes
        enabled: true,
      },
      {
        id: 'slow_response_time',
        name: 'Slow Response Time',
        description: 'Median response time is above 1000ms for more than 5 minutes',
        metricName: 'app.latency',
        condition: {
          operator: '>',
          threshold: 1000,
          duration: 300000, // 5 minutes
        },
        severity: AlertSeverity.WARNING,
        cooldownPeriod: 1800000, // 30 minutes
        enabled: true,
      },
      {
        id: 'proof_failure_rate_high',
        name: 'High Proof Failure Rate',
        description: 'Proof verification failure rate is above 10% for more than 5 minutes',
        metricName: 'proof.verification.count',
        condition: {
          operator: '>',
          threshold: 10, // 10% (calculated as percentage)
          duration: 300000, // 5 minutes
        },
        severity: AlertSeverity.WARNING,
        labels: { result: 'failure' },
        cooldownPeriod: 1800000, // 30 minutes
        enabled: true,
      }
    ];
    
    // Initialize the monitoring system
    this.initialize().catch(error => {
      zkErrorLogger.log('ERROR', 'Failed to initialize SystemMonitor', {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
    });
  }
  
  /**
   * Initialize the monitoring system
   * @returns {Promise<boolean>}
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }
    
    try {
      // Register default metrics
      for (const metric of this.DEFAULT_METRICS) {
        this.registerMetric(metric);
      }
      
      // Register default alerts
      for (const alert of this.DEFAULT_ALERTS) {
        this.registerAlert(alert);
      }
      
      // Setup default notification channels
      this.registerNotificationChannel({
        id: 'default_email',
        name: 'Default Email Notifications',
        type: 'email',
        configuration: {
          recipients: [process.env.ALERT_EMAIL || 'admin@example.com']
        },
        enabled: true
      });
      
      // Start metrics collection
      this.startMetricsCollection();
      
      // Start alert evaluation
      this.startAlertEvaluation();
      
      // Collect system information
      await this.collectSystemInfo();
      
      this.initialized = true;
      
      zkErrorLogger.log('INFO', 'SystemMonitor initialized successfully', {
        category: 'monitoring',
        userFixable: false,
        recoverable: true
      });
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to initialize SystemMonitor', {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
      
      return false;
    }
  }
  
  /**
   * Register a new metric
   * 
   * @param {MetricDefinition} metric - The metric definition
   * @returns {boolean} True if the metric was registered successfully
   */
  registerMetric(metric) {
    try {
      // Check if metric with this name already exists
      if (this.metrics.has(metric.name)) {
        zkErrorLogger.log('WARNING', `Metric already exists: ${metric.name}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      // Store the metric definition
      this.metrics.set(metric.name, metric);
      
      // Initialize the metric data array
      this.metricData.set(metric.name, []);
      
      // Start collection interval if specified
      if (metric.interval) {
        this.startMetricCollection(metric.name);
      }
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to register metric: ${metric.name}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
      
      return false;
    }
  }
  
  /**
   * Record a value for a metric
   * 
   * @param {string} metricName - The name of the metric
   * @param {number} value - The value to record
   * @param {Record<string, string>} [labels={}] - Optional labels for the data point
   * @returns {boolean} True if the value was recorded successfully
   */
  recordMetric(metricName, value, labels = {}) {
    try {
      // Check if metric exists
      if (!this.metrics.has(metricName)) {
        zkErrorLogger.log('WARNING', `Metric does not exist: ${metricName}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      const metric = this.metrics.get(metricName);
      const timestamp = new Date();
      
      // For counter metrics, only allow positive increments
      if (metric.type === MetricType.COUNTER && value < 0) {
        zkErrorLogger.log('WARNING', `Cannot decrement counter metric: ${metricName}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      // Get the data array for this metric
      const data = this.metricData.get(metricName);
      
      // Add the data point
      data.push({
        timestamp,
        value,
        labels
      });
      
      // Emit event for metric update
      this.emit('metric', {
        name: metricName,
        value,
        timestamp,
        labels
      });
      
      // Send to BigQuery if enabled
      if (process.env.ENABLE_ANALYTICS === 'true') {
        const metricObj = {};
        metricObj[metricName.split('.').pop() || metricName] = value;
        
        bigQueryAnalytics.trackSystemMetrics(metricObj).catch(error => {
          zkErrorLogger.log('ERROR', `Failed to send metric to BigQuery: ${metricName}`, {
            category: 'monitoring',
            userFixable: false,
            recoverable: true,
            details: { error: error.message }
          });
        });
      }
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to record metric: ${metricName}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
      
      return false;
    }
  }
  
  /**
   * Register a new alert
   * 
   * @param {AlertDefinition} alert - The alert definition
   * @returns {boolean} True if the alert was registered successfully
   */
  registerAlert(alert) {
    try {
      // Check if alert with this ID already exists
      if (this.alerts.has(alert.id)) {
        zkErrorLogger.log('WARNING', `Alert already exists: ${alert.id}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      // Check if referenced metric exists
      if (!this.metrics.has(alert.metricName)) {
        zkErrorLogger.log('WARNING', `Alert references non-existent metric: ${alert.metricName}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      // Store the alert definition
      this.alerts.set(alert.id, alert);
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to register alert: ${alert.id}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
      
      return false;
    }
  }
  
  /**
   * Register a new notification channel
   * 
   * @param {NotificationChannel} channel - The notification channel definition
   * @returns {boolean} True if the channel was registered successfully
   */
  registerNotificationChannel(channel) {
    try {
      // Check if channel with this ID already exists
      if (this.notificationChannels.has(channel.id)) {
        zkErrorLogger.log('WARNING', `Notification channel already exists: ${channel.id}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      // Store the channel definition
      this.notificationChannels.set(channel.id, channel);
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to register notification channel: ${channel.id}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
      
      return false;
    }
  }
  
  /**
   * Get metric data for a specific metric
   * 
   * @param {string} metricName - The name of the metric
   * @param {number} [timeframeMs=3600000] - How far back to get data (in ms)
   * @param {'avg'|'sum'|'min'|'max'} [aggregation] - Optional aggregation function
   * @param {Record<string, string>} [labelFilters] - Optional label filters
   * @returns {MetricDataPoint[]|null} The metric data points or null if an error occurred
   */
  getMetricData(metricName, timeframeMs = 3600000, aggregation, labelFilters) {
    try {
      // Check if metric exists
      if (!this.metrics.has(metricName)) {
        zkErrorLogger.log('WARNING', `Metric does not exist: ${metricName}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return null;
      }
      
      // Get the data array for this metric
      const data = this.metricData.get(metricName);
      
      // Filter by timeframe
      const cutoffTime = new Date(Date.now() - timeframeMs);
      let filteredData = data.filter(point => point.timestamp >= cutoffTime);
      
      // Filter by labels if provided
      if (labelFilters) {
        filteredData = filteredData.filter(point => {
          return Object.entries(labelFilters).every(([key, value]) => 
            point.labels[key] === value
          );
        });
      }
      
      // Apply aggregation if specified
      if (aggregation && filteredData.length > 0) {
        // Group by minute for aggregation
        const groupedByMinute = new Map();
        
        for (const point of filteredData) {
          const minute = Math.floor(point.timestamp.getTime() / 60000);
          if (!groupedByMinute.has(minute)) {
            groupedByMinute.set(minute, []);
          }
          groupedByMinute.get(minute).push(point.value);
        }
        
        // Apply aggregation function to each group
        const aggregatedData = [];
        
        for (const [minute, values] of groupedByMinute.entries()) {
          let aggregatedValue;
          
          switch (aggregation) {
            case 'avg':
              aggregatedValue = values.reduce((sum, val) => sum + val, 0) / values.length;
              break;
            case 'sum':
              aggregatedValue = values.reduce((sum, val) => sum + val, 0);
              break;
            case 'min':
              aggregatedValue = Math.min(...values);
              break;
            case 'max':
              aggregatedValue = Math.max(...values);
              break;
          }
          
          aggregatedData.push({
            timestamp: new Date(minute * 60000),
            value: aggregatedValue,
            labels: {} // Aggregated data doesn't preserve labels
          });
        }
        
        return aggregatedData.sort((a, b) => 
          a.timestamp.getTime() - b.timestamp.getTime()
        );
      }
      
      return filteredData.sort((a, b) => 
        a.timestamp.getTime() - b.timestamp.getTime()
      );
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to get metric data: ${metricName}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
      
      return null;
    }
  }
  
  /**
   * Get all active alerts
   * 
   * @returns {AlertEvent[]} Array of active alert events
   */
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }
  
  /**
   * Get a specific metric's current value
   * 
   * @param {string} metricName - The name of the metric
   * @param {Record<string, string>} [labelFilters] - Optional label filters
   * @returns {number|null} The current value or null if not available
   */
  getCurrentMetricValue(metricName, labelFilters) {
    try {
      const data = this.getMetricData(metricName, 300000, undefined, labelFilters);
      
      if (!data || data.length === 0) {
        return null;
      }
      
      // Get the most recent value
      return data[data.length - 1].value;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Get system information
   * 
   * @returns {Record<string, any>} System information
   */
  getSystemInfo() {
    return { ...this.systemInfo };
  }
  
  /**
   * Start collection for all metrics
   * @private
   */
  startMetricsCollection() {
    // Clear any existing intervals
    this.stopMetricsCollection();
    
    // Start collection for each metric
    for (const [metricName, metric] of this.metrics.entries()) {
      if (metric.interval) {
        this.startMetricCollection(metricName);
      }
    }
    
    // Clean up old data on a schedule
    setInterval(() => this.cleanupOldData(), 3600000); // Every hour
  }
  
  /**
   * Start collection for a specific metric
   * 
   * @param {string} metricName - The name of the metric to collect
   * @private
   */
  startMetricCollection(metricName) {
    // Clear existing interval if any
    if (this.collectionIntervals.has(metricName)) {
      clearInterval(this.collectionIntervals.get(metricName));
    }
    
    const metric = this.metrics.get(metricName);
    
    // Create new interval
    const interval = setInterval(async () => {
      try {
        // Collect different metrics based on name
        switch (metricName) {
          case 'system.cpu.usage':
            this.recordMetric(metricName, await this.getCpuUsage());
            break;
            
          case 'system.memory.usage':
            this.recordMetric(metricName, await this.getMemoryUsage());
            break;
            
          // Other metrics are recorded externally when events occur
        }
      } catch (error) {
        zkErrorLogger.log('ERROR', `Failed to collect metric: ${metricName}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true,
          details: { error: error.message }
        });
      }
    }, metric.interval);
    
    // Store the interval
    this.collectionIntervals.set(metricName, interval);
  }
  
  /**
   * Stop collection for all metrics
   * @private
   */
  stopMetricsCollection() {
    // Clear all intervals
    for (const interval of this.collectionIntervals.values()) {
      clearInterval(interval);
    }
    
    this.collectionIntervals.clear();
    
    // Clear evaluation interval
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }
  }
  
  /**
   * Start alert evaluation
   * @private
   */
  startAlertEvaluation() {
    // Clear existing interval if any
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }
    
    // Create new interval (evaluate every 30 seconds)
    this.evaluationInterval = setInterval(() => {
      this.evaluateAlerts();
    }, 30000);
  }
  
  /**
   * Evaluate all alerts
   * @private
   */
  evaluateAlerts() {
    for (const alert of this.alerts.values()) {
      // Skip disabled alerts
      if (!alert.enabled) {
        continue;
      }
      
      try {
        this.evaluateAlert(alert);
      } catch (error) {
        zkErrorLogger.log('ERROR', `Failed to evaluate alert: ${alert.id}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true,
          details: { error: error.message }
        });
      }
    }
  }
  
  /**
   * Evaluate a specific alert
   * 
   * @param {AlertDefinition} alert - The alert to evaluate
   * @private
   */
  evaluateAlert(alert) {
    const metric = this.metrics.get(alert.metricName);
    if (!metric) {
      return;
    }
    
    // Get recent data for this metric
    const duration = alert.condition.duration || 300000; // Default to 5 minutes
    const data = this.getMetricData(alert.metricName, duration, undefined, alert.labels);
    
    if (!data || data.length === 0) {
      return;
    }
    
    // Calculate the value to compare (depends on the metric type)
    let valueToCompare;
    
    switch (metric.type) {
      case MetricType.COUNTER:
        // For counters, use the sum of values in the period
        valueToCompare = data.reduce((sum, point) => sum + point.value, 0);
        break;
        
      case MetricType.GAUGE:
        // For gauges, use the average of recent values
        valueToCompare = data.reduce((sum, point) => sum + point.value, 0) / data.length;
        break;
        
      case MetricType.HISTOGRAM:
      case MetricType.SUMMARY:
        // For histograms and summaries, use the median value
        const sortedValues = data.map(point => point.value).sort((a, b) => a - b);
        const midIndex = Math.floor(sortedValues.length / 2);
        valueToCompare = sortedValues.length % 2 === 0
          ? (sortedValues[midIndex - 1] + sortedValues[midIndex]) / 2
          : sortedValues[midIndex];
        break;
        
      default:
        // Default to the most recent value
        valueToCompare = data[data.length - 1].value;
    }
    
    // Special case for percentage-based alerts
    if (alert.id === 'high_error_rate' || alert.id === 'proof_failure_rate_high') {
      // Get total requests/proofs
      const totalMetricName = alert.id === 'high_error_rate' 
        ? 'app.requests.total' 
        : 'proof.verification.count';
      
      const totalData = this.getMetricData(totalMetricName, duration);
      
      if (totalData && totalData.length > 0) {
        const totalValue = totalData.reduce((sum, point) => sum + point.value, 0);
        if (totalValue > 0) {
          valueToCompare = (valueToCompare / totalValue) * 100; // Convert to percentage
        }
      }
    }
    
    // Check if condition is met
    let conditionMet = false;
    
    switch (alert.condition.operator) {
      case '>':
        conditionMet = valueToCompare > alert.condition.threshold;
        break;
      case '<':
        conditionMet = valueToCompare < alert.condition.threshold;
        break;
      case '>=':
        conditionMet = valueToCompare >= alert.condition.threshold;
        break;
      case '<=':
        conditionMet = valueToCompare <= alert.condition.threshold;
        break;
      case '==':
        conditionMet = valueToCompare === alert.condition.threshold;
        break;
      case '!=':
        conditionMet = valueToCompare !== alert.condition.threshold;
        break;
    }
    
    // Check if the alert is already active
    const isAlertActive = Array.from(this.activeAlerts.values())
      .some(a => a.alertId === alert.id && !a.resolved);
    
    if (conditionMet && !isAlertActive) {
      // Check cooldown period if the alert was recently triggered and resolved
      const recentAlerts = Array.from(this.activeAlerts.values())
        .filter(a => a.alertId === alert.id && a.resolved);
      
      if (recentAlerts.length > 0) {
        const mostRecentAlert = recentAlerts
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
        
        const timeSinceLastAlert = Date.now() - mostRecentAlert.timestamp.getTime();
        
        if (timeSinceLastAlert < (alert.cooldownPeriod || 0)) {
          // Still in cooldown period, don't trigger again
          return;
        }
      }
      
      // Generate alert ID
      const alertEventId = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Create alert event
      const alertEvent = {
        id: alertEventId,
        alertId: alert.id,
        timestamp: new Date(),
        metricName: alert.metricName,
        metricValue: valueToCompare,
        threshold: alert.condition.threshold,
        severity: alert.severity,
        labels: alert.labels || {},
      };
      
      // Store the alert
      this.activeAlerts.set(alertEventId, alertEvent);
      
      // Emit event
      this.emit('alert', alertEvent);
      
      // Send notifications
      this.sendAlertNotification(alertEvent);
      
      // Log the alert
      zkErrorLogger.log(alert.severity.toUpperCase(), alert.description, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { 
          alertId: alert.id,
          value: valueToCompare,
          threshold: alert.condition.threshold
        }
      });
    } 
    else if (!conditionMet && isAlertActive) {
      // Find the active alert and mark it as resolved
      const activeAlert = Array.from(this.activeAlerts.values())
        .find(a => a.alertId === alert.id && !a.resolved);
      
      if (activeAlert) {
        activeAlert.resolved = true;
        activeAlert.resolvedAt = new Date();
        
        // Emit resolution event
        this.emit('alertResolved', activeAlert);
        
        // Send resolution notification
        this.sendAlertResolutionNotification(activeAlert);
        
        // Log the resolution
        zkErrorLogger.log('INFO', `Alert resolved: ${alert.name}`, {
          category: 'monitoring',
          userFixable: false,
          recoverable: true,
          details: { 
            alertId: alert.id,
            duration: activeAlert.resolvedAt.getTime() - activeAlert.timestamp.getTime()
          }
        });
      }
    }
  }
  
  /**
   * Send notification for an alert
   * 
   * @param {AlertEvent} alert - The alert event
   * @private
   */
  sendAlertNotification(alert) {
    // Get the alert definition
    const alertDef = this.alerts.get(alert.alertId);
    if (!alertDef) {
      return;
    }
    
    // Get notification channels
    const channels = alertDef.notificationChannels || [];
    
    // If no channels specified, use all enabled channels
    const channelsToNotify = channels.length > 0
      ? channels.map(id => this.notificationChannels.get(id)).filter(Boolean)
      : Array.from(this.notificationChannels.values()).filter(channel => channel.enabled);
    
    // Send notification to each channel
    for (const channel of channelsToNotify) {
      try {
        this.sendNotification(channel, alert);
      } catch (error) {
        zkErrorLogger.log('ERROR', `Failed to send alert notification: ${channel.id}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true,
          details: { error: error.message }
        });
      }
    }
  }
  
  /**
   * Send resolution notification for an alert
   * 
   * @param {AlertEvent} alert - The resolved alert event
   * @private
   */
  sendAlertResolutionNotification(alert) {
    // Similar to sendAlertNotification but for resolutions
    const alertDef = this.alerts.get(alert.alertId);
    if (!alertDef) {
      return;
    }
    
    const channels = alertDef.notificationChannels || [];
    const channelsToNotify = channels.length > 0
      ? channels.map(id => this.notificationChannels.get(id)).filter(Boolean)
      : Array.from(this.notificationChannels.values()).filter(channel => channel.enabled);
    
    for (const channel of channelsToNotify) {
      try {
        this.sendResolutionNotification(channel, alert);
      } catch (error) {
        zkErrorLogger.log('ERROR', `Failed to send alert resolution notification: ${channel.id}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true,
          details: { error: error.message }
        });
      }
    }
  }
  
  /**
   * Send a notification to a specific channel
   * 
   * @param {NotificationChannel} channel - The notification channel
   * @param {AlertEvent} alert - The alert event
   * @private
   */
  async sendNotification(channel, alert) {
    const alertDef = this.alerts.get(alert.alertId);
    if (!alertDef) {
      return;
    }
    
    const subject = `[${alert.severity.toUpperCase()}] ${alertDef.name}`;
    const message = `
      Alert: ${alertDef.name}
      Severity: ${alert.severity.toUpperCase()}
      Time: ${alert.timestamp.toISOString()}
      Description: ${alertDef.description}
      Metric: ${alert.metricName}
      Value: ${alert.metricValue}
      Threshold: ${alert.threshold}
      Labels: ${JSON.stringify(alert.labels)}
    `;
    
    switch (channel.type) {
      case 'email':
        // In a real implementation, this would send an email
        console.log(`[EMAIL] To: ${channel.configuration.recipients.join(', ')}, Subject: ${subject}, Message: ${message}`);
        break;
        
      case 'webhook':
        // In a real implementation, this would send a webhook request
        try {
          // Just log for now, in a real implementation we would make an HTTP request
          console.log(`[WEBHOOK] URL: ${channel.configuration.url}, Payload: ${JSON.stringify({
            subject,
            message,
            alert
          })}`);
        } catch (error) {
          zkErrorLogger.log('ERROR', `Failed to send webhook: ${channel.id}`, {
            category: 'monitoring',
            userFixable: true,
            recoverable: true,
            details: { error: error.message }
          });
        }
        break;
        
      // Add other channel types as needed
    }
  }
  
  /**
   * Send a resolution notification to a specific channel
   * 
   * @param {NotificationChannel} channel - The notification channel
   * @param {AlertEvent} alert - The resolved alert event
   * @private
   */
  async sendResolutionNotification(channel, alert) {
    const alertDef = this.alerts.get(alert.alertId);
    if (!alertDef) {
      return;
    }
    
    const duration = alert.resolvedAt.getTime() - alert.timestamp.getTime();
    const durationMinutes = Math.round(duration / 60000);
    
    const subject = `[RESOLVED] ${alertDef.name}`;
    const message = `
      Alert Resolved: ${alertDef.name}
      Time: ${alert.resolvedAt.toISOString()}
      Duration: ${durationMinutes} minutes
      Previous Severity: ${alert.severity.toUpperCase()}
      Description: ${alertDef.description}
      Metric: ${alert.metricName}
    `;
    
    // Similar implementation to sendNotification
    switch (channel.type) {
      case 'email':
        console.log(`[EMAIL] To: ${channel.configuration.recipients.join(', ')}, Subject: ${subject}, Message: ${message}`);
        break;
        
      case 'webhook':
        console.log(`[WEBHOOK] URL: ${channel.configuration.url}, Payload: ${JSON.stringify({
          subject,
          message,
          alert
        })}`);
        break;
    }
  }
  
  /**
   * Clean up old metric data
   * @private
   */
  cleanupOldData() {
    const cutoffTime = new Date(Date.now() - this.retentionPeriodMs);
    
    // Clean up each metric's data
    for (const [metricName, data] of this.metricData.entries()) {
      this.metricData.set(
        metricName,
        data.filter(point => point.timestamp >= cutoffTime)
      );
    }
    
    // Clean up old resolved alerts
    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt < cutoffTime) {
        this.activeAlerts.delete(alertId);
      }
    }
  }
  
  /**
   * Get CPU usage percentage
   * 
   * @returns {Promise<number>} CPU usage percentage
   * @private
   */
  async getCpuUsage() {
    // In a real implementation, this would get CPU usage from the OS
    // For now, return a random value for demonstration
    return Math.random() * 100;
  }
  
  /**
   * Get memory usage percentage
   * 
   * @returns {Promise<number>} Memory usage percentage
   * @private
   */
  async getMemoryUsage() {
    // In a real implementation, this would get memory usage from the OS
    // For now, return a random value for demonstration
    return Math.random() * 100;
  }
  
  /**
   * Collect system information
   * @private
   */
  async collectSystemInfo() {
    // In a real implementation, this would collect system information
    this.systemInfo = {
      environment: process.env.NODE_ENV || 'development',
      platform: process.platform,
      nodeVersion: process.version,
      cpuCores: 8, // Mock value
      memory: {
        total: '16GB', // Mock value
      },
      hostname: 'pof-server', // Mock value
      startTime: new Date(),
    };
  }
  
  /**
   * Shutdown the monitoring system
   */
  shutdown() {
    // Stop all metric collection
    this.stopMetricsCollection();
    
    // Clear all data
    this.metricData.clear();
    this.activeAlerts.clear();
    
    // Log shutdown
    zkErrorLogger.log('INFO', 'SystemMonitor shutdown', {
      category: 'monitoring',
      userFixable: false,
      recoverable: true
    });
  }
}

// Create singleton instance
const systemMonitor = new SystemMonitor();

// Export for CommonJS
module.exports = {
  MetricType,
  AlertSeverity,
  SystemMonitor,
  systemMonitor
};