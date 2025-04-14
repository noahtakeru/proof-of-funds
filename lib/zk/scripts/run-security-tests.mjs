#!/usr/bin/env node

/**
 * ZK Security Test Runner
 * 
 * Script to run security tests against ZK proof system code.
 * Usage: node run-security-tests.mjs [--target=<path>] [--verbose] [--output=<dir>]
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { SecurityRuleRunner } from '../src/security/SecurityRuleRunner.js';

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
const defaultTargetPath = path.join(rootDir, 'lib/zk');
const options = {
    target: args.target || args._[0] || defaultTargetPath,
    verbose: args.verbose || false,
    output: args.output || path.join(rootDir, 'reports/security'),
    report: args.report || 'zk-security-report.json',
    excludePatterns: [
        'node_modules',
        'dist',
        'build',
        'coverage',
        'tests/fixtures',
        '.git'
    ]
};

/**
 * Run security tests
 */
async function runSecurityTests() {
    console.log('🔒 Starting ZK security tests...');
    console.log(`Target: ${options.target}`);

    // Ensure output directory exists
    if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
    }

    // Create rule runner with options
    const runner = new SecurityRuleRunner({
        outputDir: options.output,
        verbose: options.verbose,
        excludePatterns: options.excludePatterns
    });

    // Start timer
    const startTime = process.hrtime();

    try {
        // Run analysis
        const result = runner.analyze(options.target, options.report);

        // Calculate elapsed time
        const elapsedTime = process.hrtime(startTime);
        const seconds = (elapsedTime[0] + (elapsedTime[1] / 1e9)).toFixed(2);

        // Print summary
        console.log('\n📊 Security Test Results:');
        console.log(`Total findings: ${result.findingsCount}`);

        // Print findings by severity
        if (result.summary.findingsBySeverity) {
            console.log('\nFindings by severity:');
            const severities = Object.keys(result.summary.findingsBySeverity).sort((a, b) => {
                // Sort order: CRITICAL, HIGH, MEDIUM, LOW, INFO, others
                const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
                return (order[a] || 99) - (order[b] || 99);
            });

            for (const severity of severities) {
                const count = result.summary.findingsBySeverity[severity];
                let icon = '📌';

                // Different icons for different severities
                if (severity === 'CRITICAL') icon = '🚨';
                if (severity === 'HIGH') icon = '⚠️';
                if (severity === 'MEDIUM') icon = '⚡';
                if (severity === 'LOW') icon = '📝';
                if (severity === 'INFO') icon = 'ℹ️';

                console.log(`  ${icon} ${severity}: ${count}`);
            }
        }

        console.log(`\nReport saved to: ${result.reportPath}`);
        console.log(`Security tests completed in ${seconds}s`);

        // Return non-zero exit code if critical or high findings
        const criticalCount = result.summary.findingsBySeverity.CRITICAL || 0;
        const highCount = result.summary.findingsBySeverity.HIGH || 0;

        if (criticalCount > 0 || highCount > 0) {
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