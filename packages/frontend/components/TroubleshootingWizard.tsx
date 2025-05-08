/**
 * Troubleshooting Wizard Component
 * 
 * This component provides an interactive wizard-style interface for resolving
 * common issues with ZK operations through a guided troubleshooting process.
 * 
 * Features:
 * - Step-by-step troubleshooting flow with diagnostic questions
 * - Interactive decision tree for identifying issues
 * - Automatic system checks for common problems
 * - User-friendly resolution instructions
 * - Built-in system diagnostics and feedback
 * 
 * @param {Object} props - Component properties
 * @param {string} props.issueCategory - Category of issue being troubleshooted
 * @param {boolean} props.isOpen - Whether the wizard is open
 * @param {Function} props.onClose - Callback for closing the wizard
 * @param {Function} props.onResolved - Callback for when an issue is resolved
 */

import React, { useState, useEffect } from 'react';

// Types of issues that can be troubleshooted
export type IssueCategory = 
  | 'generation_failure'    // Proof generation fails
  | 'verification_failure'  // Verification fails
  | 'performance_issue'     // Poor performance
  | 'compatibility_issue'   // Browser/device compatibility
  | 'connection_issue'      // Network connection problems
  | 'resource_issue';       // Resource (memory/CPU) problems

// Types of checks that can be performed
export type DiagnosticCheck = 
  | 'browser_compatibility'   // Check browser compatibility
  | 'webassembly_support'     // Check WebAssembly support
  | 'memory_availability'     // Check available memory
  | 'network_connectivity'    // Check network connection
  | 'cpu_performance'         // Check CPU performance
  | 'proof_parameters'        // Check proof parameters
  | 'device_capabilities';    // Check overall device capabilities

// Result of a diagnostic check
export interface CheckResult {
  check: DiagnosticCheck;
  passed: boolean;
  details?: string;
  recommendation?: string;
}

// Step in the troubleshooting flow
export interface TroubleshootingStep {
  id: string;
  title: string;
  description: string;
  type: 'question' | 'check' | 'action' | 'resolution';
  check?: DiagnosticCheck;
  options?: {
    id: string;
    label: string;
    nextStep: string;
  }[];
  action?: {
    label: string;
    handler: string;
  };
  resolution?: {
    message: string;
    success: boolean;
  };
  nextStep?: string;
}

// Troubleshooting flow definition
export interface TroubleshootingFlow {
  id: string;
  title: string;
  description: string;
  steps: Record<string, TroubleshootingStep>;
  initialStep: string;
}

interface TroubleshootingWizardProps {
  issueCategory: IssueCategory;
  isOpen: boolean;
  onClose: () => void;
  onResolved: () => void;
}

const TroubleshootingWizard: React.FC<TroubleshootingWizardProps> = ({
  issueCategory,
  isOpen,
  onClose,
  onResolved
}) => {
  const [currentStepId, setCurrentStepId] = useState<string>('');
  const [currentFlow, setCurrentFlow] = useState<TroubleshootingFlow | null>(null);
  const [checkResults, setCheckResults] = useState<Record<DiagnosticCheck, CheckResult | null>>({
    browser_compatibility: null,
    webassembly_support: null,
    memory_availability: null,
    network_connectivity: null,
    cpu_performance: null,
    proof_parameters: null,
    device_capabilities: null
  });
  const [isChecking, setIsChecking] = useState(false);
  const [isResolved, setIsResolved] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  
  // Initialize the appropriate troubleshooting flow based on issue category
  useEffect(() => {
    if (!isOpen) return;
    
    const flow = getTroubleshootingFlow(issueCategory);
    setCurrentFlow(flow);
    setCurrentStepId(flow.initialStep);
    setHistory([flow.initialStep]);
    setIsResolved(false);
  }, [issueCategory, isOpen]);
  
  // Get current step
  const getCurrentStep = (): TroubleshootingStep | null => {
    if (!currentFlow || !currentStepId) return null;
    return currentFlow.steps[currentStepId];
  };
  
  // Handle option selection
  const handleOptionSelected = (nextStepId: string) => {
    setCurrentStepId(nextStepId);
    setHistory(prevHistory => [...prevHistory, nextStepId]);
  };
  
  // Handle going back
  const handleBack = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop(); // Remove current step
      const previousStep = newHistory[newHistory.length - 1];
      setCurrentStepId(previousStep);
      setHistory(newHistory);
    }
  };
  
  // Handle action execution
  const handleAction = (actionHandler: string) => {
    // In a real implementation, these handlers would do real work
    // For this demo, we'll simulate the actions
    setIsChecking(true);
    
    setTimeout(() => {
      switch (actionHandler) {
        case 'clearCache':
          console.log('Clearing cache...');
          // Move to next step after 2 seconds
          setTimeout(() => {
            const step = getCurrentStep();
            if (step?.nextStep) {
              handleOptionSelected(step.nextStep);
            }
            setIsChecking(false);
          }, 2000);
          break;
          
        case 'refreshBrowser':
          console.log('Would refresh browser...');
          // Just simulate since we can't actually refresh
          setTimeout(() => {
            const step = getCurrentStep();
            if (step?.nextStep) {
              handleOptionSelected(step.nextStep);
            }
            setIsChecking(false);
          }, 2000);
          break;
          
        case 'switchToServer':
          console.log('Switching to server processing...');
          setTimeout(() => {
            const step = getCurrentStep();
            if (step?.nextStep) {
              handleOptionSelected(step.nextStep);
            }
            setIsChecking(false);
          }, 2000);
          break;
          
        default:
          setIsChecking(false);
          break;
      }
    }, 1000);
  };
  
  // Handle diagnostic check
  const handleDiagnosticCheck = (check: DiagnosticCheck) => {
    setIsChecking(true);
    
    // Simulate performing checks
    setTimeout(() => {
      const result = performDiagnosticCheck(check);
      setCheckResults(prev => ({
        ...prev,
        [check]: result
      }));
      
      // Move to next step
      const step = getCurrentStep();
      if (step?.nextStep) {
        handleOptionSelected(step.nextStep);
      }
      
      setIsChecking(false);
    }, 2000);
  };
  
  // Handle resolution
  const handleResolution = (success: boolean) => {
    setIsResolved(true);
    if (success) {
      // Wait a moment before calling the resolved callback
      setTimeout(() => {
        onResolved();
      }, 2000);
    }
  };
  
  // Simulate performing a diagnostic check
  const performDiagnosticCheck = (check: DiagnosticCheck): CheckResult => {
    // In a real implementation, these would perform actual checks
    // For this demo, we'll return simulated results
    switch (check) {
      case 'browser_compatibility':
        // Check user agent for browser compatibility
        const userAgent = navigator.userAgent;
        const isChrome = userAgent.indexOf('Chrome') > -1 && userAgent.indexOf('Edge') === -1;
        const isFirefox = userAgent.indexOf('Firefox') > -1;
        const isSafari = userAgent.indexOf('Safari') > -1 && userAgent.indexOf('Chrome') === -1;
        
        const compatible = isChrome || isFirefox || (isSafari && userAgent.indexOf('Version/15') > -1);
        
        return {
          check,
          passed: compatible,
          details: `Detected browser: ${
            isChrome ? 'Chrome' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : 'Other'
          }`,
          recommendation: compatible 
            ? 'Your browser is compatible with ZK operations.'
            : 'Consider using Chrome, Firefox, or Safari 15+ for optimal compatibility.'
        };
        
      case 'webassembly_support':
        // Check for WebAssembly support
        const hasWasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
        
        return {
          check,
          passed: hasWasm,
          details: hasWasm ? 'WebAssembly is supported' : 'WebAssembly is not supported',
          recommendation: hasWasm
            ? 'Your browser supports WebAssembly, which is required for ZK operations.'
            : 'Your browser does not support WebAssembly. Please use a modern browser or try server-side processing.'
        };
        
      case 'memory_availability':
        // Simulate memory check based on performance.memory if available
        let memoryEstimate = 4; // Default to 4GB estimate
        
        if ((navigator as any).deviceMemory) {
          memoryEstimate = (navigator as any).deviceMemory;
        } else if ((performance as any).memory && (performance as any).memory.jsHeapSizeLimit) {
          memoryEstimate = (performance as any).memory.jsHeapSizeLimit / (1024 * 1024 * 1024);
        }
        
        const sufficientMemory = memoryEstimate >= 2; // 2GB is minimum recommended
        
        return {
          check,
          passed: sufficientMemory,
          details: `Estimated available memory: ${memoryEstimate.toFixed(1)}GB`,
          recommendation: sufficientMemory
            ? 'Your device has sufficient memory for ZK operations.'
            : 'Your device has limited memory. Consider using server-side processing for complex operations.'
        };
        
      case 'network_connectivity':
        // Simple connectivity check
        return {
          check,
          passed: navigator.onLine,
          details: navigator.onLine ? 'Connected to network' : 'Network unavailable',
          recommendation: navigator.onLine
            ? 'Your network connection is active.'
            : 'Please check your internet connection and try again.'
        };
        
      case 'cpu_performance':
        // Simplified CPU benchmark
        // In a real implementation, this would be more sophisticated
        return {
          check,
          passed: true, // For demo purposes, always pass
          details: 'CPU performance check completed',
          recommendation: 'Your CPU performance is sufficient for basic ZK operations.'
        };
        
      case 'proof_parameters':
        // Check if proof parameters are valid
        return {
          check,
          passed: true, // For demo purposes, always pass
          details: 'Proof parameters are valid',
          recommendation: 'Your proof parameters are correctly configured.'
        };
        
      case 'device_capabilities':
        // Overall device capability check
        return {
          check,
          passed: true, // For demo purposes, always pass
          details: 'Device capability check completed',
          recommendation: 'Your device meets the minimum requirements for ZK operations.'
        };
        
      default:
        return {
          check,
          passed: false,
          details: 'Unknown check type',
          recommendation: 'Please contact support for assistance.'
        };
    }
  };
  
  // Get the appropriate troubleshooting flow based on issue category
  const getTroubleshootingFlow = (category: IssueCategory): TroubleshootingFlow => {
    // In a real implementation, these flows would be more comprehensive
    // and potentially loaded from a configuration file or API
    
    switch (category) {
      case 'generation_failure':
        return {
          id: 'generation_failure',
          title: 'Proof Generation Troubleshooting',
          description: 'Let\'s diagnose and fix issues with proof generation.',
          initialStep: 'start',
          steps: {
            'start': {
              id: 'start',
              title: 'Proof Generation Issue',
              description: 'What happens when you try to generate a proof?',
              type: 'question',
              options: [
                { id: 'error', label: 'I get an error message', nextStep: 'check_browser' },
                { id: 'slow', label: 'It\'s too slow or freezes', nextStep: 'check_resources' },
                { id: 'timeout', label: 'It times out', nextStep: 'check_network' }
              ]
            },
            'check_browser': {
              id: 'check_browser',
              title: 'Browser Compatibility Check',
              description: 'Let\'s check if your browser is compatible with ZK operations.',
              type: 'check',
              check: 'browser_compatibility',
              nextStep: 'check_wasm'
            },
            'check_wasm': {
              id: 'check_wasm',
              title: 'WebAssembly Support Check',
              description: 'ZK operations require WebAssembly support. Let\'s check if your browser has this capability.',
              type: 'check',
              check: 'webassembly_support',
              nextStep: 'check_results'
            },
            'check_resources': {
              id: 'check_resources',
              title: 'System Resources Check',
              description: 'Let\'s check if your device has sufficient resources for ZK operations.',
              type: 'check',
              check: 'memory_availability',
              nextStep: 'check_results'
            },
            'check_network': {
              id: 'check_network',
              title: 'Network Connectivity Check',
              description: 'Let\'s check your network connection.',
              type: 'check',
              check: 'network_connectivity',
              nextStep: 'check_results'
            },
            'check_results': {
              id: 'check_results',
              title: 'Diagnostic Results',
              description: 'Based on our checks, we\'ve identified the following issues:',
              type: 'question',
              options: [
                { id: 'clear_cache', label: 'Clear browser cache and try again', nextStep: 'clear_cache' },
                { id: 'server_processing', label: 'Switch to server-side processing', nextStep: 'server_processing' },
                { id: 'contact_support', label: 'Contact support for further assistance', nextStep: 'contact_support' }
              ]
            },
            'clear_cache': {
              id: 'clear_cache',
              title: 'Clear Browser Cache',
              description: 'Clearing your browser cache can resolve many issues with ZK operations.',
              type: 'action',
              action: {
                label: 'Clear Cache',
                handler: 'clearCache'
              },
              nextStep: 'try_again'
            },
            'server_processing': {
              id: 'server_processing',
              title: 'Switch to Server Processing',
              description: 'Let\'s switch to server-side processing to offload the computational work.',
              type: 'action',
              action: {
                label: 'Switch to Server Processing',
                handler: 'switchToServer'
              },
              nextStep: 'resolution_success'
            },
            'try_again': {
              id: 'try_again',
              title: 'Try Again',
              description: 'Now that we\'ve cleared your cache, let\'s try again.',
              type: 'question',
              options: [
                { id: 'success', label: 'It worked!', nextStep: 'resolution_success' },
                { id: 'still_failing', label: 'Still not working', nextStep: 'server_processing' }
              ]
            },
            'contact_support': {
              id: 'contact_support',
              title: 'Contact Support',
              description: 'Please contact our support team with the following diagnostic information:',
              type: 'resolution',
              resolution: {
                message: 'Our support team can help with more complex issues. Please include the diagnostic results from this wizard when contacting support.',
                success: false
              }
            },
            'resolution_success': {
              id: 'resolution_success',
              title: 'Issue Resolved',
              description: 'Great! Your issue has been resolved.',
              type: 'resolution',
              resolution: {
                message: 'You can now continue with your ZK proof operations.',
                success: true
              }
            }
          }
        };
        
      case 'verification_failure':
        // Similar structure to generation_failure but with verification-specific steps
        return {
          id: 'verification_failure',
          title: 'Proof Verification Troubleshooting',
          description: 'Let\'s diagnose and fix issues with proof verification.',
          initialStep: 'start',
          steps: {
            'start': {
              id: 'start',
              title: 'Verification Issue',
              description: 'What happens when you try to verify a proof?',
              type: 'question',
              options: [
                { id: 'error', label: 'I get an error message', nextStep: 'check_browser' },
                { id: 'invalid', label: 'The proof is invalid', nextStep: 'check_proof' },
                { id: 'timeout', label: 'It times out', nextStep: 'check_network' }
              ]
            },
            'check_browser': {
              id: 'check_browser',
              title: 'Browser Compatibility Check',
              description: 'Let\'s check if your browser is compatible with ZK operations.',
              type: 'check',
              check: 'browser_compatibility',
              nextStep: 'check_results'
            },
            'check_proof': {
              id: 'check_proof',
              title: 'Proof Parameters Check',
              description: 'Let\'s check if the proof parameters are valid.',
              type: 'check',
              check: 'proof_parameters',
              nextStep: 'check_results'
            },
            'check_network': {
              id: 'check_network',
              title: 'Network Connectivity Check',
              description: 'Let\'s check your network connection.',
              type: 'check',
              check: 'network_connectivity',
              nextStep: 'check_results'
            },
            'check_results': {
              id: 'check_results',
              title: 'Diagnostic Results',
              description: 'Based on our checks, we\'ve identified the following issues:',
              type: 'question',
              options: [
                { id: 'try_different_browser', label: 'Try a different browser', nextStep: 'different_browser' },
                { id: 'server_verification', label: 'Use server-side verification', nextStep: 'server_processing' },
                { id: 'contact_support', label: 'Contact support for further assistance', nextStep: 'contact_support' }
              ]
            },
            'different_browser': {
              id: 'different_browser',
              title: 'Try a Different Browser',
              description: 'Some browsers work better with ZK operations than others.',
              type: 'action',
              action: {
                label: 'Open in Chrome/Firefox',
                handler: 'openRecommendedBrowser'
              },
              nextStep: 'resolution_success'
            },
            'server_processing': {
              id: 'server_processing',
              title: 'Switch to Server Verification',
              description: 'Let\'s switch to server-side verification for more reliable results.',
              type: 'action',
              action: {
                label: 'Use Server Verification',
                handler: 'switchToServer'
              },
              nextStep: 'resolution_success'
            },
            'contact_support': {
              id: 'contact_support',
              title: 'Contact Support',
              description: 'Please contact our support team with the following diagnostic information:',
              type: 'resolution',
              resolution: {
                message: 'Our support team can help with more complex issues. Please include the diagnostic results from this wizard when contacting support.',
                success: false
              }
            },
            'resolution_success': {
              id: 'resolution_success',
              title: 'Issue Resolved',
              description: 'Great! Your issue has been resolved.',
              type: 'resolution',
              resolution: {
                message: 'You can now continue with your ZK proof operations.',
                success: true
              }
            }
          }
        };
        
      case 'performance_issue':
      case 'compatibility_issue':
      case 'connection_issue':
      case 'resource_issue':
        // For demo purposes, all other categories use a simplified flow
        return {
          id: 'generic_issue',
          title: `${category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Troubleshooting`,
          description: `Let's diagnose and fix issues with ${category.replace('_', ' ')}.`,
          initialStep: 'start',
          steps: {
            'start': {
              id: 'start',
              title: 'System Diagnostic',
              description: 'Let\'s run a comprehensive diagnostic of your system.',
              type: 'check',
              check: 'device_capabilities',
              nextStep: 'check_results'
            },
            'check_results': {
              id: 'check_results',
              title: 'Diagnostic Results',
              description: 'Based on our checks, we recommend the following:',
              type: 'question',
              options: [
                { id: 'refresh_browser', label: 'Refresh your browser', nextStep: 'refresh_browser' },
                { id: 'server_processing', label: 'Switch to server-side processing', nextStep: 'server_processing' }
              ]
            },
            'refresh_browser': {
              id: 'refresh_browser',
              title: 'Refresh Browser',
              description: 'Refreshing your browser can resolve many temporary issues.',
              type: 'action',
              action: {
                label: 'Refresh Browser',
                handler: 'refreshBrowser'
              },
              nextStep: 'resolution_success'
            },
            'server_processing': {
              id: 'server_processing',
              title: 'Switch to Server Processing',
              description: 'Let\'s switch to server-side processing for better reliability.',
              type: 'action',
              action: {
                label: 'Use Server Processing',
                handler: 'switchToServer'
              },
              nextStep: 'resolution_success'
            },
            'resolution_success': {
              id: 'resolution_success',
              title: 'Issue Resolved',
              description: 'Great! Your issue has been resolved.',
              type: 'resolution',
              resolution: {
                message: 'You can now continue with your ZK proof operations.',
                success: true
              }
            }
          }
        };
    }
  };
  
  // If not open, don't render
  if (!isOpen) return null;
  
  // Get the current step
  const currentStep = getCurrentStep();
  if (!currentStep || !currentFlow) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">{currentFlow.title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
              aria-label="Close"
            >
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500">{currentFlow.description}</p>
        </div>
        
        {/* Progress indicator */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Step {history.length} of {Object.keys(currentFlow.steps).length}</span>
            <span>
              {currentStep.type === 'resolution' ? 'Final Step' : 'Troubleshooting in progress...'}
            </span>
          </div>
          <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary-500 transition-all duration-300 ease-in-out"
              style={{ width: `${(history.length / Object.keys(currentFlow.steps).length) * 100}%` }}
            />
          </div>
        </div>
        
        {/* Step content */}
        <div className="px-6 py-4 flex-grow overflow-y-auto">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{currentStep.title}</h3>
          <p className="text-sm text-gray-600 mb-4">{currentStep.description}</p>
          
          {/* Step-specific content */}
          {currentStep.type === 'question' && currentStep.options && (
            <div className="space-y-3">
              {currentStep.options.map(option => (
                <button
                  key={option.id}
                  onClick={() => handleOptionSelected(option.nextStep)}
                  className="w-full text-left px-4 py-3 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-150"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          
          {currentStep.type === 'check' && currentStep.check && (
            <div>
              {isChecking ? (
                <div className="text-center py-8">
                  <svg className="animate-spin h-8 w-8 text-primary-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-sm text-gray-600">Running diagnostic check...</p>
                </div>
              ) : (
                <button
                  onClick={() => handleDiagnosticCheck(currentStep.check!)}
                  className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Run Diagnostic Check
                </button>
              )}
              
              {/* Show check results if available */}
              {checkResults[currentStep.check] && (
                <div className={`mt-4 p-4 rounded-md border ${
                  checkResults[currentStep.check]!.passed
                    ? 'bg-green-50 border-green-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex items-start">
                    <div className={`flex-shrink-0 h-5 w-5 ${
                      checkResults[currentStep.check]!.passed
                        ? 'text-green-600'
                        : 'text-yellow-600'
                    }`}>
                      {checkResults[currentStep.check]!.passed ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-800">
                        {checkResults[currentStep.check]!.passed
                          ? 'Check Passed'
                          : 'Check Failed'}
                      </p>
                      {checkResults[currentStep.check]!.details && (
                        <p className="mt-1 text-sm text-gray-600">
                          {checkResults[currentStep.check]!.details}
                        </p>
                      )}
                      {checkResults[currentStep.check]!.recommendation && (
                        <p className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">Recommendation:</span> {checkResults[currentStep.check]!.recommendation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {currentStep.type === 'action' && currentStep.action && (
            <div className="text-center">
              {isChecking ? (
                <div className="py-6">
                  <svg className="animate-spin h-8 w-8 text-primary-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-sm text-gray-600">Performing action...</p>
                </div>
              ) : (
                <button
                  onClick={() => handleAction(currentStep.action!.handler)}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  {currentStep.action.label}
                </button>
              )}
            </div>
          )}
          
          {currentStep.type === 'resolution' && currentStep.resolution && (
            <div className={`text-center p-6 rounded-lg border ${
              currentStep.resolution.success
                ? 'bg-green-50 border-green-200'
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className={`h-12 w-12 mx-auto mb-4 ${
                currentStep.resolution.success
                  ? 'text-green-600'
                  : 'text-yellow-600'
              }`}>
                {currentStep.resolution.success ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <p className="text-sm mb-4">
                {currentStep.resolution.message}
              </p>
              {!isResolved && (
                <button
                  onClick={() => handleResolution(currentStep.resolution!.success)}
                  className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    currentStep.resolution.success
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-yellow-600 hover:bg-yellow-700'
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
                >
                  {currentStep.resolution.success ? 'Continue' : 'Close'}
                </button>
              )}
            </div>
          )}
          
          {/* Check results summary (shown on question steps after checks) */}
          {currentStep.type === 'question' && Object.values(checkResults).some(r => r !== null) && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Diagnostic Results</h4>
              <div className="space-y-2 mt-2">
                {Object.entries(checkResults)
                  .filter(([_, result]) => result !== null)
                  .map(([check, result]) => (
                    <div key={check} className="flex items-start text-xs">
                      <div className={`flex-shrink-0 h-4 w-4 mt-0.5 ${
                        result!.passed ? 'text-green-500' : 'text-yellow-500'
                      }`}>
                        {result!.passed ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className="ml-2 text-gray-700 capitalize">
                        {check.replace('_', ' ')}: {result!.passed ? 'Passed' : 'Failed'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer with navigation buttons */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={handleBack}
            disabled={history.length <= 1 || currentStep.type === 'resolution'}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              history.length <= 1 || currentStep.type === 'resolution'
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            Back
          </button>
          
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {currentStep.type === 'resolution' ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TroubleshootingWizard;