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

import { bigQueryAnalytics } from '../analytics/BigQueryAnalytics';
import zkErrorLoggerModule from '../zkErrorLogger.js';
import { EventEmitter } from 'events';

// TypeScript-safe logger implementation
class SafeLogger {
  // Base log method
  log(level: string, message: string, data: Record<string, any> = {}): void {
    console.log(`[${level}] ${message}`, data);
  }

  // Helper for logging errors
  logError(error: unknown, context: Record<string, any> = {}): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.log('ERROR', errorMessage, context);
    return 'error-id';
  }

  // Convenience methods
  info(message: string, data: Record<string, any> = {}): string {
    this.log('INFO', message, data);
    return 'info-id';
  }

  warn(message: string, data: Record<string, any> = {}): string {
    this.log('WARN', message, data);
    return 'warn-id';
  }

  error(message: string, data: Record<string, any> = {}): string {
    this.log('ERROR', message, data);
    return 'error-id';
  }

  critical(message: string, data: Record<string, any> = {}): string {
    this.log('CRITICAL', message, data);
    return 'critical-id';
  }

  debug(message: string, data: Record<string, any> = {}): string {
    this.log('DEBUG', message, data);
    return 'debug-id';
  }
}

// Create a safe logger instance we can use throughout the file
const zkErrorLogger = new SafeLogger();

// Helper function to safely get error message
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Helper function for consistent error logging
function logError(error: unknown, errorContext: string, additionalData: Record<string, any> = {}): void {
  const errorMsg = getErrorMessage(error);
  zkErrorLogger.log('ERROR', errorContext, {
    category: 'monitoring',
    userFixable: true,
    recoverable: true,
    details: { 
      error: errorMsg,
      ...additionalData
    }
  });
}

// Metric types
export enum MetricType {
  COUNTER = 'counter',  // Values that only increase (e.g., request count)
  GAUGE = 'gauge',      // Values that can go up and down (e.g., memory usage)
  HISTOGRAM = 'histogram', // Distribution of values in buckets
  SUMMARY = 'summary'   // Statistical summary (min, max, avg, percentiles)
}

// Alert severity levels
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// Metric data point
export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  labels: Record<string, string>;
}

// Metric definition
export interface MetricDefinition {
  name: string;
  type: MetricType;
  description: string;
  unit?: string;
  labels?: string[];
  interval?: number; // Collection interval in ms
  aggregationPeriod?: number; // Aggregation period in ms
}

// Alert definition
export interface AlertDefinition {
  id: string;
  name: string;
  description: string;
  metricName: string;
  condition: {
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    threshold: number;
    duration?: number; // How long condition must be true before alerting (ms)
  };
  severity: AlertSeverity;
  labels?: Record<string, string>;
  notificationChannels?: string[]; // IDs of notification channels
  cooldownPeriod?: number; // Time in ms before an alert can re-trigger
  enabled: boolean;
}

// Alert event
export interface AlertEvent {
  id: string;
  alertId: string;
  timestamp: Date;
  metricName: string;
  metricValue: number;
  threshold: number;
  severity: AlertSeverity;
  labels: Record<string, string>;
  resolved?: boolean;
  resolvedAt?: Date;
}

// Notification channel
export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'webhook' | 'sms' | 'slack' | 'pagerduty';
  configuration: Record<string, any>;
  enabled: boolean;
}

/**
 * System Monitoring Service
 */
export class SystemMonitor extends EventEmitter {
  private metrics: Map<string, MetricDefinition> = new Map();
  private metricData: Map<string, MetricDataPoint[]> = new Map();
  private alerts: Map<string, AlertDefinition> = new Map();
  private activeAlerts: Map<string, AlertEvent> = new Map();
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private collectionIntervals: Map<string, NodeJS.Timeout> = new Map();
  private evaluationInterval: NodeJS.Timeout | null = null;
  private initialized: boolean = false;
  private retentionPeriodMs: number;
  private systemInfo: Record<string, any> = {};
  
  // Default metrics
  private readonly DEFAULT_METRICS: MetricDefinition[] = [
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
  private readonly DEFAULT_ALERTS: AlertDefinition[] = [
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
  
  /**
   * Constructs a new SystemMonitor instance
   * 
   * @param retentionPeriodMs - Time in ms to retain metric data (defaults to 7 days)
   */
  constructor(retentionPeriodMs: number = 7 * 24 * 60 * 60 * 1000) {
    super();
    this.retentionPeriodMs = retentionPeriodMs;
    
    // Initialize the monitoring system
    this.initialize().catch(error => {
      logError(error, 'Failed to initialize SystemMonitor');
    });
  }
  
  /**
   * Initialize the monitoring system
   */
  public async initialize(): Promise<boolean> {
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
      logError(error, 'Failed to initialize SystemMonitor');
      return false;
    }
  }
  
  /**
   * Register a new metric
   * 
   * @param metric - The metric definition
   * @returns True if the metric was registered successfully
   */
  public registerMetric(metric: MetricDefinition): boolean {
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
      logError(error, `Failed to register metric: ${metric.name}`);
      return false;
    }
  }
  
  /**
   * Record a value for a metric
   * 
   * @param metricName - The name of the metric
   * @param value - The value to record
   * @param labels - Optional labels for the data point
   * @returns True if the value was recorded successfully
   */
  public recordMetric(
    metricName: string,
    value: number,
    labels: Record<string, string> = {}
  ): boolean {
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
      
      const metric = this.metrics.get(metricName)!;
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
      const data = this.metricData.get(metricName)!;
      
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
        bigQueryAnalytics.trackSystemMetrics({
          [metricName.split('.').pop() || metricName]: value
        }).catch(error => {
          logError(error, `Failed to send metric to BigQuery: ${metricName}`, {
            userFixable: false
          });
        });
      }
      
      return true;
    } catch (error) {
      logError(error, `Failed to record metric: ${metricName}`);
      return false;
    }
  }
  
  /**
   * Track a metric over time - alias for recordMetric with additional functionality
   * 
   * @param metricName - The name of the metric
   * @param value - The value to track
   * @param labels - Optional labels for the data point
   * @param options - Additional tracking options
   * @returns True if the metric was tracked successfully
   */
  public trackMetric(
    metricName: string,
    value: number,
    labels: Record<string, string> = {},
    options: {
      aggregate?: boolean;
      checkThresholds?: boolean;
    } = {}
  ): boolean {
    try {
      // Validate metric name
      if (!metricName || typeof metricName !== 'string') {
        zkErrorLogger.log('WARNING', 'Invalid metric name provided to trackMetric', {
          category: 'monitoring',
          userFixable: true,
          recoverable: true,
          details: { metricName, valueType: typeof value }
        });
        return false;
      }

      // Validate value is a number
      if (typeof value !== 'number' || isNaN(value)) {
        zkErrorLogger.log('WARNING', `Invalid value provided for metric: ${metricName}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true,
          details: { metricName, value, valueType: typeof value }
        });
        return false;
      }
      
      // Record the metric value
      const recorded = this.recordMetric(metricName, value, labels);
      
      if (!recorded) {
        return false;
      }
      
      // Optional: Check against thresholds if requested
      if (options.checkThresholds) {
        this.checkMetricThresholds(metricName, value, labels);
      }
      
      // Aggregate data if requested (for histograms/summaries)
      if (options.aggregate && this.metrics.has(metricName)) {
        const metric = this.metrics.get(metricName)!;
        
        if (metric.type === MetricType.HISTOGRAM || metric.type === MetricType.SUMMARY) {
          // Calculate statistics on recent data
          const recentData = this.getMetricData(metricName, 300000, undefined, labels);
          
          if (recentData && recentData.length > 0) {
            const values = recentData.map(point => point.value);
            const sum = values.reduce((a, b) => a + b, 0);
            const avg = sum / values.length;
            const sorted = [...values].sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)];
            const min = sorted[0];
            const max = sorted[sorted.length - 1];
            const p95 = sorted[Math.floor(sorted.length * 0.95)];
            
            // Record derived metrics
            const baseLabels = { ...labels, source: metricName };
            this.recordMetric(`${metricName}.avg`, avg, baseLabels);
            this.recordMetric(`${metricName}.median`, median, baseLabels);
            this.recordMetric(`${metricName}.min`, min, baseLabels);
            this.recordMetric(`${metricName}.max`, max, baseLabels);
            this.recordMetric(`${metricName}.p95`, p95, baseLabels);
          }
        }
      }
      
      // Log successful metric tracking for high-value metrics
      if (metricName.startsWith('system.') || metricName.startsWith('app.') || value > 100) {
        zkErrorLogger.log('INFO', `Tracked metric: ${metricName}`, {
          category: 'monitoring',
          userFixable: false,
          recoverable: true,
          details: {
            metricName,
            value,
            timestamp: new Date().toISOString(),
            labels: Object.keys(labels).length > 0 ? labels : undefined
          }
        });
      }
      
      return true;
    } catch (error) {
      logError(error, `Failed to track metric: ${metricName}`);
      return false;
    }
  }
  
  /**
   * Get historical data for a metric with flexible filtering and aggregation
   * 
   * @param metricName - The name of the metric
   * @param options - Options for fetching history
   * @returns Array of metric data points or null if an error occurred
   */
  public getMetricHistory(
    metricName: string,
    options: {
      timeRange?: {
        start?: Date;
        end?: Date;
        durationMs?: number;
      };
      aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count' | 'p95';
      interval?: 'minute' | 'hour' | 'day';
      labelFilters?: Record<string, string>;
      limit?: number;
    } = {}
  ): MetricDataPoint[] | null {
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
      const data = this.metricData.get(metricName)!;
      
      // Determine time range
      let startTime: Date;
      let endTime = options.timeRange?.end || new Date();
      
      if (options.timeRange?.start) {
        startTime = options.timeRange.start;
      } else if (options.timeRange?.durationMs) {
        startTime = new Date(endTime.getTime() - options.timeRange.durationMs);
      } else {
        // Default to last hour
        startTime = new Date(endTime.getTime() - 3600000);
      }
      
      // Filter by time range
      let filteredData = data.filter(point => 
        point.timestamp >= startTime && point.timestamp <= endTime
      );
      
      // Filter by labels if provided
      if (options.labelFilters) {
        filteredData = filteredData.filter(point => {
          return Object.entries(options.labelFilters!).every(([key, value]) => 
            point.labels[key] === value
          );
        });
      }
      
      // Determine grouping interval in milliseconds
      let intervalMs: number;
      switch (options.interval) {
        case 'minute':
          intervalMs = 60 * 1000;
          break;
        case 'hour':
          intervalMs = 60 * 60 * 1000;
          break;
        case 'day':
          intervalMs = 24 * 60 * 60 * 1000;
          break;
        default:
          // Default to minute aggregation
          intervalMs = 60 * 1000;
      }
      
      // Apply aggregation if specified
      if (options.aggregation && filteredData.length > 0) {
        // Group by interval
        const groupedByInterval = new Map<number, number[]>();
        
        for (const point of filteredData) {
          const interval = Math.floor(point.timestamp.getTime() / intervalMs);
          if (!groupedByInterval.has(interval)) {
            groupedByInterval.set(interval, []);
          }
          groupedByInterval.get(interval)!.push(point.value);
        }
        
        // Apply aggregation function to each group
        const aggregatedData: MetricDataPoint[] = [];
        
        for (const [interval, values] of groupedByInterval.entries()) {
          let aggregatedValue: number;
          
          switch (options.aggregation) {
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
            case 'count':
              aggregatedValue = values.length;
              break;
            case 'p95':
              const sorted = [...values].sort((a, b) => a - b);
              const p95Index = Math.floor(sorted.length * 0.95);
              aggregatedValue = sorted[p95Index];
              break;
            default:
              aggregatedValue = values.reduce((sum, val) => sum + val, 0) / values.length;
          }
          
          aggregatedData.push({
            timestamp: new Date(interval * intervalMs),
            value: aggregatedValue,
            labels: { aggregation: options.aggregation }
          });
        }
        
        filteredData = aggregatedData;
      }
      
      // Sort by timestamp
      filteredData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      // Apply limit if specified
      if (options.limit && options.limit > 0) {
        filteredData = filteredData.slice(0, options.limit);
      }
      
      return filteredData;
    } catch (error) {
      logError(error, `Failed to get metric history: ${metricName}`);
      return null;
    }
  }
  
  /**
   * Set an alert threshold for a metric
   * 
   * @param metricName - The name of the metric
   * @param threshold - The threshold configuration
   * @returns The ID of the created alert or null if an error occurred
   */
  public setThresholdAlert(
    metricName: string,
    threshold: {
      operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
      value: number;
      duration?: number;
      severity?: AlertSeverity;
      description?: string;
      labels?: Record<string, string>;
      notificationChannels?: string[];
    }
  ): string | null {
    try {
      // Check if metric exists
      if (!this.metrics.has(metricName)) {
        zkErrorLogger.log('WARNING', `Cannot set threshold for non-existent metric: ${metricName}`, {
          category: 'monitoring',
          userFixable: true,
          recoverable: true
        });
        return null;
      }
      
      // Generate alert ID
      const alertId = `alert_${metricName}_${threshold.operator}_${threshold.value}_${Date.now()}`;
      
      // Create alert definition
      const alertDefinition: AlertDefinition = {
        id: alertId,
        name: `${metricName} ${threshold.operator} ${threshold.value}`,
        description: threshold.description || `Alert when ${metricName} ${threshold.operator} ${threshold.value}`,
        metricName,
        condition: {
          operator: threshold.operator,
          threshold: threshold.value,
          duration: threshold.duration || 300000 // Default to 5 minutes
        },
        severity: threshold.severity || AlertSeverity.WARNING,
        labels: threshold.labels,
        notificationChannels: threshold.notificationChannels,
        cooldownPeriod: 1800000, // Default to 30 minutes
        enabled: true
      };
      
      // Register the alert
      const registered = this.registerAlert(alertDefinition);
      
      if (!registered) {
        return null;
      }
      
      zkErrorLogger.log('INFO', `Threshold alert created for ${metricName}`, {
        category: 'monitoring',
        userFixable: false,
        recoverable: true,
        details: {
          metricName,
          alertId,
          threshold: threshold.value,
          operator: threshold.operator
        }
      });
      
      return alertId;
    } catch (error) {
      logError(error, `Failed to set threshold alert for ${metricName}`);
      return null;
    }
  }
  
  /**
   * Check if a metric value violates any defined thresholds
   * 
   * @param metricName - The name of the metric
   * @param value - The current value
   * @param labels - Optional labels for filtering alerts
   * @private
   */
  private checkMetricThresholds(
    metricName: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    // Find alerts for this metric
    const relevantAlerts = Array.from(this.alerts.values())
      .filter(alert => alert.metricName === metricName && alert.enabled);
    
    // Check each alert
    for (const alert of relevantAlerts) {
      // Match labels if present
      if (alert.labels && Object.keys(alert.labels).length > 0) {
        const labelsMatch = Object.entries(alert.labels).every(
          ([key, val]) => labels[key] === val
        );
        
        if (!labelsMatch) {
          continue;
        }
      }
      
      // Check threshold condition
      let conditionMet = false;
      
      switch (alert.condition.operator) {
        case '>':
          conditionMet = value > alert.condition.threshold;
          break;
        case '<':
          conditionMet = value < alert.condition.threshold;
          break;
        case '>=':
          conditionMet = value >= alert.condition.threshold;
          break;
        case '<=':
          conditionMet = value <= alert.condition.threshold;
          break;
        case '==':
          conditionMet = value === alert.condition.threshold;
          break;
        case '!=':
          conditionMet = value !== alert.condition.threshold;
          break;
      }
      
      if (conditionMet) {
        // This would trigger the full alerting system in a real evaluation,
        // but here we just log that the threshold was crossed
        zkErrorLogger.log('INFO', `Metric ${metricName} crossed threshold ${alert.condition.operator} ${alert.condition.threshold}`, {
          category: 'monitoring',
          userFixable: false,
          recoverable: true,
          details: {
            metricName,
            value,
            threshold: alert.condition.threshold,
            operator: alert.condition.operator
          }
        });
      }
    }
  }
  
  /**
   * Register a new alert
   * 
   * @param alert - The alert definition
   * @returns True if the alert was registered successfully
   */
  public registerAlert(alert: AlertDefinition): boolean {
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
      logError(error, `Failed to register alert: ${alert.id}`);
      return false;
    }
  }
  
  /**
   * Register a new notification channel
   * 
   * @param channel - The notification channel definition
   * @returns True if the channel was registered successfully
   */
  public registerNotificationChannel(channel: NotificationChannel): boolean {
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
      logError(error, `Failed to register notification channel: ${channel.id}`);
      return false;
    }
  }
  
  /**
   * Get metric data for a specific metric
   * 
   * @param metricName - The name of the metric
   * @param timeframeMs - How far back to get data (in ms)
   * @param aggregation - Optional aggregation function ('avg', 'sum', 'min', 'max')
   * @param labelFilters - Optional label filters
   * @returns The metric data points or null if an error occurred
   */
  public getMetricData(
    metricName: string,
    timeframeMs: number = 3600000, // 1 hour
    aggregation?: 'avg' | 'sum' | 'min' | 'max',
    labelFilters?: Record<string, string>
  ): MetricDataPoint[] | null {
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
      const data = this.metricData.get(metricName)!;
      
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
        const groupedByMinute = new Map<number, number[]>();
        
        for (const point of filteredData) {
          const minute = Math.floor(point.timestamp.getTime() / 60000);
          if (!groupedByMinute.has(minute)) {
            groupedByMinute.set(minute, []);
          }
          groupedByMinute.get(minute)!.push(point.value);
        }
        
        // Apply aggregation function to each group
        const aggregatedData: MetricDataPoint[] = [];
        
        for (const [minute, values] of groupedByMinute.entries()) {
          let aggregatedValue: number;
          
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
      logError(error, `Failed to get metric data: ${metricName}`);
      return null;
    }
  }
  
  /**
   * Get all active alerts
   * 
   * @returns Array of active alert events
   */
  public getActiveAlerts(): AlertEvent[] {
    return Array.from(this.activeAlerts.values());
  }
  
  /**
   * Get a specific metric's current value
   * 
   * @param metricName - The name of the metric
   * @param labelFilters - Optional label filters
   * @returns The current value or null if not available
   */
  public getCurrentMetricValue(
    metricName: string,
    labelFilters?: Record<string, string>
  ): number | null {
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
   * @returns System information
   */
  public getSystemInfo(): Record<string, any> {
    return { ...this.systemInfo };
  }
  
  /**
   * Start collection for all metrics
   */
  private startMetricsCollection(): void {
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
   * @param metricName - The name of the metric to collect
   */
  private startMetricCollection(metricName: string): void {
    // Clear existing interval if any
    if (this.collectionIntervals.has(metricName)) {
      clearInterval(this.collectionIntervals.get(metricName)!);
    }
    
    const metric = this.metrics.get(metricName)!;
    
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
        logError(error, `Failed to collect metric: ${metricName}`);
      }
    }, metric.interval);
    
    // Store the interval
    this.collectionIntervals.set(metricName, interval);
  }
  
  /**
   * Stop collection for all metrics
   */
  private stopMetricsCollection(): void {
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
   */
  private startAlertEvaluation(): void {
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
   */
  private evaluateAlerts(): void {
    for (const alert of this.alerts.values()) {
      // Skip disabled alerts
      if (!alert.enabled) {
        continue;
      }
      
      try {
        this.evaluateAlert(alert);
      } catch (error) {
        logError(error, `Failed to evaluate alert: ${alert.id}`);
      }
    }
  }
  
  /**
   * Evaluate a specific alert
   * 
   * @param alert - The alert to evaluate
   */
  private evaluateAlert(alert: AlertDefinition): void {
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
    let valueToCompare: number;
    
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
      const alertEvent: AlertEvent = {
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
   * @param alert - The alert event
   */
  private sendAlertNotification(alert: AlertEvent): void {
    // Get the alert definition
    const alertDef = this.alerts.get(alert.alertId);
    if (!alertDef) {
      return;
    }
    
    // Get notification channels
    const channels = alertDef.notificationChannels || [];
    
    // If no channels specified, use all enabled channels
    const channelsToNotify = channels.length > 0
      ? channels.map(id => this.notificationChannels.get(id)).filter((c): c is NotificationChannel => !!c)
      : Array.from(this.notificationChannels.values()).filter(channel => channel.enabled);
    
    // Send notification to each channel
    for (const channel of channelsToNotify) {
      try {
        this.sendNotification(channel, alert);
      } catch (error) {
        logError(error, `Failed to send alert notification: ${channel.id}`);
      }
    }
  }
  
  /**
   * Send resolution notification for an alert
   * 
   * @param alert - The resolved alert event
   */
  private sendAlertResolutionNotification(alert: AlertEvent): void {
    // Similar to sendAlertNotification but for resolutions
    const alertDef = this.alerts.get(alert.alertId);
    if (!alertDef) {
      return;
    }
    
    const channels = alertDef.notificationChannels || [];
    const channelsToNotify = channels.length > 0
      ? channels.map(id => this.notificationChannels.get(id)).filter((c): c is NotificationChannel => !!c)
      : Array.from(this.notificationChannels.values()).filter(channel => channel.enabled);
    
    for (const channel of channelsToNotify) {
      try {
        this.sendResolutionNotification(channel, alert);
      } catch (error) {
        logError(error, `Failed to send alert resolution notification: ${channel.id}`);
      }
    }
  }
  
  /**
   * Send a notification to a specific channel
   * 
   * @param channel - The notification channel
   * @param alert - The alert event
   */
  private async sendNotification(
    channel: NotificationChannel,
    alert: AlertEvent
  ): Promise<void> {
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
          logError(error, `Failed to send webhook: ${channel.id}`);
        }
        break;
        
      // Add other channel types as needed
    }
  }
  
  /**
   * Send a resolution notification to a specific channel
   * 
   * @param channel - The notification channel
   * @param alert - The resolved alert event
   */
  private async sendResolutionNotification(
    channel: NotificationChannel,
    alert: AlertEvent
  ): Promise<void> {
    const alertDef = this.alerts.get(alert.alertId);
    if (!alertDef) {
      return;
    }
    
    const duration = alert.resolvedAt!.getTime() - alert.timestamp.getTime();
    const durationMinutes = Math.round(duration / 60000);
    
    const subject = `[RESOLVED] ${alertDef.name}`;
    const message = `
      Alert Resolved: ${alertDef.name}
      Time: ${alert.resolvedAt!.toISOString()}
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
   */
  private cleanupOldData(): void {
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
   * @returns CPU usage percentage
   */
  private async getCpuUsage(): Promise<number> {
    // In a real implementation, this would get CPU usage from the OS
    // For now, return a random value for demonstration
    return Math.random() * 100;
  }
  
  /**
   * Get memory usage percentage
   * 
   * @returns Memory usage percentage
   */
  private async getMemoryUsage(): Promise<number> {
    // In a real implementation, this would get memory usage from the OS
    // For now, return a random value for demonstration
    return Math.random() * 100;
  }
  
  /**
   * Collect system information
   */
  private async collectSystemInfo(): Promise<void> {
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
  public shutdown(): void {
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
export const systemMonitor = new SystemMonitor();

// Export default for CommonJS compatibility
export default systemMonitor;