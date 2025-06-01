/**
 * Tests for password utilities
 */

import { 
  hashPassword, 
  verifyPassword, 
  validatePassword, 
  generateSecureToken,
  hashToken,
  generatePasswordResetToken,
  generateEmailVerificationToken
} from '../../utils/passwordUtils';

describe('passwordUtils', () => {
  describe('hashPassword and verifyPassword', () => {
    it('should hash a password and verify it correctly', async () => {
      const password = 'TestPassword123!';
      
      // Hash the password
      const hashedPassword = await hashPassword(password);
      
      // Verify the password against the hash
      const isValid = await verifyPassword(password, hashedPassword);
      
      expect(isValid).toBe(true);
    });
    
    it('should return false for incorrect password', async () => {
      const password = 'TestPassword123!';
      const incorrectPassword = 'WrongPassword123!';
      
      // Hash the password
      const hashedPassword = await hashPassword(password);
      
      // Verify with the wrong password
      const isValid = await verifyPassword(incorrectPassword, hashedPassword);
      
      expect(isValid).toBe(false);
    });
    
    it('should generate different hashes for the same password', async () => {
      const password = 'TestPassword123!';
      
      // Hash the password twice
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      // The hashes should be different due to different salts
      expect(hash1).not.toBe(hash2);
      
      // But both should verify correctly
      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });
  });
  
  describe('validatePassword', () => {
    it('should validate a strong password', () => {
      const result = validatePassword('StrongPassword123!');
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });
    
    it('should reject a short password', () => {
      const result = validatePassword('Short1!');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('at least 8 characters');
    });
    
    it('should reject a password missing uppercase', () => {
      const result = validatePassword('nouppercasepassword123!');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('one uppercase letter');
    });
    
    it('should reject a password missing lowercase', () => {
      const result = validatePassword('NOLOWERCASEPASSWORD123!');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('one lowercase letter');
    });
    
    it('should reject a password missing numbers', () => {
      const result = validatePassword('NoNumbersPassword!');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('one number');
    });
    
    it('should reject a password missing special characters', () => {
      const result = validatePassword('NoSpecialChars123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('one special character');
    });
  });
  
  describe('token generation', () => {
    it('should generate a secure token of the specified length', () => {
      const token = generateSecureToken(32);
      // A 32-byte token encoded as hex will be 64 characters
      expect(token.length).toBe(64);
      
      // Generate another token and ensure it's different
      const token2 = generateSecureToken(32);
      expect(token).not.toBe(token2);
    });
    
    it('should hash a token consistently', () => {
      const token = 'test-token-123';
      const hashedToken = hashToken(token);
      
      // The same token should produce the same hash
      expect(hashToken(token)).toBe(hashedToken);
      
      // Different token should produce different hash
      expect(hashToken('different-token')).not.toBe(hashedToken);
    });
    
    it('should generate a password reset token with expiration', () => {
      const { token, expires } = generatePasswordResetToken();
      
      // Token should be a hex string
      expect(token).toMatch(/^[0-9a-f]+$/);
      
      // Expiration should be approximately 24 hours in the future
      const now = new Date();
      const hoursDiff = (expires.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBeCloseTo(24, 0);
    });
    
    it('should generate an email verification token with expiration', () => {
      const { token, expires } = generateEmailVerificationToken();
      
      // Token should be a hex string
      expect(token).toMatch(/^[0-9a-f]+$/);
      
      // Expiration should be approximately 24 hours in the future
      const now = new Date();
      const hoursDiff = (expires.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBeCloseTo(24, 0);
    });
  });
});