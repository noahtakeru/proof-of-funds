/**
 * Custom Jest TypeScript declarations
 */
declare namespace jest {
  interface Matchers<R> {
    /**
     * Check if a string is a valid JWT token
     */
    toBeValidJWT(): R;
    
    /**
     * Check if a string is a valid database ID (UUID)
     */
    toBeValidDatabaseId(): R;
  }
}