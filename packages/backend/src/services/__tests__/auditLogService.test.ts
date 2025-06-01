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

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  const mockCreate = jest.fn();
  const mockFindMany = jest.fn();
  
  return {
    PrismaClient: jest.fn().mockImplementation(() => {
      return {
        auditLog: {
          create: mockCreate,
          findMany: mockFindMany
        }
      };
    }),
    mockCreate,
    mockFindMany
  };
});

// Access mocks
const { mockCreate, mockFindMany } = require('@prisma/client');

// Mock logger to prevent console output during tests
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

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
      // Check that create was called with data containing the expected fields
      // without being strict about exact format
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          action: AuditAction.CREATE,
          entityType: 'proof',
          entityId: 'proof-123',
          userId: 'user-123',
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent'
        })
      }));
      
      // Our implementation returns the ID, not the full object
      expect(typeof result).toBe('string');
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
      // Our implementation returns an error placeholder ID, not a modified entry
      expect(result).toBe('error-creating-log');
    });
  });
  
  describe('getContextFromRequest', () => {
    it('should extract context from request object', () => {
      // Arrange
      const mockRequest = {
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Mozilla/5.0 Test Browser'
        }
      };
      
      // Act
      const result = auditLogService.getContextFromRequest(mockRequest);
      
      // Assert
      expect(result).toEqual({
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });
    });
    
    it('should handle missing request data', () => {
      // Arrange
      const mockRequest = {};
      
      // Act
      const result = auditLogService.getContextFromRequest(mockRequest);
      
      // Assert
      expect(result).toEqual({
        ipAddress: undefined,
        userAgent: undefined
      });
    });
  });
  
  describe('queryAuditLogs', () => {
    it('should query logs with filters and pagination', async () => {
      // Arrange
      const queryParams = {
        userId: 'user-123',
        entityType: 'proof',
        entityId: 'proof-123',
        action: AuditAction.CREATE,
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        limit: 10,
        offset: 0
      };
      
      // Act
      const result = await auditLogService.queryAuditLogs(queryParams);
      
      // Assert
      expect(mockFindMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-123',
          entityType: 'proof',
          entityId: 'proof-123',
          action: AuditAction.CREATE,
          timestamp: { 
            gte: queryParams.startDate, 
            lte: queryParams.endDate 
          }
        }),
        orderBy: { timestamp: 'desc' },
        skip: 0,
        take: 10
      });
      
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'log-1'
        })
      ]));
    });
    
    it('should handle empty filters', async () => {
      // Arrange
      const queryParams = {
        limit: 50,
        offset: 0
      };
      
      // Act
      const result = await auditLogService.queryAuditLogs(queryParams);
      
      // Assert
      expect(mockFindMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { timestamp: 'desc' },
        skip: 0,
        take: 50
      });
      
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'log-1'
        })
      ]));
    });
    
    it('should handle database errors gracefully', async () => {
      // Arrange
      mockFindMany.mockRejectedValueOnce(new Error('Database error'));
      
      // Act
      const result = await auditLogService.queryAuditLogs({});
      
      // Assert
      expect(result).toEqual([]);
    });
  });
});