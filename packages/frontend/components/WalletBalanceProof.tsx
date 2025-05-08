/**
 * Wallet Balance Proof Component
 * 
 * This component provides a visual representation of wallet balance proofs,
 * displaying verification status, proof parameters, and related details.
 * 
 * Features:
 * - Displays detailed proof information for different proof types
 * - Shows verification status with clear visual indicators
 * - Provides transaction history and links to blockchain explorers
 * - Supports countdown for time-limited proofs
 * - Compatible with various token types and networks
 * 
 * @param {Object} props - Component properties
 * @param {Object} props.proofData - The proof data to display
 * @param {boolean} props.verified - Whether the proof has been verified
 * @param {string} props.proofType - Type of proof (standard, threshold, maximum)
 * @param {string} props.network - Blockchain network name
 * @param {Function} props.onVerifyAgain - Callback to verify the proof again
 */

import React, { useState, useEffect } from 'react';

export interface ProofData {
  address: string;
  amount: string;
  tokenSymbol: string;
  timestamp?: string;
  expiryTime?: string;
  proofHash?: string;
  txHash?: string;
  blockNumber?: number;
  network?: string;
  verificationCount?: number;
  lastVerified?: string;
}

interface WalletBalanceProofProps {
  proofData: ProofData;
  verified: boolean;
  proofType: 'standard' | 'threshold' | 'maximum';
  network?: string;
  onVerifyAgain?: () => void;
}

const WalletBalanceProof: React.FC<WalletBalanceProofProps> = ({
  proofData,
  verified,
  proofType,
  network = 'Polygon',
  onVerifyAgain
}) => {
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Calculate time remaining until expiry
  useEffect(() => {
    if (!proofData.expiryTime) return;

    const updateTimeRemaining = () => {
      const now = new Date();
      const expiryDate = new Date(proofData.expiryTime!);
      const diffMs = expiryDate.getTime() - now.getTime();

      if (diffMs <= 0) {
        setIsExpired(true);
        setTimeRemaining('Expired');
        return;
      }

      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (diffDays > 0) {
        setTimeRemaining(`${diffDays}d ${diffHours}h remaining`);
      } else if (diffHours > 0) {
        setTimeRemaining(`${diffHours}h ${diffMinutes}m remaining`);
      } else {
        setTimeRemaining(`${diffMinutes}m remaining`);
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [proofData.expiryTime]);

  // Handle copy to clipboard
  const copyToClipboard = (text: string | undefined, field: string) => {
    if (!text) return;
    
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // Get proof type display text
  const getProofTypeDisplay = () => {
    switch (proofType) {
      case 'standard':
        return 'Standard (Exact Amount)';
      case 'threshold':
        return 'Threshold (At Least)';
      case 'maximum':
        return 'Maximum (At Most)';
      default:
        return 'Unknown';
    }
  };

  // Get block explorer URL
  const getExplorerUrl = (hash: string) => {
    let baseUrl = 'https://polygonscan.com';
    if (network.toLowerCase().includes('mumbai')) {
      baseUrl = 'https://mumbai.polygonscan.com';
    } else if (network.toLowerCase().includes('amoy')) {
      baseUrl = 'https://amoy.polygonscan.com';
    } else if (network.toLowerCase().includes('ethereum')) {
      baseUrl = 'https://etherscan.io';
    } else if (network.toLowerCase().includes('goerli')) {
      baseUrl = 'https://goerli.etherscan.io';
    }
    
    return `${baseUrl}/tx/${hash}`;
  };

  return (
    <div className={`border rounded-lg p-4 mb-4 ${verified 
      ? isExpired ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200' 
      : 'bg-red-50 border-red-200'}`}
    >
      {/* Header Section */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          {verified && !isExpired ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : isExpired ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <h3 className={`font-semibold ${verified && !isExpired ? 'text-green-800' : isExpired ? 'text-yellow-800' : 'text-red-800'}`}>
            {verified && !isExpired 
              ? 'Wallet Balance Verified' 
              : isExpired 
                ? 'Proof Expired' 
                : 'Verification Failed'}
          </h3>
        </div>
        <div className="flex items-center">
          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-medium">
            {getProofTypeDisplay()}
          </span>
        </div>
      </div>

      {/* Amount Section */}
      <div className="bg-white rounded-md p-3 mb-3 border border-gray-100 shadow-sm">
        <div className="text-sm text-gray-600 mb-1">Verified Amount</div>
        <div className="flex items-baseline">
          <span className="text-xl font-bold text-gray-800">{proofData.amount}</span>
          <span className="ml-1 text-gray-600">{proofData.tokenSymbol}</span>
        </div>
        <div className="mt-1 text-xs text-gray-500">
          {proofType === 'standard' && 'Exact amount verified'}
          {proofType === 'threshold' && 'Minimum amount verified (wallet contains at least this amount)'}
          {proofType === 'maximum' && 'Maximum amount verified (wallet contains at most this amount)'}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 mt-4">
        {/* Wallet Address */}
        <div>
          <p className="text-sm font-medium text-gray-700">Wallet Address:</p>
          <div className="flex items-center">
            <p className="text-sm text-gray-600 truncate">
              {proofData.address}
            </p>
            <button 
              onClick={() => copyToClipboard(proofData.address, 'address')}
              className="ml-2 text-blue-600 hover:text-blue-800"
              aria-label="Copy address to clipboard"
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
        
        {/* Network */}
        <div>
          <p className="text-sm font-medium text-gray-700">Network:</p>
          <p className="text-sm text-gray-600">
            {network}
          </p>
        </div>
        
        {/* Creation Time */}
        {proofData.timestamp && (
          <div>
            <p className="text-sm font-medium text-gray-700">Created:</p>
            <p className="text-sm text-gray-600">{proofData.timestamp}</p>
          </div>
        )}
        
        {/* Expiry Time */}
        {proofData.expiryTime && (
          <div>
            <p className="text-sm font-medium text-gray-700">Expires:</p>
            <p className={`text-sm ${isExpired ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
              {proofData.expiryTime}
              {timeRemaining && !isExpired && (
                <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                  {timeRemaining}
                </span>
              )}
              {isExpired && (
                <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                  Expired
                </span>
              )}
            </p>
          </div>
        )}
        
        {/* Transaction Hash */}
        {proofData.txHash && (
          <div>
            <p className="text-sm font-medium text-gray-700">Transaction:</p>
            <div className="flex items-center">
              <a 
                href={getExplorerUrl(proofData.txHash)}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 truncate"
              >
                {proofData.txHash.slice(0, 8)}...{proofData.txHash.slice(-6)}
              </a>
              <button 
                onClick={() => copyToClipboard(proofData.txHash, 'txHash')}
                className="ml-2 text-blue-600 hover:text-blue-800"
                aria-label="Copy transaction hash to clipboard"
              >
                {copied === 'txHash' ? (
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
        
        {/* Proof Hash */}
        {proofData.proofHash && (
          <div>
            <p className="text-sm font-medium text-gray-700">Proof ID:</p>
            <div className="flex items-center">
              <p className="text-sm text-gray-600 truncate">
                {proofData.proofHash.slice(0, 8)}...{proofData.proofHash.slice(-6)}
              </p>
              <button 
                onClick={() => copyToClipboard(proofData.proofHash, 'proofHash')}
                className="ml-2 text-blue-600 hover:text-blue-800"
                aria-label="Copy proof hash to clipboard"
              >
                {copied === 'proofHash' ? (
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

      {/* Verification Info */}
      {proofData.verificationCount !== undefined && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500">
              Verified {proofData.verificationCount} times
              {proofData.lastVerified && ` (Last: ${proofData.lastVerified})`}
            </div>
            {onVerifyAgain && !isExpired && (
              <button
                onClick={onVerifyAgain}
                className="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-50 text-gray-600"
              >
                Verify Again
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Expired Warning */}
      {isExpired && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
          <div className="flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium">This proof has expired</p>
              <p className="mt-1">The proof's validity period has ended. A new proof will need to be generated for current verification.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletBalanceProof;