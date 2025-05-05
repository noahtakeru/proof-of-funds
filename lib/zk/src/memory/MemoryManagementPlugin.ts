/**
 * Memory Management Plugin
 * 
 * This plugin provides advanced memory management capabilities for ZK operations,
 * integrating with the MemoryOptimizer to apply specific memory optimization
 * strategies based on operation type and system conditions.
 */

import { MemoryOptimizer, OptimizationStrategy } from './MemoryOptimizer';

// Error handling imports
import { ZKError } from '../zkErrorHandler';

// Define error codes needed for this module
enum ErrorCode {
    INVALID_INPUT = 7001,
    UNKNOWN_OPERATION = 8004,
    DUPLICATE_OPERATION = 8005,
    MEMORY_ALLOCATION_FAILED = 4001,
    MEMORY_CHECK_FAILED = 4004
}

// Simple error logger interface
const zkErrorLogger = {
    log: (level: string, message: string, details: any = {}) => {
        console.log(`[${level}] ${message}`, details);
    }
};

// Interface for plugin options
export interface MemoryManagementPluginOptions {
    optimizer?: MemoryOptimizer;
    highPriorityThresholdMB?: number;
    criticalOperationMemoryReserveMB?: number;
    enableAutomaticOptimization?: boolean;
}

// Operation priority enumeration
export enum OperationPriority {
    LOW = 0,
    MEDIUM = 1,
    HIGH = 2,
    CRITICAL = 3
}

// Operation type enumeration
export enum OperationType {
    PROOF_GENERATION = 'proof_generation',
    VERIFICATION = 'verification',
    KEY_GENERATION = 'key_generation',
    SETUP = 'setup',
    CRYPTO_OPERATION = 'crypto_operation'
}

// Operation metadata interface
export interface OperationMetadata {
    id: string;
    type: OperationType;
    priority: OperationPriority;
    estimatedMemoryMB: number;
    context?: Record<string, any>;
    timeRegistered: number;
}

/**
 * Memory Management Plugin for handling ZK operations
 */
export class MemoryManagementPlugin {
    private operations: Map<string, OperationMetadata> = new Map();
    private optimizer: MemoryOptimizer;
    private highPriorityThresholdMB: number;
    private criticalOperationMemoryReserveMB: number;
    private enableAutomaticOptimization: boolean;
    private totalSystemMemoryMB: number;

    /**
     * Create a new MemoryManagementPlugin instance
     * @param options Configuration options for the plugin
     */
    constructor(options: MemoryManagementPluginOptions = {}) {
        this.optimizer = options.optimizer || new MemoryOptimizer();
        this.highPriorityThresholdMB = options.highPriorityThresholdMB || 1024; // 1GB default
        this.criticalOperationMemoryReserveMB = options.criticalOperationMemoryReserveMB || 2048; // 2GB default
        this.enableAutomaticOptimization = options.enableAutomaticOptimization ?? true;

        // Get system memory (default to 8GB if not detectable)
        this.totalSystemMemoryMB = this.detectSystemMemory() || 8192;
    }

    /**
     * Register a new operation with the memory management system
     * @param id Unique identifier for the operation
     * @param type Type of operation
     * @param priority Priority level of the operation
     * @param estimatedMemoryMB Estimated memory usage in MB
     * @param context Additional context information
     * @returns Boolean indicating if registration was successful
     */
    public registerOperation(
        id: string,
        type: OperationType,
        priority: OperationPriority = OperationPriority.MEDIUM,
        estimatedMemoryMB: number,
        context: Record<string, any> = {}
    ): boolean {
        try {
            // Validate inputs
            if (!id || !type || estimatedMemoryMB <= 0) {
                throw new ZKError({
                    code: ErrorCode.INVALID_INPUT,
                    message: 'Invalid operation parameters',
                    details: { id, type, estimatedMemoryMB }
                });
            }

            // Check for duplicate
            if (this.operations.has(id)) {
                throw new ZKError({
                    code: ErrorCode.DUPLICATE_OPERATION,
                    message: 'Operation with this ID already exists',
                    details: { id }
                });
            }

            // Register the operation
            const operationMetadata: OperationMetadata = {
                id,
                type,
                priority,
                estimatedMemoryMB,
                context,
                timeRegistered: Date.now()
            };

            this.operations.set(id, operationMetadata);

            // Apply initial optimization if automatic optimization is enabled
            if (this.enableAutomaticOptimization) {
                this.optimizeOperation(id);
            }

            zkErrorLogger.log('info', 'Operation registered successfully', {
                id, type, priority, estimatedMemoryMB
            });

            return true;
        } catch (error) {
            zkErrorLogger.log('error', 'Failed to register operation', {
                error, id, type
            });
            return false;
        }
    }

    /**
     * Unregister an operation from the memory management system
     * @param id Unique identifier of the operation to unregister
     * @returns Boolean indicating if unregistration was successful
     */
    public unregisterOperation(id: string): boolean {
        try {
            if (!this.operations.has(id)) {
                throw new ZKError({
                    code: ErrorCode.UNKNOWN_OPERATION,
                    message: 'Operation not found',
                    details: { id }
                });
            }

            this.operations.delete(id);
            zkErrorLogger.log('info', 'Operation unregistered', { id });

            return true;
        } catch (error) {
            zkErrorLogger.log('error', 'Failed to unregister operation', {
                error, id
            });
            return false;
        }
    }

    /**
     * Apply memory optimization to a specific operation
     * @param id Unique identifier of the operation to optimize
     * @returns Boolean indicating if optimization was successful
     */
    public optimizeOperation(id: string): boolean {
        try {
            const operation = this.operations.get(id);
            if (!operation) {
                throw new ZKError({
                    code: ErrorCode.UNKNOWN_OPERATION,
                    message: 'Cannot optimize unknown operation',
                    details: { id }
                });
            }

            const memoryInUse = this.calculateMemoryInUse();
            const currentStrategy = this.optimizer.getOptimizationStrategy();

            // Determine the best strategy based on memory usage and operation priority
            const customStrategy: Partial<OptimizationStrategy> = {};

            if (memoryInUse > this.totalSystemMemoryMB * 0.8) {
                // High memory usage - be more aggressive with optimization
                customStrategy.useLazyLoading = true;
                customStrategy.maxConcurrentOperations = 1;
                customStrategy.batchSize = 50;
            } else if (operation.priority === OperationPriority.CRITICAL) {
                // Critical operation - optimize for performance
                customStrategy.useLazyLoading = false;
                customStrategy.maxConcurrentOperations = 3;
                customStrategy.batchSize = 200;
            }

            // Apply the selected strategy
            this.optimizer.applyOptimizationStrategy(id, customStrategy);

            // For high memory pressure, also suggest garbage collection
            if (memoryInUse > this.totalSystemMemoryMB * 0.7) {
                this.optimizer.suggestMemoryCleanup();
            }

            zkErrorLogger.log('info', 'Memory optimization applied', {
                id,
                memoryInUse,
                strategy: customStrategy
            });

            return true;
        } catch (error) {
            zkErrorLogger.log('error', 'Failed to optimize operation', { error, id });
            return false;
        }
    }

    /**
     * Check if sufficient memory is available for an operation
     * @param requiredMemoryMB Memory required in MB
     * @param priority Priority level of the operation
     * @returns Boolean indicating if memory is available
     */
    public isMemoryAvailable(
        requiredMemoryMB: number,
        priority: OperationPriority = OperationPriority.MEDIUM
    ): boolean {
        try {
            // For critical operations, we use the reserved memory allocation
            if (priority === OperationPriority.CRITICAL) {
                return requiredMemoryMB <= this.criticalOperationMemoryReserveMB;
            }

            // Calculate total memory in use
            const memoryInUseMB = this.calculateMemoryInUse();

            // For high priority operations, we use the high priority threshold
            if (priority === OperationPriority.HIGH) {
                return requiredMemoryMB <= (this.totalSystemMemoryMB - memoryInUseMB) ||
                    requiredMemoryMB <= this.highPriorityThresholdMB;
            }

            // For medium and low priority, we check against available system memory
            const availableMemoryMB = this.totalSystemMemoryMB - memoryInUseMB - this.criticalOperationMemoryReserveMB;
            return requiredMemoryMB <= availableMemoryMB;
        } catch (error) {
            zkErrorLogger.log('error', 'Memory availability check failed', {
                error, requiredMemoryMB, priority
            });

            throw new ZKError({
                code: ErrorCode.MEMORY_CHECK_FAILED,
                message: 'Memory availability check failed',
                details: { requiredMemoryMB, priority, error }
            });
        }
    }

    /**
     * Get a list of all registered operations
     * @returns Array of operation metadata
     */
    public getRegisteredOperations(): OperationMetadata[] {
        return Array.from(this.operations.values());
    }

    /**
     * Get operation details by ID
     * @param id Unique identifier of the operation
     * @returns Operation metadata if found, null otherwise
     */
    public getOperationById(id: string): OperationMetadata | null {
        return this.operations.get(id) || null;
    }

    /**
     * Update the estimated memory usage for an operation
     * @param id Unique identifier of the operation
     * @param newEstimatedMemoryMB New estimated memory usage in MB
     * @returns Boolean indicating if update was successful
     */
    public updateMemoryEstimate(id: string, newEstimatedMemoryMB: number): boolean {
        try {
            if (!this.operations.has(id)) {
                throw new ZKError({
                    code: ErrorCode.UNKNOWN_OPERATION,
                    message: 'Operation not found',
                    details: { id }
                });
            }

            if (newEstimatedMemoryMB <= 0) {
                throw new ZKError({
                    code: ErrorCode.INVALID_INPUT,
                    message: 'Invalid memory estimate',
                    details: { id, newEstimatedMemoryMB }
                });
            }

            const operation = this.operations.get(id)!;
            const updatedOperation = {
                ...operation,
                estimatedMemoryMB: newEstimatedMemoryMB
            };

            this.operations.set(id, updatedOperation);

            // Re-optimize if automatic optimization is enabled
            if (this.enableAutomaticOptimization) {
                this.optimizeOperation(id);
            }

            return true;
        } catch (error) {
            zkErrorLogger.log('error', 'Failed to update memory estimate', {
                error, id, newEstimatedMemoryMB
            });
            return false;
        }
    }

    /**
     * Get memory usage statistics for all registered operations
     * @returns Object containing memory usage statistics
     */
    public getMemoryUsageStats(): Record<string, any> {
        const totalRegistered = this.operations.size;
        const memoryInUse = this.calculateMemoryInUse();
        const optimizationStats = this.optimizer.getOptimizationStats();

        // Create a breakdown by operation type
        const operationsByType: Record<string, number> = {};
        const memoryByType: Record<string, number> = {};

        this.operations.forEach(op => {
            operationsByType[op.type] = (operationsByType[op.type] || 0) + 1;
            memoryByType[op.type] = (memoryByType[op.type] || 0) + op.estimatedMemoryMB;
        });

        return {
            totalOperations: totalRegistered,
            totalMemoryMB: memoryInUse,
            memoryUtilizationPercent: (memoryInUse / this.totalSystemMemoryMB) * 100,
            operationsByType,
            memoryByType,
            optimizationStats
        };
    }

    /**
     * Calculate the total memory in use by all registered operations
     * @returns Total memory in use in MB
     */
    private calculateMemoryInUse(): number {
        let totalMemoryInUse = 0;

        // Use Array.from instead of the iterator to avoid TypeScript issues
        Array.from(this.operations.values()).forEach(operation => {
            totalMemoryInUse += operation.estimatedMemoryMB;
        });

        return totalMemoryInUse;
    }

    /**
     * Detect system memory capacity
     * @returns Total system memory in MB, or null if detection fails
     * @private
     */
    private detectSystemMemory(): number | null {
        try {
            // Attempt to detect memory using navigator API if in browser
            if (typeof window !== 'undefined' && navigator && 'deviceMemory' in navigator) {
                // deviceMemory is in GB, convert to MB
                return (navigator as any).deviceMemory * 1024;
            }

            // In Node.js environments, we could use os.totalmem()
            // For now, return null to use default value
            return null;
        } catch {
            return null;
        }
    }
}

// Export a singleton instance
const memoryManagementPlugin = new MemoryManagementPlugin();
export default memoryManagementPlugin; 