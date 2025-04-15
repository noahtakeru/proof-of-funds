/**
 * @fileoverview Web Worker for executing tasks from the WebWorkerPool
 * 
 * This worker script handles task execution in a separate thread,
 * supporting the WebWorkerPool's task distribution system. It provides
 * a controlled environment for executing potentially CPU-intensive
 * operations without blocking the main thread.
 * 
 * Features:
 * - Task execution with proper error isolation
 * - Progress reporting back to main thread
 * - Safe handling of large data structures
 * - Automatic memory management and cleanup
 * - Support for specialized task types
 * 
 * @author ZK Infrastructure Team
 * @created July 2024
 */

// Worker context setup
let workerReady = false;
let workerId = null;
let processingTask = false;
let pendingTasks = 0;
let taskTypes = new Map();
let perfCounters = {
    tasksProcessed: 0,
    totalExecutionTime: 0,
    errors: 0,
    lastTaskTime: 0
};

// Initialize worker
function initializeWorker() {
    try {
        // Notify main thread that worker is ready
        self.postMessage({
            type: 'ready',
            workerId
        });

        workerReady = true;

        // Log initialization (will be caught by onerror if not supported)
        console.log(`[Worker ${workerId}] Initialized and ready`);
    } catch (error) {
        self.postMessage({
            type: 'error',
            error: {
                message: 'Worker initialization failed',
                stack: error.stack
            }
        });
    }
}

// Register specialized task handlers
function registerTaskHandler(taskType, handlerFn) {
    taskTypes.set(taskType, handlerFn);
}

// Execute a task
async function executeTask(taskId, taskType, fnString, data) {
    processingTask = true;
    pendingTasks++;
    const startTime = performance.now();

    try {
        // Notify start of execution
        self.postMessage({
            type: 'taskStart',
            taskId,
            timestamp: Date.now()
        });

        let result;

        // Check if there's a specialized handler for this task type
        if (taskTypes.has(taskType)) {
            result = await taskTypes.get(taskType)(data);
        } else {
            // Convert function string to executable function
            let taskFn;
            try {
                // Safer approach using Function constructor
                taskFn = new Function('return ' + fnString)();

                if (typeof taskFn !== 'function') {
                    throw new Error('Invalid function definition');
                }
            } catch (error) {
                throw new Error(`Failed to parse task function: ${error.message}`);
            }

            // Execute the function with provided data
            result = await taskFn(data);
        }

        // Record performance metrics
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        perfCounters.tasksProcessed++;
        perfCounters.totalExecutionTime += executionTime;
        perfCounters.lastTaskTime = executionTime;

        // Send successful result back to main thread
        self.postMessage({
            type: 'taskComplete',
            taskId,
            result,
            executionTime,
            timestamp: Date.now()
        });

        return result;
    } catch (error) {
        // Record error in performance counters
        perfCounters.errors++;

        // Send error back to main thread
        self.postMessage({
            type: 'taskError',
            taskId,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            timestamp: Date.now()
        });

        throw error;
    } finally {
        processingTask = false;
        pendingTasks--;

        // Force garbage collection if available (V8 specific)
        if (global && global.gc) {
            try {
                global.gc();
            } catch (e) {
                // Ignore errors in garbage collection
            }
        }
    }
}

// Report worker status
function reportStatus() {
    self.postMessage({
        type: 'status',
        workerId,
        metrics: {
            pendingTasks,
            tasksProcessed: perfCounters.tasksProcessed,
            averageTaskTime: perfCounters.tasksProcessed > 0
                ? perfCounters.totalExecutionTime / perfCounters.tasksProcessed
                : 0,
            lastTaskTime: perfCounters.lastTaskTime,
            errors: perfCounters.errors,
            memory: self.performance && self.performance.memory
                ? {
                    usedJSHeapSize: self.performance.memory.usedJSHeapSize,
                    jsHeapSizeLimit: self.performance.memory.jsHeapSizeLimit
                }
                : null
        },
        timestamp: Date.now()
    });
}

// Handle worker termination cleanup
function handleTermination() {
    // Notify main thread that worker is shutting down
    if (workerReady) {
        self.postMessage({
            type: 'terminate',
            workerId,
            pendingTasks,
            timestamp: Date.now()
        });
    }
}

// Main message handler
self.addEventListener('message', async function (event) {
    const message = event.data;

    try {
        switch (message.type) {
            case 'init':
                workerId = message.workerId;

                // Handle any importScripts if provided
                if (message.importScripts && Array.isArray(message.importScripts)) {
                    try {
                        message.importScripts.forEach(script => {
                            importScripts(script);
                        });
                    } catch (error) {
                        self.postMessage({
                            type: 'error',
                            error: {
                                message: `Failed to import scripts: ${error.message}`,
                                stack: error.stack
                            }
                        });
                    }
                }

                initializeWorker();
                break;

            case 'execute':
                if (!workerReady) {
                    throw new Error('Worker not initialized');
                }

                await executeTask(
                    message.taskId,
                    message.taskType,
                    message.fn,
                    message.data
                );
                break;

            case 'ping':
                self.postMessage({
                    type: 'pong',
                    timestamp: Date.now(),
                    workerId
                });
                break;

            case 'status':
                reportStatus();
                break;

            case 'register':
                // Register a specialized task handler
                if (message.taskType && message.fnString) {
                    try {
                        const handlerFn = new Function('return ' + message.fnString)();
                        registerTaskHandler(message.taskType, handlerFn);
                        self.postMessage({
                            type: 'registerSuccess',
                            taskType: message.taskType
                        });
                    } catch (error) {
                        self.postMessage({
                            type: 'registerError',
                            taskType: message.taskType,
                            error: {
                                message: error.message,
                                stack: error.stack
                            }
                        });
                    }
                }
                break;

            case 'terminate':
                handleTermination();
                self.close();
                break;

            default:
                self.postMessage({
                    type: 'error',
                    error: {
                        message: `Unknown message type: ${message.type}`
                    }
                });
                break;
        }
    } catch (error) {
        self.postMessage({
            type: 'error',
            error: {
                message: error.message,
                stack: error.stack
            },
            timestamp: Date.now()
        });
    }
});

// Handle uncaught errors
self.addEventListener('error', function (event) {
    self.postMessage({
        type: 'uncaughtError',
        error: {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        },
        timestamp: Date.now()
    });

    // Prevent default handling
    event.preventDefault();
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', function (event) {
    const error = event.reason;

    self.postMessage({
        type: 'unhandledRejection',
        error: {
            message: error.message || 'Unhandled promise rejection',
            stack: error.stack || ''
        },
        timestamp: Date.now()
    });

    // Prevent default handling
    event.preventDefault();
}); 