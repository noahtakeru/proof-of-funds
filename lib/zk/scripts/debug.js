const fs = require('fs');
const path = require('path');
const snarkjs = require('snarkjs');

async function debugCircuit(circuitName = 'standardProof') {
    try {
        console.log(`Debugging circuit: ${circuitName}`);

        // Define paths
        const buildDir = path.join(__dirname, '..', 'build');
        const r1csPath = path.join(buildDir, `${circuitName}.r1cs`);
        const wasmPath = path.join(buildDir, `${circuitName}_js`, `${circuitName}.wasm`);
        const zkeyPath = path.join(buildDir, 'zkey', `${circuitName}.zkey`);
        const inputPath = path.join(buildDir, `${circuitName}_input.json`);

        // Check files
        console.log('\nFile status:');
        console.log(`R1CS: ${fs.existsSync(r1csPath) ? 'Exists' : 'Missing'}`);
        console.log(`WASM: ${fs.existsSync(wasmPath) ? 'Exists' : 'Missing'}`);
        console.log(`ZKEY: ${fs.existsSync(zkeyPath) ? 'Exists' : 'Missing'}`);
        console.log(`Input: ${fs.existsSync(inputPath) ? 'Exists' : 'Missing'}`);

        // Check if files are placeholders
        if (fs.existsSync(r1csPath)) {
            try {
                const content = fs.readFileSync(r1csPath, 'utf8', { encoding: 'utf8' });
                console.log(`R1CS is placeholder: ${content.includes('Placeholder')}`);
            } catch (error) {
                console.log('R1CS appears to be binary (good sign)');
            }
        }

        if (fs.existsSync(zkeyPath)) {
            try {
                const content = fs.readFileSync(zkeyPath, 'utf8', { encoding: 'utf8' });
                console.log(`ZKEY is placeholder: ${content.includes('Placeholder')}`);
            } catch (error) {
                console.log('ZKEY appears to be binary (good sign)');
            }
        }

        // Create sample input if none exists
        if (!fs.existsSync(inputPath)) {
            console.log('Creating sample input file...');
            const sampleInput = generateTestInput(circuitName);
            fs.writeFileSync(inputPath, JSON.stringify(sampleInput, null, 2));
            console.log(`Created sample input at: ${inputPath}`);
        } else {
            console.log('Using existing input file');
        }

        // Try to read WASM file header
        if (fs.existsSync(wasmPath)) {
            try {
                const wasmHeader = fs.readFileSync(wasmPath, { encoding: null, flag: 'r', length: 16 });
                console.log('WASM header:', Buffer.from(wasmHeader).toString('hex'));
                console.log('WASM is valid WebAssembly:', wasmHeader[0] === 0 && wasmHeader[1] === 97 && wasmHeader[2] === 115 && wasmHeader[3] === 109);
            } catch (error) {
                console.error('Error reading WASM header:', error.message);
            }
        }

        // Try to calculate witness
        if (fs.existsSync(wasmPath) && fs.existsSync(inputPath)) {
            try {
                console.log('\nAttempting to calculate witness...');
                const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
                console.log('Input:', input);

                const { witness } = await snarkjs.wtns.calculate(input, wasmPath);
                console.log('Witness calculation succeeded!');

                // Try to generate proof if zkey exists
                if (fs.existsSync(zkeyPath)) {
                    try {
                        const zkeyContent = fs.readFileSync(zkeyPath, 'utf8');
                        if (zkeyContent.includes('Placeholder')) {
                            console.log('Not attempting proof generation with placeholder zkey');
                        } else {
                            console.log('\nAttempting to generate proof...');
                            const { proof, publicSignals } = await snarkjs.groth16.prove(zkeyPath, witness);
                            console.log('Proof generation succeeded!');
                            console.log('Public Signals:', publicSignals);
                        }
                    } catch (e) {
                        console.log('\nAttempting to generate proof with binary zkey...');
                        try {
                            const { proof, publicSignals } = await snarkjs.groth16.prove(zkeyPath, witness);
                            console.log('Proof generation succeeded!');
                            console.log('Public Signals:', publicSignals);
                        } catch (proofError) {
                            console.error('Error generating proof:', proofError.message);
                        }
                    }
                }
            } catch (error) {
                console.error('Error during witness calculation:', error.message);
                console.error('Possible cause: Input format mismatch with circuit definition');
            }
        }

    } catch (error) {
        console.error('Debug error:', error);
    }
}

function generateTestInput(circuitName) {
    // Create appropriate test inputs based on circuit type
    switch (circuitName) {
        case 'standardProof':
            return {
                address: "123456789",
                amount: "1000000000",
                nonce: "123456789",
                actualBalance: "1000000000",
                signature: ["123456", "789012"],
                walletSecret: "987654321"
            };
        case 'thresholdProof':
            return {
                address: "123456789",
                threshold: "1000000000",
                nonce: "123456789",
                actualBalance: "1500000000",
                signature: ["123456", "789012"],
                walletSecret: "987654321"
            };
        case 'maximumProof':
            return {
                address: "123456789",
                maximum: "2000000000",
                nonce: "123456789",
                actualBalance: "1500000000",
                signature: ["123456", "789012"],
                walletSecret: "987654321"
            };
        default:
            return { in: "1" }; // Minimal fallback
    }
}

// Run debug if called directly
if (require.main === module) {
    const circuit = process.argv[2] || 'standardProof';
    debugCircuit(circuit).then(() => {
        console.log('Debug complete');
    }).catch(err => {
        console.error('Debug failed:', err);
    });
}

module.exports = { debugCircuit, generateTestInput }; 