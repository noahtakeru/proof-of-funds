/**
 * BigQuery Client for Analytics
 * 
 * This module handles server-side analytics data collection and storage in BigQuery.
 * Used for detailed performance metrics and anonymized usage statistics.
 */

// Import the Google Cloud BigQuery client
const { BigQuery } = require('@google-cloud/bigquery');

// Configuration
const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'analytics';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
const ENABLE_ANALYTICS = process.env.ENABLE_ANALYTICS === 'true';

// Tables
const TABLES = {
    EVENTS: 'events',
    PROOFS: 'proofs',
    SYSTEM_METRICS: 'system_metrics'
};

// Initialize BigQuery client if analytics are enabled
let bigquery = null;

if (ENABLE_ANALYTICS && PROJECT_ID) {
    try {
        bigquery = new BigQuery({
            projectId: PROJECT_ID,
            // Service account key will be automatically loaded from environment
            // or application default credentials in production
        });

        console.log('BigQuery analytics client initialized');
    } catch (error) {
        console.error('Failed to initialize BigQuery client:', error);
    }
}

/**
 * Log an event to BigQuery
 * @param {string} eventName - Name of the event
 * @param {Object} eventData - Data associated with the event
 * @returns {Promise<void>}
 */
async function logEvent(eventName, eventData = {}) {
    if (!ENABLE_ANALYTICS || !bigquery) return;

    try {
        const row = {
            event_name: eventName,
            event_data: JSON.stringify(eventData),
            timestamp: BigQuery.timestamp(new Date()),
            client_ip: anonymizeIp(eventData.ip || ''),
            user_agent: eventData.userAgent || '',
            session_id: eventData.sessionId || ''
        };

        await bigquery.dataset(DATASET_ID).table(TABLES.EVENTS).insert([row]);
    } catch (error) {
        console.error(`Failed to log analytics event ${eventName}:`, error);
    }
}

/**
 * Log proof generation data
 * @param {Object} proofData - Data about the proof generation
 * @returns {Promise<void>}
 */
async function logProofGeneration(proofData) {
    if (!ENABLE_ANALYTICS || !bigquery) return;

    try {
        const row = {
            proof_id: proofData.operationId || `proof_${Date.now()}`,
            proof_type: proofData.proofType || 'unknown',
            network: proofData.network || 'unknown',
            execution_time_ms: proofData.executionTimeMs || 0,
            success: proofData.success ? 1 : 0,
            error_type: proofData.errorType || null,
            client_type: proofData.clientType || 'unknown',
            timestamp: BigQuery.timestamp(new Date())
        };

        await bigquery.dataset(DATASET_ID).table(TABLES.PROOFS).insert([row]);
    } catch (error) {
        console.error('Failed to log proof generation analytics:', error);
    }
}

/**
 * Log system performance metrics
 * @param {Object} metrics - System performance metrics
 * @returns {Promise<void>}
 */
async function logSystemMetrics(metrics) {
    if (!ENABLE_ANALYTICS || !bigquery) return;

    try {
        const row = {
            metric_id: `metric_${Date.now()}`,
            cpu_usage: metrics.cpuUsage || 0,
            memory_usage: metrics.memoryUsage || 0,
            avg_request_time: metrics.avgRequestTime || 0,
            active_users: metrics.activeUsers || 0,
            proof_count: metrics.proofCount || 0,
            error_count: metrics.errorCount || 0,
            timestamp: BigQuery.timestamp(new Date())
        };

        await bigquery.dataset(DATASET_ID).table(TABLES.SYSTEM_METRICS).insert([row]);
    } catch (error) {
        console.error('Failed to log system metrics:', error);
    }
}

/**
 * Anonymize an IP address
 * @param {string} ip - Original IP address
 * @returns {string} - Anonymized IP
 */
function anonymizeIp(ip) {
    if (!ip) return '';

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

module.exports = {
    logEvent,
    logProofGeneration,
    logSystemMetrics
}; 