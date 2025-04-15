const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_NAME = 'Multi-Device Testing';
const REQUIRED_FILES = [
  '/lib/zk/docs/implementation/testing/DesktopBrowserTesting.md',
  '/lib/zk/docs/implementation/testing/MobileBrowserTesting.md', 
  '/lib/zk/docs/implementation/testing/LowPowerDeviceTesting.md',
  '/lib/zk/src/DeviceOptimizations.ts',
  '/lib/zk/src/ProgressiveEnhancement.ts'
];

// Required content for each file
const REQUIRED_CONTENT = {
  'DesktopBrowserTesting.md': [
    '# Desktop Browser Testing',
    'Chrome',
    'Firefox',
    'Safari',
    'Edge',
    'Performance',
    'Test Results'
  ],
  'MobileBrowserTesting.md': [
    '# Mobile Browser Testing',
    'iOS Safari',
    'Android Chrome',
    'Performance',
    'Battery Impact',
    'Test Results'
  ],
  'LowPowerDeviceTesting.md': [
    '# Low-Power Device Testing',
    'Memory Usage',
    'CPU Usage',
    'Battery Consumption',
    'Fallback Strategy',
    'Test Results'
  ],
  'DeviceOptimizations.ts': [
    'class DeviceOptimizations',
    'getDeviceScore',
    'getDeviceTier',
    'getOptimizationStrategy',
    'shouldEnableFeature'
  ],
  'ProgressiveEnhancement.ts': [
    'class ProgressiveEnhancement',
    'isFeatureAvailable',
    'getFeatureFallback',
    'getOptimalUIComponent',
    'requiresServerFallback'
  ]
};

// Path to the project root
const PROJECT_ROOT = path.resolve(__dirname, '../../../../../');

console.log(`Running ${TEST_NAME} regression tests...`);

let allTestsPassed = true;
let testResults = [];

// Test for file existence and minimum content requirements
function testFilesExistence() {
  console.log('Testing file existence and structure...');
  
  const requiredFileChecks = REQUIRED_FILES.map(file => {
    const filePath = path.join(PROJECT_ROOT, file);
    const exists = fs.existsSync(filePath);
    
    if (exists) {
      const content = fs.readFileSync(filePath, 'utf8');
      const filename = path.basename(file);
      
      // Check for minimum required content
      let contentValid = true;
      let missingContent = [];
      
      // Check against required content specific to this file
      const requiredContent = REQUIRED_CONTENT[filename];
      if (requiredContent) {
        requiredContent.forEach(item => {
          if (!content.includes(item)) {
            contentValid = false;
            missingContent.push(item);
          }
        });
      }
      
      return {
        file,
        exists,
        contentValid,
        missingContent
      };
    }
    
    return {
      file,
      exists,
      contentValid: false,
      missingContent: ['File does not exist']
    };
  });
  
  return requiredFileChecks;
}

// Test for device tier definition
function testDeviceTierDefinition() {
  console.log('Testing device tier definition...');
  
  const deviceOptsFile = path.join(PROJECT_ROOT, '/lib/zk/src/DeviceOptimizations.ts');
  if (!fs.existsSync(deviceOptsFile)) {
    return {
      exists: false,
      hasTiers: false
    };
  }
  
  const content = fs.readFileSync(deviceOptsFile, 'utf8');
  
  // Check for enum DeviceTier or interface DeviceTier
  const hasTiers = (content.includes('enum DeviceTier') || content.includes('type DeviceTier')) &&
                  (content.includes('HighEnd') || content.includes('MidRange') || content.includes('LowEnd') || 
                   content.includes('High') || content.includes('Medium') || content.includes('Low'));
  
  return {
    exists: true,
    hasTiers
  };
}

// Test for feature flags implementation
function testFeatureFlags() {
  console.log('Testing feature flags implementation...');
  
  const progressiveEnhancementFile = path.join(PROJECT_ROOT, '/lib/zk/src/ProgressiveEnhancement.ts');
  if (!fs.existsSync(progressiveEnhancementFile)) {
    return {
      exists: false,
      hasFeatureFlags: false
    };
  }
  
  const content = fs.readFileSync(progressiveEnhancementFile, 'utf8');
  
  // Check for feature flags interface/type and definitions
  const hasFeatureFlags = (content.includes('interface FeatureFlags') || 
                          content.includes('type FeatureFlags') || 
                          content.includes('const FeatureFlags')) &&
                          content.includes('shouldEnableFeature');
  
  return {
    exists: true,
    hasFeatureFlags
  };
}

// Test for comprehensive test coverage
function testComprehensiveTestCoverage() {
  console.log('Testing comprehensive test coverage...');
  
  const docFiles = [
    path.join(PROJECT_ROOT, '/lib/zk/docs/implementation/testing/DesktopBrowserTesting.md'),
    path.join(PROJECT_ROOT, '/lib/zk/docs/implementation/testing/MobileBrowserTesting.md'),
    path.join(PROJECT_ROOT, '/lib/zk/docs/implementation/testing/LowPowerDeviceTesting.md')
  ];
  
  let fileExistCount = 0;
  let hasResults = true;
  
  docFiles.forEach(file => {
    if (fs.existsSync(file)) {
      fileExistCount++;
      const content = fs.readFileSync(file, 'utf8');
      
      // Check if test results are documented
      if (!content.includes('Test Results') || !content.includes('|') || !content.includes('---')) {
        hasResults = false;
      }
    }
  });
  
  return {
    exists: fileExistCount === docFiles.length,
    hasResults
  };
}

// Run the tests
try {
  // Test 1: File existence and structure
  const fileResults = testFilesExistence();
  testResults.push({
    name: 'File existence and structure',
    passed: fileResults.every(r => r.exists && r.contentValid),
    details: fileResults
  });
  
  // Test 2: Device tier definition
  const tierResult = testDeviceTierDefinition();
  testResults.push({
    name: 'Device tier definition',
    passed: tierResult.exists && tierResult.hasTiers,
    details: tierResult
  });
  
  // Test 3: Feature flags implementation
  const flagsResult = testFeatureFlags();
  testResults.push({
    name: 'Feature flags implementation',
    passed: flagsResult.exists && flagsResult.hasFeatureFlags,
    details: flagsResult
  });
  
  // Test 4: Comprehensive test coverage
  const coverageResult = testComprehensiveTestCoverage();
  testResults.push({
    name: 'Comprehensive test coverage',
    passed: coverageResult.exists && coverageResult.hasResults,
    details: coverageResult
  });
  
  // Calculate overall result
  allTestsPassed = testResults.every(test => test.passed);
  
  // Print test results
  console.log('\nTest Results:');
  testResults.forEach(test => {
    console.log(`${test.passed ? '✓' : '✗'} ${test.name}`);
    
    if (!test.passed) {
      console.log('  Details:');
      if (test.details instanceof Array) {
        test.details.forEach(detail => {
          if (!detail.exists) {
            console.log(`  - Missing file: ${detail.file}`);
          } else if (detail.contentValid === false && detail.missingContent && detail.missingContent.length > 0) {
            console.log(`  - File ${detail.file} is missing required content: ${detail.missingContent.join(', ')}`);
          }
        });
      } else {
        if (!test.details.exists) {
          console.log(`  - Missing required files`);
        } else if (!test.details.hasTiers) {
          console.log(`  - Missing DeviceTier enum/type definition`);
        } else if (!test.details.hasFeatureFlags) {
          console.log(`  - Missing FeatureFlags implementation or shouldEnableFeature method`);
        } else if (!test.details.hasResults) {
          console.log(`  - Missing test results in documentation`);
        }
      }
    }
  });
  
} catch (error) {
  console.error('Test execution failed:', error);
  allTestsPassed = false;
}

// Final result
console.log(`\n${allTestsPassed ? '✓' : '✗'} ${TEST_NAME} regression tests ${allTestsPassed ? 'PASSED' : 'FAILED'}`);

// Exit with appropriate code
process.exit(allTestsPassed ? 0 : 1);