/**
 * Role-Based Access Control (RBAC) Implementation for Admin Dashboard
 * 
 * This module defines the role-based access control system used for the
 * admin interface. It implements a comprehensive permission model with
 * role hierarchies, fine-grained permissions, and user role management.
 * 
 * Key features:
 * - Hierarchical roles (admins inherit permissions from lower roles)
 * - Permission-based access control
 * - Action logging for security auditing
 * - Support for custom approval workflows
 */

import { zkErrorLogger } from '../src/zkErrorLogger.mjs';

// Permission constants
export enum Permission {
  // User management permissions
  VIEW_USERS = 'view:users',
  CREATE_USER = 'create:user',
  EDIT_USER = 'edit:user',
  DELETE_USER = 'delete:user',
  SEARCH_USERS = 'search:users',
  
  // Proof management permissions
  VIEW_PROOFS = 'view:proofs',
  VERIFY_PROOF = 'verify:proof',
  INVALIDATE_PROOF = 'invalidate:proof',
  SEARCH_PROOFS = 'search:proofs',
  
  // System administration permissions
  VIEW_SYSTEM_METRICS = 'view:system_metrics',
  MODIFY_SYSTEM_CONFIG = 'modify:system_config',
  VIEW_LOGS = 'view:logs',
  
  // Contract management permissions
  VIEW_CONTRACTS = 'view:contracts',
  DEPLOY_CONTRACT = 'deploy:contract',
  UPGRADE_CONTRACT = 'upgrade:contract',
  
  // Wallet management permissions
  VIEW_WALLETS = 'view:wallets',
  CREATE_WALLET = 'create:wallet',
  REMOVE_WALLET = 'remove:wallet',
  
  // Analytics permissions
  VIEW_ANALYTICS = 'view:analytics',
  EXPORT_ANALYTICS = 'export:analytics',
  
  // Special permissions
  SUPER_ADMIN = 'super:admin',
  APPROVE_PRIVILEGED_ACTION = 'approve:privileged_action'
}

// Define available roles
export enum Role {
  VIEWER = 'viewer',
  SUPPORT = 'support',
  PROOF_MANAGER = 'proof_manager',
  SYSTEM_MANAGER = 'system_manager',
  CONTRACT_MANAGER = 'contract_manager',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin'
}

// Define role hierarchy and permissions
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
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
  ],
  
  [Role.SUPPORT]: [
    // Inherits VIEWER permissions
    ...ROLE_PERMISSIONS[Role.VIEWER],
    Permission.VERIFY_PROOF
  ],
  
  [Role.PROOF_MANAGER]: [
    // Inherits SUPPORT permissions
    ...ROLE_PERMISSIONS[Role.SUPPORT],
    Permission.INVALIDATE_PROOF
  ],
  
  [Role.SYSTEM_MANAGER]: [
    // Inherits VIEWER permissions
    ...ROLE_PERMISSIONS[Role.VIEWER],
    Permission.MODIFY_SYSTEM_CONFIG
  ],
  
  [Role.CONTRACT_MANAGER]: [
    // Inherits VIEWER permissions
    ...ROLE_PERMISSIONS[Role.VIEWER],
    Permission.DEPLOY_CONTRACT,
    Permission.UPGRADE_CONTRACT
  ],
  
  [Role.ADMIN]: [
    // Has all permissions except super admin
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
  ],
  
  [Role.SUPER_ADMIN]: [
    // Has absolutely all permissions
    ...ROLE_PERMISSIONS[Role.ADMIN],
    Permission.SUPER_ADMIN
  ]
};

// User role interface
export interface UserRole {
  userId: string;
  walletAddress: string;
  roles: Role[];
  customPermissions?: Permission[];
}

/**
 * Action log entry interface
 */
export interface ActionLogEntry {
  timestamp: Date;
  userId: string;
  walletAddress: string;
  action: string;
  targetResource: string;
  status: 'success' | 'denied' | 'error';
  details?: any;
}

/**
 * Privileged action request interface
 */
export interface PrivilegedActionRequest {
  id: string;
  timestamp: Date;
  requestorId: string;
  requestorWallet: string;
  action: string;
  targetResource: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  details?: any;
}

/**
 * RBAC System implementation
 */
export class RBACSystem {
  private userRoles: UserRole[] = [];
  private actionLog: ActionLogEntry[] = [];
  private privilegedActions: PrivilegedActionRequest[] = [];
  
  constructor() {
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
  public addUserRole(userRole: UserRole): boolean {
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
  public removeUserRole(walletAddress: string): boolean {
    const initialLength = this.userRoles.length;
    this.userRoles = this.userRoles.filter(
      ur => ur.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
    );
    
    return this.userRoles.length < initialLength;
  }
  
  /**
   * Check if a user has a specific permission
   */
  public hasPermission(walletAddress: string, permission: Permission): boolean {
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
  public getUserRole(walletAddress: string): UserRole | undefined {
    return this.userRoles.find(
      ur => ur.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );
  }
  
  /**
   * Log an admin action for audit purposes
   */
  public logAction(entry: Omit<ActionLogEntry, 'timestamp'>): void {
    const logEntry: ActionLogEntry = {
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
  public getActionLogs(filters?: {
    userId?: string;
    walletAddress?: string;
    action?: string;
    status?: 'success' | 'denied' | 'error';
    startDate?: Date;
    endDate?: Date;
  }): ActionLogEntry[] {
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
  public requestPrivilegedAction(request: Omit<PrivilegedActionRequest, 'id' | 'timestamp' | 'status'>): string {
    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    const actionRequest: PrivilegedActionRequest = {
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
  public approvePrivilegedAction(requestId: string, approverWallet: string): boolean {
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
  public rejectPrivilegedAction(requestId: string, rejectorWallet: string): boolean {
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
  public getPrivilegedActionRequests(filters?: {
    requestorId?: string;
    requestorWallet?: string;
    status?: 'pending' | 'approved' | 'rejected';
    action?: string;
  }): PrivilegedActionRequest[] {
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
  public getAllUserRoles(): UserRole[] {
    return [...this.userRoles];
  }
  
  /**
   * Check if a wallet is an admin
   */
  public isAdmin(walletAddress: string): boolean {
    const userRole = this.getUserRole(walletAddress);
    if (!userRole) return false;
    
    return userRole.roles.includes(Role.ADMIN) || userRole.roles.includes(Role.SUPER_ADMIN);
  }
}

// Create a singleton instance
export const rbacSystem = new RBACSystem();

// Export default for CommonJS compatibility
export default rbacSystem;