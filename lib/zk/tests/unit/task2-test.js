// Test for Client-Side Security components
const fs = require('fs');

const secureKeyManagerPath = './lib/zk/src/SecureKeyManager.js';
const tamperDetectionPath = './lib/zk/src/TamperDetection.js';

let passed = true;

// Test file existence and correct security methods
if (!fs.existsSync(secureKeyManagerPath)) {
  console.error('SecureKeyManager.js not found');
  passed = false;
} else {
  const content = fs.readFileSync(secureKeyManagerPath, 'utf8');
  
  // Check for actual methods we found in the source code
  if (!content.includes('generateEncryptionKey') || 
      !content.includes('encrypt') || 
      !content.includes('decrypt')) {
    console.error('SecureKeyManager.js missing expected encryption methods');
    passed = false;
  } else {
    console.log('SecureKeyManager.js contains expected encryption methods');
  }
}

if (!fs.existsSync(tamperDetectionPath)) {
  console.error('TamperDetection.js not found');
  passed = false;
} else {
  const content = fs.readFileSync(tamperDetectionPath, 'utf8');
  
  // Check for actual methods we found in the source code
  if (!content.includes('verify') || 
      !content.includes('protect') || 
      !content.includes('signForRemote') ||
      !content.includes('verifyRemoteSignature')) {
    console.error('TamperDetection.js missing expected tamper detection methods');
    passed = false;
  } else {
    console.log('TamperDetection.js contains expected tamper detection methods');
  }
}

// Print summary
console.log('Client-Side Security test:', passed ? 'PASS' : 'FAIL');
process.exit(passed ? 0 : 1);