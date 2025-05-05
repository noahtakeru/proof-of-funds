/**
 * Circuit Testing Implementation Tests
 * 
 * This file implements tests for the ZK circuit testing framework and runs tests
 * against the actual circuit implementations.
 */

import { CircuitTester, testMultipleCircuits } from './testing/circuitTestingFramework';

// List of circuits to test
const CIRCUIT_NAMES = ['standardProof', 'thresholdProof', 'maximumProof'];

describe('Circuit Testing Framework', () => {
  // Test the framework itself
  test('should initialize CircuitTester correctly', () => {
    const tester = new CircuitTester({ circuitName: 'standardProof' });
    expect(tester).toBeDefined();
    expect(tester.circuitName).toBe('standardProof');
    expect(tester.circuitPath).toContain('standardProof.circom');
  });
  
  test('should detect security properties in circuits', async () => {
    const tester = new CircuitTester({ circuitName: 'standardProof' });
    const securityProperties = tester.analyzeSecurityProperties();
    
    expect(securityProperties).toBeDefined();
    // At minimum, secure circuits should have some form of verification
    expect(securityProperties.hasEqualityConstraint || 
           securityProperties.hasComparisonOperation).toBe(true);
    // Should use cryptographic primitives for security
    expect(securityProperties.usesCryptographicPrimitives || 
           securityProperties.usesHashFunction).toBe(true);
  });
});

describe('StandardProof Circuit', () => {
  let tester;
  
  beforeAll(() => {
    tester = new CircuitTester({ circuitName: 'standardProof' });
  });
  
  test('should have appropriate number of constraints', async () => {
    const constraintCount = await tester.countConstraints();
    expect(constraintCount).toBeGreaterThan(0);
    // StandardProof should be relatively simple
    expect(constraintCount).toBeLessThan(10000);
  });
  
  test('should pass test with valid input', async () => {
    const result = await tester.runTest();
    expect(result.success).toBe(true);
    expect(result.circuit).toBe('standardProof');
    expect(result.proof).toBeDefined();
  });
  
  test('should fail test with invalid input', async () => {
    const result = await tester.runInvalidInputTest();
    expect(result.success).toBe(true); // Test success means the circuit rejected invalid input
    expect(result.invalidInputRejected).toBe(true);
  });
  
  test('should verify security properties', async () => {
    const securityProps = tester.analyzeSecurityProperties();
    
    // Standard proof must implement equality checks
    expect(securityProps.hasEqualityConstraint).toBe(true);
    
    // Should use cryptographic primitives for security
    expect(securityProps.usesCryptographicPrimitives || 
           securityProps.usesHashFunction).toBe(true);
  });
});

describe('ThresholdProof Circuit', () => {
  let tester;
  
  beforeAll(() => {
    tester = new CircuitTester({ circuitName: 'thresholdProof' });
  });
  
  test('should have appropriate number of constraints', async () => {
    const constraintCount = await tester.countConstraints();
    expect(constraintCount).toBeGreaterThan(0);
    // ThresholdProof has more complex logic than StandardProof
    expect(constraintCount).toBeLessThan(15000);
  });
  
  test('should pass test with valid input', async () => {
    const result = await tester.runTest();
    expect(result.success).toBe(true);
    expect(result.circuit).toBe('thresholdProof');
    expect(result.proof).toBeDefined();
  });
  
  test('should fail test with invalid input', async () => {
    const result = await tester.runInvalidInputTest();
    expect(result.success).toBe(true); // Test success means the circuit rejected invalid input
    expect(result.invalidInputRejected).toBe(true);
  });
  
  test('should verify security properties', async () => {
    const securityProps = tester.analyzeSecurityProperties();
    
    // Threshold proof must implement comparison operations
    expect(securityProps.hasComparisonOperation).toBe(true);
    
    // Should use cryptographic primitives for security
    expect(securityProps.usesCryptographicPrimitives || 
           securityProps.usesHashFunction).toBe(true);
  });
});

describe('MaximumProof Circuit', () => {
  let tester;
  
  beforeAll(() => {
    tester = new CircuitTester({ circuitName: 'maximumProof' });
  });
  
  test('should have appropriate number of constraints', async () => {
    const constraintCount = await tester.countConstraints();
    expect(constraintCount).toBeGreaterThan(0);
    // MaximumProof has more complex logic than StandardProof
    expect(constraintCount).toBeLessThan(15000);
  });
  
  test('should pass test with valid input', async () => {
    const result = await tester.runTest();
    expect(result.success).toBe(true);
    expect(result.circuit).toBe('maximumProof');
    expect(result.proof).toBeDefined();
  });
  
  test('should fail test with invalid input', async () => {
    const result = await tester.runInvalidInputTest();
    expect(result.success).toBe(true); // Test success means the circuit rejected invalid input
    expect(result.invalidInputRejected).toBe(true);
  });
  
  test('should verify security properties', async () => {
    const securityProps = tester.analyzeSecurityProperties();
    
    // Maximum proof must implement comparison operations
    expect(securityProps.hasComparisonOperation).toBe(true);
    
    // Should use cryptographic primitives for security
    expect(securityProps.usesCryptographicPrimitives || 
           securityProps.usesHashFunction).toBe(true);
  });
});

describe('Multi-Circuit Test Suite', () => {
  test('should test all circuits and aggregate results', async () => {
    const results = await testMultipleCircuits(CIRCUIT_NAMES);
    
    expect(results.summary.total).toBe(CIRCUIT_NAMES.length);
    expect(results.summary.passed + results.summary.failed).toBe(CIRCUIT_NAMES.length);
    
    // Each circuit should have results
    for (const circuitName of CIRCUIT_NAMES) {
      expect(results.circuits[circuitName]).toBeDefined();
      expect(results.circuits[circuitName].circuit).toBe(circuitName);
    }
  });
});