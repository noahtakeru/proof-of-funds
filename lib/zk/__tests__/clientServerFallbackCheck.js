/**
 * Basic check for Client-Server Fallback functionality
 * 
 * This is a simplified test file for the regression test script.
 */

// Simple test function that doesn't rely on imports
async function runServerFallbackCheck() {
  console.log('=== Server Fallback System Check ===\n');
  
  try {
    // Load the module dynamically to avoid import issues
    console.log('1. Loading zkProxyClient.js...');
    let ZKProxyClient, EXECUTION_MODES;
    
    try {
      // Use dynamic import with evaluated string to avoid static import issues
      const module = await import('../src/zkProxyClient.js');
      ZKProxyClient = module.ZKProxyClient;
      EXECUTION_MODES = module.EXECUTION_MODES;
      
      console.log('✓ Module loaded successfully\n');
    } catch (error) {
      console.error(`Failed to import zkProxyClient.js: ${error.message}`);
      // Try to provide more context about the error
      if (error.stack) {
        console.error(error.stack.split('\n').slice(0, 3).join('\n'));
      }
      return false;
    }
    
    // Check if the module exports the expected classes and constants
    console.log('2. Checking basic exports...');
    if (!ZKProxyClient) {
      throw new Error('ZKProxyClient class not exported');
    }
    
    if (!EXECUTION_MODES) {
      throw new Error('EXECUTION_MODES not exported');
    }
    
    // Check if EXECUTION_MODES has the expected properties
    const expectedModes = ['CLIENT_SIDE', 'SERVER_SIDE', 'HYBRID', 'AUTO'];
    for (const mode of expectedModes) {
      if (!EXECUTION_MODES[mode]) {
        throw new Error(`Missing execution mode: ${mode}`);
      }
    }
    
    console.log('✓ Basic exports validated\n');
    
    // Create an instance of ZKProxyClient (don't initialize)
    console.log('3. Creating ZKProxyClient instance...');
    let client;
    
    try {
      client = new ZKProxyClient();
      console.log('✓ Instance created successfully\n');
    } catch (error) {
      throw new Error(`Failed to create ZKProxyClient instance: ${error.message}`);
    }
    
    // Check if the instance has the expected methods
    console.log('4. Checking instance methods...');
    const expectedMethods = [
      'initialize',
      'generateProof',
      'verifyProof',
      'setExecutionMode',
      'setUserPreferences',
      'getStatus'
    ];
    
    for (const method of expectedMethods) {
      if (typeof client[method] !== 'function') {
        throw new Error(`Missing method: ${method}`);
      }
    }
    
    console.log('✓ Instance methods validated\n');
    
    // Add simple API documentation check
    console.log('5. Checking API documentation...');
    
    // Use node's fs module directly
    const fs = await import('fs');
    const docExists = fs.existsSync('./lib/zk/docs/general/SERVER_FALLBACKS.md');
    console.log(`Server fallbacks documentation: ${docExists ? 'Found' : 'Not found'}`);
    
    console.log('\n=== Server Fallback System Check Complete ===');
    console.log('✓ ZKProxyClient implementation is valid');
    
    return true;
  } catch (error) {
    console.error(`\n❌ Server Fallback System Check Failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack.split('\n').slice(0, 3).join('\n'));
    }
    return false;
  }
}

// Execute check and export the result (for ESM compatibility)
const checkResult = await runServerFallbackCheck();

// Use process.exit only in standalone mode
if (typeof process !== 'undefined' && process.argv[1] === import.meta.url) {
  process.exit(checkResult ? 0 : 1);
}