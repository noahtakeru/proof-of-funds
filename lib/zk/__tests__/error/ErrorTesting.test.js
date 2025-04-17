/**
 * Error Testing Framework Tests
 * 
 * This file implements tests for the ZK error testing framework and runs tests
 * against the actual error handling implementation.
 */

import { 
  ErrorTestFactory, 
  ErrorType, 
  ErrorSeverity, 
  ErrorTestSuite 
} from './ErrorTestingFramework';

// Import modules that we want to test
import { zkErrorHandler } from '../../src/zkErrorHandler';
import { zkErrorLogger } from '../../src/zkErrorLogger';

// Define some validation functions to test
const validateProofInput = (input) => {
  if (!input) {
    throw new Error('Input is required');
  }
  
  if (typeof input !== 'object') {
    throw new Error('Input must be an object');
  }
  
  if (!input.circuit) {
    throw new Error('Circuit name is required');
  }
  
  if (!input.inputs || typeof input.inputs !== 'object') {
    throw new Error('Circuit inputs are required and must be an object');
  }
  
  return { valid: true };
};

// Cryptographic function to test
const verifyProof = async (input) => {
  if (!input) {
    throw new Error('Input is required for proof verification');
  }
  
  if (!input.proof || !input.publicSignals) {
    throw new Error('Proof and public signals are required');
  }
  
  // Check the structure of the proof
  if (!input.proof.pi_a || !input.proof.pi_b || !input.proof.pi_c) {
    throw new Error('Invalid proof structure');
  }
  
  // Simulate verification logic
  return { verified: true };
};

// Security function to test
const checkProofSecurity = (input) => {
  if (!input) {
    throw new Error('Input is required for security check');
  }
  
  // Check for common attack vectors
  if (input.proof && input.proof.pi_a && input.proof.pi_a.includes('0x00000000')) {
    throw new Error('Security check: Zero value detected in proof, potential forgery');
  }
  
  if (input.circuit && input.circuit.includes('../')) {
    throw new Error('Security check: Path traversal attempt detected');
  }
  
  if (input.inputs && JSON.stringify(input.inputs).includes('__proto__')) {
    throw new Error('Security check: Prototype pollution attempt detected');
  }
  
  return { secure: true };
};

// Resource-intensive function to test
const generateLargeProof = async (input) => {
  return new Promise((resolve, reject) => {
    // Simulate a computationally intensive task
    let result = 0;
    const iterations = input.complexity || 1000000;
    
    for (let i = 0; i < iterations; i++) {
      result += Math.sin(i);
    }
    
    // If complexity is set very high, this may timeout
    resolve({ result });
  });
};

// Interoperability functions to test
const generateProofData = (input) => {
  return {
    proof: {
      pi_a: ['123', '456', '1'],
      pi_b: [['789', '012'], ['345', '678'], ['1', '0']],
      pi_c: ['901', '234', '1']
    },
    publicSignals: [input.publicValue.toString()]
  };
};

const verifyProofData = (data) => {
  if (!data.proof || !data.proof.pi_a || !data.proof.pi_b || !data.proof.pi_c) {
    throw new Error('Invalid proof structure');
  }
  
  if (!data.publicSignals || !Array.isArray(data.publicSignals)) {
    throw new Error('Public signals must be an array');
  }
  
  return { verified: true };
};

describe('Error Testing Framework', () => {
  test('should create different types of error tests', () => {
    const validationTest = ErrorTestFactory.createValidationTest({
      name: 'Basic Input Validation',
      description: 'Test basic input validation',
      invalidInput: null,
      validationFunction: validateProofInput
    });
    
    expect(validationTest).toBeDefined();
    expect(validationTest.type).toBe(ErrorType.VALIDATION);
    
    const cryptoTest = ErrorTestFactory.createCryptographicTest({
      name: 'Proof Verification',
      description: 'Test proof verification with invalid proof',
      cryptoFunction: verifyProof,
      invalidInput: { proof: null, publicSignals: [] }
    });
    
    expect(cryptoTest).toBeDefined();
    expect(cryptoTest.type).toBe(ErrorType.CRYPTOGRAPHIC);
    
    const securityTest = ErrorTestFactory.createSecurityTest({
      name: 'Zero Value Attack',
      description: 'Test detection of zero value attack',
      securityFunction: checkProofSecurity,
      maliciousInput: { proof: { pi_a: ['0x00000000'] } }
    });
    
    expect(securityTest).toBeDefined();
    expect(securityTest.type).toBe(ErrorType.SECURITY);
  });
  
  test('should execute validation error test', async () => {
    const validationTest = ErrorTestFactory.createValidationTest({
      name: 'Null Input Test',
      description: 'Test validation with null input',
      invalidInput: null,
      validationFunction: validateProofInput,
      expectedError: 'Input is required'
    });
    
    const result = await validationTest.execute();
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.errorOccurred).toBe(true);
    expect(result.actualError).toBe('Input is required');
  });
  
  test('should execute cryptographic error test', async () => {
    const cryptoTest = ErrorTestFactory.createCryptographicTest({
      name: 'Invalid Proof Structure',
      description: 'Test verification with invalid proof structure',
      cryptoFunction: verifyProof,
      invalidInput: { proof: {}, publicSignals: [] },
      expectedError: 'Invalid proof structure'
    });
    
    const result = await cryptoTest.execute();
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.errorOccurred).toBe(true);
    expect(result.actualError).toContain('Invalid proof structure');
  });
  
  test('should execute security error test', async () => {
    const securityTest = ErrorTestFactory.createSecurityTest({
      name: 'Path Traversal Attack',
      description: 'Test detection of path traversal',
      securityFunction: checkProofSecurity,
      maliciousInput: { circuit: '../../../etc/passwd' },
      expectedError: 'Path traversal'
    });
    
    const result = await securityTest.execute();
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.errorOccurred).toBe(true);
    expect(result.actualError).toContain('Path traversal');
    expect(result.attackDetails).toBeDefined();
  });
  
  test('should execute resource error test', async () => {
    // Using a small value to make the test pass quickly
    const resourceTest = ErrorTestFactory.createResourceTest({
      name: 'Proof Generation Resources',
      description: 'Test resource limits for proof generation',
      resourceFunction: generateLargeProof,
      resourceInput: { complexity: 10 }, // Very small for unit tests
      resourceLimits: {
        timeoutMs: 5000 // 5 second timeout
      }
    });
    
    const result = await resourceTest.execute();
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
  
  test('should execute interoperability error test', async () => {
    const interopTest = ErrorTestFactory.createInteroperabilityTest({
      name: 'Proof Generation to Verification',
      description: 'Test interoperability between generation and verification',
      sourceFunction: generateProofData,
      targetFunction: verifyProofData,
      testInput: { publicValue: 42 }
    });
    
    const result = await interopTest.execute();
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.interoperable).toBe(true);
  });
  
  test('should run a test suite', async () => {
    const suite = new ErrorTestSuite({
      name: 'Basic Error Test Suite',
      description: 'Tests basic error handling'
    });
    
    // Add various tests to the suite
    suite.addTests([
      ErrorTestFactory.createValidationTest({
        name: 'Missing Circuit Test',
        description: 'Test validation with missing circuit',
        invalidInput: { inputs: {} },
        validationFunction: validateProofInput,
        expectedError: 'Circuit name is required'
      }),
      ErrorTestFactory.createCryptographicTest({
        name: 'Missing Proof Test',
        description: 'Test verification with missing proof',
        cryptoFunction: verifyProof,
        invalidInput: { publicSignals: [] },
        expectedError: 'Proof and public signals are required'
      }),
      ErrorTestFactory.createSecurityTest({
        name: 'Prototype Pollution Attack',
        description: 'Test detection of prototype pollution',
        securityFunction: checkProofSecurity,
        maliciousInput: { inputs: { '__proto__': { isAdmin: true } } },
        expectedError: 'Prototype pollution'
      })
    ]);
    
    const results = await suite.run();
    
    expect(results).toBeDefined();
    expect(results.summary.total).toBe(3);
    expect(results.summary.passed).toBeGreaterThanOrEqual(2); // At least 2 should pass
    expect(results.tests.length).toBe(3);
  });
});

describe('ZK Error Handler Integration', () => {
  test('should handle validation errors', async () => {
    // Create a test with the real ZK error handler
    const validationTest = ErrorTestFactory.createValidationTest({
      name: 'ZK Validation Test',
      description: 'Test ZK error handler with validation error',
      invalidInput: { invalid: true },
      validationFunction: (input) => {
        try {
          if (!input || !input.circuit) {
            const error = new Error('Invalid circuit input');
            return zkErrorHandler.handleError(error, {
              type: 'validation',
              input
            });
          }
          return { valid: true };
        } catch (error) {
          return zkErrorHandler.handleError(error, {
            type: 'validation',
            input
          });
        }
      }
    });
    
    validationTest.setErrorHandler((error, context) => {
      return zkErrorHandler.handleError(error, {
        ...context,
        type: 'validation'
      });
    });
    
    const result = await validationTest.execute();
    
    expect(result).toBeDefined();
    expect(result.errorOccurred).toBe(true);
  });
  
  test('should handle cryptographic errors', async () => {
    // Create a test with the real ZK error handler
    const cryptoTest = ErrorTestFactory.createCryptographicTest({
      name: 'ZK Crypto Test',
      description: 'Test ZK error handler with cryptographic error',
      cryptoFunction: async (input) => {
        try {
          if (!input || !input.proof) {
            const error = new Error('Invalid proof structure');
            throw zkErrorHandler.handleError(error, {
              type: 'cryptographic',
              input
            });
          }
          return { verified: true };
        } catch (error) {
          throw zkErrorHandler.handleError(error, {
            type: 'cryptographic',
            input
          });
        }
      },
      invalidInput: { invalid: true }
    });
    
    const result = await cryptoTest.execute();
    
    expect(result).toBeDefined();
    expect(result.errorOccurred).toBe(true);
  });
});

describe('ZK Error Logger Integration', () => {
  // Mock console methods
  const originalConsoleError = console.error;
  const mockConsoleError = jest.fn();
  
  beforeAll(() => {
    console.error = mockConsoleError;
  });
  
  afterAll(() => {
    console.error = originalConsoleError;
  });
  
  beforeEach(() => {
    mockConsoleError.mockClear();
  });
  
  test('should log validation errors', async () => {
    // Create a test that uses the error logger
    const validationTest = ErrorTestFactory.createValidationTest({
      name: 'Logger Validation Test',
      description: 'Test ZK error logger with validation error',
      invalidInput: null,
      validationFunction: (input) => {
        try {
          if (!input) {
            const error = new Error('Input is required');
            zkErrorLogger.logError(error, {
              type: 'validation',
              component: 'test'
            });
            throw error;
          }
          return { valid: true };
        } catch (error) {
          zkErrorLogger.logError(error, {
            type: 'validation',
            component: 'test'
          });
          throw error;
        }
      }
    });
    
    const result = await validationTest.execute();
    
    expect(result).toBeDefined();
    expect(result.errorOccurred).toBe(true);
    expect(mockConsoleError).toHaveBeenCalled();
  });
  
  test('should log security errors with high severity', async () => {
    // Create a security test that uses the error logger
    const securityTest = ErrorTestFactory.createSecurityTest({
      name: 'Logger Security Test',
      description: 'Test ZK error logger with security error',
      securityFunction: (input) => {
        try {
          if (input && input.malicious) {
            const error = new Error('Security violation detected');
            zkErrorLogger.logError(error, {
              type: 'security',
              component: 'test',
              severity: 'critical'
            });
            throw error;
          }
          return { secure: true };
        } catch (error) {
          zkErrorLogger.logError(error, {
            type: 'security',
            component: 'test',
            severity: 'critical'
          });
          throw error;
        }
      },
      maliciousInput: { malicious: true }
    });
    
    const result = await securityTest.execute();
    
    expect(result).toBeDefined();
    expect(result.errorOccurred).toBe(true);
    expect(mockConsoleError).toHaveBeenCalled();
    
    // Check that the error was logged with the correct severity
    const errorCalls = mockConsoleError.mock.calls;
    const hasCriticalError = errorCalls.some(call => 
      call.some(arg => typeof arg === 'string' && arg.includes('critical'))
    );
    
    expect(hasCriticalError).toBe(true);
  });
});