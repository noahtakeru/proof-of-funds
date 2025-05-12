/**
 * Tests for token metadata handling functionality
 * 
 * This test suite verifies the token metadata sanitization and handling
 * features implemented in Phase 5 of the token-agnostic wallet scanning plan.
 */

// Import the token metadata handling utilities
const { 
  sanitizeTokenMetadata,
  generateTokenDisplayInfo
} = require('../packages/common/src/utils/apiHelpers');

/**
 * Tests for token metadata handling
 */
describe('Token Metadata Handling', () => {
  
  // Test metadata sanitization
  describe('Metadata Sanitization', () => {
    test('handles tokens with missing metadata', () => {
      const token = {
        token_address: '0x1234567890abcdef1234567890abcdef12345678',
        balance: '1000000000000000000',
        chain: 'ethereum'
      };
      
      const sanitized = sanitizeTokenMetadata(token, 'ethereum');
      
      // Verify default values are applied
      expect(sanitized.symbol).toBe('UNKNOWN');
      expect(sanitized.name).toBe('UNKNOWN');
      expect(sanitized.type).toBe('erc20');
      expect(sanitized.chain).toBe('ethereum');
    });
    
    test('truncates excessively long symbols', () => {
      const token = {
        token_address: '0x1234567890abcdef1234567890abcdef12345678',
        symbol: 'REALLYLONGSYMBOLTHATSHOULDBETRUNCATED',
        name: 'Token With Long Symbol',
        balance: '1000000000000000000',
        decimals: 18,
        chain: 'ethereum'
      };
      
      const sanitized = sanitizeTokenMetadata(token, 'ethereum');
      
      // Symbol should be truncated to 20 characters
      expect(sanitized.symbol.length).toBeLessThanOrEqual(20);
      expect(sanitized.symbol).toBe('REALLYLONGSYMBOLTHATS');
    });
    
    test('removes non-printable characters', () => {
      const token = {
        token_address: '0x7890abcdef1234567890abcdef1234567890abcd',
        symbol: 'BAD\u0000\u001FSYM\u007F',
        name: 'Problem\u0000 Token\u001F Name\u007F',
        balance: '3000000000000000000',
        decimals: 18,
        chain: 'ethereum'
      };
      
      const sanitized = sanitizeTokenMetadata(token, 'ethereum');
      
      // Non-printable characters should be removed
      expect(sanitized.symbol).toBe('BADSYM');
      expect(sanitized.name).toBe('Problem Token Name');
    });
    
    test('formats balance correctly', () => {
      const token = {
        token_address: '0x1234567890abcdef1234567890abcdef12345678',
        symbol: 'TEST',
        name: 'Test Token',
        balance: '1234560000000000000000', // 1234.56 with 18 decimals
        decimals: 18,
        chain: 'ethereum'
      };
      
      const sanitized = sanitizeTokenMetadata(token, 'ethereum');
      
      // Balance should be formatted correctly
      expect(sanitized.balance).toBe(1234.56);
      expect(sanitized.balance_formatted).toBe('1234.560000');
    });
  });
  
  // Test default token information generation
  describe('Default Token Information', () => {
    test('provides default info for native tokens', () => {
      const nativeToken = {
        token_address: '0xNative',
        type: 'native',
        chain: 'ethereum',
        balance: '1000000000000000000',
        balance_formatted: '1'
      };
      
      const enhanced = generateTokenDisplayInfo(nativeToken);
      
      // Should have Ethereum defaults
      expect(enhanced.symbol).toBe('ETH');
      expect(enhanced.name).toBe('Ethereum');
    });
    
    test('provides defaults for native tokens on different chains', () => {
      // Test various chains
      const chains = [
        { chain: 'ethereum', expectedSymbol: 'ETH', expectedName: 'Ethereum' },
        { chain: 'polygon', expectedSymbol: 'MATIC', expectedName: 'Polygon' },
        { chain: 'bsc', expectedSymbol: 'BNB', expectedName: 'BNB Chain' },
        { chain: 'arbitrum', expectedSymbol: 'ETH', expectedName: 'Arbitrum ETH' },
        { chain: 'avalanche', expectedSymbol: 'AVAX', expectedName: 'Avalanche' },
        { chain: 'fantom', expectedSymbol: 'FTM', expectedName: 'Fantom' }
      ];
      
      chains.forEach(({ chain, expectedSymbol, expectedName }) => {
        const nativeToken = {
          token_address: '0xNative',
          type: 'native',
          chain,
          balance: '1000000000000000000',
          balance_formatted: '1'
        };
        
        const enhanced = generateTokenDisplayInfo(nativeToken);
        
        expect(enhanced.symbol).toBe(expectedSymbol);
        expect(enhanced.name).toBe(expectedName);
      });
    });
    
    test('generates display info for tokens without metadata', () => {
      const unknownToken = {
        token_address: '0xabcdef1234567890abcdef1234567890abcdef12',
        type: 'erc20',
        chain: 'polygon',
        balance: '2000000000000000000',
        balance_formatted: '2'
      };
      
      const enhanced = generateTokenDisplayInfo(unknownToken);
      
      // Should generate a symbol based on address
      expect(enhanced.symbol).toBe('0xabcd');
      expect(enhanced.name).toContain('Unknown Token');
      expect(enhanced.name).toContain('0xabcdef123');
    });
    
    test('preserves existing token information', () => {
      const token = {
        token_address: '0x1234567890abcdef1234567890abcdef12345678',
        symbol: 'TEST',
        name: 'Test Token',
        type: 'erc20',
        chain: 'ethereum',
        balance: '1000000000000000000',
        balance_formatted: '1'
      };
      
      const enhanced = generateTokenDisplayInfo(token);
      
      // Should keep existing information
      expect(enhanced.symbol).toBe('TEST');
      expect(enhanced.name).toBe('Test Token');
    });
  });
  
  // Test special cases
  describe('Special Cases Handling', () => {
    test('handles tokens with extreme decimal places', () => {
      // Token with 27 decimals (some unusual tokens have this)
      const extremeDecimalsToken = {
        token_address: '0xExtremeDecimals',
        symbol: 'EXTD',
        name: 'Extreme Decimals Token',
        balance: '123456789000000000000000000000', // 123.456789 with 27 decimals
        decimals: 27,
        chain: 'ethereum'
      };
      
      const sanitized = sanitizeTokenMetadata(extremeDecimalsToken, 'ethereum');
      
      // Balance should be calculated correctly despite extreme decimals
      expect(sanitized.decimals).toBe(27);
      expect(sanitized.balance_formatted).not.toBe('123456789000000000000000000000');
    });
    
    test('handles tokens with zero decimals', () => {
      // Some tokens like Yearn yUSD have 0 decimals
      const zeroDecimalsToken = {
        token_address: '0xZeroDecimals',
        symbol: 'ZERO',
        name: 'Zero Decimals Token',
        balance: '1234', // 1234 with 0 decimals
        decimals: 0,
        chain: 'ethereum'
      };
      
      const sanitized = sanitizeTokenMetadata(zeroDecimalsToken, 'ethereum');
      
      // Balance should be calculated correctly with zero decimals
      expect(sanitized.decimals).toBe(0);
      expect(sanitized.balance).toBe(1234);
      expect(sanitized.balance_formatted).toBe('1234');
    });
    
    test('handles tokens with malformed decimal values', () => {
      // Token with non-numeric decimals field
      const badDecimalsToken = {
        token_address: '0xBadDecimals',
        symbol: 'BAD',
        name: 'Bad Decimals Token',
        balance: '1000000000000000000',
        decimals: 'eighteen', // Not a number
        chain: 'ethereum'
      };
      
      const sanitized = sanitizeTokenMetadata(badDecimalsToken, 'ethereum');
      
      // Should default to 18 decimals
      expect(sanitized.decimals).toBe(18);
    });
  });
});
