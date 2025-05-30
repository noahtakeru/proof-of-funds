/**
 * API Test Helpers
 * 
 * Utilities for testing API endpoints
 */
import { Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a test server for API testing
 * 
 * @param options Configuration options
 * @returns Express app
 */
export function createTestServer(options: any = {}): Express {
  // Dynamically import the app to prevent it from loading during Jest setup
  const { app } = require('../src/app');
  return app;
}

/**
 * Create an authenticated request
 * 
 * @param app Express application
 * @param userOrId User object or ID to use in token
 * @param permissions User permissions
 * @param address Wallet address
 * @returns SuperTest instance with auth headers
 */
export function authenticatedRequest(
  app: Express,
  userOrId: any = uuidv4(),
  permissions: string[] = ['USER'],
  address: string = `0x${uuidv4().replace(/-/g, '')}`
) {
  // Handle user object or user ID
  let userId: string;
  let userPermissions = permissions;
  let userAddress = address;
  
  if (typeof userOrId === 'object') {
    // User object provided
    userId = userOrId.id || uuidv4();
    userPermissions = userOrId.permissions || permissions;
    userAddress = userOrId.address || address;
  } else {
    // User ID provided
    userId = userOrId;
  }
  
  // Generate JWT token for testing
  const token = jwt.sign(
    {
      id: userId,
      address: userAddress,
      permissions: userPermissions
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
  
  return request(app).set('Authorization', `Bearer ${token}`);
}

/**
 * Create a public request (no authentication)
 * 
 * @param app Express application
 * @returns SuperTest instance
 */
export function publicRequest(app: Express) {
  return request(app);
}

/**
 * Expect a successful response
 * 
 * @param response API response
 * @param statusCode Expected status code (default: 200)
 * @returns The response body for chaining
 */
export function expectSuccess(response: any, statusCode: number = 200) {
  expect(response.status).toBe(statusCode);
  expect(response.body).toBeDefined();
  expect(response.body.error).toBeUndefined();
  
  return response.body;
}

/**
 * Expect an error response
 * 
 * @param response API response
 * @param status Expected status code
 * @param errorCode Expected error code
 * @returns The error object for chaining
 */
export function expectError(response: any, status: number = 400, errorCode?: string) {
  expect(response.status).toBe(status);
  expect(response.body).toBeDefined();
  expect(response.body.error).toBeDefined();
  
  if (errorCode) {
    expect(response.body.error.code).toBe(errorCode);
  }
  
  return response.body.error;
}