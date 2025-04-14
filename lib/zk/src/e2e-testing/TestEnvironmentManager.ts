/**
 * TestEnvironmentManager.ts
 * 
 * Manages test environments for End-to-End Integration Testing.
 * This class is responsible for setting up and tearing down test environments
 * with different configurations, simulating various platforms and scenarios.
 */

import { 
  EnvironmentType, 
  FeatureFlags,
  DeploymentConfig
} from '../deployment/DeploymentConfig';

export interface TestEnvironmentConfig {
  name: string;
  environmentType: EnvironmentType;
  features: FeatureFlags;
  mockServer?: boolean;
  mockWallet?: boolean;
  networkLatency?: number; // simulated latency in ms
  networkReliability?: number; // 0-1, simulated reliability
  devicePerformance?: 'low' | 'medium' | 'high';
  storage?: 'persistent' | 'temporary' | 'none';
}

export interface TestReport {
  testId: string;
  testName: string;
  environment: TestEnvironmentConfig;
  startTime: number;
  endTime: number;
  duration: number;
  steps: TestStepReport[];
  success: boolean;
  failureReason?: string;
  performance: {
    cpuUsage?: number;
    memoryUsage?: number;
    proofGenerationTime?: number;
    verificationTime?: number;
    totalNetworkTime?: number;
  };
}

export interface TestStepReport {
  stepId: string;
  stepName: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  failureReason?: string;
  data?: any;
}

export class TestEnvironmentManager {
  private activeEnvironments: Map<string, TestEnvironmentConfig> = new Map();
  private testReports: TestReport[] = [];
  private globalMocks: Map<string, Function> = new Map();
  
  /**
   * Creates a new test environment with the specified configuration
   */
  async createEnvironment(config: TestEnvironmentConfig): Promise<string> {
    const envId = `env_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Apply environment configuration
    this.activeEnvironments.set(envId, config);
    
    // Setup global mocks based on environment configuration
    if (config.mockServer) {
      this.setupServerMock(config);
    }
    
    if (config.mockWallet) {
      this.setupWalletMock(config);
    }
    
    // Apply network conditions if specified
    if (config.networkLatency || config.networkReliability) {
      this.setupNetworkConditions(config);
    }
    
    // Apply device performance simulation
    if (config.devicePerformance) {
      this.setupPerformanceSimulation(config);
    }
    
    return envId;
  }
  
  /**
   * Gets a test environment by ID
   */
  getEnvironment(envId: string): TestEnvironmentConfig | undefined {
    return this.activeEnvironments.get(envId);
  }
  
  /**
   * Destroys a test environment, cleaning up any resources
   */
  async destroyEnvironment(envId: string): Promise<void> {
    if (!this.activeEnvironments.has(envId)) {
      throw new Error(`Environment with ID ${envId} not found`);
    }
    
    const config = this.activeEnvironments.get(envId)!;
    
    // Clean up mocks and other environment changes
    if (config.mockServer) {
      this.cleanupServerMock();
    }
    
    if (config.mockWallet) {
      this.cleanupWalletMock();
    }
    
    this.activeEnvironments.delete(envId);
  }
  
  /**
   * Create a test report structure
   */
  createTestReport(testName: string, envId: string): TestReport {
    const environment = this.getEnvironment(envId);
    if (!environment) {
      throw new Error(`Environment with ID ${envId} not found`);
    }
    
    const testId = `test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const report: TestReport = {
      testId,
      testName,
      environment,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      steps: [],
      success: false,
      performance: {}
    };
    
    this.testReports.push(report);
    return report;
  }
  
  /**
   * Add a test step to a report
   */
  addTestStep(report: TestReport, stepName: string): TestStepReport {
    const stepId = `step_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const step: TestStepReport = {
      stepId,
      stepName,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      success: false
    };
    
    report.steps.push(step);
    return step;
  }
  
  /**
   * Complete a test step with success or failure
   */
  completeTestStep(report: TestReport, stepId: string, success: boolean, data?: any, failureReason?: string): void {
    const step = report.steps.find(s => s.stepId === stepId);
    if (!step) {
      throw new Error(`Step with ID ${stepId} not found in report ${report.testId}`);
    }
    
    step.endTime = Date.now();
    step.duration = step.endTime - step.startTime;
    step.success = success;
    step.data = data;
    step.failureReason = failureReason;
  }
  
  /**
   * Complete a test report with success or failure
   */
  completeTestReport(report: TestReport, success: boolean, performance?: any, failureReason?: string): TestReport {
    report.endTime = Date.now();
    report.duration = report.endTime - report.startTime;
    report.success = success;
    
    if (performance) {
      report.performance = { ...report.performance, ...performance };
    }
    
    report.failureReason = failureReason;
    return report;
  }
  
  /**
   * Get all test reports
   */
  getTestReports(): TestReport[] {
    return this.testReports;
  }
  
  /**
   * Clear all test reports
   */
  clearTestReports(): void {
    this.testReports = [];
  }
  
  /**
   * Get a detailed analytics report of all tests
   */
  getAnalyticsReport(): any {
    const totalTests = this.testReports.length;
    const successfulTests = this.testReports.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;
    
    const environmentBreakdown = this.getEnvironmentBreakdown();
    const performanceMetrics = this.getPerformanceMetrics();
    const stepSuccessRates = this.getStepSuccessRates();
    
    return {
      summary: {
        totalTests,
        successfulTests,
        failedTests,
        successRate: totalTests > 0 ? (successfulTests / totalTests) * 100 : 0
      },
      environmentBreakdown,
      performanceMetrics,
      stepSuccessRates,
      tests: this.testReports
    };
  }
  
  // Private methods for environment setup
  
  private setupServerMock(config: TestEnvironmentConfig): void {
    // Setup server mock based on configuration
    const originalFetch = global.fetch;
    
    // Store original for cleanup
    this.globalMocks.set('fetch', originalFetch);
    
    // Mock fetch to simulate server with configured latency and reliability
    (global as any).fetch = async (url: string, options: any) => {
      // Apply network conditions
      if (config.networkLatency) {
        await this.delay(config.networkLatency);
      }
      
      // Simulate network failures if reliability < 1
      if (config.networkReliability && config.networkReliability < 1) {
        if (Math.random() > config.networkReliability) {
          throw new Error('Network request failed (simulated)');
        }
      }
      
      // Forward to real fetch for real requests
      return originalFetch(url, options);
    };
  }
  
  private setupWalletMock(config: TestEnvironmentConfig): void {
    // Setup wallet mock based on configuration
    // This is highly application-specific and would need to be customized
    // for the actual wallet integration used in the application
  }
  
  private setupNetworkConditions(config: TestEnvironmentConfig): void {
    // Network conditions are applied in the server mock
  }
  
  private setupPerformanceSimulation(config: TestEnvironmentConfig): void {
    // Simulate different device performance profiles
    let performanceFactor = 1;
    
    switch (config.devicePerformance) {
      case 'low':
        performanceFactor = 0.2; // Simulate 5x slower
        break;
      case 'medium':
        performanceFactor = 0.5; // Simulate 2x slower
        break;
      case 'high':
      default:
        performanceFactor = 1; // No slowdown
        break;
    }
    
    // Store original performance functions for cleanup
    this.globalMocks.set('setTimeout', global.setTimeout);
    
    // Slow down setTimeout to simulate slower device
    (global as any).setTimeout = (callback: Function, delay: number, ...args: any[]) => {
      const adjustedDelay = delay / performanceFactor;
      return (this.globalMocks.get('setTimeout') as Function)(callback, adjustedDelay, ...args);
    };
  }
  
  private cleanupServerMock(): void {
    // Restore original fetch
    if (this.globalMocks.has('fetch')) {
      (global as any).fetch = this.globalMocks.get('fetch');
      this.globalMocks.delete('fetch');
    }
  }
  
  private cleanupWalletMock(): void {
    // Cleanup wallet mock
    // Application-specific cleanup
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private getEnvironmentBreakdown(): any {
    // Calculate test results broken down by environment type
    const breakdown: any = {};
    
    for (const report of this.testReports) {
      const envType = report.environment.environmentType;
      if (!breakdown[envType]) {
        breakdown[envType] = {
          total: 0,
          successful: 0,
          failed: 0
        };
      }
      
      breakdown[envType].total++;
      if (report.success) {
        breakdown[envType].successful++;
      } else {
        breakdown[envType].failed++;
      }
    }
    
    return breakdown;
  }
  
  private getPerformanceMetrics(): any {
    // Calculate performance metrics across all tests
    const metrics: any = {
      proofGenerationTime: {
        min: Infinity,
        max: 0,
        avg: 0,
        total: 0,
        count: 0
      },
      verificationTime: {
        min: Infinity,
        max: 0,
        avg: 0,
        total: 0,
        count: 0
      },
      totalTestDuration: {
        min: Infinity,
        max: 0,
        avg: 0,
        total: 0,
        count: 0
      }
    };
    
    for (const report of this.testReports) {
      // Process total test duration
      metrics.totalTestDuration.total += report.duration;
      metrics.totalTestDuration.count++;
      metrics.totalTestDuration.min = Math.min(metrics.totalTestDuration.min, report.duration);
      metrics.totalTestDuration.max = Math.max(metrics.totalTestDuration.max, report.duration);
      
      // Process proof generation time if available
      if (report.performance.proofGenerationTime) {
        metrics.proofGenerationTime.total += report.performance.proofGenerationTime;
        metrics.proofGenerationTime.count++;
        metrics.proofGenerationTime.min = Math.min(
          metrics.proofGenerationTime.min, 
          report.performance.proofGenerationTime
        );
        metrics.proofGenerationTime.max = Math.max(
          metrics.proofGenerationTime.max, 
          report.performance.proofGenerationTime
        );
      }
      
      // Process verification time if available
      if (report.performance.verificationTime) {
        metrics.verificationTime.total += report.performance.verificationTime;
        metrics.verificationTime.count++;
        metrics.verificationTime.min = Math.min(
          metrics.verificationTime.min, 
          report.performance.verificationTime
        );
        metrics.verificationTime.max = Math.max(
          metrics.verificationTime.max, 
          report.performance.verificationTime
        );
      }
    }
    
    // Calculate averages
    if (metrics.totalTestDuration.count > 0) {
      metrics.totalTestDuration.avg = metrics.totalTestDuration.total / metrics.totalTestDuration.count;
    }
    
    if (metrics.proofGenerationTime.count > 0) {
      metrics.proofGenerationTime.avg = metrics.proofGenerationTime.total / metrics.proofGenerationTime.count;
    } else {
      metrics.proofGenerationTime.min = 0; // Reset min if no data
    }
    
    if (metrics.verificationTime.count > 0) {
      metrics.verificationTime.avg = metrics.verificationTime.total / metrics.verificationTime.count;
    } else {
      metrics.verificationTime.min = 0; // Reset min if no data
    }
    
    return metrics;
  }
  
  private getStepSuccessRates(): any {
    // Calculate success rates for different test steps
    const stepStats: Record<string, { total: number, successful: number }> = {};
    
    for (const report of this.testReports) {
      for (const step of report.steps) {
        if (!stepStats[step.stepName]) {
          stepStats[step.stepName] = { total: 0, successful: 0 };
        }
        
        stepStats[step.stepName].total++;
        if (step.success) {
          stepStats[step.stepName].successful++;
        }
      }
    }
    
    // Calculate success rates
    const successRates: Record<string, number> = {};
    for (const [stepName, stats] of Object.entries(stepStats)) {
      successRates[stepName] = stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;
    }
    
    return successRates;
  }
}