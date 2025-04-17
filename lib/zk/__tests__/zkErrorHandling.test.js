/**
 * Error Handling Test Suite
 * 
 * Tests for the zkErrorTestHarness functionality.
 */

import {
    withNetworkFailureSimulation,
    withMemoryConstraintSimulation,
    createErrorPropagationTest,
    getTestLogger
} from '../src/zkErrorTestHarness';

import { NetworkError, ResourceError, ErrorCode } from '../src/zkErrorHandler';

describe('Error Test Harness', () => {
    let testLogger;

    beforeEach(() => {
        testLogger = getTestLogger();
        testLogger.clearLogs();
    });

    describe('withNetworkFailureSimulation', () => {
        test('should allow successful execution when not failing', async () => {
            // Create a test function
            const testFn = jest.fn().mockResolvedValue('success');

            // Wrap with simulation at 0% failure rate
            const wrappedFn = withNetworkFailureSimulation(testFn, { failureRate: 0 });

            // Execute and check result
            const result = await wrappedFn('test-arg');
            expect(result).toBe('success');
            expect(testFn).toHaveBeenCalledWith('test-arg');
        });

        test('should throw network error when simulating failure', async () => {
            // Create a test function that should not be called
            const testFn = jest.fn().mockResolvedValue('success');

            // Wrap with simulation at 100% failure rate
            const wrappedFn = withNetworkFailureSimulation(testFn, {
                failureRate: 1,
                errorType: 'timeout',
                delayMs: 0 // No delay for faster tests
            });

            // Execute and expect error
            await expect(wrappedFn()).rejects.toThrow(NetworkError);
            // Original function should not be called
            expect(testFn).not.toHaveBeenCalled();
        });

        test('should respect specified error type', async () => {
            // Create a test function
            const testFn = jest.fn();

            // Test different error types
            const errorTypes = ['timeout', 'disconnection', 'dns'];

            for (const errorType of errorTypes) {
                // Wrap with simulation
                const wrappedFn = withNetworkFailureSimulation(testFn, {
                    failureRate: 1,
                    errorType,
                    delayMs: 0
                });

                try {
                    await wrappedFn();
                    fail('Expected error was not thrown');
                } catch (error) {
                    expect(error).toBeInstanceOf(NetworkError);
                    expect(error.details.errorType || error.code).toContain(errorType);
                }
            }
        });
    });

    describe('withMemoryConstraintSimulation', () => {
        test('should allow execution when under memory limit', async () => {
            // Create a test function
            const testFn = jest.fn().mockResolvedValue('success');

            // Wrap with simulation with high memory limit
            const wrappedFn = withMemoryConstraintSimulation(testFn, {
                maxMemoryMB: 10000, // Very high limit
                gradualDepletion: false
            });

            // Execute and check result
            const result = await wrappedFn('test-arg');
            expect(result).toBe('success');
            expect(testFn).toHaveBeenCalledWith('test-arg');
        });

        test('should throw resource error when over memory limit', async () => {
            // Create a test function that should not be called
            const testFn = jest.fn().mockResolvedValue('success');

            // Mock memory usage to be high
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = jest.fn().mockReturnValue({
                heapUsed: 200 * 1024 * 1024 // 200MB
            });

            try {
                // Wrap with simulation with low memory limit
                const wrappedFn = withMemoryConstraintSimulation(testFn, {
                    maxMemoryMB: 100, // Lower than our mock usage
                    gradualDepletion: false
                });

                // Execute and expect error
                await expect(wrappedFn()).rejects.toThrow(ResourceError);
                // Original function should not be called
                expect(testFn).not.toHaveBeenCalled();
            } finally {
                // Restore original function
                process.memoryUsage = originalMemoryUsage;
            }
        });
    });

    describe('createErrorPropagationTest', () => {
        test('should verify error propagation path', async () => {
            // Mock components for testing
            const component1 = {
                name: 'component1',
                process: function () {
                    const error = new NetworkError('Component 1 error', {
                        code: ErrorCode.NETWORK_REQUEST_FAILED
                    });
                    error.component = this.name;
                    throw error;
                }
            };

            const component2 = {
                name: 'component2',
                process: function () {
                    try {
                        component1.process();
                    } catch (error) {
                        error.component = this.name;
                        throw error;
                    }
                }
            };

            const component3 = {
                name: 'component3',
                process: function () {
                    try {
                        component2.process();
                    } catch (error) {
                        error.component = this.name;
                        throw error;
                    }
                }
            };

            // Create the test
            const propagationTest = createErrorPropagationTest({
                triggerFn: () => component3.process(),
                expectedErrorPath: ['component1', 'component2', 'component3'],
                expectedErrorCode: ErrorCode.NETWORK_REQUEST_FAILED
            });

            // Execute the test
            const error = await propagationTest();

            // Verify the error
            expect(error).toBeInstanceOf(NetworkError);
            expect(error.code).toBe(ErrorCode.NETWORK_REQUEST_FAILED);
        });
    });
}); 