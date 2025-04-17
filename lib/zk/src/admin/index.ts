/**
 * Admin Module Index
 * 
 * This file exports all administrative functionality from the admin module,
 * providing a unified API for administrative operations on the ZK proof system.
 */

// Export admin components
import { SystemConfigurationManager } from './SystemConfiguration';
import { UserManagementSystem } from './UserManagement';
import { ProofManagement } from './ProofManagement';
import { AuditLogger, getAuditLogger } from './AuditLogger';

// Re-export all admin components
export {
  SystemConfigurationManager,
  UserManagementSystem,
  ProofManagement,
  AuditLogger,
  getAuditLogger
};

// Export default object with all admin components
export default {
  SystemConfigurationManager,
  UserManagementSystem,
  ProofManagement,
  AuditLogger,
  getAuditLogger
};