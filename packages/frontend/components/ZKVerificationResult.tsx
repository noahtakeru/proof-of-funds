/**
 * ZK Proof Verification Result Component
 * 
 * This component visualizes the result of a Zero-Knowledge proof verification,
 * providing clear feedback on the verification status and related details.
 * 
 * Features:
 * - Clear visual indication of verification success or failure
 * - Details about the verified proof (type, timestamp, etc.)
 * - Copy-to-clipboard functionality for proof identifiers
 * - Support for displaying verification time metrics
 * 
 * @param {Object} props - Component properties
 * @param {boolean} props.verified - Whether the proof was successfully verified
 * @param {string} props.proofType - Type of proof that was verified
 * @param {Object} props.proofDetails - Additional details about the proof
 * @param {number} props.verificationTime - Time taken to verify the proof (in ms)
 * @param {string} props.errorMessage - Error message if verification failed
 */

import React, { useState } from 'react';

type ProofDetails = {
  user?: string;
  timestamp?: string;
  expiryTime?: string;
  proofHash?: string;
  thresholdAmount?: string;
  tokenSymbol?: string;
  txHash?: string;
};

const ZKVerificationResult: React.FC<{
  verified: boolean;
  proofType?: string;
  proofDetails?: ProofDetails;
  verificationTime?: number;
  errorMessage?: string;
}> = ({ 
  verified, 
  proofType = 'standard', 
  proofDetails, 
  verificationTime,
  errorMessage 
}) => {
  const [copied, setCopied] = useState<string | null>(null);

  // Handle copy to clipboard
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // Format verification time for display
  const formatVerificationTime = (ms?: number): string => {
    if (!ms) {return 'Unknown';}
    if (ms < 1000) {return `${ms.toFixed(0)}ms`;}
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Get descriptive name for proof type
  const getProofTypeName = (type: string): string => {
    switch(type.toLowerCase()) {
      case 'standard':
        return 'Standard (Exact Amount)';
      case 'threshold':
        return 'Threshold (Minimum Amount)';
      case 'maximum':
        return 'Maximum (Maximum Amount)';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  return (
    <div className={`border rounded-lg p-4 mb-4 ${verified 
      ? 'bg-green-50 border-green-200' 
      : 'bg-red-50 border-red-200'}`}
    >
      {/* Header */}
      <div className="flex items-center mb-3">
        {verified ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        <h3 className={`font-semibold ${verified ? 'text-green-800' : 'text-red-800'}`}>
          {verified ? 'Zero-Knowledge Proof Verified' : 'Verification Failed'}
        </h3>
      </div>

      {/* Details grid */}
      {verified && proofDetails && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 mt-2">
          {proofType && (
            <div>
              <p className="text-sm font-medium text-gray-700">Proof Type:</p>
              <p className="text-sm text-gray-600">
                <span className={'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zk-light text-zk-accent mr-2'}>
                  ZK
                </span>
                {getProofTypeName(proofType)}
              </p>
            </div>
          )}
          
          {proofDetails.user && (
            <div>
              <p className="text-sm font-medium text-gray-700">Wallet Address:</p>
              <div className="flex items-center">
                <p className="text-sm text-gray-600 truncate">
                  {proofDetails.user}
                </p>
                <button 
                  onClick={() => copyToClipboard(proofDetails.user!, 'address')}
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  {copied === 'address' ? (
                    <span className="text-green-600 text-xs">✓ Copied</span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}
          
          {proofDetails.thresholdAmount && proofDetails.tokenSymbol && (
            <div>
              <p className="text-sm font-medium text-gray-700">Amount:</p>
              <p className="text-sm text-gray-600">
                {proofDetails.thresholdAmount} {proofDetails.tokenSymbol}
              </p>
            </div>
          )}
          
          {proofDetails.timestamp && (
            <div>
              <p className="text-sm font-medium text-gray-700">Created:</p>
              <p className="text-sm text-gray-600">{proofDetails.timestamp}</p>
            </div>
          )}
          
          {proofDetails.expiryTime && (
            <div>
              <p className="text-sm font-medium text-gray-700">Expires:</p>
              <p className="text-sm text-gray-600">{proofDetails.expiryTime}</p>
            </div>
          )}
          
          {proofDetails.proofHash && (
            <div>
              <p className="text-sm font-medium text-gray-700">Proof Hash:</p>
              <div className="flex items-center">
                <p className="text-sm text-gray-600 truncate">
                  {proofDetails.proofHash}
                </p>
                <button 
                  onClick={() => copyToClipboard(proofDetails.proofHash!, 'hash')}
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  {copied === 'hash' ? (
                    <span className="text-green-600 text-xs">✓ Copied</span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error message display */}
      {!verified && errorMessage && (
        <div className="mt-2">
          <p className="text-sm font-medium text-red-700">Error:</p>
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      )}

      {/* Verification metrics */}
      {verificationTime !== undefined && (
        <div className="mt-4 text-xs text-gray-500 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Verification time: {formatVerificationTime(verificationTime)}
        </div>
      )}
      
      {/* Zero-knowledge explainer */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          <span className="font-semibold">Zero-Knowledge Proof</span>: Cryptographically verifies information without revealing the underlying data.
        </p>
      </div>
    </div>
  );
};

export default ZKVerificationResult;