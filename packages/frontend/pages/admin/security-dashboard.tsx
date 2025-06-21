/**
 * Security Dashboard Page
 * 
 * Provides administrators with security monitoring and management tools.
 * This page is protected and only accessible to users with ADMIN permissions.
 */

import React from 'react';
import { NextPage } from 'next';
import Layout from '../../components/Layout';
import AuthGuard from '../../components/auth/AuthGuard';
import SecurityDashboardOverview from '../../components/security/SecurityDashboardOverview';
import IPMonitoring from '../../components/security/IPMonitoring';
import AuthenticationLogs from '../../components/security/AuthenticationLogs';
import SecurityAlerts from '../../components/security/SecurityAlerts';

const SecurityDashboardPage: NextPage = () => {
  return (
    <AuthGuard requiredPermissions={['ADMIN']}>
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">Security Dashboard</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <SecurityDashboardOverview />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <SecurityAlerts />
            <IPMonitoring />
          </div>
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
            <AuthenticationLogs />
          </div>
        </div>
      </Layout>
    </AuthGuard>
  );
};

export default SecurityDashboardPage;