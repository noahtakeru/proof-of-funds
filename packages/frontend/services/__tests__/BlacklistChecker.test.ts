/**
 * Blacklist Checker Tests
 */
import BlacklistChecker, { 
  BlacklistSourceConfig,
  BlacklistCheckResult,
  AggregatedBlacklistResult
} from '../BlacklistChecker';
import { ChainType } from '../../utils/chains/ChainAdapterRegistry';

// Mock global fetch
global.fetch = jest.fn();

describe('BlacklistChecker', () => {
  let checker: BlacklistChecker;
  
  const mockSources: BlacklistSourceConfig[] = [
    {
      id: 'mockSource1',
      name: 'Mock Source 1',
      enabled: true,
      apiUrl: 'https://api.mock1.com',
      apiKey: 'mock-key-1',
      supportedChains: [ChainType.EVM, ChainType.BITCOIN],
      priority: 1,
      cacheTime: 3600000 // 1 hour
    },
    {
      id: 'mockSource2',
      name: 'Mock Source 2',
      enabled: true,
      apiUrl: 'https://api.mock2.com',
      apiKey: 'mock-key-2',
      supportedChains: [ChainType.EVM, ChainType.SOLANA],
      priority: 2,
      cacheTime: 3600000 // 1 hour
    },
    {
      id: 'disabledSource',
      name: 'Disabled Source',
      enabled: false,
      apiUrl: 'https://api.disabled.com',
      apiKey: 'disabled-key',
      supportedChains: [ChainType.EVM],
      priority: 3,
      cacheTime: 3600000 // 1 hour
    }
  ];
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
    
    // Create checker with mock sources
    checker = new BlacklistChecker(mockSources);
    
    // Mock Date.now for consistent timestamps
    jest.spyOn(Date, 'now').mockImplementation(() => 1620000000000);
  });

  describe('Constructor and Source Management', () => {
    it('should initialize with provided sources', () => {
      const sources = checker.getSources();
      expect(sources.length).toBe(3);
      expect(sources[0].id).toBe('mockSource1'); // Should be sorted by priority
      expect(sources[1].id).toBe('mockSource2');
      expect(sources[2].id).toBe('disabledSource');
    });

    it('should initialize with default sources if none provided', () => {
      // Create a spy on the addDefaultSources method
      const addDefaultSourcesSpy = jest.spyOn(BlacklistChecker.prototype as any, 'addDefaultSources');
      
      const defaultChecker = new BlacklistChecker();
      
      expect(addDefaultSourcesSpy).toHaveBeenCalled();
      expect(defaultChecker.getSources().length).toBeGreaterThan(0);
      
      addDefaultSourcesSpy.mockRestore();
    });

    it('should add a new source', () => {
      const newSource: BlacklistSourceConfig = {
        id: 'newSource',
        name: 'New Source',
        enabled: true,
        apiUrl: 'https://api.new.com',
        apiKey: 'new-key',
        supportedChains: [ChainType.BITCOIN],
        priority: 4,
        cacheTime: 3600000
      };
      
      checker.addSource(newSource);
      
      const sources = checker.getSources();
      expect(sources.length).toBe(4);
      expect(sources.find(s => s.id === 'newSource')).toBeDefined();
    });

    it('should update an existing source', () => {
      const updatedSource: BlacklistSourceConfig = {
        id: 'mockSource1',
        name: 'Updated Source 1',
        enabled: true,
        apiUrl: 'https://api.updated.com',
        apiKey: 'updated-key',
        supportedChains: [ChainType.EVM],
        priority: 1,
        cacheTime: 7200000
      };
      
      checker.addSource(updatedSource);
      
      const sources = checker.getSources();
      expect(sources.length).toBe(3); // Should not add a duplicate
      const source = sources.find(s => s.id === 'mockSource1');
      expect(source?.name).toBe('Updated Source 1');
      expect(source?.apiUrl).toBe('https://api.updated.com');
    });

    it('should remove a source', () => {
      const result = checker.removeSource('mockSource2');
      
      expect(result).toBe(true);
      expect(checker.getSources().length).toBe(2);
      expect(checker.getSources().find(s => s.id === 'mockSource2')).toBeUndefined();
    });

    it('should return false when removing a non-existent source', () => {
      const result = checker.removeSource('nonExistentSource');
      
      expect(result).toBe(false);
      expect(checker.getSources().length).toBe(3);
    });

    it('should enable or disable a source', () => {
      // Disable an enabled source
      const disableResult = checker.setSourceEnabled('mockSource1', false);
      expect(disableResult).toBe(true);
      expect(checker.getSources().find(s => s.id === 'mockSource1')?.enabled).toBe(false);
      
      // Enable a disabled source
      const enableResult = checker.setSourceEnabled('disabledSource', true);
      expect(enableResult).toBe(true);
      expect(checker.getSources().find(s => s.id === 'disabledSource')?.enabled).toBe(true);
    });

    it('should return false when enabling/disabling a non-existent source', () => {
      const result = checker.setSourceEnabled('nonExistentSource', true);
      expect(result).toBe(false);
    });
  });

  describe('Cache Management', () => {
    it('should cache results and retrieve them', async () => {
      // Mock a check result
      const mockResult: BlacklistCheckResult = {
        source: 'mockSource1',
        sourceName: 'Mock Source 1',
        address: '0x123',
        isBlacklisted: false,
        timestamp: Date.now()
      };
      
      // Set the result in cache
      // @ts-ignore - accessing private method for testing
      checker['cacheResult'](mockResult, 3600000);
      
      // Retrieve from cache
      // @ts-ignore - accessing private method for testing
      const cachedResult = checker['getCachedResult']('0x123', 'mockSource1');
      
      expect(cachedResult).toEqual(mockResult);
    });

    it('should not return expired cache entries', async () => {
      // Create a new checker instance to ensure clean cache
      const testChecker = new BlacklistChecker([
        {
          id: 'mockSource1',
          name: 'Mock Source 1',
          enabled: true,
          apiUrl: 'https://mock1.api',
          supportedChains: [ChainType.EVM],
          priority: 1,
          cacheTime: 1000
        }
      ]);
      
      // Mock Date.now to return a fixed timestamp for testing
      const realDateNow = Date.now;
      const mockNow = 1620000000000;
      Date.now = jest.fn(() => mockNow);
      
      // Mock a check result
      const mockResult: BlacklistCheckResult = {
        source: 'mockSource1',
        sourceName: 'Mock Source 1',
        address: '0x123',
        isBlacklisted: false,
        timestamp: mockNow
      };
      
      // Set the result in cache with a very short expiry
      // @ts-ignore - accessing private method for testing
      testChecker['cacheResult'](mockResult, 100);
      
      // Advance the mock time to expire the cache
      Date.now = jest.fn(() => mockNow + 200);
      
      // Retrieve from cache
      // @ts-ignore - accessing private method for testing
      const cachedResult = testChecker['getCachedResult']('0x123', 'mockSource1');
      
      expect(cachedResult).toBeNull();
      
      // Restore Date.now
      Date.now = realDateNow;
    });

    it('should clear the cache', async () => {
      // Mock a check result
      const mockResult: BlacklistCheckResult = {
        source: 'mockSource1',
        sourceName: 'Mock Source 1',
        address: '0x123',
        isBlacklisted: false,
        timestamp: Date.now()
      };
      
      // Set the result in cache
      // @ts-ignore - accessing private method for testing
      checker['cacheResult'](mockResult, 3600000);
      
      // Clear the cache
      checker.clearCache();
      
      // Retrieve from cache
      // @ts-ignore - accessing private method for testing
      const cachedResult = checker['getCachedResult']('0x123', 'mockSource1');
      
      expect(cachedResult).toBeNull();
    });
  });

  describe('API Integration', () => {
    it('should check address with Chainalysis API', async () => {
      // Mock a successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          risk: 'high',
          category: 'scam'
        })
      });
      
      // @ts-ignore - accessing private method for testing
      const result = await checker['checkChainalysis'](
        '0x123',
        ChainType.EVM,
        mockSources[0]
      );
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.mock1.com/0x123?assetType=ETH',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Token': 'mock-key-1'
          })
        })
      );
      
      expect(result.isBlacklisted).toBe(true);
      expect(result.category).toBe('scam');
      expect(result.riskScore).toBe(90); // Converted from 'high'
    });

    it('should check address with TRM Labs API', async () => {
      // Mock a successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          addresses: [{
            address: '0x123',
            chain: 'ethereum',
            riskScore: 80,
            highRiskCategory: 'darkweb'
          }]
        })
      });
      
      // @ts-ignore - accessing private method for testing
      const result = await checker['checkTrmLabs'](
        '0x123',
        ChainType.EVM,
        mockSources[1]
      );
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.mock2.com',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Basic mock-key-2'
          }),
          body: expect.stringContaining('0x123')
        })
      );
      
      expect(result.isBlacklisted).toBe(true);
      expect(result.category).toBe('darkweb');
      expect(result.riskScore).toBe(80);
    });

    it('should check address with Elliptic API', async () => {
      // Mock a successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          riskScore: 80,
          categories: [{ name: 'ransomware' }]
        })
      });
      
      // Create a mock source for Elliptic
      const ellipticSource: BlacklistSourceConfig = {
        id: 'elliptic',
        name: 'Elliptic',
        enabled: true,
        apiUrl: 'https://api.elliptic.co/v2/screening/address',
        apiKey: 'elliptic-key',
        supportedChains: [ChainType.EVM, ChainType.BITCOIN],
        priority: 3,
        cacheTime: 3600000
      };
      
      // @ts-ignore - accessing private method for testing
      const result = await checker['checkElliptic'](
        '0x123',
        ChainType.EVM,
        ellipticSource
      );
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elliptic.co/v2/screening/address/eth/0x123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'elliptic-key'
          })
        })
      );
      
      expect(result.isBlacklisted).toBe(true);
      expect(result.category).toBe('ransomware');
      expect(result.riskScore).toBe(80);
    });

    it('should handle API errors gracefully', async () => {
      // Create a mock source that will trigger the chainalysis API path
      const chainalysisSource = {
        id: 'chainalysis',
        name: 'Chainalysis Mock',
        enabled: true,
        apiUrl: 'https://api.chainalysis.com',
        apiKey: 'test-key',
        supportedChains: [ChainType.EVM, ChainType.BITCOIN],
        priority: 1,
        cacheTime: 24 * 60 * 60 * 1000
      };
      
      // Mock a failed API response
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // @ts-ignore - accessing private method for testing
      const result = await checker['checkAddressWithSource'](
        '0x123',
        ChainType.EVM,
        chainalysisSource
      );
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result.isBlacklisted).toBe(false);
      expect(result.category).toBe('API Error');
      expect(result.details).toHaveProperty('error', 'Network error');
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle unsupported chain types', async () => {
      // @ts-ignore - Create a mock source with limited chain support
      const limitedSource = {
        ...mockSources[0],
        supportedChains: [ChainType.BITCOIN]
      };
      
      // @ts-ignore - accessing private method for testing
      const result = await checker['checkAddressWithSource'](
        '0x123',
        ChainType.EVM,
        limitedSource
      );
      
      expect(result.isBlacklisted).toBe(false);
      expect(result.category).toBe('Unsupported chain');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Address Checking', () => {
    it('should check address against all enabled sources', async () => {
      // Mock responses for each source
      // @ts-ignore - accessing private method for testing
      jest.spyOn(checker as any, 'checkAddressWithSource')
        .mockResolvedValueOnce({
          source: 'mockSource1',
          sourceName: 'Mock Source 1',
          address: '0x123',
          isBlacklisted: true,
          category: 'scam',
          riskScore: 90,
          timestamp: Date.now()
        })
        .mockResolvedValueOnce({
          source: 'mockSource2',
          sourceName: 'Mock Source 2',
          address: '0x123',
          isBlacklisted: false,
          riskScore: 30,
          timestamp: Date.now()
        });
      
      const result = await checker.checkAddress('0x123', ChainType.EVM);
      
      expect(result.isBlacklisted).toBe(true); // True if any source reports blacklisted
      expect(result.results.length).toBe(2); // Two enabled sources
      expect(result.highestRiskScore).toBe(90);
    });

    it('should throw error if no enabled sources', async () => {
      // Create a checker with all sources disabled
      const disabledChecker = new BlacklistChecker([
        { ...mockSources[0], enabled: false },
        { ...mockSources[1], enabled: false }
      ]);
      
      await expect(
        disabledChecker.checkAddress('0x123', ChainType.EVM)
      ).rejects.toThrow('No enabled blacklist sources configured');
    });

    it('should handle errors from individual sources', async () => {
      // First source throws error, second returns normally
      // @ts-ignore - accessing private method for testing
      jest.spyOn(checker as any, 'checkAddressWithSource')
        .mockRejectedValueOnce(new Error('Source error'))
        .mockResolvedValueOnce({
          source: 'mockSource2',
          sourceName: 'Mock Source 2',
          address: '0x123',
          isBlacklisted: true,
          category: 'darkweb',
          riskScore: 85,
          timestamp: Date.now()
        });
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await checker.checkAddress('0x123', ChainType.EVM);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result.isBlacklisted).toBe(true); // Based on second source
      expect(result.results.length).toBe(2); // Both sources produce results
      expect(result.results[0].category).toBe('Error'); // Error from first source
      
      consoleErrorSpy.mockRestore();
    });

    it('should check multiple addresses', async () => {
      // Mock address checking method to return predictable results
      jest.spyOn(checker, 'checkAddress')
        .mockResolvedValueOnce({
          address: '0x123',
          isBlacklisted: true,
          results: [{
            source: 'mockSource1',
            sourceName: 'Mock Source 1',
            address: '0x123',
            isBlacklisted: true,
            timestamp: Date.now()
          }],
          timestamp: Date.now()
        })
        .mockResolvedValueOnce({
          address: '0x456',
          isBlacklisted: false,
          results: [{
            source: 'mockSource1',
            sourceName: 'Mock Source 1',
            address: '0x456',
            isBlacklisted: false,
            timestamp: Date.now()
          }],
          timestamp: Date.now()
        });
      
      const results = await checker.checkMultipleAddresses(
        ['0x123', '0x456'],
        ChainType.EVM
      );
      
      expect(Object.keys(results).length).toBe(2);
      expect(results['0x123'].isBlacklisted).toBe(true);
      expect(results['0x456'].isBlacklisted).toBe(false);
    });

    it('should handle errors when checking multiple addresses', async () => {
      // First address check throws error
      jest.spyOn(checker, 'checkAddress')
        .mockRejectedValueOnce(new Error('Check error'))
        .mockResolvedValueOnce({
          address: '0x456',
          isBlacklisted: false,
          results: [{
            source: 'mockSource1',
            sourceName: 'Mock Source 1',
            address: '0x456',
            isBlacklisted: false,
            timestamp: Date.now()
          }],
          timestamp: Date.now()
        });
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const results = await checker.checkMultipleAddresses(
        ['0x123', '0x456'],
        ChainType.EVM
      );
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(Object.keys(results).length).toBe(2);
      expect(results['0x123'].isBlacklisted).toBe(false);
      expect(results['0x123'].results[0].source).toBe('error');
      expect(results['0x456'].isBlacklisted).toBe(false);
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Utility Methods', () => {
    it('should convert chain types correctly for Chainalysis', () => {
      // @ts-ignore - accessing private method for testing
      expect(checker['getChainAssetType'](ChainType.EVM)).toBe('ETH');
      // @ts-ignore - accessing private method for testing
      expect(checker['getChainAssetType'](ChainType.BITCOIN)).toBe('BTC');
      // @ts-ignore - accessing private method for testing
      expect(checker['getChainAssetType'](ChainType.SOLANA)).toBe('SOL');
      
      // Should throw for unsupported chain
      // @ts-ignore - testing with invalid chain type
      expect(() => checker['getChainAssetType']('UNSUPPORTED')).toThrow();
    });

    it('should convert chain types correctly for TRM Labs', () => {
      // @ts-ignore - accessing private method for testing
      expect(checker['getTrmChainName'](ChainType.EVM)).toBe('ethereum');
      // @ts-ignore - accessing private method for testing
      expect(checker['getTrmChainName'](ChainType.BITCOIN)).toBe('bitcoin');
      // @ts-ignore - accessing private method for testing
      expect(checker['getTrmChainName'](ChainType.SOLANA)).toBe('solana');
      
      // Should throw for unsupported chain
      // @ts-ignore - testing with invalid chain type
      expect(() => checker['getTrmChainName']('UNSUPPORTED')).toThrow();
    });

    it('should convert chain types correctly for Elliptic', () => {
      // @ts-ignore - accessing private method for testing
      expect(checker['getEllipticAssetType'](ChainType.EVM)).toBe('eth');
      // @ts-ignore - accessing private method for testing
      expect(checker['getEllipticAssetType'](ChainType.BITCOIN)).toBe('btc');
      
      // Should throw for unsupported chain
      // @ts-ignore - accessing private method for testing
      expect(() => checker['getEllipticAssetType'](ChainType.SOLANA)).toThrow();
    });

    it('should normalize risk scores correctly', () => {
      // @ts-ignore - accessing private method for testing
      expect(checker['normalizeRiskScore'](50)).toBe(50);
      // @ts-ignore - accessing private method for testing
      expect(checker['normalizeRiskScore'](120)).toBe(100); // Capped at 100
      // @ts-ignore - accessing private method for testing
      expect(checker['normalizeRiskScore'](-10)).toBe(0); // Capped at 0
      
      // String risk levels
      // @ts-ignore - accessing private method for testing
      expect(checker['normalizeRiskScore']('high')).toBe(90);
      // @ts-ignore - accessing private method for testing
      expect(checker['normalizeRiskScore']('medium')).toBe(65);
      // @ts-ignore - accessing private method for testing
      expect(checker['normalizeRiskScore']('low')).toBe(30);
      // @ts-ignore - accessing private method for testing
      expect(checker['normalizeRiskScore']('none')).toBe(0);
      // @ts-ignore - accessing private method for testing
      expect(checker['normalizeRiskScore']('unknown')).toBe(0);
    });
  });
});