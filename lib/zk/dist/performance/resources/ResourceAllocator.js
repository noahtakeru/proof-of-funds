import { deviceCapabilities } from '../deviceCapabilities';
var AllocationStrategy;
(function (AllocationStrategy) {
    AllocationStrategy["CONSERVATIVE"] = "conservative";
    AllocationStrategy["BALANCED"] = "balanced";
    AllocationStrategy["AGGRESSIVE"] = "aggressive";
    AllocationStrategy["ADAPTIVE"] = "adaptive";
    AllocationStrategy["OPERATION_SPECIFIC"] = "operation-specific";
    AllocationStrategy["CUSTOM"] = "custom";
})(AllocationStrategy || (AllocationStrategy = {}));
var ResourcePriority;
(function (ResourcePriority) {
    ResourcePriority["CRITICAL"] = "critical";
    ResourcePriority["HIGH"] = "high";
    ResourcePriority["MEDIUM"] = "medium";
    ResourcePriority["LOW"] = "low";
    ResourcePriority["BACKGROUND"] = "background";
})(ResourcePriority || (ResourcePriority = {}));
const DEFAULT_CONFIG = {
    strategy: AllocationStrategy.BALANCED,
    maxMemoryPercentage: 70,
    maxCpuPercentage: 80,
    maxStoragePercentage: 90,
    maxNetworkUsage: 500000, // 500KB/s
    priorityWeights: {
        [ResourcePriority.CRITICAL]: 1,
        [ResourcePriority.HIGH]: 0.8,
        [ResourcePriority.MEDIUM]: 0.6,
        [ResourcePriority.LOW]: 0.4,
        [ResourcePriority.BACKGROUND]: 0.2
    },
    adaptiveThresholds: {
        memory: 85,
        cpu: 90,
        lowBattery: 20
    }
};
class ResourceAllocator {
    constructor(monitor, config = {}) {
        this.activeOperations = new Map();
        this.queuedOperations = [];
        this.pausedOperations = new Map();
        this.monitor = monitor;
        this.config = { ...DEFAULT_CONFIG, ...config };
        // Register callback with monitor to adjust allocations when resource status changes
        this.monitor.registerCallback(this.handleResourceUpdate.bind(this));
    }
    async requestAllocation(operation) {
        const currentResources = await this.monitor.sampleResources();
        // Apply different allocation strategies based on configuration
        switch (this.config.strategy) {
            case AllocationStrategy.CONSERVATIVE:
                return this.conservativeAllocation(operation, currentResources);
            case AllocationStrategy.AGGRESSIVE:
                return this.aggressiveAllocation(operation, currentResources);
            case AllocationStrategy.ADAPTIVE:
                return this.adaptiveAllocation(operation, currentResources);
            case AllocationStrategy.OPERATION_SPECIFIC:
                return this.operationSpecificAllocation(operation, currentResources);
            case AllocationStrategy.CUSTOM:
                if (this.config.customStrategyFn) {
                    return this.config.customStrategyFn(this.monitor, operation);
                }
            // Fall through to balanced if no custom function provided
            case AllocationStrategy.BALANCED:
            default:
                return this.balancedAllocation(operation, currentResources);
        }
    }
    async startOperation(operationId) {
        const operation = this.queuedOperations.find(op => op.name === operationId);
        if (!operation)
            return false;
        const allocation = await this.requestAllocation(operation);
        if (!allocation.approved)
            return false;
        // Remove from queue and add to active operations
        this.queuedOperations = this.queuedOperations.filter(op => op.name !== operationId);
        this.activeOperations.set(operationId, operation);
        return true;
    }
    queueOperation(operation) {
        // Sort queue by priority
        this.queuedOperations.push(operation);
        this.queuedOperations.sort((a, b) => {
            const priorityA = this.config.priorityWeights[a.priority] || 0;
            const priorityB = this.config.priorityWeights[b.priority] || 0;
            return priorityB - priorityA;
        });
    }
    pauseOperation(operationId) {
        const operation = this.activeOperations.get(operationId);
        if (!operation || !operation.canBePaused)
            return false;
        this.activeOperations.delete(operationId);
        this.pausedOperations.set(operationId, operation);
        // Redistribute resources
        this.rebalanceAllocations();
        return true;
    }
    resumeOperation(operationId) {
        const operation = this.pausedOperations.get(operationId);
        if (!operation)
            return false;
        this.pausedOperations.delete(operationId);
        this.queueOperation(operation);
        return true;
    }
    cancelOperation(operationId) {
        if (this.activeOperations.delete(operationId)) {
            this.rebalanceAllocations();
            return true;
        }
        if (this.pausedOperations.delete(operationId))
            return true;
        this.queuedOperations = this.queuedOperations.filter(op => op.name !== operationId);
        return true;
    }
    updateAllocationStrategy(strategy, customConfig) {
        this.config = { ...this.config, strategy, ...customConfig };
        this.rebalanceAllocations();
    }
    async conservativeAllocation(operation, currentResources) {
        // Conservative allocation prioritizes system stability over performance
        // It allocates minimum required resources to ensure operations complete
        // without system degradation
        // Check if minimum requirements can be met
        for (const req of operation.requiredResources) {
            const available = this.calculateAvailableResource(req.type, currentResources);
            if (available < req.minimumRequired) {
                return {
                    approved: false,
                    recommendations: [
                        `Insufficient ${req.type} resources. Required: ${req.minimumRequired}${req.units}, Available: ${available}${req.units}`,
                        `Consider reducing the scope of the operation or waiting until more resources are available.`
                    ]
                };
            }
        }
        // Calculate conservative allocations (50-70% of available, never exceeding recommendations)
        const memoryRequirement = operation.requiredResources.find(r => r.type === 'memory');
        const cpuRequirement = operation.requiredResources.find(r => r.type === 'cpu');
        const conservativeMemoryFactor = 0.5; // Only use 50% of what's available
        const conservativeCpuFactor = 0.6; // Only use 60% of what's available
        const allocatedMemory = memoryRequirement
            ? Math.min(memoryRequirement.recommended, this.calculateAvailableResource('memory', currentResources) * conservativeMemoryFactor)
            : undefined;
        const allocatedCores = cpuRequirement
            ? Math.min(cpuRequirement.recommended, this.calculateAvailableResource('cpu', currentResources) * conservativeCpuFactor)
            : undefined;
        // Apply conservative network priority
        const networkPriority = operation.priority === ResourcePriority.CRITICAL
            ? ResourcePriority.HIGH // Downgrade critical to high
            : operation.priority === ResourcePriority.HIGH
                ? ResourcePriority.MEDIUM // Downgrade high to medium
                : operation.priority; // Keep other priorities as is
        return {
            approved: true,
            allocatedMemory,
            allocatedCores,
            networkPriority,
            estimatedCompletion: this.estimateCompletionTime(operation, { allocatedMemory, allocatedCores }),
            recommendations: [
                'Conservative resource allocation applied. Performance may be slower than optimal.'
            ]
        };
    }
    async balancedAllocation(operation, currentResources) {
        // Balanced allocation aims to provide good performance while
        // maintaining system responsiveness
        // Calculate available resources after accounting for active operations
        const availableMemory = this.calculateAvailableResource('memory', currentResources);
        const availableCpu = this.calculateAvailableResource('cpu', currentResources);
        // Get resource requirements
        const memoryRequirement = operation.requiredResources.find(r => r.type === 'memory');
        const cpuRequirement = operation.requiredResources.find(r => r.type === 'cpu');
        // Check if we have enough resources
        if (memoryRequirement && availableMemory < memoryRequirement.minimumRequired) {
            return {
                approved: false,
                recommendations: [
                    `Insufficient memory. Required: ${memoryRequirement.minimumRequired}${memoryRequirement.units}, Available: ${availableMemory}${memoryRequirement.units}`,
                    'Try pausing other operations or reducing memory requirements.'
                ],
                fallbackOptions: [await this.conservativeAllocation(operation, currentResources)]
            };
        }
        if (cpuRequirement && availableCpu < cpuRequirement.minimumRequired) {
            return {
                approved: false,
                recommendations: [
                    `Insufficient CPU resources. Required: ${cpuRequirement.minimumRequired}${cpuRequirement.units}, Available: ${availableCpu}${cpuRequirement.units}`,
                    'Try pausing other operations or reducing CPU requirements.'
                ],
                fallbackOptions: [await this.conservativeAllocation(operation, currentResources)]
            };
        }
        // Calculate balanced allocations (aiming for the recommended level when possible)
        const allocatedMemory = memoryRequirement
            ? Math.min(memoryRequirement.recommended, availableMemory * 0.8 // Use up to 80% of available memory
            )
            : undefined;
        const allocatedCores = cpuRequirement
            ? Math.min(cpuRequirement.recommended, availableCpu * 0.8 // Use up to 80% of available CPU
            )
            : undefined;
        // Keep network priority as specified in operation
        const networkPriority = operation.priority;
        return {
            approved: true,
            allocatedMemory,
            allocatedCores,
            networkPriority,
            estimatedCompletion: this.estimateCompletionTime(operation, { allocatedMemory, allocatedCores }),
            recommendations: []
        };
    }
    async aggressiveAllocation(operation, currentResources) {
        // Aggressive allocation prioritizes performance over system stability
        // It allocates maximum resources to ensure operations complete quickly
        // Calculate maximum resources we can allocate
        const totalMemory = currentResources.memory?.total || deviceCapabilities.getMemoryLimit();
        const totalCpu = currentResources.cpu?.cores || deviceCapabilities.getCpuCores();
        // Get resource requirements
        const memoryRequirement = operation.requiredResources.find(r => r.type === 'memory');
        const cpuRequirement = operation.requiredResources.find(r => r.type === 'cpu');
        // Calculate aggressive allocations (up to 90% of total resources)
        const maxMemoryAllocation = totalMemory * (this.config.maxMemoryPercentage / 100);
        const maxCpuAllocation = totalCpu * (this.config.maxCpuPercentage / 100);
        const allocatedMemory = memoryRequirement
            ? Math.min(Math.max(memoryRequirement.recommended * 1.2, memoryRequirement.minimumRequired), // 20% more than recommended
            maxMemoryAllocation)
            : undefined;
        const allocatedCores = cpuRequirement
            ? Math.min(Math.max(cpuRequirement.recommended * 1.2, cpuRequirement.minimumRequired), // 20% more than recommended
            maxCpuAllocation)
            : undefined;
        // Elevate network priority when possible
        const networkPriority = operation.priority === ResourcePriority.MEDIUM
            ? ResourcePriority.HIGH // Upgrade medium to high
            : operation.priority === ResourcePriority.LOW
                ? ResourcePriority.MEDIUM // Upgrade low to medium
                : operation.priority; // Keep other priorities as is
        return {
            approved: true,
            allocatedMemory,
            allocatedCores,
            networkPriority,
            estimatedCompletion: this.estimateCompletionTime(operation, { allocatedMemory, allocatedCores }),
            recommendations: [
                'Aggressive resource allocation applied. System responsiveness may be reduced.'
            ]
        };
    }
    async adaptiveAllocation(operation, currentResources) {
        // Adaptive allocation adjusts based on current system load and battery status
        const memoryUsagePercent = currentResources.memory?.usagePercent || 0;
        const cpuUsagePercent = currentResources.cpu?.usagePercent || 0;
        const batteryLevel = currentResources.battery?.level || 100;
        // Determine which strategy to use based on current conditions
        if (memoryUsagePercent > this.config.adaptiveThresholds.memory ||
            cpuUsagePercent > this.config.adaptiveThresholds.cpu ||
            batteryLevel < this.config.adaptiveThresholds.lowBattery) {
            // System is under high load or battery is low, use conservative allocation
            return this.conservativeAllocation(operation, currentResources);
        }
        else if (memoryUsagePercent < this.config.adaptiveThresholds.memory * 0.7 &&
            cpuUsagePercent < this.config.adaptiveThresholds.cpu * 0.7 &&
            batteryLevel > this.config.adaptiveThresholds.lowBattery * 2) {
            // System has plenty of resources, use aggressive allocation
            return this.aggressiveAllocation(operation, currentResources);
        }
        else {
            // Use balanced allocation for intermediate cases
            return this.balancedAllocation(operation, currentResources);
        }
    }
    async operationSpecificAllocation(operation, currentResources) {
        // Operation-specific allocation tailors resource allocation based on the
        // specific needs and characteristics of each operation
        // Define operation-specific allocation strategies for known operations
        // This is particularly useful for operations that have unique resource needs
        switch (operation.name) {
            case 'generateMaximumProof':
                // Maximum proofs are memory intensive but can use fewer CPU cores
                return this.allocateForMemoryIntensiveOperation(operation, currentResources);
            case 'verifyProof':
                // Verification is CPU intensive but light on memory
                return this.allocateForCpuIntensiveOperation(operation, currentResources);
            case 'generateBatchProofs':
                // Batch operations need balanced resources but can be throttled
                return this.allocateForBatchOperation(operation, currentResources);
            case 'keyGeneration':
                // Key generation is security-critical and needs dedicated resources
                return this.allocateForSecurityCriticalOperation(operation, currentResources);
            default:
                // Fall back to balanced allocation for unknown operations
                return this.balancedAllocation(operation, currentResources);
        }
    }
    async allocateForMemoryIntensiveOperation(operation, currentResources) {
        const memoryRequirement = operation.requiredResources.find(r => r.type === 'memory');
        const cpuRequirement = operation.requiredResources.find(r => r.type === 'cpu');
        // Allocate up to 90% of available memory but only 60% of CPU
        const availableMemory = this.calculateAvailableResource('memory', currentResources);
        const availableCpu = this.calculateAvailableResource('cpu', currentResources);
        const allocatedMemory = memoryRequirement
            ? Math.min(memoryRequirement.recommended * 1.1, // 10% more than recommended
            availableMemory * 0.9 // 90% of available
            )
            : undefined;
        const allocatedCores = cpuRequirement
            ? Math.min(cpuRequirement.minimumRequired, // Just the minimum
            availableCpu * 0.6 // 60% of available
            )
            : undefined;
        return {
            approved: true,
            allocatedMemory,
            allocatedCores,
            networkPriority: ResourcePriority.LOW, // Memory-intensive ops typically don't need network
            estimatedCompletion: this.estimateCompletionTime(operation, { allocatedMemory, allocatedCores }),
            recommendations: ['Allocated high memory, reduced CPU allocation']
        };
    }
    async allocateForCpuIntensiveOperation(operation, currentResources) {
        const memoryRequirement = operation.requiredResources.find(r => r.type === 'memory');
        const cpuRequirement = operation.requiredResources.find(r => r.type === 'cpu');
        // Allocate up to 90% of available CPU but only 60% of memory
        const availableMemory = this.calculateAvailableResource('memory', currentResources);
        const availableCpu = this.calculateAvailableResource('cpu', currentResources);
        const allocatedMemory = memoryRequirement
            ? Math.min(memoryRequirement.minimumRequired * 1.2, // 20% more than minimum
            availableMemory * 0.6 // 60% of available
            )
            : undefined;
        const allocatedCores = cpuRequirement
            ? Math.min(cpuRequirement.recommended * 1.1, // 10% more than recommended
            availableCpu * 0.9 // 90% of available
            )
            : undefined;
        return {
            approved: true,
            allocatedMemory,
            allocatedCores,
            networkPriority: ResourcePriority.LOW, // CPU-intensive ops typically don't need network
            estimatedCompletion: this.estimateCompletionTime(operation, { allocatedMemory, allocatedCores }),
            recommendations: ['Allocated high CPU, reduced memory allocation']
        };
    }
    async allocateForBatchOperation(operation, currentResources) {
        // Batch operations can be throttled and adjusted based on system load
        const systemLoad = await this.monitor.getSystemLoad();
        // If system is under heavy load, throttle batch operation
        if (systemLoad > 0.7) {
            return {
                approved: true,
                allocatedMemory: operation.estimatedMemory * 0.6,
                allocatedCores: Math.max(1, Math.floor(deviceCapabilities.getCpuCores() * 0.3)),
                networkPriority: ResourcePriority.LOW,
                estimatedCompletion: operation.estimatedDuration * 2, // Expect it to take twice as long
                recommendations: ['Batch operation throttled due to high system load']
            };
        }
        // Otherwise allocate resources normally
        return this.balancedAllocation(operation, currentResources);
    }
    async allocateForSecurityCriticalOperation(operation, currentResources) {
        // Security-critical operations get highest priority and dedicated resources
        // Ensure we have enough resources for security-critical operation
        const availableMemory = this.calculateAvailableResource('memory', currentResources);
        const availableCpu = this.calculateAvailableResource('cpu', currentResources);
        const memoryRequirement = operation.requiredResources.find(r => r.type === 'memory');
        const cpuRequirement = operation.requiredResources.find(r => r.type === 'cpu');
        if ((memoryRequirement && availableMemory < memoryRequirement.recommended) ||
            (cpuRequirement && availableCpu < cpuRequirement.recommended)) {
            // Not enough resources - try to pause other operations
            this.pauseLowerPriorityOperations();
            // Recheck available resources
            const updatedResources = await this.monitor.sampleResources();
            const newAvailableMemory = this.calculateAvailableResource('memory', updatedResources);
            const newAvailableCpu = this.calculateAvailableResource('cpu', updatedResources);
            if ((memoryRequirement && newAvailableMemory < memoryRequirement.minimumRequired) ||
                (cpuRequirement && newAvailableCpu < cpuRequirement.minimumRequired)) {
                return {
                    approved: false,
                    recommendations: [
                        'Insufficient resources for security-critical operation even after pausing other operations',
                        'Try closing other applications or freeing system resources'
                    ]
                };
            }
        }
        // Allocate dedicated resources for security-critical operation
        return {
            approved: true,
            allocatedMemory: memoryRequirement?.recommended,
            allocatedCores: cpuRequirement?.recommended,
            networkPriority: ResourcePriority.CRITICAL,
            estimatedCompletion: this.estimateCompletionTime(operation, {
                allocatedMemory: memoryRequirement?.recommended,
                allocatedCores: cpuRequirement?.recommended
            }),
            recommendations: ['Dedicated resources allocated for security-critical operation']
        };
    }
    calculateAvailableResource(resourceType, currentResources) {
        switch (resourceType) {
            case 'memory':
                const totalMemory = currentResources.memory?.total || deviceCapabilities.getMemoryLimit();
                const usedMemory = currentResources.memory?.used || 0;
                const reservedMemory = this.calculateReservedMemory();
                return totalMemory - usedMemory - reservedMemory;
            case 'cpu':
                const totalCores = currentResources.cpu?.cores || deviceCapabilities.getCpuCores();
                const reservedCores = this.calculateReservedCores();
                return Math.max(0.5, totalCores - reservedCores); // Always leave at least 0.5 core available
            case 'storage':
                const totalStorage = currentResources.storage?.total || deviceCapabilities.getStorageLimit();
                const usedStorage = currentResources.storage?.used || 0;
                return totalStorage - usedStorage;
            case 'network':
                const maxBandwidth = deviceCapabilities.getNetworkBandwidth() || this.config.maxNetworkUsage;
                const usedBandwidth = currentResources.network?.currentBandwidth || 0;
                return maxBandwidth - usedBandwidth;
            case 'battery':
                return currentResources.battery?.level || 100;
            default:
                return 0;
        }
    }
    calculateReservedMemory() {
        // Calculate memory reserved by active operations
        let reservedMemory = 0;
        for (const operation of this.activeOperations.values()) {
            const memReq = operation.requiredResources.find(r => r.type === 'memory');
            if (memReq) {
                reservedMemory += memReq.minimumRequired;
            }
        }
        // Add system reserve (at least 100MB or 10% of total)
        const systemReserve = Math.max(100 * 1024 * 1024, // 100MB
        deviceCapabilities.getMemoryLimit() * 0.1);
        return reservedMemory + systemReserve;
    }
    calculateReservedCores() {
        // Calculate CPU cores reserved by active operations
        let reservedCores = 0;
        for (const operation of this.activeOperations.values()) {
            const cpuReq = operation.requiredResources.find(r => r.type === 'cpu');
            if (cpuReq) {
                reservedCores += cpuReq.minimumRequired;
            }
        }
        // Reserve at least 10% of cores for system
        const systemReserve = Math.max(0.5, // At least 0.5 core
        deviceCapabilities.getCpuCores() * 0.1);
        return reservedCores + systemReserve;
    }
    pauseLowerPriorityOperations() {
        // Sort active operations by priority (lowest first)
        const operations = Array.from(this.activeOperations.entries())
            .filter(([_, op]) => op.canBePaused)
            .sort(([_, opA], [_, opB]) => {
            const priorityA = this.config.priorityWeights[opA.priority] || 0;
            const priorityB = this.config.priorityWeights[opB.priority] || 0;
            return priorityA - priorityB; // Sort ascending by priority weight
        });
        // Pause lowest priority operations first
        for (const [id, op] of operations) {
            if (op.priority !== ResourcePriority.CRITICAL) {
                this.pauseOperation(id);
            }
        }
    }
    estimateCompletionTime(operation, allocation) {
        const { allocatedMemory, allocatedCores } = allocation;
        // Start with the base estimated duration
        let estimatedTime = operation.estimatedDuration;
        // Adjust based on allocated memory vs recommended
        const memoryReq = operation.requiredResources.find(r => r.type === 'memory');
        if (memoryReq && allocatedMemory) {
            const memoryRatio = allocatedMemory / memoryReq.recommended;
            // Memory below recommended increases time, above recommended slightly decreases time
            if (memoryRatio < 1) {
                estimatedTime = estimatedTime * (1 + (1 - memoryRatio) * 0.5);
            }
            else if (memoryRatio > 1) {
                estimatedTime = estimatedTime * (1 - Math.min(0.2, (memoryRatio - 1) * 0.2));
            }
        }
        // Adjust based on allocated CPU vs recommended
        const cpuReq = operation.requiredResources.find(r => r.type === 'cpu');
        if (cpuReq && allocatedCores) {
            const cpuRatio = allocatedCores / cpuReq.recommended;
            // CPU allocation has a more direct impact on performance
            if (cpuRatio < 1) {
                estimatedTime = estimatedTime * (1 + (1 - cpuRatio));
            }
            else if (cpuRatio > 1) {
                estimatedTime = estimatedTime * (1 - Math.min(0.5, (cpuRatio - 1) * 0.5));
            }
        }
        return Math.round(estimatedTime);
    }
    async handleResourceUpdate(resources) {
        // Called when the resource monitor detects significant changes
        // Check if we need to adjust allocations based on current resource utilization
        const memoryUsage = resources.memory?.usagePercent || 0;
        const cpuUsage = resources.cpu?.usagePercent || 0;
        const batteryLevel = resources.battery?.level || 100;
        // If we're hitting resource limits, try to adjust allocations
        if (memoryUsage > 90 ||
            cpuUsage > 90 ||
            batteryLevel < this.config.adaptiveThresholds.lowBattery / 2) {
            // Critical resource constraint - pause low priority operations
            this.handleCriticalResourceConstraint(resources);
        }
        else if (memoryUsage > this.config.adaptiveThresholds.memory ||
            cpuUsage > this.config.adaptiveThresholds.cpu ||
            batteryLevel < this.config.adaptiveThresholds.lowBattery) {
            // High resource utilization - rebalance allocations
            this.rebalanceAllocations();
        }
        else if (memoryUsage < this.config.adaptiveThresholds.memory * 0.5 &&
            cpuUsage < this.config.adaptiveThresholds.cpu * 0.5 &&
            this.queuedOperations.length > 0) {
            // Plenty of resources available - try to start queued operations
            this.startQueuedOperations();
        }
    }
    async handleCriticalResourceConstraint(resources) {
        // Handle critical resource constraints by pausing low priority operations
        // Determine which resource is constrained
        const memoryConstrained = resources.memory?.usagePercent > 90;
        const cpuConstrained = resources.cpu?.usagePercent > 90;
        const batteryConstrained = resources.battery?.level < this.config.adaptiveThresholds.lowBattery / 2;
        // Pause operations based on constrained resources
        for (const [id, operation] of this.activeOperations.entries()) {
            if (!operation.canBePaused)
                continue;
            if (operation.priority === ResourcePriority.BACKGROUND ||
                operation.priority === ResourcePriority.LOW) {
                // Always pause background/low priority operations in critical situations
                this.pauseOperation(id);
                continue;
            }
            if (operation.priority === ResourcePriority.MEDIUM) {
                // Pause medium priority operations if they use the constrained resource
                const memReq = operation.requiredResources.find(r => r.type === 'memory');
                const cpuReq = operation.requiredResources.find(r => r.type === 'cpu');
                if ((memoryConstrained && memReq && memReq.priority !== ResourcePriority.CRITICAL) ||
                    (cpuConstrained && cpuReq && cpuReq.priority !== ResourcePriority.CRITICAL) ||
                    (batteryConstrained)) {
                    this.pauseOperation(id);
                }
            }
        }
    }
    async rebalanceAllocations() {
        // Rebalance resource allocations among active operations
        // Get current resources
        const resources = await this.monitor.sampleResources();
        // Recalculate allocations for all active operations
        for (const [id, operation] of this.activeOperations.entries()) {
            const newAllocation = await this.requestAllocation(operation);
            // If an operation can no longer be supported, pause it
            if (!newAllocation.approved && operation.canBePaused) {
                this.pauseOperation(id);
            }
        }
    }
    async startQueuedOperations() {
        // Attempt to start queued operations if resources are available
        // Make a copy of the queue to avoid modification during iteration
        const queueCopy = [...this.queuedOperations];
        for (const operation of queueCopy) {
            const allocation = await this.requestAllocation(operation);
            if (allocation.approved) {
                this.startOperation(operation.name);
            }
        }
    }
    updateConfiguration(config) {
        this.config = { ...this.config, ...config };
        this.rebalanceAllocations();
    }
    getActiveOperations() {
        return Array.from(this.activeOperations.keys());
    }
    getQueuedOperations() {
        return this.queuedOperations.map(op => op.name);
    }
    getPausedOperations() {
        return Array.from(this.pausedOperations.keys());
    }
}
