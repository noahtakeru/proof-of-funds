/**
 * Week 11 Regression Test Runner
 * This script runs all tests for Week 11 UI Components implementation
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Define color codes for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

// Test configuration
const tests = [
  {
    name: 'Core UI Components',
    script: path.join(__dirname, 'core-ui-components-test.cjs')
  },
  {
    name: 'Error Handling UI',
    script: path.join(__dirname, 'error-handling-ui-test.cjs')
  },
  {
    name: 'Multi-Device Testing',
    script: path.join(__dirname, 'multi-device-test.cjs')
  }
];

// Counters
let totalTests = tests.length;
let passedTests = 0;

console.log(`${BLUE}======================================${RESET}`);
console.log(`${BLUE}Week 11 Regression Tests${RESET}`);
console.log(`${BLUE}======================================${RESET}`);
console.log(`Running ${totalTests} test suites at ${new Date().toISOString()}`);

// Run each test
tests.forEach((test, index) => {
  console.log(`\n${YELLOW}[${index + 1}/${totalTests}] Running: ${test.name}${RESET}`);
  
  try {
    execSync(`node "${test.script}"`, { stdio: 'inherit' });
    console.log(`${GREEN}✓ ${test.name} passed${RESET}`);
    passedTests++;
    test.passed = true;
  } catch (error) {
    console.log(`${RED}✗ ${test.name} failed${RESET}`);
    test.passed = false;
    // We don't need to print the error as it was already printed by stdio: 'inherit'
  }
});

// Print summary
console.log(`\n${BLUE}======================================${RESET}`);
console.log(`${BLUE}Week 11 Regression Test Summary${RESET}`);
console.log(`${BLUE}======================================${RESET}`);
console.log(`Tests: ${passedTests}/${totalTests} passed (${Math.round((passedTests/totalTests)*100)}%)`);

// Create summary report
const reportDate = new Date().toISOString().replace(/:/g, '-');
const reportDir = path.join(__dirname, '../reports');
const reportPath = path.join(reportDir, `week11-regression-report-${reportDate}.json`);

// Ensure reports directory exists
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

// Create the report
const report = {
  date: new Date().toISOString(),
  totalTests,
  passedTests,
  testResults: tests.map(test => ({
    name: test.name,
    script: test.script,
    passed: test.passed
  }))
};

// Write report to file
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`Report saved to: ${reportPath}`);

// Exit with appropriate code
process.exit(passedTests === totalTests ? 0 : 1);