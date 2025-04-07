import { default as zkUtils } from './lib/zk/src/zkUtils.mjs';
try {
  import('./lib/zk/src/SecureKeyManager.js').catch(e => console.error);
  import('./lib/zk/src/TamperDetection.js').catch(e => console.error);
} catch (e) {}
try {
  import('./lib/zk/src/SecureKeyManager.js').catch(e => console.error);
  import('./lib/zk/src/TamperDetection.js').catch(e => console.error);
} catch (e) {}
import SecureKeyManager from './lib/zk/src/SecureKeyManager.js';
import TamperDetection from './lib/zk/src/TamperDetection.js';
import zkConfig from './lib/zk/config/real-zk-config.mjs';
import ethersUtils from './lib/ethersUtils.js';

console.log('ZK Utils loaded successfully:', Object.keys(zkUtils).length > 0 ? 'PASS' : 'FAIL');
console.log('SecureKeyManager loaded successfully:', SecureKeyManager ? 'PASS' : 'FAIL');
console.log('TamperDetection loaded successfully:', TamperDetection ? 'PASS' : 'FAIL');
console.log('ZK Config loaded successfully:', zkConfig ? 'PASS' : 'FAIL');
console.log('Ethers Utils loaded successfully:', ethersUtils ? 'PASS' : 'FAIL');
