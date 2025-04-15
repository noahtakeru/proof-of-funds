/**
 * Proof Size Optimization Regression Test
 * 
 * This file is used by the regression test system to verify that
 * the proof size optimization system is properly implemented.
 */

// Common JS imports
const fs = require('fs');
const path = require('path');

// File paths to check
const files = [
  'src/proof/ProofCompressor.ts',
  'src/proof/OptimizedSerializer.ts',
  'src/proof/SelectiveDisclosure.ts',
  'src/proof/index.ts',
  '__tests__/ProofSizeOptimization.test.js'
];

// Required functionality in each file
const fileContents = {
  'src/proof/ProofCompressor.ts': [
    'CompressionLevel',
    'CompressionAlgorithm',
    'compressProof',
    'decompressProof',
    'createCompressedProofPackage',
    'extractFromCompressedPackage',
    'analyzeProofSize',
    'estimateOptimalCompression'
  ],
  'src/proof/OptimizedSerializer.ts': [
    'OptimizedSerializationOptions',
    'serializeOptimized',
    'deserializeOptimized',
    'estimateSizeReduction',
    'createMinimalVerifiableProof'
  ],
  'src/proof/SelectiveDisclosure.ts': [
    'ProofComponent',
    'createSelectiveDisclosure',
    'verifyPartialProof',
    'extractVerifiableInfo',
    'createProofReference',
    'verifyProofReference'
  ],
  'src/proof/index.ts': [
    'compression',
    'serialization',
    'disclosure',
    'default'
  ],
  '__tests__/ProofSizeOptimization.test.js': [
    'ProofCompressor',
    'OptimizedSerializer',
    'SelectiveDisclosure',
    'Integration test'
  ]
};

// Count for test results
let found = 0;
let missing = 0;
let total = files.length;

// Get the lib/zk directory path based on this file's location
const rootDir = path.resolve(__dirname, '../..');

// Check each required file
console.log('Checking Proof Size Optimization implementation:');
console.log('----------------------------------------------');

for (const file of files) {
  const filePath = path.join(rootDir, file);
  
  if (fs.existsSync(filePath)) {
    console.log(`✓ File exists: ${file}`);
    
    // Check required functionality
    const content = fs.readFileSync(filePath, 'utf8');
    const requiredFunctions = fileContents[file] || [];
    
    let functionsFound = 0;
    let functionsMissing = [];
    
    for (const func of requiredFunctions) {
      if (content.includes(func)) {
        functionsFound++;
      } else {
        functionsMissing.push(func);
      }
    }
    
    if (functionsFound === requiredFunctions.length) {
      console.log(`  ✓ All required functionality found`);
      found++;
    } else {
      console.log(`  ✗ Missing functionality: ${functionsMissing.join(', ')}`);
      missing++;
    }
  } else {
    console.log(`✗ File missing: ${file}`);
    missing++;
  }
}

// Check module integration
const indexFileExists = fs.existsSync(path.join(rootDir, 'src/index.mjs'));
if (indexFileExists) {
  const indexContent = fs.readFileSync(path.join(rootDir, 'src/index.mjs'), 'utf8');
  
  if (indexContent.includes('proofOptimizer') && 
      indexContent.includes('import * as proofOptimization')) {
    console.log('✓ Main module integration check passed');
  } else {
    console.log('✗ Proof Size Optimization not properly integrated in main module');
    missing++;
    total++;
  }
} else {
  console.log('✗ Main index file not found');
}

// Summary
console.log('\nSummary:');
console.log('--------');
console.log(`${found}/${total} components fully implemented`);

// Exit with appropriate code
if (found === total) {
  console.log('\nProof Size Optimization is fully implemented!');
  process.exit(0);
} else {
  console.log('\nProof Size Optimization implementation is incomplete.');
  process.exit(1);
}