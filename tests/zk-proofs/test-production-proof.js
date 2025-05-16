/**
 * Production ZK Proof Test
 * Tests proof generation with realistic values
 */

const snarkjs = require('snarkjs');
const path = require('path');

// Circuit directory
const CIRCUIT_DIR = path.resolve(__dirname, '../../packages/frontend/public/lib/zk/circuits');

async function generateAndVerifyProof() {
    console.log('=== Production ZK Proof Test ===\n');
    
    // Use realistic values that fit within circuit constraints
    const input = {
        balance: "1000000000000000000", // 1 ETH in wei (fits in field)
        threshold: "500000000000000000", // 0.5 ETH in wei
        userAddress: "123456789012345678901234567890123456789012" // 42 chars (Ethereum address without 0x)
    };
    
    console.log('Input values:');
    console.log(`  Balance: ${input.balance} (wei)`);
    console.log(`  Threshold: ${input.threshold} (wei)`);
    console.log(`  User Address: 0x${input.userAddress}`);
    console.log();
    
    try {
        const circuitName = 'standardProof';
        const wasmPath = path.join(CIRCUIT_DIR, `${circuitName}.wasm`);
        const zkeyPath = path.join(CIRCUIT_DIR, `${circuitName}.zkey`);
        const vkeyPath = path.join(CIRCUIT_DIR, `${circuitName}.vkey.json`);
        
        console.log('Generating proof...');
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            wasmPath,
            zkeyPath
        );
        
        console.log('Proof generated successfully!');
        console.log('Public signals:', publicSignals);
        console.log();
        
        // Load verification key
        const vKey = JSON.parse(require('fs').readFileSync(vkeyPath));
        
        console.log('Verifying proof...');
        const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        
        console.log(`Proof verification result: ${verified ? 'VALID ✅' : 'INVALID ❌'}`);
        
        return { success: verified, proof, publicSignals };
    } catch (error) {
        console.error('Error:', error);
        return { success: false, error: error.message };
    }
}

// Run the test
generateAndVerifyProof()
    .then(result => {
        if (result.success) {
            console.log('\n✅ Production ZK proof system is working correctly!');
        } else {
            console.log('\n❌ ZK proof system test failed');
            if (result.error) {
                console.log('Error:', result.error);
            }
        }
        process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });