const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_NAME = 'Core UI Components';
const REQUIRED_FILES = [
  '/components/ZKProgressIndicator.tsx',
  '/components/ZKVerificationResult.tsx',
  '/components/CircuitSelector.tsx',
  '/components/HardwareCapabilityMonitor.tsx',
  '/components/WalletBalanceProof.tsx',
  '/components/ProgressTracker.tsx',
  '/components/TaskBreakdown.tsx',
  '/components/BackgroundProcessor.tsx',
  '/components/CancellableOperation.tsx'
];

// Required content for each component file
const REQUIRED_CONTENT = {
  'ZKProgressIndicator.tsx': [
    'progress: number',
    'status: string',
    'timeRemaining?',
    'onCancel?',
    'const ZKProgressIndicator',
    'progress bar',
    'return ('
  ],
  'ZKVerificationResult.tsx': [
    'verified: boolean',
    'proofType?',
    'proofDetails?',
    'verificationTime?',
    'const ZKVerificationResult',
    'return ('
  ],
  'CircuitSelector.tsx': [
    'selectedCircuit: string',
    'onSelectCircuit:',
    'disabled?',
    'const CircuitSelector',
    'return ('
  ],
  'HardwareCapabilityMonitor.tsx': [
    'showDetails?',
    'onServerFallbackRequest?',
    'isExpanded?',
    'onToggleExpand?',
    'const HardwareCapabilityMonitor',
    'return ('
  ],
  'WalletBalanceProof.tsx': [
    'proofData:',
    'verified: boolean',
    'proofType: ',
    'network?',
    'onVerifyAgain?',
    'const WalletBalanceProof',
    'return ('
  ],
  'ProgressTracker.tsx': [
    'steps:',
    'currentStepIndex:',
    'overallProgress:',
    'estimatedTimeRemaining?',
    'const ProgressTracker',
    'return ('
  ],
  'TaskBreakdown.tsx': [
    'tasks:',
    'proofType:',
    'showDetailedMetrics?',
    'onTaskClick?',
    'const TaskBreakdown',
    'return ('
  ],
  'BackgroundProcessor.tsx': [
    'operations:',
    'onOperationAction:',
    'onViewResult:',
    'minimized?',
    'onToggleMinimize?',
    'const BackgroundProcessor',
    'return ('
  ],
  'CancellableOperation.tsx': [
    'operationId:',
    'operationName?:',
    'cancellable:',
    'isCancelling?:',
    'onCancel:',
    'buttonSize?:',
    'buttonStyle?:',
    'const CancellableOperation',
    'return ('
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

// Test for React component type safety
function testTypeSafety() {
  console.log('Testing type safety in components...');
  
  const typeChecks = REQUIRED_FILES.map(file => {
    const filePath = path.join(PROJECT_ROOT, file);
    const exists = fs.existsSync(filePath);
    
    if (exists) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for React.FC typing and interface/type definitions
      const hasReactFC = content.includes('React.FC<') || content.includes('FC<');
      const hasPropsInterface = content.includes('interface') || content.includes('type') && content.includes(' Props');
      
      return {
        file,
        exists,
        hasReactFC,
        hasPropsInterface
      };
    }
    
    return {
      file,
      exists,
      hasReactFC: false,
      hasPropsInterface: false
    };
  });
  
  return typeChecks;
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
  
  // Test 2: Type safety
  const typeResults = testTypeSafety();
  testResults.push({
    name: 'Type safety',
    passed: typeResults.every(r => r.exists && r.hasReactFC),
    details: typeResults
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
        } else if (detail.contentValid === false && detail.missingContent && detail.missingContent.length > 0) {
          console.log(`  - File ${detail.file} is missing required content: ${detail.missingContent.join(', ')}`);
        } else if (detail.hasReactFC === false) {
          console.log(`  - File ${detail.file} is missing React.FC typing`);
        } else if (detail.hasPropsInterface === false) {
          console.log(`  - File ${detail.file} is missing Props interface/type definition`);
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