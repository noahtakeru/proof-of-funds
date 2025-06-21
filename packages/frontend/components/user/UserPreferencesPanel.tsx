/**
 * User Preferences Panel
 * 
 * Component for managing user preferences.
 */

import React, { useState } from 'react';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';

const UserPreferencesPanel: React.FC = () => {
  const {
    preferences,
    isLoading,
    error,
    setTheme,
    setLanguage,
    setNotificationPreference,
    setPrivacyPreference,
    setDefaultNetwork,
    resetPreferences
  } = useUserPreferences();
  
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(error);
  
  // Available options
  
  const networkOptions = [
    { value: 1, label: 'Ethereum Mainnet' },
    { value: 137, label: 'Polygon' },
    { value: 10, label: 'Optimism' },
    { value: 42161, label: 'Arbitrum' }
  ];
  
  
  /**
   * Handle notification toggle
   */
  const handleNotificationToggle = async (key: keyof typeof preferences.notifications) => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      
      const currentValue = preferences.notifications[key];
      await setNotificationPreference(key, !currentValue);
      
      setSuccessMessage('Notification preferences updated');
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      setErrorMessage('Failed to update notification preferences');
    } finally {
      setIsSaving(false);
    }
  };
  
  /**
   * Handle privacy toggle
   */
  const handlePrivacyToggle = async (key: keyof typeof preferences.privacy) => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      
      const currentValue = preferences.privacy[key];
      await setPrivacyPreference(key, !currentValue);
      
      setSuccessMessage('Privacy preferences updated');
    } catch (error) {
      console.error('Failed to update privacy preferences:', error);
      setErrorMessage('Failed to update privacy preferences');
    } finally {
      setIsSaving(false);
    }
  };
  
  /**
   * Handle network change
   */
  const handleNetworkChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      
      const networkId = parseInt(e.target.value);
      await setDefaultNetwork(networkId);
      
      setSuccessMessage('Default network updated');
    } catch (error) {
      console.error('Failed to update default network:', error);
      setErrorMessage('Failed to update default network');
    } finally {
      setIsSaving(false);
    }
  };
  
  /**
   * Handle reset preferences
   */
  const handleResetPreferences = async () => {
    if (window.confirm('Are you sure you want to reset all preferences to default?')) {
      try {
        setIsSaving(true);
        setErrorMessage(null);
        setSuccessMessage(null);
        
        await resetPreferences();
        
        setSuccessMessage('Preferences reset to defaults');
      } catch (error) {
        console.error('Failed to reset preferences:', error);
        setErrorMessage('Failed to reset preferences');
      } finally {
        setIsSaving(false);
      }
    }
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      {/* Success message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4">
          {successMessage}
        </div>
      )}
      
      {/* Error message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          {errorMessage}
        </div>
      )}
      
      
      {/* Notification preferences */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h3>
        
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              id="email-notifications"
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              checked={preferences.notifications.email}
              onChange={() => handleNotificationToggle('email')}
              disabled={isSaving}
            />
            <label htmlFor="email-notifications" className="ml-2 block text-sm text-gray-700">
              Email notifications
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              id="push-notifications"
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              checked={preferences.notifications.push}
              onChange={() => handleNotificationToggle('push')}
              disabled={isSaving}
            />
            <label htmlFor="push-notifications" className="ml-2 block text-sm text-gray-700">
              Push notifications
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              id="sms-notifications"
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              checked={preferences.notifications.sms}
              onChange={() => handleNotificationToggle('sms')}
              disabled={isSaving}
            />
            <label htmlFor="sms-notifications" className="ml-2 block text-sm text-gray-700">
              SMS notifications
            </label>
          </div>
        </div>
      </div>
      
      {/* Privacy preferences */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Privacy Preferences</h3>
        
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              id="show-wallet-balance"
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              checked={preferences.privacy.showWalletBalance}
              onChange={() => handlePrivacyToggle('showWalletBalance')}
              disabled={isSaving}
            />
            <label htmlFor="show-wallet-balance" className="ml-2 block text-sm text-gray-700">
              Show wallet balance to third parties
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              id="allow-data-collection"
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              checked={preferences.privacy.allowDataCollection}
              onChange={() => handlePrivacyToggle('allowDataCollection')}
              disabled={isSaving}
            />
            <label htmlFor="allow-data-collection" className="ml-2 block text-sm text-gray-700">
              Allow anonymous data collection to improve the platform
            </label>
          </div>
        </div>
      </div>
      
      {/* Blockchain preferences */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Blockchain Preferences</h3>
        
        <div>
          <label htmlFor="default-network" className="block text-sm font-medium text-gray-700 mb-1">
            Default Network
          </label>
          <select
            id="default-network"
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            value={preferences.defaultNetwork}
            onChange={handleNetworkChange}
            disabled={isSaving}
          >
            {networkOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Reset preferences button */}
      <div className="flex justify-end pt-4">
        <button
          type="button"
          className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          onClick={handleResetPreferences}
          disabled={isSaving}
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};

export default UserPreferencesPanel;