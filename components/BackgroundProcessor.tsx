/**
 * Background Processing UI Component
 * 
 * This component provides UI elements for managing operations that run in the
 * background, allowing users to continue interacting with the application while
 * complex ZK operations complete.
 * 
 * Features:
 * - Minimizable interface that shows active background operations
 * - Progress tracking for each background operation
 * - Notification system for operation completion
 * - Operation management (pause, resume, cancel)
 * - Result retrieval when operations complete
 * 
 * @param {Object} props - Component properties
 * @param {Object[]} props.operations - Array of background operations
 * @param {Function} props.onOperationAction - Callback for operation actions (pause, resume, cancel)
 * @param {Function} props.onViewResult - Callback to view an operation's result
 * @param {boolean} props.minimized - Whether the component is minimized
 * @param {Function} props.onToggleMinimize - Callback to toggle minimized state
 */

import React, { useState, useEffect } from 'react';

export type OperationStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'canceled';
export type OperationType = 'proof_generation' | 'verification' | 'key_generation' | 'circuit_compilation';

export interface BackgroundOperation {
  id: string;
  name: string;
  type: OperationType;
  status: OperationStatus;
  progress: number; // 0-100
  startTime: Date;
  endTime?: Date;
  estimatedTimeRemaining?: number; // in seconds
  error?: string;
  result?: any;
  canPause: boolean;
  canCancel: boolean;
}

interface BackgroundProcessorProps {
  operations: BackgroundOperation[];
  onOperationAction: (operationId: string, action: 'pause' | 'resume' | 'cancel') => void;
  onViewResult: (operationId: string) => void;
  minimized?: boolean;
  onToggleMinimize?: () => void;
}

const BackgroundProcessor: React.FC<BackgroundProcessorProps> = ({
  operations,
  onOperationAction,
  onViewResult,
  minimized = false,
  onToggleMinimize
}) => {
  const [activeOperations, setActiveOperations] = useState<BackgroundOperation[]>([]);
  const [completedOperations, setCompletedOperations] = useState<BackgroundOperation[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationOperation, setNotificationOperation] = useState<BackgroundOperation | null>(null);

  // Format time in a human-readable way
  const formatTime = (seconds?: number): string => {
    if (seconds === undefined || seconds < 0) return '';
    if (seconds < 60) return `${Math.round(seconds)}s remaining`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s remaining`;
  };

  // Format duration
  const formatDuration = (startTime: Date, endTime?: Date): string => {
    const end = endTime || new Date();
    const durationMs = end.getTime() - startTime.getTime();
    
    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`;
    
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.round((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  // Get status color class
  const getStatusColorClass = (status: OperationStatus): string => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'canceled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get progress bar color
  const getProgressBarColor = (status: OperationStatus): string => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'running': return 'bg-blue-500';
      case 'paused': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      case 'canceled': return 'bg-gray-400';
      default: return 'bg-gray-300';
    }
  };

  // Handle changes in operations
  useEffect(() => {
    // Split operations into active and completed
    const active = operations.filter(op => ['queued', 'running', 'paused'].includes(op.status));
    const completed = operations.filter(op => ['completed', 'failed', 'canceled'].includes(op.status));
    
    setActiveOperations(active);
    setCompletedOperations(completed);
    
    // Check for newly completed operations
    const previousCompletedIds = completedOperations.map(op => op.id);
    const newlyCompleted = completed.filter(op => !previousCompletedIds.includes(op.id));
    
    if (newlyCompleted.length > 0) {
      // Show notification for most recent completion
      setNotificationOperation(newlyCompleted[0]);
      setShowNotification(true);
      
      // Hide notification after 5 seconds
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [operations, completedOperations]);

  // If minimized, show only a floating button with count
  if (minimized) {
    const activeCount = activeOperations.length;
    
    return (
      <>
        {/* Minimized button */}
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={onToggleMinimize}
            className="bg-primary-600 text-white rounded-full p-3 shadow-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            {activeCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </button>
        </div>
        
        {/* Notification toast */}
        {showNotification && notificationOperation && (
          <div className="fixed bottom-16 right-4 z-50 w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-3 animate-fade-in">
            <div className="flex items-start">
              <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                notificationOperation.status === 'completed' ? 'bg-green-100 text-green-600' :
                notificationOperation.status === 'failed' ? 'bg-red-100 text-red-600' :
                'bg-gray-100 text-gray-600'
              }`}>
                {notificationOperation.status === 'completed' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : notificationOperation.status === 'failed' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {notificationOperation.name}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {notificationOperation.status === 'completed' ? 'Operation completed successfully' :
                   notificationOperation.status === 'failed' ? 'Operation failed' :
                   'Operation canceled'}
                </p>
                {notificationOperation.status === 'completed' && (
                  <button
                    onClick={() => onViewResult(notificationOperation.id)}
                    className="mt-2 text-xs text-primary-600 hover:text-primary-800"
                  >
                    View Result
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowNotification(false)}
                className="flex-shrink-0 ml-1 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 w-full sm:w-96 bg-white border-t sm:border-l border-gray-200 shadow-lg z-40">
      {/* Header */}
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-700">
          Background Operations {activeOperations.length > 0 && `(${activeOperations.length} active)`}
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={onToggleMinimize}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Minimize"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Active operations */}
      <div className="overflow-y-auto max-h-72">
        {activeOperations.length === 0 && completedOperations.length === 0 && (
          <div className="py-8 text-center text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <p className="text-sm">No background operations</p>
          </div>
        )}
        
        {activeOperations.map(operation => (
          <div key={operation.id} className="p-3 border-b border-gray-100">
            <div className="flex justify-between items-start mb-1">
              <div>
                <h4 className="text-sm font-medium text-gray-800">{operation.name}</h4>
                <div className="flex items-center mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColorClass(operation.status)}`}>
                    {operation.status.charAt(0).toUpperCase() + operation.status.slice(1)}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    {formatDuration(operation.startTime)}
                  </span>
                </div>
              </div>
              <div className="flex space-x-1">
                {operation.status === 'running' && operation.canPause && (
                  <button
                    onClick={() => onOperationAction(operation.id, 'pause')}
                    className="p-1 text-gray-500 hover:text-gray-700 rounded"
                    aria-label="Pause"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
                {operation.status === 'paused' && (
                  <button
                    onClick={() => onOperationAction(operation.id, 'resume')}
                    className="p-1 text-gray-500 hover:text-gray-700 rounded"
                    aria-label="Resume"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
                {(operation.status === 'running' || operation.status === 'paused') && operation.canCancel && (
                  <button
                    onClick={() => onOperationAction(operation.id, 'cancel')}
                    className="p-1 text-gray-500 hover:text-red-600 rounded"
                    aria-label="Cancel"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="mt-2">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getProgressBarColor(operation.status)} transition-all duration-500 ease-in-out`}
                  style={{ width: `${Math.max(0, Math.min(100, operation.progress))}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-1 text-xs text-gray-500">
                <span>{Math.round(operation.progress)}%</span>
                {operation.estimatedTimeRemaining !== undefined && (
                  <span>{formatTime(operation.estimatedTimeRemaining)}</span>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Completed operations */}
        {completedOperations.length > 0 && (
          <div className="p-2 bg-gray-50 border-t border-gray-200">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider px-1 mb-1">
              Recent Completions
            </h4>
            {completedOperations.slice(0, 3).map(operation => (
              <div key={operation.id} className="py-2 px-3 hover:bg-gray-100 rounded-md cursor-pointer" onClick={() => onViewResult(operation.id)}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <div className={`h-2 w-2 rounded-full mr-2 ${
                      operation.status === 'completed' ? 'bg-green-500' :
                      operation.status === 'failed' ? 'bg-red-500' :
                      'bg-gray-400'
                    }`}></div>
                    <span className="text-sm text-gray-700">{operation.name}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDuration(operation.startTime, operation.endTime)}
                  </span>
                </div>
                {operation.status === 'failed' && operation.error && (
                  <p className="text-xs text-red-600 ml-4 mt-1 truncate">{operation.error}</p>
                )}
              </div>
            ))}
            {completedOperations.length > 3 && (
              <div className="text-xs text-center text-gray-500 mt-1">
                +{completedOperations.length - 3} more
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BackgroundProcessor;