/**
 * Audit Log Models and Types
 * 
 * This file defines the types and enums for the audit logging system.
 */

/**
 * Audit log entry interface
 */
export interface AuditLog {
  id: string;                    // UUID for the log entry
  timestamp: Date;               // Timestamp of the event
  eventType: AuditEventType;     // Type of event
  actorId?: string;              // User or system entity that initiated the action
  actorType: ActorType;          // Type of actor (USER, SYSTEM, ANONYMOUS)
  resourceType?: string;         // Type of resource affected (e.g., 'proof', 'user', 'verification')
  resourceId?: string;           // ID of the affected resource
  action: AuditAction;           // Action performed (CREATE, READ, UPDATE, DELETE, etc.)
  status: AuditStatus;           // Outcome status (SUCCESS, FAILURE)
  details: Record<string, any>;  // Event-specific details (sanitized)
  ipAddress?: string;            // IP address of the actor
  userAgent?: string;            // User agent of the actor
  metadata: Record<string, any>; // Additional metadata
  severity: AuditSeverity;       // Severity level (INFO, WARNING, ERROR, CRITICAL)
}

/**
 * Audit event types categorized by domain
 */
export enum AuditEventType {
  // Authentication events
  AUTH_LOGIN = 'auth.login',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_TOKEN_REFRESH = 'auth.token_refresh',
  AUTH_PASSWORD_RESET = 'auth.password_reset',
  
  // User management events
  USER_CREATE = 'user.create',
  USER_UPDATE = 'user.update',
  USER_DELETE = 'user.delete',
  
  // Wallet events
  WALLET_CONNECT = 'wallet.connect',
  WALLET_DISCONNECT = 'wallet.disconnect',
  
  // Proof events
  PROOF_GENERATE = 'proof.generate',
  PROOF_VERIFY = 'proof.verify',
  PROOF_REVOKE = 'proof.revoke',
  
  // Template events
  TEMPLATE_CREATE = 'template.create',
  TEMPLATE_UPDATE = 'template.update',
  TEMPLATE_DELETE = 'template.delete',
  
  // Organization events
  ORG_CREATE = 'org.create',
  ORG_UPDATE = 'org.update',
  ORG_DELETE = 'org.delete',
  ORG_MEMBER_ADD = 'org.member.add',
  ORG_MEMBER_REMOVE = 'org.member.remove',
  ORG_MEMBER_UPDATE = 'org.member.update',
  
  // System events
  SYSTEM_ERROR = 'system.error',
  SYSTEM_CONFIG_CHANGE = 'system.config_change',
  
  // Admin events
  ADMIN_ACTION = 'admin.action',
  
  // Data export events
  DATA_EXPORT = 'data.export',
  
  // Audit log events
  AUDIT_LOG_ACCESS = 'audit.log_access',
  
  // ZK-specific events
  ZK_CIRCUIT_USE = 'zk.circuit_use',
  ZK_PARAMETER_LOAD = 'zk.parameter_load'
}

/**
 * Types of actors that can perform actions
 */
export enum ActorType {
  USER = 'user',               // Authenticated user
  SYSTEM = 'system',           // System process or background job
  ANONYMOUS = 'anonymous',     // Unauthenticated user
  ORGANIZATION = 'organization' // Organization entity
}

/**
 * Types of actions that can be performed
 */
export enum AuditAction {
  CREATE = 'create',   // Create a resource
  READ = 'read',       // Read/view a resource
  UPDATE = 'update',   // Update a resource
  DELETE = 'delete',   // Delete a resource
  EXECUTE = 'execute', // Execute an operation
  VALIDATE = 'validate', // Validate a resource or operation
  LOGIN = 'login',     // User login
  LOGOUT = 'logout',   // User logout
  APPROVE = 'approve', // Approve an action
  REJECT = 'reject',   // Reject an action
  EXPORT = 'export',   // Export data
  GENERATE = 'generate', // Generate data or resource
  VERIFY = 'verify',   // Verify a resource
  REVOKE = 'revoke',   // Revoke a resource
  UPLOAD = 'upload',   // Upload a resource
  DOWNLOAD = 'download' // Download a resource
}

/**
 * Status of the audit event
 */
export enum AuditStatus {
  SUCCESS = 'success', // Action completed successfully
  FAILURE = 'failure', // Action failed
  PENDING = 'pending'  // Action is pending
}

/**
 * Severity level of the audit event
 */
export enum AuditSeverity {
  INFO = 'info',         // Informational
  WARNING = 'warning',   // Warning
  ERROR = 'error',       // Error
  CRITICAL = 'critical'  // Critical
}

/**
 * Parameters for creating an audit log
 */
export interface AuditLogParams {
  eventType: AuditEventType;
  actorId?: string;
  actorType: ActorType;
  resourceType?: string;
  resourceId?: string;
  action: AuditAction;
  status: AuditStatus;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  severity?: AuditSeverity;
}

/**
 * Parameters for querying audit logs
 */
export interface AuditLogQueryParams {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  actorId?: string;
  actorType?: ActorType;
  resourceType?: string;
  resourceId?: string;
  action?: AuditAction;
  status?: AuditStatus;
  severity?: AuditSeverity;
  limit?: number;
  offset?: number;
}

/**
 * Result of an audit log query
 */
export interface AuditLogQueryResult {
  logs: AuditLog[];
  total: number;
}

/**
 * Parameters for exporting audit logs
 */
export interface AuditLogExportParams {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  actorId?: string;
  format?: 'json' | 'csv';
}

/**
 * Result of an audit log export
 */
export interface AuditLogExportResult {
  filename: string;
  url: string;
  expiresAt?: Date;
}