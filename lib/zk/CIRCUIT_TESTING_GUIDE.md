# Circuit Testing Guide

This document provides an overview of the comprehensive testing strategy for zero-knowledge proof circuits in the Proof of Funds system. This testing approach was implemented as part of Week 5 Task 2.

## Testing Approach

Our circuit testing is structured around four main categories:

1. **Constraint Satisfaction Tests**
   - Verify all constraints are properly enforced
   - Test boundary conditions
   - Ensure cryptographic soundness

2. **Edge Case Input Testing**
   - Test with zero values
   - Test with maximum representable values
   - Test with invalid inputs to verify rejection

3. **Symbolic Execution & Logical Contradiction Tests**
   - Analyze for logical contradictions
   - Validate cryptographic assumptions
   - Check for security vulnerabilities

4. **Cross-Circuit Isolation & Differential Testing**
   - Verify no information leakage between circuits
   - Test circuit independence
   - Ensure no shared vulnerabilities
   - Compare different circuit versions

## Test Files

We have implemented the following test files:

- `circuitConstraintSatisfaction.test.js`: Tests for proper constraint enforcement across all circuits
- `circuitEdgeCaseSymbolic.test.js`: Tests edge cases and performs symbolic analysis
- `circuitDifferentialTesting.test.js`: Compares different circuit versions
- `circuitOptimization.test.js`: Tests that circuits meet optimization targets

## Running Tests

To run the circuit tests:

```bash
# Run all circuit tests
npm test -- --testPathPattern=lib/zk/__tests__/circuits

# Run a specific test file
npm test -- --testPathPattern=lib/zk/__tests__/circuits/circuitConstraintSatisfaction.test.js
```

## Simplified Testing (No Dependencies Required)

For quick validation of the circuit logic without installing additional dependencies:

```bash
cd /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk
node test-circuits.cjs
```

This script validates the circuit logic using the test input files without requiring circom or snarkjs installation.

## Complete Testing (Requires Circom & SnarkJS)

For complete testing including compilation, proof generation, and verification:

1. Install Circom and SnarkJS:
```bash
npm install -g circom
npm install -g snarkjs
```

2. Clone the repository (if you haven't already):
```bash
git clone https://github.com/yourusername/proof-of-funds.git
cd proof-of-funds
```

### Step 1: Build the Circuits

```bash
cd lib/zk
node scripts/build-circuits.js
```

This will compile all three circuit types (standardProof, thresholdProof, maximumProof) and generate the necessary files in the `build` directory.

### Step 2: Check Constraint Count

After building, check the constraint count in the generated info files:

```bash
cat build/standardProof_info.json
cat build/thresholdProof_info.json
cat build/maximumProof_info.json
```

Verify that the constraint counts meet our targets:
- Standard Proof: <10,000 constraints
- Threshold Proof: <15,000 constraints
- Maximum Proof: <15,000 constraints

## Test Inputs

The tests use inputs from the `lib/zk/test-inputs/` directory. Each circuit has:

- `standardProof_input.json`: Valid input for standard proof
- `standardProof_invalid.json`: Invalid input for standard proof
- `thresholdProof_input.json`: Valid input for threshold proof
- `thresholdProof_invalid.json`: Invalid input for threshold proof
- `maximumProof_input.json`: Valid input for maximum proof
- `maximumProof_invalid.json`: Invalid input for maximum proof

### Sample Test Input for Standard Proof

```json
{
  "address": "0x123456789012345678901234567890123456789a",
  "amount": "1000000000000000000",
  "nonce": "123456789",
  "actualBalance": "1000000000000000000",
  "signature": ["123456789", "987654321"],
  "walletSecret": "987654321"
}
```

### Sample Invalid Test Input for Standard Proof

```json
{
  "address": "0x123456789012345678901234567890123456789a",
  "amount": "1000000000000000000",
  "nonce": "123456789",
  "actualBalance": "900000000000000000",
  "signature": ["123456789", "987654321"],
  "walletSecret": "987654321"
}
```

## Boundary Condition Testing

We test the following boundary conditions:

- **Zero values**: Testing with zero balances and zero thresholds
- **Equality boundaries**: Testing values exactly at threshold or maximum
- **Off-by-one**: Testing values that are just above/below thresholds
- **Maximum values**: Testing with extremely large numbers near field limits

Example boundary test cases include:

```javascript
// Exactly at threshold
{
  address: generateRandomWalletAddress(),
  threshold: "1000000000000000000",
  nonce: Date.now().toString(),
  actualBalance: "1000000000000000000",
  signature: [randomString, randomString],
  walletSecret: randomString
}

// Just above threshold by 1 wei
{
  address: generateRandomWalletAddress(),
  threshold: "1000000000000000000",
  nonce: Date.now().toString(),
  actualBalance: "1000000000000000001",
  signature: [randomString, randomString],
  walletSecret: randomString
}
```

## Symbolic Execution

Our symbolic execution testing analyzes circuit structure to check for:

- Contradictory constraints
- Missing security validations
- Proper isolation between circuits
- Consistent cryptographic assumptions

Example symbolic verification:

```javascript
// Check for conflicting constraints
const constraints = [
  ...source.matchAll(/(\w+)\s*(===|!==|<==|>==)\s*(\w+)/g)
].map(match => ({
  left: match[1],
  operator: match[2],
  right: match[3]
}));

// Look for contradicting constraints on the same signals
const contradictions = constraints.filter(c1 => 
  constraints.some(c2 => 
    c1 !== c2 && 
    c1.left === c2.left && 
    c1.right === c2.right && 
    contradictingOperators(c1.operator, c2.operator)
  )
);

expect(contradictions).toHaveLength(0);
```

## Differential Testing

When patched/optimized circuits are available, we perform differential testing to:

- Compare constraint structures before and after optimization
- Verify security invariants are maintained across versions
- Check compatibility of inputs between versions
- Analyze the impact of constraint reductions

The differential testing checks that primary constraints remain intact after optimization:

```javascript
if (circuitName === 'standardProof') {
  // Standard proof must maintain equality constraint
  const hasEqualityConstraint = patchedStructure.some(item => 
    item.type === 'constraint' && 
    ((item.left === 'actualBalance' && item.right === 'amount') ||
     (item.left === 'amount' && item.right === 'actualBalance'))
  );
  expect(hasEqualityConstraint).toBe(true);
}
```

## Cross-Circuit Isolation Tests

These tests verify that circuits operate independently and don't share vulnerabilities:

```javascript
// Verify circuits have distinct constraint structures
test('Circuits have different constraint structures', () => {
  const standardSource = loadCircuitSource('standardProof');
  const thresholdSource = loadCircuitSource('thresholdProof');
  const maximumSource = loadCircuitSource('maximumProof');
  
  // Verify fundamental differences in constraints
  
  // Standard uses equality constraint
  expect(standardSource.includes('actualBalance === amount')).toBe(true);
  
  // Threshold uses greater-than-or-equal constraint
  expect(thresholdSource.includes('GreaterEqThan')).toBe(true);
  
  // Maximum uses less-than-or-equal constraint
  expect(maximumSource.includes('LessEqThan')).toBe(true);
});
```

## Security Properties Verified

These tests verify important security properties:

1. **Correctness**: Circuits correctly implement their intended constraints
2. **Soundness**: Invalid proofs are rejected
3. **Zero-knowledge**: No additional information is leaked
4. **Isolation**: Circuits operate independently without interference
5. **Compatibility**: Updates maintain backward compatibility
6. **Optimization**: Constraints are reduced without compromising security

## Troubleshooting

### Common Issues

1. **Error: ENOENT: no such file or directory**
   - Ensure you're in the correct directory
   - Check that all files exist at the expected paths

2. **Error: witness generation failed**
   - Verify your input JSON matches the circuit requirements
   - Check for typos in signal names

3. **Error: verification failed**
   - This is expected for invalid inputs
   - For valid inputs, ensure circuit constraints are satisfied

4. **Error: circom command not found**
   - Ensure circom is installed globally
   - Try running `which circom` to verify installation

## Extending the Tests

To add new tests:

1. Add new edge cases to the `generateEdgeCaseInputs()` function
2. Add new circuit versions for differential testing in `/patched-circuits/`
3. Add new security invariants to check in the invariants list
4. Create additional test cases for specific properties of interest

## Conclusion

These comprehensive tests verify that our optimized circuits:
1. Generate valid proofs for valid inputs
2. Reject invalid inputs
3. Meet our constraint count targets
4. Maintain security properties across different circuit versions
5. Ensure isolation between different proof types
6. Handle all edge cases correctly

This testing approach ensures our ZK infrastructure remains secure, efficient, and maintainable.