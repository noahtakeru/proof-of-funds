# Test Utilities Usage Guide

This document provides guidance on how to use the test utilities package in the Proof of Funds platform.

## Testing Patterns

### 1. Real Database Testing

The test utilities package is designed to work with a real test database rather than mocks. This ensures that your tests accurately reflect how the code will behave in production.

```typescript
import { setupTestDatabase, cleanupTestDatabase, prismaTest } from '@proof-of-funds/test-utils';

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await cleanupTestDatabase();
  await prismaTest.$disconnect();
});
```

### 2. Data Fixtures

Use the provided fixtures to create consistent test data:

```typescript
import { userFixtures, proofFixtures } from '@proof-of-funds/test-utils';

// Standard fixtures
const user = userFixtures.defaultUser;
const proof = proofFixtures.standardProof;

// Generate multiple random users
const users = userFixtures.generateUsers(5);
```

### 3. Database Helpers

Create test entities with the provided helper functions:

```typescript
import { createTestUser, createTestWallet, createTestProof } from '@proof-of-funds/test-utils';

// Create a test user
const user = await createTestUser();

// Create a wallet for the user
const wallet = await createTestWallet(user.id);

// Create a temporary wallet
const tempWallet = await createTestWallet(user.id, { 
  type: 'TEMPORARY' 
});

// Create a proof
const proof = await createTestProof(user.id, tempWallet.id);

// Create complete test user with wallet and proof
const { user, wallet, proof } = await createCompleteTestUser();
```

### 4. API Testing

Test API endpoints with authentication:

```typescript
import { authenticatedRequest, expectApiError } from '@proof-of-funds/test-utils';
import app from '../your-app';

// Test with user authentication
const response = await authenticatedRequest(app)
  .get('/api/user/profile');

expect(response.status).toBe(200);

// Test error responses
const badResponse = await authenticatedRequest(app)
  .post('/api/proof')
  .send({ /* invalid data */ });

expectApiError(badResponse, 400, 'VALIDATION_ERROR');
```

### 5. ZK Proof Testing

Test zero-knowledge proof generation and verification:

```typescript
import { generateTestProof, verifyTestProof } from '@proof-of-funds/test-utils';

// Generate a proof
const { proof, publicSignals } = await generateTestProof('standard', {
  balance: "2000000000000000000", // 2 ETH
  threshold: "1000000000000000000", // 1 ETH
  userAddress: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
});

// Verify the proof
const isValid = await verifyTestProof('standard', proof, publicSignals);
expect(isValid).toBe(true);
```

## Best Practices

1. **Cleanup After Tests**: Always clean up the database after your tests using `cleanupTestDatabase()` to avoid test data affecting other tests.

2. **Isolated Test Environments**: Use `setupTestEnvironment()` to create isolated test environments for each test suite.

3. **Real Data, Not Mocks**: Prefer using real database connections and data over mocks to ensure tests reflect actual behavior.

4. **Transaction Wrapping**: For complex tests with multiple database operations, consider wrapping them in transactions to ensure atomicity.

5. **Test Both Success and Failure Cases**: Test both the happy path and error cases to ensure robust error handling.

## Troubleshooting

### Connection Issues

If you encounter database connection issues, verify:

1. The test database is running and accessible
2. Environment variables are correctly set in `.env` files
3. The database URL is properly encoded for special characters in passwords

### Test Failures

For unexpected test failures:

1. Check if database schema changes require migrations
2. Ensure database cleanup runs after each test suite
3. Verify that test fixtures match the current database schema