// Simple test for Browser Compatibility System
const fs = require('fs');

const browserCompatibilityPath = './lib/zk/src/browserCompatibility.js';
const matrixPath = './lib/zk/html/browser-compatibility-matrix.html';

let passed = true;
console.log('=== Browser Compatibility System Test ===');

// Test file existence
if (!fs.existsSync(browserCompatibilityPath)) {
  console.error('browserCompatibility.js not found');
  passed = false;
} else {
  console.log('browserCompatibility.js found');
  
  // Check content for specific functions
  const content = fs.readFileSync(browserCompatibilityPath, 'utf8');
  console.log('File content loaded, size:', content.length, 'bytes');
  
  // Debug - print all export names
  try {
    const exportMatches = content.match(/export\s+(?:const|function|let|var|class)\s+(\w+)/g) || [];
    const namedExportsMatch = content.match(/export\s*{([^}]+)}/);
    
    console.log('Detected exports:');
    exportMatches.forEach(m => console.log(' -', m));
    
    if (namedExportsMatch) {
      console.log('Named exports:', namedExportsMatch[1].trim());
    }
  } catch (e) {
    console.error('Error analyzing exports:', e.message);
  }
  
  // Look for browser compatibility methods
  const hasDetectFeatures = content.includes('detectBrowserFeatures') || 
                            content.includes('detectFeatures') || 
                            content.includes('checkFeatures');
  
  const hasCompatibilityCheck = content.includes('isBrowserCompatible') || 
                               content.includes('isCompatible') || 
                               content.includes('checkCompatibility');
  
  console.log('Has detection methods:', hasDetectFeatures);
  console.log('Has compatibility checks:', hasCompatibilityCheck);
  
  if (!hasDetectFeatures || !hasCompatibilityCheck) {
    console.error('browserCompatibility.js missing expected detection methods');
    passed = false;
  } else {
    console.log('browserCompatibility.js contains expected detection methods');
  }
}

// Check for compatibility matrix
if (fs.existsSync(matrixPath)) {
  console.log('Browser compatibility matrix found');
} else {
  console.log('Browser compatibility matrix not found (optional)');
}

// Print actual result
console.log('Browser Compatibility test:', passed ? 'PASS' : 'FAIL');
process.exit(passed ? 0 : 1);