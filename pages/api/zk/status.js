/**
 * Server-side status endpoint for ZK operations
 * 
 * This endpoint provides information about server-side capabilities,
 * current service status, rate limits, and processing times.
 */

import { snarkjsLoader } from '../../../lib/zk/src/snarkjsLoader';
import { telemetry } from '../../../lib/zk/src/telemetry';
import { performance } from 'perf_hooks';
import os from 'os';

export default async function handler(req, res) {
  // Set CORS headers for API access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-User-Id, X-Operation-Id');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      allowedMethods: ['GET', 'POST', 'OPTIONS']
    });
  }

  try {
    const startTime = performance.now();

    // Initialize snarkjs if not already initialized
    let snarkInitialized = false;
    if (!snarkjsLoader.isInitialized()) {
      const initialized = await snarkjsLoader.initialize({
        serverSide: true,
        maxRetries: 2
      });

      snarkInitialized = initialized;
      if (!initialized) {
        telemetry.recordError('status-api', 'Failed to initialize snarkjs');
      }
    } else {
      snarkInitialized = true;
    }

    // Get telemetry stats
    const stats = telemetry.getOperationsStats();

    // Calculate typical processing times based on telemetry or use defaults
    const processingTimes = {
      "groth16.fullProve": {
        standard: stats.averageExecutionTimeMs || 800, // milliseconds
        threshold: stats.averageExecutionTimeMs ? Math.round(stats.averageExecutionTimeMs * 1.2) : 950,
        maximum: stats.averageExecutionTimeMs ? Math.round(stats.averageExecutionTimeMs * 1.3) : 950
      },
      "groth16.prove": {
        standard: stats.averageExecutionTimeMs ? Math.round(stats.averageExecutionTimeMs * 0.7) : 500,
        threshold: stats.averageExecutionTimeMs ? Math.round(stats.averageExecutionTimeMs * 0.85) : 600,
        maximum: stats.averageExecutionTimeMs ? Math.round(stats.averageExecutionTimeMs * 0.9) : 600
      },
      "groth16.verify": {
        standard: stats.averageExecutionTimeMs ? Math.round(stats.averageExecutionTimeMs * 0.2) : 100,
        threshold: stats.averageExecutionTimeMs ? Math.round(stats.averageExecutionTimeMs * 0.25) : 100,
        maximum: stats.averageExecutionTimeMs ? Math.round(stats.averageExecutionTimeMs * 0.3) : 100
      },
      "plonk.fullProve": {
        standard: stats.averageExecutionTimeMs ? Math.round(stats.averageExecutionTimeMs * 1.5) : 1200,
        threshold: stats.averageExecutionTimeMs ? Math.round(stats.averageExecutionTimeMs * 1.8) : 1400,
        maximum: stats.averageExecutionTimeMs ? Math.round(stats.averageExecutionTimeMs * 2.0) : 1400
      }
    };

    // List available features
    const features = [
      'groth16.fullProve',
      'groth16.verify'
    ];

    // Check if server is under heavy load
    const cpuLoad = os.loadavg()[0] / os.cpus().length; // Normalized CPU load
    const highLoad = cpuLoad > 0.7;

    // Get server capabilities
    const capabilities = {
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0].model,
        load: cpuLoad.toFixed(2)
      },
      memory: {
        total: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + ' GB',
        free: Math.round(os.freemem() / (1024 * 1024 * 1024)) + ' GB',
        percentFree: Math.round((os.freemem() / os.totalmem()) * 100) + '%'
      },
      platform: os.platform(),
      arch: os.arch(),
      uptime: Math.round(os.uptime() / 3600) + ' hours'
    };

    // Service status info
    const serviceStatus = {
      healthy: snarkInitialized && !highLoad,
      snarkjsInitialized: snarkInitialized,
      highLoad: highLoad,
      maintenance: false, // Set to true during maintenance periods
      version: process.env.SERVICE_VERSION || '1.0.0'
    };

    // Rate limit information
    const rateLimits = {
      standard: {
        requestsPerMinute: 10,
        requestsPerHour: 100,
        burstLimit: 20
      },
      authenticated: {
        requestsPerMinute: 30,
        requestsPerHour: 500,
        burstLimit: 50
      }
    };

    const response = {
      available: serviceStatus.healthy,
      version: snarkjsLoader.getVersion() || '0.7.5',
      features,
      processingTimes,
      serverTiming: {
        totalTime: performance.now() - startTime
      },
      telemetryStats: {
        averageExecutionTimeMs: stats.averageExecutionTimeMs || 5000,
        totalOperations: stats.totalOperations || 0,
        successRate: stats.successRate || 100,
        serverSideOperations: stats.serverSideOperations || 0
      },
      capabilities,
      serviceStatus,
      rateLimits,
      timestamp: new Date().toISOString()
    };

    const endTime = performance.now();

    telemetry.recordOperation({
      operation: 'status-check',
      executionTimeMs: endTime - startTime,
      success: true,
      serverSide: true
    });

    return res.status(200).json(response);
  } catch (error) {
    telemetry.recordError('status-api', error.message || 'Unknown error during status check');

    return res.status(500).json({
      error: 'Failed to retrieve status',
      message: error.message || 'Unknown error during status check'
    });
  }
}