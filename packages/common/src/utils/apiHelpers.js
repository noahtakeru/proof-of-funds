/**
 * API helper utilities for managing API requests, retries, error handling, and caching
 */

/**
 * Executes an API call with automatic retry logic
 * @param {Function} apiCallFn - Function that returns a Promise for the API call
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} initialDelay - Initial delay in ms before first retry (default: 1000)
 * @returns {Promise<any>} - Result of the API call if successful
 * @throws {Error} - Throws the last error encountered if all retries fail
 */
export const executeWithRetry = async (apiCallFn, maxRetries = 3, initialDelay = 1000) => {
  let attempt = 0;
  let lastError;
  
  while (attempt < maxRetries) {
    try {
      return await apiCallFn();
    } catch (error) {
      lastError = error;
      attempt++;
      
      // Detect rate limiting
      if (isRateLimited(error)) {
        rateLimitStats.recordRateLimit(
          error.apiName || 'unknown',
          error.response?.headers?.['x-rate-limit-remaining'] || 0
        );
      }
      
      // Only retry on 429 (rate limit) or 5xx (server) errors
      if (error.status && ![429, 500, 502, 503, 504].includes(error.status)) {
        throw error; // Don't retry on client errors except rate limiting
      }
      
      const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
      console.warn(`API request failed (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError; // If we get here, all attempts failed
};

/**
 * Check if an error is due to rate limiting
 * @param {Error} error - The error to check
 * @returns {boolean} True if rate limited
 */
export function isRateLimited(error) {
  return (
    error.status === 429 || 
    (error.response?.headers?.['x-rate-limit-remaining'] === '0')
  );
}

/**
 * Stats tracking for rate limiting
 */
export const rateLimitStats = {
  moralis: { 
    limitHits: 0, 
    lastHit: null,
    remainingQuota: null
  },
  coingecko: { 
    limitHits: 0, 
    lastHit: null,
    remainingQuota: null
  },
  
  recordRateLimit(apiName, remaining) {
    if (!this[apiName]) {
      this[apiName] = { limitHits: 0, lastHit: null, remainingQuota: null };
    }
    
    this[apiName].limitHits++;
    this[apiName].lastHit = new Date();
    this[apiName].remainingQuota = remaining;
    
    console.warn(`Rate limit approaching for ${apiName}. Remaining: ${remaining}`);
  },
  
  getStats() {
    return {
      moralis: { ...this.moralis },
      coingecko: { ...this.coingecko }
    };
  }
};

/**
 * Request queue system with concurrency control 
 */
const requestQueue = {
  moralis: {
    queue: [],
    inProgress: 0,
    maxConcurrent: 5,
    minTimeBetweenRequests: 100 // ms
  },
  coingecko: {
    queue: [],
    inProgress: 0,
    maxConcurrent: 3,
    minTimeBetweenRequests: 333 // ms - CoinGecko allows ~3 req/sec on free tier
  },
  lastRequestTime: {
    moralis: 0,
    coingecko: 0
  },
  
  async addToQueue(apiName, requestFn) {
    return new Promise((resolve, reject) => {
      this[apiName].queue.push({ requestFn, resolve, reject });
      this.processQueue(apiName);
    });
  },
  
  async processQueue(apiName) {
    const api = this[apiName];
    
    if (api.inProgress >= api.maxConcurrent || api.queue.length === 0) {
      return;
    }
    
    // Ensure minimum time between requests
    const now = Date.now();
    const elapsed = now - this.lastRequestTime[apiName];
    if (elapsed < api.minTimeBetweenRequests) {
      setTimeout(() => this.processQueue(apiName), api.minTimeBetweenRequests - elapsed);
      return;
    }
    
    const { requestFn, resolve, reject } = api.queue.shift();
    api.inProgress++;
    this.lastRequestTime[apiName] = now;
    
    try {
      const result = await executeWithRetry(() => {
        const wrappedRequest = async () => {
          const response = await requestFn();
          response.apiName = apiName; // Tag response with API name
          return response;
        };
        return wrappedRequest();
      });
      resolve(result);
    } catch (error) {
      // Tag error with API name
      error.apiName = apiName;
      reject(error);
    } finally {
      api.inProgress--;
      this.processQueue(apiName);
    }
  }
};

/**
 * Queue an API request with rate limiting
 * @param {string} apiName - Name of the API (moralis, coingecko)
 * @param {Function} requestFn - Function that returns a Promise for the API call
 * @returns {Promise<any>} - Result of the API call if successful
 */
export async function queuedRequest(apiName, requestFn) {
  return requestQueue.addToQueue(apiName, requestFn);
}

/**
 * Creates a structured error response for failed API operations
 * @param {string} operation - Name of the operation that failed
 * @param {Error} error - The error object
 * @param {string} chain - The blockchain chain involved (if applicable)
 * @returns {Object} - Structured error object
 */
export const createErrorResponse = (operation, error, chain = '') => {
  return {
    error: true,
    errorType: error.name || 'Error',
    errorMessage: error.message || 'Unknown error',
    errorStatus: error.status || null,
    operation,
    chain,
    timestamp: new Date().toISOString(),
    apiName: error.apiName || 'unknown',
    rateLimited: isRateLimited(error)
  };
};

/**
 * Processes results from Promise.allSettled to separate successes and errors
 * @param {Array} results - Results from Promise.allSettled
 * @param {Array} keys - Keys corresponding to each result (e.g., chain names)
 * @param {string} operation - Name of the operation
 * @returns {Object} - Object with successes and errors
 */
export const processAllSettledResults = (results, keys, operation) => {
  const successes = {};
  const errors = {};
  
  results.forEach((result, index) => {
    const key = keys[index];
    if (result.status === 'fulfilled') {
      successes[key] = result.value;
    } else {
      errors[key] = createErrorResponse(operation, result.reason, key);
    }
  });
  
  return {
    successes,
    errors,
    hasErrors: Object.keys(errors).length > 0,
    allFailed: Object.keys(successes).length === 0,
  };
};

/**
 * Sanitizes token metadata to ensure consistent format and handle missing/malformed data
 * @param {Object} token - Token object to sanitize
 * @param {string} chain - Blockchain chain
 * @returns {Object} - Sanitized token object
 */
export function sanitizeTokenMetadata(token, chain) {
  // Ensure required fields exist
  const sanitized = {
    symbol: token.symbol || 'UNKNOWN',
    name: token.name || token.symbol || 'Unknown Token',
    address: token.token_address || token.address || null,
    balance: parseFloat(token.balance || '0'),
    balance_formatted: token.balance_formatted || token.balance || '0',
    decimals: parseInt(token.decimals || '18', 10),
    type: token.address === '0xNative' || token.token_address === '0xNative' ? 'native' : 'erc20',
    chain: chain,
    price: 0,
    usdValue: 0,
    priceSource: 'unknown'
  };
  
  // Sanitize known problematic data patterns
  if (sanitized.symbol && sanitized.symbol.length > 20) {
    sanitized.symbol = sanitized.symbol.substring(0, 20);
  }
  
  // Convert non-string values to strings where expected
  sanitized.symbol = String(sanitized.symbol);
  sanitized.name = String(sanitized.name);
  
  // Remove non-printable characters from symbol and name
  sanitized.symbol = sanitized.symbol.replace(/[^\x20-\x7E]/g, '');
  sanitized.name = sanitized.name.replace(/[^\x20-\x7E]/g, '');
  
  // Ensure balance is properly converted considering decimals
  if (typeof token.balance === 'string' && !token.balance_formatted) {
    try {
      const balanceNum = parseFloat(token.balance);
      sanitized.balance = balanceNum;
      const scalingFactor = Math.pow(10, sanitized.decimals);
      sanitized.balance_formatted = (balanceNum / scalingFactor).toFixed(6);
    } catch (e) {
      console.warn('Failed to parse token balance', token);
    }
  }
  
  // Transfer known fields
  if (token.logo) sanitized.logo = token.logo;
  if (token.possible_spam) sanitized.possible_spam = !!token.possible_spam;
  if (token.verified_contract) sanitized.verified_contract = !!token.verified_contract;
  if (token.error) sanitized.error = token.error;
  
  return sanitized;
}

/**
 * Generates display information for tokens with missing metadata
 * @param {Object} token - Token object that might need default display info
 * @returns {Object} - Token with display info filled in if needed
 */
export function generateTokenDisplayInfo(token) {
  // For tokens with missing display info
  if (!token.name && !token.symbol) {
    if (token.type === 'native') {
      const chainDefaults = {
        'ethereum': { symbol: 'ETH', name: 'Ethereum' },
        'polygon': { symbol: 'MATIC', name: 'Polygon' },
        'polygon-amoy': { symbol: 'MATIC', name: 'Polygon Amoy' },
        'polygon-mumbai': { symbol: 'MATIC', name: 'Polygon Mumbai' },
        'bsc': { symbol: 'BNB', name: 'BNB Chain' },
        'arbitrum': { symbol: 'ETH', name: 'Arbitrum ETH' },
        'optimism': { symbol: 'ETH', name: 'Optimism ETH' },
        'avalanche': { symbol: 'AVAX', name: 'Avalanche' },
        'fantom': { symbol: 'FTM', name: 'Fantom' },
        'cronos': { symbol: 'CRO', name: 'Cronos' },
        'base': { symbol: 'ETH', name: 'Base ETH' },
        'default': { symbol: 'NATIVE', name: 'Native Token' }
      };
      
      const defaults = chainDefaults[token.chain] || chainDefaults.default;
      return {
        ...token,
        symbol: defaults.symbol,
        name: defaults.name
      };
    } else if (token.address) {
      // For ERC20 tokens with no metadata, use address as identifier
      return {
        ...token,
        symbol: `0x${token.address.substring(2, 6)}`,
        name: `Unknown Token (${token.address.substring(0, 10)}...)`
      };
    }
  }
  return token;
}

/**
 * Cache system for API results and metadata
 */
export const cache = {
  priceCache: {},
  tokenMetadataCache: {},
  
  // Cache prices with 5-minute TTL
  setPrice(key, value) {
    this.priceCache[key] = {
      value,
      timestamp: Date.now(),
      expires: Date.now() + 5 * 60 * 1000 // 5 minutes
    };
  },
  
  getPrice(key) {
    const entry = this.priceCache[key];
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      delete this.priceCache[key];
      return null;
    }
    
    return entry.value;
  },
  
  // Cache token metadata with 1-hour TTL
  setTokenMetadata(address, chain, metadata) {
    const key = `${chain}:${address}`;
    this.tokenMetadataCache[key] = {
      metadata,
      timestamp: Date.now(),
      expires: Date.now() + 60 * 60 * 1000 // 1 hour
    };
  },
  
  getTokenMetadata(address, chain) {
    const key = `${chain}:${address}`;
    const entry = this.tokenMetadataCache[key];
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      delete this.tokenMetadataCache[key];
      return null;
    }
    
    return entry.metadata;
  },
  
  // Get cache statistics
  getStats() {
    return {
      prices: {
        count: Object.keys(this.priceCache).length,
        avgAge: this._getAverageAge(this.priceCache)
      },
      tokenMetadata: {
        count: Object.keys(this.tokenMetadataCache).length,
        avgAge: this._getAverageAge(this.tokenMetadataCache)
      }
    };
  },
  
  _getAverageAge(cacheObj) {
    const entries = Object.values(cacheObj);
    if (entries.length === 0) return 0;
    
    const totalAge = entries.reduce((sum, entry) => 
      sum + (Date.now() - entry.timestamp), 0);
    return totalAge / entries.length;
  },
  
  // Clear expired entries
  cleanup() {
    const now = Date.now();
    
    Object.keys(this.priceCache).forEach(key => {
      if (now > this.priceCache[key].expires) {
        delete this.priceCache[key];
      }
    });
    
    Object.keys(this.tokenMetadataCache).forEach(key => {
      if (now > this.tokenMetadataCache[key].expires) {
        delete this.tokenMetadataCache[key];
      }
    });
  }
};

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => cache.cleanup(), 5 * 60 * 1000);
}

/**
 * Create a batched version of an async function for multiple items
 * @param {Function} fn - The async function to batch
 * @param {number} batchSize - Size of each batch
 * @returns {Function} - A new function that processes items in batches
 */
export function createBatchProcessor(fn, batchSize = 25) {
  return async function(items, ...args) {
    // Group items into batches
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    // Process each batch and combine results
    const batchResults = [];
    for (const batch of batches) {
      const result = await fn(batch, ...args);
      batchResults.push(result);
      
      // Add small delay between batches
      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Combine results based on result type
    if (Array.isArray(batchResults[0])) {
      return batchResults.flat();
    } else if (typeof batchResults[0] === 'object') {
      return batchResults.reduce((combined, result) => ({
        ...combined,
        ...result
      }), {});
    }
    
    return batchResults;
  };
}

/**
 * Chain scanning order optimization based on token prevalence
 */
export const chainScanningOrder = [
  'ethereum',  // Scan Ethereum first (most tokens)
  'polygon',
  'bsc',
  'avalanche',
  'fantom',
  'arbitrum',
  'optimism',
  'base',
  'cronos',
  // Testnets at the end
  'sepolia',
  'goerli',
  'mumbai',
  'polygon-amoy'
];

/**
 * Optimize the order of chains to scan
 * @param {Array<string>} chains - Chains to scan
 * @returns {Array<string>} - Optimized order of chains
 */
export function optimizeChainOrder(chains) {
  return [...chains].sort((a, b) => {
    const aIndex = chainScanningOrder.indexOf(a.toLowerCase());
    const bIndex = chainScanningOrder.indexOf(b.toLowerCase());
    
    if (aIndex === -1) return 1;  // Unknown chains go last
    if (bIndex === -1) return -1;
    
    return aIndex - bIndex;
  });
}

/**
 * Create logical grouping of same asset across chains
 * @param {Array} assets - Array of token assets from multiple chains
 * @returns {Object} Organized cross-chain asset structure
 */
export function organizeAssetsByCrossChain(assets) {
  // Group by normalized symbol (case insensitive)
  const groupedBySymbol = {};
  
  assets.forEach(asset => {
    // Skip error tokens
    if (asset.type === 'error') return;
    
    const normalizedSymbol = asset.symbol.toUpperCase();
    if (!groupedBySymbol[normalizedSymbol]) {
      groupedBySymbol[normalizedSymbol] = [];
    }
    groupedBySymbol[normalizedSymbol].push(asset);
  });
  
  // Create cross-chain asset summary
  const crossChainAssets = Object.entries(groupedBySymbol).map(([symbol, tokens]) => {
    const totalBalance = tokens.reduce((sum, token) => sum + (token.usdValue || 0), 0);
    return {
      symbol,
      name: tokens[0].name, // Use name from first instance
      instances: tokens.map(t => ({
        chain: t.chain,
        balance: t.balance,
        balance_formatted: t.balance_formatted,
        usdValue: t.usdValue,
        address: t.token_address || t.address,
        type: t.type,
        decimals: t.decimals
      })),
      totalUsdValue: totalBalance,
      chainCount: tokens.length,
      chains: tokens.map(t => t.chain),
      // Additional metadata for token info
      logo: tokens.find(t => t.logo)?.logo || null,
      primaryInstance: tokens.reduce((primary, token) => 
        (!primary || (token.usdValue > primary.usdValue)) ? token : primary, 
        null
      )
    };
  });
  
  // Sort by total USD value (descending)
  crossChainAssets.sort((a, b) => b.totalUsdValue - a.totalUsdValue);
  
  return {
    bySymbol: groupedBySymbol,
    crossChainSummary: crossChainAssets
  };
}

/**
 * Add chain identifiers to tokens for better cross-chain organization
 * @param {Object} token - Token object to enhance
 * @param {string} chain - Blockchain chain
 * @returns {Object} - Enhanced token with chain data
 */
export function enhanceTokenWithChainData(token, chain) {
  // Chain ID to name mapping
  const chainIdMapping = {
    'ethereum': 1,
    'polygon': 137,
    'polygon-amoy': 80002,
    'polygon-mumbai': 80001,
    'bsc': 56,
    'arbitrum': 42161,
    'optimism': 10,
    'avalanche': 43114,
    'fantom': 250,
    'cronos': 25,
    'base': 8453,
    'sepolia': 11155111,
    'goerli': 5
  };
  
  // Get chain ID or default to null
  const chainId = chainIdMapping[chain.toLowerCase()] || null;
  
  // Get chain explorer URL
  const chainExplorers = {
    'ethereum': 'https://etherscan.io',
    'polygon': 'https://polygonscan.com',
    'polygon-amoy': 'https://amoy.polygonscan.com',
    'polygon-mumbai': 'https://mumbai.polygonscan.com',
    'bsc': 'https://bscscan.com',
    'arbitrum': 'https://arbiscan.io',
    'optimism': 'https://optimistic.etherscan.io',
    'avalanche': 'https://snowtrace.io',
    'fantom': 'https://ftmscan.com',
    'cronos': 'https://cronoscan.com',
    'base': 'https://basescan.org',
    'sepolia': 'https://sepolia.etherscan.io',
    'goerli': 'https://goerli.etherscan.io'
  };
  
  // Enhanced token with chain data
  return {
    ...token,
    chainId,
    chainData: {
      name: chain,
      formattedName: chain.charAt(0).toUpperCase() + chain.slice(1),
      id: chainId,
      explorer: chainExplorers[chain.toLowerCase()] || null,
      isMainnet: !chain.includes('test') && !chain.includes('amoy') && 
                !chain.includes('mumbai') && !chain.includes('goerli') && 
                !chain.includes('sepolia')
    }
  };
}

export default {
  executeWithRetry,
  createErrorResponse,
  processAllSettledResults,
  queuedRequest,
  rateLimitStats,
  isRateLimited,
  sanitizeTokenMetadata,
  generateTokenDisplayInfo,
  cache,
  createBatchProcessor,
  optimizeChainOrder,
  chainScanningOrder,
  organizeAssetsByCrossChain,
  enhanceTokenWithChainData
};