/**
 * User Preferences Management System
 * 
 * This module provides functionality for saving, retrieving, and managing
 * user preferences related to ZK operations, with persistence between sessions.
 * 
 * Features:
 * - Save and retrieve user preferences in localStorage
 * - Default preferences with fallbacks
 * - Type-safe preference access
 * - Versioned preferences to handle schema changes
 * - Preference migration functionality
 * 
 * Usage:
 * ```
 * // Save a preference
 * UserPreferences.set('preferredCircuit', 'threshold');
 * 
 * // Get a preference with default fallback
 * const circuit = UserPreferences.get('preferredCircuit', 'standard');
 * 
 * // Reset all preferences
 * UserPreferences.resetAll();
 * ```
 */

// Version of the preferences schema
const PREFERENCES_VERSION = '1.0';
const STORAGE_KEY = 'zk_user_preferences';

// Define preference types
export interface UserPreferencesSchema {
  preferredCircuit: 'standard' | 'threshold' | 'maximum';
  useServerFallback: boolean;
  showHardwareCapabilities: boolean;
  enableDetailedProgress: boolean;
  showTechnicalDetails: boolean;
  memoryThreshold: number; // in MB
  lastUsedParameters: Record<string, any>; // Last used parameters per circuit type
  dismissedInfoCards: string[]; // IDs of info cards that have been dismissed
  customTimeoutMs: number; // Custom timeout in ms
  defaultDisplayMode: 'simple' | 'advanced';
  colorScheme: 'light' | 'dark' | 'system';
}

// Default preferences values
const defaultPreferences: UserPreferencesSchema = {
  preferredCircuit: 'standard',
  useServerFallback: true,
  showHardwareCapabilities: true,
  enableDetailedProgress: true,
  showTechnicalDetails: false,
  memoryThreshold: 200,
  lastUsedParameters: {},
  dismissedInfoCards: [],
  customTimeoutMs: 60000,
  defaultDisplayMode: 'simple',
  colorScheme: 'system'
};

/**
 * Get the current preferences object from localStorage
 * @returns Current preferences with defaults applied
 */
const getPreferences = (): UserPreferencesSchema => {
  try {
    if (typeof localStorage === 'undefined') {
      return { ...defaultPreferences };
    }
    
    const storedPrefs = localStorage.getItem(STORAGE_KEY);
    if (!storedPrefs) {
      return { ...defaultPreferences };
    }
    
    const parsedPrefs = JSON.parse(storedPrefs);
    
    // Check if preferences need migration
    if (!parsedPrefs.version || parsedPrefs.version !== PREFERENCES_VERSION) {
      return migratePreferences(parsedPrefs);
    }
    
    // Merge with defaults to ensure all fields exist
    return {
      ...defaultPreferences,
      ...parsedPrefs.data
    };
  } catch (error) {
    console.error('Error retrieving preferences:', error);
    return { ...defaultPreferences };
  }
};

/**
 * Save the preferences object to localStorage
 * @param preferences - Preferences to save
 */
const savePreferences = (preferences: UserPreferencesSchema): void => {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }
    
    const dataToStore = {
      version: PREFERENCES_VERSION,
      data: preferences,
      lastUpdated: new Date().toISOString()
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
  } catch (error) {
    console.error('Error saving preferences:', error);
  }
};

/**
 * Migrate preferences from older versions
 * @param oldPrefs - Old preferences object
 * @returns Migrated preferences
 */
const migratePreferences = (oldPrefs: any): UserPreferencesSchema => {
  // Start with default preferences
  const migratedPrefs = { ...defaultPreferences };
  
  try {
    // If old preferences had data nested under data property
    const prefsData = oldPrefs.data || oldPrefs;
    
    // Copy over values that exist in both schemas
    Object.keys(defaultPreferences).forEach(key => {
      if (prefsData[key] !== undefined) {
        // @ts-ignore - Dynamic key access
        migratedPrefs[key] = prefsData[key];
      }
    });
    
    // Save migrated preferences
    savePreferences(migratedPrefs);
    return migratedPrefs;
  } catch (error) {
    console.error('Error migrating preferences:', error);
    return defaultPreferences;
  }
};

/**
 * Get a specific preference value
 * @param key - Preference key
 * @param defaultValue - Default value if preference doesn't exist
 * @returns The preference value or default
 */
const get = <K extends keyof UserPreferencesSchema>(
  key: K, 
  defaultValue?: UserPreferencesSchema[K]
): UserPreferencesSchema[K] => {
  const preferences = getPreferences();
  
  // If the preference doesn't exist, use the provided default or schema default
  if (preferences[key] === undefined) {
    return defaultValue !== undefined ? defaultValue : defaultPreferences[key];
  }
  
  return preferences[key];
};

/**
 * Set a specific preference value
 * @param key - Preference key
 * @param value - New preference value
 */
const set = <K extends keyof UserPreferencesSchema>(
  key: K, 
  value: UserPreferencesSchema[K]
): void => {
  const preferences = getPreferences();
  preferences[key] = value;
  savePreferences(preferences);
  
  // Dispatch a custom event for other components to listen for
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('zk-preferences-changed', {
      detail: { key, value }
    });
    window.dispatchEvent(event);
  }
};

/**
 * Update multiple preferences at once
 * @param updates - Object with preference updates
 */
const update = (updates: Partial<UserPreferencesSchema>): void => {
  const preferences = getPreferences();
  const updatedPreferences = { ...preferences, ...updates };
  savePreferences(updatedPreferences);
  
  // Dispatch a custom event for other components to listen for
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('zk-preferences-changed', {
      detail: { updates }
    });
    window.dispatchEvent(event);
  }
};

/**
 * Reset all preferences to defaults
 */
const resetAll = (): void => {
  savePreferences({ ...defaultPreferences });
  
  // Dispatch a custom event for other components to listen for
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('zk-preferences-changed', {
      detail: { reset: true }
    });
    window.dispatchEvent(event);
  }
};

/**
 * Reset a specific preference to its default value
 * @param key - Preference key to reset
 */
const reset = <K extends keyof UserPreferencesSchema>(key: K): void => {
  const preferences = getPreferences();
  preferences[key] = defaultPreferences[key];
  savePreferences(preferences);
  
  // Dispatch a custom event for other components to listen for
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('zk-preferences-changed', {
      detail: { key, reset: true }
    });
    window.dispatchEvent(event);
  }
};

// Export the UserPreferences API
export const UserPreferences = {
  get,
  set,
  update,
  resetAll,
  reset,
  getAll: getPreferences,
  DEFAULTS: defaultPreferences
};

export default UserPreferences;