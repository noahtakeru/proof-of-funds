const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_NAME = 'GCP/BigQuery Integration';
const REQUIRED_FILES = [
  'src/analytics/GCPSecretManager.ts',
  'src/analytics/BigQueryAnalytics.ts'
];
const REQUIRED_CJS_FILES = [
  'src/analytics/cjs/GCPSecretManager.cjs',
  'src/analytics/cjs/BigQueryAnalytics.cjs'
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
      
      if (file.includes('GCPSecretManager')) {
        const requiredContent = ['getSecret', 'createSecret', 'rotateSecret', 'deleteSecret'];
        requiredContent.forEach(item => {
          if (!content.includes(item)) {
            contentValid = false;
            missingContent.push(item);
          }
        });
      } else if (file.includes('BigQueryAnalytics')) {
        const requiredContent = ['trackEvent', 'getReportData', 'streamData', 'manageETLJob'];
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

// Test for BigQuery Schema Management
function testBigQuerySchemaManagement() {
  console.log('Testing BigQuery schema management...');
  
  const filePath = path.join(ZK_LIB_PATH, 'src/analytics/BigQueryAnalytics.ts');
  
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    const hasSchemaManagement = 
      content.includes('createTable') && 
      content.includes('updateSchema') && 
      content.includes('SchemaField');
      
    return {
      feature: 'BigQuery Schema Management',
      implemented: hasSchemaManagement
    };
  }
  
  return {
    feature: 'BigQuery Schema Management',
    implemented: false
  };
}

// Test for ETL Job Management
function testETLJobManagement() {
  console.log('Testing ETL job management...');
  
  const filePath = path.join(ZK_LIB_PATH, 'src/analytics/BigQueryAnalytics.ts');
  
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    const hasETLJobManagement = 
      content.includes('manageETLJob') && 
      content.includes('scheduleETLJob') && 
      content.includes('transform');
      
    return {
      feature: 'ETL Job Management',
      implemented: hasETLJobManagement
    };
  }
  
  return {
    feature: 'ETL Job Management',
    implemented: false
  };
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
  
  // Test 3: BigQuery Schema Management
  const schemaResult = testBigQuerySchemaManagement();
  testResults.push({
    name: 'BigQuery Schema Management',
    passed: schemaResult.implemented,
    details: [schemaResult]
  });
  
  // Test 4: ETL Job Management
  const etlResult = testETLJobManagement();
  testResults.push({
    name: 'ETL Job Management',
    passed: etlResult.implemented,
    details: [etlResult]
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
        if (detail.file && !detail.exists) {
          console.log(`  - Missing file: ${detail.file}`);
        } else if (detail.missingContent && detail.missingContent.length > 0) {
          console.log(`  - File ${detail.file} is missing required content: ${detail.missingContent.join(', ')}`);
        } else if (detail.hasExports === false) {
          console.log(`  - File ${detail.file} is missing module.exports`);
        } else if (detail.feature && !detail.implemented) {
          console.log(`  - Feature not implemented: ${detail.feature}`);
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