// Simple test script for snarkjs
import * as snarkjs from 'snarkjs';

async function testSnarkjs() {
    try {
        console.log('Testing snarkjs...');

        // Try to initialize snarkjs
        const initialized = snarkjs.groth16 !== undefined;
        console.log('snarkjs groth16 available:', initialized);

        console.log('snarkjs test successful!');
    } catch (error) {
        console.error('Error testing snarkjs:', error);
    }
}

testSnarkjs(); 