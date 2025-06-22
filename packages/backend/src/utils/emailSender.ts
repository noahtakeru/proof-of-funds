/**
 * Email Sender Utility
 * 
 * This module provides functionality for sending emails
 * using configurable transport mechanisms.
 */

import nodemailer from 'nodemailer';
import logger from './logger';
import config from '../config';

// Email options interface
export interface EmailOptions {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

// Get transporter based on environment
function getTransporter() {
  // Use SMTP configuration if credentials are provided
  if (config.email.user && config.email.password) {
    return nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.password
      }
    });
  }
  
  // Use test email for development if no production config
  if (config.email.testUser && config.email.testPassword) {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: config.email.testUser,
        pass: config.email.testPassword
      }
    });
  }
  
  // Fallback: create test account or use mock transporter for tests
  if (process.env.NODE_ENV === 'test') {
    return nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true
    });
  }
  
  // Fallback to ethereal with default test account
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: 'test@ethereal.email',
      pass: 'testpassword'
    }
  });
}

/**
 * Send an email
 * 
 * @param options - Email sending options
 * @returns Promise resolving to success status
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const {
      to,
      subject,
      text,
      html,
      from = config.email.defaultFrom,
      replyTo = config.email.defaultReplyTo,
      attachments = []
    } = options;
    
    // Get appropriate transporter
    const transporter = getTransporter();
    
    // Send email
    const info = await transporter.sendMail({
      from,
      to,
      replyTo,
      subject,
      text,
      html,
      attachments
    });
    
    // Log success
    logger.info('Email sent successfully', {
      messageId: info.messageId,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject
    });
    
    // In development, log the preview URL
    if (process.env.NODE_ENV !== 'production' && info.messageId) {
      logger.info(`Email preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
    
    return true;
  } catch (error) {
    // Log error
    logger.error('Failed to send email', {
      to: options.to,
      subject: options.subject,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return false;
  }
}