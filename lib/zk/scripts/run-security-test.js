#!/usr/bin/env node

/**
 * ZK Security Test Runner
 * 
 * Script to run security tests for the ZK proof system
 * Usage: node run-security-test.js [--verbose] [--output=<dir>] [--test=<test-name>]
 * 
 * Test options:
 *   --test=all          Run all security tests (default)
 *   --test=attack       Run only attack vector tests
 *   --test=mitm         Run only man-in-the-middle tests
 *   --verbose           Enable verbose logging
 *   --output=<dir>      Specify output directory for test results
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AttackVectorTest } from '../tests/security/AttackVectorTest.js';
import { ManInTheMiddleTest } from '../tests/security/ManInTheMiddleTest.js';

// Get directory name for the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command-line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.split('=');
    const cleanKey = key.replace(/^--/, '');
    acc[cleanKey] = value || true;
    return acc;
}, {});

// Default values
const rootDir = path.resolve(__dirname, '../../..');
const options = {
    verbose: args.verbose || false,
    output: args.output || path.join(rootDir, 'reports/security'),
    test: args.test || 'all',
    iterations: args.iterations || 100
};

/**
 * Run security tests
 */
async function runSecurityTests() {
    console.log('🔒 Starting ZK Security Tests...');

    // Ensure output directory exists
    if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
    }

    const startTime = process.hrtime();
    const results = {
        tests: [],
        summary: {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            vulnerabilitiesDetected: 0
        }
    };

    try {
        // Run attack vector tests if specified
        if (options.test === 'all' || options.test === 'attack') {
            console.log('\n⚔️ Running Attack Vector Tests...');
            const attackTest = new AttackVectorTest({
                name: 'ZK-Attack-Vector-Test',
                verbose: options.verbose,
                outputDir: options.output,
                iterations: options.iterations
            });

            const attackResults = await attackTest.runTests();
            results.tests.push(attackResults);

            console.log(`✅ Attack Vector Tests Completed - Detection Rate: ${attackResults.detectionRate.toFixed(2)}%`);
            console.log(`📊 Recommendation: ${attackResults.recommendation}`);
        }

        // Run MITM tests if specified
        if (options.test === 'all' || options.test === 'mitm') {
            console.log('\n🕸️ Running Man-in-the-Middle Tests...');
            const mitmTest = new ManInTheMiddleTest({
                name: 'ZK-MITM-Test',
                verbose: options.verbose,
                outputDir: options.output,
                iterations: options.iterations
            });

            const mitmResults = await mitmTest.runTests();
            results.tests.push(mitmResults);

            console.log(`✅ MITM Tests Completed - Detection Rate: ${mitmResults.detectionRate.toFixed(2)}%`);
            console.log(`📊 Recommendation: ${mitmResults.recommendation}`);
        }

        // Calculate summary statistics
        results.summary.totalTests = results.tests.reduce((sum, test) => sum + test.total, 0);
        results.summary.passedTests = results.tests.reduce((sum, test) => sum + test.detected, 0);
        results.summary.failedTests = results.summary.totalTests - results.summary.passedTests;
        results.summary.vulnerabilitiesDetected = results.tests.reduce((sum, test) => sum + Object.keys(test.vulnerabilities || {}).length, 0);

        // Save overall results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const resultsPath = path.join(options.output, `security-test-results-${timestamp}.json`);
        fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

        // Calculate elapsed time
        const elapsedTime = process.hrtime(startTime);
        const seconds = (elapsedTime[0] + (elapsedTime[1] / 1e9)).toFixed(2);

        // Print summary
        console.log('\n📋 Security Test Summary:');
        console.log(`Total Tests Run: ${results.summary.totalTests}`);
        console.log(`Passed Tests: ${results.summary.passedTests}`);
        console.log(`Failed Tests: ${results.summary.failedTests}`);
        console.log(`Vulnerabilities Detected: ${results.summary.vulnerabilitiesDetected}`);
        console.log(`Overall Detection Rate: ${(results.summary.passedTests / results.summary.totalTests * 100).toFixed(2)}%`);

        console.log(`\nResults saved to: ${resultsPath}`);
        console.log(`Security tests completed in ${seconds}s`);

        // Return non-zero exit code if any tests failed
        if (results.summary.failedTests > 0) {
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Error running security tests:', error);
        process.exit(1);
    }
}

// Run the tests
runSecurityTests().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
}); 