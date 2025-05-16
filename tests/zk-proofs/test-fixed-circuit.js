/**
 * Test for fixed circuit constraints
 * Uses proper field arithmetic for large numbers
 */

const snarkjs = require('snarkjs');
const path = require('path');
const fs = require('fs');

async function testWithFieldElements() {
    console.log('=== Testing with Proper Field Elements ===\n');
    
    // Use field elements (numbers that fit in the ZK-SNARK field)
    // The field size for bn128 is approximately 2^254
    const input = {
        balance: "1000",  // These are already field elements
        threshold: "500",
        userAddress: "1234567890123456789012345678901234567890"
    };
    
    console.log('Input:');
    console.log('  Balance:', input.balance);
    console.log('  Threshold:', input.threshold);
    console.log('  Address:', input.userAddress);
    
    try {
        const wasmPath = path.join(__dirname, '../../packages/frontend/public/lib/zk/circuits/standardProof.wasm');
        const zkeyPath = path.join(__dirname, '../../packages/frontend/public/lib/zk/circuits/standardProof.zkey');
        const vkeyPath = path.join(__dirname, '../../packages/frontend/public/lib/zk/circuits/standardProof.vkey.json');
        
        // Check files exist
        console.log('\nChecking files:');
        console.log('  WASM exists:', fs.existsSync(wasmPath));
        console.log('  ZKEY exists:', fs.existsSync(zkeyPath));
        console.log('  VKEY exists:', fs.existsSync(vkeyPath));
        
        console.log('\nGenerating proof...');
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            wasmPath,
            zkeyPath
        );
        
        console.log('✅ Proof generated!');
        console.log('Public signals:', publicSignals);
        
        // Verify
        const vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
        const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        
        console.log('\nVerification:', verified ? 'VALID ✅' : 'INVALID ❌');
        
        return verified;
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        
        // More detailed error analysis
        if (error.message.includes('Num2Bits')) {
            console.log('\n🔍 Analysis: The Num2Bits circuit is failing.');
            console.log('This happens when:');
            console.log('1. Input numbers are too large for the field');
            console.log('2. Bit extraction logic has issues');
            console.log('3. Circuit constraints are over-constrained');
        }
        
        return false;
    }
}

// Run test
testWithFieldElements()
    .then(success => {
        console.log('\n' + (success ? '✅ Test passed!' : '❌ Test failed'));
        process.exit(success ? 0 : 1);
    })
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });