// Direct test for circom compilation
import fs from 'fs';
import path from 'path';
import * as snarkjs from 'snarkjs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testCircomCompilation() {
    try {
        console.log('Testing circom compilation...');

        // Paths to key files
        const wasmPath = path.join(__dirname, 'lib', 'zk', 'build', 'standardProof_js', 'standardProof.wasm');
        const zkeyPath = path.join(__dirname, 'lib', 'zk', 'build', 'zkey', 'standardProof.zkey');
        const vkeyPath = path.join(__dirname, 'lib', 'zk', 'build', 'verification_key', 'standardProof.json');

        // Check if files exist
        console.log(`Checking if WASM file exists at ${wasmPath}: ${fs.existsSync(wasmPath)}`);
        console.log(`Checking if zkey file exists at ${zkeyPath}: ${fs.existsSync(zkeyPath)}`);
        console.log(`Checking if vkey file exists at ${vkeyPath}: ${fs.existsSync(vkeyPath)}`);

        // Test generating a witness
        if (fs.existsSync(wasmPath)) {
            try {
                // Mock input for standardProof
                const input = {
                    address: "12345",
                    amount: "1000",
                    nonce: "0",
                    actualBalance: "1000",
                    signature: ["0", "0"],
                    walletSecret: "0"
                };

                console.log('Generating witness...');
                const { witness } = await snarkjs.wtns.calculate(input, wasmPath);
                console.log('Witness generation successful!');

                // Test generating a proof if zkey exists
                if (fs.existsSync(zkeyPath)) {
                    try {
                        console.log('Generating proof...');
                        const { proof, publicSignals } = await snarkjs.groth16.prove(zkeyPath, witness);
                        console.log('Proof generation successful!');
                        console.log('Proof:', JSON.stringify(proof).substring(0, 100) + '...');
                        console.log('Public signals:', publicSignals);

                        // Test verification if verification key exists
                        if (fs.existsSync(vkeyPath)) {
                            try {
                                console.log('Verifying proof...');
                                const vkeyContent = fs.readFileSync(vkeyPath, 'utf8');
                                const vkey = JSON.parse(vkeyContent);
                                const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
                                console.log('Verification result:', isValid);
                            } catch (error) {
                                console.error('Error verifying proof:', error);
                            }
                        }
                    } catch (error) {
                        console.error('Error generating proof:', error);
                    }
                }
            } catch (error) {
                console.error('Error generating witness:', error);
            }
        }

        console.log('Testing complete!');
    } catch (error) {
        console.error('Error in test:', error);
    }
}

testCircomCompilation(); 