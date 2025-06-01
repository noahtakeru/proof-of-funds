/**
 * User Preferences Service
 * 
 * This service handles user preferences storage and retrieval.
 */

import { prisma } from '@proof-of-funds/db';
import logger from '../utils/logger';
import { auditLogService } from './auditLogService';
import { AuditEventType, ActorType, AuditAction, AuditStatus, AuditSeverity } from '../models/auditLog';

// Default user preferences
const DEFAULT_PREFERENCES = {
  notifications: {
    email: true,
    push: false,
    sms: false
  },
  ui: {
    theme: 'light',
    language: 'en',
    compactView: false,
    dashboardLayout: 'default'
  },
  defaultNetwork: 1, // Ethereum mainnet
  privacy: {
    showWalletBalance: false,
    allowDataCollection: true
  }
};

/**
 * Get user preferences
 * 
 * @param userId - User ID
 * @returns User preferences
 */
export async function getUserPreferences(userId: string): Promise<any> {
  try {
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true }
    });
    
    if (!user) {
      logger.warn('User not found when getting preferences', { userId });
      return DEFAULT_PREFERENCES;
    }
    
    // Parse settings
    const settings = typeof user.settings === 'string' 
      ? JSON.parse(user.settings as string) 
      : user.settings;
    
    // Get preferences or use defaults
    const preferences = settings.preferences || DEFAULT_PREFERENCES;
    
    // Log preferences access
    logger.debug('User preferences retrieved', { userId });
    
    return preferences;
  } catch (error) {
    logger.error('Failed to get user preferences', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Return default preferences on error
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Update user preferences
 * 
 * @param userId - User ID
 * @param preferences - New preferences (partial update)
 * @returns Updated preferences
 */
export async function updateUserPreferences(
  userId: string,
  preferences: any
): Promise<any> {
  try {
    // Input validation
    if (!preferences || typeof preferences !== 'object') {
      throw new Error('Invalid preferences format');
    }
    
    // Get current user settings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true }
    });
    
    if (!user) {
      logger.warn('User not found when updating preferences', { userId });
      throw new Error('User not found');
    }
    
    // Parse settings
    const settings = typeof user.settings === 'string' 
      ? JSON.parse(user.settings as string) 
      : user.settings;
    
    // Get current preferences
    const currentPreferences = settings.preferences || DEFAULT_PREFERENCES;
    
    // Perform deep merge of preferences
    const updatedPreferences = deepMerge(currentPreferences, preferences);
    
    // Update settings with new preferences
    settings.preferences = updatedPreferences;
    
    // Update user in database
    await prisma.user.update({
      where: { id: userId },
      data: { settings }
    });
    
    // Audit log the preference update
    await auditLogService.log({
      eventType: AuditEventType.USER_UPDATE,
      actorId: userId,
      actorType: ActorType.USER,
      action: AuditAction.UPDATE,
      resourceType: 'user',
      resourceId: userId,
      status: AuditStatus.SUCCESS,
      details: {
        preferencesUpdated: true,
        fields: Object.keys(preferences)
      },
      severity: AuditSeverity.INFO
    });
    
    logger.info('User preferences updated', {
      userId,
      fields: Object.keys(preferences)
    });
    
    return updatedPreferences;
  } catch (error) {
    logger.error('Failed to update user preferences', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Audit log the failure
    await auditLogService.log({
      eventType: AuditEventType.USER_UPDATE,
      actorId: userId,
      actorType: ActorType.USER,
      action: AuditAction.UPDATE,
      resourceType: 'user',
      resourceId: userId,
      status: AuditStatus.FAILURE,
      details: {
        preferencesUpdated: false,
        error: error instanceof Error ? error.message : String(error)
      },
      severity: AuditSeverity.WARNING
    });
    
    throw error;
  }
}

/**
 * Reset user preferences to defaults
 * 
 * @param userId - User ID
 * @returns Default preferences
 */
export async function resetUserPreferences(userId: string): Promise<any> {
  try {
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true }
    });
    
    if (!user) {
      logger.warn('User not found when resetting preferences', { userId });
      throw new Error('User not found');
    }
    
    // Parse settings
    const settings = typeof user.settings === 'string' 
      ? JSON.parse(user.settings as string) 
      : user.settings;
    
    // Reset preferences to defaults
    settings.preferences = DEFAULT_PREFERENCES;
    
    // Update user in database
    await prisma.user.update({
      where: { id: userId },
      data: { settings }
    });
    
    // Audit log the preference reset
    await auditLogService.log({
      eventType: AuditEventType.USER_UPDATE,
      actorId: userId,
      actorType: ActorType.USER,
      action: AuditAction.UPDATE,
      resourceType: 'user',
      resourceId: userId,
      status: AuditStatus.SUCCESS,
      details: {
        preferencesReset: true
      },
      severity: AuditSeverity.INFO
    });
    
    logger.info('User preferences reset to defaults', { userId });
    
    return DEFAULT_PREFERENCES;
  } catch (error) {
    logger.error('Failed to reset user preferences', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Audit log the failure
    await auditLogService.log({
      eventType: AuditEventType.USER_UPDATE,
      actorId: userId,
      actorType: ActorType.USER,
      action: AuditAction.UPDATE,
      resourceType: 'user',
      resourceId: userId,
      status: AuditStatus.FAILURE,
      details: {
        preferencesReset: false,
        error: error instanceof Error ? error.message : String(error)
      },
      severity: AuditSeverity.WARNING
    });
    
    throw error;
  }
}

/**
 * Deep merge two objects
 * 
 * @param target - Target object
 * @param source - Source object
 * @returns Merged object
 */
function deepMerge(target: any, source: any): any {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

/**
 * Check if value is an object
 * 
 * @param item - Value to check
 * @returns True if object
 */
function isObject(item: any): boolean {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

export const userPreferencesService = {
  getUserPreferences,
  updateUserPreferences,
  resetUserPreferences
};

export default userPreferencesService;