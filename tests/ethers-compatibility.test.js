/**
 * Test Suite for Ethers.js Compatibility Enhancement
 * 
 * These tests verify that the enhanced ethersUtils module correctly handles
 * different ethers.js versions and provides robust fallbacks.
 */

// Import the utils directly
const ethersUtils = require('../packages/common/src/utils/ethersUtils.js');

/**
 * Tests for the ethers.js compatibility enhancement
 */
describe('Ethers.js Compatibility Enhancement', () => {
  
  /**
   * Test getEthers function
   */
  describe('getEthers()', () => {
    test('should return ethers instance with version detection', async () => {
      const ethersObj = await ethersUtils.getEthers();
      expect(ethersObj).toBeDefined();
      expect(ethersObj.ethers).toBeDefined();
      expect(typeof ethersObj.version).toBe('string');
      expect(typeof ethersObj.isV5).toBe('boolean');
      expect(typeof ethersObj.isV6).toBe('boolean');
      
      // Either v5 or v6 should be true
      expect(ethersObj.isV5 || ethersObj.isV6).toBe(true);
    });
  });
  
  /**
   * Test parseUnits function
   */
  describe('parseUnits()', () => {
    test('should parse integer values correctly', async () => {
      const result = await ethersUtils.parseUnits('100', 18);
      expect(result.toString()).toBe('100000000000000000000');
    });
    
    test('should parse decimal values correctly', async () => {
      const result = await ethersUtils.parseUnits('10.5', 18);
      expect(result.toString()).toBe('10500000000000000000');
    });
    
    test('should handle different decimal places', async () => {
      const result = await ethersUtils.parseUnits('100', 6);
      expect(result.toString()).toBe('100000000');
    });
    
    test('should convert input to string', async () => {
      const result = await ethersUtils.parseUnits(100, 18);
      expect(result.toString()).toBe('100000000000000000000');
    });
  });
  
  /**
   * Test fallbackParseUnits function
   */
  describe('fallbackParseUnits()', () => {
    test('should parse integer values correctly', () => {
      const result = ethersUtils.fallbackParseUnits('100', 18);
      expect(result).toBe('100000000000000000000');
    });
    
    test('should parse decimal values correctly', () => {
      const result = ethersUtils.fallbackParseUnits('10.5', 18);
      expect(result).toBe('10500000000000000000');
    });
    
    test('should handle different decimal places', () => {
      const result = ethersUtils.fallbackParseUnits('100', 6);
      expect(result).toBe('100000000');
    });
    
    test('should handle leading zeros', () => {
      const result = ethersUtils.fallbackParseUnits('000100.500', 18);
      expect(result).toBe('100500000000000000000');
    });
    
    test('should return 0 for invalid values', () => {
      const result = ethersUtils.fallbackParseUnits('invalid', 18);
      expect(result).toBe('0');
    });
  });
  
  /**
   * Test fallbackFormatUnits function
   */
  describe('fallbackFormatUnits()', () => {
    test('should format integer values correctly', () => {
      const result = ethersUtils.fallbackFormatUnits('100000000000000000000', 18);
      expect(result).toBe('100');
    });
    
    test('should format decimal values correctly', () => {
      const result = ethersUtils.fallbackFormatUnits('10500000000000000000', 18);
      expect(result).toBe('10.5');
    });
    
    test('should handle different decimal places', () => {
      const result = ethersUtils.fallbackFormatUnits('100000000', 6);
      expect(result).toBe('100');
    });
    
    test('should handle small values', () => {
      const result = ethersUtils.fallbackFormatUnits('1', 18);
      expect(result).toBe('0.000000000000000001');
    });
    
    test('should return 0 for invalid values', () => {
      const result = ethersUtils.fallbackFormatUnits('', 18);
      expect(result).toBe('0');
    });
  });
  
  /**
   * Test parseAmount function
   */
  describe('parseAmount()', () => {
    test('should handle normal values', async () => {
      const result = await ethersUtils.parseAmount('10.5', 18);
      expect(result.toString()).toBe('10500000000000000000');
    });
    
    test('should handle empty values', async () => {
      const result = await ethersUtils.parseAmount('', 18);
      expect(result).toBe('0');
    });
    
    test('should handle invalid values', async () => {
      const result = await ethersUtils.parseAmount('invalid', 18);
      expect(result).toBe('0');
    });
  });
  
  /**
   * Test isValidAmount function
   */
  describe('isValidAmount()', () => {
    test('should validate proper numbers', () => {
      expect(ethersUtils.isValidAmount('10')).toBe(true);
      expect(ethersUtils.isValidAmount('10.5')).toBe(true);
      expect(ethersUtils.isValidAmount(10)).toBe(true);
      expect(ethersUtils.isValidAmount(10.5)).toBe(true);
    });
    
    test('should reject invalid values', () => {
      expect(ethersUtils.isValidAmount('')).toBe(false);
      expect(ethersUtils.isValidAmount(null)).toBe(false);
      expect(ethersUtils.isValidAmount(undefined)).toBe(false);
      expect(ethersUtils.isValidAmount('abc')).toBe(false);
      expect(ethersUtils.isValidAmount('-10')).toBe(false);
    });
  });
});