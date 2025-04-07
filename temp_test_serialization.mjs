import { serializeZKProof, deserializeZKProof, generateZKProofHash } from './lib/zk/src/zkUtils.mjs';
// Add missing imports that might be needed
import { Buffer } from 'buffer';
import * as fs from 'fs';

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
