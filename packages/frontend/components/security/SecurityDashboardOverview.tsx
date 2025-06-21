/**
 * Security Dashboard Overview Component
 * 
 * Displays key security metrics and statistics.
 */

import React, { useState, useEffect } from 'react';
import { getSecurityMetrics, SecurityMetrics } from '../../services/securityService';

const SecurityDashboardOverview: React.FC = () => {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'hour' | 'day' | 'week' | 'month'>('day');
  
  // Load metrics on mount and when timeframe changes
  useEffect(() => {
    fetchMetrics();
  }, [timeframe]);
  
  /**
   * Fetch security metrics
   */
  const fetchMetrics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await getSecurityMetrics(timeframe);
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching security metrics:', error);
      setError('Failed to load security metrics');
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Handle timeframe change
   */
  const handleTimeframeChange = (newTimeframe: 'hour' | 'day' | 'week' | 'month') => {
    setTimeframe(newTimeframe);
  };
  
  // Render loading state
  if (isLoading && !metrics) {
    return (
      <div className="col-span-3 bg-white rounded-lg shadow-md p-6 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  // Render error state
  if (error && !metrics) {
    return (
      <div className="col-span-3 bg-white rounded-lg shadow-md p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
        <div className="mt-4 flex justify-center">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={fetchMetrics}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <>
      {/* Timeframe selector */}
      <div className="col-span-3 bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Security Overview</h2>
          
          <div className="flex space-x-2">
            <button
              className={`px-3 py-1 text-sm rounded-md ${timeframe === 'hour' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              onClick={() => handleTimeframeChange('hour')}
            >
              Hour
            </button>
            <button
              className={`px-3 py-1 text-sm rounded-md ${timeframe === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              onClick={() => handleTimeframeChange('day')}
            >
              Day
            </button>
            <button
              className={`px-3 py-1 text-sm rounded-md ${timeframe === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              onClick={() => handleTimeframeChange('week')}
            >
              Week
            </button>
            <button
              className={`px-3 py-1 text-sm rounded-md ${timeframe === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              onClick={() => handleTimeframeChange('month')}
            >
              Month
            </button>
          </div>
        </div>
        
        <div className="text-sm text-gray-500 mb-4">
          {metrics && (
            <span>
              {new Date(metrics.from).toLocaleString()} - {new Date(metrics.to).toLocaleString()}
            </span>
          )}
        </div>
        
        {/* Stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Authentication */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-1">Authentication</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-blue-600">Success</p>
                <p className="text-2xl font-bold text-blue-800">{metrics?.authSuccesses || 0}</p>
              </div>
              <div>
                <p className="text-xs text-blue-600">Failure</p>
                <p className="text-2xl font-bold text-blue-800">{metrics?.authFailures || 0}</p>
              </div>
            </div>
          </div>
          
          {/* Rate Limiting */}
          <div className="bg-yellow-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-yellow-800 mb-1">Rate Limiting</h3>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <p className="text-xs text-yellow-600">Exceeded</p>
                <p className="text-2xl font-bold text-yellow-800">{metrics?.rateLimitExceeded || 0}</p>
              </div>
            </div>
          </div>
          
          {/* IP Reputation */}
          <div className="bg-red-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-red-800 mb-1">IP Reputation</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-red-600">Suspicious</p>
                <p className="text-2xl font-bold text-red-800">{metrics?.suspiciousIPs || 0}</p>
              </div>
              <div>
                <p className="text-xs text-red-600">Blocked</p>
                <p className="text-2xl font-bold text-red-800">{metrics?.blockedIPs || 0}</p>
              </div>
            </div>
          </div>
          
          {/* Requests */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-green-800 mb-1">Requests</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-green-600">Total</p>
                <p className="text-2xl font-bold text-green-800">{metrics?.totalRequests || 0}</p>
              </div>
              <div>
                <p className="text-xs text-green-600">Blocked</p>
                <p className="text-2xl font-bold text-green-800">{metrics?.blockedRequests || 0}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Refresh button */}
        <div className="mt-4 flex justify-end">
          <button
            className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 flex items-center"
            onClick={fetchMetrics}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Refreshing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                Refresh
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default SecurityDashboardOverview;