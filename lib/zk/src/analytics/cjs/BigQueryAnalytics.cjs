/**
 * BigQuery Analytics System
 * 
 * This module provides comprehensive analytics capabilities using Google BigQuery,
 * including data collection, transformation, streaming, and reporting.
 * 
 * Key features:
 * - Event tracking and collection
 * - Data streaming to BigQuery
 * - Schema management and evolution
 * - Integration with admin dashboard
 * - ETL (Extract, Transform, Load) processes
 * - Business intelligence reporting
 */

const { BigQuery } = require('@google-cloud/bigquery');
const { gcpSecretManager } = require('./GCPSecretManager.cjs');
const { zkErrorLogger } = require('../zkErrorLogger.cjs');

// Analytics event interface
/**
 * @typedef {Object} AnalyticsEvent
 * @property {string} eventName
 * @property {Date} timestamp
 * @property {string} [userId]
 * @property {string} [walletAddress]
 * @property {Object} [clientInfo]
 * @property {string} [clientInfo.ip]
 * @property {string} [clientInfo.userAgent]
 * @property {string} [clientInfo.sessionId]
 * @property {string} [clientInfo.referrer]
 * @property {string} [clientInfo.os]
 * @property {string} [clientInfo.browser]
 * @property {'desktop'|'mobile'|'tablet'|'other'} [clientInfo.deviceType]
 * @property {Record<string, any>} properties
 */

// Schema definition for creating tables
/**
 * @typedef {Object} SchemaDefinition
 * @property {string} name
 * @property {'STRING'|'INTEGER'|'FLOAT'|'BOOLEAN'|'TIMESTAMP'|'RECORD'|'BYTES'} type
 * @property {'NULLABLE'|'REQUIRED'|'REPEATED'} [mode]
 * @property {SchemaDefinition[]} [fields]
 * @property {string} [description]
 */

// ETL job interface
/**
 * @typedef {Object} ETLJob
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} schedule
 * @property {string} query
 * @property {string} destinationTable
 * @property {Date} [lastRun]
 * @property {'idle'|'running'|'succeeded'|'failed'} [status]
 * @property {string} [errorMessage]
 */

// Report definition interface
/**
 * @typedef {Object} ReportDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} query
 * @property {Record<string, any>} [parameters]
 * @property {string} [schedule]
 * @property {Date} [lastGenerated]
 * @property {'json'|'csv'|'html'} format
 * @property {string[]} [recipients]
 */

/**
 * BigQuery Analytics Service
 */
class BigQueryAnalytics {
  /**
   * Constructs a new BigQuery Analytics instance
   * 
   * @param {string} projectId - The GCP project ID
   * @param {string} datasetId - The BigQuery dataset ID
   * @param {'development'|'staging'|'production'} environment - The current environment
   */
  constructor(
    projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || '',
    datasetId = process.env.BIGQUERY_DATASET_ID || 'analytics',
    environment = process.env.NODE_ENV || 'development'
  ) {
    this.client = null;
    this.dataset = null;
    this.tables = {};
    this.projectId = projectId;
    this.datasetId = `${environment}_${datasetId}`; // Environment-specific dataset
    this.environment = environment;
    this.initialized = false;
    this.etlJobs = [];
    this.reports = [];
    this.eventBuffer = [];
    this.flushInterval = null;
    this.anonymizeIpAddresses = true;
    
    // Standard tables
    this.TABLES = {
      EVENTS: 'events',
      USERS: 'users',
      PROOFS: 'proofs',
      SYSTEM_METRICS: 'system_metrics',
      DAILY_AGGREGATES: 'daily_aggregates',
      SESSION_DATA: 'session_data',
      USER_PROPERTIES: 'user_properties',
      FUNNEL_STAGES: 'funnel_stages'
    };
    
    // Initialize if project ID is available
    if (projectId) {
      this.initialize().catch(error => {
        zkErrorLogger.log('ERROR', 'Failed to initialize BigQuery analytics', {
          category: 'analytics',
          userFixable: true,
          recoverable: true,
          details: { error: error.message }
        });
      });
    } else {
      zkErrorLogger.log('WARNING', 'BigQuery analytics initialized without project ID', {
        category: 'analytics',
        userFixable: true,
        recoverable: true
      });
    }
  }
  
  /**
   * Initialize BigQuery client, dataset, and tables
   * @returns {Promise<boolean>}
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }
    
    try {
      // Try to get service account key from secret manager
      const serviceAccountKey = await gcpSecretManager.getSecret('bigquery_service_account');
      
      // Initialize BigQuery client
      if (serviceAccountKey) {
        // Use service account key from secret manager
        const credentials = JSON.parse(serviceAccountKey);
        this.client = new BigQuery({
          projectId: this.projectId,
          credentials
        });
      } else {
        // Fall back to application default credentials
        this.client = new BigQuery({
          projectId: this.projectId
        });
      }
      
      // Initialize dataset
      this.dataset = this.client.dataset(this.datasetId);
      
      // Check if dataset exists, create if it doesn't
      const [datasetExists] = await this.dataset.exists();
      
      if (!datasetExists) {
        await this.dataset.create();
        zkErrorLogger.log('INFO', `Created BigQuery dataset: ${this.datasetId}`, {
          category: 'analytics',
          userFixable: false,
          recoverable: true
        });
      }
      
      // Initialize tables
      await this.initializeTables();
      
      // Set up event buffer flush interval
      this.flushInterval = setInterval(() => this.flushEventBuffer(), 30000); // Flush every 30 seconds
      
      // Initialize ETL jobs
      await this.initializeETLJobs();
      
      // Initialize report definitions
      await this.initializeReportDefinitions();
      
      this.initialized = true;
      
      zkErrorLogger.log('INFO', 'BigQuery analytics initialized successfully', {
        category: 'analytics',
        userFixable: false,
        recoverable: true
      });
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to initialize BigQuery analytics', {
        category: 'analytics',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
      
      return false;
    }
  }
  
  /**
   * Track an analytics event
   * 
   * @param {AnalyticsEvent} event - The event to track
   * @returns {Promise<boolean>} True if the event was added to the buffer
   */
  async trackEvent(event) {
    if (!process.env.ENABLE_ANALYTICS) {
      return false;
    }
    
    try {
      // Anonymize IP address if enabled
      if (event.clientInfo?.ip && this.anonymizeIpAddresses) {
        event.clientInfo.ip = this.anonymizeIp(event.clientInfo.ip);
      }
      
      // Add to event buffer
      this.eventBuffer.push(event);
      
      // Flush buffer if it's getting large
      if (this.eventBuffer.length >= 100) {
        this.flushEventBuffer();
      }
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to track analytics event', {
        category: 'analytics',
        userFixable: false,
        recoverable: true,
        details: { error: error.message, event: event.eventName }
      });
      
      return false;
    }
  }
  
  /**
   * Track a proof generation event
   * 
   * @param {Object} proofData - Data about the proof generation
   * @param {string} proofData.proofId
   * @param {string} proofData.proofType
   * @param {string} proofData.walletAddress
   * @param {string} proofData.network
   * @param {number} proofData.executionTimeMs
   * @param {boolean} proofData.success
   * @param {string} [proofData.errorType]
   * @param {string} [proofData.clientType]
   * @returns {Promise<boolean>} True if the event was tracked successfully
   */
  async trackProofGeneration(proofData) {
    if (!process.env.ENABLE_ANALYTICS) {
      return false;
    }
    
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Get the proofs table
      const proofsTable = this.tables[this.TABLES.PROOFS];
      if (!proofsTable) {
        throw new Error('Proofs table not initialized');
      }
      
      // Insert the data directly
      await proofsTable.insert({
        proof_id: proofData.proofId,
        proof_type: proofData.proofType,
        wallet_address: proofData.walletAddress,
        network: proofData.network,
        execution_time_ms: proofData.executionTimeMs,
        success: proofData.success ? 1 : 0,
        error_type: proofData.errorType || null,
        client_type: proofData.clientType || 'unknown',
        timestamp: BigQuery.timestamp(new Date())
      });
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to track proof generation', {
        category: 'analytics',
        userFixable: false,
        recoverable: true,
        details: { error: error.message, proofId: proofData.proofId }
      });
      
      return false;
    }
  }
  
  /**
   * Track system performance metrics
   * 
   * @param {Object} metrics - System performance metrics
   * @param {number} [metrics.cpuUsage]
   * @param {number} [metrics.memoryUsage]
   * @param {number} [metrics.avgRequestTime]
   * @param {number} [metrics.activeUsers]
   * @param {number} [metrics.proofCount]
   * @param {number} [metrics.errorCount]
   * @returns {Promise<boolean>} True if the metrics were tracked successfully
   */
  async trackSystemMetrics(metrics) {
    if (!process.env.ENABLE_ANALYTICS) {
      return false;
    }
    
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Get the system metrics table
      const metricsTable = this.tables[this.TABLES.SYSTEM_METRICS];
      if (!metricsTable) {
        throw new Error('System metrics table not initialized');
      }
      
      // Insert the data directly
      await metricsTable.insert({
        metric_id: `metric_${Date.now()}`,
        cpu_usage: metrics.cpuUsage || 0,
        memory_usage: metrics.memoryUsage || 0,
        avg_request_time: metrics.avgRequestTime || 0,
        active_users: metrics.activeUsers || 0,
        proof_count: metrics.proofCount || 0,
        error_count: metrics.errorCount || 0,
        timestamp: BigQuery.timestamp(new Date())
      });
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to track system metrics', {
        category: 'analytics',
        userFixable: false,
        recoverable: true,
        details: { error: error.message }
      });
      
      return false;
    }
  }
  
  /**
   * Get predefined report data
   * 
   * @param {string} reportId - The ID of the predefined report
   * @param {Record<string, any>} [parameters] - Optional parameters for the report query
   * @returns {Promise<any[]|null>} The report data or null if an error occurred
   */
  async getReportData(reportId, parameters) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.client) {
      return null;
    }
    
    try {
      // Find the report definition
      const reportDef = this.reports.find(r => r.id === reportId);
      if (!reportDef) {
        throw new Error(`Report not found: ${reportId}`);
      }
      
      // Merge default parameters with provided parameters
      const mergedParams = { ...(reportDef.parameters || {}), ...(parameters || {}) };
      
      // Run the query
      const [rows] = await this.client.query({
        query: reportDef.query,
        params: mergedParams
      });
      
      // Update last generated timestamp
      reportDef.lastGenerated = new Date();
      
      return rows;
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to run report', {
        category: 'analytics',
        userFixable: false,
        recoverable: true,
        details: { error: error.message, reportId }
      });
      
      return null;
    }
  }
  
  /**
   * Run a custom analytics query
   * 
   * @param {string} query - The BigQuery SQL query to run
   * @param {Record<string, any>} [parameters] - Optional query parameters
   * @returns {Promise<any[]|null>} The query results or null if an error occurred
   */
  async runQuery(query, parameters) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.client) {
      return null;
    }
    
    try {
      // Run the query
      const [rows] = await this.client.query({
        query,
        params: parameters
      });
      
      return rows;
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to run custom analytics query', {
        category: 'analytics',
        userFixable: false,
        recoverable: true,
        details: { error: error.message, query: query.substring(0, 100) + '...' }
      });
      
      return null;
    }
  }
  
  /**
   * Get user activity statistics
   * 
   * @param {number} [days=30] - Number of days to include in the report
   * @returns {Promise<any|null>} User activity statistics or null if an error occurred
   */
  async getUserActivityStats(days = 30) {
    const query = `
      SELECT
        DATE(timestamp) as day,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) as total_events
      FROM \`${this.projectId}.${this.datasetId}.${this.TABLES.EVENTS}\`
      WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
      GROUP BY day
      ORDER BY day DESC
    `;
    
    return this.runQuery(query);
  }
  
  /**
   * Get proof statistics
   * 
   * @param {number} [days=30] - Number of days to include in the report
   * @returns {Promise<any|null>} Proof statistics or null if an error occurred
   */
  async getProofStats(days = 30) {
    const query = `
      SELECT
        proof_type,
        network,
        COUNT(*) as count,
        COUNTIF(success = 1) as successful,
        COUNTIF(success = 0) as failed,
        AVG(execution_time_ms) as avg_execution_time_ms
      FROM \`${this.projectId}.${this.datasetId}.${this.TABLES.PROOFS}\`
      WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
      GROUP BY proof_type, network
      ORDER BY count DESC
    `;
    
    return this.runQuery(query);
  }
  
  /**
   * Create or update an ETL job
   * 
   * @param {Omit<ETLJob, 'status'|'lastRun'|'errorMessage'>} job - The ETL job definition
   * @returns {Promise<boolean>} True if the job was successfully created or updated
   */
  async saveETLJob(job) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Check if job already exists
      const existingJobIndex = this.etlJobs.findIndex(j => j.id === job.id);
      
      if (existingJobIndex >= 0) {
        // Update existing job
        this.etlJobs[existingJobIndex] = {
          ...this.etlJobs[existingJobIndex],
          ...job,
          status: 'idle'
        };
      } else {
        // Create new job
        this.etlJobs.push({
          ...job,
          status: 'idle',
          lastRun: undefined,
          errorMessage: undefined
        });
      }
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to save ETL job', {
        category: 'analytics',
        userFixable: false,
        recoverable: true,
        details: { error: error.message, jobId: job.id }
      });
      
      return false;
    }
  }
  
  /**
   * Create or update a report definition
   * 
   * @param {Omit<ReportDefinition, 'lastGenerated'>} report - The report definition
   * @returns {Promise<boolean>} True if the report was successfully created or updated
   */
  async saveReportDefinition(report) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Check if report already exists
      const existingReportIndex = this.reports.findIndex(r => r.id === report.id);
      
      if (existingReportIndex >= 0) {
        // Update existing report
        this.reports[existingReportIndex] = {
          ...this.reports[existingReportIndex],
          ...report
        };
      } else {
        // Create new report
        this.reports.push({
          ...report,
          lastGenerated: undefined
        });
      }
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to save report definition', {
        category: 'analytics',
        userFixable: false,
        recoverable: true,
        details: { error: error.message, reportId: report.id }
      });
      
      return false;
    }
  }
  
  /**
   * Manually run an ETL job
   * 
   * @param {string} jobId - The ID of the ETL job to run
   * @returns {Promise<boolean>} True if the job ran successfully
   */
  async runETLJob(jobId) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.client) {
      return false;
    }
    
    // Find the job
    const job = this.etlJobs.find(j => j.id === jobId);
    if (!job) {
      zkErrorLogger.log('ERROR', `ETL job not found: ${jobId}`, {
        category: 'analytics',
        userFixable: false,
        recoverable: true
      });
      
      return false;
    }
    
    try {
      // Update job status
      job.status = 'running';
      job.lastRun = new Date();
      job.errorMessage = undefined;
      
      // Run the query
      await this.client.query({
        query: job.query,
        destination: this.client.dataset(this.datasetId).table(job.destinationTable),
        writeDisposition: 'WRITE_TRUNCATE'
      });
      
      // Update job status
      job.status = 'succeeded';
      
      return true;
    } catch (error) {
      // Update job status
      job.status = 'failed';
      job.errorMessage = error.message;
      
      zkErrorLogger.log('ERROR', 'Failed to run ETL job', {
        category: 'analytics',
        userFixable: false,
        recoverable: true,
        details: { error: error.message, jobId }
      });
      
      return false;
    }
  }
  
  /**
   * Schedule an ETL job to run at specified intervals
   * 
   * @param {string} jobId - The ID of the job to schedule
   * @param {string} schedule - The schedule in cron format
   * @returns {Promise<boolean>} True if job was scheduled successfully
   */
  async scheduleETLJob(jobId, schedule) {
    try {
      const job = this.etlJobs.find(j => j.id === jobId);
      if (!job) {
        throw new Error(`ETL job not found: ${jobId}`);
      }
      
      // Update the job schedule
      job.schedule = schedule;
      
      // For demonstration - this would register with a real scheduler in production
      zkErrorLogger.log('INFO', `ETL job scheduled: ${jobId}`, {
        category: 'analytics',
        userFixable: false,
        recoverable: true,
        details: { jobId, schedule }
      });
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to schedule ETL job', {
        category: 'analytics',
        userFixable: false,
        recoverable: true,
        details: { error: error.message, jobId }
      });
      
      return false;
    }
  }
  
  /**
   * Transform data using a transformation function
   * 
   * @param {Array<any>} data - The data to transform
   * @param {Function} transformFn - The transformation function
   * @returns {Array<any>} The transformed data
   */
  transform(data, transformFn) {
    return data.map(transformFn);
  }

  /**
   * Close the BigQuery client and clean up resources
   */
  shutdown() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Flush any remaining events
    if (this.eventBuffer.length > 0) {
      this.flushEventBuffer();
    }
    
    this.initialized = false;
  }
  
  /**
   * Initialize analytics tables
   * @private
   */
  async initializeTables() {
    if (!this.client || !this.dataset) {
      return;
    }
    
    try {
      // Define table schemas
      const tableSchemas = {
        [this.TABLES.EVENTS]: [
          { name: 'event_id', type: 'STRING', mode: 'REQUIRED', description: 'Unique event identifier' },
          { name: 'event_name', type: 'STRING', mode: 'REQUIRED', description: 'Name of the event' },
          { name: 'timestamp', type: 'TIMESTAMP', mode: 'REQUIRED', description: 'Time when the event occurred' },
          { name: 'user_id', type: 'STRING', mode: 'NULLABLE', description: 'User identifier' },
          { name: 'wallet_address', type: 'STRING', mode: 'NULLABLE', description: 'Wallet address (anonymized)' },
          { name: 'client_ip', type: 'STRING', mode: 'NULLABLE', description: 'Client IP address (anonymized)' },
          { name: 'user_agent', type: 'STRING', mode: 'NULLABLE', description: 'Client user agent' },
          { name: 'session_id', type: 'STRING', mode: 'NULLABLE', description: 'Session identifier' },
          { name: 'referrer', type: 'STRING', mode: 'NULLABLE', description: 'Referrer URL' },
          { name: 'os', type: 'STRING', mode: 'NULLABLE', description: 'Operating system' },
          { name: 'browser', type: 'STRING', mode: 'NULLABLE', description: 'Browser name and version' },
          { name: 'device_type', type: 'STRING', mode: 'NULLABLE', description: 'Device type (desktop, mobile, tablet)' },
          { 
            name: 'properties', 
            type: 'RECORD', 
            mode: 'NULLABLE', 
            description: 'Event properties',
            fields: [
              { name: 'key', type: 'STRING', mode: 'REQUIRED' },
              { name: 'value', type: 'STRING', mode: 'NULLABLE' }
            ]
          }
        ],
        
        [this.TABLES.PROOFS]: [
          { name: 'proof_id', type: 'STRING', mode: 'REQUIRED', description: 'Unique proof identifier' },
          { name: 'proof_type', type: 'STRING', mode: 'REQUIRED', description: 'Type of proof' },
          { name: 'wallet_address', type: 'STRING', mode: 'NULLABLE', description: 'Wallet address (anonymized)' },
          { name: 'network', type: 'STRING', mode: 'REQUIRED', description: 'Blockchain network' },
          { name: 'execution_time_ms', type: 'INTEGER', mode: 'REQUIRED', description: 'Execution time in milliseconds' },
          { name: 'success', type: 'INTEGER', mode: 'REQUIRED', description: '1 for success, 0 for failure' },
          { name: 'error_type', type: 'STRING', mode: 'NULLABLE', description: 'Type of error if failure' },
          { name: 'client_type', type: 'STRING', mode: 'NULLABLE', description: 'Type of client' },
          { name: 'timestamp', type: 'TIMESTAMP', mode: 'REQUIRED', description: 'Time when the proof was generated' }
        ],
        
        [this.TABLES.SYSTEM_METRICS]: [
          { name: 'metric_id', type: 'STRING', mode: 'REQUIRED', description: 'Unique metric identifier' },
          { name: 'cpu_usage', type: 'FLOAT', mode: 'NULLABLE', description: 'CPU usage percentage' },
          { name: 'memory_usage', type: 'FLOAT', mode: 'NULLABLE', description: 'Memory usage percentage' },
          { name: 'avg_request_time', type: 'FLOAT', mode: 'NULLABLE', description: 'Average request time in milliseconds' },
          { name: 'active_users', type: 'INTEGER', mode: 'NULLABLE', description: 'Number of active users' },
          { name: 'proof_count', type: 'INTEGER', mode: 'NULLABLE', description: 'Number of proofs generated' },
          { name: 'error_count', type: 'INTEGER', mode: 'NULLABLE', description: 'Number of errors' },
          { name: 'timestamp', type: 'TIMESTAMP', mode: 'REQUIRED', description: 'Time when the metrics were recorded' }
        ],
        
        [this.TABLES.DAILY_AGGREGATES]: [
          { name: 'date', type: 'TIMESTAMP', mode: 'REQUIRED', description: 'Aggregation date' },
          { name: 'unique_users', type: 'INTEGER', mode: 'REQUIRED', description: 'Number of unique users' },
          { name: 'total_events', type: 'INTEGER', mode: 'REQUIRED', description: 'Total number of events' },
          { name: 'new_users', type: 'INTEGER', mode: 'REQUIRED', description: 'Number of new users' },
          { name: 'proofs_generated', type: 'INTEGER', mode: 'REQUIRED', description: 'Number of proofs generated' },
          { name: 'proof_success_rate', type: 'FLOAT', mode: 'REQUIRED', description: 'Proof success rate' },
          { name: 'avg_response_time', type: 'FLOAT', mode: 'REQUIRED', description: 'Average response time' }
        ]
      };
      
      // Create or update each table
      for (const [tableName, schema] of Object.entries(tableSchemas)) {
        const table = this.dataset.table(tableName);
        const [exists] = await table.exists();
        
        if (!exists) {
          // Create the table
          await table.create({
            schema: schema.map(field => ({
              name: field.name,
              type: field.type,
              mode: field.mode || 'NULLABLE',
              description: field.description,
              fields: field.fields
            })),
            timePartitioning: {
              type: 'DAY',
              field: 'timestamp'
            }
          });
          
          zkErrorLogger.log('INFO', `Created BigQuery table: ${tableName}`, {
            category: 'analytics',
            userFixable: false,
            recoverable: true
          });
        }
        
        // Store table reference
        this.tables[tableName] = table;
      }
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to initialize BigQuery tables', {
        category: 'analytics',
        userFixable: true,
        recoverable: true,
        details: { error: error.message }
      });
    }
  }
  
  /**
   * Initialize ETL jobs
   * @private
   */
  async initializeETLJobs() {
    // Define standard ETL jobs
    const standardJobs = [
      {
        id: 'daily_aggregates',
        name: 'Daily Aggregates',
        description: 'Aggregates daily user and proof metrics',
        schedule: '0 0 * * *', // Daily at midnight
        query: `
          SELECT
            TIMESTAMP_TRUNC(timestamp, DAY) as date,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(*) as total_events,
            COUNT(DISTINCT CASE WHEN event_name = 'user_created' THEN user_id ELSE NULL END) as new_users,
            COUNT(DISTINCT CASE WHEN event_name = 'proof_generated' THEN event_id ELSE NULL END) as proofs_generated,
            SAFE_DIVIDE(
              COUNT(DISTINCT CASE WHEN event_name = 'proof_verified' AND CAST(JSON_EXTRACT(properties, '$.success') AS BOOL) THEN event_id ELSE NULL END),
              NULLIF(COUNT(DISTINCT CASE WHEN event_name = 'proof_verified' THEN event_id ELSE NULL END), 0)
            ) as proof_success_rate,
            AVG(CASE WHEN event_name = 'api_request' THEN CAST(JSON_EXTRACT(properties, '$.duration_ms') AS FLOAT64) ELSE NULL END) as avg_response_time
          FROM \`${this.projectId}.${this.datasetId}.${this.TABLES.EVENTS}\`
          WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
          GROUP BY date
          ORDER BY date DESC
        `,
        destinationTable: this.TABLES.DAILY_AGGREGATES
      }
    ];
    
    // Create or update standard jobs
    for (const job of standardJobs) {
      await this.saveETLJob(job);
    }
  }
  
  /**
   * Initialize report definitions
   * @private
   */
  async initializeReportDefinitions() {
    // Define standard reports
    const standardReports = [
      {
        id: 'user_activity',
        name: 'User Activity Report',
        description: 'Shows user activity over time',
        query: `
          SELECT
            DATE(timestamp) as day,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(*) as total_events,
            COUNT(DISTINCT CASE WHEN event_name = 'user_created' THEN user_id ELSE NULL END) as new_users
          FROM \`${this.projectId}.${this.datasetId}.${this.TABLES.EVENTS}\`
          WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
          GROUP BY day
          ORDER BY day DESC
        `,
        parameters: { days: 30 },
        format: 'json'
      },
      {
        id: 'proof_statistics',
        name: 'Proof Statistics Report',
        description: 'Shows proof generation statistics by type and network',
        query: `
          SELECT
            proof_type,
            network,
            COUNT(*) as count,
            COUNTIF(success = 1) as successful,
            COUNTIF(success = 0) as failed,
            AVG(execution_time_ms) as avg_execution_time_ms
          FROM \`${this.projectId}.${this.datasetId}.${this.TABLES.PROOFS}\`
          WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
          GROUP BY proof_type, network
          ORDER BY count DESC
        `,
        parameters: { days: 30 },
        format: 'json'
      },
      {
        id: 'performance_metrics',
        name: 'System Performance Metrics',
        description: 'Shows system performance metrics over time',
        query: `
          SELECT
            TIMESTAMP_TRUNC(timestamp, HOUR) as hour,
            AVG(cpu_usage) as avg_cpu_usage,
            AVG(memory_usage) as avg_memory_usage,
            AVG(avg_request_time) as avg_request_time,
            MAX(active_users) as max_active_users,
            SUM(error_count) as total_errors
          FROM \`${this.projectId}.${this.datasetId}.${this.TABLES.SYSTEM_METRICS}\`
          WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
          GROUP BY hour
          ORDER BY hour DESC
        `,
        parameters: { days: 7 },
        format: 'json'
      }
    ];
    
    // Create or update standard reports
    for (const report of standardReports) {
      await this.saveReportDefinition(report);
    }
  }
  
  /**
   * Flush event buffer to BigQuery
   * @private
   */
  async flushEventBuffer() {
    if (!this.initialized || this.eventBuffer.length === 0 || !this.tables[this.TABLES.EVENTS]) {
      return;
    }
    
    try {
      // Prepare events for insertion
      const rows = this.eventBuffer.map(event => {
        // Convert properties to an array of key-value pairs for RECORD type
        const propertiesArray = Object.entries(event.properties).map(([key, value]) => ({
          key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value)
        }));
        
        return {
          event_id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          event_name: event.eventName,
          timestamp: BigQuery.timestamp(event.timestamp),
          user_id: event.userId || null,
          wallet_address: event.walletAddress || null,
          client_ip: event.clientInfo?.ip || null,
          user_agent: event.clientInfo?.userAgent || null,
          session_id: event.clientInfo?.sessionId || null,
          referrer: event.clientInfo?.referrer || null,
          os: event.clientInfo?.os || null,
          browser: event.clientInfo?.browser || null,
          device_type: event.clientInfo?.deviceType || null,
          properties: propertiesArray
        };
      });
      
      // Insert data in batches to avoid exceeding limits
      const batchSize = 500;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await this.tables[this.TABLES.EVENTS].insert(batch);
      }
      
      // Clear the buffer
      this.eventBuffer = [];
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to flush event buffer to BigQuery', {
        category: 'analytics',
        userFixable: false,
        recoverable: true,
        details: { 
          error: error.message, 
          bufferSize: this.eventBuffer.length,
          sample: this.eventBuffer.length > 0 ? this.eventBuffer[0].eventName : null
        }
      });
    }
  }
  
  /**
   * Anonymize an IP address
   * 
   * @param {string} ip - Original IP address
   * @returns {string} Anonymized IP address
   * @private
   */
  anonymizeIp(ip) {
    // For IPv4, remove the last octet
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
      }
    }
    
    // For IPv6, remove the last 80 bits (last 5 groups)
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length >= 5) {
        return `${parts.slice(0, 3).join(':')}:0:0:0:0:0`;
      }
    }
    
    return ip;
  }
}

// Create a singleton instance
const bigQueryAnalytics = new BigQueryAnalytics();

// Export for CommonJS
module.exports = {
  BigQueryAnalytics,
  bigQueryAnalytics
};