// Test file for performance optimizations
import { getWalletTokens, getWalletAssetsWithValue, getTokenPricesWithMoralis } from './packages/common/src/utils/moralisApi.js';
import { cache, optimizeChainOrder } from './packages/common/src/utils/apiHelpers.js';

// Binance Hot Wallet (big wallet with many tokens)
const TEST_WALLET = '0x28c6c06298d514db089934071355e5743bf21d60';

// Test tokens for price lookups
const TEST_TOKENS = [
  { symbol: 'eth', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', chain: 'ethereum', type: 'erc20' },
  { symbol: 'usdc', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', chain: 'ethereum', type: 'erc20' },
  { symbol: 'link', address: '0x514910771af9ca656af840dff83e8264ecf986ca', chain: 'ethereum', type: 'erc20' },
  { symbol: 'matic', address: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0', chain: 'ethereum', type: 'erc20' },
  { symbol: 'aave', address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', chain: 'ethereum', type: 'erc20' }
];

// Chain scanning order test
const TEST_CHAINS = [
  'polygon-amoy', 
  'ethereum', 
  'bsc', 
  'goerli', 
  'fantom', 
  'arbitrum'
];

async function testPerformance() {
  console.log('Testing performance optimizations');

  // Test 1: Test Chain Order Optimization
  console.log('\n=== Test 1: Chain Order Optimization ===');
  const optimizedChains = optimizeChainOrder(TEST_CHAINS);
  console.log('Original order:', TEST_CHAINS);
  console.log('Optimized order:', optimizedChains);

  // Test 2: Cache Initialization and Statistics
  console.log('\n=== Test 2: Cache Initialization ===');
  console.log('Initial cache stats:', cache.getStats());

  // Test 3: Token Prices with Cache (First Run - Without Cache)
  console.log('\n=== Test 3a: Token Prices (First Run - No Cache) ===');
  console.time('firstPriceRun');
  const priceResult1 = await getTokenPricesWithMoralis(TEST_TOKENS, 'ethereum');
  console.timeEnd('firstPriceRun');
  
  console.log('Price results:', priceResult1.prices);
  console.log('Price metadata:', priceResult1.meta);
  console.log('Cache stats after first price run:', cache.getStats());

  // Test 4: Token Prices with Cache (Second Run - With Cache)
  console.log('\n=== Test 4: Token Prices (Second Run - With Cache) ===');
  console.time('secondPriceRun');
  const priceResult2 = await getTokenPricesWithMoralis(TEST_TOKENS, 'ethereum');
  console.timeEnd('secondPriceRun');
  
  console.log('Cached price results:', priceResult2.prices);
  console.log('Cache stats after second price run:', cache.getStats());

  // Test 5: Token Fetching with Cache (First Run - Without Cache)
  console.log('\n=== Test 5: Token Fetching (First Run - No Cache) ===');
  console.time('firstTokenRun');
  const tokens1 = await getWalletTokens(TEST_WALLET, 'ethereum');
  console.timeEnd('firstTokenRun');
  
  console.log(`Retrieved ${tokens1.length} tokens on first run`);
  console.log('Cache stats after first token run:', cache.getStats());

  // Test 6: Token Fetching with Cache (Second Run - With Cache)
  console.log('\n=== Test 6: Token Fetching (Second Run - With Cache) ===');
  console.time('secondTokenRun');
  const tokens2 = await getWalletTokens(TEST_WALLET, 'ethereum');
  console.timeEnd('secondTokenRun');
  
  console.log(`Retrieved ${tokens2.length} tokens on second run`);
  console.log('Cache stats after second token run:', cache.getStats());

  // Test 7: Cache Impact Summary
  console.log('\n=== Test 7: Cache Impact Summary ===');
  console.log('Final cache statistics:', cache.getStats());
}

// Run the test
testPerformance().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});