/**
 * Email Verification Service
 * 
 * This service handles verification tokens for email addresses
 * and integrates with the authentication system.
 */

import { prisma } from '@proof-of-funds/db';
import { generateEmailVerificationToken, hashToken } from '../utils/passwordUtils';
import { sendEmail } from '../utils/emailSender'; // We'll implement this later
import logger from '../utils/logger';

/**
 * Generate a verification token for a user's email
 * 
 * @param userId - User ID to generate token for
 * @param email - Email address to verify
 * @returns The verification token
 */
export async function generateVerificationToken(
  userId: string,
  email: string
): Promise<string> {
  // Generate token with 24-hour expiry
  const { token, expires } = generateEmailVerificationToken();
  
  // Hash the token for storage
  const hashedToken = hashToken(token);
  
  // Update user record with token and expiry
  await prisma.user.update({
    where: { id: userId },
    data: {
      email,
      emailVerified: false,
      emailVerifyToken: hashedToken,
      tokenExpiry: expires
    }
  });
  
  // Log token generation (without exposing the token)
  logger.info('Email verification token generated', {
    userId,
    email,
    expires,
    tokenGenerated: true
  });
  
  return token;
}

/**
 * Send a verification email to the user
 * 
 * @param userId - User ID
 * @param email - Email address to send to
 * @param baseUrl - Base URL for the verification link
 * @returns Success status
 */
export async function sendVerificationEmail(
  userId: string,
  email: string,
  baseUrl: string
): Promise<boolean> {
  try {
    // Generate verification token
    const token = await generateVerificationToken(userId, email);
    
    // Create verification URL
    const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
    
    // Send email with the verification link
    await sendEmail({
      to: email,
      subject: 'Verify your email address',
      text: `Please verify your email address by clicking the following link: ${verificationUrl}`,
      html: `
        <h1>Email Verification</h1>
        <p>Thank you for registering with Proof of Funds!</p>
        <p>Please verify your email address by clicking the button below:</p>
        <a href="${verificationUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
        <p>Or copy and paste this link into your browser:</p>
        <p>${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
      `
    });
    
    // Log email sent
    logger.info('Verification email sent', {
      userId,
      email,
      emailSent: true
    });
    
    return true;
  } catch (error) {
    // Log error
    logger.error('Failed to send verification email', {
      userId,
      email,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return false;
  }
}

/**
 * Verify a user's email with a verification token
 * 
 * @param token - The verification token
 * @returns User ID if verified successfully, null otherwise
 */
export async function verifyEmail(token: string): Promise<string | null> {
  try {
    // Hash the token for comparison
    const hashedToken = hashToken(token);
    
    // Find user with matching token
    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: hashedToken,
        tokenExpiry: {
          gt: new Date() // Token must not be expired
        }
      }
    });
    
    // If no user found or token expired
    if (!user) {
      logger.warn('Invalid or expired verification token', {
        tokenValid: false
      });
      return null;
    }
    
    // Mark email as verified and clear token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        tokenExpiry: null
      }
    });
    
    // Log successful verification
    logger.info('Email verified successfully', {
      userId: user.id,
      email: user.email,
      verified: true
    });
    
    return user.id;
  } catch (error) {
    // Log error
    logger.error('Email verification failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return null;
  }
}

/**
 * Resend verification email for a user
 * 
 * @param userId - User ID
 * @param baseUrl - Base URL for the verification link
 * @returns Success status
 */
export async function resendVerificationEmail(
  userId: string,
  baseUrl: string
): Promise<boolean> {
  try {
    // Get user record
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    // Check if user exists and has an email
    if (!user || !user.email) {
      logger.error('Cannot resend verification email - user or email missing', {
        userId
      });
      return false;
    }
    
    // Check if email is already verified
    if (user.emailVerified) {
      logger.info('Email already verified', {
        userId,
        email: user.email
      });
      return true;
    }
    
    // Send verification email
    return await sendVerificationEmail(userId, user.email, baseUrl);
  } catch (error) {
    // Log error
    logger.error('Failed to resend verification email', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return false;
  }
}