/**
 * Network Toggle Component
 * 
 * A reusable UI component that allows toggling between Polygon Amoy testnet and Polygon mainnet
 * for proof creation and verification. This component:
 * - Displays the current network (testnet or mainnet)
 * - Provides a toggle button to switch between networks
 * - Shows visual indicators of the current state
 * - Displays warnings when using testnet
 */

import React from 'react';
// Updated import path to use the properly exported path
import { useNetwork } from '@proof-of-funds/common';

const NetworkToggle = () => {
  const { useTestNetwork, toggleNetwork, getNetworkConfig } = useNetwork();
  const networkConfig = getNetworkConfig();

  return (
    <div className="flex items-center justify-between p-3 mb-4 rounded-lg border border-gray-200 bg-gray-50">
      <div className="flex items-center">
        <div className={`h-3 w-3 rounded-full mr-2 ${useTestNetwork ? 'bg-amber-500' : 'bg-green-500'}`}></div>
        <div>
          <div className="text-sm font-medium">{networkConfig.networkName}</div>
          <div className="text-xs text-gray-500">
            {useTestNetwork
              ? 'Test environment - Proofs will not be published to mainnet'
              : 'Production environment - Proofs will be published to mainnet'}
          </div>
        </div>
      </div>
      
      <button
        onClick={toggleNetwork}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          useTestNetwork
            ? 'bg-green-100 text-green-800 hover:bg-green-200'
            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
        }`}
      >
        Switch to {useTestNetwork ? 'Polygon Mainnet' : 'Polygon Amoy (Testnet)'}
      </button>
    </div>
  );
};

export default NetworkToggle;