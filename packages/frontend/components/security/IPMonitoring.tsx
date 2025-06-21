/**
 * IP Monitoring Component
 * 
 * Displays and manages suspicious IP addresses.
 */

import React, { useState, useEffect } from 'react';
import { 
  getSuspiciousIPs, 
  blockIP,
  allowIP,
  getIPDetails,
  IPReputationData
} from '../../services/securityService';

const IPMonitoring: React.FC = () => {
  const [ips, setIPs] = useState<IPReputationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIP, setSelectedIP] = useState<IPReputationData | null>(null);
  const [isBlockingIP, setIsBlockingIP] = useState(false);
  const [isAllowingIP, setIsAllowingIP] = useState(false);
  const [actionReason, setActionReason] = useState('');
  const [threshold, setThreshold] = useState(30);
  
  // Load IPs on mount and when threshold changes
  useEffect(() => {
    fetchIPs();
  }, [threshold]);
  
  /**
   * Fetch suspicious IPs
   */
  const fetchIPs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await getSuspiciousIPs(threshold);
      setIPs(data);
    } catch (error) {
      console.error('Error fetching suspicious IPs:', error);
      setError('Failed to load suspicious IPs');
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Handle IP selection for details view
   */
  const handleIPSelect = async (ip: IPReputationData) => {
    try {
      // Get latest details for this IP
      const details = await getIPDetails(ip.ip);
      if (details) {
        setSelectedIP(details);
      } else {
        setSelectedIP(ip);
      }
    } catch (error) {
      console.error('Error fetching IP details:', error);
      setSelectedIP(ip);
    }
  };
  
  /**
   * Handle blocking an IP
   */
  const handleBlockIP = async () => {
    if (!selectedIP) return;
    
    try {
      setIsBlockingIP(true);
      
      const success = await blockIP(selectedIP.ip, actionReason);
      
      if (success) {
        // Update IP in list
        setIPs(ips.map(ip => 
          ip.ip === selectedIP.ip ? { ...ip, isBlocked: true } : ip
        ));
        
        // Update selected IP
        setSelectedIP({ ...selectedIP, isBlocked: true });
        
        // Clear reason
        setActionReason('');
      } else {
        setError('Failed to block IP');
      }
    } catch (error) {
      console.error('Error blocking IP:', error);
      setError('Failed to block IP');
    } finally {
      setIsBlockingIP(false);
    }
  };
  
  /**
   * Handle allowing an IP
   */
  const handleAllowIP = async () => {
    if (!selectedIP) return;
    
    try {
      setIsAllowingIP(true);
      
      const success = await allowIP(selectedIP.ip, actionReason);
      
      if (success) {
        // Update IP in list
        setIPs(ips.map(ip => 
          ip.ip === selectedIP.ip ? { ...ip, isBlocked: false } : ip
        ));
        
        // Update selected IP
        setSelectedIP({ ...selectedIP, isBlocked: false });
        
        // Clear reason
        setActionReason('');
      } else {
        setError('Failed to allow IP');
      }
    } catch (error) {
      console.error('Error allowing IP:', error);
      setError('Failed to allow IP');
    } finally {
      setIsAllowingIP(false);
    }
  };
  
  /**
   * Get reputation class based on score
   */
  const getReputationClass = (score: number): string => {
    if (score >= 80) return 'text-green-700';
    if (score >= 50) return 'text-yellow-700';
    if (score >= 30) return 'text-orange-700';
    return 'text-red-700';
  };
  
  /**
   * Format date for display
   */
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">IP Monitoring</h2>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <label htmlFor="threshold" className="text-sm text-gray-600 mr-2">
                Threshold:
              </label>
              <select
                id="threshold"
                className="rounded border-gray-300 text-sm focus:ring-blue-500 focus:border-blue-500"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value))}
              >
                <option value="10">10 (Blocked)</option>
                <option value="30">30 (Suspicious)</option>
                <option value="50">50 (Neutral)</option>
              </select>
            </div>
            
            <button
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
              onClick={fetchIPs}
              disabled={isLoading}
            >
              {isLoading ? (
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
      
      {/* Loading state */}
      {isLoading && ips.length === 0 && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {/* No IPs message */}
      {!isLoading && ips.length === 0 && (
        <div className="px-6 py-12 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
          </svg>
          <p>No suspicious IPs found</p>
        </div>
      )}
      
      {/* IPs list */}
      {ips.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP Address
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reputation
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Country
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Seen
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ips.map(ip => (
                <tr key={ip.ip}
                    className={`${ip.isBlocked ? 'bg-red-50' : ''} hover:bg-gray-100 cursor-pointer`}
                    onClick={() => handleIPSelect(ip)}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {ip.ip}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`font-medium ${getReputationClass(ip.score)}`}>
                      {ip.score}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {ip.country || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {ip.isBlocked ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                        Blocked
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                        Suspicious
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(ip.lastUpdated)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      className="text-blue-600 hover:text-blue-900"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleIPSelect(ip);
                      }}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* IP details modal */}
      {selectedIP && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-800">IP Details</h3>
                <button
                  className="text-gray-400 hover:text-gray-500"
                  onClick={() => setSelectedIP(null)}
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">IP Address</p>
                  <p className="text-sm font-medium text-gray-900">{selectedIP.ip}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Reputation Score</p>
                  <p className={`text-sm font-medium ${getReputationClass(selectedIP.score)}`}>
                    {selectedIP.score}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedIP.isBlocked ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                        Blocked
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                        Suspicious
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">First Seen</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDate(selectedIP.firstSeen)}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Country</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedIP.country || 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">ASN</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedIP.asn || 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">ISP</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedIP.isp || 'Unknown'}
                  </p>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-gray-500 mb-2">Recent Events</p>
                {selectedIP.events.length > 0 ? (
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Event
                          </th>
                          <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Impact
                          </th>
                          <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Time
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedIP.events.slice(0, 10).map((event, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">
                              {event.event}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-xs">
                              <span className={event.impact >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {event.impact >= 0 ? '+' : ''}{event.impact}
                              </span>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                              {formatDate(event.timestamp)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No recent events</p>
                )}
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">Action Reason</p>
                <textarea
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Enter a reason for blocking or allowing this IP..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                ></textarea>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                onClick={() => setSelectedIP(null)}
              >
                Close
              </button>
              
              {selectedIP.isBlocked ? (
                <button
                  className="px-4 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 flex items-center"
                  onClick={handleAllowIP}
                  disabled={isAllowingIP}
                >
                  {isAllowingIP ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Allowing...
                    </>
                  ) : (
                    'Allow IP'
                  )}
                </button>
              ) : (
                <button
                  className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 flex items-center"
                  onClick={handleBlockIP}
                  disabled={isBlockingIP}
                >
                  {isBlockingIP ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Blocking...
                    </>
                  ) : (
                    'Block IP'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IPMonitoring;