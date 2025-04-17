/**
 * Admin User Management System
 * 
 * This module provides comprehensive user management functionality for the admin dashboard,
 * including user creation, role assignment, permissions management, and searching.
 * 
 * The implementation uses the Role-Based Access Control (RBAC) system to enforce
 * access controls based on user roles and permissions.
 */

import { rbacSystem, Role, Permission, UserRole, ROLE_PERMISSIONS } from './RoleBasedAccessControl';
import { ZKErrorLogger } from '../zkErrorLogger.js';

// Create logger instance for UserManagement operations
const logger = new ZKErrorLogger({
  logLevel: 'info',
  privacyLevel: 'internal',
  destinations: ['console', 'file']
});

// User interface
export interface User {
  id: string;
  walletAddress: string;
  email?: string;
  displayName?: string;
  profileInfo?: {
    createdAt: Date;
    lastLogin?: Date;
    isVerified: boolean;
    isSuspended: boolean;
    suspensionReason?: string;
    bio?: string;
    avatar?: string;
  };
  statistics?: {
    proofsCreated: number;
    proofsVerified: number;
    lastActivity?: Date;
  };
  customData?: Record<string, any>;
}

// User search filters
export interface UserSearchFilters {
  walletAddress?: string;
  email?: string;
  displayName?: string;
  role?: Role;
  isVerified?: boolean;
  isSuspended?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  lastActiveAfter?: Date;
  lastActiveBefore?: Date;
}

// User creation params
export interface CreateUserParams {
  walletAddress: string;
  roles: Role[];
  email?: string;
  displayName?: string;
  customPermissions?: Permission[];
  customData?: Record<string, any>;
}

// Status update params
export interface UpdateUserStatusParams {
  walletAddress: string;
  isVerified?: boolean;
  isSuspended?: boolean;
  suspensionReason?: string;
}

/**
 * User Management System
 */
export class UserManagementSystem {
  private users: User[] = [];

  constructor() {
    // Initialize with some example users
    if (process.env.NODE_ENV === 'development') {
      this.initializeExampleUsers();
    }
  }

  /**
   * Create a new user
   */
  public createUser(
    params: CreateUserParams,
    adminWalletAddress: string
  ): User | null {
    // Check if admin has permission to create users
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.CREATE_USER)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'create_user',
        targetResource: params.walletAddress,
        status: 'denied',
        details: { params }
      });

      return null;
    }

    // Check if user already exists
    const existingUser = this.users.find(
      u => u.walletAddress.toLowerCase() === params.walletAddress.toLowerCase()
    );

    if (existingUser) {
      logger.warn('Attempted to create a user that already exists', {
        walletAddress: params.walletAddress,
        action: 'create_user',
        status: 'error'
      });
      return null;
    }

    // Generate a unique ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create the user
    const newUser: User = {
      id: userId,
      walletAddress: params.walletAddress,
      email: params.email,
      displayName: params.displayName || `User ${userId.substring(5, 9)}`,
      profileInfo: {
        createdAt: new Date(),
        isVerified: false,
        isSuspended: false
      },
      statistics: {
        proofsCreated: 0,
        proofsVerified: 0
      },
      customData: params.customData
    };

    // Add the user
    this.users.push(newUser);

    // Create user role in RBAC system
    rbacSystem.addUserRole({
      userId,
      walletAddress: params.walletAddress,
      roles: params.roles,
      customPermissions: params.customPermissions
    });

    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);

    // Log the action
    rbacSystem.logAction({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'create_user',
      targetResource: newUser.id,
      status: 'success',
      details: {
        newUserId: newUser.id,
        walletAddress: params.walletAddress,
        roles: params.roles
      }
    });

    return newUser;
  }

  /**
   * Find users by search criteria
   */
  public findUsers(
    filters: UserSearchFilters,
    adminWalletAddress: string,
    pagination?: { skip: number; limit: number }
  ): { users: User[]; total: number } | null {
    // Check if admin has permission to search users
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.SEARCH_USERS)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'search_users',
        targetResource: 'users',
        status: 'denied',
        details: { filters }
      });

      return null;
    }

    // Apply filters
    let filteredUsers = this.users.filter(user => {
      if (filters.walletAddress &&
        !user.walletAddress.toLowerCase().includes(filters.walletAddress.toLowerCase())) {
        return false;
      }

      if (filters.email && user.email &&
        !user.email.toLowerCase().includes(filters.email.toLowerCase())) {
        return false;
      }

      if (filters.displayName && user.displayName &&
        !user.displayName.toLowerCase().includes(filters.displayName.toLowerCase())) {
        return false;
      }

      if (filters.isVerified !== undefined &&
        user.profileInfo?.isVerified !== filters.isVerified) {
        return false;
      }

      if (filters.isSuspended !== undefined &&
        user.profileInfo?.isSuspended !== filters.isSuspended) {
        return false;
      }

      if (filters.createdAfter &&
        user.profileInfo?.createdAt &&
        user.profileInfo.createdAt < filters.createdAfter) {
        return false;
      }

      if (filters.createdBefore &&
        user.profileInfo?.createdAt &&
        user.profileInfo.createdAt > filters.createdBefore) {
        return false;
      }

      if (filters.lastActiveAfter &&
        user.statistics?.lastActivity &&
        user.statistics.lastActivity < filters.lastActiveAfter) {
        return false;
      }

      if (filters.lastActiveBefore &&
        user.statistics?.lastActivity &&
        user.statistics.lastActivity > filters.lastActiveBefore) {
        return false;
      }

      // Filter by role if specified
      if (filters.role) {
        const userRole = rbacSystem.getUserRole(user.walletAddress);
        if (!userRole || !userRole.roles.includes(filters.role)) {
          return false;
        }
      }

      return true;
    });

    const total = filteredUsers.length;

    // Apply pagination if specified
    if (pagination) {
      filteredUsers = filteredUsers.slice(
        pagination.skip,
        pagination.skip + pagination.limit
      );
    }

    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);

    // Log the action
    rbacSystem.logAction({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'search_users',
      targetResource: 'users',
      status: 'success',
      details: {
        filters,
        resultCount: filteredUsers.length,
        totalCount: total
      }
    });

    return { users: filteredUsers, total };
  }

  /**
   * Get a user by wallet address
   */
  public getUserByWallet(
    walletAddress: string,
    adminWalletAddress: string
  ): User | null {
    // Check if admin has permission to view users
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.VIEW_USERS)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'view_user',
        targetResource: walletAddress,
        status: 'denied'
      });

      return null;
    }

    const user = this.users.find(
      u => u.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!user) {
      return null;
    }

    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);

    // Log the action
    rbacSystem.logAction({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'view_user',
      targetResource: user.id,
      status: 'success'
    });

    return user;
  }

  /**
   * Update user roles
   */
  public updateUserRoles(
    walletAddress: string,
    roles: Role[],
    customPermissions: Permission[] | undefined,
    adminWalletAddress: string
  ): boolean {
    // Check if admin has permission to edit users
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.EDIT_USER)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'update_user_roles',
        targetResource: walletAddress,
        status: 'denied',
        details: { roles, customPermissions }
      });

      return false;
    }

    // Find the user
    const user = this.users.find(
      u => u.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!user) {
      return false;
    }

    // Get the user's role
    const userRole = rbacSystem.getUserRole(walletAddress);

    // Security check: prevent non-super-admins from modifying super-admin roles
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);
    if (userRole?.roles.includes(Role.SUPER_ADMIN) &&
      adminRole && !adminRole.roles.includes(Role.SUPER_ADMIN)) {
      rbacSystem.logAction({
        userId: adminRole.userId,
        walletAddress: adminWalletAddress,
        action: 'update_user_roles',
        targetResource: user.id,
        status: 'denied',
        details: {
          reason: 'Cannot modify super admin roles without super admin privileges'
        }
      });

      return false;
    }

    // Update the roles in RBAC system
    rbacSystem.addUserRole({
      userId: user.id,
      walletAddress: user.walletAddress,
      roles,
      customPermissions
    });

    // Log the action
    rbacSystem.logAction({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'update_user_roles',
      targetResource: user.id,
      status: 'success',
      details: { roles, customPermissions }
    });

    return true;
  }

  /**
   * Assign a single role to a user
   * @param walletAddress The wallet address of the user
   * @param role The role to assign
   * @param adminWalletAddress The wallet address of the admin making the change
   * @returns True if the role was assigned successfully, false otherwise
   */
  public assignUserRole(
    walletAddress: string,
    role: Role,
    adminWalletAddress: string
  ): boolean {
    // Check if admin has permission to edit users
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.EDIT_USER)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'assign_user_role',
        targetResource: walletAddress,
        status: 'denied',
        details: { role }
      });

      return false;
    }

    // Find the user in our management system
    const user = this.users.find(
      u => u.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );

    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);

    if (!user) {
      // If user doesn't exist in the management system but exists in RBAC, add them
      const userRole = rbacSystem.getUserRole(walletAddress);

      if (userRole) {
        // Use RBAC system directly to assign the role
        const success = rbacSystem.assignRole(walletAddress, role, adminWalletAddress);

        if (success) {
          // Create the user in our management system
          this.createUser(
            {
              walletAddress: walletAddress,
              roles: [...userRole.roles], // Already updated by RBAC system
              customPermissions: userRole.customPermissions
            },
            adminWalletAddress
          );

          return true;
        }

        return false;
      } else {
        // Create a new user with the role
        const newUser = this.createUser(
          {
            walletAddress: walletAddress,
            roles: [role]
          },
          adminWalletAddress
        );

        return newUser !== null;
      }
    }

    // Security check: prevent non-super-admins from adding super-admin role
    if (role === Role.SUPER_ADMIN &&
      adminRole && !adminRole.roles.includes(Role.SUPER_ADMIN)) {
      rbacSystem.logAction({
        userId: adminRole.userId,
        walletAddress: adminWalletAddress,
        action: 'assign_user_role',
        targetResource: user.id,
        status: 'denied',
        details: {
          reason: 'Cannot assign super admin role without super admin privileges'
        }
      });

      return false;
    }

    // Use the RBAC system to assign the role
    const success = rbacSystem.assignRole(walletAddress, role, adminWalletAddress);

    if (success) {
      // Log the action
      rbacSystem.logAction({
        userId: adminRole?.userId || 'unknown',
        walletAddress: adminWalletAddress,
        action: 'assign_user_role',
        targetResource: user.id,
        status: 'success',
        details: { role }
      });
    }

    return success;
  }

  /**
   * Update user status (verification, suspension)
   */
  public updateUserStatus(
    params: UpdateUserStatusParams,
    adminWalletAddress: string
  ): boolean {
    // Check if admin has permission to edit users
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.EDIT_USER)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'update_user_status',
        targetResource: params.walletAddress,
        status: 'denied',
        details: params
      });

      return false;
    }

    // Find the user
    const userIndex = this.users.findIndex(
      u => u.walletAddress.toLowerCase() === params.walletAddress.toLowerCase()
    );

    if (userIndex === -1) {
      return false;
    }

    // Get the user
    const user = this.users[userIndex];

    // Update the user's profile info
    this.users[userIndex] = {
      ...user,
      profileInfo: {
        ...user.profileInfo!,
        isVerified: params.isVerified !== undefined
          ? params.isVerified
          : user.profileInfo?.isVerified || false,
        isSuspended: params.isSuspended !== undefined
          ? params.isSuspended
          : user.profileInfo?.isSuspended || false,
        suspensionReason: params.suspensionReason !== undefined
          ? params.suspensionReason
          : user.profileInfo?.suspensionReason
      }
    };

    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);

    // Log the action
    rbacSystem.logAction({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'update_user_status',
      targetResource: user.id,
      status: 'success',
      details: params
    });

    return true;
  }

  /**
   * Delete a user
   */
  public deleteUser(
    walletAddress: string,
    adminWalletAddress: string
  ): boolean {
    // Check if admin has permission to delete users
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.DELETE_USER)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'delete_user',
        targetResource: walletAddress,
        status: 'denied'
      });

      return false;
    }

    // Find the user
    const user = this.users.find(
      u => u.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!user) {
      return false;
    }

    // Security check: prevent non-super-admins from deleting super-admin users
    const userRole = rbacSystem.getUserRole(walletAddress);
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);

    if (userRole?.roles.includes(Role.SUPER_ADMIN) &&
      adminRole && !adminRole.roles.includes(Role.SUPER_ADMIN)) {
      rbacSystem.logAction({
        userId: adminRole.userId,
        walletAddress: adminWalletAddress,
        action: 'delete_user',
        targetResource: user.id,
        status: 'denied',
        details: {
          reason: 'Cannot delete super admin without super admin privileges'
        }
      });

      return false;
    }

    // Delete the user
    this.users = this.users.filter(
      u => u.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
    );

    // Remove user role from RBAC system
    rbacSystem.removeUserRole(walletAddress);

    // Log the action
    rbacSystem.logAction({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'delete_user',
      targetResource: user.id,
      status: 'success'
    });

    return true;
  }

  /**
   * Get user roles and permissions
   */
  public getUserRolesAndPermissions(
    walletAddress: string,
    adminWalletAddress: string
  ): { userRole: UserRole; permissions: Permission[] } | null {
    // Check if admin has permission to view users
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.VIEW_USERS)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'view_user_roles',
        targetResource: walletAddress,
        status: 'denied'
      });

      return null;
    }

    // Get the user's role
    const userRole = rbacSystem.getUserRole(walletAddress);

    if (!userRole) {
      return null;
    }

    // Compile all permissions from the user's roles
    const permissions: Permission[] = [];

    // Add permissions from each role
    for (const role of userRole.roles) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        if (!permissions.includes(permission)) {
          permissions.push(permission);
        }
      }
    }

    // Add custom permissions
    if (userRole.customPermissions) {
      for (const permission of userRole.customPermissions) {
        if (!permissions.includes(permission)) {
          permissions.push(permission);
        }
      }
    }

    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);

    // Log the action
    rbacSystem.logAction({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'view_user_roles',
      targetResource: userRole.userId,
      status: 'success'
    });

    return { userRole, permissions };
  }

  /**
   * Get users with specific roles
   */
  public getUsersByRole(
    role: Role,
    adminWalletAddress: string,
    pagination?: { skip: number; limit: number }
  ): { users: User[]; total: number } | null {
    // Check if admin has permission to search users
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.SEARCH_USERS)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'search_users_by_role',
        targetResource: 'users',
        status: 'denied',
        details: { role }
      });

      return null;
    }

    // Get all user roles
    const userRoles = rbacSystem.getAllUserRoles();

    // Filter users with the specified role
    const userRolesWithRole = userRoles.filter(ur => ur.roles.includes(role));

    // Match with user profiles
    let filteredUsers = userRolesWithRole.map(ur => {
      const user = this.users.find(
        u => u.walletAddress.toLowerCase() === ur.walletAddress.toLowerCase()
      );
      return user || null;
    }).filter((user): user is User => user !== null);

    const total = filteredUsers.length;

    // Apply pagination if specified
    if (pagination) {
      filteredUsers = filteredUsers.slice(
        pagination.skip,
        pagination.skip + pagination.limit
      );
    }

    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);

    // Log the action
    rbacSystem.logAction({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'search_users_by_role',
      targetResource: 'users',
      status: 'success',
      details: {
        role,
        resultCount: filteredUsers.length,
        totalCount: total
      }
    });

    return { users: filteredUsers, total };
  }

  /**
   * Initialize example users for development
   */
  private initializeExampleUsers(): void {
    // Super admin
    const superAdminWallet = process.env.SUPER_ADMIN_WALLET || '0x0123456789abcdef0123456789abcdef01234567';
    const superAdmin: User = {
      id: 'super_admin',
      walletAddress: superAdminWallet,
      email: 'super.admin@example.com',
      displayName: 'Super Admin',
      profileInfo: {
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        isVerified: true,
        isSuspended: false
      },
      statistics: {
        proofsCreated: 25,
        proofsVerified: 150,
        lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      }
    };

    // Regular admin
    const adminWallet = '0x1123456789abcdef0123456789abcdef01234567';
    const admin: User = {
      id: 'admin_user',
      walletAddress: adminWallet,
      email: 'admin@example.com',
      displayName: 'Admin User',
      profileInfo: {
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        lastLogin: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        isVerified: true,
        isSuspended: false
      },
      statistics: {
        proofsCreated: 15,
        proofsVerified: 80,
        lastActivity: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
      }
    };

    // System manager
    const systemManagerWallet = '0x2123456789abcdef0123456789abcdef01234567';
    const systemManager: User = {
      id: 'system_manager',
      walletAddress: systemManagerWallet,
      email: 'system.manager@example.com',
      displayName: 'System Manager',
      profileInfo: {
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
        lastLogin: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        isVerified: true,
        isSuspended: false
      },
      statistics: {
        proofsCreated: 10,
        proofsVerified: 40,
        lastActivity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
      }
    };

    // Proof manager
    const proofManagerWallet = '0x3123456789abcdef0123456789abcdef01234567';
    const proofManager: User = {
      id: 'proof_manager',
      walletAddress: proofManagerWallet,
      email: 'proof.manager@example.com',
      displayName: 'Proof Manager',
      profileInfo: {
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        lastLogin: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        isVerified: true,
        isSuspended: false
      },
      statistics: {
        proofsCreated: 8,
        proofsVerified: 120,
        lastActivity: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
      }
    };

    // Support user
    const supportWallet = '0x4123456789abcdef0123456789abcdef01234567';
    const support: User = {
      id: 'support_user',
      walletAddress: supportWallet,
      email: 'support@example.com',
      displayName: 'Support User',
      profileInfo: {
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
        lastLogin: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        isVerified: true,
        isSuspended: false
      },
      statistics: {
        proofsCreated: 5,
        proofsVerified: 60,
        lastActivity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      }
    };

    // Regular viewer
    const viewerWallet = '0x5123456789abcdef0123456789abcdef01234567';
    const viewer: User = {
      id: 'viewer_user',
      walletAddress: viewerWallet,
      email: 'viewer@example.com',
      displayName: 'Viewer User',
      profileInfo: {
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        lastLogin: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        isVerified: true,
        isSuspended: false
      },
      statistics: {
        proofsCreated: 3,
        proofsVerified: 12,
        lastActivity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
      }
    };

    // Add users to the system
    this.users = [superAdmin, admin, systemManager, proofManager, support, viewer];

    // Set up roles in RBAC system
    rbacSystem.addUserRole({
      userId: superAdmin.id,
      walletAddress: superAdmin.walletAddress,
      roles: [Role.SUPER_ADMIN]
    });

    rbacSystem.addUserRole({
      userId: admin.id,
      walletAddress: admin.walletAddress,
      roles: [Role.ADMIN]
    });

    rbacSystem.addUserRole({
      userId: systemManager.id,
      walletAddress: systemManager.walletAddress,
      roles: [Role.SYSTEM_MANAGER]
    });

    rbacSystem.addUserRole({
      userId: proofManager.id,
      walletAddress: proofManager.walletAddress,
      roles: [Role.PROOF_MANAGER]
    });

    rbacSystem.addUserRole({
      userId: support.id,
      walletAddress: support.walletAddress,
      roles: [Role.SUPPORT]
    });

    rbacSystem.addUserRole({
      userId: viewer.id,
      walletAddress: viewer.walletAddress,
      roles: [Role.VIEWER]
    });
  }
}

// Singleton instance management
let instance: UserManagementSystem | null = null;

/**
 * Get the singleton instance of the User Management System
 */
export function getInstance(): UserManagementSystem {
  if (!instance) {
    instance = new UserManagementSystem();
  }
  return instance;
}

// Create a singleton instance
export const userManagementSystem = getInstance();

// Export default for CommonJS compatibility
export default userManagementSystem;