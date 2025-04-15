/**
 * @fileoverview Memory Analysis and Visualization System
 * 
 * This module provides tools for analyzing memory usage patterns during ZK proof
 * operations, identifying bottlenecks, and visualizing memory trends. It helps
 * developers optimize memory usage and diagnose memory-related issues.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This system works like diagnostic equipment that monitors and analyzes resource
 * usage. It helps identify patterns, predict potential problems, and visualize 
 * how memory is being used over time. This information helps developers optimize
 * the application, like how analyzing energy usage in a home helps identify ways
 * to reduce power consumption.
 */

import { 
  ErrorCode,
  SystemError 
} from '../zkErrorHandler';
import zkErrorLogger from '../zkErrorLogger';
import { getMemoryUsage } from '../memoryManager';
import { getDeviceCapabilities } from '../deviceCapabilities';
import memoryOptimizer from './MemoryOptimizer';
import circuitMemoryPool from './CircuitMemoryPool';

// Types for memory analysis
export interface MemorySnapshot {
  timestamp: number;
  totalMemory: number;
  usedMemory: number;
  availableMemory: number;
  heapUsage?: Record<string, number>;
  operationContext?: string;
  circuitType?: string;
  operation?: string;
  poolStats?: any;
}

export interface MemoryReport {
  startTime: number;
  endTime: number;
  snapshots: MemorySnapshot[];
  peakMemory: number;
  averageMemory: number;
  memoryGrowth: number;
  abnormalPatterns: string[];
  recommendations: string[];
  visualizationData?: any;
}

export interface MemoryLeakSuspect {
  objectType: string;
  growthRate: number;
  occurrences: number;
  sampleAllocations: Array<{
    timestamp: number;
    stackTrace?: string;
    size: number;
  }>;
}

/**
 * Memory analyzer for ZK operations
 * Provides tools for tracking, analyzing, and visualizing memory usage
 */
export class MemoryAnalyzer {
  private snapshots: MemorySnapshot[] = [];
  private isTracking: boolean = false;
  private trackingTimer?: NodeJS.Timeout;
  private trackingStartTime: number = 0;
  private trackingIntervalMs: number = 1000;
  private currentOperationContext: string = '';
  private circuitType: string = '';
  private memoryPeaks: Record<string, number> = {};
  private memoryLeakSuspects: MemoryLeakSuspect[] = [];
  private deviceCapabilities: any;
  
  /**
   * Create a new memory analyzer
   */
  constructor() {
    this.deviceCapabilities = getDeviceCapabilities();
  }
  
  /**
   * Start tracking memory usage
   * @param intervalMs Interval between snapshots in milliseconds
   * @param initialContext Initial operation context label
   * @returns Control object for tracking
   */
  startTracking(intervalMs: number = 1000, initialContext: string = ''): { stop: () => MemoryReport } {
    if (this.isTracking) {
      this.stopTracking();
    }
    
    this.trackingIntervalMs = intervalMs;
    this.trackingStartTime = Date.now();
    this.currentOperationContext = initialContext;
    this.snapshots = [];
    this.isTracking = true;
    
    // Take initial snapshot
    this.takeSnapshot();
    
    // Set up regular snapshots
    this.trackingTimer = setInterval(() => {
      this.takeSnapshot();
    }, intervalMs);
    
    zkErrorLogger.log('INFO', 'Memory tracking started', {
      details: {
        intervalMs,
        startTime: new Date(this.trackingStartTime).toISOString(),
        initialContext
      }
    });
    
    return {
      stop: () => this.stopTracking()
    };
  }
  
  /**
   * Stop tracking memory usage and generate a report
   * @returns Memory usage report
   */
  stopTracking(): MemoryReport {
    if (!this.isTracking) {
      return this.generateReport();
    }
    
    // Take final snapshot
    this.takeSnapshot();
    
    // Clear tracking timer
    if (this.trackingTimer) {
      clearInterval(this.trackingTimer);
      this.trackingTimer = undefined;
    }
    
    this.isTracking = false;
    
    zkErrorLogger.log('INFO', 'Memory tracking stopped', {
      details: {
        snapshotCount: this.snapshots.length,
        duration: `${(Date.now() - this.trackingStartTime) / 1000}s`
      }
    });
    
    // Generate and return the report
    return this.generateReport();
  }
  
  /**
   * Set the current operation context
   * @param context Operation context description
   * @param circuitType Optional circuit type
   */
  setOperationContext(context: string, circuitType?: string): void {
    this.currentOperationContext = context;
    if (circuitType) {
      this.circuitType = circuitType;
    }
    
    // Take a snapshot with the new context
    if (this.isTracking) {
      this.takeSnapshot();
    }
  }
  
  /**
   * Take a memory snapshot
   * @param context Optional specific context for this snapshot
   * @returns The captured snapshot
   */
  takeSnapshot(context?: string): MemorySnapshot {
    const operationContext = context || this.currentOperationContext;
    const timestamp = Date.now();
    
    try {
      // Get current memory info
      const memoryInfo = getMemoryUsage();
      const poolStats = {
        optimizer: memoryOptimizer.getOptimizationStats(),
        circuitPool: circuitMemoryPool.getMetrics()
      };
      
      // Create snapshot
      const snapshot: MemorySnapshot = {
        timestamp,
        totalMemory: memoryInfo.total,
        usedMemory: memoryInfo.used,
        availableMemory: memoryInfo.available,
        operationContext,
        circuitType: this.circuitType,
        operation: operationContext.split(':')[0], // Extract operation type from context
        poolStats
      };
      
      // Check for memory peak
      if (!this.memoryPeaks[operationContext] || memoryInfo.used > this.memoryPeaks[operationContext]) {
        this.memoryPeaks[operationContext] = memoryInfo.used;
      }
      
      // Store snapshot
      this.snapshots.push(snapshot);
      
      // Limit snapshots to prevent excessive memory usage
      if (this.snapshots.length > 1000) {
        this.snapshots.shift();
      }
      
      return snapshot;
    } catch (error) {
      zkErrorLogger.logError(
        new SystemError(`Failed to take memory snapshot: ${error.message}`, {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          recoverable: true,
          details: { 
            context: operationContext,
            originalError: error.message 
          }
        }),
        { context: 'MemoryAnalyzer.takeSnapshot' }
      );
      
      // Return partial snapshot with error indication
      return {
        timestamp,
        totalMemory: 0,
        usedMemory: 0,
        availableMemory: 0,
        operationContext: `${operationContext} (error)`,
        circuitType: this.circuitType
      };
    }
  }
  
  /**
   * Generate a memory usage report based on collected snapshots
   * @returns Detailed memory usage report
   */
  generateReport(): MemoryReport {
    // If no snapshots, return empty report
    if (this.snapshots.length === 0) {
      return {
        startTime: this.trackingStartTime,
        endTime: Date.now(),
        snapshots: [],
        peakMemory: 0,
        averageMemory: 0,
        memoryGrowth: 0,
        abnormalPatterns: [],
        recommendations: ['No memory data available for analysis']
      };
    }
    
    // Calculate metrics
    const startTime = this.trackingStartTime;
    const endTime = Date.now();
    
    // Find peak memory usage
    const peakMemory = Math.max(...this.snapshots.map(s => s.usedMemory));
    
    // Calculate average memory usage
    const totalMemorySum = this.snapshots.reduce((sum, s) => sum + s.usedMemory, 0);
    const averageMemory = totalMemorySum / this.snapshots.length;
    
    // Calculate memory growth (difference between first and last snapshot)
    const firstSnapshot = this.snapshots[0];
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    const memoryGrowth = lastSnapshot.usedMemory - firstSnapshot.usedMemory;
    
    // Identify abnormal patterns
    const abnormalPatterns: string[] = [];
    const recommendations: string[] = [];
    
    // Check for sustained memory growth
    if (memoryGrowth > 10 * 1024 * 1024 && this.snapshots.length > 5) { // >10MB growth
      const isConsistentGrowth = this.checkConsistentGrowth();
      if (isConsistentGrowth) {
        abnormalPatterns.push('Sustained memory growth detected');
        recommendations.push('Investigate potential memory leaks in long-running operations');
      }
    }
    
    // Check for memory spikes
    const memorySpikes = this.detectMemorySpikes();
    if (memorySpikes.length > 0) {
      abnormalPatterns.push(`${memorySpikes.length} significant memory spikes detected`);
      
      // Add specific recommendations
      const spikeContexts = memorySpikes
        .map(s => s.context)
        .filter((v, i, a) => a.indexOf(v) === i) // Unique contexts
        .join(', ');
        
      recommendations.push(`Review memory allocation in these operations: ${spikeContexts}`);
    }
    
    // Check for peak memory compared to device capabilities
    if (this.deviceCapabilities.memory && peakMemory > this.deviceCapabilities.memory * 0.8 * 1024 * 1024) {
      abnormalPatterns.push('Peak memory usage exceeds 80% of device capability');
      recommendations.push('Consider implementing progressive loading or server-side computation fallbacks');
    }
    
    // Generate operation-specific recommendations
    const operationTypes = new Set(this.snapshots.map(s => s.operation).filter(Boolean));
    
    if (operationTypes.has('proving')) {
      // Check if proof generation is consuming excessive memory
      const provingSnapshots = this.snapshots.filter(s => s.operation === 'proving');
      const peakProvingMemory = Math.max(...provingSnapshots.map(s => s.usedMemory));
      
      if (peakProvingMemory > 100 * 1024 * 1024) { // >100MB
        recommendations.push('Consider circuit optimization techniques to reduce proof memory requirements');
      }
    }
    
    // Generate visualization data based on memory usage timeline
    const visualizationData = this.generateVisualizationData();
    
    return {
      startTime,
      endTime,
      snapshots: [...this.snapshots], // Clone to avoid external modification
      peakMemory,
      averageMemory,
      memoryGrowth,
      abnormalPatterns,
      recommendations,
      visualizationData
    };
  }
  
  /**
   * Clear all collected memory data
   */
  clearData(): void {
    this.snapshots = [];
    this.memoryPeaks = {};
    this.memoryLeakSuspects = [];
    this.trackingStartTime = Date.now();
    
    zkErrorLogger.log('INFO', 'Memory analysis data cleared');
  }
  
  /**
   * Get memory usage information for a specific operation
   * @param operationContext Operation context to analyze
   * @returns Memory metrics for the specified operation
   */
  getOperationMemoryMetrics(operationContext: string): any {
    // Filter snapshots for the specified operation
    const operationSnapshots = this.snapshots.filter(
      s => s.operationContext === operationContext
    );
    
    if (operationSnapshots.length === 0) {
      return {
        operationContext,
        found: false,
        message: 'No data available for the specified operation'
      };
    }
    
    // Calculate metrics
    const peakMemory = Math.max(...operationSnapshots.map(s => s.usedMemory));
    const avgMemory = operationSnapshots.reduce((sum, s) => sum + s.usedMemory, 0) / operationSnapshots.length;
    const firstSnapshot = operationSnapshots[0];
    const lastSnapshot = operationSnapshots[operationSnapshots.length - 1];
    const memoryGrowth = lastSnapshot.usedMemory - firstSnapshot.usedMemory;
    const duration = lastSnapshot.timestamp - firstSnapshot.timestamp;
    
    return {
      operationContext,
      found: true,
      snapshotCount: operationSnapshots.length,
      startTime: new Date(firstSnapshot.timestamp).toISOString(),
      endTime: new Date(lastSnapshot.timestamp).toISOString(),
      durationMs: duration,
      peakMemoryBytes: peakMemory,
      peakMemoryMB: Math.round(peakMemory / (1024 * 1024) * 100) / 100,
      averageMemoryMB: Math.round(avgMemory / (1024 * 1024) * 100) / 100,
      memoryGrowthMB: Math.round(memoryGrowth / (1024 * 1024) * 100) / 100,
      growthRateKBPerSecond: Math.round(memoryGrowth / 1024 / (duration / 1000) * 100) / 100
    };
  }
  
  /**
   * Compare memory usage across different circuit types
   * @returns Comparative analysis of memory usage by circuit type
   */
  compareCircuitMemoryUsage(): any {
    const circuitTypes = new Set(
      this.snapshots
        .filter(s => s.circuitType)
        .map(s => s.circuitType)
    );
    
    if (circuitTypes.size === 0) {
      return {
        found: false,
        message: 'No circuit-specific memory data available'
      };
    }
    
    const comparison: Record<string, any> = {};
    
    for (const circuitType of circuitTypes) {
      const circuitSnapshots = this.snapshots.filter(s => s.circuitType === circuitType);
      
      if (circuitSnapshots.length === 0) continue;
      
      // Calculate metrics
      const peakMemory = Math.max(...circuitSnapshots.map(s => s.usedMemory));
      const avgMemory = circuitSnapshots.reduce((sum, s) => sum + s.usedMemory, 0) / circuitSnapshots.length;
      
      // Group by operation
      const operationTypes = new Set(
        circuitSnapshots
          .filter(s => s.operation)
          .map(s => s.operation)
      );
      
      const operationMetrics: Record<string, any> = {};
      
      for (const operation of operationTypes) {
        const opSnapshots = circuitSnapshots.filter(s => s.operation === operation);
        if (opSnapshots.length === 0) continue;
        
        const opPeakMemory = Math.max(...opSnapshots.map(s => s.usedMemory));
        const opAvgMemory = opSnapshots.reduce((sum, s) => sum + s.usedMemory, 0) / opSnapshots.length;
        
        operationMetrics[operation as string] = {
          snapshotCount: opSnapshots.length,
          peakMemoryMB: Math.round(opPeakMemory / (1024 * 1024) * 100) / 100,
          averageMemoryMB: Math.round(opAvgMemory / (1024 * 1024) * 100) / 100
        };
      }
      
      comparison[circuitType as string] = {
        snapshotCount: circuitSnapshots.length,
        peakMemoryMB: Math.round(peakMemory / (1024 * 1024) * 100) / 100,
        averageMemoryMB: Math.round(avgMemory / (1024 * 1024) * 100) / 100,
        operations: operationMetrics
      };
    }
    
    // Generate relative efficiency metrics
    const circuitTypeArray = Array.from(circuitTypes);
    if (circuitTypeArray.length > 1) {
      const baseCircuitType = circuitTypeArray[0];
      const baseData = comparison[baseCircuitType as string];
      
      for (let i = 1; i < circuitTypeArray.length; i++) {
        const compareType = circuitTypeArray[i];
        const compareData = comparison[compareType as string];
        
        compareData.relativeEfficiency = {
          peakMemory: baseData.peakMemoryMB > 0 
            ? Math.round((baseData.peakMemoryMB / compareData.peakMemoryMB) * 100) / 100
            : 0,
          averageMemory: baseData.averageMemoryMB > 0
            ? Math.round((baseData.averageMemoryMB / compareData.averageMemoryMB) * 100) / 100
            : 0
        };
      }
    }
    
    return {
      found: true,
      circuitTypes: Array.from(circuitTypes),
      comparison
    };
  }
  
  /**
   * Check for consistent memory growth pattern (potential leak)
   * @returns Whether there's evidence of consistent growth
   * @private
   */
  private checkConsistentGrowth(): boolean {
    if (this.snapshots.length < 10) return false;
    
    // Take a sample of evenly spaced snapshots
    const stepSize = Math.floor(this.snapshots.length / 10);
    const samples = [];
    
    for (let i = 0; i < 10; i++) {
      const index = Math.min(i * stepSize, this.snapshots.length - 1);
      samples.push(this.snapshots[index]);
    }
    
    // Check if memory usage is consistently increasing
    let increasingCount = 0;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i].usedMemory > samples[i-1].usedMemory) {
        increasingCount++;
      }
    }
    
    // If memory increased in at least 80% of samples, consider it a consistent growth
    return increasingCount >= Math.floor(samples.length * 0.8);
  }
  
  /**
   * Detect significant memory spikes
   * @returns Array of detected memory spikes
   * @private
   */
  private detectMemorySpikes(): Array<{ index: number, context: string, magnitude: number }> {
    if (this.snapshots.length < 5) return [];
    
    const spikes = [];
    
    // Calculate average memory change between snapshots
    let totalChange = 0;
    for (let i = 1; i < this.snapshots.length; i++) {
      totalChange += Math.abs(this.snapshots[i].usedMemory - this.snapshots[i-1].usedMemory);
    }
    const avgChange = totalChange / (this.snapshots.length - 1);
    
    // Detect spikes (more than 5x average change)
    for (let i = 1; i < this.snapshots.length; i++) {
      const memoryChange = this.snapshots[i].usedMemory - this.snapshots[i-1].usedMemory;
      if (memoryChange > 5 * avgChange && memoryChange > 5 * 1024 * 1024) { // >5x avg and >5MB
        spikes.push({
          index: i,
          context: this.snapshots[i].operationContext || 'unknown',
          magnitude: memoryChange
        });
      }
    }
    
    return spikes;
  }
  
  /**
   * Generate data for memory usage visualization
   * @returns Visualization-ready data
   * @private
   */
  private generateVisualizationData(): any {
    if (this.snapshots.length === 0) return null;
    
    // Create timeline data
    const timeline = this.snapshots.map(s => ({
      timestamp: s.timestamp,
      relativeTime: (s.timestamp - this.trackingStartTime) / 1000, // seconds
      usedMemoryMB: Math.round(s.usedMemory / (1024 * 1024) * 100) / 100,
      availableMemoryMB: Math.round(s.availableMemory / (1024 * 1024) * 100) / 100,
      context: s.operationContext,
      operation: s.operation
    }));
    
    // Create operation-specific data
    const operationContexts = new Set(
      this.snapshots
        .filter(s => s.operationContext)
        .map(s => s.operationContext)
    );
    
    const operationData: Record<string, any> = {};
    
    for (const context of operationContexts) {
      const contextSnapshots = this.snapshots.filter(s => s.operationContext === context);
      if (contextSnapshots.length === 0) continue;
      
      operationData[context as string] = {
        count: contextSnapshots.length,
        peakMemoryMB: Math.round(
          Math.max(...contextSnapshots.map(s => s.usedMemory)) / (1024 * 1024) * 100
        ) / 100,
        averageMemoryMB: Math.round(
          contextSnapshots.reduce((sum, s) => sum + s.usedMemory, 0) / 
          contextSnapshots.length / (1024 * 1024) * 100
        ) / 100,
        startTime: contextSnapshots[0].timestamp,
        endTime: contextSnapshots[contextSnapshots.length - 1].timestamp
      };
    }
    
    // Return combined visualization data
    return {
      timeline,
      operations: operationData,
      summary: {
        duration: (lastSnapshot.timestamp - firstSnapshot.timestamp) / 1000,
        snapshotCount: this.snapshots.length,
        peakMemoryMB: Math.round(peakMemory / (1024 * 1024) * 100) / 100,
        averageMemoryMB: Math.round(averageMemory / (1024 * 1024) * 100) / 100,
        growthMB: Math.round(memoryGrowth / (1024 * 1024) * 100) / 100
      }
    };
  }
}

// Create singleton instance for global use
const memoryAnalyzer = new MemoryAnalyzer();
export default memoryAnalyzer;