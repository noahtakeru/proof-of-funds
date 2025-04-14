import { ResourceMonitor } from './ResourceMonitor';
import { ComputationProfile } from './AdaptiveComputation';
import { deviceCapabilities } from '../deviceCapabilities';

type PredictionModelConfig = {
  trainingDataSize: number;                  // Number of samples to keep for training
  predictionWindowSize: number;              // Number of future samples to predict
  predictionInterval: number;                // Time interval between predictions (ms)
  smoothingFactor: number;                   // Exponential smoothing factor (0-1)
  sampleInterval: number;                    // Time between resource samples (ms)
  enableAutomaticModelUpdate: boolean;       // Whether to automatically update models
  confidenceThreshold: number;               // Threshold for prediction confidence (0-1)
  memoryRetentionHours: number;              // How long to keep historical data (hours)
  featureImportanceThreshold: number;        // Threshold for feature importance (0-1)
  circuitSizeScalingFactor: number;          // How circuit size affects resource usage
};

type ResourcePredictionType = {
  timestamp: number;
  memory: {
    predicted: number;
    confidence: number;
    lowerBound: number;
    upperBound: number;
  };
  cpu: {
    predicted: number;
    confidence: number;
    lowerBound: number;
    upperBound: number;
  };
  battery?: {
    predicted: number;
    confidence: number;
    lowerBound: number;
    upperBound: number;
  };
  networkBandwidth?: {
    predicted: number;
    confidence: number;
    lowerBound: number;
    upperBound: number;
  };
};

type ResourceTrend = {
  resource: 'memory' | 'cpu' | 'battery' | 'network';
  direction: 'increasing' | 'decreasing' | 'stable';
  rate: number;                              // Rate of change per minute
  timeToThreshold?: number;                  // Time until threshold is reached (ms)
  confidence: number;                        // Confidence in trend prediction (0-1)
};

type OperationResourcePrediction = {
  operationId: string;
  profile: ComputationProfile;
  estimatedTimeToComplete: number;           // Estimated completion time (ms)
  estimatedPeakMemory: number;               // Estimated peak memory usage (bytes)
  estimatedAverageCpu: number;               // Estimated average CPU usage (0-1)
  estimatedEnergyImpact: number;             // Estimated battery impact (0-1)
  predictions: ResourcePrediction[];         // Time series of predictions
  confidenceScore: number;                   // Overall confidence score (0-1)
};

const DEFAULT_CONFIG: PredictionModelConfig = {
  trainingDataSize: 100,
  predictionWindowSize: 20,
  predictionInterval: 5000,            // 5 seconds
  smoothingFactor: 0.3,
  sampleInterval: 1000,                // 1 second
  enableAutomaticModelUpdate: true,
  confidenceThreshold: 0.7,
  memoryRetentionHours: 24,
  featureImportanceThreshold: 0.1,
  circuitSizeScalingFactor: 0.75
};

class ResourcePrediction {
  private monitor: ResourceMonitor;
  private config: PredictionModelConfig;
  private historicalData: {
    memory: { timestamp: number; value: number }[];
    cpu: { timestamp: number; value: number }[];
    battery: { timestamp: number; value: number }[];
    network: { timestamp: number; value: number }[];
  };
  private modelMetrics: {
    memory: { rmse: number; accuracy: number; lastUpdated: number };
    cpu: { rmse: number; accuracy: number; lastUpdated: number };
    battery: { rmse: number; accuracy: number; lastUpdated: number };
    network: { rmse: number; accuracy: number; lastUpdated: number };
  };
  private predictionTimer: NodeJS.Timeout | null = null;
  private operationProfiles: Map<string, {
    profile: ComputationProfile;
    predictions: OperationResourcePrediction;
    lastUpdated: number;
  }> = new Map();
  private isCollectingData: boolean = false;
  
  constructor(monitor: ResourceMonitor, config: Partial<PredictionModelConfig> = {}) {
    this.monitor = monitor;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize historical data structures
    this.historicalData = {
      memory: [],
      cpu: [],
      battery: [],
      network: []
    };
    
    // Initialize model metrics
    this.modelMetrics = {
      memory: { rmse: 0, accuracy: 0, lastUpdated: 0 },
      cpu: { rmse: 0, accuracy: 0, lastUpdated: 0 },
      battery: { rmse: 0, accuracy: 0, lastUpdated: 0 },
      network: { rmse: 0, accuracy: 0, lastUpdated: 0 }
    };
    
    // Register callback with resource monitor to collect data
    this.monitor.registerCallback(this.collectResourceData.bind(this));
  }
  
  public async start(): Promise<void> {
    if (this.isCollectingData) return;
    
    this.isCollectingData = true;
    
    // Start periodic prediction
    this.predictionTimer = setInterval(() => {
      this.updatePredictions();
    }, this.config.predictionInterval);
    
    // Initialize with current data
    await this.collectInitialData();
  }
  
  public stop(): void {
    if (this.predictionTimer) {
      clearInterval(this.predictionTimer);
      this.predictionTimer = null;
    }
    
    this.isCollectingData = false;
  }
  
  private async collectInitialData(): Promise<void> {
    // Collect initial data points for more accurate predictions
    for (let i = 0; i < 5; i++) {
      await this.sampleAndStoreResourceData();
      await new Promise(resolve => setTimeout(resolve, this.config.sampleInterval));
    }
  }
  
  private async collectResourceData(resources: any): Promise<void> {
    if (!this.isCollectingData) return;
    
    const timestamp = Date.now();
    
    // Store historical data
    if (resources.memory) {
      this.historicalData.memory.push({
        timestamp,
        value: resources.memory.used || 0
      });
    }
    
    if (resources.cpu) {
      this.historicalData.cpu.push({
        timestamp,
        value: resources.cpu.usage || 0
      });
    }
    
    if (resources.battery) {
      this.historicalData.battery.push({
        timestamp,
        value: resources.battery.level || 100
      });
    }
    
    if (resources.network) {
      this.historicalData.network.push({
        timestamp,
        value: resources.network.currentBandwidth || 0
      });
    }
    
    // Trim historical data to configured size
    this.trimHistoricalData();
    
    // Update predictions if auto-update is enabled
    if (this.config.enableAutomaticModelUpdate) {
      this.updateModels();
    }
  }
  
  private async sampleAndStoreResourceData(): Promise<void> {
    const resources = await this.monitor.sampleResources();
    await this.collectResourceData(resources);
  }
  
  private trimHistoricalData(): void {
    // Calculate cutoff time based on memory retention policy
    const cutoffTime = Date.now() - (this.config.memoryRetentionHours * 60 * 60 * 1000);
    
    // Trim data older than cutoff time
    this.historicalData.memory = this.historicalData.memory
      .filter(item => item.timestamp >= cutoffTime)
      .slice(-this.config.trainingDataSize);
    
    this.historicalData.cpu = this.historicalData.cpu
      .filter(item => item.timestamp >= cutoffTime)
      .slice(-this.config.trainingDataSize);
    
    this.historicalData.battery = this.historicalData.battery
      .filter(item => item.timestamp >= cutoffTime)
      .slice(-this.config.trainingDataSize);
    
    this.historicalData.network = this.historicalData.network
      .filter(item => item.timestamp >= cutoffTime)
      .slice(-this.config.trainingDataSize);
  }
  
  private updateModels(): void {
    // In a real implementation, this would update the prediction models
    // based on new historical data. For now, we'll simulate this.
    
    const now = Date.now();
    
    // Only update models if enough time has passed since last update
    if (now - this.modelMetrics.memory.lastUpdated > 60000) { // 1 minute
      // Update memory model
      this.modelMetrics.memory = {
        rmse: this.calculateRMSE(this.historicalData.memory),
        accuracy: this.calculateAccuracy(this.historicalData.memory),
        lastUpdated: now
      };
    }
    
    if (now - this.modelMetrics.cpu.lastUpdated > 60000) { // 1 minute
      // Update CPU model
      this.modelMetrics.cpu = {
        rmse: this.calculateRMSE(this.historicalData.cpu),
        accuracy: this.calculateAccuracy(this.historicalData.cpu),
        lastUpdated: now
      };
    }
    
    if (now - this.modelMetrics.battery.lastUpdated > 300000) { // 5 minutes
      // Update battery model (less frequent updates)
      this.modelMetrics.battery = {
        rmse: this.calculateRMSE(this.historicalData.battery),
        accuracy: this.calculateAccuracy(this.historicalData.battery),
        lastUpdated: now
      };
    }
    
    if (now - this.modelMetrics.network.lastUpdated > 120000) { // 2 minutes
      // Update network model
      this.modelMetrics.network = {
        rmse: this.calculateRMSE(this.historicalData.network),
        accuracy: this.calculateAccuracy(this.historicalData.network),
        lastUpdated: now
      };
    }
  }
  
  private calculateRMSE(data: { timestamp: number; value: number }[]): number {
    // In a real implementation, this would calculate root mean squared error
    // of previous predictions vs actual values
    // For simulation, return a value between 0.05 and 0.2
    return 0.05 + Math.random() * 0.15;
  }
  
  private calculateAccuracy(data: { timestamp: number; value: number }[]): number {
    // In a real implementation, this would calculate prediction accuracy
    // For simulation, return a value between 0.7 and 0.95
    return 0.7 + Math.random() * 0.25;
  }
  
  private updatePredictions(): void {
    // Update system-wide resource predictions
    this.predictSystemResources();
    
    // Update operation-specific predictions
    for (const [operationId, operationData] of this.operationProfiles.entries()) {
      this.predictOperationResources(operationId, operationData.profile);
    }
  }
  
  public registerOperation(
    operationId: string, 
    profile: ComputationProfile
  ): void {
    // Create initial prediction for the operation
    const initialPrediction = this.createInitialOperationPrediction(operationId, profile);
    
    this.operationProfiles.set(operationId, {
      profile,
      predictions: initialPrediction,
      lastUpdated: Date.now()
    });
  }
  
  public unregisterOperation(operationId: string): void {
    this.operationProfiles.delete(operationId);
  }
  
  private createInitialOperationPrediction(
    operationId: string,
    profile: ComputationProfile
  ): OperationResourcePrediction {
    // Create initial prediction based on operation profile
    const now = Date.now();
    
    // Estimate completion time based on circuit size and system capabilities
    const estimatedTimeToComplete = this.estimateCompletionTime(profile);
    
    // Estimate peak memory based on memory requirements from profile
    const estimatedPeakMemory = Math.max(
      profile.circuitMemoryRequirements,
      profile.witnessMemoryRequirements,
      profile.provingMemoryRequirements
    );
    
    // Estimate CPU usage based on circuit size
    const cpuCores = deviceCapabilities.getCpuCores();
    const estimatedAverageCpu = Math.min(1.0, profile.circuitSize / 1000000) * cpuCores;
    
    // Estimate energy impact (battery drain)
    const estimatedEnergyImpact = Math.min(1.0, estimatedTimeToComplete / 300000) * 
      Math.min(1.0, estimatedAverageCpu / cpuCores) * 
      Math.min(1.0, estimatedPeakMemory / deviceCapabilities.getMemoryLimit());
    
    // Generate initial time series predictions
    const predictions: ResourcePrediction[] = [];
    
    // Generate prediction points at regular intervals
    const predictionCount = Math.ceil(estimatedTimeToComplete / this.config.predictionInterval);
    const maxPoints = Math.min(predictionCount, this.config.predictionWindowSize);
    
    for (let i = 0; i < maxPoints; i++) {
      const progress = i / (maxPoints - 1);
      
      // Memory typically increases to peak and then stays high
      const memoryProfile = Math.min(1.0, progress * 2); // Ramp up to 100% by halfway point
      
      // CPU typically varies during different phases
      const cpuProfile = this.generateCpuProfile(progress);
      
      predictions.push({
        timestamp: now + i * this.config.predictionInterval,
        memory: {
          predicted: estimatedPeakMemory * memoryProfile,
          confidence: 0.8 - 0.3 * progress, // Confidence decreases with time
          lowerBound: estimatedPeakMemory * memoryProfile * 0.8,
          upperBound: estimatedPeakMemory * memoryProfile * 1.2
        },
        cpu: {
          predicted: estimatedAverageCpu * cpuProfile,
          confidence: 0.75 - 0.25 * progress, // Confidence decreases with time
          lowerBound: estimatedAverageCpu * cpuProfile * 0.7,
          upperBound: estimatedAverageCpu * cpuProfile * 1.3
        },
        battery: {
          predicted: 100 - estimatedEnergyImpact * 100 * (progress),
          confidence: 0.7 - 0.2 * progress, // Battery prediction is less precise
          lowerBound: 100 - estimatedEnergyImpact * 120 * (progress),
          upperBound: 100 - estimatedEnergyImpact * 80 * (progress)
        }
      });
    }
    
    return {
      operationId,
      profile,
      estimatedTimeToComplete,
      estimatedPeakMemory,
      estimatedAverageCpu,
      estimatedEnergyImpact,
      predictions,
      confidenceScore: 0.85 // Initial confidence
    };
  }
  
  private generateCpuProfile(progress: number): number {
    // Generate a CPU usage profile that varies over time
    // This simulates different phases of computation having different CPU patterns
    
    if (progress < 0.1) {
      // Initialization phase - moderate CPU
      return 0.5 + (progress * 2);
    } else if (progress < 0.3) {
      // Witness generation - high CPU
      return 0.9 + (Math.sin(progress * 10) * 0.1);
    } else if (progress < 0.8) {
      // Proving phase - very high CPU with fluctuations
      return 0.8 + (Math.sin(progress * 15) * 0.2);
    } else {
      // Finalization phase - decreasing CPU
      return 0.5 - ((progress - 0.8) * 2);
    }
  }
  
  private estimateCompletionTime(profile: ComputationProfile): number {
    // Estimate completion time based on circuit size and system capabilities
    
    // Base time components from profile
    const witnessTime = profile.expectedWitnessDuration;
    const provingTime = profile.expectedProvingDuration;
    
    // Account for system capabilities
    const cpuFactor = deviceCapabilities.getCpuCores() / 4; // Normalize to 4-core baseline
    const memoryFactor = deviceCapabilities.getMemoryLimit() / (8 * 1024 * 1024 * 1024); // Normalize to 8GB baseline
    
    // Calculate adjusted time
    const adjustedWitnessTime = witnessTime / Math.min(1.5, Math.max(0.5, cpuFactor));
    const adjustedProvingTime = provingTime / 
      Math.min(1.5, Math.max(0.5, cpuFactor * 0.7 + memoryFactor * 0.3));
    
    // Add some overhead for initialization and finalization
    const overhead = 2000; // 2 seconds
    
    return adjustedWitnessTime + adjustedProvingTime + overhead;
  }
  
  private predictSystemResources(): ResourcePrediction[] {
    // In a real implementation, this would use time series forecasting
    // techniques to predict future resource usage. For now, we'll simulate.
    
    const predictions: ResourcePrediction[] = [];
    const now = Date.now();
    
    // Get last observed values
    const lastMemory = this.getLastValue(this.historicalData.memory);
    const lastCpu = this.getLastValue(this.historicalData.cpu);
    const lastBattery = this.getLastValue(this.historicalData.battery);
    const lastNetwork = this.getLastValue(this.historicalData.network);
    
    // Calculate trends
    const memoryTrend = this.calculateTrend(this.historicalData.memory);
    const cpuTrend = this.calculateTrend(this.historicalData.cpu);
    const batteryTrend = this.calculateTrend(this.historicalData.battery);
    const networkTrend = this.calculateTrend(this.historicalData.network);
    
    // Generate prediction points
    for (let i = 1; i <= this.config.predictionWindowSize; i++) {
      const timeOffset = i * this.config.predictionInterval;
      const timeFactorMinutes = timeOffset / 60000; // Convert to minutes
      
      // Apply trend with exponential smoothing for later predictions
      const smoothingFactor = Math.pow(this.config.smoothingFactor, i / 5);
      
      // Calculate predictions with decreasing confidence over time
      const confidenceFactor = Math.max(0.5, 1 - (i / this.config.predictionWindowSize));
      
      // Predicted memory: apply trend and account for active operations
      const memoryPrediction = lastMemory + (memoryTrend * timeFactorMinutes * smoothingFactor);
      const operationMemory = this.getPredictedOperationResourceUsage('memory', now + timeOffset);
      const totalMemoryPrediction = memoryPrediction + operationMemory;
      
      // Predicted CPU: apply trend and account for active operations
      const cpuPrediction = lastCpu + (cpuTrend * timeFactorMinutes * smoothingFactor);
      const operationCpu = this.getPredictedOperationResourceUsage('cpu', now + timeOffset);
      const totalCpuPrediction = Math.min(deviceCapabilities.getCpuCores(), cpuPrediction + operationCpu);
      
      // Predicted battery: apply trend, considering discharge rate is typically negative
      const batteryPrediction = Math.max(0, Math.min(100, 
        lastBattery + (batteryTrend * timeFactorMinutes * smoothingFactor)
      ));
      
      // Predicted network: apply trend, more volatile so less smoothing
      const networkPrediction = Math.max(0, 
        lastNetwork + (networkTrend * timeFactorMinutes * smoothingFactor * 1.2)
      );
      
      predictions.push({
        timestamp: now + timeOffset,
        memory: {
          predicted: totalMemoryPrediction,
          confidence: confidenceFactor * this.modelMetrics.memory.accuracy,
          lowerBound: totalMemoryPrediction * 0.9,
          upperBound: totalMemoryPrediction * 1.1
        },
        cpu: {
          predicted: totalCpuPrediction,
          confidence: confidenceFactor * this.modelMetrics.cpu.accuracy,
          lowerBound: Math.max(0, totalCpuPrediction * 0.8),
          upperBound: Math.min(deviceCapabilities.getCpuCores(), totalCpuPrediction * 1.2)
        },
        battery: {
          predicted: batteryPrediction,
          confidence: confidenceFactor * this.modelMetrics.battery.accuracy,
          lowerBound: Math.max(0, batteryPrediction - 5),
          upperBound: Math.min(100, batteryPrediction + 3)
        },
        networkBandwidth: {
          predicted: networkPrediction,
          confidence: confidenceFactor * 0.7, // Network is less predictable
          lowerBound: Math.max(0, networkPrediction * 0.6),
          upperBound: networkPrediction * 2
        }
      });
    }
    
    return predictions;
  }
  
  private getLastValue(data: { timestamp: number; value: number }[]): number {
    if (data.length === 0) return 0;
    return data[data.length - 1].value;
  }
  
  private calculateTrend(data: { timestamp: number; value: number }[]): number {
    // Calculate trend as change per minute
    if (data.length < 2) return 0;
    
    // Use last 5 points or all available points if less than 5
    const points = data.slice(-Math.min(5, data.length));
    
    if (points.length < 2) return 0;
    
    // Calculate average change per millisecond
    let totalChangePerMs = 0;
    let count = 0;
    
    for (let i = 1; i < points.length; i++) {
      const timeDiffMs = points[i].timestamp - points[i - 1].timestamp;
      if (timeDiffMs > 0) {
        const changePerMs = (points[i].value - points[i - 1].value) / timeDiffMs;
        totalChangePerMs += changePerMs;
        count++;
      }
    }
    
    // Convert to change per minute (multiply by 60000 ms)
    return count > 0 ? (totalChangePerMs / count) * 60000 : 0;
  }
  
  private getPredictedOperationResourceUsage(
    resource: 'memory' | 'cpu',
    timestamp: number
  ): number {
    // Calculate predicted resource usage from all registered operations
    let total = 0;
    
    for (const operationData of this.operationProfiles.values()) {
      // Find closest prediction point
      const predictions = operationData.predictions.predictions;
      if (!predictions || predictions.length === 0) continue;
      
      // Sort predictions by time proximity to target timestamp
      const sortedByProximity = [...predictions].sort((a, b) => 
        Math.abs(a.timestamp - timestamp) - Math.abs(b.timestamp - timestamp)
      );
      
      // Use closest prediction
      const closestPrediction = sortedByProximity[0];
      
      // Add predicted resource usage
      if (resource === 'memory') {
        total += closestPrediction.memory.predicted;
      } else if (resource === 'cpu') {
        total += closestPrediction.cpu.predicted;
      }
    }
    
    return total;
  }
  
  private predictOperationResources(
    operationId: string,
    profile: ComputationProfile
  ): void {
    const operationData = this.operationProfiles.get(operationId);
    if (!operationData) return;
    
    // In a real implementation, this would update the existing prediction
    // based on actual progress and resource usage. For this implementation,
    // we'll just adjust the initial predictions slightly.
    
    const predictions = operationData.predictions.predictions;
    const now = Date.now();
    
    // Calculate elapsed time since prediction was created
    const elapsed = now - operationData.lastUpdated;
    
    // Adjust time to complete based on actual progress
    let adjustedTimeToComplete = operationData.predictions.estimatedTimeToComplete;
    const progress = elapsed / adjustedTimeToComplete;
    
    // Get actual resource usage
    const actualMemory = this.getLastValue(this.historicalData.memory);
    const actualCpu = this.getLastValue(this.historicalData.cpu);
    
    // Adjust predictions only if we have some progress
    if (progress > 0.05) {
      // Calculate predicted vs actual resource usage
      const expectedMemoryUsage = this.getExpectedResourceUsageAtProgress(predictions, 'memory', progress);
      const expectedCpuUsage = this.getExpectedResourceUsageAtProgress(predictions, 'cpu', progress);
      
      // Calculate adjustment factors
      const memoryAdjustment = expectedMemoryUsage > 0 ? actualMemory / expectedMemoryUsage : 1;
      const cpuAdjustment = expectedCpuUsage > 0 ? actualCpu / expectedCpuUsage : 1;
      
      // Clamp adjustment to reasonable range
      const clampedMemoryAdjustment = Math.max(0.7, Math.min(1.3, memoryAdjustment));
      const clampedCpuAdjustment = Math.max(0.7, Math.min(1.3, cpuAdjustment));
      
      // Apply adjustments to remaining predictions
      for (let i = 0; i < predictions.length; i++) {
        const prediction = predictions[i];
        const predictionProgress = (prediction.timestamp - operationData.lastUpdated) / adjustedTimeToComplete;
        
        // Only adjust future predictions
        if (predictionProgress > progress) {
          // Adjust memory prediction
          prediction.memory.predicted *= clampedMemoryAdjustment;
          prediction.memory.lowerBound *= clampedMemoryAdjustment;
          prediction.memory.upperBound *= clampedMemoryAdjustment;
          
          // Adjust CPU prediction
          prediction.cpu.predicted *= clampedCpuAdjustment;
          prediction.cpu.lowerBound *= clampedCpuAdjustment;
          prediction.cpu.upperBound *= clampedCpuAdjustment;
        }
      }
      
      // Update confidence score
      const newConfidence = Math.max(0.5, operationData.predictions.confidenceScore * 
        (1 - Math.abs(clampedMemoryAdjustment - 1) - Math.abs(clampedCpuAdjustment - 1)));
      
      // Update the operation prediction
      operationData.predictions = {
        ...operationData.predictions,
        estimatedPeakMemory: operationData.predictions.estimatedPeakMemory * clampedMemoryAdjustment,
        estimatedAverageCpu: operationData.predictions.estimatedAverageCpu * clampedCpuAdjustment,
        confidenceScore: newConfidence,
        predictions
      };
    }
    
    // Update last update timestamp
    operationData.lastUpdated = now;
  }
  
  private getExpectedResourceUsageAtProgress(
    predictions: ResourcePrediction[],
    resource: 'memory' | 'cpu',
    progress: number
  ): number {
    // Find the prediction point that corresponds to the given progress
    if (predictions.length === 0) return 0;
    
    const startTime = predictions[0].timestamp;
    const endTime = predictions[predictions.length - 1].timestamp;
    const duration = endTime - startTime;
    
    const targetTime = startTime + (duration * progress);
    
    // Find closest prediction
    let closestPrediction = predictions[0];
    let minTimeDiff = Math.abs(targetTime - predictions[0].timestamp);
    
    for (let i = 1; i < predictions.length; i++) {
      const timeDiff = Math.abs(targetTime - predictions[i].timestamp);
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestPrediction = predictions[i];
      }
    }
    
    // Return expected resource usage
    if (resource === 'memory') {
      return closestPrediction.memory.predicted;
    } else if (resource === 'cpu') {
      return closestPrediction.cpu.predicted;
    }
    
    return 0;
  }
  
  public getSystemPredictions(): ResourcePrediction[] {
    return this.predictSystemResources();
  }
  
  public getResourceTrends(): ResourceTrend[] {
    const trends: ResourceTrend[] = [];
    
    // Calculate memory trend
    const memoryTrend = this.calculateTrend(this.historicalData.memory);
    const memoryDirection = memoryTrend > 0.05 ? 'increasing' : 
                          memoryTrend < -0.05 ? 'decreasing' : 'stable';
    
    trends.push({
      resource: 'memory',
      direction: memoryDirection,
      rate: memoryTrend,
      confidence: this.modelMetrics.memory.accuracy
    });
    
    // Calculate CPU trend
    const cpuTrend = this.calculateTrend(this.historicalData.cpu);
    const cpuDirection = cpuTrend > 0.05 ? 'increasing' : 
                       cpuTrend < -0.05 ? 'decreasing' : 'stable';
    
    trends.push({
      resource: 'cpu',
      direction: cpuDirection,
      rate: cpuTrend,
      confidence: this.modelMetrics.cpu.accuracy
    });
    
    // Calculate battery trend
    const batteryTrend = this.calculateTrend(this.historicalData.battery);
    const batteryDirection = batteryTrend > 0.1 ? 'increasing' : 
                           batteryTrend < -0.1 ? 'decreasing' : 'stable';
    
    // Calculate time to critical battery level if decreasing
    let timeToThreshold;
    if (batteryDirection === 'decreasing' && batteryTrend < 0) {
      const lastBattery = this.getLastValue(this.historicalData.battery);
      const criticalLevel = 15; // 15% battery is critical
      if (lastBattery > criticalLevel) {
        // Calculate minutes until critical
        const minutesToCritical = (lastBattery - criticalLevel) / Math.abs(batteryTrend);
        // Convert to milliseconds
        timeToThreshold = minutesToCritical * 60 * 1000;
      }
    }
    
    trends.push({
      resource: 'battery',
      direction: batteryDirection,
      rate: batteryTrend,
      timeToThreshold,
      confidence: this.modelMetrics.battery.accuracy
    });
    
    // Calculate network trend
    const networkTrend = this.calculateTrend(this.historicalData.network);
    const networkDirection = networkTrend > 100 ? 'increasing' : 
                           networkTrend < -100 ? 'decreasing' : 'stable';
    
    trends.push({
      resource: 'network',
      direction: networkDirection,
      rate: networkTrend,
      confidence: this.modelMetrics.network.accuracy
    });
    
    return trends;
  }
  
  public getOperationPrediction(operationId: string): OperationResourcePrediction | null {
    const operationData = this.operationProfiles.get(operationId);
    return operationData ? operationData.predictions : null;
  }
  
  public updateConfig(config: Partial<PredictionModelConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  public getModelMetrics(): typeof this.modelMetrics {
    return this.modelMetrics;
  }
}