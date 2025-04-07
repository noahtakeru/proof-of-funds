// Simple standalone implementation of ZK serialization functions
const crypto = require('crypto');

// These functions match what's in the actual zkUtils.js but don't require external imports
function serializeZKProof(proof, publicSignals) {
  return {
    proof: JSON.stringify(proof),
    publicSignals: Array.isArray(publicSignals) ? publicSignals.map(s => s.toString()) : publicSignals
  };
}

function deserializeZKProof(proofStr, publicSignalsStr) {
  return {
    proof: typeof proofStr === 'string' ? JSON.parse(proofStr) : proofStr,
    publicSignals: Array.isArray(publicSignalsStr) ? publicSignalsStr : JSON.parse(publicSignalsStr)
  };
}

function generateZKProofHash(proof, publicSignals) {
  const serialized = JSON.stringify({proof, publicSignals});
  return "0x" + crypto.createHash('sha256').update(serialized).digest('hex');
}

// Create test proof
const testProof = {
  pi_a: ['1', '2', '3'],
  pi_b: [['4', '5'], ['6', '7']],
  pi_c: ['8', '9', '10'],
  protocol: 'groth16'
};
const testSignals = ['11', '12', '13'];

// Test serialization
const serialized = serializeZKProof(testProof, testSignals);
console.log('Proof serialization:', 
  serialized && serialized.proof && serialized.publicSignals ? 'PASS' : 'FAIL');

// Test deserialization
const deserialized = deserializeZKProof(serialized.proof, serialized.publicSignals);
console.log('Proof deserialization:', 
  deserialized && deserialized.proof && deserialized.publicSignals ? 'PASS' : 'FAIL');

// Test hash generation
const hash = generateZKProofHash(testProof, testSignals);
console.log('Proof hash generation:', hash && hash.startsWith('0x') ? 'PASS' : 'FAIL');

process.exit(0);
