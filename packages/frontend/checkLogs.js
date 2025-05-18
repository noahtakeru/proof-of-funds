// Analyzing the console output from the last run
const consoleOutput = `
 ✓ Compiled /api/zk/submitProof in 193ms (500 modules)
Using RPC URL: https://rpc-amoy.polygon.technology/
Connected to network: unknown (chainId: 80002)
✓ Connected to Polygon Amoy testnet
Service wallet address: 0xD6bd1eFCE3A2c4737856724f96F39037a3564890
Using service wallet for Amoy testnet
Temp wallet balance: 0.0 MATIC
Funding temporary wallet...
Using RPC URL: https://rpc-amoy.polygon.technology/
Connected to network: unknown (chainId: 80002)
✓ Connected to Polygon Amoy testnet
Service wallet address: 0xD6bd1eFCE3A2c4737856724f96F39037a3564890
Using service wallet for Amoy testnet
Temp wallet balance: 0.0 MATIC
Funding temporary wallet...
Funded temp wallet with 0.05 MATIC
ZK_VERIFIER_ADDRESS: 0x9E98DdFD14e47295a9e900a3dF332EcF6a9587B5
Error submitting proof: Error: insufficient funds for intrinsic transaction cost
...
from: '0xFDBcC3220892B18c892d3baEF3C34C67Bc9504c1',
...
to: '0x9E98DdFD14e47295a9e900a3dF332EcF6a9587B5',
`;

// Extract all addresses from the logs
const addressRegex = /0x[0-9a-fA-F]{40}/g;
const addresses = consoleOutput.match(addressRegex) || [];

console.log('Addresses found in recent logs:\n');
const uniqueAddresses = [...new Set(addresses)];
uniqueAddresses.forEach(addr => {
  console.log(addr);
  if (addr.toLowerCase() === '0x5F4123Bc2359338194d9379306acB3E25fbc53c9'.toLowerCase()) {
    console.log('  ^ THIS IS THE ADDRESS YOU\'RE LOOKING FOR');
  }
});

// Check if it could be a temporary wallet that was generated
console.log('\nThe address 0x5F4123Bc2359338194d9379306acB3E25fbc53c9 could be:');
console.log('1. A temporary wallet generated during a previous test');
console.log('2. A user wallet that connected to the app');
console.log('3. An address from a different project or context');

// Notable addresses from logs:
console.log('\nIdentified addresses from logs:');
console.log('Service Wallet (Amoy): 0xD6bd1eFCE3A2c4737856724f96F39037a3564890');
console.log('ZK Verifier Contract: 0x9E98DdFD14e47295a9e900a3dF332EcF6a9587B5');
console.log('Temp Wallet (from error): 0xFDBcC3220892B18c892d3baEF3C34C67Bc9504c1');