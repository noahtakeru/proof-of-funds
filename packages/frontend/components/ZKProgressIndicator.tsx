/**
 * ZK Proof Generation Progress Indicator
 * 
 * This component displays progress information during ZK proof generation,
 * providing users with real-time feedback during long-running operations.
 * 
 * Features:
 * - Percentage-based progress visualization
 * - Step-by-step progress tracking
 * - Time remaining estimation when available
 * - Visual indication of current proof generation stage
 * - Cancellation capability for long-running operations
 * 
 * @param {Object} props - Component properties
 * @param {number} props.progress - Current progress percentage (0-100)
 * @param {string} props.status - Current operation status description
 * @param {string} props.step - Current operation step (e.g., 'init', 'witness', 'proof')
 * @param {number} props.timeRemaining - Estimated time remaining in seconds
 * @param {Function} props.onCancel - Callback function for cancelling the operation
 * @param {boolean} props.isCancellable - Whether the operation can be cancelled
 * @param {string} props.operationId - Unique identifier for the operation
 */

import React, { useState, useEffect } from 'react';

const ZKProgressIndicator: React.FC<{
  progress: number;
  status: string;
  step?: string;
  timeRemaining?: number;
  onCancel?: () => void;
  isCancellable?: boolean;
  operationId?: string;
}> = ({ 
  progress, 
  status, 
  step, 
  timeRemaining, 
  onCancel, 
  isCancellable = false, 
  operationId 
}) => {
  // Format remaining time in a human-readable format
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) {return `${Math.round(seconds)}s remaining`;}
    if (seconds < 3600) {return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s remaining`;}
    return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m remaining`;
  };

  // Determine step index for progress visualization
  const getStepIndex = (currentStep?: string): number => {
    const steps = ['init', 'witness', 'proof', 'complete'];
    return currentStep ? steps.indexOf(currentStep) : -1;
  };

  // Get appropriate color based on progress
  const getProgressColor = (percent: number): string => {
    if (percent < 30) {return 'bg-blue-500';}
    if (percent < 70) {return 'bg-primary-500';}
    return 'bg-green-500';
  };

  // State for animation
  const [isAnimating, setIsAnimating] = useState(false);

  // Apply animation effect when progress changes
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 700);
    return () => clearTimeout(timer);
  }, [progress]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 my-4">
      <div className="mb-2 flex justify-between items-center">
        <div className="text-sm font-semibold text-gray-700">
          {status}
        </div>
        {operationId && (
          <div className="text-xs text-gray-500">
            ID: {operationId.substring(0, 8)}...
          </div>
        )}
      </div>
      
      {/* Progress bar - visual indicator of completion percentage */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden" aria-label="progress bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div 
          className={`h-full ${getProgressColor(progress)} transition-all duration-700 ${isAnimating ? 'ease-out' : 'ease-in'} progress bar`}
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Progress percentage and time remaining */}
      <div className="flex justify-between mt-2 text-sm text-gray-600">
        <div>{Math.round(progress)}% complete</div>
        {timeRemaining !== undefined && timeRemaining > 0 && (
          <div>{formatTimeRemaining(timeRemaining)}</div>
        )}
      </div>
      
      {/* Step indicators (if step is provided) */}
      {step && (
        <div className="mt-4">
          <div className="flex justify-between items-center">
            <div className={`flex flex-col items-center ${getStepIndex(step) >= 0 ? 'text-primary-600' : 'text-gray-400'}`}>
              <div className={`w-4 h-4 rounded-full ${getStepIndex(step) >= 0 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
              <span className="text-xs mt-1">Initialize</span>
            </div>
            <div className={`flex-1 h-0.5 mx-1 ${getStepIndex(step) >= 1 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
            <div className={`flex flex-col items-center ${getStepIndex(step) >= 1 ? 'text-primary-600' : 'text-gray-400'}`}>
              <div className={`w-4 h-4 rounded-full ${getStepIndex(step) >= 1 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
              <span className="text-xs mt-1">Witness</span>
            </div>
            <div className={`flex-1 h-0.5 mx-1 ${getStepIndex(step) >= 2 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
            <div className={`flex flex-col items-center ${getStepIndex(step) >= 2 ? 'text-primary-600' : 'text-gray-400'}`}>
              <div className={`w-4 h-4 rounded-full ${getStepIndex(step) >= 2 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
              <span className="text-xs mt-1">Proof</span>
            </div>
            <div className={`flex-1 h-0.5 mx-1 ${getStepIndex(step) >= 3 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
            <div className={`flex flex-col items-center ${getStepIndex(step) >= 3 ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-4 h-4 rounded-full ${getStepIndex(step) >= 3 ? 'bg-green-600' : 'bg-gray-300'}`}></div>
              <span className="text-xs mt-1">Complete</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Cancel button - only show if operation is cancellable */}
      {isCancellable && onCancel && (
        <div className="mt-4 text-right">
          <button 
            onClick={onCancel}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Cancel Operation
          </button>
        </div>
      )}
    </div>
  );
};

export default ZKProgressIndicator;