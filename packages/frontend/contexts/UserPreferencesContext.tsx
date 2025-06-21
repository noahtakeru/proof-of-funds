/**
 * User Preferences Context
 * 
 * Provides user preferences state and management throughout the application.
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import userPreferencesService, { 
  UserPreferences, 
  DEFAULT_PREFERENCES 
} from '../services/userPreferencesService';

// Context interface
export interface UserPreferencesContextType {
  preferences: UserPreferences;
  isLoading: boolean;
  error: string | null;
  updatePreferences: (newPreferences: Partial<UserPreferences>) => Promise<void>;
  resetPreferences: () => Promise<void>;
  setNotificationPreference: (key: keyof UserPreferences['notifications'], value: boolean) => Promise<void>;
  setPrivacyPreference: (key: keyof UserPreferences['privacy'], value: boolean) => Promise<void>;
  setDefaultNetwork: (networkId: number) => Promise<void>;
}

// Create context with default values
const UserPreferencesContext = createContext<UserPreferencesContextType>({
  preferences: DEFAULT_PREFERENCES,
  isLoading: true,
  error: null,
  updatePreferences: async () => {},
  resetPreferences: async () => {},
  setNotificationPreference: async () => {},
  setPrivacyPreference: async () => {},
  setDefaultNetwork: async () => {},
});

// Provider component
export const UserPreferencesProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load preferences when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadPreferences();
    } else {
      // Reset to defaults when not authenticated
      setPreferences(DEFAULT_PREFERENCES);
      setIsLoading(false);
      setError(null);
    }
  }, [isAuthenticated]);

  /**
   * Load user preferences from API
   */
  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await userPreferencesService.getUserPreferences();
      setPreferences(data);
    } catch (error) {
      console.error('Error loading preferences:', error);
      setError('Failed to load preferences');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Update user preferences
   */
  const updatePreferences = async (newPreferences: Partial<UserPreferences>) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const updatedPreferences = await userPreferencesService.updateUserPreferences(newPreferences);
      setPreferences(updatedPreferences);
    } catch (error) {
      console.error('Error updating preferences:', error);
      setError('Failed to update preferences');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Reset user preferences to defaults
   */
  const resetPreferences = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const defaultPreferences = await userPreferencesService.resetUserPreferences();
      setPreferences(defaultPreferences);
    } catch (error) {
      console.error('Error resetting preferences:', error);
      setError('Failed to reset preferences');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };


  /**
   * Set notification preference
   */
  const setNotificationPreference = async (key: keyof UserPreferences['notifications'], value: boolean) => {
    await updatePreferences({
      notifications: {
        ...preferences.notifications,
        [key]: value
      }
    });
  };

  /**
   * Set privacy preference
   */
  const setPrivacyPreference = async (key: keyof UserPreferences['privacy'], value: boolean) => {
    await updatePreferences({
      privacy: {
        ...preferences.privacy,
        [key]: value
      }
    });
  };

  /**
   * Set default network
   */
  const setDefaultNetwork = async (networkId: number) => {
    await updatePreferences({
      defaultNetwork: networkId
    });
  };

  // Context value
  const contextValue: UserPreferencesContextType = {
    preferences,
    isLoading,
    error,
    updatePreferences,
    resetPreferences,
    setNotificationPreference,
    setPrivacyPreference,
    setDefaultNetwork
  };

  return (
    <UserPreferencesContext.Provider value={contextValue}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

// Hook for using the preferences context
export const useUserPreferences = () => {
  const context = useContext(UserPreferencesContext);
  if (context === undefined) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
};

export default UserPreferencesContext;