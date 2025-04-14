/**
 * @fileoverview Script to run security tests for the ZK proof system
 * Tests for various attack vectors and security vulnerabilities
 * 
 * Enhanced security tests include:
 * - Multiple attack vectors (replay, MitM, parameter tampering, input fuzzing, malformed proofs)
 * - Advanced attack vectors (nullifier reuse, identity spoofing)
 * - Man-in-the-Middle attack tests (passive interception, modification, replacement, timing attacks)
 * - Denial of service resistance tests
 */

import path from 'path';
import fs from 'fs';
import { AttackVectorTest } from '../tests/security/AttackVectorTest.js';
import { MITMTest } from '../tests/security/MITMTest.js';

// Create directory for security results if it doesn't exist
const RESULTS_DIR = path.resolve('./lib/zk/tests/security-results');
if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * Run security tests for the ZK proof system
 * @param {Object} options Test options
 */
async function runSecurityTests(options = {}) {
    const startTime = performance.now();
    console.log('🛡️ Starting ZK Security Tests...');

    const verbose = options.verbose || process.argv.includes('--verbose');
    // Lower the default iterations to prevent test hanging
    const iterations = options.iterations || parseInt(process.argv.find(arg => arg.startsWith('--iterations='))?.split('=')[1] || '2');
    const testType = process.argv.find(arg => arg.startsWith('--test='))?.split('=')[1] || 'mitm'; // Default to just MITM test for faster execution

    // Test configuration
    const testConfig = {
        verbose,
        iterations,
        outputDir: RESULTS_DIR
    };

    try {
        const securityResults = {
            startTime: new Date().toISOString(),
            tests: [],
            summary: {
                passed: 0,
                failed: 0,
                totalVulnerabilities: 0
            }
        };

        // Run attack vector tests if requested or running all tests
        if (testType === 'all' || testType === 'attack') {
            console.log('⚔️ Running Attack Vector Tests...');
            const attackVectorTest = new AttackVectorTest({
                ...testConfig,
                name: 'ZK Attack Vector Test'
            });

            // This will run all attack vectors including:
            // - replay attacks
            // - MitM attacks
            // - parameter tampering
            // - input fuzzing
            // - malformed proofs
            // - nullifier reuse (new)
            // - identity spoofing (new)
            const attackResults = await attackVectorTest.run();
            console.log(`✅ Attack Vector Tests completed with ${attackResults.details ? Object.keys(attackResults.details).length : 0} vectors tested`);

            const vulnerabilityCount = attackResults.recommendations ? attackResults.recommendations.length : 0;
            securityResults.tests.push({
                name: 'AttackVectorTest',
                vulnerabilityCount,
                passed: vulnerabilityCount === 0
            });

            if (vulnerabilityCount === 0) {
                securityResults.summary.passed++;
            } else {
                securityResults.summary.failed++;
                securityResults.summary.totalVulnerabilities += vulnerabilityCount;
            }
        }

        // Run MITM tests if requested or running all tests
        if (testType === 'all' || testType === 'mitm') {
            console.log('🔄 Running Man-in-the-Middle Tests...');
            const mitmTest = new MITMTest({
                ...testConfig,
                name: 'ZK MITM Test'
            });

            // This will run all MITM tests including:
            // - passive interception
            // - proof modification
            // - proof replacement
            // - timing attacks
            // - denial of service (new)
            const mitmResults = await mitmTest.run();
            console.log(`✅ MITM Tests completed with detection rate: ${mitmResults.overallDetectionRate?.toFixed(2)}%`);

            const vulnerabilityCount = mitmResults.vulnerabilities ? mitmResults.vulnerabilities.length : 0;
            securityResults.tests.push({
                name: 'MITMTest',
                vulnerabilityCount,
                passed: mitmResults.passed
            });

            if (mitmResults.passed) {
                securityResults.summary.passed++;
            } else {
                securityResults.summary.failed++;
                securityResults.summary.totalVulnerabilities += vulnerabilityCount;
            }
        }

        // Save summary results
        securityResults.endTime = new Date().toISOString();
        securityResults.duration = ((performance.now() - startTime) / 1000).toFixed(2);

        const summaryFilePath = path.join(RESULTS_DIR, `security-summary-${new Date().toISOString().replace(/:/g, '-')}.json`);
        fs.writeFileSync(summaryFilePath, JSON.stringify(securityResults, null, 2));
        console.log(`📊 Security summary saved to ${summaryFilePath}`);

    } catch (error) {
        console.error('❌ Error running security tests:', error);
        process.exit(1);
    }

    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n🏁 All security tests completed in ${duration} seconds`);
    console.log(`📊 Security test results saved to ${RESULTS_DIR}`);
}

// Run tests if this module is executed directly
if (process.argv[1] === import.meta.url) {
    runSecurityTests().catch(err => {
        console.error('Failed to run security tests:', err);
        process.exit(1);
    });
}

export default runSecurityTests; 