/**
 * ZK Proof Generation and Verification Demo
 * 
 * This script demonstrates generating and verifying a ZK proof
 * using the deployed circuits.
 */

const fs = require('fs');
const path = require('path');

// Dynamically import snarkjs (since it's an ES module)
async function main() {
  try {
    console.log('=== ZK Proof Generation and Verification Demo ===');
    
    // First, import snarkjs using dynamic import
    const snarkjs = await import('snarkjs');
    console.log('Successfully imported snarkjs');
    
    // Path to circuit files
    const CIRCUIT_DIR = path.resolve(__dirname, '../../packages/frontend/public/lib/zk/circuits');
    
    // Input for standard proof
    const input = {
      balance: 1000,
      threshold: 500,
      userAddress: "0x1234567890123456789012345678901234567890"
    };
    
    console.log('\nGenerating standard proof with input:', input);
    
    // Generate proof
    try {
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        path.join(CIRCUIT_DIR, 'standardProof.wasm'),
        path.join(CIRCUIT_DIR, 'standardProof.zkey')
      );
      
      console.log('\nProof generated successfully!');
      console.log('Public signals:', publicSignals);
      
      // Verify proof
      const vkeyJson = JSON.parse(fs.readFileSync(path.join(CIRCUIT_DIR, 'standardProof.vkey.json'), 'utf8'));
      const verified = await snarkjs.groth16.verify(vkeyJson, publicSignals, proof);
      
      console.log(`\nProof verification result: ${verified ? 'VALID ✅' : 'INVALID ❌'}`);
      
      return { success: true, verified };
    } catch (error) {
      console.error('\nError generating/verifying proof:', error);
      return { success: false, error: error.message };
    }
  } catch (error) {
    console.error('Failed to import snarkjs:', error);
    return { success: false, error: error.message };
  }
}

// Run the demo
main().then(result => {
  console.log('\n=== Result ===');
  console.log(result.success 
    ? `ZK proof system is working correctly! Verification result: ${result.verified}` 
    : `ZK proof system error: ${result.error}`);
});