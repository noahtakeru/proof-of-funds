/**
 * Admin User Management System - CommonJS Version
 * 
 * This module provides comprehensive user management functionality for the admin dashboard,
 * including user creation, role assignment, permissions management, and searching.
 * 
 * CommonJS version for compatibility with Node.js environments.
 */

const { rbacSystem, Role, Permission } = require('./RoleBasedAccessControl.cjs');
const { zkErrorLogger } = require('../../zkErrorLogger.mjs');

/**
 * User Management System
 */
class UserManagementSystem {
  constructor() {
    this.users = [];
    
    // Initialize with some example users
    if (process.env.NODE_ENV === 'development') {
      this.initializeExampleUsers();
    }
  }
  
  /**
   * Create a new user
   */
  createUser(params, adminWalletAddress) {
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
      zkErrorLogger.log('WARNING', 'Attempted to create a user that already exists', {
        category: 'user_management',
        userFixable: true,
        recoverable: true,
        details: { walletAddress: params.walletAddress }
      });
      return null;
    }
    
    // Generate a unique ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Create the user
    const newUser = {
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
  findUsers(filters, adminWalletAddress, pagination) {
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
  getUserByWallet(walletAddress, adminWalletAddress) {
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
  updateUserRoles(walletAddress, roles, customPermissions, adminWalletAddress) {
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
   * Initialize example users for development
   */
  initializeExampleUsers() {
    // Super admin
    const superAdminWallet = process.env.SUPER_ADMIN_WALLET || '0x0123456789abcdef0123456789abcdef01234567';
    const superAdmin = {
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
    const admin = {
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
    
    // Add more example users as needed...
    
    // Add users to the system
    this.users = [superAdmin, admin];
    
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
  }
}

// Create a singleton instance
const userManagementSystem = new UserManagementSystem();

// Export everything
module.exports = {
  UserManagementSystem,
  userManagementSystem
};