/**
 * Admin Dashboard Module Index
 * 
 * This file exports all the admin dashboard components to provide
 * a unified API for the admin interface.
 */

// Import admin system components
import { rbacSystem } from './RoleBasedAccessControl';
import { userManagementSystem } from './UserManagement';
import { proofManagementSystem } from './ProofManagement';
import { systemConfigurationManager } from './SystemConfiguration';
import { AuditLoggingSystem } from './AuditLogger';

// Export Role-Based Access Control components
export * from './RoleBasedAccessControl';
export { default as rbacSystem } from './RoleBasedAccessControl';

// Export User Management components
export * from './UserManagement';
export { default as userManagementSystem } from './UserManagement';

// Export Proof Management components
export * from './ProofManagement';
export { default as proofManagementSystem } from './ProofManagement';

// Export System Configuration components
export * from './SystemConfiguration';
export { default as systemConfigurationManager } from './SystemConfiguration';

// Export Audit Logging components
export * from './AuditLogger';
export { default as auditLoggingSystem } from './AuditLogger';

// Export admin dashboard interface
export interface AdminDashboardInterface {
  rbac: typeof rbacSystem;
  userManagement: typeof userManagementSystem;
  proofManagement: typeof proofManagementSystem;
  systemConfig: typeof systemConfigurationManager;
  auditLogs: typeof AuditLoggingSystem;
}

// Create a unified admin dashboard interface
const adminDashboard: AdminDashboardInterface = {
  rbac: rbacSystem,
  userManagement: userManagementSystem,
  proofManagement: proofManagementSystem,
  systemConfig: systemConfigurationManager,
  auditLogs: AuditLoggingSystem
};

// Instance of the audit logging system
const auditLoggingSystem = new AuditLoggingSystem();

export default adminDashboard;