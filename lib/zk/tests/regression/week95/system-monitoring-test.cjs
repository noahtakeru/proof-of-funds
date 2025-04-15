const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_NAME = 'System Monitoring & Reporting';
const REQUIRED_FILES = [
  'src/monitoring/SystemMonitor.ts',
  'src/monitoring/AlertManager.ts',
  'src/monitoring/ExecutiveDashboard.ts'
];
const REQUIRED_CJS_FILES = [
  'src/monitoring/cjs/SystemMonitor.cjs',
  'src/monitoring/cjs/AlertManager.cjs',
  'src/monitoring/cjs/ExecutiveDashboard.cjs'
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
      
      if (file.includes('SystemMonitor')) {
        const requiredContent = ['registerMetric', 'trackMetric', 'getMetricHistory', 'setThresholdAlert'];
        requiredContent.forEach(item => {
          if (!content.includes(item)) {
            contentValid = false;
            missingContent.push(item);
          }
        });
      } else if (file.includes('AlertManager')) {
        const requiredContent = ['createAlert', 'acknowledgeAlert', 'resolveAlert', 'getAlertStatistics'];
        requiredContent.forEach(item => {
          if (!content.includes(item)) {
            contentValid = false;
            missingContent.push(item);
          }
        });
      } else if (file.includes('ExecutiveDashboard')) {
        const requiredContent = ['generateDashboardReport', 'getKPIStatus', 'scheduleReport'];
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

// Test for Alert Escalation Policy
function testAlertEscalationPolicy() {
  console.log('Testing alert escalation policy...');
  
  const filePath = path.join(ZK_LIB_PATH, 'src/monitoring/AlertManager.ts');
  
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    const hasEscalationPolicy = 
      content.includes('EscalationPolicy') && 
      content.includes('escalateAlert') && 
      content.includes('NotificationChannel');
      
    return {
      feature: 'Alert Escalation Policy',
      implemented: hasEscalationPolicy
    };
  }
  
  return {
    feature: 'Alert Escalation Policy',
    implemented: false
  };
}

// Test for Executive Dashboard Report Generation
function testReportGeneration() {
  console.log('Testing executive dashboard report generation...');
  
  const filePath = path.join(ZK_LIB_PATH, 'src/monitoring/ExecutiveDashboard.ts');
  
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    const hasReportGeneration = 
      content.includes('generateDashboardReport') && 
      content.includes('ReportFormat') && 
      (content.includes('HTML') || content.includes('PDF') || content.includes('JSON'));
      
    return {
      feature: 'Executive Dashboard Report Generation',
      implemented: hasReportGeneration
    };
  }
  
  return {
    feature: 'Executive Dashboard Report Generation',
    implemented: false
  };
}

// Test for Event Emitter Integration
function testEventEmitterIntegration() {
  console.log('Testing event emitter integration...');
  
  const monitorPath = path.join(ZK_LIB_PATH, 'src/monitoring/SystemMonitor.ts');
  const alertPath = path.join(ZK_LIB_PATH, 'src/monitoring/AlertManager.ts');
  
  if (fs.existsSync(monitorPath) && fs.existsSync(alertPath)) {
    const monitorContent = fs.readFileSync(monitorPath, 'utf8');
    const alertContent = fs.readFileSync(alertPath, 'utf8');
    
    const hasEventEmitterInMonitor = 
      monitorContent.includes('EventEmitter') && 
      monitorContent.includes('emit(');
      
    const hasEventEmitterInAlert = 
      alertContent.includes('EventEmitter') && 
      alertContent.includes('emit(');
      
    return {
      feature: 'Event Emitter Integration',
      implemented: hasEventEmitterInMonitor && hasEventEmitterInAlert
    };
  }
  
  return {
    feature: 'Event Emitter Integration',
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
  
  // Test 3: Alert Escalation Policy
  const escalationResult = testAlertEscalationPolicy();
  testResults.push({
    name: 'Alert Escalation Policy',
    passed: escalationResult.implemented,
    details: [escalationResult]
  });
  
  // Test 4: Executive Dashboard Report Generation
  const reportResult = testReportGeneration();
  testResults.push({
    name: 'Executive Dashboard Report Generation',
    passed: reportResult.implemented,
    details: [reportResult]
  });
  
  // Test 5: Event Emitter Integration
  const eventEmitterResult = testEventEmitterIntegration();
  testResults.push({
    name: 'Event Emitter Integration',
    passed: eventEmitterResult.implemented,
    details: [eventEmitterResult]
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