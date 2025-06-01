/**
 * Audit Log Service
 * 
 * This service handles creation and storage of audit logs
 * for security-relevant events across the platform.
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@proof-of-funds/db';
import logger from '../utils/logger';
import { AuditLogEntry } from '../models/auditLog';

/**
 * Create and store an audit log entry
 * 
 * @param entry - Audit log entry data
 * @returns ID of the created audit log
 */
export async function log(entry: AuditLogEntry): Promise<string> {
  try {
    // Generate ID for the log entry
    const id = uuidv4();
    
    // Create audit log in database
    await prisma.auditLog.create({
      data: {
        id,
        action: entry.action,
        entityType: entry.resourceType || entry.actorType,
        entityId: entry.resourceId || entry.actorId,
        userId: entry.actorId,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        metadata: {
          eventType: entry.eventType,
          status: entry.status,
          severity: entry.severity,
          details: entry.details || {}
        },
        timestamp: new Date()
      }
    });
    
    // Log to application logs as well
    logger.info('Audit log created', {
      id,
      eventType: entry.eventType,
      actorType: entry.actorType,
      action: entry.action,
      status: entry.status
    });
    
    return id;
  } catch (error) {
    // Log error but don't throw - audit logging should never break functionality
    logger.error('Failed to create audit log entry', {
      error: error instanceof Error ? error.message : String(error),
      entry
    });
    
    // Return a placeholder ID
    return 'error-creating-log';
  }
}

/**
 * Get context information from Express request
 * 
 * @param req - Express request object
 * @returns Context information for audit log
 */
export function getContextFromRequest(req: any): {
  ipAddress?: string;
  userAgent?: string;
} {
  return {
    ipAddress: req.ip,
    userAgent: req.headers?.['user-agent']
  };
}

/**
 * Query audit logs with filtering options
 * 
 * @param options - Query options
 * @returns Array of audit log entries
 */
export async function queryAuditLogs(options: {
  userId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  try {
    const {
      userId,
      entityType,
      entityId,
      action,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = options;
    
    // Build filter conditions
    const where: any = {};
    
    if (userId) {
      where.userId = userId;
    }
    
    if (entityType) {
      where.entityType = entityType;
    }
    
    if (entityId) {
      where.entityId = entityId;
    }
    
    if (action) {
      where.action = action;
    }
    
    // Date range filter
    if (startDate || endDate) {
      where.timestamp = {};
      
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }
    
    // Execute query
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: {
        timestamp: 'desc'
      },
      take: limit,
      skip: offset
    });
    
    return logs;
  } catch (error) {
    logger.error('Failed to query audit logs', {
      error: error instanceof Error ? error.message : String(error),
      options
    });
    
    return [];
  }
}

// Export the audit log service methods
export const auditLogService = {
  log,
  getContextFromRequest,
  queryAuditLogs
};

export default auditLogService;