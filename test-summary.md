# Token-Agnostic Wallet Scanning Test Suite

This document provides an overview of the test files created to verify the token-agnostic wallet scanning implementation, particularly the enhancements made in Phase 5 (Resilience and Optimization).

## Test Files

### 1. test-pagination.mjs
**Purpose**: Verifies the pagination support for retrieving large token collections.
**Key Tests**:
- Get tokens for a large wallet (Binance hot wallet) that requires pagination
- Confirm proper handling of cursor-based pagination
- Ensure all tokens are retrieved across multiple pages
- Verify pagination metadata is properly included in responses

### 2. test-rate-limits.mjs
**Purpose**: Tests the rate limiting and queue management system.
**Key Tests**:
- Perform multiple simultaneous API requests to trigger rate limit handling
- Test Moralis API rate limit queue
- Test CoinGecko API rate limit queue
- Verify stats tracking for rate limit monitoring
- Ensure no rate limit errors occur during heavy API usage

### 3. test-token-metadata.mjs
**Purpose**: Verifies the token metadata handling and sanitization.
**Key Tests**:
- Test handling of tokens with missing data
- Test handling of tokens with excessively long names/symbols
- Test handling of tokens with non-printable characters
- Test fallback display information for tokens with missing metadata
- Verify native token defaults by chain

### 4. test-performance.mjs
**Purpose**: Tests the performance optimizations including caching.
**Key Tests**:
- Measure performance with and without caching
- Test chain optimization order
- Verify cache hit rate for repeated operations
- Compare API call count reduction with caching enabled
- Validate proper TTL (time-to-live) behavior for cached items

### 5. test-cross-chain.mjs
**Purpose**: Tests cross-chain asset organization functionality.
**Key Tests**:
- Test grouping of same token across multiple chains
- Verify chain metadata enhancement
- Test organization of assets by normalized symbol
- Verify multi-chain token detection and summation
- Test inclusion of cross-chain data in API responses

## Running the Tests

Each test file can be run independently using Node.js:

```
node test-pagination.mjs
node test-rate-limits.mjs
node test-token-metadata.mjs
node test-performance.mjs
node test-cross-chain.mjs
```

For comprehensive testing of all aspects of the implementation, run each test in sequence. The tests use real API calls to Moralis and CoinGecko, so they may take some time to complete, especially for large wallets.

## Expected Results

When all tests are successful, you should see:

1. Proper pagination of large token collections
2. Rate limiting handling without API errors
3. Consistent token metadata even with problematic inputs
4. Significant performance improvements from caching
5. Logical organization of tokens across multiple chains

Any errors or failures will be clearly logged to the console with detailed error information.

## Test Wallets

The tests use the following wallet addresses:

- `0x28c6c06298d514db089934071355e5743bf21d60` - Binance hot wallet (100+ tokens, for pagination testing)
- `0x4675c7e5baafbffbca748158becba61ef3b0a263` - Test wallet with tokens on multiple chains
- `0x85f33a6a53a1c89676A7171A55F87A5B0a181919` - Smaller wallet for performance testing

## Test Chains

The tests cover multiple chains including:
- Ethereum (mainnet)
- Polygon (mainnet)
- Polygon Amoy (testnet)
- BSC (Binance Smart Chain)
- Arbitrum
- Fantom

The testnet chains are specifically included to verify the chain-agnostic implementation works equally well on both mainnet and testnet chains.