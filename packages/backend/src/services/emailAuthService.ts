/**
 * Email Authentication Service
 * 
 * This service handles email-based user authentication,
 * including registration, login, and password management.
 */

import { prisma } from '@proof-of-funds/db';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { 
  hashPassword, 
  verifyPassword, 
  validatePassword,
  generatePasswordResetToken,
  hashToken
} from '../utils/passwordUtils';
import { generateTokenPair } from '../services/jwtService';
import { sendVerificationEmail } from './emailVerificationService';
import { sendEmail } from '../utils/emailSender';
import { auditLogService } from './auditLogService';
import { AuditEventType, ActorType, AuditAction, AuditStatus, AuditSeverity } from '../models/auditLog';

/**
 * Register a new user with email and password
 * 
 * @param email - User's email address
 * @param password - User's password
 * @param baseUrl - Base URL for verification email
 * @returns Object with user ID and success status
 */
export async function registerWithEmail(
  email: string,
  password: string,
  baseUrl: string
): Promise<{ userId: string | null; success: boolean; message: string }> {
  try {
    // Validate email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { 
        userId: null, 
        success: false, 
        message: 'Invalid email format' 
      };
    }
    
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      // Don't reveal if email exists for security
      return { 
        userId: null, 
        success: false, 
        message: 'Registration failed. Please try again.' 
      };
    }
    
    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return { 
        userId: null, 
        success: false, 
        message: passwordValidation.message || 'Invalid password' 
      };
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Create new user
    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        email,
        passwordHash,
        emailVerified: false,
        permissions: ['USER'],
        settings: {}
      }
    });
    
    // Send verification email
    try {
      const emailSent = await sendVerificationEmail(user.id, email, baseUrl);
      logger.info('Verification email sending attempted', {
        userId: user.id,
        email,
        emailSent,
        baseUrl
      });
    } catch (emailError) {
      logger.error('Failed to send verification email during registration', {
        userId: user.id,
        email,
        error: emailError.message,
        stack: emailError.stack
      });
      // Don't fail registration if email fails, but log it
    }
    
    // Log user creation
    await auditLogService.log({
      eventType: AuditEventType.USER_REGISTRATION,
      actorId: user.id,
      actorType: ActorType.USER,
      action: AuditAction.CREATE,
      status: AuditStatus.SUCCESS,
      details: {
        email,
        registrationType: 'email',
        verificationEmailSent: true
      },
      severity: AuditSeverity.INFO
    });
    
    logger.info('User registered with email', {
      userId: user.id,
      email,
      registeredWith: 'email'
    });
    
    return { 
      userId: user.id, 
      success: true, 
      message: 'Registration successful. Please check your email to verify your account.' 
    };
  } catch (error) {
    // Log error
    logger.error('User registration failed', {
      email,
      error: error instanceof Error ? error.message : String(error)
    });
    
    await auditLogService.log({
      eventType: AuditEventType.USER_REGISTRATION,
      actorType: ActorType.ANONYMOUS,
      action: AuditAction.CREATE,
      status: AuditStatus.FAILURE,
      details: {
        email,
        registrationType: 'email',
        error: error instanceof Error ? error.message : String(error)
      },
      severity: AuditSeverity.ERROR
    });
    
    return { 
      userId: null, 
      success: false, 
      message: 'Registration failed. Please try again later.' 
    };
  }
}

/**
 * Login with email and password
 * 
 * @param email - User's email address
 * @param password - User's password
 * @returns Object with authentication tokens and user data if successful
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<{
  success: boolean;
  tokens?: { accessToken: string; refreshToken: string };
  user?: { id: string; email: string; permissions: string[] };
  message: string;
}> {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    // Check if user exists
    if (!user || !user.passwordHash) {
      // Don't reveal if email exists for security
      await auditLogService.log({
        eventType: AuditEventType.AUTH_LOGIN,
        actorType: ActorType.ANONYMOUS,
        action: AuditAction.LOGIN,
        status: AuditStatus.FAILURE,
        details: {
          email,
          reason: 'User not found or no password set',
          loginType: 'email'
        },
        severity: AuditSeverity.WARNING
      });
      
      return { 
        success: false, 
        message: 'Invalid email or password' 
      };
    }
    
    // Check if user is active
    if (!user.isActive) {
      await auditLogService.log({
        eventType: AuditEventType.AUTH_LOGIN,
        actorId: user.id,
        actorType: ActorType.USER,
        action: AuditAction.LOGIN,
        status: AuditStatus.FAILURE,
        details: {
          email,
          reason: 'Account inactive',
          loginType: 'email'
        },
        severity: AuditSeverity.WARNING
      });
      
      return { 
        success: false, 
        message: 'Account is inactive. Please contact support.' 
      };
    }
    
    // Check if email is verified (required for login)
    if (!user.emailVerified) {
      await auditLogService.log({
        eventType: AuditEventType.AUTH_LOGIN,
        actorId: user.id,
        actorType: ActorType.USER,
        action: AuditAction.LOGIN,
        status: AuditStatus.FAILURE,
        details: {
          email,
          reason: 'Email not verified',
          loginType: 'email'
        },
        severity: AuditSeverity.WARNING
      });
      
      return { 
        success: false, 
        message: 'Email not verified. Please check your email for the verification link or request a new one.' 
      };
    }
    
    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      await auditLogService.log({
        eventType: AuditEventType.AUTH_LOGIN,
        actorId: user.id,
        actorType: ActorType.USER,
        action: AuditAction.LOGIN,
        status: AuditStatus.FAILURE,
        details: {
          email,
          reason: 'Invalid password',
          loginType: 'email'
        },
        severity: AuditSeverity.WARNING
      });
      
      return { 
        success: false, 
        message: 'Invalid email or password' 
      };
    }
    
    // Generate authentication tokens
    const tokens = await generateTokenPair({
      userId: user.id,
      email: user.email,
      permissions: user.permissions
    });
    
    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });
    
    // Log successful login
    await auditLogService.log({
      eventType: AuditEventType.AUTH_LOGIN,
      actorId: user.id,
      actorType: ActorType.USER,
      action: AuditAction.LOGIN,
      status: AuditStatus.SUCCESS,
      details: {
        email,
        loginType: 'email'
      },
      severity: AuditSeverity.INFO
    });
    
    logger.info('User logged in with email', {
      userId: user.id,
      email,
      loginMethod: 'email'
    });
    
    return {
      success: true,
      tokens,
      user: {
        id: user.id,
        email: user.email || '',
        permissions: user.permissions
      },
      message: 'Login successful'
    };
  } catch (error) {
    // Log error
    logger.error('Login failed', {
      email,
      error: error instanceof Error ? error.message : String(error)
    });
    
    await auditLogService.log({
      eventType: AuditEventType.AUTH_LOGIN,
      actorType: ActorType.ANONYMOUS,
      action: AuditAction.LOGIN,
      status: AuditStatus.FAILURE,
      details: {
        email,
        reason: 'System error',
        error: error instanceof Error ? error.message : String(error),
        loginType: 'email'
      },
      severity: AuditSeverity.ERROR
    });
    
    return { 
      success: false, 
      message: 'Login failed. Please try again later.' 
    };
  }
}

/**
 * Initiate password reset process
 * 
 * @param email - User's email address
 * @param baseUrl - Base URL for reset email
 * @returns Success status
 */
export async function requestPasswordReset(
  email: string,
  baseUrl: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    // For security, don't reveal if email exists
    if (!user || !user.isActive) {
      // Still log the attempt
      logger.info('Password reset requested for non-existent or inactive user', {
        email
      });
      
      // Return success anyway to prevent email enumeration
      return {
        success: true,
        message: 'If your email is registered, you will receive a password reset link shortly.'
      };
    }
    
    // Generate password reset token
    const { token, expires } = generatePasswordResetToken();
    const hashedToken = hashToken(token);
    
    // Update user with reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: hashedToken, // Reuse the same field for password reset
        tokenExpiry: expires
      }
    });
    
    // Create reset URL
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    
    // Send reset email
    await sendEmail({
      to: email,
      subject: 'Password Reset Request',
      text: `You requested a password reset. Please click the following link to reset your password: ${resetUrl}. This link will expire in 24 hours.`,
      html: `
        <h1>Password Reset</h1>
        <p>You requested a password reset for your Proof of Funds account.</p>
        <p>Please click the button below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>Or copy and paste this link into your browser:</p>
        <p>${resetUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <p>If you did not request this password reset, please ignore this email or contact support.</p>
      `
    });
    
    // Log reset request
    await auditLogService.log({
      eventType: AuditEventType.PASSWORD_RESET,
      actorId: user.id,
      actorType: ActorType.USER,
      action: AuditAction.REQUEST,
      status: AuditStatus.SUCCESS,
      details: {
        email,
        resetTokenSent: true,
        tokenExpiry: expires
      },
      severity: AuditSeverity.INFO
    });
    
    logger.info('Password reset requested', {
      userId: user.id,
      email
    });
    
    return {
      success: true,
      message: 'If your email is registered, you will receive a password reset link shortly.'
    };
  } catch (error) {
    // Log error
    logger.error('Password reset request failed', {
      email,
      error: error instanceof Error ? error.message : String(error)
    });
    
    await auditLogService.log({
      eventType: AuditEventType.PASSWORD_RESET,
      actorType: ActorType.ANONYMOUS,
      action: AuditAction.REQUEST,
      status: AuditStatus.FAILURE,
      details: {
        email,
        error: error instanceof Error ? error.message : String(error)
      },
      severity: AuditSeverity.ERROR
    });
    
    return {
      success: false,
      message: 'Unable to process password reset request. Please try again later.'
    };
  }
}

/**
 * Reset password using reset token
 * 
 * @param token - Password reset token
 * @param newPassword - New password
 * @returns Success status
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return {
        success: false,
        message: passwordValidation.message || 'Invalid password'
      };
    }
    
    // Hash the token for comparison
    const hashedToken = hashToken(token);
    
    // Find user with matching token that hasn't expired
    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: hashedToken,
        tokenExpiry: {
          gt: new Date() // Token must not be expired
        }
      }
    });
    
    // Check if token is valid
    if (!user) {
      logger.warn('Invalid or expired password reset token', {
        tokenValid: false
      });
      
      return {
        success: false,
        message: 'Invalid or expired password reset token. Please request a new one.'
      };
    }
    
    // Hash new password
    const passwordHash = await hashPassword(newPassword);
    
    // Update user with new password and clear token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        emailVerifyToken: null,
        tokenExpiry: null
      }
    });
    
    // Log password reset
    await auditLogService.log({
      eventType: AuditEventType.PASSWORD_RESET,
      actorId: user.id,
      actorType: ActorType.USER,
      action: AuditAction.UPDATE,
      status: AuditStatus.SUCCESS,
      details: {
        email: user.email,
        passwordReset: true
      },
      severity: AuditSeverity.INFO
    });
    
    logger.info('Password reset successfully', {
      userId: user.id,
      email: user.email
    });
    
    return {
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.'
    };
  } catch (error) {
    // Log error
    logger.error('Password reset failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    await auditLogService.log({
      eventType: AuditEventType.PASSWORD_RESET,
      actorType: ActorType.ANONYMOUS,
      action: AuditAction.UPDATE,
      status: AuditStatus.FAILURE,
      details: {
        error: error instanceof Error ? error.message : String(error)
      },
      severity: AuditSeverity.ERROR
    });
    
    return {
      success: false,
      message: 'Password reset failed. Please try again later.'
    };
  }
}

/**
 * Change password for authenticated user
 * 
 * @param userId - User ID
 * @param currentPassword - Current password
 * @param newPassword - New password
 * @returns Success status
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    // Check if user exists and has password
    if (!user || !user.passwordHash) {
      return {
        success: false,
        message: 'User not found or no password set'
      };
    }
    
    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      await auditLogService.log({
        eventType: AuditEventType.PASSWORD_CHANGE,
        actorId: userId,
        actorType: ActorType.USER,
        action: AuditAction.UPDATE,
        status: AuditStatus.FAILURE,
        details: {
          reason: 'Current password invalid'
        },
        severity: AuditSeverity.WARNING
      });
      
      return {
        success: false,
        message: 'Current password is incorrect'
      };
    }
    
    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return {
        success: false,
        message: passwordValidation.message || 'Invalid new password'
      };
    }
    
    // Hash new password
    const passwordHash = await hashPassword(newPassword);
    
    // Update user with new password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });
    
    // Log password change
    await auditLogService.log({
      eventType: AuditEventType.PASSWORD_CHANGE,
      actorId: userId,
      actorType: ActorType.USER,
      action: AuditAction.UPDATE,
      status: AuditStatus.SUCCESS,
      details: {
        passwordChanged: true
      },
      severity: AuditSeverity.INFO
    });
    
    logger.info('Password changed successfully', {
      userId
    });
    
    return {
      success: true,
      message: 'Password changed successfully'
    };
  } catch (error) {
    // Log error
    logger.error('Password change failed', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    await auditLogService.log({
      eventType: AuditEventType.PASSWORD_CHANGE,
      actorId: userId,
      actorType: ActorType.USER,
      action: AuditAction.UPDATE,
      status: AuditStatus.FAILURE,
      details: {
        error: error instanceof Error ? error.message : String(error)
      },
      severity: AuditSeverity.ERROR
    });
    
    return {
      success: false,
      message: 'Password change failed. Please try again later.'
    };
  }
}