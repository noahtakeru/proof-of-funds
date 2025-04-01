/**
 * Temporary Wallet Creator Component
 * 
 * This component provides a UI for creating and managing temporary wallets for zero-knowledge proofs.
 * It allows users to create one-time wallets for proof submission without exposing their main addresses.
 * 
 * Features:
 * - Create new temporary wallets with specific purposes
 * - View existing temporary wallets with their balances
 * - Fund wallets with MATIC for transaction fees
 * - Archive wallets when no longer needed
 * - Toggle for automatic archiving after use
 * 
 * Security:
 * - Integrates with GCP Secret Manager for secure seed storage
 * - Private keys never stored in localStorage
 * - Encryption of sensitive wallet data
 * 
 * Usage:
 * <TemporaryWalletCreator onWalletCreated={handleNewWallet} />
 */

import { useState, useEffect } from 'react';
import {
    createSecureWalletForProof,
    createAndFundWallet,
    getTemporaryWalletsWithBalances,
    fundTemporaryWallet,
    recycleUnusedWallets
} from '../lib/zk/tempWalletManager';
import { listTemporaryWallets, archiveWallet } from '../lib/walletHelpers/bip44';

export default function TemporaryWalletCreator({ onWalletCreated }) {
    // State for the form
    const [purpose, setPurpose] = useState('');
    const [autoArchive, setAutoArchive] = useState(true);
    const [autoFund, setAutoFund] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // State for existing wallets
    const [temporaryWallets, setTemporaryWallets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedWallet, setSelectedWallet] = useState(null);
    const [isFunding, setIsFunding] = useState(false);

    // Load existing temporary wallets with balances
    useEffect(() => {
        const loadWallets = async () => {
            try {
                setIsLoading(true);
                // Get wallets with balance information
                const walletsWithBalances = await getTemporaryWalletsWithBalances();
                setTemporaryWallets(walletsWithBalances);
            } catch (error) {
                console.error('Error loading temporary wallets:', error);
                setError('Failed to load existing temporary wallets');
            } finally {
                setIsLoading(false);
            }
        };

        loadWallets();

        // Set up refresh interval (every 30 seconds)
        const interval = setInterval(loadWallets, 30000);

        return () => clearInterval(interval);
    }, []);

    // Handle form submission
    const handleCreateWallet = async (e) => {
        e.preventDefault();

        if (!purpose.trim()) {
            setError('Please enter a purpose for this wallet');
            return;
        }

        setError('');
        setSuccessMessage('');
        setIsCreating(true);

        try {
            let walletInfo;

            if (autoFund) {
                // Check if user has connected wallet
                if (!window.ethereum || !window.ethereum.selectedAddress) {
                    throw new Error('Please connect your wallet first to fund the temporary wallet');
                }

                // Create and fund the wallet
                walletInfo = await createAndFundWallet(
                    purpose,
                    window.ethereum.selectedAddress,
                    true,
                    autoArchive
                );
            } else {
                // Create wallet without funding
                walletInfo = await createSecureWalletForProof(purpose, autoArchive);
            }

            // Update wallet list
            const updatedWallets = await getTemporaryWalletsWithBalances();
            setTemporaryWallets(updatedWallets);

            // Show success message
            setSuccessMessage(`Temporary wallet created: ${walletInfo.address}`);

            // Reset form
            setPurpose('');

            // Call the callback if provided
            if (onWalletCreated && typeof onWalletCreated === 'function') {
                onWalletCreated(walletInfo);
            }
        } catch (error) {
            console.error('Error creating temporary wallet:', error);
            setError('Failed to create temporary wallet: ' + error.message);
        } finally {
            setIsCreating(false);
        }
    };

    // Handle wallet archiving
    const handleArchiveWallet = async (address) => {
        try {
            const success = await archiveWallet(address);

            if (success) {
                // Update wallet list (remove archived wallet)
                setTemporaryWallets(prev => prev.filter(wallet => wallet.address !== address));
                setSuccessMessage(`Wallet ${address.substring(0, 6)}...${address.substring(address.length - 4)} archived successfully`);
            } else {
                setError(`Failed to archive wallet ${address}`);
            }
        } catch (error) {
            console.error('Error archiving wallet:', error);
            setError('Failed to archive wallet: ' + error.message);
        }
    };

    // Handle wallet funding
    const handleFundWallet = async (address) => {
        if (!window.ethereum || !window.ethereum.selectedAddress) {
            setError('Please connect your wallet first to fund the temporary wallet');
            return;
        }

        setIsFunding(true);
        setError('');
        setSuccessMessage('');

        try {
            await fundTemporaryWallet(address, window.ethereum.selectedAddress);

            // Refresh wallet list after funding
            const updatedWallets = await getTemporaryWalletsWithBalances();
            setTemporaryWallets(updatedWallets);

            setSuccessMessage(`Wallet ${address.substring(0, 6)}...${address.substring(address.length - 4)} funded successfully`);
        } catch (error) {
            console.error('Error funding wallet:', error);
            setError('Failed to fund wallet: ' + error.message);
        } finally {
            setIsFunding(false);
        }
    };

    // Recycle unused wallets
    const handleRecycleUnused = async () => {
        try {
            const count = await recycleUnusedWallets(24); // 24 hours threshold

            if (count > 0) {
                // Refresh wallet list after recycling
                const updatedWallets = await getTemporaryWalletsWithBalances();
                setTemporaryWallets(updatedWallets);

                setSuccessMessage(`${count} unused wallets recycled successfully`);
            } else {
                setSuccessMessage('No unused wallets to recycle');
            }
        } catch (error) {
            console.error('Error recycling wallets:', error);
            setError('Failed to recycle unused wallets: ' + error.message);
        }
    };

    // Format timestamp to readable date
    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    // Format address for display
    const formatAddress = (address) => {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    // Format balance
    const formatBalance = (balance) => {
        if (!balance) return '0';
        // Round to 6 decimal places
        return parseFloat(balance).toFixed(6);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Create Temporary Wallet</h2>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {successMessage && (
                    <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-green-700">{successMessage}</p>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleCreateWallet}>
                    <div className="mb-4">
                        <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-1">
                            Wallet Purpose
                        </label>
                        <input
                            type="text"
                            id="purpose"
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            placeholder="e.g., Loan Application #123"
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                            required
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            This helps identify what this temporary wallet will be used for
                        </p>
                    </div>

                    <div className="flex items-center mb-4">
                        <input
                            type="checkbox"
                            id="autoArchive"
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            checked={autoArchive}
                            onChange={(e) => setAutoArchive(e.target.checked)}
                        />
                        <label htmlFor="autoArchive" className="ml-2 block text-sm text-gray-700">
                            Automatically archive after use
                        </label>
                    </div>

                    <div className="flex items-center mb-4">
                        <input
                            type="checkbox"
                            id="autoFund"
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            checked={autoFund}
                            onChange={(e) => setAutoFund(e.target.checked)}
                        />
                        <label htmlFor="autoFund" className="ml-2 block text-sm text-gray-700">
                            Automatically fund with MATIC (0.01)
                        </label>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            disabled={isCreating}
                        >
                            {isCreating ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Creating...
                                </>
                            ) : (
                                'Create Wallet'
                            )}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-medium text-gray-900">Active Temporary Wallets</h2>

                    <button
                        onClick={handleRecycleUnused}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Recycle Unused Wallets
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-4">
                        <svg className="animate-spin h-6 w-6 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                ) : temporaryWallets.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                        <p>No active temporary wallets found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Address
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Purpose
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Balance (MATIC)
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Auto-Archive
                                    </th>
                                    <th scope="col" className="relative px-6 py-3">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {temporaryWallets.map((wallet) => (
                                    <tr key={wallet.address}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                                            {formatAddress(wallet.address)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {wallet.purpose || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {wallet.balance ? (
                                                <span className={wallet.hasEnoughFunds ? 'text-green-600' : 'text-red-600'}>
                                                    {formatBalance(wallet.balance)}
                                                </span>
                                            ) : (
                                                'Loading...'
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(wallet.createdAt)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {wallet.autoArchive ? 'Yes' : 'No'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end space-x-2">
                                                {!wallet.hasEnoughFunds && (
                                                    <button
                                                        onClick={() => handleFundWallet(wallet.address)}
                                                        className="text-green-600 hover:text-green-900"
                                                        disabled={isFunding && selectedWallet === wallet.address}
                                                    >
                                                        {isFunding && selectedWallet === wallet.address ? 'Funding...' : 'Fund'}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleArchiveWallet(wallet.address)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    Archive
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mt-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-blue-700">
                            <strong>Enhanced Security:</strong> This wallet system uses GCP Secret Manager for secure seed phrase storage.
                            Private keys are encrypted in memory and never stored in localStorage.
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-yellow-700">
                            <strong>Important:</strong> Temporary wallets are designed for one-time use with zero-knowledge proofs.
                            Private keys will be lost when you close the browser or explicitly archive the wallet.
                            Make sure to fund wallets before using them for on-chain transactions.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
} 