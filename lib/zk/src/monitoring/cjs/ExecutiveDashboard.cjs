/**
 * Executive Dashboard
 * 
 * Provides aggregated metrics and KPIs for executive/management review, with 
 * high-level system health status, usage trends, and operational metrics.
 * 
 * Key features:
 * - System health overview
 * - Key performance indicators
 * - Usage trends and statistics
 * - Real-time operational metrics
 * - Scheduled report generation
 */

const { systemMonitor, MetricType } = require('./SystemMonitor.cjs');
const { alertManager } = require('./AlertManager.cjs');
const { bigQueryAnalytics } = require('../../analytics/cjs/BigQueryAnalytics.cjs');
const { zkErrorLogger } = require('../../zkErrorLogger.cjs');

// Report formats
const ReportFormat = {
  HTML: 'html',
  PDF: 'pdf',
  JSON: 'json',
  CSV: 'csv'
};

/**
 * @typedef {Object} DashboardMetrics
 * @property {Object} systemHealth
 * @property {'healthy'|'degraded'|'critical'} systemHealth.status
 * @property {number} systemHealth.uptime
 * @property {number} systemHealth.activeAlerts
 * @property {number} systemHealth.criticalAlerts
 * @property {number|null} systemHealth.cpuUsage
 * @property {number|null} systemHealth.memoryUsage
 * @property {Date} systemHealth.lastUpdateTime
 * @property {Object} performance
 * @property {number|null} performance.avgResponseTime
 * @property {number|null} performance.p95ResponseTime
 * @property {number|null} performance.errorRate
 * @property {number|null} performance.requestsPerMinute
 * @property {Object} usage
 * @property {number|null} usage.totalUsers
 * @property {number|null} usage.activeUsersToday
 * @property {number|null} usage.activeUsersWeek
 * @property {number|null} usage.activeUsersMonth
 * @property {number|null} usage.newUsersToday
 * @property {number|null} usage.totalProofs
 * @property {number|null} usage.proofsToday
 * @property {Object} proofMetrics
 * @property {number|null} proofMetrics.successRate
 * @property {number|null} proofMetrics.avgGenerationTime
 * @property {Record<string, {count: number, successRate: number, avgTime: number}>} proofMetrics.byType
 * @property {Object} alertMetrics
 * @property {number|null} alertMetrics.triggerRate
 * @property {number|null} alertMetrics.mttr
 * @property {number|null} alertMetrics.mtta
 * @property {Array<{type: string, count: number}>} alertMetrics.topAlertTypes
 */

/**
 * @typedef {Object} DashboardReport
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string[]} metrics
 * @property {'pdf'|'html'|'json'} format
 * @property {Object} schedule
 * @property {'daily'|'weekly'|'monthly'} schedule.frequency
 * @property {number} [schedule.dayOfWeek]
 * @property {number} [schedule.dayOfMonth]
 * @property {number} schedule.hour
 * @property {number} schedule.minute
 * @property {string[]} recipients
 * @property {Date} [lastGenerated]
 */

/**
 * Executive Dashboard Service
 */
class ExecutiveDashboard {
  /**
   * Constructs a new ExecutiveDashboard instance
   * 
   * @param {number} updateIntervalMs - Interval in ms to update metrics (defaults to 5 minutes)
   */
  constructor(updateIntervalMs = 5 * 60 * 1000) {
    this.cachedMetrics = null;
    this.lastUpdateTime = new Date(0);
    this.updateIntervalMs = updateIntervalMs;
    this.reports = new Map();
    this.updateInterval = null;
    this.reportInterval = null;
    this.initialized = false;
    
    // Initialize the dashboard
    this.initialize().catch(error => {
      zkErrorLogger.log('ERROR', 'Failed to initialize ExecutiveDashboard', {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
    });
  }
  
  /**
   * Initialize the dashboard
   * @returns {Promise<boolean>}
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }
    
    try {
      // Set up default reports
      this.setupDefaultReports();
      
      // Perform initial metrics update
      await this.updateMetrics();
      
      // Set up periodic updates
      this.updateInterval = setInterval(() => {
        this.updateMetrics().catch(error => {
          zkErrorLogger.log('ERROR', 'Failed to update dashboard metrics', {
            category: 'monitoring',
            userFixable: false,
            recoverable: true,
            details: { error: error.message }
          });
        });
      }, this.updateIntervalMs);
      
      // Set up report scheduling (check every hour)
      this.reportInterval = setInterval(() => {
        this.checkScheduledReports().catch(error => {
          zkErrorLogger.log('ERROR', 'Failed to check scheduled reports', {
            category: 'monitoring',
            userFixable: false,
            recoverable: true,
            details: { error: error.message }
          });
        });
      }, 60 * 60 * 1000);
      
      this.initialized = true;
      
      zkErrorLogger.log('INFO', 'ExecutiveDashboard initialized successfully', {
        category: 'monitoring',
        userFixable: false,
        recoverable: true
      });
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to initialize ExecutiveDashboard', {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
      
      return false;
    }
  }
  
  /**
   * Get the latest metrics
   * 
   * @param {boolean} [forceUpdate=false] - Force an update of metrics regardless of cache
   * @returns {Promise<DashboardMetrics|null>} The dashboard metrics or null if an error occurred
   */
  async getMetrics(forceUpdate = false) {
    try {
      // Check if we need to update
      const now = new Date();
      if (forceUpdate || 
          !this.cachedMetrics || 
          now.getTime() - this.lastUpdateTime.getTime() > this.updateIntervalMs) {
        await this.updateMetrics();
      }
      
      return this.cachedMetrics;
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to get dashboard metrics', {
        category: 'monitoring',
        userFixable: false,
        recoverable: true,
        details: { error: error.message }
      });
      
      return null;
    }
  }
  
  /**
   * Create or update a scheduled report
   * 
   * @param {DashboardReport} report - The report definition
   * @returns {boolean} True if the report was successfully saved
   */
  saveReport(report) {
    try {
      // Validate report
      if (!report.id || !report.name || !report.metrics || report.metrics.length === 0) {
        return false;
      }
      
      // Save the report
      this.reports.set(report.id, report);
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to save report: ${report.id}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
      
      return false;
    }
  }
  
  /**
   * Generate a report on demand
   * 
   * @param {string} reportId - The ID of the report to generate
   * @returns {Promise<string|null>} The report content or null if an error occurred
   */
  async generateReport(reportId) {
    try {
      // Check if report exists
      if (!this.reports.has(reportId)) {
        return null;
      }
      
      const report = this.reports.get(reportId);
      
      // Get latest metrics
      const metrics = await this.getMetrics(true);
      if (!metrics) {
        return null;
      }
      
      // Generate report based on format
      let content;
      
      switch (report.format) {
        case 'json':
          content = this.generateJsonReport(report, metrics);
          break;
        case 'html':
          content = this.generateHtmlReport(report, metrics);
          break;
        case 'pdf':
          // In a real implementation, this would generate a PDF
          content = this.generateHtmlReport(report, metrics);
          break;
        default:
          content = this.generateJsonReport(report, metrics);
      }
      
      // Update last generated time
      report.lastGenerated = new Date();
      this.reports.set(reportId, report);
      
      return content;
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to generate report: ${reportId}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
      
      return null;
    }
  }
  
  /**
   * Get a list of all reports
   * 
   * @returns {DashboardReport[]} Array of report definitions
   */
  getReports() {
    return Array.from(this.reports.values());
  }
  
  /**
   * Delete a report
   * 
   * @param {string} reportId - The ID of the report to delete
   * @returns {boolean} True if the report was successfully deleted
   */
  deleteReport(reportId) {
    try {
      // Check if report exists
      if (!this.reports.has(reportId)) {
        return false;
      }
      
      // Delete the report
      this.reports.delete(reportId);
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to delete report: ${reportId}`, {
        category: 'monitoring',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
      
      return false;
    }
  }
  
  /**
   * Update all metrics
   * @private
   * @returns {Promise<void>}
   */
  async updateMetrics() {
    try {
      // Create a new metrics object
      const metrics = {
        systemHealth: {
          status: 'healthy',
          uptime: process.uptime(),
          activeAlerts: 0,
          criticalAlerts: 0,
          cpuUsage: null,
          memoryUsage: null,
          lastUpdateTime: new Date()
        },
        performance: {
          avgResponseTime: null,
          p95ResponseTime: null,
          errorRate: null,
          requestsPerMinute: null
        },
        usage: {
          totalUsers: null,
          activeUsersToday: null,
          activeUsersWeek: null,
          activeUsersMonth: null,
          newUsersToday: null,
          totalProofs: null,
          proofsToday: null
        },
        proofMetrics: {
          successRate: null,
          avgGenerationTime: null,
          byType: {}
        },
        alertMetrics: {
          triggerRate: null,
          mttr: null,
          mtta: null,
          topAlertTypes: []
        }
      };
      
      // Get system health metrics
      await this.updateSystemHealthMetrics(metrics);
      
      // Get performance metrics
      await this.updatePerformanceMetrics(metrics);
      
      // Get usage metrics
      await this.updateUsageMetrics(metrics);
      
      // Get proof metrics
      await this.updateProofMetrics(metrics);
      
      // Get alert metrics
      await this.updateAlertMetrics(metrics);
      
      // Update cache
      this.cachedMetrics = metrics;
      this.lastUpdateTime = new Date();
      
      zkErrorLogger.log('INFO', 'Dashboard metrics updated', {
        category: 'monitoring',
        userFixable: false,
        recoverable: true
      });
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to update metrics', {
        category: 'monitoring',
        userFixable: false,
        recoverable: true,
        details: { error: error.message }
      });
    }
  }
  
  /**
   * Update system health metrics
   * 
   * @param {DashboardMetrics} metrics - The metrics object to update
   * @private
   * @returns {Promise<void>}
   */
  async updateSystemHealthMetrics(metrics) {
    try {
      // Get CPU and memory usage
      metrics.systemHealth.cpuUsage = systemMonitor.getCurrentMetricValue('system.cpu.usage');
      metrics.systemHealth.memoryUsage = systemMonitor.getCurrentMetricValue('system.memory.usage');
      
      // Get active alerts
      const activeAlerts = alertManager.getActiveAlerts();
      metrics.systemHealth.activeAlerts = activeAlerts.length;
      
      // Count critical alerts
      metrics.systemHealth.criticalAlerts = activeAlerts.filter(
        alert => alert.event.severity === 'critical'
      ).length;
      
      // Determine system health status
      if (metrics.systemHealth.criticalAlerts > 0) {
        metrics.systemHealth.status = 'critical';
      } else if (metrics.systemHealth.activeAlerts > 0) {
        metrics.systemHealth.status = 'degraded';
      } else {
        metrics.systemHealth.status = 'healthy';
      }
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to update system health metrics', {
        category: 'monitoring',
        userFixable: false,
        recoverable: true,
        details: { error: error.message }
      });
    }
  }
  
  /**
   * Update performance metrics
   * 
   * @param {DashboardMetrics} metrics - The metrics object to update
   * @private
   * @returns {Promise<void>}
   */
  async updatePerformanceMetrics(metrics) {
    try {
      // Get average response time (last hour)
      const latencyData = systemMonitor.getMetricData('app.latency', 3600000);
      if (latencyData && latencyData.length > 0) {
        // Calculate average
        metrics.performance.avgResponseTime = latencyData.reduce(
          (sum, point) => sum + point.value, 
          0
        ) / latencyData.length;
        
        // Calculate 95th percentile
        const sortedValues = latencyData.map(point => point.value).sort((a, b) => a - b);
        const p95Index = Math.floor(sortedValues.length * 0.95);
        metrics.performance.p95ResponseTime = sortedValues[p95Index];
      }
      
      // Get error rate
      const requestsData = systemMonitor.getMetricData('app.requests.total', 3600000);
      const errorsData = systemMonitor.getMetricData('app.errors.total', 3600000);
      
      if (requestsData && errorsData && requestsData.length > 0) {
        const totalRequests = requestsData.reduce((sum, point) => sum + point.value, 0);
        const totalErrors = errorsData.reduce((sum, point) => sum + point.value, 0);
        
        if (totalRequests > 0) {
          metrics.performance.errorRate = (totalErrors / totalRequests) * 100;
        }
      }
      
      // Calculate requests per minute (last 10 minutes)
      const recentRequestsData = systemMonitor.getMetricData('app.requests.total', 600000);
      if (recentRequestsData && recentRequestsData.length > 0) {
        const totalRequests = recentRequestsData.reduce((sum, point) => sum + point.value, 0);
        metrics.performance.requestsPerMinute = totalRequests / 10; // 10 minutes
      }
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to update performance metrics', {
        category: 'monitoring',
        userFixable: false,
        recoverable: true,
        details: { error: error.message }
      });
    }
  }
  
  /**
   * Update usage metrics
   * 
   * @param {DashboardMetrics} metrics - The metrics object to update
   * @private
   * @returns {Promise<void>}
   */
  async updateUsageMetrics(metrics) {
    try {
      // Get user activity stats from BigQuery
      const userActivityStats = await bigQueryAnalytics.getUserActivityStats(30);
      
      if (userActivityStats) {
        // Extract metrics
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Active users today
        const todayStats = userActivityStats.find(row => row.day === today);
        if (todayStats) {
          metrics.usage.activeUsersToday = todayStats.unique_users;
          metrics.usage.newUsersToday = todayStats.new_users || 0;
        }
        
        // Total users estimate (sum of new users over time)
        metrics.usage.totalUsers = userActivityStats.reduce(
          (sum, row) => sum + (row.new_users || 0), 
          0
        );
        
        // Active users in the last week
        const weekUserSet = new Set();
        const lastWeekStats = userActivityStats.slice(0, 7); // Last 7 days
        
        for (const day of lastWeekStats) {
          if (day.user_ids) {
            for (const userId of day.user_ids) {
              weekUserSet.add(userId);
            }
          }
        }
        
        metrics.usage.activeUsersWeek = weekUserSet.size;
        
        // Active users in the last month
        metrics.usage.activeUsersMonth = new Set(
          userActivityStats.flatMap(day => day.user_ids || [])
        ).size;
      }
      
      // Get proof statistics from BigQuery
      const proofStats = await bigQueryAnalytics.getProofStats(30);
      
      if (proofStats) {
        // Total proofs
        metrics.usage.totalProofs = proofStats.reduce(
          (sum, row) => sum + row.count, 
          0
        );
        
        // Proofs today
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        // This is a simplification - in a real implementation, we would have daily stats
        metrics.usage.proofsToday = Math.round(metrics.usage.totalProofs / 30);
      }
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to update usage metrics', {
        category: 'monitoring',
        userFixable: false,
        recoverable: true,
        details: { error: error.message }
      });
    }
  }
  
  /**
   * Update proof metrics
   * 
   * @param {DashboardMetrics} metrics - The metrics object to update
   * @private
   * @returns {Promise<void>}
   */
  async updateProofMetrics(metrics) {
    try {
      // Get proof generation metrics
      const generationData = systemMonitor.getMetricData('proof.generation.count', 86400000); // Last 24 hours
      const verificationData = systemMonitor.getMetricData('proof.verification.count', 86400000);
      const durationData = systemMonitor.getMetricData('proof.generation.duration', 86400000);
      
      if (generationData && verificationData) {
        // Group by proof type
        const proofTypeMap = new Map();
        
        // Process generation data
        for (const point of generationData) {
          const proofType = point.labels['proof_type'] || 'unknown';
          
          if (!proofTypeMap.has(proofType)) {
            proofTypeMap.set(proofType, {
              generated: 0,
              verified: 0,
              successful: 0,
              duration: []
            });
          }
          
          const typeStats = proofTypeMap.get(proofType);
          typeStats.generated += point.value;
        }
        
        // Process verification data
        for (const point of verificationData) {
          const proofType = point.labels['proof_type'] || 'unknown';
          const result = point.labels['result'] || 'unknown';
          
          if (!proofTypeMap.has(proofType)) {
            proofTypeMap.set(proofType, {
              generated: 0,
              verified: 0,
              successful: 0,
              duration: []
            });
          }
          
          const typeStats = proofTypeMap.get(proofType);
          typeStats.verified += point.value;
          
          if (result === 'success') {
            typeStats.successful += point.value;
          }
        }
        
        // Process duration data
        for (const point of durationData || []) {
          const proofType = point.labels['proof_type'] || 'unknown';
          
          if (proofTypeMap.has(proofType)) {
            proofTypeMap.get(proofType).duration.push(point.value);
          }
        }
        
        // Calculate overall metrics
        let totalGenerated = 0;
        let totalVerified = 0;
        let totalSuccessful = 0;
        let totalDuration = 0;
        let totalDurationPoints = 0;
        
        for (const [proofType, stats] of proofTypeMap.entries()) {
          totalGenerated += stats.generated;
          totalVerified += stats.verified;
          totalSuccessful += stats.successful;
          
          const avgDuration = stats.duration.length > 0 
            ? stats.duration.reduce((sum, val) => sum + val, 0) / stats.duration.length 
            : 0;
          
          totalDuration += avgDuration * stats.duration.length;
          totalDurationPoints += stats.duration.length;
          
          // Add to metrics
          metrics.proofMetrics.byType[proofType] = {
            count: stats.generated,
            successRate: stats.verified > 0 
              ? (stats.successful / stats.verified) * 100 
              : 0,
            avgTime: avgDuration
          };
        }
        
        // Calculate overall success rate
        metrics.proofMetrics.successRate = totalVerified > 0 
          ? (totalSuccessful / totalVerified) * 100 
          : null;
        
        // Calculate overall average generation time
        metrics.proofMetrics.avgGenerationTime = totalDurationPoints > 0 
          ? totalDuration / totalDurationPoints 
          : null;
      }
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to update proof metrics', {
        category: 'monitoring',
        userFixable: false,
        recoverable: true,
        details: { error: error.message }
      });
    }
  }
  
  /**
   * Update alert metrics
   * 
   * @param {DashboardMetrics} metrics - The metrics object to update
   * @private
   * @returns {Promise<void>}
   */
  async updateAlertMetrics(metrics) {
    try {
      // Get alert statistics
      const alertStats = alertManager.getAlertStatistics(7 * 24 * 60 * 60 * 1000); // Last 7 days
      
      if (alertStats) {
        // Mean time to resolution (convert from ms to seconds)
        metrics.alertMetrics.mttr = alertStats.mttr > 0 
          ? alertStats.mttr / 1000 
          : null;
        
        // Mean time to acknowledgment (convert from ms to seconds)
        metrics.alertMetrics.mtta = alertStats.mtta > 0 
          ? alertStats.mtta / 1000 
          : null;
        
        // Calculate alert trigger rate (per day)
        metrics.alertMetrics.triggerRate = alertStats.total / 7; // 7 days
        
        // Get top alert types
        metrics.alertMetrics.topAlertTypes = Object.entries(alertStats.byTag)
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5); // Top 5
      }
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to update alert metrics', {
        category: 'monitoring',
        userFixable: false,
        recoverable: true,
        details: { error: error.message }
      });
    }
  }
  
  /**
   * Set up default reports
   * @private
   */
  setupDefaultReports() {
    // Daily summary report
    this.saveReport({
      id: 'daily_summary',
      name: 'Daily System Summary',
      description: 'Daily summary of system health, performance, and usage',
      metrics: [
        'systemHealth',
        'performance',
        'usage',
        'proofMetrics'
      ],
      format: 'html',
      schedule: {
        frequency: 'daily',
        hour: 8,
        minute: 0
      },
      recipients: [
        process.env.ADMIN_EMAIL || 'admin@example.com'
      ]
    });
    
    // Weekly executive report
    this.saveReport({
      id: 'weekly_executive',
      name: 'Weekly Executive Report',
      description: 'Weekly summary of all metrics for executive review',
      metrics: [
        'systemHealth',
        'performance',
        'usage',
        'proofMetrics',
        'alertMetrics'
      ],
      format: 'pdf',
      schedule: {
        frequency: 'weekly',
        dayOfWeek: 1, // Monday
        hour: 9,
        minute: 0
      },
      recipients: [
        process.env.ADMIN_EMAIL || 'admin@example.com',
        process.env.EXECUTIVE_EMAIL || 'executive@example.com'
      ]
    });
    
    // Monthly summary report
    this.saveReport({
      id: 'monthly_summary',
      name: 'Monthly System Summary',
      description: 'Monthly summary of all metrics with trend analysis',
      metrics: [
        'systemHealth',
        'performance',
        'usage',
        'proofMetrics',
        'alertMetrics'
      ],
      format: 'pdf',
      schedule: {
        frequency: 'monthly',
        dayOfMonth: 1,
        hour: 9,
        minute: 0
      },
      recipients: [
        process.env.ADMIN_EMAIL || 'admin@example.com',
        process.env.EXECUTIVE_EMAIL || 'executive@example.com'
      ]
    });
  }
  
  /**
   * Check for reports that need to be generated
   * @private
   * @returns {Promise<void>}
   */
  async checkScheduledReports() {
    const now = new Date();
    
    for (const report of this.reports.values()) {
      try {
        const shouldGenerate = this.shouldGenerateReport(report, now);
        
        if (shouldGenerate) {
          // Generate the report
          const content = await this.generateReport(report.id);
          
          if (content) {
            // In a real implementation, this would send the report to recipients
            zkErrorLogger.log('INFO', `Generated scheduled report: ${report.id}`, {
              category: 'monitoring',
              userFixable: false,
              recoverable: true,
              details: { 
                reportId: report.id,
                recipients: report.recipients.length
              }
            });
          }
        }
      } catch (error) {
        zkErrorLogger.log('ERROR', `Failed to check scheduled report: ${report.id}`, {
          category: 'monitoring',
          userFixable: false,
          recoverable: true,
          details: { error: error.message }
        });
      }
    }
  }
  
  /**
   * Check if a report should be generated
   * 
   * @param {DashboardReport} report - The report to check
   * @param {Date} now - The current time
   * @returns {boolean} True if the report should be generated
   * @private
   */
  shouldGenerateReport(report, now) {
    // Check if already generated recently
    if (report.lastGenerated) {
      const hoursSinceLastGeneration = 
        (now.getTime() - report.lastGenerated.getTime()) / (1000 * 60 * 60);
      
      // If generated in the last hour, skip
      if (hoursSinceLastGeneration < 1) {
        return false;
      }
    }
    
    // Check if schedule matches current time
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDayOfWeek = now.getDay();
    const currentDayOfMonth = now.getDate();
    
    // Check hour and minute
    if (currentHour !== report.schedule.hour) {
      return false;
    }
    
    // Allow a 5-minute window for the scheduled minute
    if (currentMinute < report.schedule.minute || 
        currentMinute > report.schedule.minute + 5) {
      return false;
    }
    
    // Check frequency-specific conditions
    switch (report.schedule.frequency) {
      case 'daily':
        return true;
        
      case 'weekly':
        return currentDayOfWeek === report.schedule.dayOfWeek;
        
      case 'monthly':
        return currentDayOfMonth === report.schedule.dayOfMonth;
        
      default:
        return false;
    }
  }
  
  /**
   * Generate a JSON report
   * 
   * @param {DashboardReport} report - The report definition
   * @param {DashboardMetrics} metrics - The metrics to include
   * @returns {string} The report content as JSON
   * @private
   */
  generateJsonReport(report, metrics) {
    try {
      // Filter metrics based on report configuration
      const filteredMetrics = {};
      
      for (const metricName of report.metrics) {
        if (metricName in metrics) {
          filteredMetrics[metricName] = metrics[metricName];
        }
      }
      
      // Add report metadata
      const jsonReport = {
        report: {
          id: report.id,
          name: report.name,
          description: report.description,
          generated: new Date().toISOString()
        },
        metrics: filteredMetrics
      };
      
      return JSON.stringify(jsonReport, null, 2);
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to generate JSON report: ${report.id}`, {
        category: 'monitoring',
        userFixable: false,
        recoverable: true,
        details: { error: error.message }
      });
      
      return JSON.stringify({ error: 'Failed to generate report' });
    }
  }
  
  /**
   * Generate an HTML report
   * 
   * @param {DashboardReport} report - The report definition
   * @param {DashboardMetrics} metrics - The metrics to include
   * @returns {string} The report content as HTML
   * @private
   */
  generateHtmlReport(report, metrics) {
    try {
      // In a real implementation, this would generate proper HTML with charts
      // For now, we'll just create a simple representation
      
      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${report.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            .section { margin-bottom: 30px; }
            .metric { margin-bottom: 10px; }
            .status-healthy { color: green; }
            .status-degraded { color: orange; }
            .status-critical { color: red; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>${report.name}</h1>
          <p>${report.description}</p>
          <p>Generated: ${new Date().toLocaleString()}</p>
      `;
      
      // Add each requested section
      for (const metricName of report.metrics) {
        if (metricName === 'systemHealth' && metrics.systemHealth) {
          html += this.generateSystemHealthHtml(metrics.systemHealth);
        } else if (metricName === 'performance' && metrics.performance) {
          html += this.generatePerformanceHtml(metrics.performance);
        } else if (metricName === 'usage' && metrics.usage) {
          html += this.generateUsageHtml(metrics.usage);
        } else if (metricName === 'proofMetrics' && metrics.proofMetrics) {
          html += this.generateProofMetricsHtml(metrics.proofMetrics);
        } else if (metricName === 'alertMetrics' && metrics.alertMetrics) {
          html += this.generateAlertMetricsHtml(metrics.alertMetrics);
        }
      }
      
      html += `
        </body>
        </html>
      `;
      
      return html;
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to generate HTML report: ${report.id}`, {
        category: 'monitoring',
        userFixable: false,
        recoverable: true,
        details: { error: error.message }
      });
      
      return `<html><body><h1>Error</h1><p>Failed to generate report</p></body></html>`;
    }
  }
  
  /**
   * Generate HTML for system health metrics
   * 
   * @param {DashboardMetrics['systemHealth']} health - The system health metrics
   * @returns {string} HTML for the system health section
   * @private
   */
  generateSystemHealthHtml(health) {
    return `
      <div class="section">
        <h2>System Health</h2>
        <div class="metric">
          <strong>Status:</strong> 
          <span class="status-${health.status}">${health.status.toUpperCase()}</span>
        </div>
        <div class="metric">
          <strong>Uptime:</strong> ${this.formatDuration(health.uptime)}
        </div>
        <div class="metric">
          <strong>Active Alerts:</strong> ${health.activeAlerts}
        </div>
        <div class="metric">
          <strong>Critical Alerts:</strong> ${health.criticalAlerts}
        </div>
        <div class="metric">
          <strong>CPU Usage:</strong> ${health.cpuUsage !== null ? health.cpuUsage.toFixed(2) + '%' : 'N/A'}
        </div>
        <div class="metric">
          <strong>Memory Usage:</strong> ${health.memoryUsage !== null ? health.memoryUsage.toFixed(2) + '%' : 'N/A'}
        </div>
        <div class="metric">
          <strong>Last Updated:</strong> ${health.lastUpdateTime.toLocaleString()}
        </div>
      </div>
    `;
  }
  
  /**
   * Generate HTML for performance metrics
   * 
   * @param {DashboardMetrics['performance']} performance - The performance metrics
   * @returns {string} HTML for the performance section
   * @private
   */
  generatePerformanceHtml(performance) {
    return `
      <div class="section">
        <h2>Performance</h2>
        <div class="metric">
          <strong>Average Response Time:</strong> 
          ${performance.avgResponseTime !== null ? performance.avgResponseTime.toFixed(2) + ' ms' : 'N/A'}
        </div>
        <div class="metric">
          <strong>95th Percentile Response Time:</strong> 
          ${performance.p95ResponseTime !== null ? performance.p95ResponseTime.toFixed(2) + ' ms' : 'N/A'}
        </div>
        <div class="metric">
          <strong>Error Rate:</strong> 
          ${performance.errorRate !== null ? performance.errorRate.toFixed(2) + '%' : 'N/A'}
        </div>
        <div class="metric">
          <strong>Requests Per Minute:</strong> 
          ${performance.requestsPerMinute !== null ? performance.requestsPerMinute.toFixed(2) : 'N/A'}
        </div>
      </div>
    `;
  }
  
  /**
   * Generate HTML for usage metrics
   * 
   * @param {DashboardMetrics['usage']} usage - The usage metrics
   * @returns {string} HTML for the usage section
   * @private
   */
  generateUsageHtml(usage) {
    return `
      <div class="section">
        <h2>Usage</h2>
        <div class="metric">
          <strong>Total Users:</strong> 
          ${usage.totalUsers !== null ? usage.totalUsers.toLocaleString() : 'N/A'}
        </div>
        <div class="metric">
          <strong>Active Users (Today):</strong> 
          ${usage.activeUsersToday !== null ? usage.activeUsersToday.toLocaleString() : 'N/A'}
        </div>
        <div class="metric">
          <strong>Active Users (Week):</strong> 
          ${usage.activeUsersWeek !== null ? usage.activeUsersWeek.toLocaleString() : 'N/A'}
        </div>
        <div class="metric">
          <strong>Active Users (Month):</strong> 
          ${usage.activeUsersMonth !== null ? usage.activeUsersMonth.toLocaleString() : 'N/A'}
        </div>
        <div class="metric">
          <strong>New Users (Today):</strong> 
          ${usage.newUsersToday !== null ? usage.newUsersToday.toLocaleString() : 'N/A'}
        </div>
        <div class="metric">
          <strong>Total Proofs:</strong> 
          ${usage.totalProofs !== null ? usage.totalProofs.toLocaleString() : 'N/A'}
        </div>
        <div class="metric">
          <strong>Proofs (Today):</strong> 
          ${usage.proofsToday !== null ? usage.proofsToday.toLocaleString() : 'N/A'}
        </div>
      </div>
    `;
  }
  
  /**
   * Generate HTML for proof metrics
   * 
   * @param {DashboardMetrics['proofMetrics']} proofMetrics - The proof metrics
   * @returns {string} HTML for the proof metrics section
   * @private
   */
  generateProofMetricsHtml(proofMetrics) {
    let html = `
      <div class="section">
        <h2>Proof Metrics</h2>
        <div class="metric">
          <strong>Success Rate:</strong> 
          ${proofMetrics.successRate !== null ? proofMetrics.successRate.toFixed(2) + '%' : 'N/A'}
        </div>
        <div class="metric">
          <strong>Average Generation Time:</strong> 
          ${proofMetrics.avgGenerationTime !== null ? proofMetrics.avgGenerationTime.toFixed(2) + ' ms' : 'N/A'}
        </div>
    `;
    
    // Add table for proof types
    if (Object.keys(proofMetrics.byType).length > 0) {
      html += `
        <h3>Proof Types</h3>
        <table>
          <tr>
            <th>Type</th>
            <th>Count</th>
            <th>Success Rate</th>
            <th>Avg Time (ms)</th>
          </tr>
      `;
      
      for (const [type, stats] of Object.entries(proofMetrics.byType)) {
        html += `
          <tr>
            <td>${type}</td>
            <td>${stats.count.toLocaleString()}</td>
            <td>${stats.successRate.toFixed(2)}%</td>
            <td>${stats.avgTime.toFixed(2)}</td>
          </tr>
        `;
      }
      
      html += `</table>`;
    }
    
    html += `</div>`;
    
    return html;
  }
  
  /**
   * Generate HTML for alert metrics
   * 
   * @param {DashboardMetrics['alertMetrics']} alertMetrics - The alert metrics
   * @returns {string} HTML for the alert metrics section
   * @private
   */
  generateAlertMetricsHtml(alertMetrics) {
    let html = `
      <div class="section">
        <h2>Alert Metrics</h2>
        <div class="metric">
          <strong>Alert Trigger Rate:</strong> 
          ${alertMetrics.triggerRate !== null ? alertMetrics.triggerRate.toFixed(2) + ' per day' : 'N/A'}
        </div>
        <div class="metric">
          <strong>Mean Time To Resolution:</strong> 
          ${alertMetrics.mttr !== null ? this.formatDuration(alertMetrics.mttr) : 'N/A'}
        </div>
        <div class="metric">
          <strong>Mean Time To Acknowledgment:</strong> 
          ${alertMetrics.mtta !== null ? this.formatDuration(alertMetrics.mtta) : 'N/A'}
        </div>
    `;
    
    // Add table for top alert types
    if (alertMetrics.topAlertTypes.length > 0) {
      html += `
        <h3>Top Alert Types</h3>
        <table>
          <tr>
            <th>Type</th>
            <th>Count</th>
          </tr>
      `;
      
      for (const alertType of alertMetrics.topAlertTypes) {
        html += `
          <tr>
            <td>${alertType.type}</td>
            <td>${alertType.count}</td>
          </tr>
        `;
      }
      
      html += `</table>`;
    }
    
    html += `</div>`;
    
    return html;
  }
  
  /**
   * Format a duration in seconds to a human-readable string
   * 
   * @param {number} seconds - The duration in seconds
   * @returns {string} Formatted duration string
   * @private
   */
  formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    seconds %= 86400;
    
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    
    const parts = [];
    
    if (days > 0) {
      parts.push(`${days}d`);
    }
    
    if (hours > 0 || days > 0) {
      parts.push(`${hours}h`);
    }
    
    if (minutes > 0 || hours > 0 || days > 0) {
      parts.push(`${minutes}m`);
    }
    
    parts.push(`${seconds}s`);
    
    return parts.join(' ');
  }
  
  /**
   * Shutdown the dashboard
   */
  shutdown() {
    // Stop update interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // Stop report interval
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }
    
    // Log shutdown
    zkErrorLogger.log('INFO', 'ExecutiveDashboard shutdown', {
      category: 'monitoring',
      userFixable: false,
      recoverable: true
    });
  }
}

// Create singleton instance
const executiveDashboard = new ExecutiveDashboard();

// Export for CommonJS
module.exports = {
  ExecutiveDashboard,
  executiveDashboard
};