/**
 * Server-side status endpoint for ZK operations
 * 
 * This endpoint provides information about server-side capabilities
 * and availability for ZK proof operations.
 */

import { snarkjsLoader } from '../../../lib/zk/snarkjsLoader';
import { telemetry } from '../../../lib/zk/telemetry';
import { performance } from 'perf_hooks';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = performance.now();

    // Initialize snarkjs if not already initialized
    if (!snarkjsLoader.isInitialized()) {
      const initialized = await snarkjsLoader.initialize({ 
        serverSide: true, 
        maxRetries: 2 
      });
      
      if (!initialized) {
        telemetry.recordError('status-api', 'Failed to initialize snarkjs');
      }
    }

    // Get telemetry stats
    const stats = telemetry.getOperationsStats();
    
    // Calculate typical processing times based on telemetry or use defaults
    const processingTimes = {
      "groth16.fullProve": {
        standard: 800, // milliseconds
        threshold: 950,
        maximum: 950
      },
      "groth16.prove": {
        standard: 500,
        threshold: 600,
        maximum: 600
      },
      "groth16.verify": {
        standard: 100,
        threshold: 100,
        maximum: 100
      },
      "plonk.fullProve": {
        standard: 1200,
        threshold: 1400,
        maximum: 1400
      }
    };
    
    const features = [
      'groth16.fullProve',
      'groth16.verify'
    ];
    
    const response = {
      available: true,
      version: '0.7.5', // This should match your installed snarkjs version
      features,
      processingTimes,
      serverTiming: {
        totalTime: performance.now() - startTime
      },
      telemetryStats: {
        averageExecutionTimeMs: stats.averageExecutionTimeMs || 5000,
        totalOperations: stats.totalOperations || 0,
        successRate: stats.successRate || 100
      },
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