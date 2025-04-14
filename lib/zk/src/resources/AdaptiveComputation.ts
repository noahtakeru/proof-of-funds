import { ResourceMonitor } from './ResourceMonitor';
import { ResourceAllocator, ResourcePriority, OperationProfile } from './ResourceAllocator';
import { deviceCapabilities } from '../deviceCapabilities';

enum ComputationStrategy {
  FULL_COMPUTATION = 'full',
  PARTIAL_COMPUTATION = 'partial',
  DISTRIBUTED_COMPUTATION = 'distributed',
  PROGRESSIVE_COMPUTATION = 'progressive',
  DEFERRED_COMPUTATION = 'deferred',
  FALLBACK_COMPUTATION = 'fallback'
}

enum ComputationPhase {
  PREPARATION = 'preparation',
  WITNESS_GENERATION = 'witness-generation',
  PROVING = 'proving',
  VERIFICATION = 'verification',
  SERIALIZATION = 'serialization'
}

type ComputationProfile = {
  circuitSize: number;                     // Number of constraints
  expectedWitnessDuration: number;         // Expected time for witness generation in ms
  expectedProvingDuration: number;         // Expected time for proving in ms
  circuitMemoryRequirements: number;       // Memory required for the circuit in bytes
  witnessMemoryRequirements: number;       // Memory required for witness generation in bytes
  provingMemoryRequirements: number;       // Memory required for proving in bytes
  canSplitComputation: boolean;            // Whether the computation can be split into phases
  supportsFallbackMode: boolean;           // Whether server-side fallback is supported
  supportsPartialResults: boolean;         // Whether partial results are useful
  supportsCachedResults: boolean;          // Whether results can be cached
  cacheTTL?: number;                       // How long results can be cached (in ms)
};

type AdaptiveStrategyConfig = {
  enabledStrategies: ComputationStrategy[];
  maxMemoryUsagePercent: number;
  maxCpuUsagePercent: number;
  lowMemoryThresholdMB: number;
  minBatteryLevel: number;
  serverFallbackEndpoint?: string;
  preferPerformanceOverBattery: boolean;
  maxPhaseRetries: number;
  progressiveComputationChunkSize: number;
  enabledParallelism: boolean;
  timeoutMs: number;
};

type ComputationResult = {
  success: boolean;
  result?: T;
  partial?: boolean;
  progress?: number;
  strategy: ComputationStrategy;
  error?: Error;
  phaseResults?: Record<ComputationPhase, any>;
  elapsedTime: number;
  resourcesUsed: {
    memory: number;
    cpu: number;
    battery?: number;
  };
};

const DEFAULT_CONFIG: AdaptiveStrategyConfig = {
  enabledStrategies: [
    ComputationStrategy.FULL_COMPUTATION,
    ComputationStrategy.PROGRESSIVE_COMPUTATION,
    ComputationStrategy.FALLBACK_COMPUTATION
  ],
  maxMemoryUsagePercent: 80,
  maxCpuUsagePercent: 85,
  lowMemoryThresholdMB: 200,
  minBatteryLevel: 15,
  preferPerformanceOverBattery: false,
  maxPhaseRetries: 2,
  progressiveComputationChunkSize: 10000,
  enabledParallelism: true,
  timeoutMs: 120000 // 2 minutes
};

class AdaptiveComputation {
  private monitor: ResourceMonitor;
  private allocator: ResourceAllocator;
  private config: AdaptiveStrategyConfig;
  private activeComputations: Map<string, {
    startTime: number;
    strategy: ComputationStrategy;
    profile: ComputationProfile;
    currentPhase?: ComputationPhase;
    progress: number;
  }> = new Map();
  
  constructor(
    monitor: ResourceMonitor,
    allocator: ResourceAllocator,
    config: Partial<AdaptiveStrategyConfig> = {}
  ) {
    this.monitor = monitor;
    this.allocator = allocator;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Register callback with resource monitor to handle resource changes
    this.monitor.registerCallback(this.handleResourceChange.bind(this));
  }
  
  public async executeComputation<T>(
    computationId: string,
    computation: (resources: any) => Promise<T>,
    profile: ComputationProfile,
    priority: ResourcePriority = ResourcePriority.MEDIUM
  ): Promise<ComputationResult<T>> {
    // Create operation profile for resource allocation
    const operationProfile = this.createOperationProfile(computationId, profile, priority);
    
    // Request resource allocation
    const allocation = await this.allocator.requestAllocation(operationProfile);
    
    if (!allocation.approved) {
      // If allocation was denied, try fallback strategies
      if (allocation.fallbackOptions && allocation.fallbackOptions.length > 0) {
        // Try with a more conservative allocation
        return this.executeWithFallbackAllocation(computationId, computation, profile, allocation.fallbackOptions[0], priority);
      } else {
        // No resource allocation available, check if fallback computation is enabled
        if (this.config.enabledStrategies.includes(ComputationStrategy.FALLBACK_COMPUTATION) && 
            profile.supportsFallbackMode && 
            this.config.serverFallbackEndpoint) {
          return this.executeFallbackComputation<T>(computationId, profile);
        } else {
          return {
            success: false,
            strategy: ComputationStrategy.FULL_COMPUTATION,
            error: new Error('Insufficient resources for computation and no fallback available'),
            elapsedTime: 0,
            resourcesUsed: { memory: 0, cpu: 0 }
          };
        }
      }
    }
    
    // Determine the best computation strategy based on available resources
    const strategy = this.selectComputationStrategy(profile, allocation);
    
    // Record start of computation
    const startTime = Date.now();
    this.activeComputations.set(computationId, {
      startTime,
      strategy,
      profile,
      currentPhase: ComputationPhase.PREPARATION,
      progress: 0
    });
    
    // Execute the appropriate strategy
    let result: ComputationResult<T>;
    
    try {
      switch (strategy) {
        case ComputationStrategy.FULL_COMPUTATION:
          result = await this.executeFullComputation(computationId, computation, allocation);
          break;
          
        case ComputationStrategy.PROGRESSIVE_COMPUTATION:
          result = await this.executeProgressiveComputation(computationId, computation, profile, allocation);
          break;
          
        case ComputationStrategy.PARTIAL_COMPUTATION:
          result = await this.executePartialComputation(computationId, computation, profile, allocation);
          break;
          
        case ComputationStrategy.DISTRIBUTED_COMPUTATION:
          result = await this.executeDistributedComputation(computationId, computation, profile, allocation);
          break;
          
        case ComputationStrategy.DEFERRED_COMPUTATION:
          result = await this.executeDeferredComputation(computationId, computation, profile, allocation);
          break;
          
        case ComputationStrategy.FALLBACK_COMPUTATION:
          result = await this.executeFallbackComputation<T>(computationId, profile);
          break;
          
        default:
          // Default to full computation
          result = await this.executeFullComputation(computationId, computation, allocation);
      }
    } catch (error) {
      // Handle computation error
      result = {
        success: false,
        strategy,
        error: error instanceof Error ? error : new Error(String(error)),
        elapsedTime: Date.now() - startTime,
        resourcesUsed: await this.calculateResourcesUsed(computationId)
      };
    } finally {
      // Clean up and release resources
      this.activeComputations.delete(computationId);
      this.allocator.cancelOperation(computationId);
    }
    
    return result;
  }
  
  private createOperationProfile(
    computationId: string,
    profile: ComputationProfile,
    priority: ResourcePriority
  ): OperationProfile {
    // Estimate total memory requirement as max of all phases
    const estimatedMemory = Math.max(
      profile.circuitMemoryRequirements,
      profile.witnessMemoryRequirements,
      profile.provingMemoryRequirements
    );
    
    // Estimate CPU utilization based on circuit size
    const estimatedCpuUtilization = Math.min(1.0, profile.circuitSize / 1000000);
    
    // Estimate duration based on expected durations
    const estimatedDuration = profile.expectedWitnessDuration + profile.expectedProvingDuration;
    
    // Create resource requirements
    const memoryRequirement = {
      type: 'memory' as const,
      minimumRequired: Math.max(profile.circuitMemoryRequirements, profile.witnessMemoryRequirements),
      recommended: estimatedMemory,
      units: 'bytes',
      priority
    };
    
    // Determine CPU requirements based on circuit size
    const cpuCores = deviceCapabilities.getCpuCores();
    const cpuRequirement = {
      type: 'cpu' as const,
      minimumRequired: Math.max(1, cpuCores / 4), // At least 1 core or 25% of available
      recommended: Math.min(cpuCores - 1, Math.max(2, cpuCores / 2)), // Half of available cores, at least 2
      units: 'cores',
      priority
    };
    
    return {
      name: computationId,
      estimatedMemory,
      estimatedCpuUtilization,
      estimatedDuration,
      priority,
      canBePaused: profile.canSplitComputation,
      requiredResources: [
        memoryRequirement,
        cpuRequirement
      ]
    };
  }
  
  private selectComputationStrategy(
    profile: ComputationProfile,
    allocation: any
  ): ComputationStrategy {
    // Get current resource status
    const batteryLevel = this.monitor.getBatteryLevel();
    const availableMemoryMB = allocation.allocatedMemory ? allocation.allocatedMemory / (1024 * 1024) : 0;
    
    // Check for critical conditions
    if (batteryLevel < this.config.minBatteryLevel && !this.config.preferPerformanceOverBattery) {
      // Low battery, use lighter strategy if available
      if (profile.supportsFallbackMode && 
          this.config.enabledStrategies.includes(ComputationStrategy.FALLBACK_COMPUTATION) &&
          this.config.serverFallbackEndpoint) {
        return ComputationStrategy.FALLBACK_COMPUTATION;
      }
    }
    
    // Check for low memory conditions
    if (availableMemoryMB < this.config.lowMemoryThresholdMB) {
      // Very low memory available
      if (profile.supportsFallbackMode && 
          this.config.enabledStrategies.includes(ComputationStrategy.FALLBACK_COMPUTATION) &&
          this.config.serverFallbackEndpoint) {
        return ComputationStrategy.FALLBACK_COMPUTATION;
      } else if (profile.canSplitComputation && 
                this.config.enabledStrategies.includes(ComputationStrategy.PROGRESSIVE_COMPUTATION)) {
        return ComputationStrategy.PROGRESSIVE_COMPUTATION;
      }
    }
    
    // Check if we can do full computation
    const totalMemoryRequirement = Math.max(
      profile.circuitMemoryRequirements,
      profile.witnessMemoryRequirements, 
      profile.provingMemoryRequirements
    );
    
    if (allocation.allocatedMemory >= totalMemoryRequirement && 
        this.config.enabledStrategies.includes(ComputationStrategy.FULL_COMPUTATION)) {
      return ComputationStrategy.FULL_COMPUTATION;
    }
    
    // Check for progressive computation
    if (profile.canSplitComputation && 
        this.config.enabledStrategies.includes(ComputationStrategy.PROGRESSIVE_COMPUTATION)) {
      return ComputationStrategy.PROGRESSIVE_COMPUTATION;
    }
    
    // Check for partial computation
    if (profile.supportsPartialResults && 
        this.config.enabledStrategies.includes(ComputationStrategy.PARTIAL_COMPUTATION)) {
      return ComputationStrategy.PARTIAL_COMPUTATION;
    }
    
    // Check for distributed computation
    if (this.config.enabledStrategies.includes(ComputationStrategy.DISTRIBUTED_COMPUTATION)) {
      return ComputationStrategy.DISTRIBUTED_COMPUTATION;
    }
    
    // Check for deferred computation
    if (this.config.enabledStrategies.includes(ComputationStrategy.DEFERRED_COMPUTATION)) {
      return ComputationStrategy.DEFERRED_COMPUTATION;
    }
    
    // Fallback to server computation
    if (profile.supportsFallbackMode && 
        this.config.enabledStrategies.includes(ComputationStrategy.FALLBACK_COMPUTATION) &&
        this.config.serverFallbackEndpoint) {
      return ComputationStrategy.FALLBACK_COMPUTATION;
    }
    
    // Default to full computation and hope for the best
    return ComputationStrategy.FULL_COMPUTATION;
  }
  
  private async executeFullComputation<T>(
    computationId: string,
    computation: (resources: any) => Promise<T>,
    allocation: any
  ): Promise<ComputationResult<T>> {
    const startTime = Date.now();
    const initialResources = await this.monitor.sampleResources();
    
    try {
      // Update computation phase
      this.updateComputationProgress(computationId, ComputationPhase.PROVING, 0);
      
      // Execute computation with timeout
      const result = await this.executeWithTimeout(
        () => computation({
          memory: allocation.allocatedMemory,
          cpu: allocation.allocatedCores
        }),
        this.config.timeoutMs
      );
      
      // Update progress to 100%
      this.updateComputationProgress(computationId, ComputationPhase.SERIALIZATION, 100);
      
      // Calculate resources used
      const resourcesUsed = await this.calculateResourcesUsed(computationId, initialResources);
      
      return {
        success: true,
        result,
        strategy: ComputationStrategy.FULL_COMPUTATION,
        elapsedTime: Date.now() - startTime,
        resourcesUsed
      };
    } catch (error) {
      // Check if we should try another strategy
      if (error instanceof Error && error.message.includes('timeout')) {
        const computation = this.activeComputations.get(computationId);
        if (computation && computation.profile.supportsFallbackMode &&
            this.config.enabledStrategies.includes(ComputationStrategy.FALLBACK_COMPUTATION) &&
            this.config.serverFallbackEndpoint) {
          // Try fallback computation
          return this.executeFallbackComputation<T>(computationId, computation.profile);
        }
      }
      
      // Handle computation error
      return {
        success: false,
        strategy: ComputationStrategy.FULL_COMPUTATION,
        error: error instanceof Error ? error : new Error(String(error)),
        elapsedTime: Date.now() - startTime,
        resourcesUsed: await this.calculateResourcesUsed(computationId, initialResources)
      };
    }
  }
  
  private async executeProgressiveComputation<T>(
    computationId: string,
    computation: (resources: any) => Promise<T>,
    profile: ComputationProfile,
    allocation: any
  ): Promise<ComputationResult<T>> {
    const startTime = Date.now();
    const initialResources = await this.monitor.sampleResources();
    const phaseResults: Record<ComputationPhase, any> = {} as any;
    
    // Progressive computation executes in phases with checkpoints
    try {
      // Phase 1: Preparation and circuit setup
      this.updateComputationProgress(computationId, ComputationPhase.PREPARATION, 0);
      const prepResult = await this.executePreparePhase(computationId, allocation);
      phaseResults[ComputationPhase.PREPARATION] = prepResult;
      this.updateComputationProgress(computationId, ComputationPhase.PREPARATION, 100);
      
      // Phase 2: Witness generation
      this.updateComputationProgress(computationId, ComputationPhase.WITNESS_GENERATION, 0);
      const witnessResult = await this.executeWitnessGenerationPhase(computationId, prepResult, allocation);
      phaseResults[ComputationPhase.WITNESS_GENERATION] = witnessResult;
      this.updateComputationProgress(computationId, ComputationPhase.WITNESS_GENERATION, 100);
      
      // Phase 3: Proving
      this.updateComputationProgress(computationId, ComputationPhase.PROVING, 0);
      const provingResult = await this.executeProvingPhase(computationId, witnessResult, allocation);
      phaseResults[ComputationPhase.PROVING] = provingResult;
      this.updateComputationProgress(computationId, ComputationPhase.PROVING, 100);
      
      // Phase 4: Verification and finalization
      this.updateComputationProgress(computationId, ComputationPhase.VERIFICATION, 0);
      const verificationResult = await this.executeVerificationPhase(computationId, provingResult, allocation);
      phaseResults[ComputationPhase.VERIFICATION] = verificationResult;
      this.updateComputationProgress(computationId, ComputationPhase.VERIFICATION, 100);
      
      // Phase 5: Serialization
      this.updateComputationProgress(computationId, ComputationPhase.SERIALIZATION, 0);
      // Combine all phase results into final result
      const result = verificationResult as T;
      this.updateComputationProgress(computationId, ComputationPhase.SERIALIZATION, 100);
      
      // Calculate resources used
      const resourcesUsed = await this.calculateResourcesUsed(computationId, initialResources);
      
      return {
        success: true,
        result,
        strategy: ComputationStrategy.PROGRESSIVE_COMPUTATION,
        elapsedTime: Date.now() - startTime,
        resourcesUsed,
        phaseResults
      };
    } catch (error) {
      // Get the current phase from active computations
      const computation = this.activeComputations.get(computationId);
      const currentPhase = computation?.currentPhase;
      
      // Handle computation error
      return {
        success: false,
        strategy: ComputationStrategy.PROGRESSIVE_COMPUTATION,
        partial: Object.keys(phaseResults).length > 0,
        progress: computation?.progress || 0,
        error: error instanceof Error ? error : new Error(String(error)),
        elapsedTime: Date.now() - startTime,
        resourcesUsed: await this.calculateResourcesUsed(computationId, initialResources),
        phaseResults
      };
    }
  }
  
  private async executePartialComputation<T>(
    computationId: string,
    computation: (resources: any) => Promise<T>,
    profile: ComputationProfile,
    allocation: any
  ): Promise<ComputationResult<T>> {
    // Partial computation executes with reduced circuit constraints or simplified logic
    // but still produces useful results
    const startTime = Date.now();
    const initialResources = await this.monitor.sampleResources();
    
    try {
      // Update computation phase
      this.updateComputationProgress(computationId, ComputationPhase.PREPARATION, 0);
      
      // Calculate how much we need to reduce the computation
      const memoryRatio = allocation.allocatedMemory / profile.provingMemoryRequirements;
      const reductionFactor = Math.min(1, Math.max(0.3, memoryRatio)); // Reduce between 0-70%
      
      // Execute computation with reduced parameters
      const partialParams = {
        memory: allocation.allocatedMemory,
        cpu: allocation.allocatedCores,
        partial: true,
        reductionFactor
      };
      
      // Update computation progress
      this.updateComputationProgress(computationId, ComputationPhase.PROVING, 0);
      
      // Execute computation with timeout
      const partialResult = await this.executeWithTimeout(
        () => computation(partialParams),
        this.config.timeoutMs
      );
      
      // Update progress
      this.updateComputationProgress(computationId, ComputationPhase.SERIALIZATION, 100);
      
      // Calculate resources used
      const resourcesUsed = await this.calculateResourcesUsed(computationId, initialResources);
      
      return {
        success: true,
        result: partialResult,
        partial: true,
        progress: Math.round(reductionFactor * 100),
        strategy: ComputationStrategy.PARTIAL_COMPUTATION,
        elapsedTime: Date.now() - startTime,
        resourcesUsed
      };
    } catch (error) {
      // Handle computation error
      return {
        success: false,
        strategy: ComputationStrategy.PARTIAL_COMPUTATION,
        error: error instanceof Error ? error : new Error(String(error)),
        elapsedTime: Date.now() - startTime,
        resourcesUsed: await this.calculateResourcesUsed(computationId, initialResources)
      };
    }
  }
  
  private async executeDistributedComputation<T>(
    computationId: string,
    computation: (resources: any) => Promise<T>,
    profile: ComputationProfile,
    allocation: any
  ): Promise<ComputationResult<T>> {
    // Distributed computation spreads work across multiple threads or web workers
    const startTime = Date.now();
    const initialResources = await this.monitor.sampleResources();
    
    try {
      // Check if parallelism is enabled and available
      if (!this.config.enabledParallelism) {
        throw new Error('Parallelism is disabled in the configuration');
      }
      
      // Determine the number of workers to use
      const availableCores = allocation.allocatedCores || 1;
      // Use 75% of available cores for workers, at least 1
      const workerCount = Math.max(1, Math.floor(availableCores * 0.75));
      
      // Update computation phase
      this.updateComputationProgress(computationId, ComputationPhase.PREPARATION, 0);
      
      // Execute computation with distributed parameters
      const distributedParams = {
        memory: allocation.allocatedMemory,
        cpu: allocation.allocatedCores,
        distributed: true,
        workerCount
      };
      
      this.updateComputationProgress(computationId, ComputationPhase.PROVING, 0);
      
      // Execute computation with timeout
      const result = await this.executeWithTimeout(
        () => computation(distributedParams),
        this.config.timeoutMs
      );
      
      this.updateComputationProgress(computationId, ComputationPhase.SERIALIZATION, 100);
      
      // Calculate resources used
      const resourcesUsed = await this.calculateResourcesUsed(computationId, initialResources);
      
      return {
        success: true,
        result,
        strategy: ComputationStrategy.DISTRIBUTED_COMPUTATION,
        elapsedTime: Date.now() - startTime,
        resourcesUsed
      };
    } catch (error) {
      // Handle computation error
      return {
        success: false,
        strategy: ComputationStrategy.DISTRIBUTED_COMPUTATION,
        error: error instanceof Error ? error : new Error(String(error)),
        elapsedTime: Date.now() - startTime,
        resourcesUsed: await this.calculateResourcesUsed(computationId, initialResources)
      };
    }
  }
  
  private async executeDeferredComputation<T>(
    computationId: string,
    computation: (resources: any) => Promise<T>,
    profile: ComputationProfile,
    allocation: any
  ): Promise<ComputationResult<T>> {
    // Deferred computation schedules work for later when resources are available
    // This implementation performs minimal work now and schedules the rest
    
    const startTime = Date.now();
    const initialResources = await this.monitor.sampleResources();
    
    try {
      // Update computation phase
      this.updateComputationProgress(computationId, ComputationPhase.PREPARATION, 0);
      
      // Create parameters for deferred execution
      const deferredParams = {
        memory: allocation.allocatedMemory,
        cpu: allocation.allocatedCores,
        deferred: true,
        preparationOnly: true
      };
      
      // Execute the preparation part of the computation
      const deferInfo = await computation(deferredParams);
      
      // Schedule the full computation for later
      this.scheduleDeferredComputation(computationId, computation, profile, allocation);
      
      // Calculate resources used for preparation
      const resourcesUsed = await this.calculateResourcesUsed(computationId, initialResources);
      
      return {
        success: true,
        result: deferInfo as any as T,
        partial: true,
        progress: 10, // Only preparation is done
        strategy: ComputationStrategy.DEFERRED_COMPUTATION,
        elapsedTime: Date.now() - startTime,
        resourcesUsed
      };
    } catch (error) {
      // Handle computation error
      return {
        success: false,
        strategy: ComputationStrategy.DEFERRED_COMPUTATION,
        error: error instanceof Error ? error : new Error(String(error)),
        elapsedTime: Date.now() - startTime,
        resourcesUsed: await this.calculateResourcesUsed(computationId, initialResources)
      };
    }
  }
  
  private async executeFallbackComputation<T>(
    computationId: string,
    profile: ComputationProfile
  ): Promise<ComputationResult<T>> {
    // Server-side fallback computation
    if (!this.config.serverFallbackEndpoint) {
      return {
        success: false,
        strategy: ComputationStrategy.FALLBACK_COMPUTATION,
        error: new Error('Server fallback endpoint not configured'),
        elapsedTime: 0,
        resourcesUsed: { memory: 0, cpu: 0 }
      };
    }
    
    const startTime = Date.now();
    const initialResources = await this.monitor.sampleResources();
    
    try {
      // Update computation phase
      this.updateComputationProgress(computationId, ComputationPhase.PREPARATION, 0);
      
      // Prepare payload for server
      const payload = JSON.stringify({
        computationId,
        profile,
        timestamp: Date.now()
      });
      
      this.updateComputationProgress(computationId, ComputationPhase.PROVING, 50);
      
      // Simulate API call to server endpoint
      // In a real implementation, this would be a fetch call to the server
      // For now, we'll simulate the server response
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate server response
      const serverResult = { /* Mock server result */ } as T;
      
      this.updateComputationProgress(computationId, ComputationPhase.VERIFICATION, 90);
      
      // Validate server response
      // In a real implementation, we'd verify the server's response
      
      this.updateComputationProgress(computationId, ComputationPhase.SERIALIZATION, 100);
      
      // Calculate resources used (minimal for client since work was done on server)
      const resourcesUsed = {
        memory: 10 * 1024 * 1024, // 10MB for client overhead
        cpu: 0.1 // 10% of one core
      };
      
      return {
        success: true,
        result: serverResult,
        strategy: ComputationStrategy.FALLBACK_COMPUTATION,
        elapsedTime: Date.now() - startTime,
        resourcesUsed
      };
    } catch (error) {
      // Handle server fallback error
      return {
        success: false,
        strategy: ComputationStrategy.FALLBACK_COMPUTATION,
        error: error instanceof Error ? error : new Error(String(error)),
        elapsedTime: Date.now() - startTime,
        resourcesUsed: { memory: 10 * 1024 * 1024, cpu: 0.1 }
      };
    }
  }
  
  private async executeWithFallbackAllocation<T>(
    computationId: string,
    computation: (resources: any) => Promise<T>,
    profile: ComputationProfile,
    allocation: any,
    priority: ResourcePriority
  ): Promise<ComputationResult<T>> {
    // Execute with a more conservative allocation that was approved
    const startTime = Date.now();
    
    // Create a new operation profile with reduced requirements
    const operationProfile = this.createOperationProfile(computationId, profile, priority);
    
    // Add to active operations
    this.activeComputations.set(computationId, {
      startTime,
      strategy: ComputationStrategy.FULL_COMPUTATION,
      profile,
      progress: 0
    });
    
    // Add to allocator's active operations
    this.allocator.queueOperation(operationProfile);
    await this.allocator.startOperation(computationId);
    
    try {
      // Execute with the fallback allocation
      const result = await this.executeFullComputation(computationId, computation, allocation);
      return result;
    } finally {
      // Clean up
      this.activeComputations.delete(computationId);
      this.allocator.cancelOperation(computationId);
    }
  }
  
  // Helper methods for progressive computation
  private async executePreparePhase(
    computationId: string,
    allocation: any
  ): Promise<any> {
    // In a real implementation, this would prepare the circuit and inputs
    // For now, we'll simulate preparation
    return { prepared: true, circuitData: {} };
  }
  
  private async executeWitnessGenerationPhase(
    computationId: string,
    prepResult: any,
    allocation: any
  ): Promise<any> {
    // In a real implementation, this would generate the witness
    // For now, we'll simulate witness generation
    return { witness: {}, ...prepResult };
  }
  
  private async executeProvingPhase(
    computationId: string,
    witnessResult: any,
    allocation: any
  ): Promise<any> {
    // In a real implementation, this would generate the proof
    // For now, we'll simulate proof generation
    return { proof: {}, publicSignals: [], ...witnessResult };
  }
  
  private async executeVerificationPhase(
    computationId: string,
    provingResult: any,
    allocation: any
  ): Promise<any> {
    // In a real implementation, this would verify the proof
    // For now, we'll simulate verification
    return { verified: true, ...provingResult };
  }
  
  // Helper methods
  private updateComputationProgress(
    computationId: string,
    phase: ComputationPhase,
    progress: number
  ): void {
    const computation = this.activeComputations.get(computationId);
    if (computation) {
      computation.currentPhase = phase;
      computation.progress = progress;
    }
  }
  
  private async calculateResourcesUsed(
    computationId: string,
    initialResources?: any
  ): Promise<{ memory: number; cpu: number; battery?: number }> {
    const currentResources = await this.monitor.sampleResources();
    
    if (!initialResources) {
      // If initial resources weren't provided, make a basic estimate
      return {
        memory: currentResources.memory?.used || 50 * 1024 * 1024, // 50MB default
        cpu: currentResources.cpu?.usage || 0.5, // 50% of one core default
        battery: currentResources.battery?.used
      };
    }
    
    // Calculate difference between initial and current resources
    const memoryUsed = Math.max(
      0,
      (currentResources.memory?.used || 0) - (initialResources.memory?.used || 0)
    );
    
    // CPU usage is trickier to measure over time, we'll estimate based on time and core count
    const computation = this.activeComputations.get(computationId);
    const elapsedTime = computation 
      ? (Date.now() - computation.startTime) / 1000 // in seconds
      : 1;
    
    const cpuCores = currentResources.cpu?.cores || deviceCapabilities.getCpuCores();
    const cpuUsed = Math.min(cpuCores, Math.max(0.1, cpuCores * 0.5)); // Estimate 50% usage
    
    // Battery usage if available
    const batteryUsed = currentResources.battery && initialResources.battery
      ? Math.max(0, (initialResources.battery.level || 100) - (currentResources.battery.level || 100))
      : undefined;
    
    return {
      memory: memoryUsed,
      cpu: cpuUsed,
      battery: batteryUsed
    };
  }
  
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let timeoutId: NodeJS.Timeout;
      
      // Create timeout rejection
      if (timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          reject(new Error(`Computation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }
      
      // Execute function
      fn().then(
        result => {
          if (timeoutId) clearTimeout(timeoutId);
          resolve(result);
        },
        error => {
          if (timeoutId) clearTimeout(timeoutId);
          reject(error);
        }
      );
    });
  }
  
  private scheduleDeferredComputation(
    computationId: string,
    computation: any,
    profile: ComputationProfile,
    allocation: any
  ): void {
    // In a real implementation, this would schedule a task to run later
    // For demonstration purposes, we'll just set a timeout
    setTimeout(() => {
      // Generate a new computation ID for the deferred execution
      const deferredId = `${computationId}_deferred`;
      
      // Execute the computation asynchronously
      this.executeComputation(deferredId, computation, profile, ResourcePriority.BACKGROUND)
        .then(result => {
          // Handle the result of the deferred computation
          // In a real implementation, you would store the result or notify the user
          console.log(`Deferred computation ${deferredId} completed`, result);
        })
        .catch(error => {
          console.error(`Deferred computation ${deferredId} failed`, error);
        });
    }, 60000); // Schedule after 1 minute
  }
  
  private async handleResourceChange(resources: any): Promise<void> {
    // Handle significant resource changes that might affect active computations
    
    // Check if we're running out of resources
    const critical = this.isCriticalResourceState(resources);
    
    if (critical) {
      // Pause low priority computations
      this.pauseLowPriorityComputations();
    }
  }
  
  private isCriticalResourceState(resources: any): boolean {
    // Check if resources are in a critical state
    const memoryUsage = resources.memory?.usagePercent || 0;
    const cpuUsage = resources.cpu?.usagePercent || 0;
    const batteryLevel = resources.battery?.level || 100;
    
    return (
      memoryUsage > 90 ||
      cpuUsage > 90 ||
      batteryLevel < this.config.minBatteryLevel / 2
    );
  }
  
  private pauseLowPriorityComputations(): void {
    // In a real implementation, this would coordinate with the resource allocator
    // to pause or throttle low priority computations
    // For demonstration purposes, we'll just log
    console.log('Resource constraint detected, would pause low priority computations');
  }
  
  public getActiveComputations(): string[] {
    return Array.from(this.activeComputations.keys());
  }
  
  public getComputationProgress(computationId: string): { 
    phase: ComputationPhase | undefined; 
    progress: number;
    strategy: ComputationStrategy;
  } | null {
    const computation = this.activeComputations.get(computationId);
    if (!computation) return null;
    
    return {
      phase: computation.currentPhase,
      progress: computation.progress,
      strategy: computation.strategy
    };
  }
  
  public updateConfig(config: Partial<AdaptiveStrategyConfig>): void {
    this.config = { ...this.config, ...config };
  }
}