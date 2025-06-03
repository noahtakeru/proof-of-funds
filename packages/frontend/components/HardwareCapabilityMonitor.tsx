/**
 * Hardware Capability Monitor Component
 * 
 * This component analyzes the user's device capabilities and provides feedback
 * on its suitability for ZK operations, with recommendations for optimal performance.
 * 
 * Features:
 * - Browser compatibility detection
 * - Hardware capability assessment
 * - Memory availability monitoring
 * - WebAssembly support detection
 * - Recommendations based on device capabilities
 * 
 * @param {Object} props - Component properties
 * @param {boolean} props.showDetails - Whether to show detailed capability information
 * @param {Function} props.onServerFallbackRequest - Callback for requesting server fallback
 * @param {boolean} props.isExpanded - Whether the component is expanded
 * @param {Function} props.onToggleExpand - Callback for toggling expanded state
 */

import React, { useEffect, useState } from 'react';

interface HardwareCapabilities {
  browserName: string;
  browserVersion: string;
  isCompatible: boolean;
  hasWasm: boolean;
  memoryScore: number;
  cpuScore: number;
  overallScore: number;
  isMobile: boolean;
  hasWebCrypto: boolean;
  recommendations: string[];
}

const HardwareCapabilityMonitor: React.FC<{
  showDetails?: boolean;
  onServerFallbackRequest?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}> = ({ 
  showDetails = false, 
  onServerFallbackRequest,
  isExpanded = false,
  onToggleExpand
}) => {
  const [capabilities, setCapabilities] = useState<HardwareCapabilities | null>(null);
  const [loading, setLoading] = useState(true);

  // Detect browser and device capabilities
  useEffect(() => {
    const detectCapabilities = async () => {
      try {
        setLoading(true);
        
        // Get browser info
        const userAgent = navigator.userAgent;
        let browserName = 'Unknown';
        let browserVersion = 'Unknown';
        
        if (userAgent.indexOf('Chrome') > -1) {
          browserName = 'Chrome';
          browserVersion = userAgent.match(/Chrome\/([0-9.]+)/)![1];
        } else if (userAgent.indexOf('Firefox') > -1) {
          browserName = 'Firefox';
          browserVersion = userAgent.match(/Firefox\/([0-9.]+)/)![1];
        } else if (userAgent.indexOf('Safari') > -1) {
          browserName = 'Safari';
          browserVersion = userAgent.match(/Version\/([0-9.]+)/)![1];
        } else if (userAgent.indexOf('Edge') > -1 || userAgent.indexOf('Edg') > -1) {
          browserName = 'Edge';
          browserVersion = userAgent.match(/Edge?\/([0-9.]+)/)![1];
        }
        
        // Check for mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        
        // Check WebAssembly support
        const hasWasm = typeof WebAssembly === 'object' && 
                         typeof WebAssembly.instantiate === 'function';
        
        // Check WebCrypto support
        const hasWebCrypto = typeof window.crypto !== 'undefined' &&
                             typeof window.crypto.subtle !== 'undefined';
        
        // Calculate memory score (based on simple estimation)
        const memoryScore = getMemoryScore();
        
        // Calculate CPU score with a simple benchmark
        const cpuScore = await calculateCpuScore();
        
        // Calculate overall score (weighted average)
        const overallScore = Math.round(
          (memoryScore * 0.4) + (cpuScore * 0.5) + (hasWasm ? 10 : 0) * 0.1
        );
        
        // General compatibility check
        const isCompatible = hasWasm && 
                          hasWebCrypto && 
                          overallScore >= 5 &&
                          !isLegacyBrowser(browserName, browserVersion);
        
        // Generate recommendations
        const recommendations: string[] = [];
        
        if (!hasWasm) {
          recommendations.push('Your browser doesn\'t support WebAssembly, which is required for ZK operations. Try updating your browser.');
        }
        
        if (!hasWebCrypto) {
          recommendations.push('Your browser doesn\'t support the Web Cryptography API. Consider using a modern browser.');
        }
        
        if (memoryScore < 5) {
          recommendations.push('Your device may have limited memory. Consider using server-side processing for complex operations.');
        }
        
        if (cpuScore < 5) {
          recommendations.push('Your device has limited processing power for ZK operations. Proofs may take longer to generate.');
        }
        
        if (isMobile && overallScore < 7) {
          recommendations.push('Mobile devices may struggle with ZK proofs. Consider using a desktop for better performance.');
        }
        
        if (isLegacyBrowser(browserName, browserVersion)) {
          recommendations.push(`Your browser (${browserName} ${browserVersion}) may have limited support. Consider updating.`);
        }
        
        // If compatible but with limitations, suggest optimizations
        if (isCompatible && overallScore < 8) {
          recommendations.push('Close other tabs and applications for better performance during ZK operations.');
        }
        
        // Set capabilities state
        setCapabilities({
          browserName,
          browserVersion,
          isCompatible,
          hasWasm,
          memoryScore,
          cpuScore,
          overallScore,
          isMobile,
          hasWebCrypto,
          recommendations
        });
      } catch (error) {
        console.error('Error detecting capabilities:', error);
      } finally {
        setLoading(false);
      }
    };
    
    detectCapabilities();
  }, []);

  // Check if browser is legacy
  const isLegacyBrowser = (browserName: string, version: string): boolean => {
    try {
      const versionNum = parseFloat(version);
      
      switch (browserName) {
        case 'Chrome': return versionNum < 70;
        case 'Firefox': return versionNum < 65;
        case 'Safari': return versionNum < 13;
        case 'Edge': return versionNum < 79;
        default: return false;
      }
    } catch {
      return false;
    }
  };

  // Estimate available memory
  const getMemoryScore = (): number => {
    // Try to use performance.memory if available (Chrome)
    const memory = (navigator as any).deviceMemory || 
                 ((performance as any).memory && (performance as any).memory.jsHeapSizeLimit / (1024 * 1024 * 1024));
    
    if (memory) {
      // Convert to score between 1-10
      return Math.min(10, Math.max(1, Math.ceil(memory * 2)));
    }
    
    // Fallback estimation based on platform
    const userAgent = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      return 6; // iOS devices typically have decent memory
    } else if (/Android/i.test(userAgent)) {
      return 5; // Assume mid-range for Android
    }
    
    return 7; // Default to above average for desktops
  };

  // Simple CPU benchmark
  const calculateCpuScore = async (): Promise<number> => {
    const startTime = performance.now();
    
    // Perform a simple computation benchmark
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sin(i * 0.01) * Math.cos(i * 0.01);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Convert duration to score between 1-10 (lower duration = higher score)
    // Calibrated for modern devices: ~50ms = score 10, ~500ms = score 1
    const score = Math.min(10, Math.max(1, 11 - (duration / 50)));
    
    return score;
  };

  // Get color class based on score
  const getScoreColorClass = (score: number): string => {
    if (score >= 8) {return 'text-green-600';}
    if (score >= 5) {return 'text-yellow-600';}
    return 'text-red-600';
  };

  // Get score label based on score
  const getScoreLabel = (score: number): string => {
    if (score >= 8) {return 'Excellent';}
    if (score >= 6) {return 'Good';}
    if (score >= 4) {return 'Moderate';}
    return 'Limited';
  };

  if (loading) {
    return (
      <div className="rounded-md bg-gray-50 p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  const handleExpandToggle = () => {
    if (onToggleExpand) {
      onToggleExpand();
    }
  };

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4 mb-4">
      <div className="flex justify-between items-center cursor-pointer" onClick={handleExpandToggle}>
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-2 ${capabilities?.isCompatible ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          <h3 className="text-sm font-medium text-gray-900">
            Device Compatibility
          </h3>
        </div>
        <button 
          className="text-gray-500 hover:text-gray-700" 
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-5 w-5 transition-transform duration-200 ${isExpanded ? 'transform rotate-180' : ''}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      
      {isExpanded && capabilities && (
        <div className="mt-3">
          {/* Basic information */}
          <div className="flex flex-wrap justify-between mb-4">
            <div className="text-sm">
              <span className="text-gray-500">Browser:</span> {capabilities.browserName} {capabilities.browserVersion}
            </div>
            <div className="text-sm">
              <span className="text-gray-500">Device Type:</span> {capabilities.isMobile ? 'Mobile' : 'Desktop'}
            </div>
          </div>
          
          {/* Capability scores */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="text-center p-2 border border-gray-100 rounded-md bg-gray-50">
              <div className="text-xs text-gray-500 mb-1">Overall Score</div>
              <div className={`text-xl font-bold ${getScoreColorClass(capabilities.overallScore)}`}>
                {capabilities.overallScore}/10
              </div>
              <div className="text-xs mt-1">
                {getScoreLabel(capabilities.overallScore)}
              </div>
            </div>
            
            <div className="text-center p-2 border border-gray-100 rounded-md bg-gray-50">
              <div className="text-xs text-gray-500 mb-1">Processing Power</div>
              <div className={`text-xl font-bold ${getScoreColorClass(capabilities.cpuScore)}`}>
                {capabilities.cpuScore.toFixed(1)}/10
              </div>
              <div className="text-xs mt-1">
                {getScoreLabel(capabilities.cpuScore)}
              </div>
            </div>
            
            <div className="text-center p-2 border border-gray-100 rounded-md bg-gray-50">
              <div className="text-xs text-gray-500 mb-1">Memory Score</div>
              <div className={`text-xl font-bold ${getScoreColorClass(capabilities.memoryScore)}`}>
                {capabilities.memoryScore}/10
              </div>
              <div className="text-xs mt-1">
                {getScoreLabel(capabilities.memoryScore)}
              </div>
            </div>
          </div>
          
          {/* Feature support */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className={`text-xs px-2 py-1 rounded-full ${capabilities.hasWasm ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              WebAssembly: {capabilities.hasWasm ? 'Supported' : 'Not Supported'}
            </div>
            <div className={`text-xs px-2 py-1 rounded-full ${capabilities.hasWebCrypto ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              WebCrypto: {capabilities.hasWebCrypto ? 'Supported' : 'Not Supported'}
            </div>
          </div>
          
          {/* Recommendations */}
          {capabilities.recommendations.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Recommendations:</h4>
              <ul className="text-xs text-gray-600 list-disc pl-5 space-y-1">
                {capabilities.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Server fallback option */}
          {(!capabilities.isCompatible || capabilities.overallScore < 5) && onServerFallbackRequest && (
            <div className="mt-4">
              <button
                onClick={onServerFallbackRequest}
                className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Use Server-Side Processing
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Server-side processing allows you to use ZK features without requiring your device to do the heavy computation.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HardwareCapabilityMonitor;