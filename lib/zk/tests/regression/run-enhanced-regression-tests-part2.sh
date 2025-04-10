#!/bin/bash

# This is part 2 of the Enhanced Regression Tests - append to part 1

# Test error handling
run_error_handling_tests() {
  print_header "Error Handling Tests"
  
  # Create test directory
  TEMP_TEST_DIR=$(mktemp -d)
  TEMP_TEST_FILE="${TEMP_TEST_DIR}/error-handling-test.js"
  
  # Create error handling test
  cat > "$TEMP_TEST_FILE" << 'EOL'
// Enhanced Error Handling Tests
const assert = require('assert');

// Import modules
try {
  const zkErrorHandler = require('../../src/zkErrorHandler.js');
  const zkUtils = require('../../src/zkUtils.js');
  const zkProofSerializer = require('../../src/zkProofSerializer.js');
  
  // Check ZKError classes
  console.log('Testing ZKError classes...');
  assert(zkErrorHandler.ZKError, 'ZKError class should exist');
  assert(zkErrorHandler.InputError, 'InputError class should exist');
  assert(zkErrorHandler.ProofError, 'ProofError class should exist');
  assert(zkErrorHandler.VerificationError, 'VerificationError class should exist');
  
  // Test error creation
  const testError = new zkErrorHandler.InputError('Test error message', {
    code: zkErrorHandler.ErrorCode.INPUT_MISSING_REQUIRED,
    operationId: 'test_operation',
    recoverable: true,
    details: { test: true }
  });
  
  assert(testError instanceof Error, 'ZKError should be instance of Error');
  assert(testError instanceof zkErrorHandler.ZKError, 'InputError should be instance of ZKError');
  assert(testError.code === zkErrorHandler.ErrorCode.INPUT_MISSING_REQUIRED, 'Error should have correct code');
  assert(testError.operationId === 'test_operation', 'Error should have correct operationId');
  assert(testError.recoverable === true, 'Error should have correct recoverable flag');
  assert(testError.details.test === true, 'Error should have correct details');
  
  // Test serialization with invalid inputs
  try {
    zkUtils.serializeZKProof(null, []);
    console.error('Error: zkUtils.serializeZKProof should throw for null proof');
    process.exit(1);
  } catch (error) {
    assert(error instanceof zkErrorHandler.ZKError, 'Should throw ZKError for null proof');
    console.log('✓ zkUtils.serializeZKProof correctly throws ZKError for null proof');
  }
  
  // Test deserialization with invalid inputs
  try {
    zkUtils.deserializeZKProof('invalid-json', []);
    console.error('Error: zkUtils.deserializeZKProof should throw for invalid JSON');
    process.exit(1);
  } catch (error) {
    assert(error instanceof zkErrorHandler.ZKError, 'Should throw ZKError for invalid JSON');
    console.log('✓ zkUtils.deserializeZKProof correctly throws ZKError for invalid JSON');
  }
  
  console.log('✓ All error handling tests passed!');
} catch (error) {
  console.error('Error in error handling tests:', error);
  process.exit(1);
}
EOL

  # Run the error handling test
  print_task "Running Error Handling Tests"
  track_enhanced_test
  
  if node "$TEMP_TEST_FILE"; then
    print_pass "Error Handling Tests Passed"
    total_enhanced_passed=$((total_enhanced_passed + 1))
  else
    print_fail "Error Handling Tests Failed"
  fi
  
  # Clean up
  rm -rf "$TEMP_TEST_DIR"
}

# Run headless browser test if puppeteer is available
run_browser_compatibility_test() {
  print_header "Browser Compatibility Tests"
  
  # Create test directory
  TEMP_TEST_DIR=$(mktemp -d)
  TEMP_TEST_FILE="${TEMP_TEST_DIR}/browser-test.js"
  
  # Create browser test script
  cat > "$TEMP_TEST_FILE" << 'EOL'
// Browser compatibility test using Puppeteer
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Create a simple HTML file for testing
const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>ZK Browser Compatibility Test</title>
</head>
<body>
  <h1>ZK Browser Compatibility Test</h1>
  <div id="result"></div>
  <script type="module">
    // Try importing ESM modules
    try {
      const moduleUrl = new URL('../../src/zkUtils.mjs', window.location.href);
      import(moduleUrl.href)
        .then(module => {
          document.getElementById('result').textContent = 'ESM Module loaded successfully';
          window.testResult = 'SUCCESS';
        })
        .catch(error => {
          document.getElementById('result').textContent = 'Error loading ESM module: ' + error.message;
          window.testResult = 'FAILURE';
          window.testError = error.message;
        });
    } catch (error) {
      document.getElementById('result').textContent = 'Error setting up module import: ' + error.message;
      window.testResult = 'FAILURE';
      window.testError = error.message;
    }
  </script>
</body>
</html>
`;

async function runBrowserTest() {
  // Create test HTML file
  const htmlPath = path.join(__dirname, 'browser-test.html');
  fs.writeFileSync(htmlPath, testHtml);
  
  let browser;
  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // Set up console logging
    page.on('console', msg => console.log('Browser console:', msg.text()));
    
    // Navigate to test page
    await page.goto('file://' + htmlPath);
    
    // Wait for result
    await page.waitForFunction('window.testResult !== undefined', { timeout: 5000 });
    
    // Get test result
    const testResult = await page.evaluate(() => window.testResult);
    const testError = await page.evaluate(() => window.testError || '');
    
    if (testResult === 'SUCCESS') {
      console.log('✓ Browser compatibility test passed!');
      return true;
    } else {
      console.error('✗ Browser compatibility test failed:', testError);
      return false;
    }
  } catch (error) {
    console.error('Error running browser test:', error);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
    // Clean up
    if (fs.existsSync(htmlPath)) {
      fs.unlinkSync(htmlPath);
    }
  }
}

// Run the test
runBrowserTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unhandled error in browser test:', error);
    process.exit(1);
  });
EOL

  # Check if puppeteer is available
  if npm list puppeteer --depth=0 &> /dev/null || npm list -g puppeteer --depth=0 &> /dev/null; then
    print_task "Running Browser Compatibility Tests"
    track_enhanced_test
    
    if node "$TEMP_TEST_FILE"; then
      print_pass "Browser Compatibility Tests Passed"
      total_enhanced_passed=$((total_enhanced_passed + 1))
    else
      print_fail "Browser Compatibility Tests Failed"
    fi
  else
    print_info "Skipping browser compatibility tests (puppeteer not available)"
  fi
  
  # Clean up
  rm -rf "$TEMP_TEST_DIR"
}

# Run stress tests
run_stress_tests() {
  print_header "Performance and Stress Tests"
  
  # Create test directory
  TEMP_TEST_DIR=$(mktemp -d)
  TEMP_TEST_FILE="${TEMP_TEST_DIR}/stress-test.js"
  
  # Create stress test
  cat > "$TEMP_TEST_FILE" << 'EOL'
// Performance and stress tests
const zkUtils = require('../../src/zkUtils.js');

// Memory usage tracking
function trackMemoryUsage() {
  const memUsage = process.memoryUsage();
  return {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  };
}

// Performance test for serialization
console.log('Running serialization performance test...');
const iterations = 100;
const startMem = trackMemoryUsage();
console.log(`Initial memory usage: ${JSON.stringify(startMem)} MB`);

// Create test proof with increasing complexity
const testProof = {
  pi_a: Array(50).fill(0).map((_, i) => i.toString()),
  pi_b: Array(50).fill(0).map((_, i) => [i.toString(), (i * 2).toString()]),
  pi_c: Array(50).fill(0).map((_, i) => i.toString()),
  protocol: 'test'
};
const testSignals = Array(100).fill(0).map((_, i) => i.toString());

// Time the serialization
console.log(`Serializing ${iterations} proofs of increasing size...`);
console.time('Serialization');
let lastProof = testProof;
let results = [];

try {
  for (let i = 0; i < iterations; i++) {
    // Increase proof complexity on each iteration
    if (i > 0 && i % 10 === 0) {
      lastProof.pi_a.push(...lastProof.pi_a.map(x => x + i));
      lastProof.pi_c.push(...lastProof.pi_c.map(x => x + i));
      testSignals.push(...testSignals.map(x => x + i));
    }
    
    const serialized = zkUtils.serializeZKProof(lastProof, testSignals);
    results.push(serialized);
  }
  console.timeEnd('Serialization');
  
  // Check memory usage
  const endMem = trackMemoryUsage();
  console.log(`Final memory usage: ${JSON.stringify(endMem)} MB`);
  console.log(`Memory increase: RSS: ${endMem.rss - startMem.rss} MB, Heap: ${endMem.heapUsed - startMem.heapUsed} MB`);
  
  // Time the deserialization
  console.log('\nDeserializing all proofs...');
  console.time('Deserialization');
  for (const serialized of results) {
    zkUtils.deserializeZKProof(serialized.proof, serialized.publicSignals);
  }
  console.timeEnd('Deserialization');
  
  console.log('✓ Stress test completed successfully!');
} catch (error) {
  console.error('Stress test failed:', error);
  process.exit(1);
}
EOL

  # Run the stress test
  print_task "Running Performance and Stress Tests"
  track_enhanced_test
  
  if node "$TEMP_TEST_FILE"; then
    print_pass "Performance and Stress Tests Passed"
    total_enhanced_passed=$((total_enhanced_passed + 1))
  else
    print_fail "Performance and Stress Tests Failed"
  fi
  
  # Clean up
  rm -rf "$TEMP_TEST_DIR"
}

# Run all enhanced tests
run_error_handling_tests
run_browser_compatibility_test
run_stress_tests

# Final summary
print_header "Enhanced Regression Test Summary"
echo "End time: $(date)"
echo -e "\n${PURPLE}Enhanced Tests:${NC} ${total_enhanced_passed}/${total_enhanced_tests} tests passed ($(( (total_enhanced_passed * 100) / (total_enhanced_tests == 0 ? 1 : total_enhanced_tests) ))%)"
echo -e "${BLUE}Original Tests:${NC} ${total_passed}/${total_tests} tests passed ($(( (total_passed * 100) / (total_tests == 0 ? 1 : total_tests) ))%)"
echo -e "${GREEN}Combined:${NC} $(( total_enhanced_passed + total_passed ))/$(( total_enhanced_tests + total_tests )) tests passed ($(( ((total_enhanced_passed + total_passed) * 100) / ((total_enhanced_tests + total_tests) == 0 ? 1 : (total_enhanced_tests + total_tests)) ))%)"

echo -e "\nIf all tests passed, the ZK infrastructure is working correctly and functionally verified."
echo "For any failures, check the specific test output and error messages."

# Instructions for running the enhanced tests
print_header "Running Instructions"
echo -e "To run these enhanced regression tests again, use the following commands:\n"
echo "  cd $(pwd)"
echo "  ./lib/zk/tests/regression/run-enhanced-regression-tests.sh"

# If executed as standalone, exit with success if all tests passed
exit $(( total_enhanced_passed < total_enhanced_tests ? 1 : 0 )) 