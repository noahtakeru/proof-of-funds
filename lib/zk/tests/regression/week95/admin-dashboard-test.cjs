const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_NAME = 'Admin Dashboard Components';
const REQUIRED_FILES = [
  'src/admin/RoleBasedAccessControl.ts',
  'src/admin/UserManagement.ts',
  'src/admin/ProofManagement.ts', 
  'src/admin/SystemConfiguration.ts',
  'src/admin/AuditLogger.ts'
];
const REQUIRED_CJS_FILES = [
  'src/admin/cjs/RoleBasedAccessControl.cjs',
  'src/admin/cjs/UserManagement.cjs',
  'src/admin/cjs/ProofManagement.cjs',
  'src/admin/cjs/SystemConfiguration.cjs',
  'src/admin/cjs/AuditLogger.cjs'
];

// Path to the zk library root
const ZK_LIB_PATH = path.resolve(__dirname, '../../..');

console.log(`Running ${TEST_NAME} regression tests...`);

let allTestsPassed = true;
let testResults = [];

// Test for file existence and minimum content requirements
function testFilesExistence() {
  console.log('Testing file existence and structure...');
  
  const requiredFileChecks = REQUIRED_FILES.map(file => {
    const filePath = path.join(ZK_LIB_PATH, file);
    const exists = fs.existsSync(filePath);
    
    if (exists) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for minimum required content based on file name
      let contentValid = true;
      let missingContent = [];
      
      if (file.includes('RoleBasedAccessControl')) {
        const requiredContent = ['enum Permission', 'hasPermission', 'assignRole'];
        requiredContent.forEach(item => {
          if (!content.includes(item)) {
            contentValid = false;
            missingContent.push(item);
          }
        });
      } else if (file.includes('UserManagement')) {
        const requiredContent = ['createUser', 'findUsers', 'assignUserRole'];
        requiredContent.forEach(item => {
          if (!content.includes(item)) {
            contentValid = false;
            missingContent.push(item);
          }
        });
      } else if (file.includes('ProofManagement')) {
        const requiredContent = ['getProofById', 'findProofs', 'invalidateProof'];
        requiredContent.forEach(item => {
          if (!content.includes(item)) {
            contentValid = false;
            missingContent.push(item);
          }
        });
      } else if (file.includes('SystemConfiguration')) {
        const requiredContent = ['getConfiguration', 'updateConfiguration', 'getConfigurationHistory'];
        requiredContent.forEach(item => {
          if (!content.includes(item)) {
            contentValid = false;
            missingContent.push(item);
          }
        });
      } else if (file.includes('AuditLogger')) {
        const requiredContent = ['logEvent', 'getAuditLogs', 'exportAuditLogs'];
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

// Test for CommonJS compatibility
function testCJSCompatibility() {
  console.log('Testing CommonJS compatibility...');
  
  const cjsFileChecks = REQUIRED_CJS_FILES.map(file => {
    const filePath = path.join(ZK_LIB_PATH, file);
    const exists = fs.existsSync(filePath);
    
    if (exists) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for module.exports (essential for CommonJS)
      const hasExports = content.includes('module.exports');
      
      return {
        file,
        exists,
        hasExports
      };
    }
    
    return {
      file,
      exists,
      hasExports: false
    };
  });
  
  return cjsFileChecks;
}

// Run tests
try {
  // Test 1: File existence and structure
  const fileResults = testFilesExistence();
  testResults.push({
    name: 'File existence and structure',
    passed: fileResults.every(r => r.exists && r.contentValid),
    details: fileResults
  });
  
  // Test 2: CommonJS compatibility
  const cjsResults = testCJSCompatibility();
  testResults.push({
    name: 'CommonJS compatibility',
    passed: cjsResults.every(r => r.exists && r.hasExports),
    details: cjsResults
  });
  
  // Calculate overall result
  allTestsPassed = testResults.every(test => test.passed);
  
  // Print test results
  console.log('\nTest Results:');
  testResults.forEach(test => {
    console.log(`${test.passed ? '✓' : '✗'} ${test.name}`);
    
    if (!test.passed) {
      console.log('  Details:');
      test.details.forEach(detail => {
        if (!detail.exists) {
          console.log(`  - Missing file: ${detail.file}`);
        } else if (detail.missingContent && detail.missingContent.length > 0) {
          console.log(`  - File ${detail.file} is missing required content: ${detail.missingContent.join(', ')}`);
        } else if (detail.hasExports === false) {
          console.log(`  - File ${detail.file} is missing module.exports`);
        }
      });
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