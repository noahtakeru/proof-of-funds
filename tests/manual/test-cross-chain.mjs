// Test file for cross-chain asset organization
import { getWalletAssetsWithValue } from './packages/common/src/utils/moralisApi.js';
import { scanMultiChainAssets } from './packages/common/src/utils/walletHelpers.js';
import { 
  organizeAssetsByCrossChain, 
  enhanceTokenWithChainData 
} from './packages/common/src/utils/apiHelpers.js';

// Test wallet with tokens on multiple chains
const TEST_WALLET = '0x4675c7e5baafbffbca748158becba61ef3b0a263';

// Test chains to scan (including at least one testnet)
const TEST_CHAINS = ['ethereum', 'polygon', 'polygon-amoy'];

// Test asset data for direct organization
const TEST_ASSETS = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    token_address: '0xNative',
    balance: 1.5,
    usdValue: 3000,
    chain: 'ethereum',
    type: 'native'
  },
  {
    symbol: 'ETH',
    name: 'Arbitrum ETH',
    token_address: '0xNative',
    balance: 0.5,
    usdValue: 1000,
    chain: 'arbitrum',
    type: 'native'
  },
  {
    symbol: 'MATIC',
    name: 'Polygon',
    token_address: '0xNative',
    balance: 100,
    usdValue: 50,
    chain: 'polygon',
    type: 'native'
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    token_address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    balance: 500,
    usdValue: 500,
    chain: 'ethereum',
    type: 'erc20'
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    token_address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    balance: 250,
    usdValue: 250,
    chain: 'polygon',
    type: 'erc20'
  }
];

async function testCrossChainOrganization() {
  console.log('Testing cross-chain asset organization');

  // Test 1: Direct Cross-Chain Organization
  console.log('\n=== Test 1: Direct Cross-Chain Organization ===');
  
  // Add chain data to test assets
  const assetsWithChainData = TEST_ASSETS.map(asset => 
    enhanceTokenWithChainData(asset, asset.chain)
  );
  
  // Organize assets
  const organized = organizeAssetsByCrossChain(assetsWithChainData);
  
  console.log(`Organized ${TEST_ASSETS.length} assets into ${organized.crossChainSummary.length} groups`);
  
  // Print cross-chain grouping summary
  organized.crossChainSummary.forEach(group => {
    console.log(`\n${group.symbol} (${group.name})`);
    console.log(`Total value: $${group.totalUsdValue}`);
    console.log(`Chains: ${group.chains.join(', ')}`);
    console.log('Instances:');
    group.instances.forEach(instance => {
      console.log(`  ${instance.chain}: ${instance.balance} ($${instance.usdValue})`);
    });
  });

  // Test 2: Single-Chain Wallet Asset Fetching with Cross-Chain Organization
  console.log('\n=== Test 2: Single-Chain Wallet Asset Fetching ===');
  
  console.time('singleChainAssets');
  const ethAssets = await getWalletAssetsWithValue(TEST_WALLET, 'ethereum');
  console.timeEnd('singleChainAssets');
  
  console.log(`Retrieved ${ethAssets.totalAssets.length} assets on Ethereum`);
  console.log(`Cross-chain organization found ${ethAssets.crossChain.crossChainSummary.length} asset groups`);
  
  // Show some cross-chain data
  const sampleAssets = ethAssets.crossChain.crossChainSummary.slice(0, 2);
  if (sampleAssets.length > 0) {
    console.log('\nSample cross-chain assets:');
    sampleAssets.forEach(asset => {
      console.log(`\n${asset.symbol} (${asset.name})`);
      console.log(`Instances: ${asset.instances.length}`);
      console.log(`Total USD Value: $${asset.totalUsdValue}`);
    });
  }

  // Test 3: Multi-Chain Wallet Scanning with Cross-Chain Organization
  console.log('\n=== Test 3: Multi-Chain Wallet Scanning ===');
  
  console.time('multiChainAssets');
  const multiChainAssets = await scanMultiChainAssets(
    [{ address: TEST_WALLET }], 
    { chains: TEST_CHAINS }
  );
  console.timeEnd('multiChainAssets');
  
  console.log(`Retrieved ${multiChainAssets.totalAssets.length} assets across ${TEST_CHAINS.length} chains`);
  
  if (multiChainAssets.crossChain) {
    console.log(`Cross-chain organization found ${multiChainAssets.crossChain.crossChainSummary.length} asset groups`);
    console.log(`Multi-chain tokens: ${multiChainAssets.meta.crossChainSummary.multiChainTokens}`);
    
    // Show multi-chain tokens (tokens that exist on multiple chains)
    const multiChainTokens = multiChainAssets.crossChain.crossChainSummary
      .filter(asset => asset.chainCount > 1)
      .slice(0, 3);
      
    if (multiChainTokens.length > 0) {
      console.log('\nSample multi-chain tokens:');
      multiChainTokens.forEach(token => {
        console.log(`\n${token.symbol} (${token.name})`);
        console.log(`On chains: ${token.chains.join(', ')}`);
        console.log(`Total USD Value across chains: $${token.totalUsdValue}`);
        token.instances.forEach(instance => {
          console.log(`  ${instance.chain}: ${instance.balance_formatted} ($${instance.usdValue})`);
        });
      });
    }
  }
}

// Run the test
testCrossChainOrganization().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});