/**
 * Simple ZK Proof Test
 * Tests proof generation with small values to diagnose issues
 */

const snarkjs = require('snarkjs');
const path = require('path');

// Circuit directory
const CIRCUIT_DIR = path.resolve(__dirname, '../../packages/frontend/public/lib/zk/circuits');

async function testSimpleProof() {
    console.log('=== Simple ZK Proof Test ===\n');
    
    // Use very small values to test
    const input = {
        balance: "1000",
        threshold: "500",
        userAddress: "1234567890"
    };
    
    console.log('Testing with simple values:');
    console.log('  Balance:', input.balance);
    console.log('  Threshold:', input.threshold);
    console.log('  User Address:', input.userAddress);
    console.log();
    
    try {
        const wasmPath = path.join(CIRCUIT_DIR, 'standardProof.wasm');
        const zkeyPath = path.join(CIRCUIT_DIR, 'standardProof.zkey');
        const vkeyPath = path.join(CIRCUIT_DIR, 'standardProof.vkey.json');
        
        console.log('Generating proof...');
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            wasmPath,
            zkeyPath
        );
        
        console.log('✅ Proof generated successfully!');
        console.log('Public signals:', publicSignals);
        
        // Load verification key
        const vKey = JSON.parse(require('fs').readFileSync(vkeyPath));
        
        console.log('\nVerifying proof...');
        const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        
        console.log(`Verification result: ${verified ? 'VALID ✅' : 'INVALID ❌'}`);
        
        return verified;
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('\nStack trace:', error.stack);
        return false;
    }
}

// Test with different values
async function runTests() {
    console.log('Running multiple test cases...\n');
    
    const testCases = [
        { balance: "100", threshold: "50", userAddress: "123" },
        { balance: "1000", threshold: "500", userAddress: "456" },
        { balance: "10000", threshold: "5000", userAddress: "789" }
    ];
    
    for (const testCase of testCases) {
        console.log(`\nTest Case: balance=${testCase.balance}, threshold=${testCase.threshold}`);
        
        try {
            const wasmPath = path.join(CIRCUIT_DIR, 'standardProof.wasm');
            const zkeyPath = path.join(CIRCUIT_DIR, 'standardProof.zkey');
            
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                testCase,
                wasmPath,
                zkeyPath
            );
            
            console.log('✅ Proof generated');
            console.log('Public signals:', publicSignals);
        } catch (error) {
            console.log('❌ Failed:', error.message);
        }
    }
}

// Run the test
testSimpleProof()
    .then(async result => {
        if (result) {
            console.log('\n✅ Simple test passed!');
            console.log('\nRunning additional tests...');
            await runTests();
        } else {
            console.log('\n❌ Simple test failed');
        }
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });