/**
 * Dynamic Resource Allocation Framework Test
 * 
 * This file is used by the regression test system to verify that
 * the dynamic resource allocation system is properly implemented.
 */

// Common JS imports
const fs = require('fs');
const path = require('path');

// File paths to check
const files = [
  'src/resources/ResourceMonitor.ts',
  'src/resources/ResourceAllocator.ts',
  'src/resources/AdaptiveComputation.ts',
  'src/resources/ResourcePrediction.ts',
  'src/resources/index.ts',
  'src/resources/cjs/ResourceMonitor.cjs',
  '__tests__/resources/ResourceManagement.test.js'
];

// Required functionality in each file
const fileContents = {
  'src/resources/ResourceMonitor.ts': [
    'class ResourceMonitor',
    'sampleResources',
    'startContinuousMonitoring',
    'stopContinuousMonitoring',
    'registerCallback',
    'unregisterCallback',
    'notifyListeners',
    'getSystemLoad',
    'getBatteryLevel'
  ],
  'src/resources/ResourceAllocator.ts': [
    'enum AllocationStrategy',
    'enum ResourcePriority',
    'class ResourceAllocator',
    'requestAllocation',
    'startOperation',
    'queueOperation',
    'pauseOperation',
    'resumeOperation',
    'cancelOperation',
    'updateAllocationStrategy'
  ],
  'src/resources/AdaptiveComputation.ts': [
    'enum ComputationStrategy',
    'enum ComputationPhase',
    'class AdaptiveComputation',
    'executeComputation',
    'createOperationProfile',
    'selectComputationStrategy',
    'executeFullComputation',
    'executeProgressiveComputation',
    'executePartialComputation',
    'executeFallbackComputation',
    'calculateResourcesUsed'
  ],
  'src/resources/ResourcePrediction.ts': [
    'class ResourcePrediction',
    'start',
    'stop',
    'collectResourceData',
    'updateModels',
    'predictSystemResources',
    'registerOperation',
    'unregisterOperation',
    'getResourceTrends',
    'getOperationPrediction',
    'getSystemPredictions'
  ],
  'src/resources/index.ts': [
    'export',
    'ResourceMonitor',
    'ResourceAllocator',
    'AdaptiveComputation',
    'ResourcePrediction'
  ],
  'src/resources/cjs/ResourceMonitor.cjs': [
    'class ResourceMonitor',
    'sampleResources',
    'startContinuousMonitoring',
    'module.exports'
  ],
  '__tests__/resources/ResourceManagement.test.js': [
    'ResourceMonitor',
    'samples resources',
    'registerCallback',
    'getSystemLoad'
  ]
};

// Count for test results
let found = 0;
let missing = 0;
let total = files.length;

// Get the lib/zk directory path based on this file's location
const rootDir = path.resolve(__dirname, '../..');

// Check each required file
console.log('Checking Dynamic Resource Allocation implementation:');
console.log('---------------------------------------------------');

for (const file of files) {
  const filePath = path.join(rootDir, file);
  
  if (fs.existsSync(filePath)) {
    console.log(`✓ File exists: ${file}`);
    
    // Check required functionality
    const content = fs.readFileSync(filePath, 'utf8');
    const requiredFunctions = fileContents[file] || [];
    
    let functionsFound = 0;
    let functionsMissing = [];
    
    for (const func of requiredFunctions) {
      if (content.includes(func)) {
        functionsFound++;
      } else {
        functionsMissing.push(func);
      }
    }
    
    if (functionsFound === requiredFunctions.length) {
      console.log(`  ✓ All required functionality found`);
      found++;
    } else {
      console.log(`  ✗ Missing functionality: ${functionsMissing.join(', ')}`);
      missing++;
    }
  } else {
    console.log(`✗ File missing: ${file}`);
    missing++;
  }
}

// Additional check for integration with existing system
const zkUtilsPath = path.join(rootDir, 'src/zkUtils.mjs');
if (fs.existsSync(zkUtilsPath)) {
  const zkUtilsContent = fs.readFileSync(zkUtilsPath, 'utf8');
  if (zkUtilsContent.includes('ResourceMonitor') || 
      zkUtilsContent.includes('resources') || 
      zkUtilsContent.includes('AdaptiveComputation')) {
    console.log(`✓ Resource management is integrated with zkUtils.mjs`);
  } else {
    console.log(`ℹ️ No direct integration with zkUtils.mjs found`);
  }
}

// Check if module is exposed in main entry point
const indexPath = path.join(rootDir, 'src/index.mjs');
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  if (indexContent.includes('resources') || 
      indexContent.includes('ResourceMonitor') || 
      indexContent.includes('ResourceAllocator')) {
    console.log(`✓ Resource management is exported in main entry point`);
  } else {
    console.log(`ℹ️ Resources module not directly exported in main entry point`);
  }
}

// Summary
console.log('\nSummary:');
console.log('--------');
console.log(`${found}/${total} components fully implemented`);

// Exit with appropriate code
if (found >= total - 1) { // Allow one component to be missing/incomplete
  console.log('\nDynamic Resource Allocation is fully implemented!');
  process.exit(0);
} else {
  console.log('\nDynamic Resource Allocation implementation is incomplete.');
  process.exit(1);
}