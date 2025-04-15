const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_NAME = 'Error Handling UI';
const REQUIRED_FILES = [
  '/components/ZKErrorDisplay.tsx',
  '/components/ErrorRecoveryFlow.tsx',
  '/components/TroubleshootingWizard.tsx',
  '/lib/zk/src/UserPreferences.ts'
];

// Required content for each component file
const REQUIRED_CONTENT = {
  'ZKErrorDisplay.tsx': [
    'error: {',
    'message:',
    'code?:',
    'severity?:',
    'details?:',
    'recoverable?:',
    'recommendedAction?:',
    'technicalDetails?:',
    'onRetry?:',
    'onDismiss?:',
    'showTechnicalDetails?:',
    'const ZKErrorDisplay',
    'return ('
  ],
  'ErrorRecoveryFlow.tsx': [
    'error:',
    'onRecoveryAction:',
    'onCancel:',
    'showTechnicalDetails?:',
    'const ErrorRecoveryFlow',
    'return ('
  ],
  'TroubleshootingWizard.tsx': [
    'issueCategory:',
    'isOpen:',
    'onClose:',
    'onResolved:',
    'const TroubleshootingWizard',
    'return ('
  ],
  'UserPreferences.ts': [
    'get',
    'set',
    'update',
    'resetAll',
    'reset',
    'getAll',
    'DEFAULTS'
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

// Test for error severity enum definition
function testErrorSeverityEnum() {
  console.log('Testing error severity enum definition...');
  
  const errorDisplayFile = path.join(PROJECT_ROOT, '/components/ZKErrorDisplay.tsx');
  if (!fs.existsSync(errorDisplayFile)) {
    return {
      exists: false,
      hasEnum: false
    };
  }
  
  const content = fs.readFileSync(errorDisplayFile, 'utf8');
  
  // Check for enum ErrorSeverity or type ErrorSeverity
  const hasEnum = (content.includes('enum ErrorSeverity') || content.includes('type ErrorSeverity')) &&
                 (content.includes('Critical') || content.includes('Error') || content.includes('Warning') || content.includes('Info'));
  
  return {
    exists: true,
    hasEnum
  };
}

// Test for user preferences persistence
function testUserPreferencesPersistence() {
  console.log('Testing user preferences persistence...');
  
  const userPrefsFile = path.join(PROJECT_ROOT, '/lib/zk/src/UserPreferences.ts');
  if (!fs.existsSync(userPrefsFile)) {
    return {
      exists: false,
      hasStorage: false,
      hasVersioning: false
    };
  }
  
  const content = fs.readFileSync(userPrefsFile, 'utf8');
  
  // Check for storage mechanisms and versioning
  const hasStorage = content.includes('localStorage') || content.includes('sessionStorage') || 
                    content.includes('IndexedDB') || content.includes('window.localStorage');
  const hasVersioning = content.includes('version') || content.includes('schemaVersion');
  
  return {
    exists: true,
    hasStorage,
    hasVersioning
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
  
  // Test 2: Error severity enum
  const enumResult = testErrorSeverityEnum();
  testResults.push({
    name: 'Error severity enum',
    passed: enumResult.exists && enumResult.hasEnum,
    details: enumResult
  });
  
  // Test 3: User preferences persistence
  const prefResult = testUserPreferencesPersistence();
  testResults.push({
    name: 'User preferences persistence',
    passed: prefResult.exists && prefResult.hasStorage,
    details: prefResult
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
          console.log(`  - Missing required file`);
        } else if (!test.details.hasEnum) {
          console.log(`  - Missing ErrorSeverity enum/type definition`);
        } else if (!test.details.hasStorage) {
          console.log(`  - Missing storage mechanism implementation`);
        } else if (!test.details.hasVersioning) {
          console.log(`  - Missing versioning in user preferences`);
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