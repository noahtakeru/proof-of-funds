# End-to-End Integration Testing Framework Guide

## Overview

The End-to-End Integration Testing Framework provides a comprehensive solution for testing the complete Proof of Funds application workflow across different environments and configurations. This framework allows for testing critical user paths, from wallet connection to proof generation and verification, in a consistent and repeatable manner.

## Features

- **Multi-environment Testing**: Test your application across different environments (browser, mobile, server) with different capabilities and limitations.
- **Workflow-based Testing**: Define test cases as sequences of steps that follow real user workflows.
- **Detailed Reporting**: Get comprehensive reports on test execution, including performance metrics and environment-specific breakdowns.
- **Performance Metrics**: Collect detailed performance metrics for different operations, like proof generation and verification times.
- **Environment Simulation**: Simulate different device performance levels, network conditions, and storage capabilities.
- **ESM and CommonJS Support**: Compatible with both ESM and CommonJS module systems for maximum compatibility.

## Architecture

The framework consists of the following components:

1. **TestEnvironmentManager**: Manages test environments with different configurations, simulating various platforms and capabilities.
2. **E2ETestRunner**: Orchestrates test execution across different environments, handling concurrency and timeouts.
3. **WorkflowExecutor**: Executes test workflows as sequences of steps, handling success/failure and performance measurement.
4. **E2EReporter**: Generates detailed reports in various formats (JSON, Markdown, HTML, console).
5. **TestDefinitions**: Provides interfaces and helpers for defining test suites, cases, and steps.

## Getting Started

### 1. Define a Test Suite

First, define a test suite with one or more test cases:

```javascript
import { 
  createTestSuite, 
  createTestCase,
  CommonSteps
} from '../src/e2e-testing';

const myTestSuite = createTestSuite({
  name: 'My Test Suite',
  description: 'Test critical user workflows',
  testCases: [
    createTestCase({
      name: 'Connect Wallet and Generate Proof',
      description: 'Tests connecting a wallet and generating a proof',
      tags: ['wallet', 'proof', 'e2e'],
      steps: [
        // Connect wallet
        CommonSteps.connectWallet('Ethereum'),
        
        // Generate proof
        CommonSteps.generateProof('standard', {
          walletAddress: '0x1234567890abcdef',
          threshold: 1000
        }),
        
        // Verify proof
        CommonSteps.verifyProof(false)
      ]
    })
  ]
});
```

### 2. Define Test Environments

Define the environments you want to test in:

```javascript
import { EnvironmentType } from '../src/e2e-testing';

const testEnvironments = [
  {
    name: 'Desktop Chrome',
    environmentType: EnvironmentType.BROWSER,
    features: {
      webAssembly: true,
      webWorkers: true,
      indexedDb: true
    },
    devicePerformance: 'high'
  },
  {
    name: 'Mobile Safari',
    environmentType: EnvironmentType.MOBILE_BROWSER,
    features: {
      webAssembly: true,
      webWorkers: false,
      indexedDb: true
    },
    networkLatency: 100,
    devicePerformance: 'low'
  }
];
```

### 3. Create a Test Runner

Create a test runner and register your test suite:

```javascript
import { createTestRunner } from '../src/e2e-testing';

const runner = createTestRunner({
  reportFormats: ['json', 'markdown', 'console'],
  outputDir: './reports/e2e'
});

runner.registerTestSuite(myTestSuite);
```

### 4. Run Tests

Run the tests with the specified configuration:

```javascript
const result = await runner.runTests({
  suites: ['My Test Suite'],
  environments: testEnvironments,
  concurrency: 2,
  timeoutMs: 60000,
  retryCount: 1,
  tags: ['e2e']
});

console.log(`Tests completed: ${result.summary.passedTests}/${result.summary.totalTests} passed`);
```

## Custom Test Steps

While the framework provides common test steps, you can define custom steps for specific testing needs:

```javascript
const myCustomStep = {
  name: 'My Custom Step',
  execute: async (report, stepReport) => {
    try {
      // Perform the step actions
      const result = await someOperation();
      
      // Record data about the step
      stepReport.data = { result };
      
      // Return true for success, false for failure
      return true;
    } catch (error) {
      stepReport.failureReason = error.message;
      return false;
    }
  }
};
```

## Integration with CI/CD

The framework can be integrated with CI/CD pipelines to automate end-to-end testing:

1. Add a script to your package.json:

```json
{
  "scripts": {
    "test:e2e": "node lib/zk/__tests__/e2e/runAllTests.js"
  }
}
```

2. Create a runner script that executes all E2E tests:

```javascript
// lib/zk/__tests__/e2e/runAllTests.js
import { runner as walletProofRunner } from './walletProofWorkflow.test';
// Import other test runners...

async function runAllTests() {
  try {
    // Run all test suites
    await walletProofRunner.runTests({
      suites: ['Wallet and Proof Workflow Tests'],
      environments: [...],
      concurrency: 2
    });
    
    // Run other test suites...
    
    console.log('All E2E tests completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('E2E test run failed:', error);
    process.exit(1);
  }
}

runAllTests();
```

3. Configure your CI/CD pipeline to run the E2E tests after unit and integration tests.

## Performance Testing

The framework includes built-in support for performance testing:

1. Enable performance metrics collection in your test case:

```javascript
createTestCase({
  name: 'Performance Test',
  // ...
  collectMetrics: {
    proofGenerationTime: true,
    verificationTime: true,
    memoryUsage: true,
    networkTime: true
  }
})
```

2. Review performance metrics in the generated reports.

## Best Practices

1. **Isolate Tests**: Each test case should be independent and not rely on the state from other test cases.
2. **Use Tags**: Tag your tests to organize them by feature, priority, or type.
3. **Monitor Performance**: Regularly review performance metrics to catch regressions.
4. **Test All Environments**: Ensure your tests cover all supported environments and edge cases.
5. **Use Mocks Judiciously**: Use mocks for external dependencies, but keep core logic real.
6. **Version Your Tests**: Keep your tests versioned alongside your code.
7. **Maintain Test Data**: Keep test data up to date and representative of real-world scenarios.

## Troubleshooting

### Common Issues

1. **Tests Timeout**: If tests timeout, check the timeoutMs parameter or increase step timeouts.
2. **Environment Setup Fails**: Ensure the environment configuration is valid and supported.
3. **Report Generation Errors**: Check write permissions for the output directory.

### Debugging Tips

1. Set the `silent` option to `false` for verbose console output:

```javascript
const runner = createTestRunner({
  silent: false
});
```

2. Use the `tags` parameter to run specific tests during debugging:

```javascript
await runner.runTests({
  // ...
  tags: ['debug']
});
```

3. Review test reports for detailed error information.

## Conclusion

The End-to-End Integration Testing Framework provides a powerful and flexible solution for testing the complete Proof of Funds application across different environments. By defining test cases as workflows, you can ensure that critical user paths work correctly and performantly, while detailed reporting helps identify issues early in the development process.