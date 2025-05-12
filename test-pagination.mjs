// Test file for token-agnostic wallet scanning with pagination
import { getWalletTokens, getWalletAssetsWithValue } from './packages/common/src/utils/moralisApi.js';

// Binance Hot Wallet - known to have 100+ tokens
const TEST_WALLET = '0x28c6c06298d514db089934071355e5743bf21d60';

// Chains to test
const TEST_CHAINS = ['ethereum'];

// Options for scanning
const options = {
  includeZeroBalances: true,
  includePotentialSpam: true
};

async function testPagination() {
  console.log(`Testing pagination with wallet: ${TEST_WALLET}`);
  console.log('Options:', options);
  
  for (const chain of TEST_CHAINS) {
    console.log(`\n====== Testing on chain: ${chain} ======\n`);
    
    console.log('Getting tokens with pagination...');
    console.time('getWalletTokens');
    const tokens = await getWalletTokens(TEST_WALLET, chain, options);
    console.timeEnd('getWalletTokens');
    
    console.log(`Retrieved ${tokens.length} tokens`);
    
    // Check if we have pagination metadata
    const paginationData = tokens.find(t => t.pagination)?.pagination;
    if (paginationData) {
      console.log('Pagination data:', paginationData);
      console.log(`Total pages processed: ${paginationData.totalPages}`);
      console.log(`Total tokens seen: ${paginationData.totalTokens}`);
    } else {
      console.log('No pagination data found');
    }
    
    // Now get assets with value
    console.log('\nGetting assets with values...');
    console.time('getWalletAssetsWithValue');
    const assets = await getWalletAssetsWithValue(TEST_WALLET, chain, options);
    console.timeEnd('getWalletAssetsWithValue');
    
    console.log(`Total assets with values: ${assets.totalAssets.length}`);
    console.log('Metadata:', assets.meta);
    
    // Output the first few tokens
    console.log('\nSample tokens:');
    const sampleTokens = assets.totalAssets.slice(0, 3);
    for (const token of sampleTokens) {
      console.log(`- ${token.symbol} (${token.name}): ${token.balance} @ $${token.price} = $${token.usdValue}`);
      console.log(`  Source: ${token.priceSource}, Page: ${token.page || 'N/A'}`);
    }
  }
}

// Run the test
testPagination().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});