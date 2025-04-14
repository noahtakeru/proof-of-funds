/**
 * E2E Test for Wallet Connection and Proof Generation Workflow (CommonJS Version)
 * 
 * This test demonstrates how to use the E2E Testing Framework to test
 * the complete workflow from wallet connection to proof generation and verification.
 * 
 * This is the CommonJS version of the test for compatibility with non-ESM environments.
 */

const { 
  createTestSuite, 
  createTestCase,
  CommonSteps,
  createTestRunner,
  EnvironmentType
} = require('../../cjs/e2e-testing');

// Create a test suite for wallet and proof workflows
const walletProofSuite = createTestSuite({
  name: 'Wallet and Proof Workflow Tests (CJS)',
  description: 'Tests the complete workflow from wallet connection to proof generation and verification',
  testCases: [
    // Test case for standard proof generation workflow
    createTestCase({
      name: 'Standard Proof Generation Workflow',
      description: 'Test connecting wallet, generating a standard proof, and verifying it',
      tags: ['wallet', 'proof', 'standard', 'e2e'],
      steps: [
        // Connect wallet
        CommonSteps.connectWallet('Ethereum'),
        
        // Generate standard proof
        CommonSteps.generateProof('standard', {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          threshold: 1000,
          tokenAddress: '0xabcdef1234567890abcdef1234567890abcdef12'
        }),
        
        // Verify proof off-chain
        CommonSteps.verifyProof(false),
        
        // Create transaction for on-chain verification
        CommonSteps.createTransaction('proofVerification', {
          contract: '0x9876543210abcdef9876543210abcdef98765432',
          method: 'verifyProof'
        }),
        
        // Submit transaction
        CommonSteps.submitTransaction(),
        
        // Wait for confirmation
        CommonSteps.waitForConfirmation(15000)
      ],
      defaultStepTimeoutMs: 30000,
      setup: async () => {
        // Setup for this specific test case
        console.log('Setting up Standard Proof test case');
      },
      teardown: async () => {
        // Cleanup after this specific test case
        console.log('Tearing down Standard Proof test case');
      },
      collectMetrics: {
        proofGenerationTime: true,
        verificationTime: true,
        memoryUsage: true,
        networkTime: true
      }
    }),
    
    // Test case for threshold proof generation workflow
    createTestCase({
      name: 'Threshold Proof Generation Workflow',
      description: 'Test connecting wallet, generating a threshold proof, and verifying it',
      tags: ['wallet', 'proof', 'threshold', 'e2e'],
      steps: [
        // Connect wallet
        CommonSteps.connectWallet('Ethereum'),
        
        // Generate threshold proof
        CommonSteps.generateProof('threshold', {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          threshold: 5000,
          tokenAddress: '0xabcdef1234567890abcdef1234567890abcdef12'
        }),
        
        // Verify proof off-chain
        CommonSteps.verifyProof(false),
        
        // Create transaction for on-chain verification
        CommonSteps.createTransaction('proofVerification', {
          contract: '0x9876543210abcdef9876543210abcdef98765432',
          method: 'verifyProof'
        }),
        
        // Submit transaction
        CommonSteps.submitTransaction(),
        
        // Wait for confirmation
        CommonSteps.waitForConfirmation(15000)
      ],
      defaultStepTimeoutMs: 30000,
      collectMetrics: {
        proofGenerationTime: true,
        verificationTime: true
      }
    }),
    
    // Test case for maximum proof generation workflow
    createTestCase({
      name: 'Maximum Proof Generation Workflow',
      description: 'Test connecting wallet, generating a maximum proof, and verifying it',
      tags: ['wallet', 'proof', 'maximum', 'e2e'],
      steps: [
        // Connect wallet
        CommonSteps.connectWallet('Ethereum'),
        
        // Generate maximum proof
        CommonSteps.generateProof('maximum', {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          hiddenAmount: true,
          tokenAddress: '0xabcdef1234567890abcdef1234567890abcdef12'
        }),
        
        // Verify proof off-chain
        CommonSteps.verifyProof(false),
        
        // Create transaction for on-chain verification
        CommonSteps.createTransaction('proofVerification', {
          contract: '0x9876543210abcdef9876543210abcdef98765432',
          method: 'verifyProof'
        }),
        
        // Submit transaction
        CommonSteps.submitTransaction(),
        
        // Wait for confirmation
        CommonSteps.waitForConfirmation(15000)
      ],
      defaultStepTimeoutMs: 30000,
      collectMetrics: {
        proofGenerationTime: true,
        verificationTime: true
      }
    })
  ]
});

// Define environments to test in
const testEnvironments = [
  {
    name: 'Desktop Chrome',
    environmentType: EnvironmentType.BROWSER,
    features: {
      webAssembly: true,
      webWorkers: true,
      indexedDb: true,
      localStorage: true
    },
    mockServer: true,
    mockWallet: true,
    devicePerformance: 'high',
    storage: 'persistent'
  },
  {
    name: 'Mobile Safari (Low Memory)',
    environmentType: EnvironmentType.MOBILE_BROWSER,
    features: {
      webAssembly: true,
      webWorkers: false,
      indexedDb: true,
      localStorage: true
    },
    mockServer: true,
    mockWallet: true,
    networkLatency: 100,
    networkReliability: 0.9,
    devicePerformance: 'low',
    storage: 'temporary'
  },
  {
    name: 'Server Node.js',
    environmentType: EnvironmentType.SERVER,
    features: {
      webAssembly: true,
      webWorkers: false,
      indexedDb: false,
      localStorage: false
    },
    mockServer: false,
    mockWallet: true,
    devicePerformance: 'high',
    storage: 'persistent'
  }
];

// Create a test runner that outputs JSON and Markdown reports
const runner = createTestRunner({
  reportFormats: ['json', 'markdown', 'console'],
  outputDir: './reports/e2e',
  silent: false
});

// Register the test suite
runner.registerTestSuite(walletProofSuite);

// Run tests when this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      const result = await runner.runTests({
        suites: ['Wallet and Proof Workflow Tests (CJS)'],
        environments: testEnvironments,
        concurrency: 2,
        timeoutMs: 60000,
        retryCount: 1,
        tags: ['e2e']
      });
      
      console.log(`Test run completed with ${result.summary.passedTests}/${result.summary.totalTests} tests passing`);
      process.exit(0);
    } catch (error) {
      console.error('Error running tests:', error);
      process.exit(1);
    }
  })();
}

// Export for use in other tests
module.exports = { walletProofSuite, testEnvironments, runner };