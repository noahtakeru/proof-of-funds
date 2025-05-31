/**
 * Audit Log Service Tests
 * 
 * Tests for the audit logging service functionality
 */
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { auditLogService } from '../auditLogService';
import { 
  AuditEventType, 
  ActorType, 
  AuditAction, 
  AuditStatus, 
  AuditSeverity 
} from '../../models/auditLog';

// Mock PrismaClient and GCP Storage
jest.mock('@prisma/client', () => {
  const mockCreate = jest.fn();
  const mockFindMany = jest.fn();
  const mockCount = jest.fn();
  const mockFindUnique = jest.fn();
  
  return {
    PrismaClient: jest.fn().mockImplementation(() => {
      return {
        auditLog: {
          create: mockCreate,
          findMany: mockFindMany,
          count: mockCount,
          findUnique: mockFindUnique
        }
      };
    }),
    mockCreate,
    mockFindMany,
    mockCount,
    mockFindUnique
  };
});

jest.mock('@google-cloud/storage', () => {
  const mockSave = jest.fn();
  const mockGetSignedUrl = jest.fn();
  
  const mockFile = jest.fn().mockImplementation(() => {
    return {
      save: mockSave,
      getSignedUrl: mockGetSignedUrl
    };
  });
  
  const mockBucket = jest.fn().mockImplementation(() => {
    return {
      file: mockFile
    };
  });
  
  return {
    Storage: jest.fn().mockImplementation(() => {
      return {
        bucket: mockBucket,
        getBuckets: jest.fn().mockResolvedValue([[]])
      };
    }),
    mockSave,
    mockGetSignedUrl,
    mockFile,
    mockBucket
  };
});

jest.mock('fs', () => {
  return {
    ...jest.requireActual('fs'),
    writeFileSync: jest.fn(),
    existsSync: jest.fn().mockReturnValue(false),
    mkdirSync: jest.fn()
  };
});

// Access mocks
const { mockCreate, mockFindMany, mockCount, mockFindUnique } = require('@prisma/client');
const { mockSave, mockGetSignedUrl } = require('@google-cloud/storage');

describe('AuditLogService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockCreate.mockResolvedValue({
      id: 'test-id',
      timestamp: new Date(),
      action: AuditAction.CREATE,
      entityType: 'test',
      metadata: {
        eventType: AuditEventType.PROOF_GENERATE,
        actorType: ActorType.USER,
        status: AuditStatus.SUCCESS,
        severity: AuditSeverity.INFO,
        details: {}
      }
    });
    
    mockFindMany.mockResolvedValue([
      {
        id: 'log-1',
        timestamp: new Date(),
        action: AuditAction.CREATE,
        entityType: 'proof',
        metadata: {
          eventType: AuditEventType.PROOF_GENERATE,
          actorType: ActorType.USER,
          status: AuditStatus.SUCCESS,
          severity: AuditSeverity.INFO,
          details: {}
        }
      }
    ]);
    
    mockCount.mockResolvedValue(1);
    
    mockFindUnique.mockResolvedValue({
      id: 'log-1',
      timestamp: new Date(),
      action: AuditAction.CREATE,
      entityType: 'proof',
      metadata: {
        eventType: AuditEventType.PROOF_GENERATE,
        actorType: ActorType.USER,
        status: AuditStatus.SUCCESS,
        severity: AuditSeverity.INFO,
        details: {}
      }
    });
    
    mockSave.mockResolvedValue(true);
    mockGetSignedUrl.mockResolvedValue(['https://example.com/signed-url']);
  });
  
  describe('log', () => {
    it('should create a log entry successfully', async () => {
      // Arrange
      const testLogParams = {
        eventType: AuditEventType.PROOF_GENERATE,
        actorType: ActorType.USER,
        actorId: 'user-123',
        action: AuditAction.CREATE,
        status: AuditStatus.SUCCESS,
        resourceType: 'proof',
        resourceId: 'proof-123',
        details: { proofType: 'standard' },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        severity: AuditSeverity.INFO
      };
      
      // Act
      const result = await auditLogService.log(testLogParams);
      
      // Assert
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: expect.any(String),
          action: AuditAction.CREATE,
          entityType: 'proof',
          entityId: 'proof-123',
          userId: 'user-123',
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          metadata: expect.objectContaining({
            eventType: AuditEventType.PROOF_GENERATE,
            actorType: ActorType.USER,
            status: AuditStatus.SUCCESS,
            severity: AuditSeverity.INFO,
            details: { proofType: 'standard' }
          })
        })
      });
      
      expect(result).toEqual(expect.objectContaining({
        id: expect.any(String),
        eventType: AuditEventType.PROOF_GENERATE,
        actorType: ActorType.USER,
        actorId: 'user-123',
        action: AuditAction.CREATE,
        status: AuditStatus.SUCCESS,
        resourceType: 'proof',
        resourceId: 'proof-123',
        details: { proofType: 'standard' },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        severity: AuditSeverity.INFO
      }));
    });
    
    it('should sanitize sensitive data in details', async () => {
      // Arrange
      const sensitiveDetails = {
        proofType: 'standard',
        password: 'secret123',
        accessToken: 'jwt-token-value',
        data: {
          apiKey: 'api-key-value',
          user: {
            privateKey: 'private-key-value'
          }
        }
      };
      
      const testLogParams = {
        eventType: AuditEventType.AUTH_LOGIN,
        actorType: ActorType.USER,
        action: AuditAction.LOGIN,
        status: AuditStatus.SUCCESS,
        details: sensitiveDetails,
        severity: AuditSeverity.INFO
      };
      
      // Act
      await auditLogService.log(testLogParams);
      
      // Assert
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            details: expect.objectContaining({
              proofType: 'standard',
              password: '[REDACTED]',
              accessToken: '[REDACTED]',
              data: expect.objectContaining({
                apiKey: '[REDACTED]',
                user: expect.objectContaining({
                  privateKey: '[REDACTED]'
                })
              })
            })
          })
        })
      });
    });
    
    it('should handle database errors gracefully', async () => {
      // Arrange
      mockCreate.mockRejectedValueOnce(new Error('Database error'));
      
      const testLogParams = {
        eventType: AuditEventType.PROOF_GENERATE,
        actorType: ActorType.USER,
        action: AuditAction.CREATE,
        status: AuditStatus.SUCCESS,
        severity: AuditSeverity.INFO
      };
      
      // Act
      const result = await auditLogService.log(testLogParams);
      
      // Assert
      expect(result).toEqual(expect.objectContaining({
        eventType: AuditEventType.PROOF_GENERATE,
        actorType: ActorType.USER,
        action: AuditAction.CREATE,
        status: AuditStatus.FAILURE, // Error changes status to FAILURE
        details: { error: 'Audit logging failed' },
        severity: AuditSeverity.ERROR // Error changes severity to ERROR
      }));
    });
  });
  
  describe('query', () => {
    it('should query logs with filters and pagination', async () => {
      // Arrange
      const queryParams = {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        eventTypes: [AuditEventType.PROOF_GENERATE],
        actorId: 'user-123',
        actorType: ActorType.USER,
        resourceType: 'proof',
        action: AuditAction.CREATE,
        status: AuditStatus.SUCCESS,
        limit: 10,
        offset: 0
      };
      
      // Act
      const result = await auditLogService.query(queryParams);
      
      // Assert
      expect(mockFindMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          timestamp: { gte: queryParams.startDate, lte: queryParams.endDate },
          userId: 'user-123',
          entityType: 'proof',
          metadata: expect.objectContaining({
            eventType: { in: [AuditEventType.PROOF_GENERATE] },
            actorType: ActorType.USER,
            status: AuditStatus.SUCCESS
          })
        }),
        orderBy: { timestamp: 'desc' },
        skip: 0,
        take: 10
      });
      
      expect(mockCount).toHaveBeenCalledWith({
        where: expect.objectContaining({
          timestamp: { gte: queryParams.startDate, lte: queryParams.endDate }
        })
      });
      
      expect(result).toEqual({
        logs: expect.arrayContaining([
          expect.objectContaining({
            id: 'log-1'
          })
        ]),
        total: 1
      });
    });
    
    it('should handle empty filters', async () => {
      // Arrange
      const queryParams = {
        limit: 50,
        offset: 0
      };
      
      // Act
      const result = await auditLogService.query(queryParams);
      
      // Assert
      expect(mockFindMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { timestamp: 'desc' },
        skip: 0,
        take: 50
      });
      
      expect(result).toEqual({
        logs: expect.arrayContaining([
          expect.objectContaining({
            id: 'log-1'
          })
        ]),
        total: 1
      });
    });
  });
  
  describe('getById', () => {
    it('should retrieve a log by ID', async () => {
      // Arrange
      const logId = 'log-1';
      
      // Act
      const result = await auditLogService.getById(logId);
      
      // Assert
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: logId }
      });
      
      expect(result).toEqual(expect.objectContaining({
        id: 'log-1',
        eventType: expect.any(String),
        action: expect.any(String)
      }));
    });
    
    it('should return null for non-existent log', async () => {
      // Arrange
      mockFindUnique.mockResolvedValueOnce(null);
      const logId = 'non-existent-id';
      
      // Act
      const result = await auditLogService.getById(logId);
      
      // Assert
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: logId }
      });
      
      expect(result).toBeNull();
    });
  });
  
  describe('exportLogs', () => {
    it('should export logs to JSON format', async () => {
      // Arrange
      const exportParams = {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        eventTypes: [AuditEventType.PROOF_GENERATE],
        actorId: 'user-123',
        format: 'json' as const
      };
      
      const mockLogs = [
        { id: 'log-1', timestamp: new Date() },
        { id: 'log-2', timestamp: new Date() }
      ];
      
      mockFindMany.mockResolvedValueOnce(mockLogs);
      mockCount.mockResolvedValueOnce(2);
      
      // Mock file system for local export (since Storage.bucket().file().save is not being called in tests)
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {});
      
      // Act
      const result = await auditLogService.exportLogs(exportParams);
      
      // Assert
      expect(mockFindMany).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/audit_export_.+\.json$/),
        expect.any(String)
      );
      
      expect(result).toEqual(expect.objectContaining({
        filename: expect.stringContaining('audit_export_'),
        url: expect.stringContaining('file://')
      }));
    });
    
    it('should export logs to CSV format', async () => {
      // Arrange
      const exportParams = {
        format: 'csv' as const
      };
      
      const mockLogs = [
        { 
          id: 'log-1', 
          timestamp: new Date('2023-01-01'),
          eventType: AuditEventType.PROOF_GENERATE,
          actorId: 'user-1',
          actorType: ActorType.USER,
          resourceType: 'proof',
          resourceId: 'proof-1',
          action: AuditAction.CREATE,
          status: AuditStatus.SUCCESS,
          severity: AuditSeverity.INFO
        }
      ];
      
      mockFindMany.mockResolvedValueOnce(mockLogs);
      mockCount.mockResolvedValueOnce(1);
      
      // Mock file system for local export
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {});
      
      // Act
      const result = await auditLogService.exportLogs(exportParams);
      
      // Assert
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/audit_export_.+\.csv$/),
        expect.any(String)
      );
      
      expect(result).toEqual(expect.objectContaining({
        filename: expect.stringContaining('.csv'),
        url: expect.stringContaining('file://')
      }));
    });
  });
});