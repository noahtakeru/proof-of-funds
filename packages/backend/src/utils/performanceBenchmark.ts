/**
 * Performance Benchmarking Utilities
 * 
 * Tools for measuring and recording the performance of various
 * system components.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import auditLogger from '@proof-of-funds/common/logging/auditLogger';

// Interface for metric data
export interface MetricData {
  count: number;
  totalTime: number;
  min: number;
  max: number;
  avgTime?: number;
}

// Interface for performance report
export interface PerformanceReport {
  [key: string]: {
    count: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
    p50?: number;
    p95?: number;
    p99?: number;
  };
}

/**
 * Performance benchmark utility class
 */
export class PerformanceBenchmark {
  private metrics: Record<string, MetricData> = {};
  private timeSeriesData: Record<string, number[]> = {};
  private logToFile: boolean;
  private logDirectory: string;
  private startTime: number;
  
  constructor(options: { logToFile?: boolean; logDirectory?: string } = {}) {
    this.logToFile = options.logToFile || false;
    this.logDirectory = options.logDirectory || path.join(os.tmpdir(), 'performance-metrics');
    this.startTime = Date.now();
    
    // Create log directory if it doesn't exist
    if (this.logToFile && !fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }
  
  /**
   * Measure the execution time of a function
   */
  async measure<T>(
    name: string, 
    fn: () => Promise<T> | T,
    context: Record<string, any> = {}
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      return result;
    } finally {
      const end = performance.now();
      const duration = end - start;
      
      // Record metrics
      if (!this.metrics[name]) {
        this.metrics[name] = { count: 0, totalTime: 0, min: Infinity, max: 0 };
        this.timeSeriesData[name] = [];
      }
      
      const metric = this.metrics[name];
      metric.count++;
      metric.totalTime += duration;
      metric.min = Math.min(metric.min, duration);
      metric.max = Math.max(metric.max, duration);
      
      // Record time series data for percentile calculations
      this.timeSeriesData[name].push(duration);
      
      // Log metric to file if enabled
      if (this.logToFile) {
        this.logMetricToFile(name, duration, context);
      }
      
      // Log to audit system if it's a significant operation
      if (duration > 1000) { // Only log operations taking more than 1 second
        auditLogger.info(
          'performance.measure',
          {
            operation: name,
            durationMs: duration,
            ...context
          },
          { system: true }
        );
      }
    }
  }
  
  /**
   * Calculate percentiles for a metric
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    // Sort the values
    const sorted = [...values].sort((a, b) => a - b);
    
    // Calculate the index
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    
    return sorted[Math.max(0, index)];
  }
  
  /**
   * Log a metric to file
   */
  private logMetricToFile(name: string, duration: number, context: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      operation: name,
      durationMs: duration,
      ...context
    };
    
    const logFile = path.join(
      this.logDirectory, 
      `performance-${new Date().toISOString().split('T')[0]}.jsonl`
    );
    
    fs.appendFileSync(
      logFile, 
      JSON.stringify(logEntry) + '\n', 
      { encoding: 'utf8' }
    );
  }
  
  /**
   * Get performance report
   */
  getReport(): PerformanceReport {
    const report: PerformanceReport = {};
    
    for (const [name, metric] of Object.entries(this.metrics)) {
      const timeSeries = this.timeSeriesData[name] || [];
      
      report[name] = {
        count: metric.count,
        avgTime: metric.totalTime / metric.count,
        minTime: metric.min === Infinity ? 0 : metric.min,
        maxTime: metric.max,
        p50: this.calculatePercentile(timeSeries, 50),
        p95: this.calculatePercentile(timeSeries, 95),
        p99: this.calculatePercentile(timeSeries, 99)
      };
    }
    
    return report;
  }
  
  /**
   * Save performance report to file
   */
  saveReport(filePath?: string): void {
    const report = this.getReport();
    const reportData = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      metrics: report
    };
    
    const reportPath = filePath || path.join(
      this.logDirectory, 
      `performance-report-${new Date().toISOString().replace(/:/g, '-')}.json`
    );
    
    fs.writeFileSync(
      reportPath, 
      JSON.stringify(reportData, null, 2), 
      { encoding: 'utf8' }
    );
  }
  
  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = {};
    this.timeSeriesData = {};
    this.startTime = Date.now();
  }
  
  /**
   * Start measuring a specific operation (for manual timing)
   */
  startMeasure(name: string): () => void {
    const start = performance.now();
    
    return (context: Record<string, any> = {}) => {
      const end = performance.now();
      const duration = end - start;
      
      // Record metrics
      if (!this.metrics[name]) {
        this.metrics[name] = { count: 0, totalTime: 0, min: Infinity, max: 0 };
        this.timeSeriesData[name] = [];
      }
      
      const metric = this.metrics[name];
      metric.count++;
      metric.totalTime += duration;
      metric.min = Math.min(metric.min, duration);
      metric.max = Math.max(metric.max, duration);
      
      // Record time series data
      this.timeSeriesData[name].push(duration);
      
      // Log metric to file if enabled
      if (this.logToFile) {
        this.logMetricToFile(name, duration, context);
      }
    };
  }
}

// Create singleton instance
const performanceBenchmark = new PerformanceBenchmark();

export default performanceBenchmark;