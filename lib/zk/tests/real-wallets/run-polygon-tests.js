#!/usr/bin/env node
/**
 * Example script to run ZK proof verification tests on Polygon Amoy testnet
 * 
 * This script demonstrates how to configure and run the real wallet test harness
 * for testing ZK proofs on Polygon Amoy testnet.
 * 
 * Usage:
 * 1. Create a .env file with POLYGON_AMOY_PRIVATE_KEY containing your funded wallet's private key
 * 2. Run with: node run-polygon-tests.js
 * 
 * Requirements:
 * - Funded wallet on Polygon Amoy testnet with at least 0.2 MATIC
 */

import ProofVerificationE2E from './ProofVerificationE2E.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get private key from environment
const privateKey = process.env.POLYGON_AMOY_PRIVATE_KEY;
if (!privateKey) {
    console.error('Error: POLYGON_AMOY_PRIVATE_KEY not set in environment or .env file');
    console.error('Please provide a private key with sufficient MATIC balance on Polygon Amoy testnet');
    process.exit(1);
}

// Configuration for tests
const config = {
    network: 'polygon_amoy',
    fundingKey: privateKey,
    fixtureDir: path.join(__dirname, 'fixtures'),
    resultsDir: path.join(__dirname, 'results'),
    preserveWallets: false, // Set to true if you want to keep test wallets for debugging
    smartContractTest: false // Set to true and provide verifierContractAddress if you want to test smart contract verification
    // verifierContractAddress: '0x...' // Address of ZKVerifier contract on Polygon Amoy
};

async function runTests() {
    console.log('==========================================');
    console.log('ZK Proof Verification Tests on Polygon Amoy');
    console.log('==========================================');

    try {
        // Create test runner
        const testRunner = new ProofVerificationE2E(config);

        // Run all tests
        await testRunner.runAllTests();

        console.log('==========================================');
        console.log('Tests completed successfully');
        console.log('==========================================');
    } catch (error) {
        console.error('==========================================');
        console.error('Tests failed:');
        console.error(error);
        console.error('==========================================');
        process.exit(1);
    }
}

// Run the tests
runTests().catch(console.error); 