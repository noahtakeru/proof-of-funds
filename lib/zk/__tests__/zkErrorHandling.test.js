/**
 * Test file for ZK Error Handling and Recovery System
 * 
 * Tests the comprehensive error handling framework and recovery mechanisms
 * developed for Week 6 of the implementation plan.
 */

// Import error handling and recovery systems
const { 
  ZKError, CircuitError, ProofError, VerificationError,
  NetworkError, MemoryError, ErrorCode, ErrorSeverity,
  ErrorCategory, getLocalizedErrorMessage
} = require('../src/zkErrorHandler.js');

const { zkErrorLogger } = require('../src/zkErrorLogger.js');
const zkRecovery = require('../src/zkRecoverySystem.js');
const testHarness = require('../src/zkErrorTestHarness.js');

// Setup for testing
beforeEach(() => {
  // Configure error logger for testing
  zkErrorLogger.updateConfig({
    developerMode: true,
    destinations: ['console']
  });
  
  // Mock console methods to prevent test output clutter
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  // Restore console methods
  console.error.mockRestore();
  console.warn.mockRestore();
  console.log.mockRestore();
});

describe('Error Handling Framework', () => {
  test('Basic error hierarchy', () => {
    // Create errors of different types
    const baseError = new ZKError('Generic ZK error');
    const circuitError = new CircuitError('Circuit execution error');
    const proofError = new ProofError('Proof generation error');
    const verificationError = new VerificationError('Verification error');
    
    // Verify inheritance
    expect(baseError instanceof Error).toBeTruthy();
    expect(circuitError instanceof ZKError).toBeTruthy();
    expect(proofError instanceof ZKError).toBeTruthy();
    expect(verificationError instanceof ZKError).toBeTruthy();
    
    // Verify properties
    expect(baseError.code).toBeDefined();
    expect(baseError.severity).toBeDefined();
    expect(baseError.category).toBeDefined();
    expect(baseError.timestamp).toBeDefined();
    
    // Verify classification
    expect(circuitError.category).toBe(ErrorCategory.CIRCUIT);
    expect(proofError.category).toBe(ErrorCategory.PROOF);
    expect(verificationError.category).toBe(ErrorCategory.VERIFICATION);
  });
  
  test('Error code and severity levels', () => {
    // Create errors with specific codes and severity
    const criticalError = new ZKError('Critical error', {
      code: ErrorCode.MEMORY_ALLOCATION_FAILED,
      severity: ErrorSeverity.CRITICAL
    });
    
    const warningError = new ZKError('Warning error', {
      code: ErrorCode.MEMORY_INSUFFICIENT,
      severity: ErrorSeverity.WARNING
    });
    
    // Verify code and severity
    expect(criticalError.code).toBe(ErrorCode.MEMORY_ALLOCATION_FAILED);
    expect(criticalError.severity).toBe(ErrorSeverity.CRITICAL);
    expect(warningError.code).toBe(ErrorCode.MEMORY_INSUFFICIENT);
    expect(warningError.severity).toBe(ErrorSeverity.WARNING);
  });
  
  test('Localized error messages', () => {
    // Get localized messages for different error codes
    const msg1 = getLocalizedErrorMessage(ErrorCode.CIRCUIT_CONSTRAINT_FAILURE);
    const msg2 = getLocalizedErrorMessage(ErrorCode.PROOF_GENERATION_FAILED);
    
    // Verify messages are defined
    expect(msg1).toBeDefined();
    expect(msg2).toBeDefined();
    expect(typeof msg1).toBe('string');
    expect(typeof msg2).toBe('string');
  });
  
  test('Error logging', () => {
    // Create and log an error
    const error = new ProofError('Test proof error', {
      code: ErrorCode.PROOF_GENERATION_FAILED,
      recoverable: true
    });
    
    // Log the error
    const loggedData = zkErrorLogger.logError(error, {
      operationId: 'test-operation-123'
    });
    
    // Verify logged data
    expect(loggedData).toBeDefined();
    expect(loggedData.message).toBe('Test proof error');
    expect(loggedData.code).toBe(ErrorCode.PROOF_GENERATION_FAILED);
    expect(loggedData.category).toBe(ErrorCategory.PROOF);
    expect(loggedData.operationId).toBe('test-operation-123');
  });
  
  test('Error formatting', () => {
    // Create an error with details
    const error = new NetworkError('Connection timeout', {
      code: ErrorCode.NETWORK_TIMEOUT,
      recoverable: true,
      userFixable: true,
      recommendedAction: 'Check your internet connection and try again',
      details: { 
        url: 'https://example.com/api',
        requestId: '12345',
        attemptNumber: 2
      }
    });
    
    // Get user message
    const userMessage = error.toUserMessage();
    
    // Verify message contains recommendations
    expect(userMessage).toContain('Connection timeout');
    expect(userMessage).toContain('Check your internet connection');
    
    // Get technical message
    const techMessage = error.toTechnicalMessage();
    
    // Verify technical message includes error code
    expect(techMessage).toContain('[5002]');
    expect(techMessage).toContain('NetworkError');
    
    // Get log format
    const logData = error.toLogFormat();
    
    // Verify log data has necessary fields
    expect(logData.name).toBe('NetworkError');
    expect(logData.code).toBe(ErrorCode.NETWORK_TIMEOUT);
    expect(logData.recoverable).toBe(true);
    expect(logData.userFixable).toBe(true);
  });
});

describe('Recovery Mechanisms', () => {
  test('Exponential backoff retry', async () => {
    // Function that succeeds on third attempt
    let attempts = 0;
    const testFunction = jest.fn(() => {
      attempts++;
      if (attempts < 3) {
        throw new NetworkError('Test network error', {
          code: ErrorCode.NETWORK_REQUEST_FAILED,
          recoverable: true
        });
      }
      return 'success';
    });
    
    // Execute with retry
    const result = await zkRecovery.withRetry(testFunction, {
      maxRetries: 3,
      baseDelayMs: 10 // Fast for testing
    });
    
    // Verify function was called multiple times
    expect(testFunction).toHaveBeenCalledTimes(3);
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });
  
  test('Checkpointing for long operations', async () => {
    // Create a multi-step function with state
    const testFunction = jest.fn(async (state, updateState) => {
      // First execution or resumed from step 1
      if (state.step <= 1) {
        await updateState({
          step: 1,
          progress: 50,
          someData: 'test data'
        });
      }
      
      // Update to final state
      await updateState({
        step: 2,
        progress: 100,
        someData: 'completed data'
      });
      
      return { result: 'success', data: state.someData };
    });
    
    // Execute with checkpointing
    const result = await zkRecovery.withCheckpointing(
      testFunction,
      'test-checkpoint-operation',
      {
        checkpointIntervalMs: 10 // Fast for testing
      }
    );
    
    // Verify function was called and returned expected result
    expect(testFunction).toHaveBeenCalled();
    expect(result).toEqual({ result: 'success', data: 'completed data' });
    
    // Check that checkpoint was created
    const checkpoint = await zkRecovery.getCheckpoint('test-checkpoint-operation');
    expect(checkpoint).toBeDefined();
    expect(checkpoint.step).toBe(2);
    expect(checkpoint.progress).toBe(100);
    
    // Clean up checkpoint
    await zkRecovery.removeCheckpoint('test-checkpoint-operation');
  });
  
  test('Batch processing with partial failures', async () => {
    // Create a test array of 10 items
    const testItems = Array.from({ length: 10 }, (_, i) => ({ id: i, value: `Item ${i}` }));
    
    // Function to process each item, fails on even IDs
    const processItem = jest.fn((item) => {
      if (item.id % 2 === 0 && item.id > 0) { // Item 0 succeeds, other even items fail
        throw new ZKError(`Error processing item ${item.id}`, {
          code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
          recoverable: false
        });
      }
      return { processed: true, id: item.id };
    });
    
    // Process batch with continue on error
    const result = await zkRecovery.processBatch(
      testItems,
      processItem,
      {
        operationId: 'test-batch',
        continueOnError: true,
        retryFailedItems: false
      }
    );
    
    // Verify results
    expect(result.successful.length).toBe(5); // Items 0, 1, 3, 5, 7, 9
    expect(result.failed.length).toBe(5); // Items 2, 4, 6, 8
    expect(result.status).toBe('completed_with_failures');
    expect(processItem).toHaveBeenCalledTimes(10);
  });
  
  test('Transferable checkpoints', async () => {
    // Create a checkpoint
    const operationId = 'transferable-test';
    const state = {
      step: 2,
      progress: 50,
      data: { key: 'value', timestamp: Date.now() }
    };
    
    // Create transferable token
    const token = await zkRecovery.createTransferableCheckpoint(
      operationId,
      state,
      { expiryTimeMs: 1000 } // 1 second for testing
    );
    
    // Verify token was created
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
    
    // Resume from token
    const resumed = await zkRecovery.resumeFromTransferableCheckpoint(token);
    
    // Verify resumed state
    expect(resumed).toBeDefined();
    expect(resumed.operationId).toBe(operationId);
    expect(resumed.state.step).toBe(state.step);
    expect(resumed.state.progress).toBe(state.progress);
    expect(resumed.state.data.key).toBe('value');
    
    // Clean up
    await zkRecovery.removeCheckpoint(operationId);
  });
});

describe('Error Simulation and Fault Injection', () => {
  test('Network failure simulation', async () => {
    // Function that should succeed
    const testFunction = jest.fn(() => 'success');
    
    // Test with 100% failure rate
    await expect(
      testHarness.withNetworkFailureSimulation(testFunction, {
        failureRate: 1.0, // Always fail
        failureMode: 'timeout',
        retryAllowed: false
      })
    ).rejects.toThrow('Network request timed out');
    
    // Test with recovery test enabled
    const result = await testHarness.withNetworkFailureSimulation(testFunction, {
      failureRate: 1.0, // Always fail on first attempt
      failureMode: 'error',
      retryAllowed: true,
      recoveryTest: true // Enable recovery test
    });
    
    // Should recover and succeed
    expect(result).toBe('success');
  });
  
  test('Memory constraint simulation', async () => {
    // Function that should succeed
    const testFunction = jest.fn(() => 'success');
    
    // Test with fatal memory constraint
    await expect(
      testHarness.withMemoryConstraintSimulation(testFunction, {
        constraintLevel: 'fatal',
        simulatedMemoryMB: 10
      })
    ).rejects.toThrow('Insufficient memory');
    
    // Test with warning only
    const result = await testHarness.withMemoryConstraintSimulation(testFunction, {
      constraintLevel: 'warning',
      simulatedMemoryMB: 150
    });
    
    // Should succeed with just a warning
    expect(result).toBe('success');
    
    // Test with recovery test enabled
    const recoveryResult = await testHarness.withMemoryConstraintSimulation(testFunction, {
      constraintLevel: 'critical',
      simulatedMemoryMB: 50,
      recoveryTest: true // Enable recovery test
    });
    
    // Should recover and succeed
    expect(recoveryResult).toBe('success');
  });
  
  test('Cross-component error propagation', async () => {
    // Test error in circuit component that propagates
    const result1 = await testHarness.createErrorPropagationTest({
      errorLocation: 'circuit',
      propagationBehavior: 'bubble',
      recoveryStrategy: 'none'
    });
    
    // Error should be caught and propagated
    expect(result1.errorOccurred).toBe(true);
    expect(result1.errorCaught).toBe(true);
    expect(result1.propagationPath.length).toBeGreaterThan(0);
    
    // Test error with recovery
    const result2 = await testHarness.createErrorPropagationTest({
      errorLocation: 'proof',
      propagationBehavior: 'transform',
      recoveryStrategy: 'retry'
    });
    
    // Recovery should be attempted
    expect(result2.recoveryAttempted).toBe(true);
  });
  
  test('Batch recovery test', async () => {
    // Create a simple processor function
    const processItem = jest.fn((item) => ({ processed: true, id: item.id }));
    
    // Test items
    const testItems = Array.from({ length: 20 }, (_, i) => ({ id: i, value: `Item ${i}` }));
    
    // Run batch test with simulated failures
    const result = await testHarness.batchRecoveryTest(
      testItems,
      processItem,
      {
        failureRate: 0.3, // 30% failure rate
        failureType: 'random',
        batchConcurrency: 2
      }
    );
    
    // Verify results
    expect(result.successful.length + result.failed.length + result.skipped.length).toBe(testItems.length);
    expect(result.failed.length).toBeGreaterThan(0); // Some items should fail
    expect(result.successful.length).toBeGreaterThan(0); // Some items should succeed
  });
});

describe('End-to-End Integration Tests', () => {
  test('Complete error handling cycle', async () => {
    // Multi-phase operation that experiences different errors
    let phase = 0;
    const complexOperation = async () => {
      phase++;
      
      // Phase 1: Network error with retry
      if (phase === 1) {
        // Simulate network error
        return testHarness.withNetworkFailureSimulation(
          () => 'phase1-complete',
          {
            failureRate: 1.0, // Always fail first attempt
            failureMode: 'timeout',
            retryAllowed: true,
            recoveryTest: true // Enable recovery test (should succeed on retry)
          }
        );
      }
      
      // Phase 2: Memory warning but continues
      if (phase === 2) {
        return testHarness.withMemoryConstraintSimulation(
          () => 'phase2-complete',
          {
            constraintLevel: 'warning',
            simulatedMemoryMB: 200
          }
        );
      }
      
      // Phase 3: Batch processing with some failures
      if (phase === 3) {
        const items = Array.from({ length: 5 }, (_, i) => ({ id: i }));
        const results = await testHarness.batchRecoveryTest(
          items,
          (item) => ({ processed: true, id: item.id }),
          {
            failureRate: 0.4,
            failureType: 'specific',
            failureIndexes: [1, 3], // Items 1 and 3 will fail
            batchConcurrency: 2
          }
        );
        
        return {
          phase: 3,
          successful: results.successful.length,
          failed: results.failed.length
        };
      }
      
      // Phase 4: Final success
      return { complete: true, allPhases: phase };
    };
    
    // Execute operation through all phases
    // Phase 1
    const result1 = await complexOperation();
    expect(result1).toBe('phase1-complete');
    
    // Phase 2
    const result2 = await complexOperation();
    expect(result2).toBe('phase2-complete');
    
    // Phase 3
    const result3 = await complexOperation();
    expect(result3.phase).toBe(3);
    expect(result3.successful).toBe(3); // 3 items should succeed
    expect(result3.failed).toBe(2); // 2 items should fail
    
    // Phase 4
    const result4 = await complexOperation();
    expect(result4.complete).toBe(true);
    expect(result4.allPhases).toBe(4);
  });
  
  test('Error recovery in realistic scenario', async () => {
    // Create a more realistic scenario with checkpointing and retries
    const operationId = 'realistic-test';
    
    // Complex operation with checkpointing and potential failures
    const realWorldScenario = async () => {
      // Use both checkpointing and retry mechanisms
      return zkRecovery.withRetry(
        async () => {
          // Use checkpointing for state preservation
          return zkRecovery.withCheckpointing(
            async (state, updateState) => {
              // Initialize or resume
              if (!state.step || state.step < 1) {
                await updateState({
                  step: 1,
                  progress: 10,
                  status: 'Starting operation',
                  data: {}
                });
              }
              
              // Step 1: Potential network failure
              if (state.step === 1) {
                // Simulate occasional network error
                if (Math.random() < 0.5 && !state.retryStep1) {
                  // Mark that we've attempted step 1
                  await updateState({
                    retryStep1: true
                  });
                  
                  throw new NetworkError('Simulated network error in step 1', {
                    code: ErrorCode.NETWORK_REQUEST_FAILED,
                    recoverable: true
                  });
                }
                
                // Successfully complete step 1
                await updateState({
                  step: 2,
                  progress: 30,
                  status: 'Network request completed',
                  data: { requestSuccess: true }
                });
              }
              
              // Step 2: Complex processing with memory warning
              if (state.step === 2) {
                // Log memory warning but continue
                zkErrorLogger.log('WARNING', 'Memory pressure detected during processing', {
                  operationId,
                  category: ErrorCategory.MEMORY,
                  details: { availableMemoryMB: 150 }
                });
                
                // Complete step 2
                await updateState({
                  step: 3,
                  progress: 60,
                  status: 'Processing completed',
                  data: { ...state.data, processingComplete: true }
                });
              }
              
              // Step 3: Batch operation with partial failures
              if (state.step === 3) {
                // Only run batch operation if not already done
                if (!state.batchComplete) {
                  // Create test items
                  const batchItems = Array.from({ length: 5 }, (_, i) => ({ id: i }));
                  
                  // Run batch with simulated failures
                  const batchResult = await testHarness.batchRecoveryTest(
                    batchItems,
                    (item) => ({ processed: true, id: item.id }),
                    {
                      failureRate: 0.2,
                      failureType: 'random',
                      batchConcurrency: 2
                    }
                  );
                  
                  // Save batch results
                  await updateState({
                    batchComplete: true,
                    batchResults: {
                      successful: batchResult.successful.length,
                      failed: batchResult.failed.length
                    }
                  });
                }
                
                // Complete step 3
                await updateState({
                  step: 4,
                  progress: 90,
                  status: 'Batch processing completed'
                });
              }
              
              // Step 4: Final completion
              await updateState({
                step: 5,
                progress: 100,
                status: 'Operation complete',
                completed: true
              });
              
              // Return final result
              return {
                success: true,
                data: state.data,
                batchResults: state.batchResults,
                completed: true
              };
            },
            operationId,
            {
              checkpointIntervalMs: 50 // Fast for testing
            }
          );
        },
        {
          maxRetries: 2,
          baseDelayMs: 10, // Fast for testing
          operationId
        }
      );
    };
    
    // Execute the realistic scenario
    const result = await realWorldScenario();
    
    // Verify result
    expect(result.success).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.data.requestSuccess).toBe(true);
    expect(result.data.processingComplete).toBe(true);
    expect(result.batchResults).toBeDefined();
    
    // Clean up
    await zkRecovery.removeCheckpoint(operationId);
  });
});