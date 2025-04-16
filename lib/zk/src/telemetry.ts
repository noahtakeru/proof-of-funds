/**
 * Telemetry module for tracking ZK operations performance and errors
 * This helps monitor the performance of ZK operations and detect issues
 */

export interface TelemetryOperationData {
  operation: string;
  executionTimeMs?: number;
  success: boolean;
  serverSide?: boolean;
  clientSide?: boolean;
  retries?: number;
  additionalInfo?: Record<string, any>;
  timestamp?: number;
}

class Telemetry {
  private _operations: (TelemetryOperationData & { timestamp: number })[] = [];
  private _errors: { component: string; message: string; timestamp: number }[] = [];
  private _maxStoredItems = 100;
  private _debugMode = false;

  /**
   * Record a ZK operation for telemetry purposes
   */
  recordOperation(data: TelemetryOperationData): void {
    this._operations.push({
      ...data,
      timestamp: Date.now(),
    });

    // Trim array if it gets too large
    if (this._operations.length > this._maxStoredItems) {
      this._operations = this._operations.slice(-this._maxStoredItems);
    }

    if (this._debugMode) {
      console.log(`[ZK Telemetry] Operation: ${data.operation}, Success: ${data.success}`);

      if (data.executionTimeMs) {
        console.log(`[ZK Telemetry] Execution time: ${data.executionTimeMs.toFixed(2)}ms`);
      }

      if (data.retries && data.retries > 0) {
        console.log(`[ZK Telemetry] Retries: ${data.retries}`);
      }
    }
  }

  /**
   * Record an error that occurred in a ZK operation
   */
  recordError(component: string, message: string): void {
    this._errors.push({
      component,
      message,
      timestamp: Date.now(),
    });

    // Trim array if it gets too large
    if (this._errors.length > this._maxStoredItems) {
      this._errors = this._errors.slice(-this._maxStoredItems);
    }

    if (this._debugMode) {
      console.error(`[ZK Telemetry] Error in ${component}: ${message}`);
    }
  }

  /**
   * Get telemetry data for the last n operations
   */
  getOperationsData(limit = 10): TelemetryOperationData[] {
    return this._operations.slice(-limit);
  }

  /**
   * Get error data for the last n errors
   */
  getErrorsData(limit = 10): { component: string; message: string; timestamp: number }[] {
    return this._errors.slice(-limit);
  }

  /**
   * Get operations statistics (success rate, average execution time, etc.)
   */
  getOperationsStats(): {
    totalOperations: number;
    successRate: number;
    averageExecutionTimeMs: number;
    serverSideOperations: number;
    clientSideOperations: number;
  } {
    const totalOperations = this._operations.length;
    if (totalOperations === 0) {
      return {
        totalOperations: 0,
        successRate: 0,
        averageExecutionTimeMs: 0,
        serverSideOperations: 0,
        clientSideOperations: 0,
      };
    }

    const successfulOperations = this._operations.filter((op) => op.success).length;
    const operationsWithTime = this._operations.filter(
      (op) => op.executionTimeMs !== undefined
    );

    const totalTime = operationsWithTime.reduce(
      (sum, op) => sum + (op.executionTimeMs || 0),
      0
    );

    const serverSideOperations = this._operations.filter(
      (op) => op.serverSide === true
    ).length;

    const clientSideOperations = this._operations.filter(
      (op) => op.clientSide === true
    ).length;

    return {
      totalOperations,
      successRate: (successfulOperations / totalOperations) * 100,
      averageExecutionTimeMs:
        operationsWithTime.length > 0 ? totalTime / operationsWithTime.length : 0,
      serverSideOperations,
      clientSideOperations,
    };
  }

  /**
   * Enable or disable debug mode for telemetry
   */
  setDebugMode(enabled: boolean): void {
    this._debugMode = enabled;
  }

  /**
   * Clear all telemetry data
   */
  clearData(): void {
    this._operations = [];
    this._errors = [];
  }
}

export const telemetry = new Telemetry();