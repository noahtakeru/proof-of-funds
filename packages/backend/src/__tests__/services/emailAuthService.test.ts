/**
 * Email Authentication Service Tests
 * 
 * Tests for email-based authentication functionality
 */

import { jest } from '@jest/globals';
import * as emailAuthService from '../../services/emailAuthService';
import * as emailVerificationService from '../../services/emailVerificationService';
import * as jwtService from '../../services/jwtService';
import * as passwordUtils from '../../utils/passwordUtils';
import { prisma } from '@proof-of-funds/db';
import { auditLogService } from '../../services/auditLogService';

// Mock dependencies
jest.mock('@proof-of-funds/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }
  },
  transaction: jest.fn((callback) => callback({ user: { create: jest.fn(), update: jest.fn() } }))
}));

jest.mock('../../utils/passwordUtils', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
  validatePassword: jest.fn(),
  generatePasswordResetToken: jest.fn(),
  hashToken: jest.fn()
}));

jest.mock('../../services/jwtService', () => ({
  generateTokenPair: jest.fn()
}));

jest.mock('../../services/emailVerificationService', () => ({
  sendVerificationEmail: jest.fn()
}));

jest.mock('../../services/auditLogService', () => ({
  auditLogService: {
    log: jest.fn()
  }
}));

// Utility function to reset all mocks
const resetMocks = () => {
  jest.clearAllMocks();
  
  // Default mock return values
  (passwordUtils.validatePassword as jest.Mock).mockReturnValue({ valid: true });
  (passwordUtils.hashPassword as jest.Mock).mockResolvedValue('hashed_password');
  (passwordUtils.verifyPassword as jest.Mock).mockResolvedValue(true);
  (passwordUtils.generatePasswordResetToken as jest.Mock).mockReturnValue({ 
    token: 'reset_token', 
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000) 
  });
  (passwordUtils.hashToken as jest.Mock).mockReturnValue('hashed_token');
  
  (emailVerificationService.sendVerificationEmail as jest.Mock).mockResolvedValue(true);
  
  (jwtService.generateTokenPair as jest.Mock).mockResolvedValue({
    accessToken: 'access_token',
    refreshToken: 'refresh_token'
  });
  
  (prisma.user.create as jest.Mock).mockResolvedValue({
    id: 'user_id',
    email: 'test@example.com',
    passwordHash: 'hashed_password',
    emailVerified: false,
    permissions: ['USER']
  });
  
  (prisma.user.update as jest.Mock).mockResolvedValue({
    id: 'user_id',
    email: 'test@example.com'
  });
  
  (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
  (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
};

describe('Email Authentication Service', () => {
  beforeEach(() => {
    resetMocks();
  });
  
  describe('registerWithEmail', () => {
    it('should register a new user successfully', async () => {
      // Setup
      const email = 'test@example.com';
      const password = 'StrongPassword123!';
      const baseUrl = 'http://localhost:3000';
      
      // Execute
      const result = await emailAuthService.registerWithEmail(email, password, baseUrl);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.userId).toBe('user_id');
      expect(passwordUtils.validatePassword).toHaveBeenCalledWith(password);
      expect(passwordUtils.hashPassword).toHaveBeenCalledWith(password);
      expect(prisma.user.create).toHaveBeenCalled();
      expect(emailVerificationService.sendVerificationEmail).toHaveBeenCalledWith(
        'user_id', 
        email, 
        baseUrl
      );
      expect(auditLogService.log).toHaveBeenCalled();
    });
    
    it('should reject if email already exists', async () => {
      // Setup
      const email = 'existing@example.com';
      const password = 'StrongPassword123!';
      const baseUrl = 'http://localhost:3000';
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing_user_id',
        email
      });
      
      // Execute
      const result = await emailAuthService.registerWithEmail(email, password, baseUrl);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.userId).toBeNull();
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(emailVerificationService.sendVerificationEmail).not.toHaveBeenCalled();
    });
    
    it('should reject if password is weak', async () => {
      // Setup
      const email = 'test@example.com';
      const password = 'weak';
      const baseUrl = 'http://localhost:3000';
      
      (passwordUtils.validatePassword as jest.Mock).mockReturnValue({ 
        valid: false, 
        message: 'Password is too weak' 
      });
      
      // Execute
      const result = await emailAuthService.registerWithEmail(email, password, baseUrl);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Password is too weak');
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });
  
  describe('loginWithEmail', () => {
    it('should login successfully with correct credentials', async () => {
      // Setup
      const email = 'test@example.com';
      const password = 'StrongPassword123!';
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user_id',
        email,
        passwordHash: 'hashed_password',
        emailVerified: true,
        isActive: true,
        permissions: ['USER'],
      });
      
      // Execute
      const result = await emailAuthService.loginWithEmail(email, password);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.tokens).toBeDefined();
      expect(result.user).toBeDefined();
      expect(passwordUtils.verifyPassword).toHaveBeenCalledWith(password, 'hashed_password');
      expect(jwtService.generateTokenPair).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_id' },
        data: { lastLoginAt: expect.any(Date) }
      });
      expect(auditLogService.log).toHaveBeenCalled();
    });
    
    it('should reject if user does not exist', async () => {
      // Setup
      const email = 'nonexistent@example.com';
      const password = 'StrongPassword123!';
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      
      // Execute
      const result = await emailAuthService.loginWithEmail(email, password);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.tokens).toBeUndefined();
      expect(passwordUtils.verifyPassword).not.toHaveBeenCalled();
      expect(jwtService.generateTokenPair).not.toHaveBeenCalled();
    });
    
    it('should reject if email is not verified', async () => {
      // Setup
      const email = 'unverified@example.com';
      const password = 'StrongPassword123!';
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user_id',
        email,
        passwordHash: 'hashed_password',
        emailVerified: false,
        isActive: true,
        permissions: ['USER'],
      });
      
      // Execute
      const result = await emailAuthService.loginWithEmail(email, password);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Email not verified');
      expect(passwordUtils.verifyPassword).not.toHaveBeenCalled();
      expect(jwtService.generateTokenPair).not.toHaveBeenCalled();
    });
    
    it('should reject if password is incorrect', async () => {
      // Setup
      const email = 'test@example.com';
      const password = 'WrongPassword123!';
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user_id',
        email,
        passwordHash: 'hashed_password',
        emailVerified: true,
        isActive: true,
        permissions: ['USER'],
      });
      
      (passwordUtils.verifyPassword as jest.Mock).mockResolvedValue(false);
      
      // Execute
      const result = await emailAuthService.loginWithEmail(email, password);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid email or password');
      expect(passwordUtils.verifyPassword).toHaveBeenCalled();
      expect(jwtService.generateTokenPair).not.toHaveBeenCalled();
    });
  });
  
  describe('requestPasswordReset', () => {
    it('should generate and send reset token for existing user', async () => {
      // Setup
      const email = 'test@example.com';
      const baseUrl = 'http://localhost:3000';
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user_id',
        email,
        isActive: true
      });
      
      // Execute
      const result = await emailAuthService.requestPasswordReset(email, baseUrl);
      
      // Assert
      expect(result.success).toBe(true);
      expect(passwordUtils.generatePasswordResetToken).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_id' },
        data: {
          emailVerifyToken: 'hashed_token',
          tokenExpiry: expect.any(Date)
        }
      });
      expect(auditLogService.log).toHaveBeenCalled();
    });
    
    it('should not reveal if email does not exist', async () => {
      // Setup
      const email = 'nonexistent@example.com';
      const baseUrl = 'http://localhost:3000';
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      
      // Execute
      const result = await emailAuthService.requestPasswordReset(email, baseUrl);
      
      // Assert
      expect(result.success).toBe(true); // Still returns success for security
      expect(passwordUtils.generatePasswordResetToken).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
  
  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      // Setup
      const token = 'valid_token';
      const newPassword = 'NewStrongPassword123!';
      
      (passwordUtils.hashToken as jest.Mock).mockReturnValue('hashed_token');
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user_id',
        email: 'test@example.com'
      });
      
      // Execute
      const result = await emailAuthService.resetPassword(token, newPassword);
      
      // Assert
      expect(result.success).toBe(true);
      expect(passwordUtils.validatePassword).toHaveBeenCalledWith(newPassword);
      expect(passwordUtils.hashPassword).toHaveBeenCalledWith(newPassword);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_id' },
        data: {
          passwordHash: 'hashed_password',
          emailVerifyToken: null,
          tokenExpiry: null
        }
      });
      expect(auditLogService.log).toHaveBeenCalled();
    });
    
    it('should reject with invalid token', async () => {
      // Setup
      const token = 'invalid_token';
      const newPassword = 'NewStrongPassword123!';
      
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      
      // Execute
      const result = await emailAuthService.resetPassword(token, newPassword);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid or expired');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
    
    it('should reject with weak password', async () => {
      // Setup
      const token = 'valid_token';
      const newPassword = 'weak';
      
      (passwordUtils.validatePassword as jest.Mock).mockReturnValue({ 
        valid: false, 
        message: 'Password is too weak' 
      });
      
      // Execute
      const result = await emailAuthService.resetPassword(token, newPassword);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Password is too weak');
      expect(passwordUtils.hashPassword).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
  
  describe('changePassword', () => {
    it('should change password with correct current password', async () => {
      // Setup
      const userId = 'user_id';
      const currentPassword = 'CurrentPassword123!';
      const newPassword = 'NewPassword123!';
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        passwordHash: 'current_password_hash'
      });
      
      // Execute
      const result = await emailAuthService.changePassword(userId, currentPassword, newPassword);
      
      // Assert
      expect(result.success).toBe(true);
      expect(passwordUtils.verifyPassword).toHaveBeenCalledWith(currentPassword, 'current_password_hash');
      expect(passwordUtils.validatePassword).toHaveBeenCalledWith(newPassword);
      expect(passwordUtils.hashPassword).toHaveBeenCalledWith(newPassword);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { passwordHash: 'hashed_password' }
      });
      expect(auditLogService.log).toHaveBeenCalled();
    });
    
    it('should reject with incorrect current password', async () => {
      // Setup
      const userId = 'user_id';
      const currentPassword = 'WrongPassword123!';
      const newPassword = 'NewPassword123!';
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        passwordHash: 'current_password_hash'
      });
      
      (passwordUtils.verifyPassword as jest.Mock).mockResolvedValue(false);
      
      // Execute
      const result = await emailAuthService.changePassword(userId, currentPassword, newPassword);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Current password is incorrect');
      expect(passwordUtils.hashPassword).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
    
    it('should reject with weak new password', async () => {
      // Setup
      const userId = 'user_id';
      const currentPassword = 'CurrentPassword123!';
      const newPassword = 'weak';
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        passwordHash: 'current_password_hash'
      });
      
      (passwordUtils.validatePassword as jest.Mock).mockReturnValue({ 
        valid: false, 
        message: 'Password is too weak' 
      });
      
      // Execute
      const result = await emailAuthService.changePassword(userId, currentPassword, newPassword);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Password is too weak');
      expect(passwordUtils.hashPassword).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});