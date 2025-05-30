/**
 * User test fixtures
 * 
 * Provides sample user data for tests
 */
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a random Ethereum address
 */
export function randomAddress(): string {
  return `0x${uuidv4().replace(/-/g, '').substring(0, 40)}`;
}

/**
 * Default user fixture
 */
export const defaultUser = {
  id: uuidv4(),
  address: randomAddress(),
  createdAt: new Date(),
  lastLoginAt: new Date(),
  isActive: true,
  permissions: ['USER'],
  settings: {}
};

/**
 * Admin user fixture
 */
export const adminUser = {
  id: uuidv4(),
  address: randomAddress(),
  createdAt: new Date(),
  lastLoginAt: new Date(),
  isActive: true,
  permissions: ['USER', 'ADMIN'],
  settings: {}
};

/**
 * Inactive user fixture
 */
export const inactiveUser = {
  id: uuidv4(),
  address: randomAddress(),
  createdAt: new Date(),
  lastLoginAt: new Date(),
  isActive: false,
  permissions: ['USER'],
  settings: {}
};

/**
 * Organization owner user fixture
 */
export const orgOwnerUser = {
  id: uuidv4(),
  address: randomAddress(),
  createdAt: new Date(),
  lastLoginAt: new Date(),
  isActive: true,
  permissions: ['USER', 'ORG_ADMIN'],
  settings: {}
};

/**
 * Generate a batch of random users
 * 
 * @param count Number of users to generate
 * @returns Array of user fixtures
 */
export function generateUsers(count: number): any[] {
  const users = [];
  
  for (let i = 0; i < count; i++) {
    users.push({
      id: uuidv4(),
      address: randomAddress(),
      createdAt: new Date(),
      lastLoginAt: new Date(),
      isActive: true,
      permissions: ['USER'],
      settings: {}
    });
  }
  
  return users;
}