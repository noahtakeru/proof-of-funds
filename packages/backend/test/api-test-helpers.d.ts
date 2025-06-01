/**
 * API Test Helpers
 *
 * Utilities for testing API endpoints
 */
import { Express } from 'express';
import request from 'supertest';
/**
 * Create a test server for API testing
 *
 * @param options Configuration options
 * @returns Express app
 */
export declare function createTestServer(options?: any): Express;
/**
 * Create an authenticated request
 *
 * @param app Express application
 * @param userOrId User object or ID to use in token
 * @param permissions User permissions
 * @param address Wallet address
 * @returns SuperTest instance with auth headers
 */
export declare function authenticatedRequest(app: Express, userOrId?: any, permissions?: string[], address?: string): import("supertest/lib/agent")<request.SuperTestStatic.Test>;
/**
 * Create a public request (no authentication)
 *
 * @param app Express application
 * @returns SuperTest instance
 */
export declare function publicRequest(app: Express): import("supertest/lib/agent")<request.SuperTestStatic.Test>;
/**
 * Expect a successful response
 *
 * @param response API response
 * @param statusCode Expected status code (default: 200)
 * @returns The response body for chaining
 */
export declare function expectSuccess(response: any, statusCode?: number): any;
/**
 * Expect an error response
 *
 * @param response API response
 * @param status Expected status code
 * @param errorCode Expected error code
 * @returns The error object for chaining
 */
export declare function expectError(response: any, status?: number, errorCode?: string): any;
