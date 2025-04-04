/**
 * ZK Infrastructure Test Runner
 * 
 * This script runs all ZK infrastructure tests and collects comprehensive
 * performance and memory usage reports for analysis.
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import test runners
import { runStandardProofTests } from './testRunners/standardProofRunner.js';
import { runThresholdProofTests } from './testRunners/thresholdProofRunner.js';
import { runMaximumProofTests } from './testRunners/maximumProofRunner.js';

// Import performance reporting
import { createBenchmark } from '../benchmarkSuite.js';
import { createMemoryProfiler } from '../memoryProfiler.js';
import { PERFORMANCE_TARGETS, MEMORY_BUDGETS } from './testVectors.js';

// File paths setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORT_DIR = path.join(__dirname, 'reports');

// Ensure the reports directory exists
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

/**
 * Generate a timestamp string for filenames
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
}

/**
 * Save test results to a file
 * @param {Object} results - Test results object
 * @param {string} filename - Output filename
 */
function saveResults(results, filename) {
  const filePath = path.join(REPORT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
  console.log(`Results saved to ${filePath}`);
}

/**
 * Generate a summary report from all test results
 * @param {Object} results - Combined test results
 * @returns {string} Summary report text
 */
function generateSummaryReport(results) {
  const { standardResults, thresholdResults, maximumResults, performanceResults } = results;
  
  let report = '# ZK Testing Infrastructure Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  
  report += '## Test Results Summary\n\n';
  report += `- Standard Proof Tests: ${standardResults.totalPassed}/${standardResults.totalTests} passed\n`;
  report += `- Threshold Proof Tests: ${thresholdResults.totalPassed}/${thresholdResults.totalTests} passed\n`;
  report += `- Maximum Proof Tests: ${maximumResults.totalPassed}/${maximumResults.totalTests} passed\n\n`;
  
  report += '## Performance Summary\n\n';
  report += '| Operation | Actual Time (ms) | Target Time (ms) | Status |\n';
  report += '|-----------|-----------------|-----------------|--------|\n';
  
  for (const [key, value] of Object.entries(performanceResults)) {
    const target = key.includes('Verification') 
      ? PERFORMANCE_TARGETS.desktop.proofVerification 
      : PERFORMANCE_TARGETS.desktop[key];
    
    const status = value <= target ? '✅' : '⚠️';
    report += `| ${key} | ${value.toFixed(2)} | ${target} | ${status} |\n`;
  }
  
  return report;
}

/**
 * Main function to run all tests and generate reports
 */
async function runAllTests() {
  console.log('Starting ZK Infrastructure Test Suite');
  
  // Start overall benchmark
  const overallBenchmark = createBenchmark('zk-all-tests', {
    operationType: 'testing',
    circuitType: 'all'
  });
  
  const overallMemory = createMemoryProfiler('zk-all-tests', {
    operationType: 'testing',
    circuitType: 'all'
  });
  
  overallBenchmark.start();
  overallMemory.start();
  
  try {
    // Run all test suites
    console.log('Running Standard Proof Tests...');
    const standardResults = await runStandardProofTests();
    
    console.log('Running Threshold Proof Tests...');
    const thresholdResults = await runThresholdProofTests();
    
    console.log('Running Maximum Proof Tests...');
    const maximumResults = await runMaximumProofTests();
    
    // Collect performance metrics
    const performanceResults = {
      standardProofGeneration: standardResults.performanceMetrics.generation,
      thresholdProofGeneration: thresholdResults.performanceMetrics.generation,
      maximumProofGeneration: maximumResults.performanceMetrics.generation,
      proofVerification: (
        standardResults.performanceMetrics.verification +
        thresholdResults.performanceMetrics.verification +
        maximumResults.performanceMetrics.verification
      ) / 3 // Average verification time
    };
    
    // Stop overall benchmark
    const overallResults = overallBenchmark.end();
    const memoryResults = overallMemory.stop();
    
    // Combine all results
    const allResults = {
      timestamp: new Date().toISOString(),
      standardResults,
      thresholdResults,
      maximumResults,
      performanceResults,
      overallExecutionTime: overallResults.executionTime,
      memoryUsage: memoryResults
    };
    
    // Save detailed results
    const timestamp = getTimestamp();
    saveResults(allResults, `zk-test-results-${timestamp}.json`);
    
    // Generate and save summary report
    const summaryReport = generateSummaryReport(allResults);
    fs.writeFileSync(
      path.join(REPORT_DIR, `zk-test-summary-${timestamp}.md`),
      summaryReport
    );
    
    console.log('All tests completed!');
    console.log(`Overall execution time: ${overallResults.executionTime}ms`);
    
    return allResults;
  } catch (error) {
    console.error('Test execution failed:', error);
    throw error;
  }
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { runAllTests };