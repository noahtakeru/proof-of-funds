# Known Limitations of Token-Agnostic Wallet Scanning

This document outlines the known limitations of the token-agnostic wallet scanning implementation. These limitations should be considered when using the system or planning future enhancements.

## Moralis API Limitations

1. **Chain Support**: 
   - Limited to chains supported by Moralis API (currently includes Ethereum, Polygon, BSC, Arbitrum, Avalanche, Fantom, Optimism, Cronos, and Base, plus associated testnets)
   - Some L2 chains or emerging networks may not be supported
   - Chain support is determined by Moralis and may change over time

2. **Rate Limits**:
   - Free tier: 5 requests per second
   - Basic tier: 25 requests per second
   - Business tier: 50+ requests per second
   - Our implementation includes rate limiting but may still experience throttling on heavy usage

3. **Request Quotas**:
   - Daily request quotas apply based on Moralis subscription tier
   - Current implementation doesn't track remaining quota across sessions

4. **Token Detection**:
   - Might miss very new or unusual token standards not fully supported by Moralis
   - Primarily supports ERC20 tokens and native chain tokens

## CoinGecko API Limitations

1. **Token Coverage**:
   - Not all tokens have price data available, especially newer or less popular tokens
   - Tokens with price = 0 in the result may actually have a value that's not tracked

2. **Rate Limits**:
   - Free tier: ~10-15 calls per minute
   - Pro tiers: Higher limits but still restricted
   - Our implementation includes automatic rate limiting but may experience failures during heavy usage

3. **Coin ID Mapping**:
   - Using symbol-to-ID mapping is imperfect as symbols aren't guaranteed unique
   - Some tokens may be incorrectly priced due to symbol collisions

## Performance Considerations

1. **Large Wallets**:
   - Wallets with 100+ tokens will experience longer load times
   - Pagination is implemented but still requires multiple API calls
   - Initial load for very large wallets (1000+ tokens) may take 10+ seconds

2. **Multi-Chain Scanning**:
   - Scanning multiple chains simultaneously increases API usage
   - Default scanning of 6 chains requires at least 6 API calls plus price fetching
   - Consider selective chain scanning for performance-critical applications

3. **Caching**:
   - Session storage caching helps with repeat scans, but has limits:
     - Limited by browser storage capacity (5-10MB typically)
     - Cleared when browser session ends
     - Default 5-minute TTL can be adjusted based on requirements

4. **Price Fetching**:
   - Getting prices for large sets of tokens requires multiple batched API calls
   - Some tokens may never return valid prices, leading to $0 value display

## Technical Limitations

1. **Asset Grouping**:
   - Cross-chain asset grouping relies on symbol matching which is imperfect
   - Different tokens with the same symbol will be grouped together
   - Complex for tokens that exist on multiple chains with different implementations

2. **Error Recovery**:
   - While the implementation includes retry mechanisms, persistent API failures will still cause errors
   - Chain-specific errors are isolated but can reduce the completeness of results

3. **Token Metadata**:
   - Some tokens have incomplete or malformed metadata
   - Fallback mechanisms are in place but may display simplified information

4. **Test Environment**:
   - Testing on Polygon Amoy (testnet) may differ slightly from production behavior
   - Testnet tokens typically have no real-world value or price data

## Recommendations

1. **Selective Chain Scanning**:
   - For performance-critical applications, consider letting users select which chains to scan
   - Consider implementing progressive loading of chain data

2. **Feedback Mechanism**:
   - Implement clear loading indicators and progress updates for users
   - Provide refresh button to bypass cache when needed

3. **Moralis Plan**:
   - Consider appropriate Moralis subscription tier based on expected usage
   - Track API usage to ensure staying within plan limits

4. **Price Data**:
   - Clearly indicate to users when price data is missing or potentially inaccurate
   - Consider additional price data sources for critical tokens

5. **Timeout Handling**:
   - Implement timeout controls for very large wallets
   - Consider pagination controls for displaying large asset lists
