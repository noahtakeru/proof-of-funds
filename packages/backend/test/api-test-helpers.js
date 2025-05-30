/**
 * API Test Helpers
 * 
 * This module provides utilities for testing API endpoints.
 */
const supertest = require('supertest');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

/**
 * Create an authenticated API request
 * @param {Object} app Express application instance
 * @param {Object} user User object to use for authentication
 * @returns {Object} Supertest request with authentication headers
 */
function authenticatedRequest(app, user = null) {
  // Create a default test user if not provided
  const testUser = user || {
    id: uuidv4(),
    address: `0x${uuidv4().replace(/-/g, '').substring(0, 40)}`,
    permissions: ['USER']
  };
  
  // Generate JWT token
  const token = jwt.sign(
    {
      id: testUser.id,
      address: testUser.address,
      permissions: testUser.permissions
    },
    process.env.JWT_SECRET || 'test-jwt-secret',
    { expiresIn: '1h' }
  );
  
  // Return authenticated request
  return supertest(app)
    .set('Authorization', `Bearer ${token}`)
    .set('Content-Type', 'application/json');
}

/**
 * Create an API key authenticated request
 * @param {Object} app Express application instance
 * @param {string} apiKey API key to use for authentication
 * @returns {Object} Supertest request with API key header
 */
function apiKeyRequest(app, apiKey = `api-${uuidv4()}`) {
  return supertest(app)
    .set('X-API-Key', apiKey)
    .set('Content-Type', 'application/json');
}

/**
 * Create a regular unauthenticated request
 * @param {Object} app Express application instance
 * @returns {Object} Supertest request
 */
function publicRequest(app) {
  return supertest(app)
    .set('Content-Type', 'application/json');
}

/**
 * Expect success response with data
 * @param {Object} response Response from supertest
 * @param {number} status Expected status code (default: 200)
 */
function expectSuccess(response, status = 200) {
  expect(response.status).toBe(status);
  expect(response.body).toBeTruthy();
}

/**
 * Expect error response
 * @param {Object} response Response from supertest
 * @param {number} status Expected status code
 * @param {string} errorCode Expected error code
 */
function expectError(response, status, errorCode) {
  expect(response.status).toBe(status);
  expect(response.body.error).toBeDefined();
  expect(response.body.error.code).toBe(errorCode);
}

/**
 * Create a test server instance
 * @returns {Promise<Object>} Express application instance
 */
async function createTestServer() {
  // Use dynamic import to load app
  const app = require('../src/index').default;
  
  // Return Express app
  return app;
}

module.exports = {
  authenticatedRequest,
  apiKeyRequest,
  publicRequest,
  expectSuccess,
  expectError,
  createTestServer
};