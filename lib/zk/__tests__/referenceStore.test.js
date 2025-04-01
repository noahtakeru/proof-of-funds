// Test suite for reference store functionality
import {
  storeReferenceId,
  getReference,
  listReferences,
  deleteReference
} from '../referenceStore';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

// Apply localStorage mock
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('Reference Store Utilities', () => {
  beforeEach(() => {
    // Clear localStorage and reset mocks before each test
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  test('stores and retrieves reference IDs correctly', () => {
    const refId = 'ABCD1234';
    const metadata = {
      walletAddress: '0x1234567890abcdef',
      proofType: 'balance',
      encryptedProof: 'encrypted-data-string',
      accessKeyHash: 'hashed-access-key',
      expiresAt: Date.now() + 86400000 // 1 day from now
    };

    // Store the reference
    const storeResult = storeReferenceId(refId, metadata);
    expect(storeResult).toBe(true);
    
    // Verify localStorage was called
    expect(localStorageMock.setItem).toHaveBeenCalled();
    
    // Get the reference
    const retrievedRef = getReference(refId);
    expect(retrievedRef).toEqual({
      ...metadata,
      createdAt: expect.any(Number)
    });
  });

  test('prevents duplicate reference IDs', () => {
    const refId = 'EFGH5678';
    const metadata1 = { proofType: 'balance', data: 'test1' };
    const metadata2 = { proofType: 'threshold', data: 'test2' };

    // Store the first reference
    const storeResult1 = storeReferenceId(refId, metadata1);
    expect(storeResult1).toBe(true);
    
    // Try to store a duplicate reference
    const storeResult2 = storeReferenceId(refId, metadata2);
    expect(storeResult2).toBe(false);
    
    // Verify the original data wasn't overwritten
    const retrievedRef = getReference(refId);
    expect(retrievedRef.proofType).toBe('balance');
    expect(retrievedRef.data).toBe('test1');
  });

  test('lists all references', () => {
    // Store multiple references
    storeReferenceId('REF1', { proofType: 'balance', data: 'test1' });
    storeReferenceId('REF2', { proofType: 'threshold', data: 'test2' });
    storeReferenceId('REF3', { proofType: 'maximum', data: 'test3' });
    
    // List all references
    const allRefs = listReferences();
    
    // Verify we get all references
    expect(allRefs.length).toBe(3);
    
    // Verify structure of returned references
    expect(allRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ referenceId: 'REF1', proofType: 'balance' }),
      expect.objectContaining({ referenceId: 'REF2', proofType: 'threshold' }),
      expect.objectContaining({ referenceId: 'REF3', proofType: 'maximum' })
    ]));
  });

  test('deletes references correctly', () => {
    // Store a reference
    const refId = 'TODELETE';
    storeReferenceId(refId, { proofType: 'balance', data: 'test' });
    
    // Verify it exists
    expect(getReference(refId)).toBeTruthy();
    
    // Delete the reference
    const deleteResult = deleteReference(refId);
    expect(deleteResult).toBe(true);
    
    // Verify it was deleted
    expect(getReference(refId)).toBeNull();
    
    // Verify localStorage was updated
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(2); // Once for store, once for delete
  });

  test('handles localStorage errors gracefully', () => {
    // Mock localStorage.getItem to throw an error
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('localStorage error');
    });
    
    // Operations should not throw but return null/empty/false
    expect(getReference('ANY')).toBeNull();
    expect(listReferences()).toEqual([]);
    expect(deleteReference('ANY')).toBe(false);
  });
});