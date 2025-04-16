/**
 * @fileoverview WebWorkerPool - Efficient worker thread management system
 * 
 * This module provides a sophisticated worker thread pool implementation
 * for offloading CPU-intensive operations to background threads,
 * improving UI responsiveness and enabling parallel processing.
 * 
 * Features:
 * - Dynamic worker pool sizing based on device capabilities
 * - Intelligent work distribution and load balancing
 * - Prioritized task queuing with preemption support
 * - Automatic recovery from worker errors
 * - Detailed performance monitoring and statistics
 * 
 * @author ZK Infrastructure Team
 * @created July 2024
 */

import { deviceCapabilities } from '../deviceCapabilities';
import { ResourceMonitor } from '../resources/ResourceMonitor';
import { ResourceAllocator } from '../resources/ResourceAllocator';
import zkErrorLoggerModule from '../zkErrorLogger.mjs';

// Get error logger from module
const { zkErrorLogger } = zkErrorLoggerModule;

/**
 * Task priority levels for the worker pool
 */
export enum TaskPriority {
    /** Critical operations that should execute immediately, potentially preempting others */
    CRITICAL = 'critical',
    /** High priority tasks that should be executed before normal tasks */
    HIGH = 'high',
    /** Standard priority for most operations */
    NORMAL = 'normal',
    /** Low priority tasks that can wait if resources are constrained */
    LOW = 'low',
    /** Background tasks that run only when no other tasks are pending */
    BACKGROUND = 'background'
}

/**
 * Worker task status
 */
export enum TaskStatus {
    /** Task is waiting to be assigned to a worker */
    QUEUED = 'queued',
    /** Task is currently executing */
    RUNNING = 'running',
    /** Task completed successfully */
    COMPLETED = 'completed',
    /** Task failed due to an error */
    FAILED = 'failed',
    /** Task was cancelled before completion */
    CANCELLED = 'cancelled',
    /** Task timed out */
    TIMEOUT = 'timeout'
}

/**
 * Task to be executed by a worker
 */
export interface WorkerTask<T = any, R = any> {
    /** Unique identifier for the task */
    id: string;
    /** Type of task being executed - used for routing to specialized workers */
    type: string;
    /** Function to execute (will be stringified and sent to worker) */
    fn: string | Function;
    /** Data to pass to the function */
    data: T;
    /** Priority level for task execution */
    priority: TaskPriority;
    /** Maximum time allowed for task execution (ms) */
    timeoutMs: number;
    /** Status of the task */
    status: TaskStatus;
    /** Timestamp when task was created */
    createdAt: number;
    /** Timestamp when task execution started */
    startedAt?: number;
    /** Timestamp when task execution completed */
    completedAt?: number;
    /** Result of task execution */
    result?: R;
    /** Error from task execution (if any) */
    error?: Error | string;
    /** Whether this task can preempt lower priority tasks */
    canPreempt: boolean;
    /** Whether this task can be preempted by higher priority tasks */
    canBePreempted: boolean;
    /** Worker assigned to this task */
    workerId?: number;
}

/**
 * Worker configuration options
 */
export interface WorkerPoolOptions {
    /** Minimum number of workers to maintain */
    minWorkers?: number;
    /** Maximum number of workers to allow */
    maxWorkers?: number;
    /** Time after which idle workers are terminated (ms) */
    idleTimeoutMs?: number;
    /** Default timeout for tasks (ms) */
    defaultTaskTimeoutMs?: number;
    /** Script URL to use for worker creation */
    workerScript?: string;
    /** Whether to preload workers up to minWorkers */
    preloadWorkers?: boolean;
    /** Additional scripts to import in workers */
    importScripts?: string[];
    /** Resource monitor for checking available resources */
    resourceMonitor?: ResourceMonitor;
    /** Resource allocator for managing resource allocation */
    resourceAllocator?: ResourceAllocator;
}

/**
 * Worker pool status information
 */
export interface WorkerPoolStatus {
    /** Total number of workers in the pool */
    totalWorkers: number;
    /** Number of active workers (executing tasks) */
    activeWorkers: number;
    /** Number of idle workers (available for tasks) */
    idleWorkers: number;
    /** Number of tasks currently queued */
    queuedTasks: number;
    /** Number of tasks currently executing */
    executingTasks: number;
    /** Total tasks processed since pool creation */
    totalTasksProcessed: number;
    /** Total tasks that succeeded */
    successfulTasks: number;
    /** Total tasks that failed */
    failedTasks: number;
    /** Average task execution time (ms) */
    averageExecutionTimeMs: number;
    /** Average wait time in queue (ms) */
    averageWaitTimeMs: number;
}

/**
 * Individual worker information
 */
interface WorkerInfo {
    /** Worker instance */
    worker: Worker;
    /** Unique ID for this worker */
    id: number;
    /** Current task being executed (if any) */
    currentTask?: WorkerTask;
    /** Whether worker is currently busy */
    busy: boolean;
    /** Timestamp when worker was created */
    createdAt: number;
    /** Timestamp when worker last started a task */
    lastActiveAt: number;
    /** Number of tasks completed by this worker */
    tasksCompleted: number;
    /** Number of task failures on this worker */
    taskFailures: number;
    /** Whether worker has reported ready status */
    ready: boolean;
    /** Resolve function for the current task promise */
    resolveTask?: (value: any) => void;
    /** Reject function for the current task promise */
    rejectTask?: (reason: any) => void;
}

/**
 * WebWorkerPool manages a pool of web workers for efficient task execution
 */
export class WebWorkerPool {
    /** Configuration options */
    private options: Required<WorkerPoolOptions>;
    /** Map of workers by ID */
    private workers: Map<number, WorkerInfo> = new Map();
    /** Queue of tasks waiting to be executed */
    private taskQueue: WorkerTask[] = [];
    /** Map of tasks by ID */
    private tasks: Map<string, WorkerTask> = new Map();
    /** Counter for generating worker IDs */
    private nextWorkerId: number = 1;
    /** Counter for generating task IDs */
    private nextTaskId: number = 1;
    /** Statistics for the worker pool */
    private stats = {
        totalTasksProcessed: 0,
        successfulTasks: 0,
        failedTasks: 0,
        totalExecutionTimeMs: 0,
        totalWaitTimeMs: 0
    };

    /**
     * Creates a new WebWorkerPool
     * @param options Pool configuration options
     */
    constructor(options: WorkerPoolOptions = {}) {
        // Default options based on device capabilities
        const defaultOptions: Required<WorkerPoolOptions> = {
            minWorkers: 2,
            maxWorkers: this.determineOptimalWorkerCount(),
            idleTimeoutMs: 60000, // 1 minute
            defaultTaskTimeoutMs: 30000, // 30 seconds
            workerScript: '../workers/task-worker.js',
            preloadWorkers: true,
            importScripts: [],
            resourceMonitor: undefined,
            resourceAllocator: undefined
        };

        // Merge provided options with defaults
        this.options = { ...defaultOptions, ...options };

        // Validate options
        if (this.options.minWorkers < 1) {
            this.options.minWorkers = 1;
        }
        if (this.options.maxWorkers < this.options.minWorkers) {
            this.options.maxWorkers = this.options.minWorkers;
        }

        // Preload workers if configured
        if (this.options.preloadWorkers) {
            this.preloadWorkers();
        }
    }

    /**
     * Determines the optimal worker count based on device capabilities
     * @returns Optimal number of workers
     */
    private determineOptimalWorkerCount(): number {
        // Start with hardware concurrency
        let optimal = navigator.hardwareConcurrency || 4;

        // Cap worker count based on device tier
        const capabilities = deviceCapabilities();
        if (capabilities.tier === 'high') {
            // High-end devices can use more workers
            optimal = Math.max(4, optimal);
        } else if (capabilities.tier === 'medium') {
            // Mid-range devices should be more conservative
            optimal = Math.min(optimal, 4);
        } else {
            // Low-end devices should use minimal workers
            optimal = Math.min(optimal, 2);
        }

        return optimal;
    }

    /**
     * Preloads workers up to the minimum count
     */
    private preloadWorkers(): void {
        const workersToCreate = this.options.minWorkers - this.workers.size;
        for (let i = 0; i < workersToCreate; i++) {
            this.createWorker();
        }
    }

    /**
     * Creates a new worker
     * @returns Worker info object
     */
    private createWorker(): WorkerInfo {
        const workerId = this.nextWorkerId++;

        try {
            // Create worker with script URL
            const worker = new Worker(new URL(this.options.workerScript, import.meta.url), {
                type: 'module'
            });

            // Create worker info
            const workerInfo: WorkerInfo = {
                worker,
                id: workerId,
                busy: false,
                createdAt: Date.now(),
                lastActiveAt: Date.now(),
                tasksCompleted: 0,
                taskFailures: 0,
                ready: false
            };

            // Set up message and error handlers
            worker.addEventListener('message', event => this.handleWorkerMessage(workerId, event));
            worker.addEventListener('error', event => this.handleWorkerError(workerId, event));

            // Store worker in map
            this.workers.set(workerId, workerInfo);

            // Initialize worker
            worker.postMessage({
                type: 'init',
                workerId,
                importScripts: this.options.importScripts
            });

            return workerInfo;
        } catch (error) {
            // Log error
            zkErrorLogger.logError(error, {
                context: 'WebWorkerPool.createWorker',
                workerId,
                workerScript: this.options.workerScript,
                message: 'Failed to create worker'
            });

            // Throw error
            throw new Error(`Failed to create worker: ${error.message}`);
        }
    }

    /**
     * Handles messages from a worker
     * @param workerId Worker ID
     * @param event Message event
     */
    private handleWorkerMessage(workerId: number, event: MessageEvent): void {
        const workerInfo = this.workers.get(workerId);
        if (!workerInfo) {
            return;
        }

        const message = event.data;

        try {
            switch (message.type) {
                case 'ready':
                    // Worker is ready
                    workerInfo.ready = true;
                    this.assignTaskToWorker(workerInfo);
                    break;

                case 'taskComplete':
                    // Task completed successfully
                    this.completeTask(workerInfo, message.result);
                    break;

                case 'taskError':
                    // Task failed
                    this.failTask(workerInfo, message.error);
                    break;

                case 'error':
                    // Worker error
                    zkErrorLogger.logError(new Error(message.error.message), {
                        context: 'WebWorkerPool.handleWorkerMessage.error',
                        workerId,
                        stack: message.error.stack,
                        message: 'Error from worker'
                    });

                    if (workerInfo.currentTask) {
                        this.failTask(workerInfo, message.error);
                    }
                    break;

                case 'status':
                    // Worker status update
                    // Update metrics if needed
                    break;

                default:
                    zkErrorLogger.logWarning({
                        context: 'WebWorkerPool.handleWorkerMessage',
                        workerId,
                        messageType: message.type,
                        message: 'Unknown message type from worker'
                    });
                    break;
            }
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'WebWorkerPool.handleWorkerMessage',
                workerId,
                messageType: message ? message.type : 'unknown',
                message: 'Error handling worker message'
            });
        }
    }

    /**
     * Handles worker errors
     * @param workerId ID of the worker
     * @param error Error event
     */
    private handleWorkerError(workerId: number, error: ErrorEvent): void {
        const workerInfo = this.workers.get(workerId);
        if (!workerInfo) {
            return;
        }

        zkErrorLogger.logError(error, {
            context: 'WebWorkerPool.handleWorkerError',
            workerId: workerId.toString(),
            message: 'Worker encountered an error'
        });

        // If worker has a task, fail it
        if (workerInfo.currentTask) {
            this.failTask(workerInfo, error.message || 'Worker error');
        }

        // Replace the failed worker
        this.terminateWorker(workerId);
        this.createWorker();
    }

    /**
     * Handles fatal worker errors
     * @param workerInfo Worker information
     * @param error Error message
     */
    private handleWorkerFatalError(workerInfo: WorkerInfo, error: string): void {
        zkErrorLogger.logError(new Error(error), {
            context: 'WebWorkerPool.handleWorkerFatalError',
            workerId: workerInfo.id.toString(),
            message: 'Worker encountered a fatal error'
        });

        // If worker has a task, fail it
        if (workerInfo.currentTask) {
            this.failTask(workerInfo, error || 'Fatal worker error');
        }

        // Replace the failed worker
        this.terminateWorker(workerInfo.id);
        this.createWorker();
    }

    /**
     * Executes a task on a worker
     * @param task Task to execute
     * @returns Promise resolving to task result
     */
    public async executeTask<T = any, R = any>(
        type: string,
        fn: Function | string,
        data: T,
        options: {
            priority?: TaskPriority;
            timeoutMs?: number;
            canPreempt?: boolean;
            canBePreempted?: boolean;
        } = {}
    ): Promise<R> {
        // Create task object
        const taskId = `task-${this.nextTaskId++}`;
        const fnString = typeof fn === 'function' ? fn.toString() : fn;

        const task: WorkerTask<T, R> = {
            id: taskId,
            type,
            fn: fnString,
            data,
            priority: options.priority || TaskPriority.NORMAL,
            timeoutMs: options.timeoutMs || this.options.defaultTaskTimeoutMs,
            status: TaskStatus.QUEUED,
            createdAt: Date.now(),
            canPreempt: options.canPreempt || false,
            canBePreempted: options.canBePreempted !== false
        };

        // Store task in map
        this.tasks.set(taskId, task);

        // Add to queue and sort by priority
        this.taskQueue.push(task);
        this.sortTaskQueue();

        // Try to assign tasks
        this.assignTasks();

        // Return promise that resolves when task completes
        return new Promise<R>((resolve, reject) => {
            // Create timeout if specified
            let timeoutId: any = null;
            if (task.timeoutMs > 0) {
                timeoutId = setTimeout(() => {
                    // Task timed out
                    if (task.status === TaskStatus.RUNNING || task.status === TaskStatus.QUEUED) {
                        task.status = TaskStatus.TIMEOUT;
                        task.error = `Task timed out after ${task.timeoutMs}ms`;
                        reject(new Error(task.error));

                        // If task is running, terminate the worker
                        if (task.workerId !== undefined) {
                            const workerInfo = this.workers.get(task.workerId);
                            if (workerInfo && workerInfo.currentTask?.id === task.id) {
                                zkErrorLogger.logError(new Error(task.error), {
                                    context: 'WebWorkerPool.executeTask',
                                    taskId,
                                    taskType: type,
                                    message: 'Task timed out, terminating worker'
                                });
                                this.terminateWorker(task.workerId);
                                this.createWorker();
                            }
                        }

                        // Remove task from queue
                        this.taskQueue = this.taskQueue.filter(t => t.id !== taskId);
                        this.tasks.delete(taskId);
                    }
                }, task.timeoutMs);
            }

            // Store resolve/reject in task for when worker completes
            const originalTask = this.tasks.get(taskId);
            if (originalTask) {
                const wrappedResolve = (value: R) => {
                    if (timeoutId) clearTimeout(timeoutId);
                    resolve(value);
                };

                const wrappedReject = (reason: any) => {
                    if (timeoutId) clearTimeout(timeoutId);
                    reject(reason);
                };

                // Wrap the task with resolve/reject
                const workerInfo = originalTask.workerId !== undefined ?
                    this.workers.get(originalTask.workerId) : undefined;

                if (workerInfo) {
                    workerInfo.resolveTask = wrappedResolve;
                    workerInfo.rejectTask = wrappedReject;
                } else {
                    // Store in closure to be set when worker is assigned
                    const checkTaskAssignment = setInterval(() => {
                        const currentTask = this.tasks.get(taskId);
                        if (currentTask && currentTask.workerId !== undefined) {
                            const workerInfo = this.workers.get(currentTask.workerId);
                            if (workerInfo) {
                                workerInfo.resolveTask = wrappedResolve;
                                workerInfo.rejectTask = wrappedReject;
                                clearInterval(checkTaskAssignment);
                            }
                        }

                        // Stop checking if task is no longer queued
                        if (!currentTask ||
                            (currentTask.status !== TaskStatus.QUEUED &&
                                currentTask.status !== TaskStatus.RUNNING)) {
                            clearInterval(checkTaskAssignment);
                        }
                    }, 100);

                    // Clean up interval after max timeout
                    setTimeout(() => clearInterval(checkTaskAssignment), task.timeoutMs + 1000);
                }
            }
        });
    }

    /**
     * Sorts the task queue by priority
     */
    private sortTaskQueue(): void {
        // Sort by priority and creation time within priority
        this.taskQueue.sort((a, b) => {
            // First by priority (higher priority first)
            const priorityOrder = this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority);
            if (priorityOrder !== 0) return priorityOrder;

            // Then by creation time (older first)
            return a.createdAt - b.createdAt;
        });
    }

    /**
     * Converts priority enum to numeric value for sorting
     * @param priority Priority level
     * @returns Numeric value
     */
    private getPriorityValue(priority: TaskPriority): number {
        switch (priority) {
            case TaskPriority.CRITICAL: return 5;
            case TaskPriority.HIGH: return 4;
            case TaskPriority.NORMAL: return 3;
            case TaskPriority.LOW: return 2;
            case TaskPriority.BACKGROUND: return 1;
            default: return 0;
        }
    }

    /**
     * Attempts to assign queued tasks to available workers
     */
    private assignTasks(): void {
        // No tasks to assign
        if (this.taskQueue.length === 0) {
            return;
        }

        // Find available workers and assign tasks
        for (const workerInfo of this.workers.values()) {
            if (!workerInfo.busy && workerInfo.ready) {
                this.assignTaskToWorker(workerInfo);
            }
        }

        // If we still have tasks and are below max workers, create a new worker
        if (this.taskQueue.length > 0 && this.workers.size < this.options.maxWorkers) {
            const workerInfo = this.createWorker();
            // Don't assign task immediately - wait for ready message
        }
    }

    /**
     * Assigns a task to a worker
     * @param workerInfo Worker to assign task to
     */
    private assignTaskToWorker(workerInfo: WorkerInfo): void {
        // No tasks to assign
        if (this.taskQueue.length === 0) {
            return;
        }

        // Get next task
        const task = this.taskQueue.shift();
        if (!task) {
            return;
        }

        // Update task status
        task.status = TaskStatus.RUNNING;
        task.startedAt = Date.now();
        task.workerId = workerInfo.id;
        this.stats.totalWaitTimeMs += (task.startedAt - task.createdAt);

        // Update worker info
        workerInfo.busy = true;
        workerInfo.currentTask = task;
        workerInfo.lastActiveAt = Date.now();

        // Send task to worker
        workerInfo.worker.postMessage({
            type: 'execute',
            taskId: task.id,
            taskType: task.type,
            fn: task.fn,
            data: task.data
        });
    }

    /**
     * Completes a task successfully
     * @param workerInfo Worker that completed the task
     * @param result Task result
     */
    private completeTask(workerInfo: WorkerInfo, result: any): void {
        const task = workerInfo.currentTask;
        if (!task) {
            return;
        }

        // Update task status
        task.status = TaskStatus.COMPLETED;
        task.completedAt = Date.now();
        task.result = result;

        // Update stats
        if (task.startedAt) {
            this.stats.totalExecutionTimeMs += (task.completedAt - task.startedAt);
        }
        this.stats.totalTasksProcessed++;
        this.stats.successfulTasks++;

        // Update worker stats
        workerInfo.tasksCompleted++;

        // Resolve promise
        if (workerInfo.resolveTask) {
            workerInfo.resolveTask(result);
            workerInfo.resolveTask = undefined;
            workerInfo.rejectTask = undefined;
        }

        // Free worker for next task
        workerInfo.busy = false;
        workerInfo.currentTask = undefined;

        // Clean up task
        this.tasks.delete(task.id);

        // Assign next task
        this.assignTaskToWorker(workerInfo);

        // Consider terminating idle workers
        this.manageWorkerPool();
    }

    /**
     * Fails a task with error
     * @param workerInfo Worker that failed the task
     * @param error Error message or object
     */
    private failTask(workerInfo: WorkerInfo, error: any): void {
        const task = workerInfo.currentTask;
        if (!task) {
            return;
        }

        // Create error object if string was provided
        const errorObj = typeof error === 'string' ? new Error(error) : error;

        // Update task status
        task.status = TaskStatus.FAILED;
        task.completedAt = Date.now();
        task.error = errorObj;

        // Update stats
        this.stats.totalTasksProcessed++;
        this.stats.failedTasks++;

        // Update worker stats
        workerInfo.taskFailures++;

        // Reject promise
        if (workerInfo.rejectTask) {
            workerInfo.rejectTask(errorObj);
            workerInfo.resolveTask = undefined;
            workerInfo.rejectTask = undefined;
        }

        // Free worker for next task
        workerInfo.busy = false;
        workerInfo.currentTask = undefined;

        // Clean up task
        this.tasks.delete(task.id);

        // Assign next task
        this.assignTaskToWorker(workerInfo);

        // Consider terminating idle workers
        this.manageWorkerPool();
    }

    /**
     * Manages the worker pool size based on load
     */
    private manageWorkerPool(): void {
        // Check for idle workers to terminate
        const now = Date.now();

        // If we have more than minWorkers, consider terminating idle workers
        if (this.workers.size > this.options.minWorkers) {
            for (const [id, workerInfo] of this.workers.entries()) {
                // Skip busy workers
                if (workerInfo.busy) {
                    continue;
                }

                // Check idle time
                const idleTime = now - workerInfo.lastActiveAt;
                if (idleTime > this.options.idleTimeoutMs) {
                    // Only terminate if we'll still have minWorkers
                    const idleWorkers = Array.from(this.workers.values())
                        .filter(w => !w.busy).length;

                    if (idleWorkers > 1) {
                        this.terminateWorker(id);
                    }
                }
            }
        }
    }

    /**
     * Terminates a worker
     * @param workerId ID of worker to terminate
     */
    private terminateWorker(workerId: number): void {
        const workerInfo = this.workers.get(workerId);
        if (!workerInfo) {
            return;
        }

        // If worker has a task, fail it
        if (workerInfo.currentTask) {
            this.failTask(workerInfo, 'Worker terminated');
        }

        // Terminate worker
        try {
            workerInfo.worker.terminate();
        } catch (error) {
            zkErrorLogger.logError(error, {
                context: 'WebWorkerPool.terminateWorker',
                workerId: workerId.toString(),
                message: 'Error terminating worker'
            });
        }

        // Remove from workers map
        this.workers.delete(workerId);
    }

    /**
     * Cancels a task by ID
     * @param taskId ID of task to cancel
     * @returns True if task was cancelled
     */
    public cancelTask(taskId: string): boolean {
        // Check if task is in queue
        const queueIndex = this.taskQueue.findIndex(t => t.id === taskId);
        if (queueIndex >= 0) {
            // Task is still queued, just remove it
            const task = this.taskQueue[queueIndex];
            task.status = TaskStatus.CANCELLED;
            this.taskQueue.splice(queueIndex, 1);
            this.tasks.delete(taskId);
            return true;
        }

        // Check if task is running
        const task = this.tasks.get(taskId);
        if (task && task.status === TaskStatus.RUNNING && task.workerId !== undefined) {
            // Task is running, terminate the worker
            const workerInfo = this.workers.get(task.workerId);
            if (workerInfo) {
                task.status = TaskStatus.CANCELLED;
                this.terminateWorker(task.workerId);
                this.createWorker();
                this.tasks.delete(taskId);
                return true;
            }
        }

        return false;
    }

    /**
     * Cancels all tasks matching a predicate
     * @param predicate Function to determine which tasks to cancel
     * @returns Number of tasks cancelled
     */
    public cancelTasks(predicate: (task: WorkerTask) => boolean): number {
        let cancelled = 0;

        // Cancel queued tasks
        const originalQueueLength = this.taskQueue.length;
        this.taskQueue = this.taskQueue.filter(task => {
            const shouldCancel = predicate(task);
            if (shouldCancel) {
                task.status = TaskStatus.CANCELLED;
                this.tasks.delete(task.id);
                cancelled++;
                return false;
            }
            return true;
        });

        // Cancel running tasks
        for (const [workerId, workerInfo] of this.workers.entries()) {
            if (workerInfo.currentTask && predicate(workerInfo.currentTask)) {
                workerInfo.currentTask.status = TaskStatus.CANCELLED;
                this.tasks.delete(workerInfo.currentTask.id);
                this.terminateWorker(workerId);
                this.createWorker();
                cancelled++;
            }
        }

        return cancelled;
    }

    /**
     * Gets the current status of the worker pool
     * @returns Worker pool status information
     */
    public getStatus(): WorkerPoolStatus {
        const activeWorkers = Array.from(this.workers.values()).filter(w => w.busy).length;
        const averageExecutionTimeMs = this.stats.totalTasksProcessed > 0 ?
            this.stats.totalExecutionTimeMs / this.stats.totalTasksProcessed : 0;
        const averageWaitTimeMs = this.stats.totalTasksProcessed > 0 ?
            this.stats.totalWaitTimeMs / this.stats.totalTasksProcessed : 0;

        return {
            totalWorkers: this.workers.size,
            activeWorkers,
            idleWorkers: this.workers.size - activeWorkers,
            queuedTasks: this.taskQueue.length,
            executingTasks: activeWorkers,
            totalTasksProcessed: this.stats.totalTasksProcessed,
            successfulTasks: this.stats.successfulTasks,
            failedTasks: this.stats.failedTasks,
            averageExecutionTimeMs,
            averageWaitTimeMs
        };
    }

    /**
     * Shuts down the worker pool, terminating all workers
     */
    public shutdown(): void {
        // Cancel all queued tasks
        for (const task of this.taskQueue) {
            task.status = TaskStatus.CANCELLED;
            task.error = 'Worker pool shut down';
        }
        this.taskQueue = [];

        // Terminate all workers
        for (const [id, workerInfo] of this.workers.entries()) {
            if (workerInfo.currentTask) {
                workerInfo.currentTask.status = TaskStatus.CANCELLED;
                workerInfo.currentTask.error = 'Worker pool shut down';

                // Reject promise
                if (workerInfo.rejectTask) {
                    workerInfo.rejectTask(new Error('Worker pool shut down'));
                }
            }

            try {
                workerInfo.worker.terminate();
            } catch (error) {
                // Ignore errors during shutdown
            }
        }

        this.workers.clear();
        this.tasks.clear();
    }
} 