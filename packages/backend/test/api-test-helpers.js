"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestServer = createTestServer;
exports.authenticatedRequest = authenticatedRequest;
exports.publicRequest = publicRequest;
exports.expectSuccess = expectSuccess;
exports.expectError = expectError;
const supertest_1 = __importDefault(require("supertest"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
/**
 * Create a test server for API testing
 *
 * @param options Configuration options
 * @returns Express app
 */
function createTestServer(options = {}) {
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
function authenticatedRequest(app, userOrId = (0, uuid_1.v4)(), permissions = ['USER'], address = `0x${(0, uuid_1.v4)().replace(/-/g, '')}`) {
    // Handle user object or user ID
    let userId;
    let userPermissions = permissions;
    let userAddress = address;
    if (typeof userOrId === 'object') {
        // User object provided
        userId = userOrId.id || (0, uuid_1.v4)();
        userPermissions = userOrId.permissions || permissions;
        userAddress = userOrId.address || address;
    }
    else {
        // User ID provided
        userId = userOrId;
    }
    // Generate JWT token for testing
    const token = jsonwebtoken_1.default.sign({
        id: userId,
        address: userAddress,
        permissions: userPermissions
    }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
    return (0, supertest_1.default)(app).set('Authorization', `Bearer ${token}`);
}
/**
 * Create a public request (no authentication)
 *
 * @param app Express application
 * @returns SuperTest instance
 */
function publicRequest(app) {
    return (0, supertest_1.default)(app);
}
/**
 * Expect a successful response
 *
 * @param response API response
 * @param statusCode Expected status code (default: 200)
 * @returns The response body for chaining
 */
function expectSuccess(response, statusCode = 200) {
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
function expectError(response, status = 400, errorCode) {
    expect(response.status).toBe(status);
    expect(response.body).toBeDefined();
    expect(response.body.error).toBeDefined();
    if (errorCode) {
        expect(response.body.error.code).toBe(errorCode);
    }
    return response.body.error;
}
