/**
 * Zero-Knowledge Proof Generation Progress Tracker
 * 
 * This component provides detailed step-by-step tracking of ZK proof generation
 * operations, with time estimation and completion status for each step.
 * 
 * Features:
 * - Visual step progress with completion status
 * - Time estimation for current step and overall process
 * - Detailed progress reporting for complex operations
 * - Visual indicators for completed, current, and pending steps
 * - Support for multiple proof generation pathways
 * 
 * @param {Object} props - Component properties
 * @param {Object[]} props.steps - Array of step objects with name, status, and progress
 * @param {number} props.currentStepIndex - Index of current active step
 * @param {number} props.overallProgress - Overall progress percentage (0-100)
 * @param {number} props.estimatedTimeRemaining - Estimated remaining time in seconds
 * @param {string} props.operationId - Unique identifier for the operation
 */

import React from 'react';

export type StepStatus = 'pending' | 'active' | 'completed' | 'error';

export interface Step {
  name: string;
  description?: string;
  status: StepStatus;
  progress?: number; // 0-100
  timeElapsed?: number; // in seconds
  timeRemaining?: number; // in seconds
  startTime?: Date;
  endTime?: Date;
  details?: string;
  errorMessage?: string;
}

interface ProgressTrackerProps {
  steps: Step[];
  currentStepIndex: number;
  overallProgress: number;
  estimatedTimeRemaining?: number; // in seconds
  operationId?: string;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  steps,
  currentStepIndex,
  overallProgress,
  estimatedTimeRemaining,
  operationId
}) => {
  // Format time in a human-readable way (e.g., "2m 30s")
  const formatTime = (seconds?: number): string => {
    if (seconds === undefined || seconds < 0) return 'Unknown';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Calculate status for progress bar
  const getProgressBarColor = (status: StepStatus): string => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'active': return 'bg-primary-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  };

  // Get icon for step status
  const getStatusIcon = (status: StepStatus): JSX.Element => {
    switch (status) {
      case 'completed':
        return (
          <div className="flex-shrink-0 h-5 w-5 text-green-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'active':
        return (
          <div className="flex-shrink-0 h-5 w-5 text-primary-500">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="flex-shrink-0 h-5 w-5 text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="flex-shrink-0 h-5 w-5 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 my-4">
      {/* Header with overall progress */}
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-medium text-gray-700">
            Proof Generation Progress
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Step {currentStepIndex + 1} of {steps.length}
          </p>
        </div>
        {operationId && (
          <div className="text-xs text-gray-500">
            Operation ID: {operationId.substring(0, 8)}...
          </div>
        )}
      </div>

      {/* Overall progress bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <div className="text-xs font-medium text-gray-700">
            Overall Progress: {Math.round(overallProgress)}%
          </div>
          {estimatedTimeRemaining !== undefined && (
            <div className="text-xs text-gray-500">
              Estimated time remaining: {formatTime(estimatedTimeRemaining)}
            </div>
          )}
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary-500 rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${Math.max(0, Math.min(100, overallProgress))}%` }}
          />
        </div>
      </div>

      {/* Steps list */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={index} className="relative">
            {/* Connect steps with vertical line, except the last one */}
            {index < steps.length - 1 && (
              <div 
                className={`absolute left-2.5 top-5 bottom-0 w-0.5 ${
                  index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'
                }`}
                style={{ transform: 'translateX(-50%)' }}
              />
            )}
            
            <div className="relative flex items-start">
              {/* Step status icon */}
              {getStatusIcon(step.status)}
              
              {/* Step content */}
              <div className="ml-3 flex-1">
                <div className="flex justify-between items-center">
                  <h4 className={`text-sm font-medium ${
                    step.status === 'active' ? 'text-primary-700' :
                    step.status === 'completed' ? 'text-green-700' :
                    step.status === 'error' ? 'text-red-700' :
                    'text-gray-600'
                  }`}>
                    {step.name}
                  </h4>
                  <div className="text-xs text-gray-500">
                    {step.status === 'completed' && step.timeElapsed && (
                      `Completed in ${formatTime(step.timeElapsed)}`
                    )}
                    {step.status === 'active' && step.timeRemaining && (
                      `Est. ${formatTime(step.timeRemaining)} remaining`
                    )}
                  </div>
                </div>
                
                {/* Step description */}
                {step.description && (
                  <p className="mt-1 text-xs text-gray-500">{step.description}</p>
                )}
                
                {/* Step progress bar (for active steps) */}
                {step.status === 'active' && step.progress !== undefined && (
                  <div className="mt-2 mb-1">
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${getProgressBarColor(step.status)} rounded-full`}
                        style={{ width: `${Math.max(0, Math.min(100, step.progress))}%` }}
                      />
                    </div>
                  </div>
                )}
                
                {/* Error message */}
                {step.status === 'error' && step.errorMessage && (
                  <div className="mt-1 text-xs text-red-600">
                    {step.errorMessage}
                  </div>
                )}
                
                {/* Step details (expandable) */}
                {step.details && (
                  <div className="mt-1 text-xs bg-gray-50 p-2 rounded text-gray-600">
                    {step.details}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressTracker;