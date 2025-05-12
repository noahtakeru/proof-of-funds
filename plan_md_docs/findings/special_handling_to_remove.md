# Special Handling and Filtering to Remove

After analyzing the codebase, I've identified several areas where special handling or implicit filtering occurs that should be removed or modified to create a truly token-agnostic wallet scanning system.

## 1. Token Price Approach in `moralisApi.js`

### Current Issues:
- **CoinGecko Priority**: The code gets prices from CoinGecko instead of using Moralis's price API
- **Limited Token Mapping**: Uses a hardcoded mapping of tokens to CoinGecko IDs:
  ```javascript
  const coinGeckoMap = {
    'eth': 'ethereum',
    'weth': 'weth',
    'usdc': 'usd-coin',
    // ... more mappings
  };
  ```
- **Token Prioritization**: This implicitly filters tokens because only tokens in this mapping get prices

### Recommended Changes:
- Use Moralis token price API as primary source
- Use CoinGecko as fallback only when Moralis doesn't have price data
- Return all tokens regardless of price availability (with zero price if unknown)
- Remove the dependency on predefined token lists

## 2. Token Balance Filtering in `getWalletTokens()`

### Current Issues:
- **Zero Balance Filtering**: 
  ```javascript
  // Only add tokens with positive balances
  if (formattedBalance > 0) {
    tokens.push({
      // token data
    });
  }
  ```
  This removes zero-balance tokens, which might be desired but should be explicit

### Recommended Changes:
- Return all tokens and let the UI decide what to display
- Add a parameter to control zero-balance filtering if needed
- Ensure consistent treatment of all tokens regardless of type

## 3. Chain Special Handling in `scanMultiChainAssets()`

### Current Issues:
- **Chain-Specific Logic**: Different chains have special fallback logic
- **Chain Detection**: Multiple chain detection approaches which could be inconsistent

### Recommended Changes:
- Create unified chain detection approach
- Use consistent chainId to name mapping across the codebase
- Make chain support completely agnostic
- Ensure Polygon Amoy works the same as other chains

## 4. Implicit Token Filtering in UI Component

### Current Issues:
- The `MultiChainAssetDisplay` component might not display all tokens equally
- Chain-specific components might have different display logic

### Recommended Changes:
- Ensure UI components display all tokens without filtering
- Make display logic chain-agnostic
- Display tokens consistently regardless of price availability

## 5. "Test" Data and Special Cases

### Current Issues:
- Previous code had hardcoded test data (now removed)
- Special handling might still exist in edge cases

### Recommended Changes:
- Ensure all remaining test data is removed
- Make error handling consistent for all cases
- Remove any special case handling for specific chains

## 6. Price Source Priority

### Current Issues:
- The current implementation attempts to get prices from:
  1. Local API proxy (likely CoinGecko-based)
  2. Direct CoinGecko API
  3. No direct use of Moralis price endpoint

### Recommended Changes:
- Implement proper Moralis price endpoint usage first
- Use CoinGecko as secondary source
- Add proper tracking of price source
- Don't filter based on price availability

## 7. Testnet Token Handling in `getTokenPrices()`

### Current Issue:
- Had special handling for testnet tokens (now commented out):
  ```javascript
  // Handle special cases for testnet tokens
  for (const originalSymbol of symbols) {
    const lowercaseSymbol = originalSymbol.toLowerCase();
    
    // We don't do any special handling for testnet tokens anymore
    // If there's no price for a symbol, it will be set to 0 in the finalPrices object
  }
  ```

### Recommended Changes:
- Remove commented code completely
- Ensure testnets are treated the same as mainnets
- If testnet tokens need price approximations, make it configurable
- Don't apply special rules to specific testnets (like Amoy)

## Conclusion

The main theme is to remove any special handling based on:
1. Token type or popularity
2. Chain type (mainnet vs testnet)
3. Price availability

The goal is a completely agnostic system that:
- Discovers ALL tokens on ANY chain
- Retrieves prices when available without filtering
- Presents all data to the user regardless of token type
- Handles all chains consistently

This approach will ensure users see ALL of their assets without any filtering or special handling - from major tokens like ETH to obscure tokens like "$FARTCOIN" as mentioned in the requirements.