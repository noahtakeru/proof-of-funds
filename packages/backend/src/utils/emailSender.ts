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
  // Use SMTP configuration in production
  if (process.env.NODE_ENV === 'production') {
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
  
  // Use ethereal.email for development/testing
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: config.email.testUser || 'test@ethereal.email',
      pass: config.email.testPassword || 'testpassword'
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