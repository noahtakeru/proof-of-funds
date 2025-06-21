/**
 * User Preferences Hook
 * 
 * Custom hook for accessing and managing user preferences.
 */

import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { UserPreferences } from '../services/userPreferencesService';

/**
 * Interface for user preferences hook return value
 */
export interface UsePreferencesReturn {
  // Preference values
  showWalletBalance: boolean;
  allowDataCollection: boolean;
  defaultNetwork: number;
  
  // Notification settings
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  
  // State
  isLoading: boolean;
  error: string | null;
  
  // Updater functions
  updatePreferences: (newPreferences: Partial<UserPreferences>) => Promise<void>;
  toggleWalletBalanceVisibility: () => Promise<void>;
  toggleDataCollection: () => Promise<void>;
  toggleEmailNotifications: () => Promise<void>;
  togglePushNotifications: () => Promise<void>;
  toggleSmsNotifications: () => Promise<void>;
  setDefaultNetwork: (networkId: number) => Promise<void>;
  resetPreferences: () => Promise<void>;
}

/**
 * Hook for accessing and managing user preferences
 */
export function usePreferences(): UsePreferencesReturn {
  const {
    preferences,
    isLoading,
    error,
    updatePreferences,
    setTheme,
    setLanguage,
    setNotificationPreference,
    setPrivacyPreference,
    setDefaultNetwork,
    resetPreferences
  } = useUserPreferences();
  
  
  /**
   * Toggle wallet balance visibility
   */
  const toggleWalletBalanceVisibility = async () => {
    await setPrivacyPreference('showWalletBalance', !preferences.privacy.showWalletBalance);
  };
  
  /**
   * Toggle data collection
   */
  const toggleDataCollection = async () => {
    await setPrivacyPreference('allowDataCollection', !preferences.privacy.allowDataCollection);
  };
  
  /**
   * Toggle email notifications
   */
  const toggleEmailNotifications = async () => {
    await setNotificationPreference('email', !preferences.notifications.email);
  };
  
  /**
   * Toggle push notifications
   */
  const togglePushNotifications = async () => {
    await setNotificationPreference('push', !preferences.notifications.push);
  };
  
  /**
   * Toggle SMS notifications
   */
  const toggleSmsNotifications = async () => {
    await setNotificationPreference('sms', !preferences.notifications.sms);
  };
  
  return {
    // Preference values
    showWalletBalance: preferences.privacy.showWalletBalance,
    allowDataCollection: preferences.privacy.allowDataCollection,
    defaultNetwork: preferences.defaultNetwork,
    
    // Notification settings
    emailNotifications: preferences.notifications.email,
    pushNotifications: preferences.notifications.push,
    smsNotifications: preferences.notifications.sms,
    
    // State
    isLoading,
    error,
    
    // Updater functions
    updatePreferences,
    toggleWalletBalanceVisibility,
    toggleDataCollection,
    toggleEmailNotifications,
    togglePushNotifications,
    toggleSmsNotifications,
    setDefaultNetwork,
    resetPreferences
  };
}