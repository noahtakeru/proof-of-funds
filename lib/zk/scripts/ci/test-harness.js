/**
 * CI/CD Test Harness for Zero-Knowledge Infrastructure
 * 
 * This script provides a standardized way to run all test suites with
 * consistent reporting and CI/CD integration. It's designed to be used in
 * GitHub Actions workflows but can also be run locally.
 * 
 * Features:
 * - Runs all test suites (unit, integration, regression, security)
 * - Collects and aggregates test results and coverage
 * - Generates standardized reports for CI/CD consumption
 * - Supports parallel test execution for faster CI builds
 * - Provides exit codes suitable for CI/CD usage
 */

import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';

// Configuration for test runs
const config = {
  testSuites: [
    {
      name: 'unit',
      command: 'jest',
      args: ['--config', 'jest.config.cjs', '--testPathIgnorePatterns=integration e2e'],
      parallelizable: true,
      required: true
    },
    {
      name: 'integration',
      command: 'jest',
      args: ['--config', 'jest.config.cjs', '--testPathPattern=integration'],
      parallelizable: true,
      required: true
    },
    {
      name: 'e2e',
      command: 'jest',
      args: ['--config', 'jest.config.cjs', '--testPathPattern=e2e'],
      parallelizable: false,
      required: false
    },
    {
      name: 'regression',
      command: 'sh',
      args: ['tests/regression/run-regression-tests.sh'],
      parallelizable: false,
      required: true
    },
    {
      name: 'security',
      script: './scripts/run-security-tests.mjs',
      parallelizable: false,
      required: false
    }
  ],
  reportDir: path.join(process.cwd(), 'tests', 'reports'),
  parallel: process.env.CI_PARALLEL === 'true',
  captureConsole: true,
  failFast: process.env.CI_FAIL_FAST === 'true',
  timeoutMinutes: 30,
  coverage: process.env.CI_COVERAGE === 'true'
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  suites: [],
  reportFormat: 'json',
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--suite' && i + 1 < args.length) {
    options.suites.push(args[++i]);
  } else if (arg === '--report' && i + 1 < args.length) {
    options.reportFormat = args[++i];
  } else if (arg === '--verbose') {
    options.verbose = true;
  }
}

// If no suites specified, run all
if (options.suites.length === 0) {
  options.suites = config.testSuites.map(suite => suite.name);
}

// Ensure report directory exists
if (!fs.existsSync(config.reportDir)) {
  fs.mkdirSync(config.reportDir, { recursive: true });
}

// Utility functions
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}]`;
  
  if (level === 'error') {
    console.error(`${prefix} ERROR: ${message}`);
  } else if (level === 'warning') {
    console.warn(`${prefix} WARNING: ${message}`);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

function runCommand(command, args, options = {}) {
  log(`Running command: ${command} ${args.join(' ')}`);
  
  const defaultOptions = {
    stdio: 'pipe',
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024, // 10MB
    timeout: config.timeoutMinutes * 60 * 1000
  };
  
  const result = spawnSync(command, args, { ...defaultOptions, ...options });
  
  if (result.error) {
    throw new Error(`Failed to execute command: ${result.error.message}`);
  }
  
  return {
    stdout: result.stdout?.toString() || '',
    stderr: result.stderr?.toString() || '',
    status: result.status,
    success: result.status === 0
  };
}

function saveReport(name, data, format = 'json') {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filename = `${name}-${timestamp}.${format}`;
  const filepath = path.join(config.reportDir, filename);
  
  if (format === 'json') {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  } else {
    fs.writeFileSync(filepath, data);
  }
  
  log(`Report saved to ${filepath}`);
  return filepath;
}

// Main test execution logic
async function runTests() {
  log('Starting test harness');
  
  const startTime = Date.now();
  const results = {
    timestamp: new Date().toISOString(),
    suites: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    },
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    }
  };
  
  // Filter suites to run
  const suitesToRun = config.testSuites.filter(suite => 
    options.suites.includes(suite.name)
  );
  
  if (suitesToRun.length === 0) {
    log('No test suites to run', 'warning');
    process.exit(0);
  }
  
  // Run each suite in sequence (parallel execution TBD)
  for (const suite of suitesToRun) {
    log(`Running test suite: ${suite.name}`);
    
    try {
      const suiteStartTime = Date.now();
      let command, args;
      
      if (suite.script) {
        // For custom scripts
        command = 'node';
        args = [suite.script];
      } else {
        // For standard commands
        command = suite.command;
        args = [...suite.args];
      }
      
      // Add coverage args if needed
      if (config.coverage && suite.name !== 'regression' && suite.name !== 'security') {
        args.push('--coverage');
      }
      
      // Execute the test command
      const result = runCommand(command, args, {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      // Process result
      const suiteEndTime = Date.now();
      const duration = suiteEndTime - suiteStartTime;
      
      // Parse output to extract test counts if possible
      const testCounts = parseTestCounts(result.stdout);
      
      // Record results
      results.suites[suite.name] = {
        success: result.success,
        duration,
        counts: testCounts,
        stdout: config.captureConsole ? result.stdout : null,
        stderr: config.captureConsole ? result.stderr : null
      };
      
      // Update summary
      results.summary.total += testCounts.total;
      results.summary.passed += testCounts.passed;
      results.summary.failed += testCounts.failed;
      results.summary.skipped += testCounts.skipped;
      
      // Handle failure
      if (!result.success && suite.required) {
        log(`Required test suite '${suite.name}' failed`, 'error');
        
        if (config.failFast) {
          log('Aborting test run due to failure in required suite', 'error');
          break;
        }
      }
      
      log(`Completed test suite: ${suite.name} (${duration}ms)`);
    } catch (error) {
      log(`Error running test suite ${suite.name}: ${error.message}`, 'error');
      
      results.suites[suite.name] = {
        success: false,
        error: error.message,
        stack: error.stack
      };
      
      if (suite.required && config.failFast) {
        log('Aborting test run due to error in required suite', 'error');
        break;
      }
    }
  }
  
  // Finalize results
  const endTime = Date.now();
  results.summary.duration = endTime - startTime;
  
  // Save report
  saveReport('test-results', results, options.reportFormat);
  
  // Determine exit code
  const requiredSuites = suitesToRun.filter(suite => suite.required);
  const failedRequiredSuites = requiredSuites.filter(suite => 
    !results.suites[suite.name]?.success
  );
  
  if (failedRequiredSuites.length > 0) {
    log(`${failedRequiredSuites.length} required test suites failed`, 'error');
    process.exit(1);
  } else {
    log('All required test suites passed');
    
    // Check for optional suite failures
    const failedOptionalSuites = suitesToRun
      .filter(suite => !suite.required)
      .filter(suite => !results.suites[suite.name]?.success);
    
    if (failedOptionalSuites.length > 0) {
      log(`${failedOptionalSuites.length} optional test suites failed`, 'warning');
    }
    
    process.exit(0);
  }
}

// Helper to parse test counts from output
function parseTestCounts(output) {
  const counts = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  };
  
  // Try to parse Jest output
  const jestMatch = output.match(/Tests:\s+(\d+) failed,\s+(\d+) passed,\s+(\d+) total/);
  if (jestMatch) {
    counts.failed = parseInt(jestMatch[1], 10);
    counts.passed = parseInt(jestMatch[2], 10);
    counts.total = parseInt(jestMatch[3], 10);
    counts.skipped = counts.total - counts.passed - counts.failed;
    return counts;
  }
  
  // Try to parse generic test output with different formats
  const totalMatch = output.match(/(\d+) tests/i);
  const passedMatch = output.match(/(\d+) passing/i);
  const failedMatch = output.match(/(\d+) failing/i);
  const skippedMatch = output.match(/(\d+) skipped/i);
  
  if (totalMatch) counts.total = parseInt(totalMatch[1], 10);
  if (passedMatch) counts.passed = parseInt(passedMatch[1], 10);
  if (failedMatch) counts.failed = parseInt(failedMatch[1], 10);
  if (skippedMatch) counts.skipped = parseInt(skippedMatch[1], 10);
  
  // If we have passed and failed but no total, calculate it
  if (!counts.total && (counts.passed || counts.failed)) {
    counts.total = (counts.passed || 0) + (counts.failed || 0) + (counts.skipped || 0);
  }
  
  return counts;
}

// Run the test harness
runTests().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  console.error(error.stack);
  process.exit(1);
});