/**
 * Audit Log Controller
 * 
 * Provides API endpoints for querying and exporting audit logs
 */
import { Request, Response } from 'express';
import { 
  auditLogService, 
  log as auditLog 
} from '../../services/auditLogService';
import { 
  AuditEventType, 
  ActorType, 
  AuditAction, 
  AuditStatus, 
  AuditSeverity 
} from '../../models/auditLog';
import { ApiError } from '../../middleware/errorHandler';
import logger from '../../utils/logger';

/**
 * Get audit logs with filtering
 */
export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const {
      startDate,
      endDate,
      eventType,
      actorId,
      actorType,
      resourceType,
      resourceId,
      action,
      status,
      severity,
      limit = '50',
      offset = '0'
    } = req.query;

    // Parse dates and build query parameters
    const queryParams: any = {
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10)
    };

    if (startDate) {
      queryParams.startDate = new Date(startDate as string);
    }

    if (endDate) {
      queryParams.endDate = new Date(endDate as string);
    }

    if (eventType) {
      const eventTypes = (eventType as string).split(',');
      queryParams.eventTypes = eventTypes.map(et => et.trim()) as AuditEventType[];
    }

    if (actorId) {
      queryParams.actorId = actorId as string;
    }

    if (actorType) {
      queryParams.actorType = actorType as ActorType;
    }

    if (resourceType) {
      queryParams.resourceType = resourceType as string;
    }

    if (resourceId) {
      queryParams.resourceId = resourceId as string;
    }

    if (action) {
      queryParams.action = action as AuditAction;
    }

    if (status) {
      queryParams.status = status as AuditStatus;
    }

    if (severity) {
      queryParams.severity = severity as AuditSeverity;
    }

    // Get audit logs
    const result = await auditLogService.query(queryParams);

    // Log this query
    await auditLog({
      eventType: AuditEventType.AUDIT_LOG_ACCESS,
      actorId: req.user?.id,
      actorType: req.user ? ActorType.USER : ActorType.ANONYMOUS,
      action: AuditAction.READ,
      status: AuditStatus.SUCCESS,
      details: {
        queryParams,
        resultCount: result.logs.length,
        totalCount: result.total
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      severity: AuditSeverity.INFO
    });

    // Return results
    return res.status(200).json({
      logs: result.logs,
      pagination: {
        total: result.total,
        limit: queryParams.limit,
        offset: queryParams.offset
      }
    });
  } catch (error) {
    logger.error('Error getting audit logs:', { error });
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(500, 'Failed to retrieve audit logs', 'AUDIT_LOG_QUERY_ERROR');
  }
};

/**
 * Get a single audit log by ID
 */
export const getAuditLogById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get audit log
    const log = await auditLogService.getById(id);

    if (!log) {
      throw new ApiError(404, 'Audit log not found', 'AUDIT_LOG_NOT_FOUND');
    }

    // Log this retrieval
    await auditLog({
      eventType: AuditEventType.AUDIT_LOG_ACCESS,
      actorId: req.user?.id,
      actorType: req.user ? ActorType.USER : ActorType.ANONYMOUS,
      action: AuditAction.READ,
      status: AuditStatus.SUCCESS,
      details: {
        auditLogId: id
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      severity: AuditSeverity.INFO
    });

    // Return result
    return res.status(200).json(log);
  } catch (error) {
    logger.error('Error getting audit log by ID:', { error });
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(500, 'Failed to retrieve audit log', 'AUDIT_LOG_RETRIEVAL_ERROR');
  }
};

/**
 * Export audit logs
 */
export const exportAuditLogs = async (req: Request, res: Response) => {
  try {
    const {
      startDate,
      endDate,
      eventType,
      actorId,
      format = 'json'
    } = req.body;

    // Validate export format
    if (format !== 'json' && format !== 'csv') {
      throw new ApiError(400, 'Invalid export format. Supported formats: json, csv', 'INVALID_FORMAT');
    }

    // Parse dates and build export parameters
    const exportParams: any = {
      format: format as 'json' | 'csv'
    };

    if (startDate) {
      exportParams.startDate = new Date(startDate);
    }

    if (endDate) {
      exportParams.endDate = new Date(endDate);
    }

    if (eventType) {
      const eventTypes = (eventType as string).split(',');
      exportParams.eventTypes = eventTypes.map(et => et.trim()) as AuditEventType[];
    }

    if (actorId) {
      exportParams.actorId = actorId;
    }

    // Export audit logs
    const result = await auditLogService.exportLogs(exportParams);

    // Log this export
    await auditLog({
      eventType: AuditEventType.DATA_EXPORT,
      actorId: req.user?.id,
      actorType: req.user ? ActorType.USER : ActorType.ANONYMOUS,
      action: AuditAction.EXPORT,
      status: AuditStatus.SUCCESS,
      details: {
        exportParams,
        filename: result.filename,
        format
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      severity: AuditSeverity.INFO
    });

    // Return export info
    return res.status(200).json({
      filename: result.filename,
      url: result.url,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    logger.error('Error exporting audit logs:', { error });
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(500, 'Failed to export audit logs', 'AUDIT_LOG_EXPORT_ERROR');
  }
};