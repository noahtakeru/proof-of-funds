/**
 * Circuit Differential Testing
 * 
 * These tests compare different circuit versions and implementations
 * to identify inconsistencies and ensure circuit upgrades maintain
 * compatibility and security properties.
 * 
 * Part of Week 5 Task 2: Circuit-Specific Testing
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Determine paths
const BASE_PATH = path.join(__dirname, '../../');
const CIRCUITS_PATH = path.join(BASE_PATH, 'circuits');
const TEST_INPUTS_PATH = path.join(BASE_PATH, 'test-inputs');
const PATCHED_CIRCUITS_PATH = path.join(BASE_PATH, 'patched-circuits');

// Helper function to load circuit source
function loadCircuitSource(circuitName, patched = false) {
  const basePath = patched ? PATCHED_CIRCUITS_PATH : CIRCUITS_PATH;
  const circuitPath = path.join(basePath, `${circuitName}.circom`);
  try {
    return fs.readFileSync(circuitPath, 'utf8');
  } catch (error) {
    console.warn(`Could not load ${patched ? 'patched ' : ''}circuit source for ${circuitName}: ${error.message}`);
    return null;
  }
}

// Helper function to load test input
function loadTestInput(circuitName, isValid = true) {
  const suffix = isValid ? 'input' : 'invalid';
  const inputPath = path.join(TEST_INPUTS_PATH, `${circuitName}_${suffix}.json`);
  try {
    return JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } catch (error) {
    console.warn(`Could not load test input for ${circuitName}: ${error.message}`);
    return null;
  }
}

// Helper function to check if patched circuits exist
function patchedCircuitsExist() {
  try {
    return fs.existsSync(PATCHED_CIRCUITS_PATH) && 
           fs.existsSync(path.join(PATCHED_CIRCUITS_PATH, 'standardProof.circom'));
  } catch (error) {
    return false;
  }
}

// Helper function to extract constraint structure from circuit source
function extractConstraintStructure(source) {
  if (!source) return [];
  
  // Extract constraint patterns (simplified for test purposes)
  const constraints = [
    // Extract equality constraints
    ...source.matchAll(/(\w+)\s*===\s*(\w+)/g),
    // Extract inequality constraints
    ...source.matchAll(/(\w+)\s*!==\s*(\w+)/g),
    // Extract assignment constraints
    ...source.matchAll(/(\w+)\s*<==\s*(\w+)/g),
    // Extract comparison component usage
    ...source.matchAll(/component\s+(\w+)\s*=\s*(\w+)/g)
  ].map(match => ({
    type: 'constraint',
    left: match[1],
    right: match[2]
  }));
  
  // Extract signal definitions
  const signals = [
    ...source.matchAll(/signal\s+(input|output)?\s*(\w+)/g)
  ].map(match => ({
    type: 'signal',
    kind: match[1] || 'internal',
    name: match[2]
  }));
  
  // Extract component instantiations
  const components = [
    ...source.matchAll(/component\s+(\w+)\s*=\s*(\w+)/g)
  ].map(match => ({
    type: 'component',
    name: match[1],
    template: match[2]
  }));
  
  return [...constraints, ...signals, ...components];
}

// Helper function to compare constraint structures
function compareConstraintStructures(original, patched) {
  const originalStr = JSON.stringify(original.sort((a, b) => 
    a.type.localeCompare(b.type) || a.left?.localeCompare(b.left || '') || a.right?.localeCompare(b.right || '')
  ));
  
  const patchedStr = JSON.stringify(patched.sort((a, b) => 
    a.type.localeCompare(b.type) || a.left?.localeCompare(b.left || '') || a.right?.localeCompare(b.right || '')
  ));
  
  // Return basic difference score (0 = identical, higher = more different)
  return originalStr === patchedStr ? 0 : levenshteinDistance(originalStr, patchedStr);
}

// Helper function to calculate Levenshtein distance (string edit distance)
function levenshteinDistance(a, b) {
  const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));
  
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + substitutionCost // substitution
      );
    }
  }
  
  return matrix[b.length][a.length];
}

// Helper to analyze circuit changes
function analyzeCircuitChanges(original, patched) {
  if (!original || !patched) return {
    signalChanges: [],
    constraintChanges: [],
    componentChanges: []
  };
  
  const originalStructure = extractConstraintStructure(original);
  const patchedStructure = extractConstraintStructure(patched);
  
  // Analyze changes in signals
  const originalSignals = originalStructure.filter(item => item.type === 'signal');
  const patchedSignals = patchedStructure.filter(item => item.type === 'signal');
  
  const signalChanges = {
    added: patchedSignals.filter(s => !originalSignals.some(os => os.name === s.name)),
    removed: originalSignals.filter(s => !patchedSignals.some(ps => ps.name === s.name)),
    changed: patchedSignals.filter(s => 
      originalSignals.some(os => os.name === s.name && os.kind !== s.kind)
    )
  };
  
  // Analyze changes in constraints
  const originalConstraints = originalStructure.filter(item => item.type === 'constraint');
  const patchedConstraints = patchedStructure.filter(item => item.type === 'constraint');
  
  const constraintChanges = {
    added: patchedConstraints.filter(c => 
      !originalConstraints.some(oc => oc.left === c.left && oc.right === c.right)
    ),
    removed: originalConstraints.filter(c => 
      !patchedConstraints.some(pc => pc.left === c.left && pc.right === c.right)
    )
  };
  
  // Analyze changes in components
  const originalComponents = originalStructure.filter(item => item.type === 'component');
  const patchedComponents = patchedStructure.filter(item => item.type === 'component');
  
  const componentChanges = {
    added: patchedComponents.filter(c => 
      !originalComponents.some(oc => oc.name === c.name)
    ),
    removed: originalComponents.filter(c => 
      !patchedComponents.some(pc => pc.name === c.name)
    ),
    changed: patchedComponents.filter(c => 
      originalComponents.some(oc => oc.name === c.name && oc.template !== c.template)
    )
  };
  
  return {
    signalChanges,
    constraintChanges,
    componentChanges
  };
}

// Main test suite
describe('Circuit Differential Testing', () => {
  // Define the circuit names to test
  const circuitNames = ['standardProof', 'thresholdProof', 'maximumProof'];
  
  // Check if we can perform differential testing
  const hasPatchedCircuits = patchedCircuitsExist();
  const conditionalTest = hasPatchedCircuits ? test : test.skip;
  
  describe('1. Original vs Patched Circuit Comparison', () => {
    conditionalTest.each(circuitNames)('%s maintains security properties after optimization', (circuitName) => {
      const originalSource = loadCircuitSource(circuitName);
      const patchedSource = loadCircuitSource(circuitName, true);
      
      expect(originalSource).not.toBeNull();
      expect(patchedSource).not.toBeNull();
      
      // Extract and compare constraint structures
      const originalStructure = extractConstraintStructure(originalSource);
      const patchedStructure = extractConstraintStructure(patchedSource);
      
      // Analyze changes
      const changes = analyzeCircuitChanges(originalSource, patchedSource);
      
      // Check that primary constraint logic remains intact
      // This is a key security property
      if (circuitName === 'standardProof') {
        // Standard proof must maintain equality constraint
        const hasEqualityConstraint = patchedStructure.some(item => 
          item.type === 'constraint' && 
          ((item.left === 'actualBalance' && item.right === 'amount') ||
           (item.left === 'amount' && item.right === 'actualBalance'))
        );
        expect(hasEqualityConstraint).toBe(true);
      } else if (circuitName === 'thresholdProof') {
        // Threshold proof must maintain >= constraint
        const hasGEComponent = patchedStructure.some(item => 
          item.type === 'component' && 
          item.template.includes('GreaterEq')
        );
        expect(hasGEComponent).toBe(true);
      } else if (circuitName === 'maximumProof') {
        // Maximum proof must maintain <= constraint
        const hasLEComponent = patchedStructure.some(item => 
          item.type === 'component' && 
          (item.template.includes('LessEq') || 
           // Or it might use GreaterEq in reverse order
           item.template.includes('GreaterEq'))
        );
        expect(hasLEComponent).toBe(true);
      }
      
      // Check that security-critical components remain
      const hasHashComponent = patchedStructure.some(item => 
        item.type === 'component' && 
        item.template === 'Poseidon'
      );
      expect(hasHashComponent).toBe(true);
      
      // Verify that public/private input structure is maintained
      const originalInputs = originalStructure
        .filter(item => item.type === 'signal' && item.kind === 'input')
        .map(item => item.name);
      
      const patchedInputs = patchedStructure
        .filter(item => item.type === 'signal' && item.kind === 'input')
        .map(item => item.name);
      
      // Core inputs should remain unchanged
      const criticalInputs = ['address', 'nonce', 'walletSecret'];
      if (circuitName === 'standardProof') criticalInputs.push('amount', 'actualBalance');
      if (circuitName === 'thresholdProof') criticalInputs.push('threshold', 'actualBalance');
      if (circuitName === 'maximumProof') criticalInputs.push('maximum', 'actualBalance');
      
      for (const input of criticalInputs) {
        expect(patchedInputs).toContain(input);
      }
    });
    
    conditionalTest.each(circuitNames)('%s optimizations don\'t break circuit logic', (circuitName) => {
      const originalSource = loadCircuitSource(circuitName);
      const patchedSource = loadCircuitSource(circuitName, true);
      
      expect(originalSource).not.toBeNull();
      expect(patchedSource).not.toBeNull();
      
      // Analyze constraint count difference
      const originalConstraintCount = (originalSource.match(/===/g) || []).length + 
                                      (originalSource.match(/<==|>==|!==|<=|>=/g) || []).length;
      
      const patchedConstraintCount = (patchedSource.match(/===/g) || []).length + 
                                     (patchedSource.match(/<==|>==|!==|<=|>=/g) || []).length;
      
      // We expect the patched version to have fewer constraints
      // but it must still maintain the critical constraints
      expect(patchedConstraintCount).toBeLessThanOrEqual(originalConstraintCount);
      
      // The patched circuit should still have critical constraints
      if (circuitName === 'standardProof') {
        expect(patchedSource).toContain('actualBalance === amount');
      } else if (circuitName === 'thresholdProof') {
        expect(patchedSource).toContain('GreaterEq');
      } else if (circuitName === 'maximumProof') {
        // Could be either LessEq or a reversed GreaterEq
        const hasComparison = patchedSource.includes('LessEq') || 
                              patchedSource.includes('GreaterEq');
        expect(hasComparison).toBe(true);
      }
      
      // Output must include hash result for verification
      expect(patchedSource).toContain('signal output hash_result');
    });
  });
  
  describe('2. Cross-Version Input Compatibility', () => {
    conditionalTest.each(circuitNames)('%s inputs are compatible across versions', (circuitName) => {
      const originalSource = loadCircuitSource(circuitName);
      const patchedSource = loadCircuitSource(circuitName, true);
      
      expect(originalSource).not.toBeNull();
      expect(patchedSource).not.toBeNull();
      
      // Extract input signals from both versions
      const originalInputs = extractConstraintStructure(originalSource)
        .filter(item => item.type === 'signal' && item.kind === 'input')
        .map(item => item.name);
      
      const patchedInputs = extractConstraintStructure(patchedSource)
        .filter(item => item.type === 'signal' && item.kind === 'input')
        .map(item => item.name);
      
      // Load test inputs to verify compatibility
      const testInput = loadTestInput(circuitName);
      expect(testInput).not.toBeNull();
      
      // Verify all required inputs are present in both versions
      for (const input of Object.keys(testInput)) {
        const isInOriginal = originalInputs.includes(input);
        const isInPatched = patchedInputs.includes(input);
        
        // Not all inputs may be directly named in signals due to struct usage
        // But critical inputs should be present in both
        if (input === 'address' || input === 'amount' || input === 'threshold' || 
            input === 'maximum' || input === 'actualBalance' || input === 'nonce') {
          expect(isInOriginal || patchedInputs.includes(input)).toBe(true);
        }
      }
      
      // Test input should satisfy constraints in both versions
      if (circuitName === 'standardProof') {
        expect(testInput.amount).toBe(testInput.actualBalance);
      } else if (circuitName === 'thresholdProof') {
        expect(BigInt(testInput.actualBalance) >= BigInt(testInput.threshold)).toBe(true);
      } else if (circuitName === 'maximumProof') {
        expect(BigInt(testInput.actualBalance) <= BigInt(testInput.maximum)).toBe(true);
      }
    });
  });
  
  describe('3. Security Invariants Across Versions', () => {
    conditionalTest.each(circuitNames)('%s maintains security invariants after patching', (circuitName) => {
      const originalSource = loadCircuitSource(circuitName);
      const patchedSource = loadCircuitSource(circuitName, true);
      
      expect(originalSource).not.toBeNull();
      expect(patchedSource).not.toBeNull();
      
      // Security invariants that must be preserved across versions
      const securityInvariants = [
        // Hash function usage
        { pattern: /Poseidon/g, name: 'Secure hash function' },
        // Output hash result for verification
        { pattern: /signal output hash_result/g, name: 'Hash output' },
        // Nonce inclusion for unique proofs
        { pattern: /nonce/g, name: 'Nonce usage' },
        // Primary constraint logic
        { 
          pattern: circuitName === 'standardProof' ? /actualBalance === amount/g :
                  circuitName === 'thresholdProof' ? /GreaterEq/g :
                  /LessEq|GreaterEq/g,
          name: 'Primary constraint'
        }
      ];
      
      // Check that all security invariants are maintained
      for (const invariant of securityInvariants) {
        const originalMatches = originalSource.match(invariant.pattern) || [];
        const patchedMatches = patchedSource.match(invariant.pattern) || [];
        
        // The security invariant should exist in both versions
        expect(originalMatches.length).toBeGreaterThan(0);
        expect(patchedMatches.length).toBeGreaterThan(0);
        
        // Log any concerning differences for review
        if (originalMatches.length !== patchedMatches.length) {
          console.warn(`Potential security invariant change: ${invariant.name} has ${originalMatches.length} instances in original but ${patchedMatches.length} in patched version of ${circuitName}`);
        }
      }
    });
  });
  
  // This section runs even without patched circuits
  describe('4. Circuit Version Characteristics', () => {
    test.each(circuitNames)('%s has consistent circuit characteristics', (circuitName) => {
      const source = loadCircuitSource(circuitName);
      expect(source).not.toBeNull();
      
      // Check for consistent circuit characteristics
      expect(source).toContain('pragma circom');
      expect(source).toContain('component main');
      
      // Each circuit should have documented optimization goals
      expect(source).toContain('Optimization goals');
      
      // Each circuit should have a primary constraint
      if (circuitName === 'standardProof') {
        expect(source).toContain('actualBalance === amount');
      } else if (circuitName === 'thresholdProof') {
        expect(source).toContain('GreaterEq');
      } else if (circuitName === 'maximumProof') {
        expect(source).toContain('LessEq');
      }
      
      // Check imported libraries
      expect(source).toContain('include "../node_modules/circomlib/circuits/poseidon.circom"');
    });
    
    test('Circuit characteristics are distinct by proof type', () => {
      const sources = {};
      for (const circuitName of circuitNames) {
        sources[circuitName] = loadCircuitSource(circuitName);
        expect(sources[circuitName]).not.toBeNull();
      }
      
      // Each circuit should be distinctly different
      // Compare characteristics between circuits
      for (let i = 0; i < circuitNames.length; i++) {
        for (let j = i + 1; j < circuitNames.length; j++) {
          const circuitA = circuitNames[i];
          const circuitB = circuitNames[j];
          
          const structureA = extractConstraintStructure(sources[circuitA]);
          const structureB = extractConstraintStructure(sources[circuitB]);
          
          // Calculate difference score
          const diffScore = compareConstraintStructures(structureA, structureB);
          
          // Different circuit types should have substantial differences
          expect(diffScore).toBeGreaterThan(0);
        }
      }
    });
  });
});