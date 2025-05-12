import * as url from 'url';
import path from 'path';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

async function runTest() {
  try {
    // Dynamically import modules
    const walletHelpersModule = await import('./packages/common/src/utils/walletHelpers.js');
    const walletHelpers = walletHelpersModule;
    
    console.log('Module loaded successfully:', Object.keys(walletHelpers));
    
    const wallets = [{ address: '0x1234567890abcdef1234567890abcdef12345678' }];
    const options = { 
      chains: ['ethereum', 'polygon', 'amoy'],
      includeZeroBalances: true,
      includePotentialSpam: true
    };
    
    console.log('Testing scanMultiChainAssets with multiple chains including Polygon Amoy...');
    
    if (typeof walletHelpers.scanMultiChainAssets !== 'function') {
      console.error('scanMultiChainAssets is not a function!', typeof walletHelpers.scanMultiChainAssets);
      return;
    }
    
    const results = await walletHelpers.scanMultiChainAssets(wallets, options);
    
    console.log('Scan Results Summary:');
    console.log('Total assets found:', results.totalAssets.length);
    console.log('Total value:', results.totalValue);
    console.log('Chains scanned:', Object.keys(results.chains));
    console.log('Tokens by chain:');
    
    for (const chain in results.chains) {
      const nativeTokens = results.chains[chain].nativeBalance > 0 ? 1 : 0;
      const erc20Tokens = Object.keys(results.chains[chain].tokens).length;
      console.log(`  ${chain}: ${nativeTokens} native + ${erc20Tokens} ERC20 = ${nativeTokens + erc20Tokens} total`);
    }
    
    console.log('Metadata:', JSON.stringify(results.meta, null, 2));
    
    // Let's look at the first few tokens from each chain
    for (const chain in results.chains) {
      console.log(`\nSample tokens from ${chain}:`);
      const chainTokens = results.totalAssets.filter(token => token.chain === chain);
      const sampleTokens = chainTokens.slice(0, 3);
      
      for (const token of sampleTokens) {
        console.log(`  ${token.symbol} (${token.type}): ${token.balance_formatted} - $${token.usdValue} - Price Source: ${token.priceSource || 'unknown'}`);
      }
    }
  } catch (error) {
    console.error('Error testing scanMultiChainAssets:', error);
  }
}

runTest();