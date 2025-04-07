import SecureKeyManager from './lib/zk/SecureKeyManager.js';
import TamperDetection from './lib/zk/TamperDetection.js';

// Test SecureKeyManager
const keyManager = new SecureKeyManager();
const testKey = keyManager.generateEncryptionKey();
console.log('Key generation:', testKey ? 'PASS' : 'FAIL');

// Test TamperDetection
const tamperDetection = new TamperDetection();
const testData = { test: 'data' };
const signedData = tamperDetection.sign(testData);
console.log('Tamper detection signing:', 
  signedData && signedData._timestamp ? 'PASS' : 'FAIL');
