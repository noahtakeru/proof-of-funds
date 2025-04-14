/**
 * Performance Test Runner
 * 
 * Executes comprehensive performance tests for the ZK proof system
 * Measures and reports on proof generation, verification, and scalability
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ProofGenerationTest } from '../tests/performance/ProofGenerationTest.js';
import { ScalabilityTest } from '../tests/performance/ScalabilityTest.js';

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create performance results directory
const resultsDir = path.join(__dirname, '..', 'performance-results');
if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
}

/**
 * Run the performance tests
 * 
 * Controls which test suites are executed and handles results
 */
async function runPerformanceTests() {
    console.log('=== ZK Proof System Performance Test Runner ===');

    try {
        // Parse command line arguments
        const args = process.argv.slice(2);
        const runProofTests = args.includes('--proof') || args.length === 0;
        const runScalabilityTests = args.includes('--scalability') || args.length === 0;
        const verbose = args.includes('--verbose');

        console.log(`Configuration:`);
        console.log(`- Proof generation tests: ${runProofTests ? 'Enabled' : 'Disabled'}`);
        console.log(`- Scalability tests: ${runScalabilityTests ? 'Enabled' : 'Disabled'}`);
        console.log(`- Verbose logging: ${verbose ? 'Enabled' : 'Disabled'}`);
        console.log('');

        // Track execution time
        const startTime = new Date();

        // Run proof generation tests
        if (runProofTests) {
            console.log('Running proof generation performance tests...');
            try {
                const proofTest = new ProofGenerationTest({
                    outputDir: resultsDir,
                    verbose: verbose,
                    saveResults: true
                });

                const proofResults = await proofTest.runAllBenchmarks();
                console.log(`Proof generation tests completed. Results saved to: ${proofResults.resultPath}`);
                proofTest.cleanup();
            } catch (error) {
                console.error('Error in proof generation tests:', error);
            }
        }

        // Run scalability tests
        if (runScalabilityTests) {
            console.log('\nRunning scalability tests...');
            try {
                const scalabilityTest = new ScalabilityTest({
                    outputDir: resultsDir,
                    verbose: verbose,
                    maxConcurrency: Math.max(1, Math.floor(require('os').cpus().length * 0.75))
                });

                const scalabilityResults = await scalabilityTest.runAllTests();
                console.log(`Scalability tests completed. Results saved to: ${scalabilityResults.resultPath}`);
                scalabilityTest.cleanup();
            } catch (error) {
                console.error('Error in scalability tests:', error);
            }
        }

        const endTime = new Date();
        const elapsedTime = (endTime - startTime) / 1000;

        console.log(`\nPerformance testing completed in ${elapsedTime.toFixed(2)} seconds.`);
        console.log(`Results are available in ${resultsDir}`);

    } catch (error) {
        console.error('Fatal error in performance test runner:', error);
        process.exit(1);
    }
}

// Execute the tests
runPerformanceTests().catch(console.error); 