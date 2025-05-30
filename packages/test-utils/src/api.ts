/**
 * API Testing Utilities
 * 
 * Provides tools for API testing with supertest
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a test request with authentication
 * 
 * @param app Express application
 * @param userId User ID for authentication
 * @param permissions User permissions
 * @returns Supertest request with authentication headers
 */
export function authenticatedRequest(
  app: any,
  userId: string = uuidv4(),
  permissions: string[] = ['USER'],
  address: string = `0x${uuidv4().replace(/-/g, '')}`
) {
  // Generate a test JWT token
  const token = jwt.sign(
    {
      id: userId,
      address,
      permissions
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
  
  // Create a supertest request with authorization header
  return request(app).set('Authorization', `Bearer ${token}`);
}

/**
 * Create a test request with API key authentication
 * 
 * @param app Express application
 * @param apiKey API key for authentication
 * @returns Supertest request with API key header
 */
export function apiKeyRequest(
  app: any,
  apiKey: string = `api-${uuidv4()}`
) {
  // Create a supertest request with API key header
  return request(app).set('X-API-Key', apiKey);
}

/**
 * Helper to test pagination
 * 
 * @param path API path to test
 * @param authenticatedReq Authenticated request
 */
export async function testPagination(
  path: string,
  authenticatedReq: request.SuperTest<request.Test>
): Promise<void> {
  // Test page 1 with default limit
  const page1 = await authenticatedReq.get(`${path}?page=1`);
  expect(page1.status).toBe(200);
  expect(page1.body.pagination).toBeDefined();
  expect(page1.body.pagination.page).toBe(1);
  
  // Test page 2 with custom limit
  const page2 = await authenticatedReq.get(`${path}?page=2&limit=5`);
  expect(page2.status).toBe(200);
  expect(page2.body.pagination).toBeDefined();
  expect(page2.body.pagination.page).toBe(2);
  expect(page2.body.pagination.limit).toBe(5);
}

/**
 * Helper to test API error responses
 * 
 * @param response API response
 * @param status Expected status code
 * @param errorCode Expected error code
 */
export function expectApiError(
  response: request.Response,
  status: number,
  errorCode: string
): void {
  expect(response.status).toBe(status);
  expect(response.body.error).toBeDefined();
  expect(response.body.error.code).toBe(errorCode);
}

/**
 * Helper to test validation errors
 * 
 * @param response API response
 * @param fieldName Expected field with validation error
 */
export function expectValidationError(
  response: request.Response,
  fieldName?: string
): void {
  expect(response.status).toBe(400);
  expect(response.body.error).toBeDefined();
  expect(response.body.error.code).toBe('VALIDATION_ERROR');
  
  if (fieldName) {
    expect(response.body.error.details).toBeDefined();
    expect(response.body.error.details.errors).toBeDefined();
    expect(response.body.error.details.errors.some((e: any) => e.field === fieldName)).toBe(true);
  }
}