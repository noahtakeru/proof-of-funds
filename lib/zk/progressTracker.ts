/**
 * Progress tracking infrastructure for ZK operations
 * Provides a system for monitoring and reporting the progress of
 * computationally intensive ZK operations
 */

import { EventEmitter } from 'events';

export type ProgressEvent = {
  operation: string;
  step: string;
  progress: number; // 0-100
  message?: string;
  detail?: any;
};

export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * Progress tracker for ZK operations
 * Allows components to register for progress updates and report progress
 */
class ZkProgressTracker extends EventEmitter {
  private static instance: ZkProgressTracker;
  private operations: Map<string, ProgressEvent>;
  
  private constructor() {
    super();
    this.operations = new Map();
  }
  
  /**
   * Get the singleton instance of the progress tracker
   */
  public static getInstance(): ZkProgressTracker {
    if (!ZkProgressTracker.instance) {
      ZkProgressTracker.instance = new ZkProgressTracker();
    }
    return ZkProgressTracker.instance;
  }
  
  /**
   * Register for progress updates on a specific operation
   * @param operation The operation to track
   * @param callback The callback to call with progress updates
   */
  public registerProgressCallback(operation: string, callback: ProgressCallback): void {
    this.on(`progress:${operation}`, callback);
  }
  
  /**
   * Unregister from progress updates
   * @param operation The operation to unregister from
   * @param callback The callback to remove
   */
  public unregisterProgressCallback(operation: string, callback: ProgressCallback): void {
    this.off(`progress:${operation}`, callback);
  }
  
  /**
   * Report progress on an operation
   * @param event The progress event
   */
  public reportProgress(event: ProgressEvent): void {
    this.operations.set(`${event.operation}:${event.step}`, event);
    this.emit(`progress:${event.operation}`, event);
    this.emit('progress', event);
  }
  
  /**
   * Start tracking a new operation
   * @param operation The operation name
   * @param steps The expected steps for this operation
   */
  public startOperation(operation: string, steps: string[]): void {
    // Initialize all steps to 0% progress
    steps.forEach(step => {
      this.reportProgress({
        operation,
        step,
        progress: 0,
        message: `Initializing ${step}`
      });
    });
    
    this.emit(`operation:start`, { operation, steps });
  }
  
  /**
   * Mark an operation as complete
   * @param operation The operation name
   * @param result Optional result data
   */
  public completeOperation(operation: string, result?: any): void {
    // Find all steps for this operation and mark them as complete
    const steps = Array.from(this.operations.keys())
      .filter(key => key.startsWith(`${operation}:`))
      .map(key => key.split(':')[1]);
      
    steps.forEach(step => {
      this.reportProgress({
        operation,
        step,
        progress: 100,
        message: `Completed ${step}`
      });
    });
    
    this.emit(`operation:complete`, { operation, result });
  }
  
  /**
   * Report an error in an operation
   * @param operation The operation name
   * @param step The step that failed
   * @param error The error that occurred
   */
  public reportError(operation: string, step: string, error: any): void {
    this.reportProgress({
      operation,
      step,
      progress: -1, // Use negative progress to indicate error
      message: `Error in ${step}: ${error.message || 'Unknown error'}`,
      detail: error
    });
    
    this.emit(`operation:error`, { operation, step, error });
  }
  
  /**
   * Get the current progress of all operations
   * @returns A map of operation/step to progress event
   */
  public getCurrentProgress(): Map<string, ProgressEvent> {
    return new Map(this.operations);
  }
  
  /**
   * Reset the progress of all operations
   */
  public resetProgress(): void {
    this.operations.clear();
    this.emit('progress:reset');
  }
}

// Export the singleton instance
export const zkProgressTracker = ZkProgressTracker.getInstance();

/**
 * Create a progress reporter for a specific operation
 * @param operation The operation name
 * @returns An object with methods to report progress
 */
export function createProgressReporter(operation: string) {
  return {
    /**
     * Report progress on a step
     * @param step The step name
     * @param progress The progress percentage (0-100)
     * @param message Optional message
     * @param detail Optional detail
     */
    reportProgress(step: string, progress: number, message?: string, detail?: any) {
      zkProgressTracker.reportProgress({
        operation,
        step,
        progress,
        message,
        detail
      });
    },
    
    /**
     * Report an error on a step
     * @param step The step name
     * @param error The error that occurred
     */
    reportError(step: string, error: any) {
      zkProgressTracker.reportError(operation, step, error);
    },
    
    /**
     * Mark the operation as complete
     * @param result Optional result data
     */
    complete(result?: any) {
      zkProgressTracker.completeOperation(operation, result);
    },
    
    /**
     * Create a wrapped function that reports progress
     * @param fn The function to wrap
     * @param step The step name
     * @returns The wrapped function
     */
    wrapWithProgress<T extends (...args: any[]) => Promise<any>>(
      fn: T,
      step: string
    ): (...args: Parameters<T>) => Promise<ReturnType<T>> {
      return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
        try {
          this.reportProgress(step, 10, 'Starting operation');
          const result = await fn(...args);
          this.reportProgress(step, 100, 'Operation complete');
          return result;
        } catch (error) {
          this.reportError(step, error);
          throw error;
        }
      };
    }
  };
}