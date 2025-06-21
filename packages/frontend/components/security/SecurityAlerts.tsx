/**
 * Security Alerts Component
 * 
 * Displays and manages security alerts.
 */

import React, { useState, useEffect } from 'react';
import { 
  getSecurityAlerts, 
  resolveSecurityAlert,
  SecurityAlert 
} from '../../services/securityService';

const SecurityAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [isResolvingAlert, setIsResolvingAlert] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  
  // Load alerts on mount and when includeResolved changes
  useEffect(() => {
    fetchAlerts();
  }, [includeResolved]);
  
  /**
   * Fetch security alerts
   */
  const fetchAlerts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await getSecurityAlerts(20, includeResolved);
      setAlerts(data);
    } catch (error) {
      console.error('Error fetching security alerts:', error);
      setError('Failed to load security alerts');
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Handle alert selection for details view
   */
  const handleAlertSelect = (alert: SecurityAlert) => {
    setSelectedAlert(alert);
  };
  
  /**
   * Handle alert resolution
   */
  const handleResolveAlert = async () => {
    if (!selectedAlert) return;
    
    try {
      setIsResolvingAlert(true);
      
      const success = await resolveSecurityAlert(selectedAlert.id, resolutionNotes || undefined);
      
      if (success) {
        // Update alerts list
        setAlerts(alerts.map(alert => 
          alert.id === selectedAlert.id 
            ? { 
                ...alert, 
                isResolved: true,
                resolvedAt: new Date().toISOString(),
                resolutionNotes: resolutionNotes || undefined
              } 
            : alert
        ));
        
        // Clear selection and notes
        setSelectedAlert(null);
        setResolutionNotes('');
      } else {
        setError('Failed to resolve alert');
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
      setError('Failed to resolve alert');
    } finally {
      setIsResolvingAlert(false);
    }
  };
  
  /**
   * Get severity badge color
   */
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
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
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Security Alerts</h2>
          
          <div className="flex items-center space-x-4">
            <label className="flex items-center text-sm text-gray-600">
              <input
                type="checkbox"
                className="rounded text-blue-600 focus:ring-blue-500 mr-2"
                checked={includeResolved}
                onChange={() => setIncludeResolved(!includeResolved)}
              />
              Show Resolved
            </label>
            
            <button
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
              onClick={fetchAlerts}
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
      {isLoading && alerts.length === 0 && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {/* No alerts message */}
      {!isLoading && alerts.length === 0 && (
        <div className="px-6 py-12 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          <p>No security alerts found</p>
        </div>
      )}
      
      {/* Alerts list */}
      {alerts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severity
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {alerts.map(alert => (
                <tr key={alert.id} 
                    className={`${alert.isResolved ? 'bg-gray-50' : ''} hover:bg-gray-100 cursor-pointer`}
                    onClick={() => handleAlertSelect(alert)}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {alert.type}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 truncate max-w-xs">
                    {alert.message}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(alert.timestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {alert.isResolved ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                        Resolved
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      className="text-blue-600 hover:text-blue-900"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAlertSelect(alert);
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
      
      {/* Alert details modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-800">Alert Details</h3>
                <button
                  className="text-gray-400 hover:text-gray-500"
                  onClick={() => setSelectedAlert(null)}
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
                  <p className="text-sm text-gray-500">Severity</p>
                  <p className="text-sm font-medium text-gray-900">
                    <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(selectedAlert.severity)}`}>
                      {selectedAlert.severity}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="text-sm font-medium text-gray-900">{selectedAlert.type}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Source</p>
                  <p className="text-sm font-medium text-gray-900">{selectedAlert.source}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Time</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(selectedAlert.timestamp)}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Message</p>
                <p className="text-sm font-medium text-gray-900">{selectedAlert.message}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Details</p>
                <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                  {JSON.stringify(selectedAlert.details, null, 2)}
                </pre>
              </div>
              
              {selectedAlert.isResolved ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-gray-500">Resolved At</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedAlert.resolvedAt ? formatDate(selectedAlert.resolvedAt) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Resolved By</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedAlert.resolvedBy || 'N/A'}
                    </p>
                  </div>
                  {selectedAlert.resolutionNotes && (
                    <div>
                      <p className="text-sm text-gray-500">Resolution Notes</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedAlert.resolutionNotes}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-2">Resolution Notes</p>
                  <textarea
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Enter notes about how this alert was resolved..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                  ></textarea>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                onClick={() => setSelectedAlert(null)}
              >
                Close
              </button>
              
              {!selectedAlert.isResolved && (
                <button
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center"
                  onClick={handleResolveAlert}
                  disabled={isResolvingAlert}
                >
                  {isResolvingAlert ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Resolving...
                    </>
                  ) : (
                    'Mark as Resolved'
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

export default SecurityAlerts;