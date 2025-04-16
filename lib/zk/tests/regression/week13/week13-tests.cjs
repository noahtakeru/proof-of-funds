/**
 * Week 13 Regression Tests
 * 
 * This script runs all Week 13 regression tests to ensure the comprehensive testing
 * infrastructure is working correctly.
 */

const path = require('path');
const integrationTests = require('./integration-test.cjs');

/**
 * Run all Week 13 regression tests
 */
function runAllWeek13Tests() {
  console.log('\n🧪 Running Week 13 Comprehensive Testing Infrastructure Tests');
  
  // Run integration testing framework tests
  const integrationResults = integrationTests.runAllTests();
  
  // Collect all results
  const allTests = { integrationTests: integrationResults };
  
  // Calculate overall success
  const success = Object.values(allTests).every(Boolean);
  
  console.log(`\n${success ? '✅ All Week 13 tests passed!' : '❌ Some Week 13 tests failed!'}`);
  
  return success;
}

module.exports = {
  runAllWeek13Tests
};

// Run the tests if this script is executed directly
if (require.main === module) {
  const success = runAllWeek13Tests();
  process.exit(success ? 0 : 1);
}