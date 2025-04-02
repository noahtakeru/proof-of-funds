/**
 * Moralis API Integration
 * 
 * Utility functions for fetching wallet balances and token data across multiple
 * blockchains using Moralis APIs.
 */

// Moralis API utilities
import { ethers } from 'ethers';

// Import fetchPricesForSymbols from walletHelpers
// Using dynamic import to avoid circular dependencies
async function fetchPricesForTokenSymbols(symbols) {
    // We use dynamic import to avoid circular dependencies
    const walletHelpers = await import('./walletHelpers');
    return walletHelpers.fetchPricesForSymbols(symbols);
}

// Store this in an environment variable in production
const MORALIS_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImI3NTZhNjkxLTRiN2YtNGFiZS04MzI5LWFlNTJkMGY5MTljOSIsIm9yZ0lkIjoiNDM4NjMwIiwidXNlcklkIjoiNDUxMjU4IiwidHlwZUlkIjoiMTc1YjllYzktYmQ3Ni00NWNhLTk1NWItZTBlOTAzNzM1YTlkIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NDMyMzMyNjYsImV4cCI6NDg5ODk5MzI2Nn0.bLFdmNSmPM51zuRhxDmQ-YN1V-II9Mtd-FxdvZHkmys';

// Chain mapping for common blockchain networks
const CHAIN_MAPPING = {
    // Mainnets
    'ethereum': 'eth',
    'polygon': 'polygon',
    'binance': 'bsc',
    'avalanche': 'avalanche',
    'arbitrum': 'arbitrum',
    'optimism': 'optimism',
    'base': 'base',
    'fantom': 'fantom',
    'cronos': 'cronos',
    'palm': 'palm',

    // Testnets
    'goerli': 'goerli',
    'sepolia': 'sepolia',
    'mumbai': 'mumbai',
    'bsc testnet': 'bsc testnet',

    // Special cases
    'hardhat local': 'hardhat',
    'hardhat': 'hardhat'
};

/**
 * Maps a user-friendly chain name to a Moralis API chain identifier
 * @param {string} chain - The user-friendly chain name
 * @returns {string} - The Moralis API chain identifier
 */
const getMoralisChain = (chain) => {
    const chainMap = {
        'ethereum': 'eth',
        'eth': 'eth',
        'polygon': 'polygon',
        'matic': 'polygon',
        'bsc': 'bsc',
        'binance': 'bsc',
        'bnb chain': 'bsc',
        'avalanche': 'avalanche',
        'avax': 'avalanche',
        'fantom': 'fantom',
        'ftm': 'fantom',
        'cronos': 'cronos',
        'solana': 'solana',
        'sol': 'solana',
        'bitcoin': 'btc',
        'btc': 'btc',
        'bitcoin testnet': 'btc testnet'
    };

    return chainMap[chain.toLowerCase()] || chain.toLowerCase();
};

/**
 * Gets information about a native token for a chain
 * @param {string} chain - The chain name
 * @returns {Object} - Object with symbol and name properties
 */
const getNativeTokenInfo = (chain) => {
    const nativeInfo = {
        'ethereum': { symbol: 'ETH', name: 'Ethereum' },
        'polygon': { symbol: 'MATIC', name: 'Polygon' },
        'bsc': { symbol: 'BNB', name: 'BNB' },
        'avalanche': { symbol: 'AVAX', name: 'Avalanche' },
        'fantom': { symbol: 'FTM', name: 'Fantom' },
        'cronos': { symbol: 'CRO', name: 'Cronos' },
        'solana': { symbol: 'SOL', name: 'Solana' },
        'hardhat': { symbol: 'ETH', name: 'Ethereum' },
        'hardhat local': { symbol: 'ETH', name: 'Ethereum' },
        'bitcoin': { symbol: 'BTC', name: 'Bitcoin' },
        'btc': { symbol: 'BTC', name: 'Bitcoin' }
    };

    return nativeInfo[chain.toLowerCase()] || { symbol: 'ETH', name: 'Ethereum' };
};

/**
 * Creates mock token balances for development and testing
 * @param {string} address - The wallet address
 * @param {string} chain - The chain name
 * @returns {Array} - Array of mock token balances
 */
const getMockTokenBalances = (address, chain) => {
    const { symbol, name } = getNativeTokenInfo(chain);

    return [
        {
            token_address: '0xNative',
            symbol: symbol,
            name: name,
            logo: null,
            thumbnail: null,
            decimals: 18,
            balance: '10000000000000000000000',
            balance_formatted: '10000',
            type: 'native',
            usd_price: 2000,
            usd_value: 20000000
        },
        {
            token_address: '0x1234567890123456789012345678901234567890',
            symbol: 'USDC',
            name: 'USD Coin',
            logo: null,
            thumbnail: null,
            decimals: 6,
            balance: '5000000000',
            balance_formatted: '5000',
            type: 'erc20',
            usd_price: 1,
            usd_value: 5000
        }
    ];
};

/**
 * Gets token balances for a wallet on the specified chain using Moralis API
 * @param {string} walletAddress - The wallet address to check
 * @param {string} chain - The chain to check (ethereum, polygon, bsc, solana, etc.)
 * @returns {Promise<Array<Object>>} - Array of token objects with balance and metadata
 */
export const getWalletTokenBalances = async (walletAddress, chain = 'ethereum') => {
    console.log(`🔍 Getting token balances for ${walletAddress} on ${chain}...`);

    try {
        // Handle special cases where chains have different values in Moralis API
        let moralisChain = getMoralisChain(chain);

        // Normalize the wallet address for case-insensitive matching
        const normalizedAddress = walletAddress.toLowerCase();

        // For development, we can return mock data to avoid using Moralis API
        if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
            return getMockTokenBalances(normalizedAddress, chain);
        }

        // Get the API key from the environment
        const apiKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY || MORALIS_API_KEY;
        if (!apiKey) {
            console.warn('Moralis API key not found in environment variables - using mock data for testing');
            return getMockTokenBalances(normalizedAddress, chain);
        }

        // Assemble base URL for token balances endpoint
        let url;
        let tokenResults = [];

        if (moralisChain === 'solana') {
            // For Solana
            url = `https://deep-index.moralis.io/api/v2.2/wallets/${normalizedAddress}/tokens`;
        } else {
            // For EVM chains
            url = `https://deep-index.moralis.io/api/v2.2/${normalizedAddress}/erc20`;
            if (moralisChain) {
                url += `?chain=${moralisChain}`;
            }
        }

        // Make the API request
        const response = await fetch(url, {
            headers: {
                'accept': 'application/json',
                'X-API-Key': apiKey
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Parse the response
        const data = await response.json();
        const result = data.result || [];

        console.log(`📊 Found ${result.length} tokens on ${chain} for ${walletAddress}`);

        // Process ERC20 tokens with prices
        if (result && result.length > 0) {
            tokenResults = await Promise.all(
                result.map(async (token) => {
                    // Process token data
                    const tokenData = {
                        token_address: token.token_address,
                        symbol: token.symbol || 'UNKNOWN',
                        name: token.name || 'Unknown Token',
                        logo: token.logo || null,
                        thumbnail: token.thumbnail || null,
                        decimals: parseInt(token.decimals || '18'),
                        balance: token.balance || '0',
                        balance_formatted: token.balance
                            ? (parseFloat(token.balance) / Math.pow(10, parseInt(token.decimals || '18'))).toString()
                            : '0',
                        type: 'erc20'
                    };

                    console.log(`💼 Token: ${tokenData.symbol}, Balance: ${tokenData.balance_formatted}`);

                    // Get token price if available
                    try {
                        // For well-known tokens, use fetchPricesForSymbols to ensure we get CoinGecko prices
                        if (['USDC', 'USDT', 'DAI', 'WETH', 'WBTC', 'WMATIC', 'WBNB'].includes(tokenData.symbol)) {
                            console.log(`🔍 Getting CoinGecko price for ${tokenData.symbol}...`);
                            const priceData = await fetchPricesForTokenSymbols([tokenData.symbol]);

                            if (priceData && priceData.length > 0 && priceData[0].price) {
                                const price = priceData[0].price;
                                tokenData.usd_price = price;
                                tokenData.usd_value = parseFloat(tokenData.balance_formatted) * price;

                                console.log(`💰 ${tokenData.symbol}: $${price.toFixed(6)} × ${tokenData.balance_formatted} = $${tokenData.usd_value.toFixed(2)} USD [CoinGecko]`);

                                // Filter out tokens with very low value (likely spam)
                                if (tokenData.usd_value < 0.01) {
                                    console.log(`⚠️ Skipping ${tokenData.symbol} due to low value ($${tokenData.usd_value})`);
                                    return null;
                                }
                            } else {
                                console.log(`⚠️ No CoinGecko price found for ${tokenData.symbol}, trying Moralis`);
                                // Fall through to use Moralis
                            }
                        }

                        // If no CoinGecko price or not a well-known token, use Moralis
                        if (!tokenData.usd_price) {
                            const tokenPrice = await getTokenPrice(token.token_address, moralisChain);
                            if (tokenPrice && tokenPrice.usdPrice) {
                                tokenData.usd_price = tokenPrice.usdPrice;
                                tokenData.usd_value = parseFloat(tokenData.balance_formatted) * tokenPrice.usdPrice;

                                console.log(`💰 ${tokenData.symbol}: $${tokenPrice.usdPrice.toFixed(6)} × ${tokenData.balance_formatted} = $${tokenData.usd_value.toFixed(2)} USD [Moralis]`);

                                // Filter out tokens with very low value (likely spam)
                                if (tokenData.usd_value < 0.01) {
                                    console.log(`⚠️ Skipping ${tokenData.symbol} due to low value ($${tokenData.usd_value})`);
                                    return null;
                                }
                            } else {
                                // If no price data available, this might be spam
                                console.log(`⚠️ No price data for ${tokenData.symbol}, skipping as possible spam`);
                                return null;
                            }
                        }
                    } catch (priceError) {
                        console.warn(`❌ Error getting price for token ${token.symbol}:`, priceError);
                        // Return null to filter out tokens without price data
                        return null;
                    }

                    return tokenData;
                })
            );

            // Filter out null values (tokens we decided to skip)
            tokenResults = tokenResults.filter(token => token !== null);
        }

        // Get native token balance (ETH, MATIC, BNB, etc.)
        try {
            let nativeBalanceUrl;

            if (moralisChain === 'solana') {
                nativeBalanceUrl = `https://deep-index.moralis.io/api/v2.2/wallets/${normalizedAddress}/nativeBalance?chain=${moralisChain}`;
            } else {
                nativeBalanceUrl = `https://deep-index.moralis.io/api/v2.2/${normalizedAddress}/balance?chain=${moralisChain}`;
            }

            const nativeResponse = await fetch(nativeBalanceUrl, {
                headers: {
                    'accept': 'application/json',
                    'X-API-Key': apiKey
                }
            });

            if (nativeResponse.ok) {
                const nativeData = await nativeResponse.json();

                // Get native token symbol and name
                const { symbol, name } = getNativeTokenInfo(chain);

                // Parse the native balance
                let nativeBalance;
                let nativeBalanceFormatted;

                if (moralisChain === 'solana') {
                    nativeBalance = nativeData.solana || '0';
                    // Solana uses 9 decimals
                    nativeBalanceFormatted = (parseFloat(nativeBalance) / 1000000000).toString();
                } else {
                    nativeBalance = nativeData.balance || '0';
                    // Most EVM chains use 18 decimals
                    nativeBalanceFormatted = ethers.utils.formatEther(nativeBalance);
                }

                console.log(`💼 Native: ${symbol}, Balance: ${nativeBalanceFormatted}`);

                // Create native token object
                const nativeToken = {
                    token_address: '0xNative',
                    symbol: symbol,
                    name: name,
                    logo: null, // Could add logos for well-known chains
                    thumbnail: null,
                    decimals: moralisChain === 'solana' ? 9 : 18,
                    balance: nativeBalance,
                    balance_formatted: nativeBalanceFormatted,
                    type: 'native'
                };

                // Try to get the native token price from CoinGecko
                try {
                    console.log(`🔍 Getting CoinGecko price for native ${symbol}...`);
                    const priceData = await fetchPricesForTokenSymbols([symbol]);

                    if (priceData && priceData.length > 0 && priceData[0].price) {
                        const price = priceData[0].price;
                        nativeToken.usd_price = price;
                        nativeToken.usd_value = parseFloat(nativeBalanceFormatted) * price;

                        console.log(`💰 ${symbol}: $${price.toFixed(6)} × ${nativeBalanceFormatted} = $${nativeToken.usd_value.toFixed(2)} USD [CoinGecko]`);
                    } else {
                        // Fallback to getNativeTokenPrice
                        const nativePrice = await getNativeTokenPrice(chain);
                        if (nativePrice) {
                            nativeToken.usd_price = nativePrice;
                            nativeToken.usd_value = parseFloat(nativeBalanceFormatted) * nativePrice;

                            console.log(`💰 ${symbol}: $${nativePrice.toFixed(6)} × ${nativeBalanceFormatted} = $${nativeToken.usd_value.toFixed(2)} USD [Fallback]`);
                        }
                    }
                } catch (nativePriceError) {
                    console.warn(`❌ Error getting native token price for ${chain}:`, nativePriceError);
                }

                // Add native token to beginning of results
                tokenResults.unshift(nativeToken);
            }
        } catch (nativeError) {
            console.error('❌ Error getting native balance:', nativeError);
        }

        return tokenResults;
    } catch (error) {
        console.error('❌ Error in getWalletTokenBalances:', error);
        return [];
    }
};

/**
 * Gets token price data with caching to reduce API calls
 * 
 * @param {string} tokenAddress - Token contract address
 * @param {string} chain - Chain identifier
 * @returns {Promise<Object>} - Price data
 */
export const getTokenPrice = async (tokenAddress, chain) => {
    // Normalize inputs
    const normalizedToken = tokenAddress.toLowerCase();
    const normalizedChain = chain.toLowerCase();
    const cacheKey = `${normalizedChain}-${normalizedToken}`;
    const now = Date.now();
    const cacheExpiration = 10 * 60 * 1000; // 10 minutes

    // Set up tokenPriceCache in the appropriate global object
    let cache;

    if (typeof globalThis !== 'undefined') {
        // Use globalThis for both browser and Node.js environments
        if (!globalThis.tokenPriceCache) {
            globalThis.tokenPriceCache = {};
        }
        cache = globalThis.tokenPriceCache;
    } else if (typeof window !== 'undefined') {
        // Fallback to window for older browsers
        if (!window.tokenPriceCache) {
            window.tokenPriceCache = {};
        }
        cache = window.tokenPriceCache;
    } else if (typeof global !== 'undefined') {
        // Fallback to global for Node.js
        if (!global.tokenPriceCache) {
            global.tokenPriceCache = {};
        }
        cache = global.tokenPriceCache;
    } else {
        // Create a local cache if no global object is available
        console.warn('No global object found, using local cache for this request only');
        // This will be a temporary cache just for this function call
        this._tempCache = this._tempCache || {};
        this._tempCache.tokenPriceCache = this._tempCache.tokenPriceCache || {};
        cache = this._tempCache.tokenPriceCache;
    }

    // Check for cached price
    if (cache[cacheKey] && cache[cacheKey].timestamp > (now - cacheExpiration)) {
        return cache[cacheKey].data;
    }

    try {
        // Get Moralis chain format
        const moralisChain = getMoralisChain(normalizedChain);
        if (!moralisChain) {
            console.warn(`Unsupported chain for price lookup: ${chain}`);
            return null;
        }

        const url = `https://deep-index.moralis.io/api/v2.2/erc20/${normalizedToken}/price?chain=${moralisChain}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'X-API-Key': MORALIS_API_KEY
            },
            timeout: 3000 // 3 second timeout
        });

        if (!response.ok) {
            // Try CoinGecko as a fallback for major tokens
            if (normalizedToken === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2') { // WETH
                const ethPrice = await getNativeTokenPrice('ethereum');
                if (ethPrice) {
                    const priceData = {
                        usdPrice: ethPrice,
                        nativePrice: null
                    };
                    cache[cacheKey] = {
                        data: priceData,
                        timestamp: now
                    };
                    return priceData;
                }
            }

            console.warn(`Token price API returned ${response.status} for ${normalizedToken}`);
            return null;
        }

        const data = await response.json();
        const priceData = {
            usdPrice: data.usdPrice,
            nativePrice: data.nativePrice?.value || null
        };

        // Cache the result
        cache[cacheKey] = {
            data: priceData,
            timestamp: now
        };

        return priceData;
    } catch (error) {
        console.error(`Error fetching token price for ${normalizedToken}:`, error);
        return null;
    }
};

/**
 * Gets the current price of a native token from a public API
 * Implements caching to reduce API calls and provide fallback prices
 * @param {string} chain - The chain to get price for
 * @returns {Promise<number>} - The price in USD
 */
const getNativeTokenPrice = async (chain) => {
    // Use the global CoinGecko price cache if it exists
    let cache;

    if (typeof globalThis !== 'undefined') {
        // Use globalThis for both browser and Node.js environments
        if (!globalThis.coinGeckoPriceCache) {
            globalThis.coinGeckoPriceCache = {};
        }
        cache = globalThis.coinGeckoPriceCache;
    } else if (typeof window !== 'undefined') {
        // Fallback to window for older browsers
        if (!window.coinGeckoPriceCache) {
            window.coinGeckoPriceCache = {};
        }
        cache = window.coinGeckoPriceCache;
    } else if (typeof global !== 'undefined') {
        // Fallback to global for Node.js
        if (!global.coinGeckoPriceCache) {
            global.coinGeckoPriceCache = {};
        }
        cache = global.coinGeckoPriceCache;
    } else {
        // Create a local cache if no global object is available
        console.warn('No global object found, using local cache for this request only');
        // This will be a temporary cache just for this function call
        this._tempCache = this._tempCache || {};
        this._tempCache.coinGeckoPriceCache = this._tempCache.coinGeckoPriceCache || {};
        cache = this._tempCache.coinGeckoPriceCache;
    }

    const normalizedChain = chain.toLowerCase();

    // Map chain to token symbol
    const symbolMap = {
        'ethereum': 'ETH',
        'eth': 'ETH',
        'polygon': 'MATIC',
        'matic': 'MATIC',
        'bsc': 'BNB',
        'binance': 'BNB',
        'avalanche': 'AVAX',
        'avax': 'AVAX',
        'fantom': 'FTM',
        'solana': 'SOL',
        'sol': 'SOL',
        'bitcoin': 'BTC',
        'btc': 'BTC',
        'hardhat': 'ETH',
        'hardhat local': 'ETH'
    };

    // Get the token symbol for this chain
    const symbol = symbolMap[normalizedChain] || 'ETH';

    console.log(`🔍 Getting native token price for ${normalizedChain} (${symbol})`);

    const now = Date.now();
    const cacheExpiration = 10 * 60 * 1000; // 10 minutes

    // Check if we have a valid cached price in the global cache
    if (cache[symbol] && cache[symbol].timestamp > (now - cacheExpiration)) {
        const cachedPrice = cache[symbol].price;
        const isFallback = cache[symbol].isFallback;
        console.log(`💰 ${symbol}: $${cachedPrice.toFixed(6)} [CACHED${isFallback ? '-FALLBACK' : ''}]`);
        return cachedPrice;
    }

    // Map chain to CoinGecko token ID
    const tokenIds = {
        'ETH': 'ethereum',
        'MATIC': 'matic-network',
        'BNB': 'binancecoin',
        'AVAX': 'avalanche-2',
        'FTM': 'fantom',
        'SOL': 'solana',
        'BTC': 'bitcoin'
    };

    // Get the CoinGecko ID
    const coinId = tokenIds[symbol] || 'ethereum';
    let price = null;

    try {
        // Try CoinGecko API first
        console.log(`📡 Fetching native price from CoinGecko for ${symbol} (${normalizedChain})`);
        const coingeckoResponse = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
            {
                headers: { 'Accept': 'application/json' },
                timeout: 3000 // 3 second timeout
            }
        );

        if (coingeckoResponse.ok) {
            const data = await coingeckoResponse.json();
            price = data[coinId]?.usd;

            if (price) {
                console.log(`💰 ${symbol}: $${price.toFixed(6)} [FRESH]`);

                // Store in global cache for consistency
                cache[symbol] = {
                    price,
                    timestamp: now
                };
            }
        }

        // If CoinGecko fails or returns no price, try alternative source
        if (!price && MORALIS_API_KEY) {
            // Backup: Try Moralis token API if we have the key
            // We'll only use this as fallback because it counts against rate limits
            let moralisChain = getMoralisChain(normalizedChain);
            if (moralisChain) {
                let tokenAddress = '';

                // Get native token contract address based on chain
                if (normalizedChain === 'ethereum' || normalizedChain === 'eth' || normalizedChain.includes('hardhat')) {
                    tokenAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
                } else if (normalizedChain === 'polygon' || normalizedChain === 'matic') {
                    tokenAddress = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'; // WMATIC
                } else if (normalizedChain === 'bsc' || normalizedChain === 'binance') {
                    tokenAddress = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'; // WBNB
                }

                if (tokenAddress) {
                    try {
                        const priceData = await getTokenPrice(tokenAddress, moralisChain);
                        if (priceData?.usdPrice) {
                            price = priceData.usdPrice;
                            console.log(`💰 ${symbol}: $${price.toFixed(6)} [MORALIS FALLBACK]`);

                            // Store in global cache for consistency
                            cache[symbol] = {
                                price,
                                timestamp: now,
                                source: 'moralis'
                            };
                        }
                    } catch (moralisError) {
                        console.warn(`Moralis price lookup failed for ${normalizedChain}:`, moralisError);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`❌ Error getting native token price for ${normalizedChain}:`, error);
    }

    // If both APIs failed or no price was returned, use fallback
    if (!price) {
        // Return fallback prices for development
        const fallbackPrices = {
            'ETH': 1880,
            'MATIC': 0.55,
            'BNB': 580,
            'AVAX': 35,
            'FTM': 0.5,
            'SOL': 145,
            'BTC': 63000
        };

        price = fallbackPrices[symbol] || 1880;
        console.log(`💰 ${symbol}: $${price.toFixed(6)} [HARDCODED FALLBACK]`);

        // Store fallback in global cache with flag
        cache[symbol] = {
            price,
            timestamp: now,
            isFallback: true
        };
    }

    return price;
};

/**
 * Fetches token balances from a local Hardhat node
 * This is custom handling since Moralis doesn't support Hardhat local chain
 * 
 * @param {string} address - Wallet address
 * @returns {Promise<Array>} - Array of tokens
 */
const getHardhatTokenBalances = async (address) => {
    try {
        // Dynamically import ethers
        const { ethers } = await import('ethers');

        // Connect to local Hardhat node
        const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545/');

        // Get ETH balance
        const balance = await provider.getBalance(address);
        const formattedBalance = ethers.utils.formatEther(balance);

        // For local Hardhat, we only return ETH
        return [{
            type: 'native',
            token_address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            symbol: 'ETH',
            name: 'Ethereum',
            logo: null,
            decimals: 18,
            balance: balance.toString(),
            balance_formatted: formattedBalance,
            usd_price: null, // Local development, no price
            usd_value: null
        }];
    } catch (error) {
        console.error(`Error fetching Hardhat balances for ${address}:`, error);
        return [];
    }
};

/**
 * Gets Bitcoin balance for an address
 * 
 * @param {string} address - Bitcoin address
 * @returns {Promise<Array>} - Array with a single token (BTC)
 */
const getBitcoinBalance = async (address) => {
    try {
        // Use Moralis API to fetch Bitcoin balance
        const url = `https://deep-index.moralis.io/api/v2.2/wallets/${address}/btc/balance`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'X-API-Key': MORALIS_API_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch BTC balance: ${response.status}`);
        }

        const balanceData = await response.json();

        // Bitcoin is measured in satoshis (1 BTC = 100,000,000 satoshis)
        const balanceSatoshi = balanceData.balance || '0';
        const balanceBTC = (parseInt(balanceSatoshi) / 1e8).toString();

        // Get Bitcoin price
        const btcPrice = await getNativeTokenPrice('btc');

        // Return BTC as a native token
        return [{
            type: 'native',
            token_address: 'bitcoin', // Convention for BTC
            symbol: 'BTC',
            name: 'Bitcoin',
            logo: null,
            decimals: 8,
            balance: balanceSatoshi,
            balance_formatted: balanceBTC,
            usd_price: btcPrice,
            usd_value: btcPrice ? parseFloat(balanceBTC) * btcPrice : null
        }];
    } catch (error) {
        console.error(`Error fetching Bitcoin balance for ${address}:`, error);
        return [];
    }
};