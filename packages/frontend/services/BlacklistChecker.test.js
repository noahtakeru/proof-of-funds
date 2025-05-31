/**
 * Blacklist Checker Service Tests
 */

import { BlacklistChecker, BlacklistSourceConfig } from './BlacklistChecker';
import { ChainType } from '../utils/chains/ChainAdapterRegistry';

// Mock fetch globally
global.fetch = jest.fn();

// Helper to create a mock response
const mockResponse = (status, data) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data)
  });
};

describe('BlacklistChecker', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    fetch.mockClear();
  });

  it('should initialize with default sources', () => {
    const checker = new BlacklistChecker();
    const sources = checker.getSources();
    
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.some(s => s.id === 'chainalysis')).toBe(true);
    expect(sources.some(s => s.id === 'trmLabs')).toBe(true);
    expect(sources.some(s => s.id === 'elliptic')).toBe(true);
  });

  it('should initialize with custom sources', () => {
    const customSources = [
      {
        id: 'custom',
        name: 'Custom Source',
        enabled: true,
        apiUrl: 'https://api.custom.com',
        supportedChains: [ChainType.EVM],
        priority: 1,
        cacheTime: 3600000 // 1 hour
      }
    ];
    
    const checker = new BlacklistChecker(customSources);
    const sources = checker.getSources();
    
    expect(sources.length).toBe(1);
    expect(sources[0].id).toBe('custom');
  });

  it('should add and remove sources', () => {
    const checker = new BlacklistChecker([]);
    
    // Initially no sources
    expect(checker.getSources().length).toBe(0);
    
    // Add a source
    checker.addSource({
      id: 'test',
      name: 'Test Source',
      enabled: true,
      apiUrl: 'https://api.test.com',
      supportedChains: [ChainType.EVM],
      priority: 1,
      cacheTime: 3600000
    });
    
    expect(checker.getSources().length).toBe(1);
    expect(checker.getSources()[0].id).toBe('test');
    
    // Remove the source
    const removed = checker.removeSource('test');
    expect(removed).toBe(true);
    expect(checker.getSources().length).toBe(0);
    
    // Try to remove non-existent source
    const notRemoved = checker.removeSource('nonexistent');
    expect(notRemoved).toBe(false);
  });

  it('should enable and disable sources', () => {
    const checker = new BlacklistChecker([]);
    
    checker.addSource({
      id: 'test',
      name: 'Test Source',
      enabled: true,
      apiUrl: 'https://api.test.com',
      supportedChains: [ChainType.EVM],
      priority: 1,
      cacheTime: 3600000
    });
    
    // Initially enabled
    expect(checker.getSources()[0].enabled).toBe(true);
    
    // Disable the source
    const disabled = checker.setSourceEnabled('test', false);
    expect(disabled).toBe(true);
    expect(checker.getSources()[0].enabled).toBe(false);
    
    // Enable the source
    const enabled = checker.setSourceEnabled('test', true);
    expect(enabled).toBe(true);
    expect(checker.getSources()[0].enabled).toBe(true);
    
    // Try to modify non-existent source
    const notModified = checker.setSourceEnabled('nonexistent', false);
    expect(notModified).toBe(false);
  });

  it('should check address with Chainalysis', async () => {
    // Mock successful Chainalysis API response
    fetch.mockImplementation(() => 
      mockResponse(200, {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        risk: 'high',
        category: 'sanctions'
      })
    );

    const mockSource = {
      id: 'chainalysis',
      name: 'Chainalysis',
      enabled: true,
      apiUrl: 'https://public-api.chainalysis.com/api/v1/address',
      apiKey: 'test-key',
      supportedChains: [ChainType.EVM],
      priority: 1,
      cacheTime: 3600000
    };

    const checker = new BlacklistChecker([mockSource]);
    const result = await checker.checkAddress('0x1234567890abcdef1234567890abcdef12345678', ChainType.EVM);
    
    // Verify the result
    expect(result.isBlacklisted).toBe(true);
    expect(result.results[0].source).toBe('chainalysis');
    expect(result.results[0].category).toBe('sanctions');
    expect(result.results[0].riskScore).toBe(90); // 'high' should be normalized to 90
    
    // Verify the API call
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'https://public-api.chainalysis.com/api/v1/address/0x1234567890abcdef1234567890abcdef12345678?assetType=ETH',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Token': 'test-key'
        })
      })
    );
  });

  it('should check address with TRM Labs', async () => {
    // Mock successful TRM Labs API response
    fetch.mockImplementation(() => 
      mockResponse(200, {
        addresses: [{
          address: '0x1234567890abcdef1234567890abcdef12345678',
          chain: 'ethereum',
          riskScore: 85,
          highRiskCategory: 'darknet'
        }]
      })
    );

    const mockSource = {
      id: 'trmLabs',
      name: 'TRM Labs',
      enabled: true,
      apiUrl: 'https://api.trmlabs.com/public/v1/screening/addresses',
      apiKey: 'test-key',
      supportedChains: [ChainType.EVM],
      priority: 1,
      cacheTime: 3600000
    };

    const checker = new BlacklistChecker([mockSource]);
    const result = await checker.checkAddress('0x1234567890abcdef1234567890abcdef12345678', ChainType.EVM);
    
    // Verify the result
    expect(result.isBlacklisted).toBe(true);
    expect(result.results[0].source).toBe('trmLabs');
    expect(result.results[0].category).toBe('darknet');
    expect(result.results[0].riskScore).toBe(85);
    
    // Verify the API call
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.trmlabs.com/public/v1/screening/addresses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Basic test-key'
        }),
        body: expect.stringContaining('0x1234567890abcdef1234567890abcdef12345678')
      })
    );
  });

  it('should handle API errors gracefully', async () => {
    // Mock failed API response
    fetch.mockImplementation(() => 
      mockResponse(401, { error: 'Unauthorized' })
    );

    const mockSource = {
      id: 'chainalysis',
      name: 'Chainalysis',
      enabled: true,
      apiUrl: 'https://public-api.chainalysis.com/api/v1/address',
      apiKey: 'invalid-key',
      supportedChains: [ChainType.EVM],
      priority: 1,
      cacheTime: 3600000
    };

    const checker = new BlacklistChecker([mockSource]);
    const result = await checker.checkAddress('0x1234567890abcdef1234567890abcdef12345678', ChainType.EVM);
    
    // Verify error handling
    expect(result.isBlacklisted).toBe(false);
    expect(result.results[0].category).toBe('API Error');
    expect(result.results[0].details).toBeDefined();
  });

  it('should check multiple addresses', async () => {
    // Mock API responses for different addresses
    fetch.mockImplementationOnce(() => 
      mockResponse(200, {
        address: '0x1111111111111111111111111111111111111111',
        risk: 'high',
        category: 'sanctions'
      })
    ).mockImplementationOnce(() => 
      mockResponse(200, {
        address: '0x2222222222222222222222222222222222222222',
        risk: 'none',
        category: null
      })
    );

    const mockSource = {
      id: 'chainalysis',
      name: 'Chainalysis',
      enabled: true,
      apiUrl: 'https://public-api.chainalysis.com/api/v1/address',
      apiKey: 'test-key',
      supportedChains: [ChainType.EVM],
      priority: 1,
      cacheTime: 3600000
    };

    const checker = new BlacklistChecker([mockSource]);
    const addresses = [
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222'
    ];
    
    const results = await checker.checkMultipleAddresses(addresses, ChainType.EVM);
    
    // Verify results for both addresses
    expect(Object.keys(results).length).toBe(2);
    expect(results['0x1111111111111111111111111111111111111111'].isBlacklisted).toBe(true);
    expect(results['0x2222222222222222222222222222222222222222'].isBlacklisted).toBe(false);
  });

  it('should use cache for repeated checks', async () => {
    // Mock successful API response
    fetch.mockImplementation(() => 
      mockResponse(200, {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        risk: 'high',
        category: 'sanctions'
      })
    );

    const mockSource = {
      id: 'chainalysis',
      name: 'Chainalysis',
      enabled: true,
      apiUrl: 'https://public-api.chainalysis.com/api/v1/address',
      apiKey: 'test-key',
      supportedChains: [ChainType.EVM],
      priority: 1,
      cacheTime: 3600000
    };

    const checker = new BlacklistChecker([mockSource]);
    
    // First check should make API call
    await checker.checkAddress('0x1234567890abcdef1234567890abcdef12345678', ChainType.EVM);
    expect(fetch).toHaveBeenCalledTimes(1);
    
    // Second check should use cache
    await checker.checkAddress('0x1234567890abcdef1234567890abcdef12345678', ChainType.EVM);
    expect(fetch).toHaveBeenCalledTimes(1); // Still only one call
    
    // Clear cache and check again
    checker.clearCache();
    await checker.checkAddress('0x1234567890abcdef1234567890abcdef12345678', ChainType.EVM);
    expect(fetch).toHaveBeenCalledTimes(2); // Now two calls
  });
});