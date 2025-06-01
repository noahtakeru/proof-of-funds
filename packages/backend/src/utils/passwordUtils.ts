/**
 * Password Hashing Utilities
 * 
 * This module provides secure password hashing and verification
 * using bcrypt with industry-standard security practices.
 */

import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

// Configuration
const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * Hash a password with bcrypt
 * 
 * @param password - The plain text password to hash
 * @returns The hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  // Generate a salt
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  
  // Hash the password with the salt
  return bcrypt.hash(password, salt);
}

/**
 * Compare a plain text password with a hashed password
 * 
 * @param password - The plain text password to check
 * @param hashedPassword - The stored hashed password
 * @returns True if the password matches, false otherwise
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Validate a password against security requirements
 * 
 * @param password - The password to validate
 * @returns Object with validation result and error message
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`
    };
  }
  
  if (!PASSWORD_REGEX.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    };
  }
  
  return { valid: true };
}

/**
 * Generate a secure token for email verification, password reset, etc.
 * 
 * @param length - Length of the token (default: 32)
 * @returns Secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a token for secure storage
 * 
 * @param token - The token to hash
 * @returns Hashed token
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a secure password reset token with expiration
 * 
 * @returns Object with token and expiration timestamp
 */
export function generatePasswordResetToken(): { token: string; expires: Date } {
  const token = generateSecureToken();
  
  // Set expiration to 24 hours from now
  const expires = new Date();
  expires.setHours(expires.getHours() + 24);
  
  return {
    token,
    expires
  };
}

/**
 * Generate a secure email verification token with expiration
 * 
 * @returns Object with token and expiration timestamp
 */
export function generateEmailVerificationToken(): { token: string; expires: Date } {
  const token = generateSecureToken();
  
  // Set expiration to 24 hours from now
  const expires = new Date();
  expires.setHours(expires.getHours() + 24);
  
  return {
    token,
    expires
  };
}