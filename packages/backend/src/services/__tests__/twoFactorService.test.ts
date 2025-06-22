/**
 * Two-Factor Authentication Service Tests
 * 
 * Tests the functionality of the Two-Factor Authentication service
 */

import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import * as twoFactorService from '../twoFactorService';
import { prisma } from '@proof-of-funds/db';
import { authenticator } from 'otplib';
import { auditLogService } from '../auditLogService';

// Mock external dependencies
jest.mock('@proof-of-funds/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn()
    }
  }
}));

jest.mock('otplib', () => ({
  authenticator: {
    generateSecret: jest.fn(),
    keyuri: jest.fn(),
    verify: jest.fn()
  }
}));

jest.mock('../auditLogService', () => ({
  auditLogService: {
    log: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mockQrCode')
}));

describe('Two-Factor Authentication Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeTwoFactor', () => {
    it('should initialize 2FA for a user without existing 2FA', async () => {
      // Mock user retrieval
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        twoFactorEnabled: false,
        twoFactorConfirmed: false,
        email: 'test@example.com'
      });

      // Mock secret generation
      (authenticator.generateSecret as jest.Mock).mockReturnValueOnce('SECRETKEY123456');
      (authenticator.keyuri as jest.Mock).mockReturnValueOnce('otpauth://totp/Proof%20of%20Funds:test@example.com?secret=SECRETKEY123456&issuer=Proof%20of%20Funds');

      // Mock user update
      (prisma.user.update as jest.Mock).mockResolvedValueOnce({
        id: 'user123',
        twoFactorSecret: 'SECRETKEY123456',
        twoFactorEnabled: false,
        twoFactorConfirmed: false
      });

      const result = await twoFactorService.initializeTwoFactor('user123', 'test@example.com');

      // Verify the expected result
      expect(result.success).toBe(true);
      expect(result.secret).toBe('SECRETKEY123456');
      expect(result.qrCodeUrl).toBeDefined();
      expect(result.message).toContain('2FA initialization successful');

      // Verify user data was updated correctly
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user123' },
        data: {
          twoFactorSecret: 'SECRETKEY123456',
          twoFactorEnabled: false,
          twoFactorConfirmed: false
        }
      });

      // Verify audit log was created
      expect(auditLogService.log).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'twoFactor.setup',
        actorId: 'user123'
      }));
    });

    it('should reject initialization if 2FA is already enabled', async () => {
      // Mock user with 2FA already enabled
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        twoFactorEnabled: true,
        twoFactorConfirmed: true,
        email: 'test@example.com'
      });

      const result = await twoFactorService.initializeTwoFactor('user123', 'test@example.com');

      // Verify the result indicates failure
      expect(result.success).toBe(false);
      expect(result.message).toContain('already enabled');
      expect(result.secret).toBe('');
      expect(result.qrCodeUrl).toBe('');

      // Verify user data was not updated
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('verifyTwoFactorToken', () => {
    it('should successfully verify a valid TOTP token', async () => {
      // Mock user retrieval with 2FA secret
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        twoFactorSecret: 'SECRETKEY123456',
        twoFactorEnabled: true,
        twoFactorConfirmed: true
      });

      // Mock token verification
      (authenticator.verify as jest.Mock).mockReturnValueOnce(true);

      const result = await twoFactorService.verifyTwoFactorToken('user123', '123456');

      // Verify the expected result
      expect(result.isValid).toBe(true);
      expect(result.message).toContain('Verification successful');

      // Verify audit log was created
      expect(auditLogService.log).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'twoFactor.verification',
        actorId: 'user123',
        status: 'success'
      }));
    });

    it('should reject an invalid TOTP token', async () => {
      // Mock user retrieval with 2FA secret
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        twoFactorSecret: 'SECRETKEY123456',
        twoFactorEnabled: true,
        twoFactorConfirmed: true
      });

      // Mock token verification (failed)
      (authenticator.verify as jest.Mock).mockReturnValueOnce(false);

      const result = await twoFactorService.verifyTwoFactorToken('user123', '123456');

      // Verify the expected result
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('Invalid verification code');

      // Verify audit log was created
      expect(auditLogService.log).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'twoFactor.verification',
        actorId: 'user123',
        status: 'failure'
      }));
    });

    it('should fail verification if user has no 2FA set up', async () => {
      // Mock user retrieval without 2FA secret
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        twoFactorSecret: null,
        twoFactorEnabled: false,
        twoFactorConfirmed: false
      });

      const result = await twoFactorService.verifyTwoFactorToken('user123', '123456');

      // Verify the expected result
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('not been set up');

      // Verify token verification was not attempted
      expect(authenticator.verify).not.toHaveBeenCalled();
    });
  });

  describe('confirmTwoFactor', () => {
    it('should confirm 2FA and generate backup codes', async () => {
      // Mock backup code generation (the implementation in twoFactorService.ts)
      (prisma.user.update as jest.Mock).mockResolvedValueOnce({
        id: 'user123',
        twoFactorEnabled: true,
        twoFactorConfirmed: true,
        backupCodes: [
          'ABCDE-12345',
          'FGHIJ-67890',
          'KLMNO-13579',
          'PQRST-24680',
          'UVWXY-97531',
          'ZABCD-86420',
          'EFGHI-12357',
          'JKLMN-98765',
          'OPQRS-43210',
          'TUVWX-13579'
        ]
      });

      const result = await twoFactorService.confirmTwoFactor('user123');

      // Verify the expected result
      expect(result.success).toBe(true);
      expect(result.backupCodes).toBeDefined();
      expect(result.backupCodes?.length).toBe(10);
      expect(result.message).toContain('2FA has been enabled');

      // Verify user data was updated correctly
      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'user123' },
        data: expect.objectContaining({
          twoFactorEnabled: true,
          twoFactorConfirmed: true
        })
      }));

      // Verify audit log was created
      expect(auditLogService.log).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'twoFactor.setup',
        actorId: 'user123',
        status: 'success'
      }));
    });
  });

  describe('disableTwoFactor', () => {
    it('should disable 2FA for a user', async () => {
      // Mock user update
      (prisma.user.update as jest.Mock).mockResolvedValueOnce({
        id: 'user123',
        twoFactorEnabled: false,
        twoFactorConfirmed: false,
        twoFactorSecret: null,
        backupCodes: []
      });

      const result = await twoFactorService.disableTwoFactor('user123');

      // Verify the expected result
      expect(result.success).toBe(true);
      expect(result.message).toContain('2FA has been disabled');

      // Verify user data was updated correctly
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user123' },
        data: {
          twoFactorEnabled: false,
          twoFactorConfirmed: false,
          twoFactorSecret: null,
          backupCodes: [],
          twoFactorRecoveryCodes: []
        }
      });

      // Verify audit log was created
      expect(auditLogService.log).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'twoFactor.setup',
        actorId: 'user123',
        action: 'delete',
        status: 'success'
      }));
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate new backup codes', async () => {
      // Mock user update
      (prisma.user.update as jest.Mock).mockImplementationOnce(({ data }) => {
        return Promise.resolve({
          id: 'user123',
          backupCodes: data.backupCodes
        });
      });

      const result = await twoFactorService.generateBackupCodes('user123');

      // Verify the expected result
      expect(result.success).toBe(true);
      expect(result.codes).toBeDefined();
      expect(result.codes.length).toBe(10);
      expect(result.message).toContain('Backup codes generated successfully');

      // Verify each code has the right format (5 chars - 5 chars)
      result.codes.forEach(code => {
        expect(code).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
      });

      // Verify audit log was created
      expect(auditLogService.log).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'twoFactor.setup',
        actorId: 'user123',
        action: 'create',
        status: 'success'
      }));
    });
  });

  describe('verifyBackupCode', () => {
    it('should verify and consume a valid backup code', async () => {
      const mockBackupCodes = [
        'ABCDE-12345',
        'FGHIJ-67890',
        'KLMNO-13579'
      ];
      
      // Mock user retrieval with backup codes
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        backupCodes: mockBackupCodes
      });

      // Mock user update to remove the used code
      (prisma.user.update as jest.Mock).mockResolvedValueOnce({
        id: 'user123',
        backupCodes: mockBackupCodes.slice(1) // first code removed
      });

      const result = await twoFactorService.verifyBackupCode('user123', 'ABCDE-12345');

      // Verify the expected result
      expect(result.isValid).toBe(true);
      expect(result.message).toContain('Backup code verified successfully');

      // Verify user data was updated correctly (code removed)
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user123' },
        data: {
          backupCodes: mockBackupCodes.slice(1)
        }
      });

      // Verify audit log was created
      expect(auditLogService.log).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'twoFactor.verification',
        actorId: 'user123',
        status: 'success'
      }));
    });

    it('should reject an invalid backup code', async () => {
      const mockBackupCodes = [
        'ABCDE-12345',
        'FGHIJ-67890',
        'KLMNO-13579'
      ];
      
      // Mock user retrieval with backup codes
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        backupCodes: mockBackupCodes
      });

      const result = await twoFactorService.verifyBackupCode('user123', 'INVALID-CODE');

      // Verify the expected result
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('Invalid backup code');

      // Verify user data was not updated
      expect(prisma.user.update).not.toHaveBeenCalled();

      // Verify audit log was created
      expect(auditLogService.log).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'twoFactor.verification',
        actorId: 'user123',
        status: 'failure'
      }));
    });
  });

  describe('isTwoFactorRequired', () => {
    it('should return true if 2FA is enabled and confirmed', async () => {
      // Mock user retrieval with 2FA enabled
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        twoFactorEnabled: true,
        twoFactorConfirmed: true
      });

      const result = await twoFactorService.isTwoFactorRequired('user123');

      // Verify the expected result
      expect(result).toBe(true);
    });

    it('should return false if 2FA is not enabled', async () => {
      // Mock user retrieval with 2FA disabled
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        twoFactorEnabled: false,
        twoFactorConfirmed: false
      });

      const result = await twoFactorService.isTwoFactorRequired('user123');

      // Verify the expected result
      expect(result).toBe(false);
    });

    it('should return false if user is not found', async () => {
      // Mock user retrieval (not found)
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const result = await twoFactorService.isTwoFactorRequired('user123');

      // Verify the expected result
      expect(result).toBe(false);
    });
  });

  describe('getTwoFactorStatus', () => {
    it('should return correct status information', async () => {
      // Mock user retrieval with 2FA enabled
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        twoFactorEnabled: true,
        twoFactorConfirmed: true,
        backupCodes: ['CODE1', 'CODE2', 'CODE3']
      });

      const result = await twoFactorService.getTwoFactorStatus('user123');

      // Verify the expected result
      expect(result.isEnabled).toBe(true);
      expect(result.isConfirmed).toBe(true);
      expect(result.backupCodesCount).toBe(3);
    });

    it('should return default status for non-existent user', async () => {
      // Mock user retrieval (not found)
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const result = await twoFactorService.getTwoFactorStatus('user123');

      // Verify the expected result - should default to disabled
      expect(result.isEnabled).toBe(false);
      expect(result.isConfirmed).toBe(false);
      expect(result.backupCodesCount).toBe(0);
    });
  });
});