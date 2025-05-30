/**
 * Basic Test Utils Test
 * 
 * Simple test to verify that the test infrastructure is working
 */

describe('Test Utils Basic Test', () => {
  it('should pass a simple assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should be able to work with strings', () => {
    expect('hello').toContain('ell');
  });
});