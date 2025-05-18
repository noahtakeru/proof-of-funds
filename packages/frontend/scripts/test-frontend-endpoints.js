#!/usr/bin/env node
/**
 * Frontend Endpoints Test Script
 * 
 * This script tests the ZK proof generation endpoints and verifies
 * that the circuit files are correctly loaded in both server and
 * browser environments.
 */

const fs = require('fs');
const path = require('path');
const { createProofStrategy } = require('../utils/zkProofStrategies');

// Mock window to simulate browser environment
global.window = global.window || {};

/**
 * Test that WASM files can be found in browser context
 */
async function testBrowserContext() {
  console.log('\n=== TESTING BROWSER CONTEXT ===');
  
  // Save original window object
  const originalWindow = global.window;
  
  // Mock fetch for browser environment
  global.fetch = async (url) => {
    console.log(`Simulating fetch for URL: ${url}`);
    
    // Get local file path from URL
    const localPath = path.join(process.cwd(), 'public', url);
    
    // Check if file exists
    if (fs.existsSync(localPath)) {
      console.log(`File found at ${localPath}`);
      return {
        ok: true,
        json: async () => ({ success: true }),
        text: async () => 'Mock file content',
        arrayBuffer: async () => new ArrayBuffer(10)
      };
    } else {
      console.log(`File NOT found at ${localPath}`);
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      };
    }
  };
  
  // Create strategies for each type
  const strategies = [
    { name: 'Public', strategy: createProofStrategy('public') },
    { name: 'Secure', strategy: createProofStrategy('secure') },
    { name: 'Cloud', strategy: createProofStrategy('cloud') }
  ];
  
  // Test each proof type
  const proofTypes = ['standard', 'maximum', 'threshold'];
  
  // Initialize all strategies
  for (const { name, strategy } of strategies) {
    await strategy.initialize();
    console.log(`Initialized ${name} strategy`);
  }
  
  // Test each strategy with each proof type
  for (const { name, strategy } of strategies) {
    console.log(`\nTesting ${name} strategy:`);
    
    for (const proofType of proofTypes) {
      try {
        console.log(`  Testing ${proofType} proof type...`);
        
        // Try to get WASM path
        const wasmPath = await strategy.getWasmPath(proofType);
        console.log(`    WASM path: ${wasmPath}`);
        
        // Try to get ZKey data
        try {
          const zkeyData = await strategy.getZKeyData(proofType);
          console.log(`    ZKey data found: ${typeof zkeyData === 'string' ? zkeyData : '[BufferData]'}`);
        } catch (error) {
          console.log(`    ZKey data error: ${error.message}`);
        }
        
        // Try to get verification key
        try {
          const vkey = await strategy.getVerificationKey(proofType);
          console.log(`    Verification key found: ${vkey ? 'Yes' : 'No'}`);
        } catch (error) {
          console.log(`    Verification key error: ${error.message}`);
        }
      } catch (error) {
        console.error(`  Error testing ${proofType} with ${name} strategy: ${error.message}`);
      }
    }
    
    // Clean up
    await strategy.cleanup();
  }
  
  // Restore original window
  global.window = originalWindow;
  delete global.fetch;
}

/**
 * Test that WASM files can be found in server context
 */
async function testServerContext() {
  console.log('\n=== TESTING SERVER CONTEXT ===');
  
  // Delete window to simulate server environment
  delete global.window;
  
  // Create strategies for each type
  const strategies = [
    { name: 'Public', strategy: createProofStrategy('public') },
    { name: 'Secure', strategy: createProofStrategy('secure') },
    { name: 'Cloud', strategy: createProofStrategy('cloud') }
  ];
  
  // Test each proof type
  const proofTypes = ['standard', 'maximum', 'threshold'];
  
  // Initialize all strategies
  for (const { name, strategy } of strategies) {
    await strategy.initialize();
    console.log(`Initialized ${name} strategy`);
  }
  
  // Test each strategy with each proof type
  for (const { name, strategy } of strategies) {
    console.log(`\nTesting ${name} strategy:`);
    
    for (const proofType of proofTypes) {
      try {
        console.log(`  Testing ${proofType} proof type...`);
        
        // Try to get WASM path
        const wasmPath = await strategy.getWasmPath(proofType);
        console.log(`    WASM path: ${wasmPath}`);
        console.log(`    File exists: ${fs.existsSync(wasmPath)}`);
        
        // Try to get ZKey data
        try {
          const zkeyData = await strategy.getZKeyData(proofType);
          console.log(`    ZKey data found: ${typeof zkeyData === 'string' ? zkeyData : '[BufferData]'}`);
        } catch (error) {
          console.log(`    ZKey data error: ${error.message}`);
        }
        
        // Try to get verification key
        try {
          const vkey = await strategy.getVerificationKey(proofType);
          console.log(`    Verification key found: ${vkey ? 'Yes' : 'No'}`);
        } catch (error) {
          console.log(`    Verification key error: ${error.message}`);
        }
      } catch (error) {
        console.error(`  Error testing ${proofType} with ${name} strategy: ${error.message}`);
      }
    }
    
    // Clean up
    await strategy.cleanup();
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== ZK PROOF FILES TEST ===');
  console.log('Testing circuit file loading in different environments');
  
  try {
    // Test server context first
    await testServerContext();
    
    // Then test browser context
    await testBrowserContext();
    
    console.log('\n=== TEST COMPLETED ===');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);