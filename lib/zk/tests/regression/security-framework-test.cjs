/**
 * Week 10.5 Security Framework Regression Tests
 * 
 * This file tests the security framework components added in Week 10.5:
 * - Performance benchmarking
 * - Security testing framework
 * - Implementation vulnerability checker
 * - Security rules
 * - Anomaly detection
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const TEST_RESULTS = {
    passed: 0,
    failed: 0,
    tests: []
};

// Get the project root directory - go up three levels from the regression directory
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

function test(name, testFn) {
    console.log(`Running test: ${name}`);
    try {
        testFn();
        TEST_RESULTS.passed++;
        TEST_RESULTS.tests.push({ name, passed: true });
        console.log(`✓ Test passed: ${name}`);
    } catch (error) {
        TEST_RESULTS.failed++;
        TEST_RESULTS.tests.push({ name, passed: false, error: error.message });
        console.error(`✗ Test failed: ${name}`);
        console.error(`  Error: ${error.message}`);
    }
}

// Function to check if a file exists and contains specific content
function checkFileContent(filePath, requiredStrings) {
    const fullPath = path.resolve(PROJECT_ROOT, filePath);

    if (!fs.existsSync(fullPath)) {
        throw new Error(`File does not exist: ${filePath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf8');

    for (const str of requiredStrings) {
        if (!content.includes(str)) {
            throw new Error(`Required content not found in ${filePath}: ${str}`);
        }
    }

    return true;
}

// Function to check if a package.json script exists
function checkPackageJsonScript(scriptName) {
    const packageJsonPath = path.resolve(PROJECT_ROOT, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
        throw new Error('package.json does not exist');
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    if (!packageJson.scripts || !packageJson.scripts[scriptName]) {
        throw new Error(`Script not found in package.json: ${scriptName}`);
    }

    return true;
}

console.log('Starting Week 10.5 Security Framework Regression Tests');

// Test 1: Performance Benchmarking Framework
test('Performance Benchmarking Framework exists', () => {
    const filePath = 'lib/zk/tests/performance/PerformanceBenchmark.js';
    const requiredStrings = [
        'class PerformanceBenchmark',
        'constructor',
        'suite',
        'benchmark',
        'saveResults',
        'generateReport'
    ];

    assert.ok(checkFileContent(filePath, requiredStrings));
});

// Test 2: Proof Generation Test
test('Proof Generation Test exists', () => {
    const filePath = 'lib/zk/tests/performance/ProofGenerationTest.js';
    const requiredStrings = [
        'class ProofGenerationTest',
        'constructor',
        'generateTestWallets',
        'runStandardProofBenchmark',
        'runThresholdProofBenchmark',
        'runMaximumProofBenchmark'
    ];

    assert.ok(checkFileContent(filePath, requiredStrings));
});

// Test 3: Scalability Test
test('Scalability Test exists', () => {
    const filePath = 'lib/zk/tests/performance/ScalabilityTest.js';
    const requiredStrings = [
        'class ScalabilityTest',
        'constructor',
        'runBatchSizeTests',
        'runConcurrencyTests',
        'runLargeVolumeTests',
        'runMixedProofTests'
    ];

    assert.ok(checkFileContent(filePath, requiredStrings));
});

// Test 4: Proof Worker
test('Proof Worker exists', () => {
    const filePath = 'lib/zk/tests/performance/ProofWorker.js';
    const requiredStrings = [
        'parentPort',
        'workerData',
        'runWorker',
        'performance',
        'generateStandardProof',
        'generateThresholdProof',
        'generateMaximumProof'
    ];

    assert.ok(checkFileContent(filePath, requiredStrings));
});

// Test 5: Script to run performance tests
test('Performance test script exists', () => {
    const filePath = 'lib/zk/scripts/run-performance-tests.mjs';
    const requiredStrings = [
        'ProofGenerationTest',
        'ScalabilityTest',
        'runPerformanceTests',
        'async function',
        'console.log'
    ];

    assert.ok(checkFileContent(filePath, requiredStrings));
    assert.ok(checkPackageJsonScript('test:zk:performance'));
});

// Test 6: SecurityTest base class
test('SecurityTest base class exists', () => {
    const filePath = 'lib/zk/tests/security/SecurityTest.js';
    const requiredStrings = [
        'class SecurityTest',
        'constructor',
        'generateTestWallet',
        'generateRandomTestVector',
        'calculateDetectionRate',
        'generateRecommendation',
        'saveTestResults'
    ];

    assert.ok(checkFileContent(filePath, requiredStrings));
});

// Test 7: AttackVectorTest class
test('AttackVectorTest class exists', () => {
    const filePath = 'lib/zk/tests/security/AttackVectorTest.js';
    const requiredStrings = [
        'class AttackVectorTest',
        'extends SecurityTest',
        'testReplayAttack',
        'testMitMAttack',
        'testParameterTampering',
        'testInputFuzzing',
        'testMalformedProof'
    ];

    assert.ok(checkFileContent(filePath, requiredStrings));
});

// Test 8: Implementation Vulnerability Detector
test('Implementation Vulnerability Detector exists', () => {
    const filePath = 'lib/zk/src/security/detectors/ImplementationVulnerabilityDetector.js';
    const requiredStrings = [
        'class ImplementationVulnerabilityDetector',
        'evaluate',
        'isRelevantFile',
        'hasProtectiveMeasuresNearby',
        'checkForAdvancedIssues',
        'checkInconsistentErrorHandling'
    ];

    assert.ok(checkFileContent(filePath, requiredStrings));
});

// Test 9: Script to run vulnerability checks
test('Vulnerability check script exists', () => {
    const filePath = 'lib/zk/scripts/run-implementation-vulnerability-check.js';
    const requiredStrings = [
        'ImplementationVulnerabilityDetector',
        'runImplementationVulnerabilityCheck',
        'findFiles',
        'formatFindings',
        'saveFindings',
        'generateSummary'
    ];

    assert.ok(checkFileContent(filePath, requiredStrings));
    assert.ok(checkPackageJsonScript('test:zk:vuln'));
});

// Test 10: CryptoVerificationRule
test('CryptoVerificationRule exists', () => {
    const filePath = 'lib/zk/src/security/rules/CryptoVerificationRule.js';
    const requiredStrings = [
        'class CryptoVerificationRule',
        'evaluate',
        '_checkMissingVerification',
        '_checkInsecureRandomGeneration',
        '_checkHardcodedSecrets',
        '_checkWeakAlgorithms'
    ];

    assert.ok(checkFileContent(filePath, requiredStrings));
});

// Test 11: PrivilegeEscalationRule
test('PrivilegeEscalationRule exists', () => {
    const filePath = 'lib/zk/src/security/rules/PrivilegeEscalationRule.js';
    const requiredStrings = [
        'class PrivilegeEscalationRule',
        'evaluate',
        '_checkUnsafeAdminFunctions',
        '_checkImproperAccessControl',
        '_checkUncheckedParameters',
        '_checkUnsafeDynamicImports'
    ];

    assert.ok(checkFileContent(filePath, requiredStrings));
});

// Test 12: Security Rules index file
test('Security Rules index exists', () => {
    const filePath = 'lib/zk/src/security/rules/index.js';
    const requiredStrings = [
        'import CryptoVerificationRule',
        'import PrivilegeEscalationRule',
        'export const defaultRules',
        'getAllRules',
        'getRulesBySeverity',
        'createCustomRules'
    ];

    assert.ok(checkFileContent(filePath, requiredStrings));
});

// Test 13: Anomaly Detector
test('Anomaly Detector exists', () => {
    const filePath = 'lib/zk/src/security/detectors/AnomalyDetector.js';
    const requiredStrings = [
        'class AnomalyDetector',
        'isRelevantFile',
        'calculateComplexity',
        'extractFunctions',
        'detectNamingInconsistencies',
        'detectUnusualControlFlow',
        'detectStatisticalOutliers',
        'detectUnusualErrorHandling',
        'detectBypassFlags'
    ];

    assert.ok(checkFileContent(filePath, requiredStrings));
});

// Test 14: SecurityDetectorFactory includes AnomalyDetector
test('SecurityDetectorFactory includes AnomalyDetector', () => {
    const filePath = 'lib/zk/src/security/detectors/SecurityDetectorFactory.js';
    const requiredStrings = [
        'AnomalyDetector',
        'NotificationChannelType',
        'this.registerDetector(new AnomalyDetector())'
    ];

    assert.ok(checkFileContent(filePath, requiredStrings));
});

// Test 15: Logger utility
test('Logger utility exists', () => {
    const filePath = 'lib/zk/scripts/common/logger.js';
    const requiredStrings = [
        'class Logger',
        'constructor',
        'log',
        'trace',
        'debug',
        'info',
        'warn',
        'error',
        'child'
    ];

    assert.ok(checkFileContent(filePath, requiredStrings));
});

// Test 16: ModuleFormatFixer
test('ModuleFormatFixer exists', () => {
    const filePath = 'lib/zk/scripts/fixes/module-formats.js';
    const requiredStrings = [
        'class ModuleFormatFixer',
        'constructor',
        'shouldProcessFile',
        'needsFixes',
        'updateImports',
        'updateExports',
        'updateDirnameFilename',
        'fixFile'
    ];

    assert.ok(checkFileContent(filePath, requiredStrings));
});

// Test 17: SecurityRuleRunner
test('SecurityRuleRunner exists', () => {
    const filePath = 'lib/zk/src/security/SecurityRuleRunner.js';
    const requiredStrings = [
        'class SecurityRuleRunner',
        'constructor',
        '_shouldExcludeFile',
        '_readFile',
        '_extractFunctions',
        'runAgainstFile',
        'runAgainstDirectory',
        'run',
        'saveReport'
    ];

    assert.ok(checkFileContent(filePath, requiredStrings));
});

console.log('\nTest Summary:');
console.log(`Passed: ${TEST_RESULTS.passed}`);
console.log(`Failed: ${TEST_RESULTS.failed}`);
console.log(`Total: ${TEST_RESULTS.passed + TEST_RESULTS.failed}`);

if (TEST_RESULTS.failed > 0) {
    console.log('\nFailed Tests:');
    TEST_RESULTS.tests.filter(t => !t.passed).forEach(test => {
        console.log(`- ${test.name}: ${test.error}`);
    });
    process.exit(1);
} else {
    console.log('\nAll tests passed!');
    process.exit(0);
} 