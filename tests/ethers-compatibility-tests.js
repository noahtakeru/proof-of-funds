/**
 * Comprehensive tests for ethers.js compatibility layer
 * 
 * This test suite validates the ethers.js compatibility enhancements
 * from Phase 6, ensuring they work correctly across different environments
 * and with both ethers v5 and v6.
 */

// Import the ethers utilities module
const ethersUtils = require('../packages/common/src/utils/ethersUtils');

/**
 * Categorized test suite for ethers.js compatibility
 */
describe('Ethers.js Compatibility Layer', () => {
  
  // Category 1: Version Detection
  describe('Version Detection', () => {
    test('correctly identifies ethers v5', async () => {
      // Mock ethers v5
      const mockEthersV5 = {
        utils: {
          parseUnits: jest.fn(),
          formatUnits: jest.fn()
        },
        version: '5.7.2'
      };
      
      // Mock the import to return v5
      jest.spyOn(global, 'require').mockImplementation(() => mockEthersV5);
      
      const ethersObj = await ethersUtils.getEthers();
      expect(ethersObj.isV5).toBe(true);
      expect(ethersObj.isV6).toBe(false);
      expect(ethersObj.version).toBe('5.7.2');
      
      // Clean up mock
      jest.restoreAllMocks();
    });
    
    test('correctly identifies ethers v6', async () => {
      // Mock ethers v6
      const mockEthersV6 = {
        parseUnits: jest.fn(),
        formatUnits: jest.fn(),
        version: '6.1.0'
      };
      
      // Mock the import to return v6
      jest.spyOn(global, 'require').mockImplementation(() => mockEthersV6);
      
      const ethersObj = await ethersUtils.getEthers();
      expect(ethersObj.isV5).toBe(false);
      expect(ethersObj.isV6).toBe(true);
      expect(ethersObj.version).toBe('6.1.0');
      
      // Clean up mock
      jest.restoreAllMocks();
    });
    
    test('gracefully handles unversioned ethers', async () => {
      // Mock unversioned ethers with utils (v5-like)
      const mockUnversionedEthers = {
        utils: {
          parseUnits: jest.fn(),
          formatUnits: jest.fn()
        }
        // No version property
      };
      
      // Mock the import to return unversioned
      jest.spyOn(global, 'require').mockImplementation(() => mockUnversionedEthers);
      
      const ethersObj = await ethersUtils.getEthers();
      expect(ethersObj.isV5).toBe(true);
      expect(ethersObj.isV6).toBe(false);
      expect(ethersObj.version).toBe('5.x'); // Default for utils-based detection
      
      // Clean up mock
      jest.restoreAllMocks();
    });
  });
  
  // Category 2: Function Compatibility
  describe('Function Compatibility', () => {
    test('parseUnits works with ethers v5', async () => {
      // Mock ethers v5
      const mockParseUnits = jest.fn().mockReturnValue({ toString: () => '100000000000000000000' });
      const mockEthersV5 = {
        utils: {
          parseUnits: mockParseUnits,
          formatUnits: jest.fn()
        },
        version: '5.7.2'
      };
      
      // Mock the import
      jest.spyOn(global, 'require').mockImplementation(() => mockEthersV5);
      
      const result = await ethersUtils.parseUnits('100', 18);
      expect(mockParseUnits).toHaveBeenCalledWith('100', 18);
      expect(result.toString()).toBe('100000000000000000000');
      
      // Clean up mock
      jest.restoreAllMocks();
    });
    
    test('parseUnits works with ethers v6', async () => {
      // Mock ethers v6
      const mockParseUnits = jest.fn().mockReturnValue({ toString: () => '100000000000000000000' });
      const mockEthersV6 = {
        parseUnits: mockParseUnits,
        formatUnits: jest.fn(),
        version: '6.1.0'
      };
      
      // Mock the import
      jest.spyOn(global, 'require').mockImplementation(() => mockEthersV6);
      
      const result = await ethersUtils.parseUnits('100', 18);
      expect(mockParseUnits).toHaveBeenCalledWith('100', 18);
      expect(result.toString()).toBe('100000000000000000000');
      
      // Clean up mock
      jest.restoreAllMocks();
    });
    
    test('parseUnits falls back to fallbackParseUnits when ethers is unavailable', async () => {
      // Mock ethers import to fail
      jest.spyOn(global, 'require').mockImplementation(() => {
        throw new Error('Module not found');
      });
      
      // Spy on the fallback function
      const fallbackSpy = jest.spyOn(ethersUtils, 'fallbackParseUnits');
      
      // Should use fallback without error
      const result = await ethersUtils.parseUnits('100', 18);
      expect(fallbackSpy).toHaveBeenCalledWith('100', 18);
      expect(result).toBe('100000000000000000000');
      
      // Clean up mock
      jest.restoreAllMocks();
    });
  });
  
  // Category 3: Fallback Implementations
  describe('Fallback Implementations', () => {
    test('fallbackParseUnits correctly handles various inputs', () => {
      // Integer input
      expect(ethersUtils.fallbackParseUnits('100', 18)).toBe('100000000000000000000');
      
      // Decimal input
      expect(ethersUtils.fallbackParseUnits('10.5', 18)).toBe('10500000000000000000');
      
      // String with leading zeros
      expect(ethersUtils.fallbackParseUnits('000100', 18)).toBe('100000000000000000000');
      
      // Zero input
      expect(ethersUtils.fallbackParseUnits('0', 18)).toBe('0');
      
      // Empty input
      expect(ethersUtils.fallbackParseUnits('', 18)).toBe('0');
      
      // Invalid input
      expect(ethersUtils.fallbackParseUnits('abc', 18)).toBe('0');
    });
    
    test('fallbackFormatUnits correctly handles various inputs', () => {
      // Integer input
      expect(ethersUtils.fallbackFormatUnits('1000000000000000000', 18)).toBe('1');
      
      // Large number
      expect(ethersUtils.fallbackFormatUnits('123456789000000000000', 18)).toBe('123.456789');
      
      // Small number
      expect(ethersUtils.fallbackFormatUnits('1', 18)).toBe('0.000000000000000001');
      
      // Zero
      expect(ethersUtils.fallbackFormatUnits('0', 18)).toBe('0');
      
      // Empty input
      expect(ethersUtils.fallbackFormatUnits('', 18)).toBe('0');
    });
  });
  
  // Category 4: Error Handling
  describe('Error Handling', () => {
    test('parseAmount handles invalid inputs gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Empty input
      expect(await ethersUtils.parseAmount('', 18)).toBe('0');
      
      // Null input
      expect(await ethersUtils.parseAmount(null, 18)).toBe('0');
      
      // Invalid string
      expect(await ethersUtils.parseAmount('not-a-number', 18)).toBe('0');
      
      // Negative number
      expect(await ethersUtils.parseAmount('-10', 18)).toBe('0');
      
      // Verify warning was logged
      expect(consoleSpy).toHaveBeenCalled();
      
      // Clean up mock
      consoleSpy.mockRestore();
    });
    
    test('parseAmount handles ethers library errors', async () => {
      // Mock ethers to throw an error
      jest.spyOn(global, 'require').mockImplementation(() => {
        return {
          utils: {
            parseUnits: () => { throw new Error('Simulated ethers error'); }
          }
        };
      });
      
      // Spy on the fallback function
      const fallbackSpy = jest.spyOn(ethersUtils, 'fallbackParseUnits');
      
      // Should catch error and use fallback
      const result = await ethersUtils.parseAmount('100', 18);
      expect(fallbackSpy).toHaveBeenCalled();
      
      // Clean up mock
      jest.restoreAllMocks();
    });
  });
  
  // Category 5: ZK Proof Integration
  describe('ZK Proof Preparation', () => {
    test('parseAmount properly formats values for ZK proof generation', async () => {
      // Mock ethers v5
      const mockParseUnits = jest.fn().mockReturnValue({ toString: () => '1000000000000000000' });
      const mockEthersV5 = {
        utils: {
          parseUnits: mockParseUnits
        },
        version: '5.7.2'
      };
      
      // Mock the import
      jest.spyOn(global, 'require').mockImplementation(() => mockEthersV5);
      
      const amount = '1';
      const amountInWei = await ethersUtils.parseAmount(amount);
      
      // Check it correctly returns Wei amount as string
      expect(typeof amountInWei).toBe('string');
      expect(amountInWei).toBe('1000000000000000000');
      
      // Clean up mock
      jest.restoreAllMocks();
    });
  });
});
