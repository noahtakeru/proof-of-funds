/**
 * Temporary Wallet Creator Component
 * 
 * This component allows users to create temporary wallets for proof generation
 * without exposing their main wallet addresses.
 */

import React, { useState, useEffect } from 'react';
import { 
  createSecureWalletForProof, 
  createAndFundWallet, 
  getTemporaryWalletsWithBalances, 
  fundTemporaryWallet,
  recycleUnusedWallets
} from '../lib/zk/tempWalletManager';
import { formatAddress } from '../lib/walletHelpers';

/**
 * Temporary Wallet Creator component
 */
const TemporaryWalletCreator = ({ onWalletCreated }) => {
  // State variables
  const [purpose, setPurpose] = useState('');
  const [autoArchive, setAutoArchive] = useState(true);
  const [autoFund, setAutoFund] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [wallets, setWallets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [isFunding, setIsFunding] = useState(false);

  // Load existing wallets on mount
  useEffect(() => {
    loadWallets();
    
    // Set up refresh interval (every 30 seconds)
    const interval = setInterval(loadWallets, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Load wallets with balances
  const loadWallets = async () => {
    try {
      setIsLoading(true);
      const walletsWithBalances = await getTemporaryWalletsWithBalances();
      setWallets(walletsWithBalances);
    } catch (error) {
      console.error('Error loading temporary wallets:', error);
      setError('Failed to load existing temporary wallets');
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new temporary wallet
  const handleCreateWallet = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!purpose.trim()) {
      setError('Please enter a purpose for this wallet');
      return;
    }
    
    setError('');
    setSuccessMessage('');
    setLoading(true);
    
    try {
      let wallet;
      
      if (autoFund) {
        // Check if MetaMask is connected
        if (!window.ethereum || !window.ethereum.selectedAddress) {
          throw new Error('Please connect your wallet first to fund the temporary wallet');
        }
        
        // Create and fund wallet
        wallet = await createAndFundWallet(
          purpose,
          window.ethereum.selectedAddress,
          true,
          autoArchive
        );
        
        setSuccessMessage(`Wallet created and funded with 0.01 MATIC: ${formatAddress(wallet.address)}`);
      } else {
        // Create wallet without funding
        wallet = await createSecureWalletForProof(purpose, autoArchive);
        setSuccessMessage(`Wallet created: ${formatAddress(wallet.address)}`);
      }
      
      // Reset form
      setPurpose('');
      
      // Refresh wallets list
      await loadWallets();
      
      // Call the callback if provided
      if (onWalletCreated && typeof onWalletCreated === 'function') {
        onWalletCreated(wallet);
      }
    } catch (error) {
      console.error('Error creating wallet:', error);
      setError('Failed to create temporary wallet: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle funding a wallet
  const handleFundWallet = async (address) => {
    if (!window.ethereum || !window.ethereum.selectedAddress) {
      setError('Please connect your wallet first to fund the temporary wallet');
      return;
    }
    
    setIsFunding(true);
    setSelectedWallet(address);
    setError('');
    setSuccessMessage('');
    
    try {
      await fundTemporaryWallet(
        address,
        window.ethereum.selectedAddress,
        0.01,
        true
      );
      
      setSuccessMessage(`Wallet ${formatAddress(address)} funded successfully`);
      
      // Refresh wallets list
      await loadWallets();
    } catch (error) {
      console.error('Error funding wallet:', error);
      setError('Failed to fund wallet: ' + error.message);
    } finally {
      setIsFunding(false);
      setSelectedWallet(null);
    }
  };

  // Handle archiving a wallet
  const handleArchiveWallet = async (address) => {
    try {
      setLoading(true);
      
      // Use imported function from tempWalletManager
      await archiveWallet(address);
      
      setSuccessMessage(`Wallet ${formatAddress(address)} has been archived`);
      
      // Remove from our local state
      setWallets(wallets.filter(w => w.address !== address));
    } catch (error) {
      console.error('Error archiving wallet:', error);
      setError('Failed to archive wallet: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle recycling unused wallets
  const handleRecycleUnused = async () => {
    try {
      setLoading(true);
      
      // Recycle wallets older than 24 hours
      const count = await recycleUnusedWallets(24);
      
      if (count > 0) {
        setSuccessMessage(`${count} unused wallets recycled successfully`);
        // Refresh wallet list
        await loadWallets();
      } else {
        setSuccessMessage('No unused wallets to recycle');
      }
    } catch (error) {
      console.error('Error recycling wallets:', error);
      setError('Failed to recycle unused wallets: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Format timestamp
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // Format balance
  const formatBalance = (balance) => {
    if (!balance) return '0';
    return parseFloat(balance).toFixed(6);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Create Temporary Wallet</h2>
      
      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Success message */}
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}
      
      {/* Create wallet form */}
      <form onSubmit={handleCreateWallet}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="purpose">
            Wallet Purpose
          </label>
          <input
            id="purpose"
            type="text"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight"
            placeholder="e.g., ETH Balance Proof for Lending Application"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            required
          />
          <p className="text-gray-600 text-xs mt-1">
            Describe what this wallet will be used for
          </p>
        </div>
        
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              className="form-checkbox h-4 w-4 text-blue-600"
              checked={autoArchive}
              onChange={() => setAutoArchive(!autoArchive)}
            />
            <span className="ml-2 text-gray-700 text-sm">
              Automatically archive after use
            </span>
          </label>
        </div>
        
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              className="form-checkbox h-4 w-4 text-blue-600"
              checked={autoFund}
              onChange={() => setAutoFund(!autoFund)}
            />
            <span className="ml-2 text-gray-700 text-sm">
              Automatically fund with MATIC (0.01)
            </span>
          </label>
          <p className="text-gray-600 text-xs mt-1">
            Requires a connected wallet to fund the temporary wallet
          </p>
        </div>
        
        <div className="flex items-center justify-between">
          <button
            type="submit"
            className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Wallet'}
          </button>
          
          <button
            type="button"
            onClick={handleRecycleUnused}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
            disabled={loading}
          >
            Recycle Unused
          </button>
        </div>
      </form>
      
      {/* Existing wallets list */}
      <div className="mt-8">
        <h3 className="text-xl font-bold mb-2">Active Temporary Wallets</h3>
        
        {isLoading ? (
          <div className="text-center py-4">
            <svg className="animate-spin h-6 w-6 mx-auto text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : wallets.length === 0 ? (
          <p className="text-gray-600">No active temporary wallets found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Address
                  </th>
                  <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Purpose
                  </th>
                  <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((wallet) => (
                  <tr key={wallet.address}>
                    <td className="py-2 px-4 border-b border-gray-200">
                      {formatAddress(wallet.address)}
                    </td>
                    <td className="py-2 px-4 border-b border-gray-200">
                      {wallet.purpose || 'N/A'}
                    </td>
                    <td className="py-2 px-4 border-b border-gray-200">
                      {formatDate(wallet.createdAt)}
                    </td>
                    <td className="py-2 px-4 border-b border-gray-200">
                      <span className={wallet.hasEnoughFunds ? 'text-green-600' : 'text-red-600'}>
                        {formatBalance(wallet.balance)} MATIC
                      </span>
                    </td>
                    <td className="py-2 px-4 border-b border-gray-200 flex space-x-2">
                      {!wallet.hasEnoughFunds && (
                        <button
                          onClick={() => handleFundWallet(wallet.address)}
                          className="text-xs bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded"
                          disabled={isFunding && selectedWallet === wallet.address}
                        >
                          {isFunding && selectedWallet === wallet.address ? 'Funding...' : 'Fund'}
                        </button>
                      )}
                      <button
                        onClick={() => handleArchiveWallet(wallet.address)}
                        className="text-xs bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded"
                      >
                        Archive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <div className="mt-4 text-xs text-gray-500">
        <p>
          <strong>Note:</strong> Temporary wallets are designed for one-time use with our zero-knowledge proof system.
          They are securely generated using BIP44 derivation from a master seed stored in Google Cloud Secret Manager.
          Private keys never leave your browser and are not stored in local storage.
        </p>
      </div>
    </div>
  );
};

export default TemporaryWalletCreator;