// Test circular dependency resolution
import { getErrorLogger } from './lib/zk/src/zkErrorHandler.mjs';
import * as secureStorage from './lib/zk/src/secureStorage.mjs';
import * as SecureKeyManager from './lib/zk/src/SecureKeyManager.js';
import * as zkRecoverySystem from './lib/zk/src/zkRecoverySystem.mjs';

console.log('Successfully imported all modules\!');
console.log('Modules loaded:');
console.log('- zkErrorHandler.mjs (getErrorLogger)');
console.log('- secureStorage.mjs');
console.log('- SecureKeyManager.js');
console.log('- zkRecoverySystem.mjs');
