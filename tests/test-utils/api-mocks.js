/**
 * Mock API responses for testing error handling and resilience
 * 
 * This file provides standardized mock API failure responses for testing
 * the error handling and resilience features of token-agnostic wallet scanning.
 */

// Mock API failure response
const mockApiFailure = {
  status: 500,
  message: 'Internal Server Error',
  error: true,
  timestamp: new Date().toISOString(),
  response: {
    data: {
      error: 'Unable to fetch data from server'
    }
  }
};

// Mock rate limit response
const mockRateLimitResponse = {
  status: 429,
  message: 'Too Many Requests',
  error: true,
  timestamp: new Date().toISOString(),
  response: {
    headers: {
      'x-rate-limit-remaining': '0',
      'x-rate-limit-reset': (Date.now() + 60000).toString() // Reset in 1 minute
    }
  }
};

// Mock network error response
const mockNetworkError = {
  status: 0,
  message: 'Network Error',
  error: true,
  timestamp: new Date().toISOString(),
  isAxiosError: true,
  code: 'ECONNABORTED'
};

// Mock timeout error response
const mockTimeoutError = {
  status: 0,
  message: 'timeout of 10000ms exceeded',
  error: true,
  timestamp: new Date().toISOString(),
  isAxiosError: true,
  code: 'ETIMEDOUT'
};

// Mock malformed token data response
const mockMalformedTokenData = {
  result: [
    {
      // Missing name and symbol
      token_address: '0xMalformedToken123',
      balance: '1000000000000000000',
      decimals: 18
    },
    {
      // Symbol with non-printable characters
      token_address: '0xBadSymbol456',
      symbol: 'BAD\u0000TOKEN', 
      name: 'BadToken',
      balance: '2000000000000000000',
      decimals: 18
    },
    {
      // Extremely long name
      token_address: '0xLongName789',
      symbol: 'LONG',
      name: 'This is an extremely long token name that exceeds reasonable length limits and should be truncated by our sanitization utilities to ensure proper display in the UI without breaking layouts',
      balance: '3000000000000000000',
      decimals: 18
    }
  ]
};

module.exports = {
  mockApiFailure,
  mockRateLimitResponse,
  mockNetworkError,
  mockTimeoutError,
  mockMalformedTokenData
};
