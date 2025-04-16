/**
 * Admin Dashboard Module Index
 * 
 * This file exports all the admin dashboard components to provide
 * a unified API for the admin interface.
 */

// Import admin system components
import rbacSystemInstance from './RoleBasedAccessControl';
import userManagementSystemInstance from './UserManagement';
import proofManagementSystemInstance from './ProofManagement'; 
import systemConfigurationManagerInstance from './SystemConfiguration';
import { AuditLoggingSystem } from './AuditLogger';

// Re-export all type definitions
import { RBACSystem, Role, Permission } from './RoleBasedAccessControl';
import { UserManagementSystem } from './UserManagement';

// Re-export class and enum definitions
export { RBACSystem, Role, Permission, UserManagementSystem, AuditLoggingSystem };

// Export types from RBAC
export type { 
  UserRole, 
  ActionLogEntry, 
  PrivilegedActionRequest
} from './RoleBasedAccessControl';

// Export types from UserManagement
export type { 
  User,
  UserSearchFilters,
  CreateUserParams,
  UpdateUserStatusParams
} from './UserManagement';

// Export singleton instances with consistent naming
export const rbacSystem = rbacSystemInstance;
export const userManagementSystem = userManagementSystemInstance;
export const proofManagementSystem = proofManagementSystemInstance;
export const systemConfigurationManager = systemConfigurationManagerInstance;

// Create an audit logging system instance
const auditLoggingSystem = new AuditLoggingSystem();
export { auditLoggingSystem };

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

export default adminDashboard;