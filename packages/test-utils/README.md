# Proof of Funds - Test Utilities

This package provides testing utilities for the Proof of Funds platform. It includes tools for testing database interactions, API endpoints, and ZK proofs.

## Installation

```bash
npm install @proof-of-funds/test-utils
```

## Usage

### Database Testing

```typescript
import { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  createTestUser,
  prismaTest 
} from '@proof-of-funds/test-utils';

describe('Database Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  
  afterAll(async () => {
    await cleanupTestDatabase();
    await prismaTest.$disconnect();
  });
  
  it('should create a user', async () => {
    const user = await createTestUser();
    expect(user).toBeDefined();
    // Add more assertions
  });
});
```

### API Testing

```typescript
import { authenticatedRequest, apiKeyRequest } from '@proof-of-funds/test-utils';
import app from '../your-express-app';

describe('API Tests', () => {
  it('should return user data for authenticated users', async () => {
    const response = await authenticatedRequest(app)
      .get('/api/user/profile');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('user');
  });
  
  it('should authenticate with API key', async () => {
    const response = await apiKeyRequest(app, 'valid-api-key')
      .get('/api/data');
    
    expect(response.status).toBe(200);
  });
});
```

### ZK Proof Testing

```typescript
import { generateTestProof, verifyTestProof } from '@proof-of-funds/test-utils';

describe('ZK Proof Tests', () => {
  it('should generate and verify a standard proof', async () => {
    const { proof, publicSignals } = await generateTestProof('standard');
    
    const isValid = await verifyTestProof('standard', proof, publicSignals);
    expect(isValid).toBe(true);
  });
});
```

## Test Fixtures

The package includes test fixtures for users and proofs:

```typescript
import { userFixtures, proofFixtures } from '@proof-of-funds/test-utils';

// Use fixture data
const user = userFixtures.defaultUser;
const proof = proofFixtures.standardProof;
```

## Test Environment Setup

You can set up a complete test environment with database connection and cleanup:

```typescript
import { setupTestEnvironment } from '@proof-of-funds/test-utils';

describe('My Test Suite', () => {
  // Set up environment before tests and clean up after
  setupTestEnvironment();
  
  // Or with custom setup/teardown functions
  setupTestEnvironment(
    async () => {
      // Custom setup
    },
    async () => {
      // Custom teardown
    }
  );
  
  // Your tests...
});
```

## Running Tests

```bash
npm run test           # Run tests with simple config
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage reporting
```

## License

ISC