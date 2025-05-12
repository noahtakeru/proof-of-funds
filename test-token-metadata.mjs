// Test file for token metadata handling
import { getWalletTokens } from './packages/common/src/utils/moralisApi.js';
import { sanitizeTokenMetadata, generateTokenDisplayInfo } from './packages/common/src/utils/apiHelpers.js';

// Test wallet addresses
const TEST_WALLET = '0x4675c7e5baafbffbca748158becba61ef3b0a263'; // Wallet with some unusual tokens

// Test problematic token data
const problematicTokens = [
  {
    // Token with missing data
    token_address: '0x1234567890abcdef1234567890abcdef12345678',
    balance: '1000000000000000000',
    chain: 'ethereum'
  },
  {
    // Token with excessively long symbol and name
    token_address: '0xabcdef1234567890abcdef1234567890abcdef12',
    symbol: 'REALLYLONGSYMBOLTHATSHOULDBETRUNCATEDBYOURSANITIZER',
    name: 'This is an incredibly long token name that has way too many characters and needs to be handled properly by our sanitization function',
    balance: '2000000000000000000',
    decimals: 18,
    chain: 'ethereum'
  },
  {
    // Token with non-printable characters
    token_address: '0x7890abcdef1234567890abcdef1234567890abcd',
    symbol: 'BAD\x00\x1FSYM\x7F',
    name: 'Problem\x00 Token\x1F Name\x7F',
    balance: '3000000000000000000',
    decimals: 18,
    chain: 'ethereum'
  },
  {
    // Native token with missing data
    token_address: '0xNative',
    type: 'native',
    balance: '4000000000000000000',
    chain: 'unknown'
  }
];

async function testTokenMetadataHandling() {
  console.log('Testing token metadata handling');
  
  // Test 1: Sanitize problematic tokens
  console.log('\n=== Test 1: Sanitize problematic tokens ===');
  for (const token of problematicTokens) {
    console.log(`\nBefore sanitization: ${token.symbol || 'NO SYMBOL'} (${token.name || 'NO NAME'})`);
    const sanitized = sanitizeTokenMetadata(token, token.chain);
    console.log(`After sanitization: ${sanitized.symbol} (${sanitized.name})`);
    console.log(`Balance: ${sanitized.balance_formatted}`);
  }
  
  // Test 2: Generate display info for tokens with missing metadata
  console.log('\n=== Test 2: Generate display info for tokens with missing metadata ===');
  
  // Native token without metadata
  const nativeTokenNoMetadata = {
    token_address: '0xNative',
    type: 'native',
    chain: 'ethereum',
    balance: '1000000000000000000',
    balance_formatted: '1'
  };
  
  // ERC20 token without metadata
  const erc20TokenNoMetadata = {
    token_address: '0xabcdef1234567890abcdef1234567890abcdef12',
    type: 'erc20',
    chain: 'polygon',
    balance: '2000000000000000000',
    balance_formatted: '2'
  };
  
  // Process and display
  const nativeWithDisplay = generateTokenDisplayInfo(nativeTokenNoMetadata);
  const erc20WithDisplay = generateTokenDisplayInfo(erc20TokenNoMetadata);
  
  console.log('\nNative token display info:');
  console.log(`Symbol: ${nativeWithDisplay.symbol}`);
  console.log(`Name: ${nativeWithDisplay.name}`);
  
  console.log('\nERC20 token display info:');
  console.log(`Symbol: ${erc20WithDisplay.symbol}`);
  console.log(`Name: ${erc20WithDisplay.name}`);
  
  // Test 3: Real wallet with token metadata
  console.log('\n=== Test 3: Real wallet token metadata ===');
  
  // Get wallet tokens 
  console.log(`\nGetting tokens for wallet ${TEST_WALLET}...`);
  const tokens = await getWalletTokens(TEST_WALLET, 'polygon');
  
  console.log(`Retrieved ${tokens.length} tokens. Examining a few tokens:`);
  
  // Show a few tokens
  const sampleTokens = tokens.slice(0, 3);
  for (const token of sampleTokens) {
    console.log(`\n${token.symbol} (${token.name}):`);
    console.log(`Address: ${token.token_address}`);
    console.log(`Balance: ${token.balance_formatted}`);
    console.log(`Type: ${token.type}`);
    console.log(`Spam: ${token.possible_spam ? 'Yes' : 'No'}`);
  }
}

// Run the test
testTokenMetadataHandling().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});