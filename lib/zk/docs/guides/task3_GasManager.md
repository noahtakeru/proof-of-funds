## Technical Debt Remediation Task: Fix Error Handling in GasManager.js

### Background

Our regression tests show that GasManager.js still has try/catch blocks that don't use our error logging system. This file is responsible for gas calculations, price fetching, and cost estimation - critical functionality for our smart contract interactions. Improving its error handling will make gas estimation more reliable and help users better understand potential transaction cost issues.

### File to Modify

`/Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/GasManager.js`

### Task Requirements

Implement proper error handling that:
- Uses the zkErrorLogger system for all try/catch blocks
- Follows established error patterns (operation IDs, structured data, etc.)
- Preserves the original functionality
- Doesn't change the module format (that's a separate issue)

### Step 1: Understand the File's Purpose

The GasManager.js file manages gas calculations and price estimation for blockchain transactions. Before modifying, make sure you understand:
- How gas price data is fetched from external APIs
- How gas limits are calculated for different operations
- How costs are converted between tokens and fiat
- What kind of error conditions might arise during these operations
- The CoinGecko API integration for price fetching

### Step 2: Implement Proper Error Handling

1. Add required imports for error handling (if not already present):
```javascript
import {
  ErrorCode,
  ErrorSeverity,
  SystemError,
  VerificationError,
  NetworkError,
  isZKError
} from './zkErrorHandler.js';
import { zkErrorLogger } from './zkErrorLogger.js';
```

2. Create a specialized error class for gas management operations:
```javascript
class GasManagerError extends SystemError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      severity: options.severity || ErrorSeverity.WARNING,
      recoverable: options.recoverable !== undefined ? options.recoverable : true,
      details: {
        ...(options.details || {}),
        component: 'GasManager',
        operation: options.operation || 'unknown',
        operationId: options.operationId || `gas_manager_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
      }
    });
    
    this.name = 'GasManagerError';
    
    // Capture current stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GasManagerError);
    }
  }
}
```

3. Implement a helper function for logging errors:
```javascript
function logError(error, additionalInfo = {}) {
  // If error is null/undefined, create a generic error
  if (!error) {
    error = new Error('Unknown error in Gas Manager');
  }

  // Convert to GasManagerError if it's not already a specialized error
  if (!isZKError(error)) {
    const operationId = additionalInfo.operationId || `gas_manager_error_${Date.now()}`;
    error = new GasManagerError(error.message || 'Unknown error in gas management', {
      operationId,
      operation: additionalInfo.operation || 'unknown',
      details: {
        originalError: error,
        ...additionalInfo
      }
    });
  }

  // Log the error
  if (zkErrorLogger && zkErrorLogger.logError) {
    zkErrorLogger.logError(error, additionalInfo);
  } else {
    console.error('[GasManager]', error.message, additionalInfo);
  }
  
  return error;
}
```

4. Enhance the fetch gas price function with proper error handling:
```javascript
async function fetchGasPriceData(network = 'ethereum') {
  const operationId = `fetch_gas_price_${Date.now()}`;
  
  try {
    // Log operation start
    zkErrorLogger.log('INFO', `Fetching gas price data for ${network}`, {
      operationId,
      component: 'GasManager',
      details: { 
        network,
        source: 'CoinGecko API',
        timestamp: new Date().toISOString()
      }
    });
    
    // Existing fetch code...
    const gasPriceData = {
      // ... data from API
    };
    
    return gasPriceData;
  } catch (error) {
    // Log and wrap the error
    const fetchError = new NetworkError(`Failed to fetch gas price data: ${error.message}`, {
      code: ErrorCode.NETWORK_REQUEST_FAILED,
      severity: ErrorSeverity.WARNING,
      operation: 'fetchGasPriceData',
      operationId,
      recoverable: true, // We can use fallback values
      details: {
        network,
        errorType: error.name || typeof error,
        apiEndpoint: 'CoinGecko API',
        timestamp: new Date().toISOString()
      },
      originalError: error
    });
    
    logError(fetchError, { 
      context: 'fetchGasPriceData',
      network
    });
    
    // Return fallback data with a warning flag
    return {
      network,
      gasPrice: 50, // Default safe high gas price in gwei
      ethPrice: 2200, // Default placeholder ETH price
      timestamp: Date.now(),
      source: 'fallback',
      warning: 'Using fallback values due to API error'
    };
  }
}
```

5. Enhance the calculate gas costs function:
```javascript
export async function calculateGasCosts(options = {}) {
  const operationId = `calculate_gas_${Date.now()}`;
  const { network = 'ethereum', operation = 'proof_verification', gasLimit } = options;
  
  try {
    // Start logging
    zkErrorLogger.log('INFO', `Calculating gas costs for ${operation} on ${network}`, {
      operationId,
      component: 'GasManager',
      details: { 
        network,
        operation,
        hasGasLimit: !!gasLimit,
        timestamp: new Date().toISOString()
      }
    });
    
    // Existing calculation code...
    const calculatedCosts = {
      // ... cost calculation results
    };
    
    return calculatedCosts;
  } catch (error) {
    // Check for expected calculation errors
    const calculationError = new GasManagerError(`Failed to calculate gas costs: ${error.message}`, {
      code: ErrorCode.CALCULATION_FAILED,
      severity: ErrorSeverity.WARNING,
      operation: 'calculateGasCosts',
      operationId,
      recoverable: true, // We can still provide estimates
      details: {
        network,
        operation,
        hasGasLimit: !!gasLimit,
        errorType: error.name || typeof error,
        timestamp: new Date().toISOString()
      },
      originalError: error
    });
    
    logError(calculationError, { 
      context: 'calculateGasCosts',
      network,
      operation
    });
    
    // Return safe high estimate with warning
    return {
      network,
      operation,
      estimatedGasLimit: gasLimit || getDefaultGasLimitForOperation(operation),
      estimatedGasCostWei: '5000000000000000', // Conservative high estimate
      estimatedGasCostEth: '0.005',
      estimatedUsdCost: '11.00',
      timestamp: Date.now(),
      isEstimate: true,
      warning: 'Using conservative high estimate due to calculation error'
    };
  }
}
```

6. Add error handling to price conversion functions:
```javascript
export function convertWeiToFiat(weiAmount, options = {}) {
  const operationId = `convert_wei_to_fiat_${Date.now()}`;
  const { network = 'ethereum', currency = 'USD' } = options;
  
  try {
    // Existing conversion code...
    const convertedAmount = /* conversion logic */;
    
    return convertedAmount;
  } catch (error) {
    const conversionError = new GasManagerError(`Failed to convert Wei to fiat: ${error.message}`, {
      code: ErrorCode.CONVERSION_FAILED,
      severity: ErrorSeverity.INFO,
      operation: 'convertWeiToFiat',
      operationId,
      recoverable: true, // Non-critical operation
      details: {
        weiAmount,
        network,
        currency,
        errorType: error.name || typeof error,
        timestamp: new Date().toISOString()
      },
      originalError: error
    });
    
    logError(conversionError, { 
      context: 'convertWeiToFiat',
      network,
      currency
    });
    
    // Return a reasonable approximation
    return {
      originalAmount: weiAmount,
      convertedAmount: null,
      currency,
      isEstimate: true,
      warning: 'Conversion failed, amount shown in original currency only'
    };
  }
}
```

7. Add error handling for CoinGecko API integration:
```javascript
async function fetchPricesForSymbols(symbols, currency = 'usd') {
  const operationId = `fetch_prices_${Date.now()}`;
  
  try {
    // Prepare API request
    const symbolsParam = symbols.join('%2C');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${symbolsParam}&vs_currencies=${currency}`;
    
    // Log API request
    zkErrorLogger.log('DEBUG', 'Fetching prices from CoinGecko API', {
      operationId,
      component: 'GasManager',
      details: { 
        symbols,
        currency,
        url: url.substring(0, 100) + '...',
        timestamp: new Date().toISOString()
      }
    });
    
    // Make the API request
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`CoinGecko API returned status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Validate response
    if (!data || typeof data !== 'object') {
      throw new Error('CoinGecko API returned invalid data format');
    }
    
    return data;
  } catch (error) {
    const apiError = new NetworkError(`Failed to fetch cryptocurrency prices: ${error.message}`, {
      code: ErrorCode.NETWORK_REQUEST_FAILED,
      severity: ErrorSeverity.WARNING,
      operation: 'fetchPricesForSymbols',
      operationId,
      recoverable: true, // Can use fallbacks
      details: {
        symbols,
        currency,
        errorType: error.name || typeof error,
        isNetworkError: error.name === 'TypeError' || error.message.includes('fetch'),
        timestamp: new Date().toISOString()
      },
      originalError: error
    });
    
    logError(apiError, { 
      context: 'fetchPricesForSymbols',
      symbols,
      currency
    });
    
    // Return placeholder data
    const fallbackData = {};
    symbols.forEach(symbol => {
      fallbackData[symbol] = { [currency]: getDefaultPriceForSymbol(symbol, currency) };
    });
    
    return fallbackData;
  }
}

// Helper to provide reasonable defaults for common symbols
function getDefaultPriceForSymbol(symbol, currency = 'usd') {
  const defaults = {
    'ethereum': 2200,
    'bitcoin': 40000,
    'polygon': 0.65,
    'matic-network': 0.65,
    'solana': 100
  };
  
  return defaults[symbol.toLowerCase()] || 1.0;
}
```

### Step 3: Testing

1. Run the regression tests to ensure your changes fix the warnings:
```bash
cd /Users/karpel/Documents/GitHub/proof-of-funds && node ./lib/zk/tests/regression/enhanced-runner.cjs
```

2. Check specifically if the warnings for this file are gone:
```bash
cd /Users/karpel/Documents/GitHub/proof-of-funds && node ./lib/zk/tests/regression/enhanced-runner.cjs | grep "GasManager.js"
```

3. Ensure the file still functions properly by running the associated tests:
```bash
cd /Users/karpel/Documents/GitHub/proof-of-funds && node ./lib/zk/__tests__/GasManager.test.js
```

### Step 4: Documentation

1. Update function JSDoc comments to reflect error handling behavior
2. Add comments explaining price estimation fallback strategies
3. Make sure error messages are clear and actionable
4. Document the CoinGecko API integration with fallback mechanisms

### Success Criteria

- No warnings about "Try/catch without error logging" for GasManager.js
- All try/catch blocks use proper error handling with:
  - Operation IDs
  - Detailed context
  - Appropriate error classes
  - Severity levels
- The original gas management functionality is preserved
- Proper fallbacks are implemented for network failures
- The code follows our project's error handling patterns

### Additional Notes

- Be aware of API rate limits when testing
- Include reasonable fallback values for all critical operations
- Consider adding caching for API responses to handle temporary outages
- Add circuit-breaker patterns for repeated API failures
- Consider adding retry logic for transient network issues
- Make error messages user-friendly since gas estimation directly affects user experience