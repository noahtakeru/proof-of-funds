/**
 * @fileoverview Tests for WebWorkerPool implementation
 * 
 * Tests the core functionality of the WebWorkerPool class, including:
 * - Worker creation and initialization
 * - Task execution and result handling
 * - Error handling and recovery
 * - Pool scaling and management
 */

import { WebWorkerPool, TaskPriority } from '../../src/performance/WebWorkerPool';

/**
 * Runs a complete test suite for the WebWorkerPool
 */
async function runWebWorkerPoolTests() {
    console.log('Starting WebWorkerPool Tests...');
    let testsPassed = 0;
    let testsFailed = 0;
    let errors = [];

    try {
        // Test 1: Create a worker pool
        console.log('Test 1: Create worker pool');
        const pool = new WebWorkerPool({
            minWorkers: 2,
            maxWorkers: 4,
            preloadWorkers: true
        });

        // Wait for workers to initialize
        await new Promise(resolve => setTimeout(resolve, 500));

        const status = pool.getStatus();
        console.log('Status:', status);

        if (status.totalWorkers >= 2) {
            console.log('✅ Test 1 Passed: Worker pool created with correct number of workers');
            testsPassed++;
        } else {
            console.log('❌ Test 1 Failed: Worker pool not created correctly');
            testsFailed++;
            errors.push('Worker pool creation failed');
        }

        // Test 2: Execute a simple task
        console.log('\nTest 2: Execute simple task');
        try {
            const result = await pool.executeTask(
                'test',
                (data) => data.x + data.y,
                { x: 5, y: 10 }
            );

            if (result === 15) {
                console.log('✅ Test 2 Passed: Task executed correctly, result = 15');
                testsPassed++;
            } else {
                console.log(`❌ Test 2 Failed: Task returned incorrect result: ${result}`);
                testsFailed++;
                errors.push(`Task returned incorrect result: ${result}`);
            }
        } catch (error) {
            console.log('❌ Test 2 Failed: Task execution error:', error);
            testsFailed++;
            errors.push(`Task execution error: ${error.message}`);
        }

        // Test 3: Execute multiple tasks
        console.log('\nTest 3: Execute multiple tasks concurrently');
        try {
            const tasks = [];
            for (let i = 0; i < 10; i++) {
                tasks.push(pool.executeTask(
                    'test',
                    (data) => {
                        return new Promise(resolve => {
                            setTimeout(() => resolve(data.value * 2), data.delay);
                        });
                    },
                    { value: i, delay: Math.random() * 200 }
                ));
            }

            const results = await Promise.all(tasks);
            const allCorrect = results.every((result, i) => result === i * 2);

            if (allCorrect) {
                console.log('✅ Test 3 Passed: All concurrent tasks executed correctly');
                testsPassed++;
            } else {
                console.log('❌ Test 3 Failed: Some tasks returned incorrect results');
                testsFailed++;
                errors.push('Concurrent task execution failed');
            }
        } catch (error) {
            console.log('❌ Test 3 Failed: Concurrent task execution error:', error);
            testsFailed++;
            errors.push(`Concurrent task execution error: ${error.message}`);
        }

        // Test 4: Test task cancellation
        console.log('\nTest 4: Test task cancellation');
        try {
            // Start a long-running task
            const taskPromise = pool.executeTask(
                'test',
                (data) => {
                    return new Promise(resolve => {
                        setTimeout(() => resolve('done'), data.delay);
                    });
                },
                { delay: 3000 },
                {
                    priority: TaskPriority.LOW
                }
            );

            // Cancel all LOW priority tasks
            setTimeout(() => {
                const cancelled = pool.cancelTasks(task => task.priority === TaskPriority.LOW);
                console.log(`Cancelled ${cancelled} tasks`);
            }, 100);

            try {
                await taskPromise;
                console.log('❌ Test 4 Failed: Task was not cancelled');
                testsFailed++;
                errors.push('Task cancellation failed');
            } catch (error) {
                if (error.message && error.message.includes('cancelled')) {
                    console.log('✅ Test 4 Passed: Task was successfully cancelled');
                    testsPassed++;
                } else {
                    console.log('❌ Test 4 Failed: Task failed for unexpected reason:', error);
                    testsFailed++;
                    errors.push(`Task cancellation unexpected error: ${error.message}`);
                }
            }
        } catch (error) {
            console.log('❌ Test 4 Failed: Cancellation test error:', error);
            testsFailed++;
            errors.push(`Cancellation test error: ${error.message}`);
        }

        // Test 5: Test error handling
        console.log('\nTest 5: Test error handling');
        try {
            await pool.executeTask(
                'test',
                (data) => {
                    throw new Error('Intentional error for testing');
                },
                {}
            );

            console.log('❌ Test 5 Failed: Error was not thrown');
            testsFailed++;
            errors.push('Error handling test failed');
        } catch (error) {
            if (error.message.includes('Intentional error for testing')) {
                console.log('✅ Test 5 Passed: Error was propagated correctly');
                testsPassed++;
            } else {
                console.log('❌ Test 5 Failed: Unexpected error:', error);
                testsFailed++;
                errors.push(`Error handling unexpected result: ${error.message}`);
            }
        }

        // Test 6: Shut down the pool
        console.log('\nTest 6: Shutdown worker pool');
        try {
            pool.shutdown();

            // Wait for pool to shut down
            await new Promise(resolve => setTimeout(resolve, 500));

            const status = pool.getStatus();
            if (status.totalWorkers === 0) {
                console.log('✅ Test 6 Passed: Worker pool shut down correctly');
                testsPassed++;
            } else {
                console.log('❌ Test 6 Failed: Worker pool not shut down correctly');
                testsFailed++;
                errors.push('Pool shutdown failed');
            }
        } catch (error) {
            console.log('❌ Test 6 Failed: Shutdown error:', error);
            testsFailed++;
            errors.push(`Pool shutdown error: ${error.message}`);
        }

    } catch (error) {
        console.error('Test suite error:', error);
        testsFailed++;
        errors.push(`Test suite error: ${error.message}`);
    }

    // Print test summary
    console.log('\n==== WebWorkerPool Test Summary ====');
    console.log(`Total Tests: ${testsPassed + testsFailed}`);
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);

    if (errors.length > 0) {
        console.log('\nErrors:');
        errors.forEach((error, i) => console.log(`${i + 1}. ${error}`));
    }

    return {
        passed: testsPassed,
        failed: testsFailed,
        errors
    };
}

// Run tests if this file is executed directly
if (typeof window === 'undefined' && typeof process !== 'undefined' && process.argv[1] === import.meta.url) {
    runWebWorkerPoolTests().catch(console.error);
}

export { runWebWorkerPoolTests }; 