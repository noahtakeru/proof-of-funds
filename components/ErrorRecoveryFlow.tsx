/**
 * Error Recovery Flow Component
 * 
 * This component provides a guided process for recovering from errors that occur
 * during ZK operations, helping users resolve issues with minimal technical knowledge.
 * 
 * Features:
 * - Step-by-step recovery process for different error types
 * - Automated suggestions based on error analysis
 * - User-friendly explanations and instructions
 * - Interactive troubleshooting options
 * - Support for both automated and manual recovery paths
 * 
 * @param {Object} props - Component properties
 * @param {Object} props.error - Error object with details about the error
 * @param {Function} props.onRecoveryAction - Callback for recovery actions
 * @param {Function} props.onCancel - Callback to cancel recovery flow
 * @param {boolean} props.showTechnicalDetails - Whether to show technical details
 */

import React, { useState, useEffect } from 'react';

export interface ZKError {
  code: string;
  message: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  context?: {
    operation?: string;
    component?: string;
    inputData?: any;
  };
  technicalDetails?: string;
  recoverable: boolean;
  suggestedActions?: string[];
}

export type RecoveryAction = 
  | 'retry'               // Retry the operation
  | 'retry_with_params'   // Retry with modified parameters
  | 'server_fallback'     // Switch to server-side processing
  | 'clear_cache'         // Clear cached data
  | 'refresh_browser'     // Suggest browser refresh
  | 'update_browser'      // Suggest browser update
  | 'check_connection'    // Check network connection
  | 'free_memory'         // Free up system memory
  | 'contact_support';    // Contact support for assistance

interface ErrorRecoveryFlowProps {
  error: ZKError;
  onRecoveryAction: (action: RecoveryAction, params?: any) => void;
  onCancel: () => void;
  showTechnicalDetails?: boolean;
}

const ErrorRecoveryFlow: React.FC<ErrorRecoveryFlowProps> = ({
  error,
  onRecoveryAction,
  onCancel,
  showTechnicalDetails = false
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [recoveryPlan, setRecoveryPlan] = useState<{ title: string; description: string; action: RecoveryAction; actionLabel: string; requiresInput?: boolean; }[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [customParams, setCustomParams] = useState<any>({});
  const [showDetails, setShowDetails] = useState(showTechnicalDetails);
  
  // Analyze error and create recovery plan
  useEffect(() => {
    setIsAnalyzing(true);
    
    // Simulate analysis (this would be more complex in a real implementation)
    const timeout = setTimeout(() => {
      const plan = createRecoveryPlan(error);
      setRecoveryPlan(plan);
      setIsAnalyzing(false);
    }, 1000); // Simulate 1 second of "analysis"
    
    return () => clearTimeout(timeout);
  }, [error]);
  
  // Create a recovery plan based on the error
  const createRecoveryPlan = (error: ZKError) => {
    // Default plan if error is not recoverable
    if (!error.recoverable) {
      return [
        {
          title: 'Unrecoverable Error',
          description: 'This error cannot be automatically resolved. Please contact support for assistance.',
          action: 'contact_support' as RecoveryAction,
          actionLabel: 'Contact Support'
        }
      ];
    }
    
    // Build a plan based on error code
    const plan: { title: string; description: string; action: RecoveryAction; actionLabel: string; requiresInput?: boolean; }[] = [];
    
    // First check for connection issues
    if (error.code === 'NETWORK_ERROR' || error.code === 'CONNECTION_FAILED') {
      plan.push({
        title: 'Check Your Connection',
        description: 'Your internet connection appears to be unavailable or unstable. Please check your network and try again.',
        action: 'check_connection',
        actionLabel: 'My Connection is Working'
      });
      
      plan.push({
        title: 'Try Again',
        description: 'Now that your connection is working, we can try the operation again.',
        action: 'retry',
        actionLabel: 'Retry Operation'
      });
    }
    // Memory issues
    else if (error.code === 'MEMORY_INSUFFICIENT' || error.code === 'OUT_OF_MEMORY') {
      plan.push({
        title: 'Free Up Resources',
        description: 'Your device is running low on memory. Please close other applications and browser tabs to free up resources.',
        action: 'free_memory',
        actionLabel: "I've Freed Up Resources"
      });
      
      plan.push({
        title: 'Use Server Processing',
        description: 'For complex operations, you can use our server to handle the processing instead of your device.',
        action: 'server_fallback',
        actionLabel: 'Switch to Server Processing'
      });
    }
    // Browser compatibility issues
    else if (error.code === 'BROWSER_UNSUPPORTED' || error.code === 'WASM_UNSUPPORTED') {
      plan.push({
        title: 'Browser Compatibility Issue',
        description: 'Your browser does not fully support the required features for this operation. We recommend updating your browser or trying a different one like Chrome or Firefox.',
        action: 'update_browser',
        actionLabel: 'Got It'
      });
      
      plan.push({
        title: 'Use Server Processing',
        description: 'You can continue by using our server to handle the processing instead of your browser.',
        action: 'server_fallback',
        actionLabel: 'Switch to Server Processing'
      });
    }
    // Corrupted cache or data
    else if (error.code === 'CACHE_CORRUPTED' || error.code === 'DATA_INTEGRITY_ERROR') {
      plan.push({
        title: 'Clear Cache',
        description: 'The cached data may be corrupted. Clearing the cache can often resolve this issue.',
        action: 'clear_cache',
        actionLabel: 'Clear Cache'
      });
      
      plan.push({
        title: 'Try Again',
        description: 'Now that the cache is cleared, we can try the operation again with fresh data.',
        action: 'retry',
        actionLabel: 'Retry Operation'
      });
    }
    // Parameter issues
    else if (error.code === 'INVALID_PARAMETER' || error.code === 'PARAMETER_OUT_OF_RANGE') {
      plan.push({
        title: 'Adjust Parameters',
        description: 'The parameters provided for this operation may be causing issues. We can try with adjusted parameters that are more likely to succeed.',
        action: 'retry_with_params',
        actionLabel: 'Continue with Adjusted Parameters',
        requiresInput: true
      });
    }
    // Default recovery plan for other errors
    else {
      plan.push({
        title: 'Retry Operation',
        description: 'Let\'s try the operation again, which often resolves temporary issues.',
        action: 'retry',
        actionLabel: 'Retry Operation'
      });
      
      if (error.severity === 'critical' || error.severity === 'error') {
        plan.push({
          title: 'Use Server Processing',
          description: 'For better reliability, you can use our server to handle the processing instead of your device.',
          action: 'server_fallback',
          actionLabel: 'Switch to Server Processing'
        });
      }
    }
    
    return plan;
  };
  
  // Handle an action being taken
  const handleActionClick = () => {
    const currentAction = recoveryPlan[currentStep];
    
    // If action requires input, pass the custom params
    if (currentAction.requiresInput) {
      onRecoveryAction(currentAction.action, customParams);
    } else {
      onRecoveryAction(currentAction.action);
    }
    
    // Move to next step if available
    if (currentStep < recoveryPlan.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Last step - close the flow
      onCancel();
    }
  };
  
  // Set parameter value
  const handleParamChange = (key: string, value: any) => {
    setCustomParams(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  // Get suggested parameters based on error
  const getSuggestedParams = () => {
    // In a real implementation, this would analyze the error and suggest
    // appropriate parameters. Here we provide some samples.
    if (error.code === 'INVALID_PARAMETER') {
      return {
        memoryLimit: error.context?.inputData?.memoryLimit 
          ? Math.floor(error.context.inputData.memoryLimit * 0.8) 
          : 200,
        timeout: error.context?.inputData?.timeout 
          ? Math.floor(error.context.inputData.timeout * 1.5) 
          : 30000
      };
    }
    
    if (error.code === 'PARAMETER_OUT_OF_RANGE') {
      return {
        batchSize: error.context?.inputData?.batchSize 
          ? Math.floor(error.context.inputData.batchSize / 2) 
          : 50
      };
    }
    
    return {};
  };
  
  // Render parameter adjustment controls
  const renderParamControls = () => {
    const suggestedParams = getSuggestedParams();
    
    return (
      <div className="space-y-4 mt-4 p-3 bg-gray-50 rounded-md">
        <h4 className="text-sm font-medium text-gray-700">Suggested Parameter Adjustments</h4>
        
        {Object.entries(suggestedParams).map(([key, value]) => (
          <div key={key} className="flex flex-col space-y-1">
            <label className="text-xs text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
            <input
              type="range"
              min={typeof value === 'number' ? Math.floor(value * 0.5) : 0}
              max={typeof value === 'number' ? Math.ceil(value * 2) : 100}
              value={customParams[key] || value}
              onChange={(e) => handleParamChange(key, parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Min: {typeof value === 'number' ? Math.floor(value * 0.5) : 0}</span>
              <span>Current: {customParams[key] || value}</span>
              <span>Max: {typeof value === 'number' ? Math.ceil(value * 2) : 100}</span>
            </div>
          </div>
        ))}
        
        <p className="text-xs text-gray-500 mt-2">
          These parameters have been adjusted to increase the likelihood of success.
        </p>
      </div>
    );
  };
  
  // If still analyzing, show loading state
  if (isAnalyzing) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
        <div className="flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm text-gray-700 font-medium">Analyzing error and creating recovery plan...</span>
        </div>
      </div>
    );
  }
  
  // If no plan could be created
  if (recoveryPlan.length === 0) {
    return (
      <div className="bg-white border border-red-200 rounded-lg shadow-sm p-4">
        <div className="text-center">
          <div className="flex-shrink-0 mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="mt-2 text-base font-medium text-gray-900">Recovery Not Available</h3>
          <p className="mt-1 text-sm text-gray-500">
            We couldn't create a recovery plan for this error. Please try again later or contact support.
          </p>
          <div className="mt-4">
            <button
              onClick={onCancel}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  const currentStepData = recoveryPlan[currentStep];
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Progress indicator */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">
            Error Recovery
          </h3>
          <div className="flex items-center text-sm text-gray-500">
            Step {currentStep + 1} of {recoveryPlan.length}
          </div>
        </div>
        <div className="mt-2 relative">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary-500 transition-all duration-300 ease-in-out"
              style={{ width: `${((currentStep + 1) / recoveryPlan.length) * 100}%` }}
            />
          </div>
          <div className="absolute top-0 left-0 right-0 flex justify-between">
            {recoveryPlan.map((_, index) => (
              <div 
                key={index}
                className={`h-2 w-2 rounded-full ${
                  index <= currentStep ? 'bg-primary-500' : 'bg-gray-300'
                } transform translate-y-(-50%)`}
                style={{ marginLeft: `${(index / (recoveryPlan.length - 1)) * 100}%` }}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Step content */}
      <div className="p-4">
        <div className="text-center mb-4">
          <h4 className="text-lg font-medium text-gray-800">{currentStepData.title}</h4>
          <p className="text-sm text-gray-600 mt-1">{currentStepData.description}</p>
        </div>
        
        {/* Parameter adjustment controls if needed */}
        {currentStepData.requiresInput && renderParamControls()}
        
        {/* Error information toggle */}
        <div className="mt-6">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center text-sm text-gray-600 hover:text-gray-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 mr-1 transition-transform ${showDetails ? 'transform rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showDetails ? 'Hide' : 'Show'} Error Details
          </button>
          
          {showDetails && (
            <div className="mt-2 p-3 bg-gray-50 rounded-md text-xs">
              <div className="space-y-2">
                <div>
                  <span className="font-medium text-gray-700">Error Code:</span>
                  <span className="ml-2 text-gray-600">{error.code}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Message:</span>
                  <span className="ml-2 text-gray-600">{error.message}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Severity:</span>
                  <span className={`ml-2 ${
                    error.severity === 'critical' ? 'text-red-600' :
                    error.severity === 'error' ? 'text-orange-600' :
                    error.severity === 'warning' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`}>
                    {error.severity.charAt(0).toUpperCase() + error.severity.slice(1)}
                  </span>
                </div>
                {error.context && (
                  <div>
                    <span className="font-medium text-gray-700">Context:</span>
                    <div className="mt-1 ml-2 text-gray-600">
                      {error.context.operation && (
                        <div>Operation: {error.context.operation}</div>
                      )}
                      {error.context.component && (
                        <div>Component: {error.context.component}</div>
                      )}
                    </div>
                  </div>
                )}
                {error.technicalDetails && (
                  <div>
                    <span className="font-medium text-gray-700">Technical Details:</span>
                    <pre className="mt-1 p-2 bg-gray-100 rounded overflow-x-auto text-xs text-gray-600">
                      {error.technicalDetails}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Cancel
          </button>
          <button
            onClick={handleActionClick}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            {currentStepData.actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorRecoveryFlow;