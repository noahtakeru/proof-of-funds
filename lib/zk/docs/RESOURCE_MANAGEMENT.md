# Resource Management System

The Resource Management System provides comprehensive monitoring, allocation, and optimization of system resources for ZK proof generation and verification. It enables efficient operation across a wide range of devices and environments, from resource-constrained mobile devices to powerful workstations.

## Overview

The Resource Management System consists of four main components:

1. **ResourceMonitor**: Monitors system resources (memory, CPU, storage, network, battery)
2. **ResourceAllocator**: Allocates resources to operations based on priority and requirements
3. **AdaptiveComputation**: Adapts computation strategies based on available resources
4. **ResourcePrediction**: Predicts future resource availability and operation requirements

These components work together to ensure optimal resource utilization, prevent system overload, and maintain application responsiveness during resource-intensive ZK operations.

## Components

### ResourceMonitor

The ResourceMonitor provides real-time monitoring of system resources:

```typescript
import { ResourceMonitor } from 'lib/zk/src/resources/ResourceMonitor';

// Create a monitor with custom configuration
const monitor = new ResourceMonitor({
  sampleInterval: 1000,  // Sample every 1 second
  enableBatteryMonitoring: true,
  enableNetworkMonitoring: true,
  thresholdNotifications: true,
  memoryThresholdPercent: 80,
  cpuThresholdPercent: 90
});

// Start continuous monitoring
monitor.startContinuousMonitoring();

// Register a callback for resource updates
const callbackId = monitor.registerCallback((resources) => {
  console.log('Current memory usage:', resources.memory.usagePercent);
  console.log('CPU usage:', resources.cpu.usagePercent);
  if (resources.battery) {
    console.log('Battery level:', resources.battery.level);
  }
});

// Take on-demand resource sample
const currentResources = await monitor.sampleResources();

// Check system load (0-1 scale)
const load = await monitor.getSystemLoad();

// Unregister callback when no longer needed
monitor.unregisterCallback(callbackId);

// Stop continuous monitoring when done
monitor.stopContinuousMonitoring();
```

### ResourceAllocator

The ResourceAllocator manages resource allocation between competing operations:

```typescript
import { ResourceAllocator, ResourcePriority } from 'lib/zk/src/resources/ResourceAllocator';
import { ResourceMonitor } from 'lib/zk/src/resources/ResourceMonitor';

// Create monitor and allocator
const monitor = new ResourceMonitor();
const allocator = new ResourceAllocator(monitor, {
  strategy: AllocationStrategy.ADAPTIVE,
  maxMemoryPercentage: 75,
  maxCpuPercentage: 80
});

// Define operation profile
const operationProfile = {
  name: 'generateProof',
  estimatedMemory: 1024 * 1024 * 1024, // 1 GB
  estimatedCpuUtilization: 0.6,
  estimatedDuration: 10000, // 10 seconds
  priority: ResourcePriority.HIGH,
  canBePaused: true,
  requiredResources: [
    {
      type: 'memory',
      minimumRequired: 512 * 1024 * 1024, // 512 MB
      recommended: 1024 * 1024 * 1024, // 1 GB
      units: 'bytes',
      priority: ResourcePriority.HIGH
    },
    {
      type: 'cpu',
      minimumRequired: 2,
      recommended: 4,
      units: 'cores',
      priority: ResourcePriority.HIGH
    }
  ]
};

// Request resource allocation
const allocation = await allocator.requestAllocation(operationProfile);

if (allocation.approved) {
  // Resources are available
  console.log('Allocated memory:', allocation.allocatedMemory);
  console.log('Allocated cores:', allocation.allocatedCores);
  
  // Perform operation with allocated resources
  // ...
} else {
  // Resources not available
  console.log('Resource allocation denied:', allocation.recommendations);
  
  // Check for fallback options
  if (allocation.fallbackOptions && allocation.fallbackOptions.length > 0) {
    console.log('Fallback options available:', allocation.fallbackOptions[0]);
  }
}

// Alternative approach: queue and start operations
allocator.queueOperation(operationProfile);
const started = await allocator.startOperation('generateProof');

// Operations can be paused when resources are needed elsewhere
allocator.pauseOperation('generateProof');

// And resumed later
allocator.resumeOperation('generateProof');

// Or cancelled
allocator.cancelOperation('generateProof');
```

### AdaptiveComputation

The AdaptiveComputation component dynamically selects optimal computation strategies:

```typescript
import { ResourceMonitor } from 'lib/zk/src/resources/ResourceMonitor';
import { ResourceAllocator, ResourcePriority } from 'lib/zk/src/resources/ResourceAllocator';
import { AdaptiveComputation, ComputationStrategy } from 'lib/zk/src/resources/AdaptiveComputation';

// Set up resource management
const monitor = new ResourceMonitor();
const allocator = new ResourceAllocator(monitor);
const adaptive = new AdaptiveComputation(monitor, allocator, {
  enabledStrategies: [
    ComputationStrategy.FULL_COMPUTATION,
    ComputationStrategy.PROGRESSIVE_COMPUTATION,
    ComputationStrategy.FALLBACK_COMPUTATION
  ],
  serverFallbackEndpoint: 'https://api.example.com/zk-fallback',
  timeout: 60000 // 1 minute
});

// Define computation profile
const computationProfile = {
  circuitSize: 100000,
  expectedWitnessDuration: 2000,
  expectedProvingDuration: 8000,
  circuitMemoryRequirements: 1024 * 1024 * 1024, // 1 GB
  witnessMemoryRequirements: 2 * 1024 * 1024 * 1024, // 2 GB
  provingMemoryRequirements: 4 * 1024 * 1024 * 1024, // 4 GB
  canSplitComputation: true,
  supportsFallbackMode: true,
  supportsPartialResults: true,
  supportsCachedResults: false
};

// Define computation function
const computation = async (resources) => {
  // Use allocated resources for computation
  // resources.memory - allocated memory
  // resources.cpu - allocated CPU cores
  
  // If using progressive computation, check for phases
  if (resources.progressive) {
    // Handle progressive computation
  }
  
  // Return computation result
  return { proof: '...', publicSignals: [...] };
};

// Execute computation with adaptive strategy
try {
  const result = await adaptive.executeComputation(
    'proveTransaction',
    computation,
    computationProfile,
    ResourcePriority.MEDIUM
  );
  
  if (result.success) {
    console.log('Computation completed successfully');
    console.log('Strategy used:', result.strategy);
    console.log('Time taken:', result.elapsedTime, 'ms');
    console.log('Resources used:', result.resourcesUsed);
    
    // Use computation result
    const { proof, publicSignals } = result.result;
  } else {
    console.error('Computation failed:', result.error);
  }
} catch (error) {
  console.error('Unexpected error:', error);
}

// Monitor progress of ongoing computations
const progress = adaptive.getComputationProgress('proveTransaction');
if (progress) {
  console.log('Current phase:', progress.phase);
  console.log('Progress:', progress.progress, '%');
  console.log('Strategy:', progress.strategy);
}
```

### ResourcePrediction

The ResourcePrediction component predicts future resource availability and needs:

```typescript
import { ResourceMonitor } from 'lib/zk/src/resources/ResourceMonitor';
import { ResourcePrediction } from 'lib/zk/src/resources/ResourcePrediction';

// Create components
const monitor = new ResourceMonitor();
const prediction = new ResourcePrediction(monitor, {
  predictionWindowSize: 30, // Predict 30 time periods ahead
  predictionInterval: 10000, // 10-second intervals
  smoothingFactor: 0.3,
  enableAutomaticModelUpdate: true
});

// Start prediction
await prediction.start();

// Get current resource trends
const trends = prediction.getResourceTrends();
console.log('Memory trend:', trends.find(t => t.resource === 'memory'));
console.log('CPU trend:', trends.find(t => t.resource === 'cpu'));
console.log('Battery trend:', trends.find(t => t.resource === 'battery'));

// Get future resource predictions
const predictions = prediction.getSystemPredictions();
console.log('Predicted memory usage in 1 minute:', 
  predictions.find(p => p.timestamp > Date.now() + 60000)?.memory.predicted);

// Register operation for resource prediction
const computationProfile = {
  circuitSize: 100000,
  expectedWitnessDuration: 2000,
  expectedProvingDuration: 5000,
  circuitMemoryRequirements: 1024 * 1024 * 1024, // 1 GB
  witnessMemoryRequirements: 512 * 1024 * 1024, // 512 MB
  provingMemoryRequirements: 2 * 1024 * 1024 * 1024, // 2 GB
  canSplitComputation: true,
  supportsFallbackMode: true,
  supportsPartialResults: true,
  supportsCachedResults: false
};

prediction.registerOperation('proofGeneration', computationProfile);

// Get operation-specific prediction
const operationPrediction = prediction.getOperationPrediction('proofGeneration');
console.log('Estimated completion time:', operationPrediction?.estimatedTimeToComplete);
console.log('Estimated peak memory:', operationPrediction?.estimatedPeakMemory);
console.log('Confidence score:', operationPrediction?.confidenceScore);

// Clean up
prediction.unregisterOperation('proofGeneration');
prediction.stop();
```

## Integrated Usage

For a complete resource management workflow:

```typescript
import { ResourceMonitor } from 'lib/zk/src/resources/ResourceMonitor';
import { ResourceAllocator, ResourcePriority } from 'lib/zk/src/resources/ResourceAllocator';
import { AdaptiveComputation } from 'lib/zk/src/resources/AdaptiveComputation';
import { ResourcePrediction } from 'lib/zk/src/resources/ResourcePrediction';

// Setup resource management system
const monitor = new ResourceMonitor();
const allocator = new ResourceAllocator(monitor);
const adaptive = new AdaptiveComputation(monitor, allocator);
const prediction = new ResourcePrediction(monitor);

// Start resource monitoring and prediction
monitor.startContinuousMonitoring();
await prediction.start();

// Define computation profile
const computationProfile = {
  circuitSize: 100000,
  expectedWitnessDuration: 2000,
  expectedProvingDuration: 5000,
  circuitMemoryRequirements: 1024 * 1024 * 1024, // 1 GB
  witnessMemoryRequirements: 512 * 1024 * 1024, // 512 MB
  provingMemoryRequirements: 2 * 1024 * 1024 * 1024, // 2 GB
  canSplitComputation: true,
  supportsFallbackMode: true,
  supportsPartialResults: true,
  supportsCachedResults: false
};

// Register operation with prediction system
prediction.registerOperation('generateProof', computationProfile);

// Get resource prediction
const operationPrediction = prediction.getOperationPrediction('generateProof');
console.log('Predicted resource needs:', operationPrediction);

// Define computation function
const computation = async (resources) => {
  // Perform ZK proof generation with allocated resources
  return { proof: '...', publicSignals: [...] };
};

// Execute computation with adaptive strategy
const result = await adaptive.executeComputation(
  'generateProof',
  computation,
  computationProfile,
  ResourcePriority.HIGH
);

// Use result
if (result.success) {
  console.log('Proof generated successfully using strategy:', result.strategy);
  // Use proof...
} else {
  console.error('Proof generation failed:', result.error);
}

// Clean up
prediction.unregisterOperation('generateProof');
prediction.stop();
monitor.stopContinuousMonitoring();
```

## Best Practices

1. **Resource Monitoring**: Start monitoring early in the application lifecycle to collect baseline data
2. **Resource Allocation**: Use the most appropriate allocation strategy based on the device type (conservative for mobile, aggressive for workstations)
3. **Adaptive Computation**: Enable multiple computation strategies to handle varying resource constraints
4. **Resource Prediction**: Use prediction for planning resource-intensive operations and scheduling them during low-utilization periods
5. **Operation Prioritization**: Assign appropriate priorities to operations based on their importance and user impact
6. **Error Handling**: Always have fallback strategies for handling resource constraints
7. **Mobile Considerations**: Be especially careful with battery usage on mobile devices

## Advanced Topics

### Custom Allocation Strategies

You can create custom allocation strategies by extending the resource allocator:

```typescript
// Custom allocation strategy
const customConfig = {
  strategy: AllocationStrategy.CUSTOM,
  customStrategyFn: async (monitor, operation) => {
    const resources = await monitor.sampleResources();
    // Custom allocation logic
    return {
      approved: true,
      allocatedMemory: /* custom calculation */,
      allocatedCores: /* custom calculation */,
      // ... other allocation parameters
    };
  }
};

const allocator = new ResourceAllocator(monitor, customConfig);
```

### Handling Low-Resource Environments

For extremely constrained environments:

1. Use the `FALLBACK_COMPUTATION` strategy with a server-side endpoint
2. Enable aggressive memory optimization
3. Use progressive computation with checkpoints
4. Consider deferring non-critical operations

### Multi-Device Coordination

For applications running across multiple devices:

1. Use resource prediction to determine the optimal device for computation
2. Distribute computation across devices based on their resource availability
3. Use adaptive strategies to handle device-specific constraints

## Troubleshooting

### Common Issues

1. **Resource Allocation Denied**: Check operation resource requirements and system availability
2. **Computation Timeouts**: Adjust timeouts or try a different computation strategy
3. **Prediction Inaccuracy**: Increase data collection period and update prediction models

### Performance Tuning

1. **Memory Usage**: Adjust buffer sizes and pooling strategies
2. **CPU Utilization**: Tune parallelism settings and worker counts
3. **Battery Impact**: Adjust computation intensity based on battery level
4. **Network Usage**: Control data transfer rates and compression levels

## Conclusion

The Resource Management System provides a comprehensive solution for optimizing resource utilization in ZK applications, ensuring efficient operation across a wide range of devices and environments. By using this system, you can improve application performance, prevent system overload, and enhance user experience during resource-intensive operations.