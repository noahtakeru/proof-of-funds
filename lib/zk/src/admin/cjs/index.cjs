/**
 * Admin Dashboard Module Index - CommonJS Version
 * 
 * This file exports all the admin dashboard components to provide
 * a unified API for the admin interface.
 */

// Require the CommonJS versions of the admin components
const { rbacSystem, Permission, Role } = require('./RoleBasedAccessControl.cjs');
const { userManagementSystem } = require('./UserManagement.cjs');
const { proofManagementSystem } = require('./ProofManagement.cjs');
const { systemConfigurationManager } = require('./SystemConfiguration.cjs');
const { auditLoggingSystem } = require('./AuditLogger.cjs');

// Create a unified admin dashboard interface
const adminDashboard = {
  rbac: rbacSystem,
  userManagement: userManagementSystem,
  proofManagement: proofManagementSystem,
  systemConfig: systemConfigurationManager,
  auditLogs: auditLoggingSystem
};

// Export everything
module.exports = {
  // Access control exports
  rbacSystem,
  Permission,
  Role,
  
  // Component exports
  userManagementSystem,
  proofManagementSystem,
  systemConfigurationManager,
  auditLoggingSystem,
  
  // Default export
  adminDashboard
};