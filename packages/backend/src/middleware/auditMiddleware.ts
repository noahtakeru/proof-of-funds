/**
 * Audit Logging Middleware
 * 
 * Provides middleware for automatic audit logging of API requests
 */
import { Request, Response, NextFunction } from 'express';
import { 
  AuditEventType, 
  ActorType, 
  AuditAction, 
  AuditStatus,
  AuditSeverity
} from '../models/auditLog';
import { auditLogService } from '../services/auditLogService';
import logger from '../utils/logger';

/**
 * Interface for user object with ID
 */
interface UserWithId {
  id: string;
  [key: string]: any;
}

/**
 * Extract user ID from request
 */
const getUserId = (req: Request): string | undefined => {
  if (!req.user) return undefined;
  
  // Cast to UserWithId to access id property
  const user = req.user as UserWithId;
  return user.id;
};

/**
 * Create middleware for automatic audit logging
 */
export const createAuditMiddleware = (params: {
  eventType: AuditEventType;
  action: AuditAction;
  getResourceType?: (req: Request) => string | undefined;
  getResourceId?: (req: Request) => string | undefined;
  getDetails?: (req: Request, res: Response) => Record<string, any>;
  severity?: AuditSeverity;
}) => {
  const { 
    eventType, 
    action, 
    getResourceType, 
    getResourceId, 
    getDetails,
    severity = AuditSeverity.INFO 
  } = params;
  
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original end method
    const originalEnd = res.end;
    
    // Override end method to capture response
    res.end = function (chunk?: any, encoding?: any, callback?: any) {
      // Restore original end method
      res.end = originalEnd;
      
      // Get actor information
      const actorId = getUserId(req);
      const actorType = actorId ? ActorType.USER : ActorType.ANONYMOUS;
      
      // Get resource information if provided
      const resourceType = getResourceType ? getResourceType(req) : undefined;
      const resourceId = getResourceId ? getResourceId(req) : undefined;
      
      // Determine audit status based on response status code
      const status = res.statusCode >= 400 ? AuditStatus.FAILURE : AuditStatus.SUCCESS;
      
      // Get additional details if provided
      const customDetails = getDetails ? getDetails(req, res) : {};
      
      // Default details from request
      const details = {
        method: req.method,
        path: req.path,
        query: req.query,
        statusCode: res.statusCode,
        ...customDetails
      };
      
      // Create audit log entry
      auditLogService.log({
        eventType,
        actorId,
        actorType,
        resourceType,
        resourceId,
        action,
        status,
        details,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        severity: status === AuditStatus.FAILURE ? 
          (severity === AuditSeverity.INFO ? AuditSeverity.WARNING : severity) : 
          severity
      }).catch(err => {
        // Log error but don't affect response
        logger.error('Audit middleware error:', { error: err });
      });
      
      // Call original end method
      return originalEnd.call(this, chunk, encoding, callback);
    };
    
    // Continue with request
    next();
  };
};

/**
 * Authentication audit middleware
 */
export const authAuditMiddleware = {
  login: createAuditMiddleware({
    eventType: AuditEventType.AUTH_LOGIN,
    action: AuditAction.LOGIN,
    getDetails: (req) => ({
      email: req.body.email
    })
  }),
  
  logout: createAuditMiddleware({
    eventType: AuditEventType.AUTH_LOGOUT,
    action: AuditAction.LOGOUT
  }),
  
  tokenRefresh: createAuditMiddleware({
    eventType: AuditEventType.AUTH_TOKEN_REFRESH,
    action: AuditAction.EXECUTE
  })
};

/**
 * Resource audit middleware factory
 */
export const createResourceAuditMiddleware = (resourceType: string) => {
  return {
    create: createAuditMiddleware({
      eventType: `${resourceType}.create` as AuditEventType,
      action: AuditAction.CREATE,
      getResourceType: () => resourceType,
      getResourceId: (req) => req.params.id || req.body.id
    }),
    
    read: createAuditMiddleware({
      eventType: `${resourceType}.read` as AuditEventType,
      action: AuditAction.READ,
      getResourceType: () => resourceType,
      getResourceId: (req) => req.params.id
    }),
    
    update: createAuditMiddleware({
      eventType: `${resourceType}.update` as AuditEventType,
      action: AuditAction.UPDATE,
      getResourceType: () => resourceType,
      getResourceId: (req) => req.params.id
    }),
    
    delete: createAuditMiddleware({
      eventType: `${resourceType}.delete` as AuditEventType,
      action: AuditAction.DELETE,
      getResourceType: () => resourceType,
      getResourceId: (req) => req.params.id
    }),
    
    list: createAuditMiddleware({
      eventType: `${resourceType}.list` as AuditEventType,
      action: AuditAction.READ,
      getResourceType: () => resourceType
    })
  };
};

// Create common resource middleware
export const proofAuditMiddleware = createResourceAuditMiddleware('proof');
export const verifyAuditMiddleware = createResourceAuditMiddleware('verify');
export const templateAuditMiddleware = createResourceAuditMiddleware('template');
export const userAuditMiddleware = createResourceAuditMiddleware('user');
export const orgAuditMiddleware = createResourceAuditMiddleware('org');
export const walletAuditMiddleware = createResourceAuditMiddleware('wallet');