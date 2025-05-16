// Test file for rate limiting in token-agnostic wallet scanning
import { getWalletTokens, getWalletAssetsWithValue, getTokenPricesWithMoralis } from './packages/common/src/utils/moralisApi.js';
import { rateLimitStats } from './packages/common/src/utils/apiHelpers.js';

// Test wallet with many tokens for rate limit testing
const TEST_WALLET = '0x28c6c06298d514db089934071355e5743bf21d60';

// Test wallet with only a few tokens
const TEST_SMALL_WALLET = '0x85f33a6a53a1c89676A7171A55F87A5B0a181919';

// Chains to test
const TEST_CHAINS = ['ethereum', 'polygon'];

// Test tokens for price lookups
const TEST_TOKENS = [
  { symbol: 'eth', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', chain: 'ethereum', type: 'erc20' },
  { symbol: 'usdc', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', chain: 'ethereum', type: 'erc20' },
  { symbol: 'link', address: '0x514910771af9ca656af840dff83e8264ecf986ca', chain: 'ethereum', type: 'erc20' },
  { symbol: 'matic', address: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0', chain: 'ethereum', type: 'erc20' },
  { symbol: 'aave', address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', chain: 'ethereum', type: 'erc20' }
];

async function testRateLimiting() {
  console.log('Testing rate limiting management');

  // Test 1: Price lookup with rate limiting
  console.log('\n=== Test 1: Price lookup with rate limiting ===');
  console.time('getTokenPricesWithMoralis');
  const priceResult = await getTokenPricesWithMoralis(TEST_TOKENS, 'ethereum');
  console.timeEnd('getTokenPricesWithMoralis');
  
  console.log('Price results:', priceResult.prices);
  console.log('Price sources:', priceResult.detailed);
  console.log('Price metadata:', priceResult.meta);
  
  // Print rate limit stats
  console.log('\nRate Limit Stats after price lookup:');
  console.log(rateLimitStats.getStats());
  
  // Test 2: Small wallet scan
  console.log('\n=== Test 2: Small wallet scan with rate limiting ===');
  console.time('smallWalletScan');
  const smallWalletAssets = await getWalletAssetsWithValue(TEST_SMALL_WALLET, 'ethereum');
  console.timeEnd('smallWalletScan');
  
  console.log(`Retrieved ${smallWalletAssets.totalAssets.length} tokens for small wallet`);
  console.log('Small wallet metadata:', smallWalletAssets.meta);
  
  // Print rate limit stats again
  console.log('\nRate Limit Stats after small wallet scan:');
  console.log(rateLimitStats.getStats());
  
  // Test 3: Multiple asset scans in parallel (to trigger rate limiting)
  console.log('\n=== Test 3: Multiple asset scans in parallel ===');
  console.time('parallelScans');
  const [ethTokens, polyTokens] = await Promise.all([
    getWalletTokens(TEST_WALLET, 'ethereum'),
    getWalletTokens(TEST_WALLET, 'polygon')
  ]);
  console.timeEnd('parallelScans');
  
  console.log(`Retrieved ${ethTokens.length} tokens on Ethereum and ${polyTokens.length} tokens on Polygon`);
  
  // Check if pagination metadata is present
  const ethPaginationData = ethTokens.find(t => t.pagination)?.pagination;
  if (ethPaginationData) {
    console.log('\nEthereum pagination data:');
    console.log(`Total pages: ${ethPaginationData.totalPages}`);
    console.log(`Total tokens: ${ethPaginationData.totalTokens}`);
  }
  
  // Print final rate limit stats
  console.log('\nFinal Rate Limit Stats:');
  console.log(rateLimitStats.getStats());
}

// Run the test
testRateLimiting().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});