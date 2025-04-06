/**
 * Browser Compatibility Test Script
 * 
 * This script demonstrates how to use the browserCompatibility module
 * to detect and adapt to different browser environments.
 * 
 * To run this script:
 * node --input-type=module -e "import './lib/zk/__tests__/browser-compatibility-test.js'"
 * 
 * Or in the browser, include it as a module:
 * <script type="module" src="./lib/zk/__tests__/browser-compatibility-test.js"></script>
 * 
 * Note: This script displays different output depending on whether it's running in 
 * a browser or Node.js environment. In Node.js, some browser-specific features
 * will be reported as unavailable, which is expected.
 */

import browserCompatibility from '../browserCompatibility.js';

// Define a self-executing async function to run the tests
(async function runBrowserCompatibilityTest() {
  console.log('=== Browser Compatibility System Test ===');
  
  // Check if running in Node.js or browser
  const isNode = typeof process !== 'undefined' && 
                 process.versions && 
                 process.versions.node;
                 
  if (isNode) {
    console.log('\nRunning in Node.js environment (version ' + process.versions.node + ')');
    console.log('Note: Some browser-specific features will be reported as unavailable.');
  } else {
    console.log('\nRunning in browser environment');
  }
  
  // Detect all features and capabilities
  console.log('\n1. Detecting browser features and capabilities...');
  const capabilities = browserCompatibility.detectFeatures();
  
  // Display browser information
  console.log('\n2. Browser Information:');
  console.log(`  Browser: ${capabilities.browser.name} ${capabilities.browser.version}`);
  console.log(`  Mobile Device: ${capabilities.browser.isMobile ? 'Yes' : 'No'}`);
  console.log(`  Meets Minimum Requirements: ${capabilities.browser.isSupported ? 'Yes' : 'No'}`);
  
  // Display feature support
  console.log('\n3. Feature Support:');
  Object.entries(capabilities.features).forEach(([feature, supported]) => {
    console.log(`  ${feature}: ${supported ? '✓ Supported' : '✗ Not supported'}`);
  });
  
  // Display performance scores
  console.log('\n4. Performance Scores (0-100):');
  Object.entries(capabilities.performance).forEach(([metric, score]) => {
    // Format score as integer percentage
    const formattedScore = Math.round(score);
    console.log(`  ${metric}: ${formattedScore}%`);
  });
  
  // Display compatibility assessment
  console.log('\n5. Compatibility Assessment:');
  console.log(`  Compatibility Level: ${capabilities.compatibility.level}`);
  console.log(`  Recommended Execution Path: ${capabilities.compatibility.recommendedPath}`);
  
  // Display known issues if any
  console.log('\n6. Known Issues:');
  if (capabilities.compatibility.issues.length > 0) {
    capabilities.compatibility.issues.forEach((issue, index) => {
      console.log(`  Issue ${index + 1}: ${issue}`);
    });
  } else {
    console.log('  No known issues detected');
  }
  
  // Display degradation paths
  console.log('\n7. Available Execution Strategies:');
  Object.entries(capabilities.degradationPath).forEach(([path, info]) => {
    console.log(`  ${path}:`);
    console.log(`    Available: ${info.available ? 'Yes' : 'No'}`);
    console.log(`    Recommended: ${info.recommended ? 'Yes' : 'No'}`);
    console.log(`    Description: ${info.description}`);
  });
  
  // Demonstrate specific feature checks
  console.log('\n8. Specific Feature Checks:');
  console.log(`  SharedArrayBuffer: ${browserCompatibility.isFeatureSupported('sharedArrayBuffer') ? 'Supported' : 'Not supported'}`);
  console.log(`  BigInt: ${browserCompatibility.isFeatureSupported('bigInt') ? 'Supported' : 'Not supported'}`);
  
  // Get browser requirements
  console.log('\n9. Browser Requirements:');
  const requirements = browserCompatibility.getBrowserRequirements();
  console.log('  Minimum Chrome Version:', requirements.minimumVersions.chrome);
  console.log('  Minimum Firefox Version:', requirements.minimumVersions.firefox);
  console.log('  Minimum Safari Version:', requirements.minimumVersions.safari);
  
  // Example of adapting behavior based on capabilities
  console.log('\n10. Adaptive Behavior Example:');
  
  function getOptimalExecutionStrategy(capabilities) {
    switch (capabilities.compatibility.recommendedPath) {
      case 'clientSide':
        return 'Full client-side execution with all optimizations enabled';
      case 'webWorker':
        return 'Offloading heavy computations to Web Workers for parallel processing';
      case 'progressiveLoading':
        return 'Using progressive loading to handle memory constraints';
      case 'hybrid':
        return 'Using hybrid client/server approach for balanced execution';
      case 'serverSide':
        return 'Falling back to server-side execution due to device limitations';
      default:
        return 'Unknown strategy';
    }
  }
  
  console.log(`  Selected Strategy: ${getOptimalExecutionStrategy(capabilities)}`);
  
  // Run WebAssembly benchmark
  console.log('\n11. WebAssembly Benchmark:');
  const wasmBenchmark = browserCompatibility.benchmarkWebAssembly();
  console.log(`  Execution Time: ${wasmBenchmark.executionTime.toFixed(2)}ms`);
  console.log(`  Score: ${wasmBenchmark.score.toFixed(2)}/100`);
  
  // Get historical performance if available
  console.log('\n12. Performance History:');
  const history = browserCompatibility.getPerformanceHistory();
  if (history && history.length > 0) {
    console.log(`  ${history.length} historical entries found`);
    console.log(`  Last recorded: ${new Date(history[history.length - 1].timestamp).toLocaleString()}`);
  } else {
    console.log('  No historical data available');
  }
  
  console.log('\n=== Test Complete ===');
})();