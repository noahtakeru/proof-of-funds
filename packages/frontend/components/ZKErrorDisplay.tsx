/**
 * Zero-Knowledge Error Display Component
 * 
 * This component provides user-friendly error messages and recovery options
 * for various error scenarios that can occur during ZK operations.
 * 
 * Features:
 * - User-friendly error messages for technical errors
 * - Categorized errors with appropriate styling
 * - Actionable recovery instructions
 * - Expandable technical details for developers
 * - One-click retry functionality
 * 
 * @param {Object} props - Component properties
 * @param {Object} props.error - Error object with message and details
 * @param {Function} props.onRetry - Callback for retry action
 * @param {Function} props.onDismiss - Callback for dismissing the error
 * @param {boolean} props.showTechnicalDetails - Whether to show technical details by default
 */

import React, { useState } from 'react';

type ErrorSeverity = 'error' | 'warning' | 'info';

type ZKErrorProps = {
  error: {
    message: string;
    code?: string;
    severity?: ErrorSeverity;
    details?: any;
    recoverable?: boolean;
    recommendedAction?: string;
    technicalDetails?: string;
  };
  onRetry?: () => void;
  onDismiss?: () => void;
  showTechnicalDetails?: boolean;
};

const ZKErrorDisplay: React.FC<ZKErrorProps> = ({
  error,
  onRetry,
  onDismiss,
  showTechnicalDetails = false
}) => {
  const [expanded, setExpanded] = useState(showTechnicalDetails);

  // Get user-friendly error message based on error code or message
  const getUserFriendlyMessage = (error: ZKErrorProps['error']): string => {
    // If there's a custom message, use it
    if (error.message) {return error.message;}
    
    // Otherwise map error codes to user-friendly messages
    switch(error.code) {
      case 'PROOF_GENERATION_FAILED':
        return 'We couldn\'t generate the proof. This might be due to an issue with your browser or device.';
      case 'VERIFICATION_FAILED':
        return 'The proof verification failed. The proof may be invalid or there might be an issue with the verification system.';
      case 'MEMORY_INSUFFICIENT':
        return 'Your device doesn\'t have enough memory to complete this operation.';
      case 'BROWSER_UNSUPPORTED':
        return 'Your browser doesn\'t fully support the cryptographic features needed for ZK proofs.';
      case 'CONNECTION_ERROR':
        return 'There was a problem connecting to the verification server.';
      case 'INPUT_VALIDATION_FAILED':
        return 'Some of the information provided isn\'t in the correct format.';
      default:
        return 'An unexpected error occurred while processing your request.';
    }
  };

  // Get style classes based on severity
  const getSeverityStyles = (severity: ErrorSeverity = 'error') => {
    switch(severity) {
      case 'warning':
        return {
          border: 'border-yellow-400',
          bg: 'bg-yellow-50',
          icon: 'text-yellow-500',
          text: 'text-yellow-800',
          button: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
        };
      case 'info':
        return {
          border: 'border-blue-400',
          bg: 'bg-blue-50',
          icon: 'text-blue-500',
          text: 'text-blue-800',
          button: 'bg-blue-100 text-blue-800 hover:bg-blue-200'
        };
      case 'error':
      default:
        return {
          border: 'border-red-400',
          bg: 'bg-red-50',
          icon: 'text-red-500',
          text: 'text-red-800',
          button: 'bg-red-100 text-red-800 hover:bg-red-200'
        };
    }
  };

  const styles = getSeverityStyles(error.severity);

  // Get appropriate icon based on severity
  const getIcon = (severity: ErrorSeverity = 'error') => {
    switch(severity) {
      case 'warning':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'info':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className={`rounded-md border ${styles.border} ${styles.bg} p-4 my-4`}>
      <div className="flex">
        <div className={`flex-shrink-0 ${styles.icon}`}>
          {getIcon(error.severity)}
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${styles.text}`}>
            {getUserFriendlyMessage(error)}
          </h3>
          
          {/* Recommended action */}
          {error.recommendedAction && (
            <div className={`mt-2 text-sm ${styles.text}`}>
              <p><strong>Recommended action:</strong> {error.recommendedAction}</p>
            </div>
          )}
          
          {/* Error details collapsible section */}
          {(error.technicalDetails || error.details) && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-sm font-medium focus:outline-none"
              >
                <span className={`flex items-center ${styles.text}`}>
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className={`h-4 w-4 mr-1 transition-transform ${expanded ? 'transform rotate-90' : ''}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Technical details
                </span>
              </button>
              
              {expanded && (
                <div className="mt-2 text-xs font-mono p-2 bg-white bg-opacity-50 rounded border border-gray-200 overflow-auto max-h-60">
                  {error.technicalDetails && (
                    <p className="whitespace-pre-wrap">{error.technicalDetails}</p>
                  )}
                  {error.details && !error.technicalDetails && (
                    <pre>{JSON.stringify(error.details, null, 2)}</pre>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Action buttons */}
          <div className="mt-4 flex space-x-3">
            {error.recoverable && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className={`inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-xs font-medium ${styles.button}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry
              </button>
            )}
            
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZKErrorDisplay;