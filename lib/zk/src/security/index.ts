/**
 * @fileoverview Security Testing Framework Index
 * 
 * Entry point for the ZK Security Testing Framework. Exports the main components
 * for security testing, vulnerability detection, and implementation validation.
 * 
 * @author ZK Infrastructure Team
 * @created August 2024
 */

// Import directly for use in function implementation
import { SecurityTestSuite, type SecurityTestResult } from './SecurityTestSuite';

// Export main security testing components
export { SecurityTestSuite, securityTest, type SecurityTestConfig, type SecurityTestResult } from './SecurityTestSuite';
export { SecurityTestRunner, runSecurityChecks, type TestRunnerConfig } from './SecurityTestRunner';

// Export pre-built validators and verifiers
export { default as InputValidator } from './InputValidator';
export { default as NonceValidator } from './NonceValidator';
export { default as RequestSignatureVerifier } from './RequestSignatureVerifier';
export { default as ResponseSigner } from './ResponseSigner';

// Export security rules and auditing components
export { default as SecurityRule } from './SecurityRule';
export { default as SecurityRuleRunner } from './SecurityRuleRunner';
export { default as SecurityAuditor } from './SecurityAuditor';
export { default as SecurityRulesRegistry } from './SecurityRulesRegistry';
export { default as PenetrationTest } from './PenetrationTest';

// Export detector components
export { default as ImplementationVulnerabilityDetector } from './detectors/ImplementationVulnerabilityDetector';

/**
 * Run a comprehensive security test suite
 * 
 * @param options - Test configuration options
 * @returns Promise resolving to test results
 */
export async function validateSecurity(options: {
    implementationPath?: string;
    outputDir?: string;
    verbose?: boolean;
} = {}): Promise<SecurityTestResult> {
    // Create a new test suite instance
    const testSuite = new SecurityTestSuite({
        outputDir: options.outputDir,
        verbose: options.verbose
    });

    if (options.implementationPath) {
        return await testSuite.validateSecurity(options.implementationPath);
    } else {
        // Run on default implementation paths
        const results = await testSuite.runSecurityChecks();
        return {
            name: 'System Security Validation',
            description: 'Comprehensive security validation of ZK implementation',
            passed: results.every((r: SecurityTestResult) => r.passed),
            vulnerabilities: results.flatMap((r: SecurityTestResult) => r.vulnerabilities),
            recommendations: results.flatMap((r: SecurityTestResult) => r.recommendations),
            executionTime: results.reduce((sum: number, r: SecurityTestResult) => sum + r.executionTime, 0),
            criticality: Math.max(...results.map((r: SecurityTestResult) => r.criticality), 0)
        };
    }
} 