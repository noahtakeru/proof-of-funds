/**
 * Authentication Logs Component
 * 
 * Displays and filters wallet authentication logs.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  getWalletAuthStatistics, 
  getWalletAuthHistory,
  AuthLogEntry,
  AuthStatistics
} from '../../services/securityService';

const AuthenticationLogs: React.FC = () => {
  const [stats, setStats] = useState<AuthStatistics | null>(null);
  const [logs, setLogs] = useState<AuthLogEntry[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState(24); // Hours
  const [searchAddress, setSearchAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Load stats on mount and when timeframe changes
  useEffect(() => {
    fetchStats();
  }, [timeframe]);
  
  /**
   * Fetch authentication statistics
   */
  const fetchStats = async () => {
    try {
      setIsLoadingStats(true);
      setError(null);
      
      const data = await getWalletAuthStatistics(timeframe);
      setStats(data);
    } catch (error) {
      console.error('Error fetching auth statistics:', error);
      setError('Failed to load authentication statistics');
    } finally {
      setIsLoadingStats(false);
    }
  };
  
  /**
   * Search wallet auth history for an address
   */
  const searchAuthHistory = async () => {
    if (!searchAddress) return;
    
    try {
      setIsLoadingLogs(true);
      setError(null);
      
      const data = await getWalletAuthHistory(searchAddress, 20);
      setLogs(data);
    } catch (error) {
      console.error('Error fetching auth history:', error);
      setError('Failed to load authentication history');
      setLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };
  
  /**
   * Handle search form submission
   */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchAddress(searchQuery);
    searchAuthHistory();
  };
  
  /**
   * Get auth result badge color
   */
  const getAuthResultColor = (result: string): string => {
    switch (result) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failure':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  /**
   * Format date for display
   */
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };
  
  /**
   * Get chart data for success rate
   */
  const getSuccessRateChartStyle = useCallback(() => {
    if (!stats) return { width: '0%' };
    return { width: `${stats.successRate}%` };
  }, [stats]);
  
  /**
   * Get chart color for success rate
   */
  const getSuccessRateColor = useCallback(() => {
    if (!stats) return 'bg-gray-300';
    if (stats.successRate >= 90) return 'bg-green-500';
    if (stats.successRate >= 75) return 'bg-yellow-500';
    return 'bg-red-500';
  }, [stats]);
  
  return (
    <div>
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Authentication Logs</h2>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <label htmlFor="timeframe" className="text-sm text-gray-600 mr-2">
                Timeframe:
              </label>
              <select
                id="timeframe"
                className="rounded border-gray-300 text-sm focus:ring-blue-500 focus:border-blue-500"
                value={timeframe}
                onChange={(e) => setTimeframe(parseInt(e.target.value))}
              >
                <option value="1">Last Hour</option>
                <option value="6">Last 6 Hours</option>
                <option value="12">Last 12 Hours</option>
                <option value="24">Last 24 Hours</option>
                <option value="72">Last 3 Days</option>
                <option value="168">Last Week</option>
              </select>
            </div>
            
            <button
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
              onClick={fetchStats}
              disabled={isLoadingStats}
            >
              {isLoadingStats ? (
                <>
                  <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
      </div>
      
      {/* Error message */}
      {error && (
        <div className="px-6 py-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        </div>
      )}
      
      {/* Statistics section */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-md font-medium text-gray-800 mb-4">Authentication Statistics</h3>
        
        {isLoadingStats && !stats ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Success rate */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Success Rate</span>
                <span className="text-sm font-medium text-gray-900">{stats?.successRate || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className={`h-2.5 rounded-full ${getSuccessRateColor()}`} 
                  style={getSuccessRateChartStyle()}>
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Total: {stats?.totalAttempts || 0}</span>
                <span>Success: {stats?.successCount || 0}</span>
                <span>Failure: {stats?.failureCount || 0}</span>
              </div>
            </div>
            
            {/* Failure reasons */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Top Failure Reasons</h4>
              {stats?.failureReasons && stats.failureReasons.length > 0 ? (
                <div className="space-y-2">
                  {stats.failureReasons.slice(0, 3).map((reason, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        {reason.reason || 'Unknown'}
                      </span>
                      <span className="text-sm text-gray-900 font-medium">
                        {reason.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No failure data available</p>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Search form */}
      <div className="px-6 py-4 border-b border-gray-200">
        <form onSubmit={handleSearch} className="flex space-x-2">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search wallet address"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            disabled={isLoadingLogs || !searchQuery}
          >
            {isLoadingLogs ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Searching...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                Search
              </>
            )}
          </button>
        </form>
      </div>
      
      {/* Auth logs */}
      {searchAddress && (
        <div className="px-6 py-4">
          <h3 className="text-md font-medium text-gray-800 mb-4">
            Authentication Logs for {searchAddress}
          </h3>
          
          {isLoadingLogs ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No authentication logs found for this address
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Result
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Agent
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Failure Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 text-xs rounded-full ${getAuthResultColor(log.authResult)}`}>
                          {log.authResult}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.ipAddress || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs">
                        {log.userAgent || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.failureReason || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuthenticationLogs;