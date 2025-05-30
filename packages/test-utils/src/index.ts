/**
 * Test Utilities for Proof of Funds Platform
 * 
 * Centralized exports for all test utilities
 */

// Database utilities
export * from './db';

// API testing utilities
export * from './api';

// ZK proof testing utilities
export * from './zkProof';

// Fixtures
export * as userFixtures from '../fixtures/users';
export * as proofFixtures from '../fixtures/proofs';

/**
 * Test setup utility
 * 
 * @param callback Setup function to run in test
 */
export function withTestSetup(callback: () => Promise<void>): () => Promise<void> {
  return async () => {
    try {
      // Setup test database
      const { setupTestDatabase } = require('./db');
      await setupTestDatabase();
      
      // Run the provided setup function
      await callback();
    } catch (error) {
      console.error('Test setup failed:', error);
      throw error;
    }
  };
}

/**
 * Test teardown utility
 * 
 * @param callback Teardown function to run in test
 */
export function withTestTeardown(callback: () => Promise<void>): () => Promise<void> {
  return async () => {
    try {
      // Run the provided teardown function
      await callback();
      
      // Cleanup test database
      const { cleanupTestDatabase, prismaTest } = require('./db');
      await cleanupTestDatabase();
      
      // Disconnect from database
      await prismaTest.$disconnect();
    } catch (error) {
      console.error('Test teardown failed:', error);
      
      // Always try to disconnect from database
      try {
        const { prismaTest } = require('./db');
        await prismaTest.$disconnect();
      } catch (disconnectError) {
        console.error('Failed to disconnect from database:', disconnectError);
      }
      
      throw error;
    }
  };
}

/**
 * Complete test environment setup
 * 
 * @param setupFn Setup function to run before tests
 * @param teardownFn Teardown function to run after tests
 */
export function setupTestEnvironment(
  setupFn?: () => Promise<void>,
  teardownFn?: () => Promise<void>
): void {
  beforeAll(withTestSetup(setupFn || (async () => {})));
  afterAll(withTestTeardown(teardownFn || (async () => {})));
}