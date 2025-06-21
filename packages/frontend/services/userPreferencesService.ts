/**
 * User Preferences Service
 * 
 * Client-side service for interacting with the user preferences API.
 */

/**
 * User preferences interface
 */
export interface UserPreferences {
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  ui: {
    dashboardLayout: string;
  };
  defaultNetwork: number;
  privacy: {
    showWalletBalance: boolean;
    allowDataCollection: boolean;
  };
}

/**
 * Default preferences as fallback
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  notifications: {
    email: true,
    push: false,
    sms: false
  },
  ui: {
    dashboardLayout: 'default'
  },
  defaultNetwork: 1, // Ethereum mainnet
  privacy: {
    showWalletBalance: false,
    allowDataCollection: true
  }
};

/**
 * Get the user's preferences
 * 
 * @returns User preferences
 */
export async function getUserPreferences(): Promise<UserPreferences> {
  try {
    // Get token from local storage
    const token = localStorage.getItem('pof_access_token');
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    // Fetch preferences from API
    const response = await fetch('/api/user/preferences', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch preferences');
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch preferences');
    }
    
    return data.preferences as UserPreferences;
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    // Return default preferences on error
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Update user preferences
 * 
 * @param preferences - Partial preferences to update
 * @returns Updated preferences
 */
export async function updateUserPreferences(
  preferences: Partial<UserPreferences>
): Promise<UserPreferences> {
  try {
    // Get token from local storage
    const token = localStorage.getItem('pof_access_token');
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    // Send update to API
    const response = await fetch('/api/user/preferences', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferences)
    });
    
    if (!response.ok) {
      throw new Error('Failed to update preferences');
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to update preferences');
    }
    
    return data.preferences as UserPreferences;
  } catch (error) {
    console.error('Error updating user preferences:', error);
    throw error;
  }
}

/**
 * Reset user preferences to defaults
 * 
 * @returns Default preferences
 */
export async function resetUserPreferences(): Promise<UserPreferences> {
  try {
    // Get token from local storage
    const token = localStorage.getItem('pof_access_token');
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    // Send reset request to API
    const response = await fetch('/api/user/preferences/reset', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to reset preferences');
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to reset preferences');
    }
    
    return data.preferences as UserPreferences;
  } catch (error) {
    console.error('Error resetting user preferences:', error);
    throw error;
  }
}

const userPreferencesService = {
  getUserPreferences,
  updateUserPreferences,
  resetUserPreferences
};

export default userPreferencesService;