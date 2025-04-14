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

import { BigQuery, Dataset, Table } from '@google-cloud/bigquery';
import { gcpSecretManager } from './GCPSecretManager';
import { zkErrorLogger } from '../zkErrorLogger.mjs';

// Analytics event interface
export interface AnalyticsEvent {
  eventName: string;
  timestamp: Date;
  userId?: string;
  walletAddress?: string;
  clientInfo?: {
    ip?: string;
    userAgent?: string;
    sessionId?: string;
    referrer?: string;
    os?: string;
    browser?: string;
    deviceType?: 'desktop' | 'mobile' | 'tablet' | 'other';
  };
  properties: Record<string, any>;
}

// Schema definition for creating tables
export interface SchemaDefinition {
  name: string;
  type: 'STRING' | 'INTEGER' | 'FLOAT' | 'BOOLEAN' | 'TIMESTAMP' | 'RECORD' | 'BYTES';
  mode?: 'NULLABLE' | 'REQUIRED' | 'REPEATED';
  fields?: SchemaDefinition[]; // For RECORD type
  description?: string;
}

// ETL job interface
export interface ETLJob {
  id: string;
  name: string;
  description: string;
  schedule: string; // CRON format
  query: string;
  destinationTable: string;
  lastRun?: Date;
  status?: 'idle' | 'running' | 'succeeded' | 'failed';
  errorMessage?: string;
}

// Report definition interface
export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  query: string;
  parameters?: Record<string, any>;
  schedule?: string; // CRON format
  lastGenerated?: Date;
  format: 'json' | 'csv' | 'html';
  recipients?: string[]; // Email addresses
}

/**
 * BigQuery Analytics Service
 */
export class BigQueryAnalytics {
  private client: BigQuery | null = null;
  private dataset: Dataset | null = null;
  private tables: Record<string, Table> = {};
  private projectId: string;
  private datasetId: string;
  private initialized: boolean = false;
  private environment: 'development' | 'staging' | 'production';
  private etlJobs: ETLJob[] = [];
  private reports: ReportDefinition[] = [];
  private eventBuffer: AnalyticsEvent[] = [];
  private flushInterval: any = null;
  private anonymizeIpAddresses: boolean = true;
  
  // Standard tables
  private readonly TABLES = {
    EVENTS: 'events',
    USERS: 'users',
    PROOFS: 'proofs',
    SYSTEM_METRICS: 'system_metrics',
    DAILY_AGGREGATES: 'daily_aggregates',
    SESSION_DATA: 'session_data',
    USER_PROPERTIES: 'user_properties',
    FUNNEL_STAGES: 'funnel_stages'
  };
  
  /**
   * Constructs a new BigQuery Analytics instance
   * 
   * @param projectId - The GCP project ID
   * @param datasetId - The BigQuery dataset ID
   * @param environment - The current environment (development, staging, production)
   */
  constructor(
    projectId: string = process.env.GOOGLE_CLOUD_PROJECT_ID || '',
    datasetId: string = process.env.BIGQUERY_DATASET_ID || 'analytics',
    environment: 'development' | 'staging' | 'production' = 
      (process.env.NODE_ENV as any) || 'development'
  ) {
    this.projectId = projectId;
    this.datasetId = `${environment}_${datasetId}`; // Environment-specific dataset
    this.environment = environment;
    
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
   */
  public async initialize(): Promise<boolean> {
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
   * @param event - The event to track
   * @returns True if the event was added to the buffer
   */
  public async trackEvent(event: AnalyticsEvent): Promise<boolean> {
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
   * @param proofData - Data about the proof generation
   * @returns True if the event was tracked successfully
   */
  public async trackProofGeneration(proofData: {
    proofId: string;
    proofType: string;
    walletAddress: string;
    network: string;
    executionTimeMs: number;
    success: boolean;
    errorType?: string;
    clientType?: string;
  }): Promise<boolean> {
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
   * @param metrics - System performance metrics
   * @returns True if the metrics were tracked successfully
   */
  public async trackSystemMetrics(metrics: {
    cpuUsage?: number;
    memoryUsage?: number;
    avgRequestTime?: number;
    activeUsers?: number;
    proofCount?: number;
    errorCount?: number;
  }): Promise<boolean> {
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
   * @param reportId - The ID of the predefined report
   * @param parameters - Optional parameters for the report query
   * @returns The report data or null if an error occurred
   */
  public async getReportData(
    reportId: string,
    parameters?: Record<string, any>
  ): Promise<any[] | null> {
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
      const mergedParams = { ...reportDef.parameters, ...parameters };
      
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
   * Stream data to BigQuery in real-time
   * 
   * @param tableName - The name of the table to stream data to
   * @param data - The data to stream
   * @param options - Optional streaming options
   * @returns True if the data was streamed successfully
   */
  public async streamData(
    tableName: string,
    data: Record<string, any>[],
    options?: {
      skipInvalidRows?: boolean;
      ignoreUnknownValues?: boolean;
      templateSuffix?: string;
    }
  ): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.client) {
      return false;
    }
    
    try {
      // Get the table
      const table = this.tables[tableName] || this.dataset?.table(tableName);
      if (!table) {
        throw new Error(`Table not found: ${tableName}`);
      }
      
      // Insert the data
      await table.insert(data, {
        skipInvalidRows: options?.skipInvalidRows,
        ignoreUnknownValues: options?.ignoreUnknownValues,
        templateSuffix: options?.templateSuffix
      });
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to stream data to BigQuery', {
        category: 'analytics',
        userFixable: false,
        recoverable: true,
        details: { error: error.message, tableName, dataSize: data.length }
      });
      
      return false;
    }
  }
  
  /**
   * Run a custom analytics query
   * 
   * @param query - The BigQuery SQL query to run
   * @param parameters - Optional query parameters
   * @returns The query results or null if an error occurred
   */
  public async runQuery(
    query: string,
    parameters?: Record<string, any>
  ): Promise<any[] | null> {
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
   * @param days - Number of days to include in the report
   * @returns User activity statistics or null if an error occurred
   */
  public async getUserActivityStats(days: number = 30): Promise<any | null> {
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
   * @param days - Number of days to include in the report
   * @returns Proof statistics or null if an error occurred
   */
  public async getProofStats(days: number = 30): Promise<any | null> {
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
   * Create a new BigQuery table with the specified schema
   * 
   * @param tableName - The name of the table to create
   * @param schema - The schema definition for the table
   * @param options - Optional table creation options
   * @returns True if the table was created successfully
   */
  public async createTable(
    tableName: string,
    schema: SchemaDefinition[],
    options?: {
      timePartitioning?: { type: 'DAY' | 'HOUR'; field?: string };
      clustering?: { fields: string[] };
      description?: string;
    }
  ): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.client || !this.dataset) {
      return false;
    }
    
    try {
      // Check if table already exists
      const table = this.dataset.table(tableName);
      const [exists] = await table.exists();
      
      if (exists) {
        zkErrorLogger.log('WARNING', `Table already exists: ${tableName}`, {
          category: 'analytics',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      // Create the table
      await table.create({
        schema: schema.map(field => ({
          name: field.name,
          type: field.type,
          mode: field.mode || 'NULLABLE',
          description: field.description,
          fields: field.fields
        })),
        timePartitioning: options?.timePartitioning,
        clustering: options?.clustering,
        description: options?.description
      });
      
      // Store table reference
      this.tables[tableName] = table;
      
      zkErrorLogger.log('INFO', `Created BigQuery table: ${tableName}`, {
        category: 'analytics',
        userFixable: false,
        recoverable: true
      });
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to create BigQuery table', {
        category: 'analytics',
        userFixable: true,
        recoverable: true,
        details: { error: error.message, tableName }
      });
      
      return false;
    }
  }
  
  /**
   * Update the schema of an existing BigQuery table
   * 
   * @param tableName - The name of the table to update
   * @param schemaUpdates - The schema fields to add (BigQuery only allows adding new fields)
   * @returns True if the schema was updated successfully
   */
  public async updateSchema(
    tableName: string,
    schemaUpdates: SchemaDefinition[]
  ): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.client || !this.dataset) {
      return false;
    }
    
    try {
      // Get the table
      const table = this.tables[tableName] || this.dataset.table(tableName);
      const [exists] = await table.exists();
      
      if (!exists) {
        zkErrorLogger.log('WARNING', `Table does not exist: ${tableName}`, {
          category: 'analytics',
          userFixable: true,
          recoverable: true
        });
        return false;
      }
      
      // Get current schema
      const [metadata] = await table.getMetadata();
      const currentSchema = metadata.schema.fields;
      
      // Add new fields to schema (BigQuery only allows adding new fields)
      const updatedSchema = [
        ...currentSchema,
        ...schemaUpdates.map(field => ({
          name: field.name,
          type: field.type,
          mode: field.mode || 'NULLABLE',
          description: field.description,
          fields: field.fields
        }))
      ];
      
      // Update the table schema
      await table.setMetadata({
        schema: {
          fields: updatedSchema
        }
      });
      
      zkErrorLogger.log('INFO', `Updated schema for BigQuery table: ${tableName}`, {
        category: 'analytics',
        userFixable: false,
        recoverable: true,
        details: { addedFields: schemaUpdates.map(f => f.name) }
      });
      
      return true;
    } catch (error) {
      zkErrorLogger.log('ERROR', 'Failed to update BigQuery table schema', {
        category: 'analytics',
        userFixable: true,
        recoverable: true,
        details: { error: error.message, tableName }
      });
      
      return false;
    }
  }
  
  /**
   * Create or update an ETL job
   * 
   * @param job - The ETL job definition
   * @returns True if the job was successfully created or updated
   */
  public async saveETLJob(job: Omit<ETLJob, 'status' | 'lastRun' | 'errorMessage'>): Promise<boolean> {
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
   * Manage ETL (Extract, Transform, Load) job
   * 
   * @param operation - The operation to perform (create, update, delete, schedule, run)
   * @param job - The ETL job definition or ID
   * @returns The result of the operation
   */
  public async manageETLJob(
    operation: 'create' | 'update' | 'delete' | 'schedule' | 'run',
    job: ETLJob | string
  ): Promise<boolean | ETLJob | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      switch (operation) {
        case 'create':
        case 'update':
          if (typeof job === 'string') {
            throw new Error('Job definition is required for create/update operations');
          }
          return await this.saveETLJob(job);
          
        case 'delete':
          if (typeof job !== 'string') {
            job = job.id;
          }
          
          // Find and remove the job
          const jobIndex = this.etlJobs.findIndex(j => j.id === job);
          if (jobIndex >= 0) {
            this.etlJobs.splice(jobIndex, 1);
            return true;
          }
          return false;
          
        case 'schedule':
          if (typeof job !== 'string') {
            job = job.id;
          }
          
          // Find the job
          const jobToSchedule = this.etlJobs.find(j => j.id === job);
          if (!jobToSchedule) {
            return false;
          }
          
          // In a real implementation, this would register a cron job
          // For this simulation, we just log that it was scheduled
          zkErrorLogger.log('INFO', `ETL job scheduled: ${job}`, {
            category: 'analytics',
            userFixable: false,
            recoverable: true,
            details: { schedule: jobToSchedule.schedule }
          });
          
          return true;
          
        case 'run':
          if (typeof job !== 'string') {
            job = job.id;
          }
          
          // Run the job
          const success = await this.runETLJob(job);
          if (success) {
            // Return the updated job
            return this.etlJobs.find(j => j.id === job) || null;
          }
          return false;
          
        default:
          throw new Error(`Invalid operation: ${operation}`);
      }
    } catch (error) {
      zkErrorLogger.log('ERROR', `Failed to manage ETL job: ${operation}`, {
        category: 'analytics',
        userFixable: false,
        recoverable: true,
        details: { error: error.message, operation, job: typeof job === 'string' ? job : job.id }
      });
      
      return false;
    }
  }
  
  /**
   * Create or update a report definition
   * 
   * @param report - The report definition
   * @returns True if the report was successfully created or updated
   */
  public async saveReportDefinition(
    report: Omit<ReportDefinition, 'lastGenerated'>
  ): Promise<boolean> {
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
   * @param jobId - The ID of the ETL job to run
   * @returns True if the job ran successfully
   */
  public async runETLJob(jobId: string): Promise<boolean> {
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
   * Close the BigQuery client and clean up resources
   */
  public shutdown(): void {
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
   */
  private async initializeTables(): Promise<void> {
    if (!this.client || !this.dataset) {
      return;
    }
    
    try {
      // Define table schemas
      const tableSchemas: Record<string, SchemaDefinition[]> = {
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
   */
  private async initializeETLJobs(): Promise<void> {
    // Define standard ETL jobs
    const standardJobs: Omit<ETLJob, 'status' | 'lastRun' | 'errorMessage'>[] = [
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
   */
  private async initializeReportDefinitions(): Promise<void> {
    // Define standard reports
    const standardReports: Omit<ReportDefinition, 'lastGenerated'>[] = [
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
   */
  private async flushEventBuffer(): Promise<void> {
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
   * @param ip - Original IP address
   * @returns Anonymized IP address
   */
  private anonymizeIp(ip: string): string {
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
export const bigQueryAnalytics = new BigQueryAnalytics();

// Export default for CommonJS compatibility
export default bigQueryAnalytics;