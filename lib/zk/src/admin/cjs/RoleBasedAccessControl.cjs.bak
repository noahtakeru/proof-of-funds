/**
 * Role-Based Access Control (RBAC) Implementation for Admin Dashboard - CommonJS Version
 * 
 * This file is the CommonJS version of the RBAC system for compatibility with Node.js
 * environments that don't support ES modules.
 */

const { zkErrorLogger } = require('../../zkErrorLogger.mjs');

// Permission constants
const Permission = {
  // User management permissions
  VIEW_USERS: 'view:users',
  CREATE_USER: 'create:user',
  EDIT_USER: 'edit:user',
  DELETE_USER: 'delete:user',
  SEARCH_USERS: 'search:users',
  
  // Proof management permissions
  VIEW_PROOFS: 'view:proofs',
  VERIFY_PROOF: 'verify:proof',
  INVALIDATE_PROOF: 'invalidate:proof',
  SEARCH_PROOFS: 'search:proofs',
  
  // System administration permissions
  VIEW_SYSTEM_METRICS: 'view:system_metrics',
  MODIFY_SYSTEM_CONFIG: 'modify:system_config',
  VIEW_LOGS: 'view:logs',
  
  // Contract management permissions
  VIEW_CONTRACTS: 'view:contracts',
  DEPLOY_CONTRACT: 'deploy:contract',
  UPGRADE_CONTRACT: 'upgrade:contract',
  
  // Wallet management permissions
  VIEW_WALLETS: 'view:wallets',
  CREATE_WALLET: 'create:wallet',
  REMOVE_WALLET: 'remove:wallet',
  
  // Analytics permissions
  VIEW_ANALYTICS: 'view:analytics',
  EXPORT_ANALYTICS: 'export:analytics',
  
  // Special permissions
  SUPER_ADMIN: 'super:admin',
  APPROVE_PRIVILEGED_ACTION: 'approve:privileged_action'
};

// Define available roles
const Role = {
  VIEWER: 'viewer',
  SUPPORT: 'support',
  PROOF_MANAGER: 'proof_manager',
  SYSTEM_MANAGER: 'system_manager',
  CONTRACT_MANAGER: 'contract_manager',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
};

// Define role hierarchy and permissions
const ROLE_PERMISSIONS = {
  [Role.VIEWER]: [
    Permission.VIEW_USERS,
    Permission.SEARCH_USERS,
    Permission.VIEW_PROOFS,
    Permission.SEARCH_PROOFS,
    Permission.VIEW_SYSTEM_METRICS,
    Permission.VIEW_CONTRACTS,
    Permission.VIEW_WALLETS,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_LOGS
  ]
};

// Build the permission hierarchy
ROLE_PERMISSIONS[Role.SUPPORT] = [
  ...ROLE_PERMISSIONS[Role.VIEWER],
  Permission.VERIFY_PROOF
];

ROLE_PERMISSIONS[Role.PROOF_MANAGER] = [
  ...ROLE_PERMISSIONS[Role.SUPPORT],
  Permission.INVALIDATE_PROOF
];

ROLE_PERMISSIONS[Role.SYSTEM_MANAGER] = [
  ...ROLE_PERMISSIONS[Role.VIEWER],
  Permission.MODIFY_SYSTEM_CONFIG
];

ROLE_PERMISSIONS[Role.CONTRACT_MANAGER] = [
  ...ROLE_PERMISSIONS[Role.VIEWER],
  Permission.DEPLOY_CONTRACT,
  Permission.UPGRADE_CONTRACT
];

ROLE_PERMISSIONS[Role.ADMIN] = [
  Permission.VIEW_USERS,
  Permission.CREATE_USER,
  Permission.EDIT_USER,
  Permission.DELETE_USER,
  Permission.SEARCH_USERS,
  Permission.VIEW_PROOFS,
  Permission.VERIFY_PROOF,
  Permission.INVALIDATE_PROOF,
  Permission.SEARCH_PROOFS,
  Permission.VIEW_SYSTEM_METRICS,
  Permission.MODIFY_SYSTEM_CONFIG,
  Permission.VIEW_LOGS,
  Permission.VIEW_CONTRACTS,
  Permission.DEPLOY_CONTRACT,
  Permission.UPGRADE_CONTRACT,
  Permission.VIEW_WALLETS,
  Permission.CREATE_WALLET,
  Permission.REMOVE_WALLET,
  Permission.VIEW_ANALYTICS,
  Permission.EXPORT_ANALYTICS,
  Permission.APPROVE_PRIVILEGED_ACTION
];

ROLE_PERMISSIONS[Role.SUPER_ADMIN] = [
  ...ROLE_PERMISSIONS[Role.ADMIN],
  Permission.SUPER_ADMIN
];

/**
 * RBAC System implementation
 */
class RBACSystem {
  constructor() {
    this.userRoles = [];
    this.actionLog = [];
    this.privilegedActions = [];
    
    // Initialize with a default super admin if none exists
    if (process.env.SUPER_ADMIN_WALLET) {
      this.addUserRole({
        userId: 'system_super_admin',
        walletAddress: process.env.SUPER_ADMIN_WALLET,
        roles: [Role.SUPER_ADMIN]
      });
    }
  }
  
  /**
   * Add a user role to the system
   */
  addUserRole(userRole) {
    // Check if user already exists
    const existingUserIndex = this.userRoles.findIndex(
      ur => ur.walletAddress.toLowerCase() === userRole.walletAddress.toLowerCase()
    );
    
    if (existingUserIndex >= 0) {
      // Update existing user
      this.userRoles[existingUserIndex] = {
        ...this.userRoles[existingUserIndex],
        roles: [...userRole.roles],
        customPermissions: userRole.customPermissions
      };
    } else {
      // Add new user
      this.userRoles.push(userRole);
    }
    
    return true;
  }
  
  /**
   * Remove a user role from the system
   */
  removeUserRole(walletAddress) {
    const initialLength = this.userRoles.length;
    this.userRoles = this.userRoles.filter(
      ur => ur.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
    );
    
    return this.userRoles.length < initialLength;
  }
  
  /**
   * Check if a user has a specific permission
   */
  hasPermission(walletAddress, permission) {
    const userRole = this.getUserRole(walletAddress);
    if (!userRole) return false;
    
    // Check if user has super admin permission
    const hasSuperAdmin = userRole.roles.includes(Role.SUPER_ADMIN) ||
      (userRole.customPermissions && userRole.customPermissions.includes(Permission.SUPER_ADMIN));
    
    if (hasSuperAdmin) return true;
    
    // Check role-based permissions
    for (const role of userRole.roles) {
      if (ROLE_PERMISSIONS[role].includes(permission)) {
        return true;
      }
    }
    
    // Check custom permissions
    if (userRole.customPermissions && userRole.customPermissions.includes(permission)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Get a user's role by wallet address
   */
  getUserRole(walletAddress) {
    return this.userRoles.find(
      ur => ur.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );
  }
  
  /**
   * Log an admin action for audit purposes
   */
  logAction(entry) {
    const logEntry = {
      ...entry,
      timestamp: new Date()
    };
    
    this.actionLog.push(logEntry);
    
    // Also log to the central error logger for persistence
    zkErrorLogger.log(
      entry.status === 'success' ? 'INFO' : entry.status === 'denied' ? 'WARNING' : 'ERROR',
      `Admin action: ${entry.action} on ${entry.targetResource} by ${entry.userId}`,
      {
        category: 'admin_action',
        userFixable: false,
        recoverable: true,
        details: entry
      }
    );
  }
  
  /**
   * Get action logs with optional filtering
   */
  getActionLogs(filters) {
    if (!filters) return [...this.actionLog];
    
    return this.actionLog.filter(entry => {
      if (filters.userId && entry.userId !== filters.userId) return false;
      if (filters.walletAddress && entry.walletAddress.toLowerCase() !== filters.walletAddress.toLowerCase()) return false;
      if (filters.action && entry.action !== filters.action) return false;
      if (filters.status && entry.status !== filters.status) return false;
      if (filters.startDate && entry.timestamp < filters.startDate) return false;
      if (filters.endDate && entry.timestamp > filters.endDate) return false;
      return true;
    });
  }
  
  /**
   * Request a privileged action that requires approval
   */
  requestPrivilegedAction(request) {
    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    const actionRequest = {
      id,
      timestamp: new Date(),
      status: 'pending',
      ...request
    };
    
    this.privilegedActions.push(actionRequest);
    
    return id;
  }
  
  /**
   * Approve a privileged action request
   */
  approvePrivilegedAction(requestId, approverWallet) {
    const request = this.privilegedActions.find(req => req.id === requestId);
    if (!request || request.status !== 'pending') return false;
    
    // Check if approver has permission
    if (!this.hasPermission(approverWallet, Permission.APPROVE_PRIVILEGED_ACTION)) {
      this.logAction({
        userId: 'unknown',
        walletAddress: approverWallet,
        action: 'approve_privileged_action',
        targetResource: requestId,
        status: 'denied',
        details: { requestId }
      });
      return false;
    }
    
    // Get approver user if possible
    const approver = this.getUserRole(approverWallet);
    
    // Update request status
    request.status = 'approved';
    request.approvedBy = approver ? approver.userId : approverWallet;
    request.approvedAt = new Date();
    
    // Log the approval
    this.logAction({
      userId: approver ? approver.userId : 'unknown',
      walletAddress: approverWallet,
      action: 'approve_privileged_action',
      targetResource: requestId,
      status: 'success',
      details: { requestId, originalAction: request.action }
    });
    
    return true;
  }
  
  /**
   * Reject a privileged action request
   */
  rejectPrivilegedAction(requestId, rejectorWallet) {
    const request = this.privilegedActions.find(req => req.id === requestId);
    if (!request || request.status !== 'pending') return false;
    
    // Check if rejector has permission
    if (!this.hasPermission(rejectorWallet, Permission.APPROVE_PRIVILEGED_ACTION)) {
      this.logAction({
        userId: 'unknown',
        walletAddress: rejectorWallet,
        action: 'reject_privileged_action',
        targetResource: requestId,
        status: 'denied',
        details: { requestId }
      });
      return false;
    }
    
    // Get rejector user if possible
    const rejector = this.getUserRole(rejectorWallet);
    
    // Update request status
    request.status = 'rejected';
    request.rejectedBy = rejector ? rejector.userId : rejectorWallet;
    request.rejectedAt = new Date();
    
    // Log the rejection
    this.logAction({
      userId: rejector ? rejector.userId : 'unknown',
      walletAddress: rejectorWallet,
      action: 'reject_privileged_action',
      targetResource: requestId,
      status: 'success',
      details: { requestId, originalAction: request.action }
    });
    
    return true;
  }
  
  /**
   * Get privileged action requests with optional filtering
   */
  getPrivilegedActionRequests(filters) {
    if (!filters) return [...this.privilegedActions];
    
    return this.privilegedActions.filter(request => {
      if (filters.requestorId && request.requestorId !== filters.requestorId) return false;
      if (filters.requestorWallet && request.requestorWallet.toLowerCase() !== filters.requestorWallet.toLowerCase()) return false;
      if (filters.status && request.status !== filters.status) return false;
      if (filters.action && request.action !== filters.action) return false;
      return true;
    });
  }
  
  /**
   * Get all users with their roles
   */
  getAllUserRoles() {
    return [...this.userRoles];
  }
  
  /**
   * Check if a wallet is an admin
   */
  isAdmin(walletAddress) {
    const userRole = this.getUserRole(walletAddress);
    if (!userRole) return false;
    
    return userRole.roles.includes(Role.ADMIN) || userRole.roles.includes(Role.SUPER_ADMIN);
  }
}

// Create a singleton instance
const rbacSystem = new RBACSystem();

// Export everything
module.exports = {
  Permission,
  Role,
  ROLE_PERMISSIONS,
  RBACSystem,
  rbacSystem
};