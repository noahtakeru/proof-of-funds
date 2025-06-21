/**
 * User Settings Page
 * 
 * Allows users to manage their account settings and preferences.
 */

import React from 'react';
import { NextPage } from 'next';
import Layout from '../components/Layout';
import UserPreferencesPanel from '../components/user/UserPreferencesPanel';
import AuthGuard from '../components/auth/AuthGuard';

const SettingsPage: NextPage = () => {
  return (
    <AuthGuard>
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">Account Settings</h1>
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
            <div className="border-b border-gray-200">
              <div className="px-6 py-4">
                <h2 className="text-xl font-semibold text-gray-800">User Preferences</h2>
                <p className="text-gray-600 text-sm mt-1">
                  Customize your experience with Proof of Funds
                </p>
              </div>
            </div>
            
            <div className="p-6">
              <UserPreferencesPanel />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="border-b border-gray-200">
              <div className="px-6 py-4">
                <h2 className="text-xl font-semibold text-gray-800">Account Security</h2>
                <p className="text-gray-600 text-sm mt-1">
                  Manage your account security settings
                </p>
              </div>
            </div>
            
            <div className="p-6">
              <p className="text-gray-700">
                Security settings will be available in a future update.
              </p>
            </div>
          </div>
        </div>
      </Layout>
    </AuthGuard>
  );
};

export default SettingsPage;