/**
 * Utility Tests
 * 
 * Tests for the utility functions
 */
import { v4 as uuidv4 } from 'uuid';
import { randomAddress } from '../fixtures/users';

describe('Utility Functions', () => {
  it('should generate a random Ethereum address', () => {
    const address = randomAddress();
    
    // Ethereum addresses should start with 0x and be 42 characters long (including 0x)
    expect(address).toMatch(/^0x[0-9a-f]{40}$/i);
    
    // Generating multiple addresses should yield different results
    const address2 = randomAddress();
    expect(address).not.toEqual(address2);
  });
  
  it('should generate valid UUIDs', () => {
    const id = uuidv4();
    
    // UUID v4 format regex
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidRegex);
    
    // Generating multiple UUIDs should yield different results
    const id2 = uuidv4();
    expect(id).not.toEqual(id2);
  });
});