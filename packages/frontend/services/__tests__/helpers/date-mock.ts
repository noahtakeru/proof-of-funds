/**
 * Date mocking utilities for testing
 */

export function mockDateNow(mockDate: Date): jest.SpyInstance {
  const spy = jest.spyOn(Date, 'now').mockImplementation(() => mockDate.getTime());
  return spy;
}

export function restoreDateNow(spy: jest.SpyInstance): void {
  spy.mockRestore();
}