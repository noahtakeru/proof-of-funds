/**
 * Audit Log Models
 * 
 * Type definitions for audit logging system
 */

// Audit event types
export enum AuditEventType {
  // Authentication events
  AUTH_LOGIN = 'auth.login',
  AUTH_LOGOUT = 'auth.logout',
  USER_REGISTRATION = 'user.registration',
  
  // Password management events
  PASSWORD_RESET = 'password.reset',
  PASSWORD_CHANGE = 'password.change',
  
  // User profile events
  USER_UPDATE = 'user.update',
  USER_DELETE = 'user.delete',
  
  // Organization events
  ORG_CREATE = 'organization.create',
  ORG_UPDATE = 'organization.update',
  ORG_DELETE = 'organization.delete',
  ORG_MEMBER_ADD = 'organization.member.add',
  ORG_MEMBER_REMOVE = 'organization.member.remove',
  ORG_MEMBER_UPDATE = 'organization.member.update',
  
  // Proof events
  PROOF_CREATE = 'proof.create',
  PROOF_VERIFY = 'proof.verify',
  PROOF_REVOKE = 'proof.revoke',
  
  // Template events
  TEMPLATE_CREATE = 'template.create',
  TEMPLATE_UPDATE = 'template.update',
  TEMPLATE_DELETE = 'template.delete',
  
  // Admin events
  ADMIN_ACTION = 'admin.action',
  SYSTEM_EVENT = 'system.event',
  
  // API events
  API_KEY_CREATE = 'api.key.create',
  API_KEY_REVOKE = 'api.key.revoke',
  API_REQUEST = 'api.request'
}

// Actor types
export enum ActorType {
  USER = 'user',
  ORGANIZATION = 'organization',
  ADMIN = 'admin',
  SYSTEM = 'system',
  API_KEY = 'api_key',
  ANONYMOUS = 'anonymous'
}

// Action types
export enum AuditAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  EXECUTE = 'execute',
  VERIFY = 'verify',
  REVOKE = 'revoke',
  REQUEST = 'request'
}

// Status types
export enum AuditStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  WARNING = 'warning',
  INFO = 'info'
}

// Severity levels
export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// Resource types
export enum ResourceType {
  USER = 'user',
  ORGANIZATION = 'organization',
  PROOF = 'proof',
  TEMPLATE = 'template',
  WALLET = 'wallet',
  API_KEY = 'api_key',
  SYSTEM = 'system'
}

// Audit log entry
export interface AuditLogEntry {
  eventType: AuditEventType;
  actorType: ActorType;
  actorId?: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  status: AuditStatus;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  severity: AuditSeverity;
}

// Export all audit log types
export default {
  AuditEventType,
  ActorType,
  AuditAction,
  AuditStatus,
  AuditSeverity,
  ResourceType
};