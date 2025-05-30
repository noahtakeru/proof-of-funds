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
  // UUIDs are 36 characters with hyphens, 32 without
  // We need 40 hex characters after 0x, so we generate a UUID, remove hyphens
  // and pad with additional random hex digits as needed
  const hexChars = '0123456789abcdef';
  const uuidHex = uuidv4().replace(/-/g, ''); // 32 hex chars
  
  // Generate 8 more random hex characters to reach 40 total
  let extraHex = '';
  for (let i = 0; i < 8; i++) {
    extraHex += hexChars[Math.floor(Math.random() * 16)];
  }
  
  return `0x${uuidHex}${extraHex}`;
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