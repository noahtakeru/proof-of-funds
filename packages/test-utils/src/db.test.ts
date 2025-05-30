/**
 * Database Utilities Tests
 * 
 * Tests for the database testing utilities
 */
import { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  createTestUser, 
  createTestWallet,
  createTestProof,
  createTestOrganization,
  prismaTest
} from './db';

describe('Database Test Utilities', () => {
  // Setup test environment
  beforeAll(async () => {
    await setupTestDatabase();
  });
  
  // Clean up after tests
  afterAll(async () => {
    await cleanupTestDatabase();
    await prismaTest.$disconnect();
  });
  
  it('should successfully connect to test database', async () => {
    // Simple query to verify connection
    const result = await prismaTest.$queryRaw`SELECT 1 as test`;
    expect(result).toEqual([{ test: 1 }]);
  });
  
  it('should create a test user', async () => {
    // Create a test user
    const user = await createTestUser();
    
    // Verify user was created
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.address).toBeDefined();
    expect(user.permissions).toContain('USER');
    
    // Verify user exists in database
    const dbUser = await prismaTest.user.findUnique({
      where: { id: user.id }
    });
    
    expect(dbUser).toBeDefined();
    expect(dbUser?.id).toBe(user.id);
  });
  
  it('should create test wallet for a user', async () => {
    // Create a test user
    const user = await createTestUser();
    
    // Create a test wallet
    const wallet = await createTestWallet(user.id);
    
    // Verify wallet was created
    expect(wallet).toBeDefined();
    expect(wallet.id).toBeDefined();
    expect(wallet.userId).toBe(user.id);
    expect(wallet.address).toBeDefined();
    
    // Verify wallet exists in database
    const dbWallet = await prismaTest.wallet.findUnique({
      where: { id: wallet.id }
    });
    
    expect(dbWallet).toBeDefined();
    expect(dbWallet?.userId).toBe(user.id);
  });
  
  it('should create a test proof', async () => {
    // Create a test user
    const user = await createTestUser();
    
    // Create a test wallet
    const wallet = await createTestWallet(user.id, { type: 'TEMPORARY' });
    
    // Create a test proof
    const proof = await createTestProof(user.id, wallet.id);
    
    // Verify proof was created
    expect(proof).toBeDefined();
    expect(proof.id).toBeDefined();
    expect(proof.userId).toBe(user.id);
    expect(proof.tempWalletId).toBe(wallet.id);
    
    // Verify proof exists in database
    const dbProof = await prismaTest.proof.findUnique({
      where: { id: proof.id }
    });
    
    expect(dbProof).toBeDefined();
    expect(dbProof?.userId).toBe(user.id);
  });
  
  it('should create a test organization', async () => {
    // Create a test organization
    const organization = await createTestOrganization();
    
    // Verify organization was created
    expect(organization).toBeDefined();
    expect(organization.id).toBeDefined();
    expect(organization.name).toBeDefined();
    expect(organization.apiKey).toBeDefined();
    
    // Verify organization exists in database
    const dbOrganization = await prismaTest.organization.findUnique({
      where: { id: organization.id }
    });
    
    expect(dbOrganization).toBeDefined();
    expect(dbOrganization?.name).toBe(organization.name);
  });
});