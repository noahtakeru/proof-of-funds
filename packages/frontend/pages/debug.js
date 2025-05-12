import React, { useState, useEffect } from 'react';

/**
 * Debug page for wallet and chain ID detection
 */
const DebugPage = () => {
  const [chainInfo, setChainInfo] = useState({
    hexChainId: 'Not detected',
    decimalChainId: 'Not detected',
    connectionStatus: false,
    address: 'Not connected',
    isPolygonAmoy: false
  });

  // Check chain ID when component mounts
  useEffect(() => {
    async function checkChainId() {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          // Get chain ID
          const hexChainId = await window.ethereum.request({ method: 'eth_chainId' });
          const decimalChainId = parseInt(hexChainId, 16);
          
          // Get connection status
          let address = 'Not connected';
          let isConnected = false;
          try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            isConnected = accounts && accounts.length > 0;
            address = isConnected ? accounts[0] : 'Not connected';
          } catch (accountError) {
            console.error('Error getting accounts:', accountError);
          }
          
          // Determine if on Polygon Amoy
          const isPolygonAmoy = decimalChainId === 80002 || hexChainId === '0x13882';
          
          // Update state
          setChainInfo({
            hexChainId,
            decimalChainId,
            connectionStatus: isConnected,
            address,
            isPolygonAmoy
          });
        } catch (error) {
          console.error('Error checking chain ID:', error);
        }
      }
    }
    
    checkChainId();
    
    // Listen for chain changes
    if (window.ethereum) {
      window.ethereum.on('chainChanged', () => checkChainId());
      window.ethereum.on('accountsChanged', () => checkChainId());
    }
    
    // Cleanup
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('chainChanged', checkChainId);
        window.ethereum.removeListener('accountsChanged', checkChainId);
      }
    };
  }, []);
  
  // Button to manually check chain ID
  const handleCheckChainId = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        // Get chain ID
        const hexChainId = await window.ethereum.request({ method: 'eth_chainId' });
        const decimalChainId = parseInt(hexChainId, 16);
        
        // Get accounts
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const isConnected = accounts && accounts.length > 0;
        const address = isConnected ? accounts[0] : 'Not connected';
        
        // Determine if on Polygon Amoy
        const isPolygonAmoy = decimalChainId === 80002 || hexChainId === '0x13882';
        
        // Update state
        setChainInfo({
          hexChainId,
          decimalChainId,
          connectionStatus: isConnected,
          address,
          isPolygonAmoy
        });
        
        console.log('Chain ID check:', {
          hexChainId,
          decimalChainId,
          isConnected,
          address,
          isPolygonAmoy
        });
      } catch (error) {
        console.error('Error manually checking chain ID:', error);
      }
    }
  };
  
  const renderHighlighted = (value) => (
    <span className="font-mono bg-gray-100 px-1 rounded">{value}</span>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Blockchain Connection Debug</h1>
      
      <div className="bg-white p-4 rounded shadow mb-4">
        <h2 className="text-xl font-semibold mb-2">Connection Status</h2>
        <p className="mb-2">
          Connection: {chainInfo.connectionStatus ? 
            <span className="text-green-600 font-semibold">Connected</span> : 
            <span className="text-red-600 font-semibold">Not Connected</span>}
        </p>
        <p className="mb-2">Wallet Address: {renderHighlighted(chainInfo.address)}</p>
      </div>
      
      <div className="bg-white p-4 rounded shadow mb-4">
        <h2 className="text-xl font-semibold mb-2">Chain Information</h2>
        <p className="mb-2">Hex Chain ID: {renderHighlighted(chainInfo.hexChainId)}</p>
        <p className="mb-2">Decimal Chain ID: {renderHighlighted(chainInfo.decimalChainId)}</p>
        <p className="mb-4">
          Polygon Amoy Detected: {chainInfo.isPolygonAmoy ? 
            <span className="text-green-600 font-semibold">Yes</span> : 
            <span className="text-red-600 font-semibold">No</span>}
        </p>
        
        <button 
          onClick={handleCheckChainId}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Check Chain ID
        </button>
      </div>
      
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2">Additional Tests</h2>
        <p className="mb-2">These tests help diagnose issues with wallet integration:</p>
        
        <div className="mt-4">
          <button 
            onClick={async () => {
              if (window.ethereum) {
                try {
                  const accounts = await window.ethereum.request({ 
                    method: 'eth_requestAccounts' 
                  });
                  console.log('Requested accounts:', accounts);
                  handleCheckChainId(); // Update display after connecting
                } catch (error) {
                  console.error('Error requesting accounts:', error);
                }
              }
            }}
            className="mr-2 mb-2 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          >
            Connect Wallet
          </button>
          
          <button 
            onClick={async () => {
              console.log('Ethereum provider details:', window.ethereum);
            }}
            className="mr-2 mb-2 bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
          >
            Log Provider Info
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebugPage;