/**
 * Cancellable Operation Component
 * 
 * This component provides a user interface for cancelling long-running operations,
 * with confirmation dialog and status reporting.
 * 
 * Features:
 * - Cancel button with confirmation dialog
 * - Visual feedback during cancellation process
 * - Support for both immediate and graceful cancellation
 * - Status updates during cancellation process
 * 
 * @param {Object} props - Component properties
 * @param {string} props.operationId - Unique identifier for the operation
 * @param {string} props.operationName - Human-readable name of the operation
 * @param {boolean} props.cancellable - Whether the operation can be cancelled
 * @param {boolean} props.isCancelling - Whether cancellation is in progress
 * @param {Function} props.onCancel - Callback for when cancel is confirmed
 * @param {string} props.buttonSize - Size of the cancel button ('sm', 'md', 'lg')
 * @param {string} props.buttonStyle - Style of the cancel button ('primary', 'danger', 'outline')
 */

import React, { useState } from 'react';

interface CancellableOperationProps {
  operationId: string;
  operationName?: string;
  cancellable: boolean;
  isCancelling?: boolean;
  onCancel: (operationId: string, graceful: boolean) => void;
  buttonSize?: 'sm' | 'md' | 'lg';
  buttonStyle?: 'primary' | 'danger' | 'outline' | 'text';
}

const CancellableOperation: React.FC<CancellableOperationProps> = ({
  operationId,
  operationName = 'Operation',
  cancellable = true,
  isCancelling = false,
  onCancel,
  buttonSize = 'md',
  buttonStyle = 'outline'
}) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [gracefulCancel, setGracefulCancel] = useState(true);

  // Handle initial cancel button click
  const handleCancelClick = () => {
    if (!cancellable || isCancelling) {return;}
    setShowConfirmation(true);
  };

  // Handle cancel confirmation
  const handleConfirmCancel = () => {
    onCancel(operationId, gracefulCancel);
    setShowConfirmation(false);
  };

  // Handle cancel cancellation (user changed their mind)
  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
  };

  // Get button style classes
  const getButtonClasses = (): string => {
    const baseClasses = 'font-medium focus:outline-none transition-colors duration-150 ease-in-out';
    let sizeClasses = '';
    let styleClasses = '';
    
    // Size classes
    switch (buttonSize) {
      case 'sm':
        sizeClasses = 'text-xs px-2 py-1 rounded';
        break;
      case 'lg':
        sizeClasses = 'text-sm px-4 py-2 rounded-md';
        break;
      case 'md':
      default:
        sizeClasses = 'text-xs px-3 py-1.5 rounded';
        break;
    }
    
    // Style classes
    switch (buttonStyle) {
      case 'primary':
        styleClasses = 'bg-primary-600 text-white hover:bg-primary-700 border border-transparent';
        break;
      case 'danger':
        styleClasses = 'bg-red-600 text-white hover:bg-red-700 border border-transparent';
        break;
      case 'text':
        styleClasses = 'text-red-600 hover:text-red-800 underline';
        break;
      case 'outline':
      default:
        styleClasses = 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50';
        break;
    }
    
    // Disabled state
    if (!cancellable) {
      styleClasses = 'border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed';
    }
    
    return `${baseClasses} ${sizeClasses} ${styleClasses}`;
  };

  return (
    <div>
      {/* Cancel Button */}
      <button
        onClick={handleCancelClick}
        className={getButtonClasses()}
        disabled={!cancellable || isCancelling}
      >
        {isCancelling ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Cancelling...
          </span>
        ) : (
          <span>Cancel</span>
        )}
      </button>
      
      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Cancel {operationName}?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to cancel this operation? This action cannot be undone.
            </p>
            
            {/* Graceful vs. Immediate cancel options */}
            <div className="mb-6">
              <div className="flex items-center mb-2">
                <input
                  id="graceful-cancel"
                  type="radio"
                  name="cancel-type"
                  checked={gracefulCancel}
                  onChange={() => setGracefulCancel(true)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="graceful-cancel" className="ml-2 text-sm text-gray-700">
                  Graceful cancellation (safer, may take longer)
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="immediate-cancel"
                  type="radio"
                  name="cancel-type"
                  checked={!gracefulCancel}
                  onChange={() => setGracefulCancel(false)}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                />
                <label htmlFor="immediate-cancel" className="ml-2 text-sm text-gray-700">
                  Immediate cancellation (faster, but may leave incomplete state)
                </label>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelConfirmation}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                No, Continue
              </button>
              <button
                onClick={handleConfirmCancel}
                className={`px-4 py-2 rounded-md text-sm font-medium text-white ${
                  gracefulCancel ? 'bg-primary-600 hover:bg-primary-700' : 'bg-red-600 hover:bg-red-700'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  gracefulCancel ? 'focus:ring-primary-500' : 'focus:ring-red-500'
                }`}
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CancellableOperation;