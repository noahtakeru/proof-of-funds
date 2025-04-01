/**
 * Temporary Wallet Test Page
 * 
 * This test page allows developers to experiment with the temporary wallet system
 * and verify that all components are working correctly together.
 */

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import Head from 'next/head';
import TemporaryWalletCreator from '../components/TemporaryWalletCreator';
import { getTemporaryWalletsWithBalances, fundTemporaryWallet } from '../lib/walletHelpers/tempWalletManager';

export default function TestTemporaryWalletPage() {
    const { address, isConnected } = useAccount();
    const [selectedWallet, setSelectedWallet] = useState(null);
    const [wallets, setWallets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [fundAmount, setFundAmount] = useState('0.01');
    const [isFunding, setIsFunding] = useState(false);

    // Load temporary wallets on page load
    useEffect(() => {
        const loadWallets = async () => {
            setIsLoading(true);
            try {
                const wallets = await getTemporaryWalletsWithBalances();
                setWallets(wallets);
            } catch (error) {
                console.error('Error loading wallets:', error);
                setError('Failed to load temporary wallets');
            } finally {
                setIsLoading(false);
            }
        };

        loadWallets();
    }, []);

    // Handle wallet selection
    const handleSelectWallet = (wallet) => {
        setSelectedWallet(wallet);
    };

    // Handle funding a wallet
    const handleFundWallet = async () => {
        if (!selectedWallet || !isConnected) {
            setError('Please select a wallet and connect your main wallet');
            return;
        }

        setError('');
        setMessage('');
        setIsFunding(true);

        try {
            await fundTemporaryWallet(selectedWallet.address, address, fundAmount);
            setMessage(`Successfully funded wallet with ${fundAmount} MATIC`);

            // Refresh wallet list
            const updatedWallets = await getTemporaryWalletsWithBalances();
            setWallets(updatedWallets);

            // Update selected wallet
            const updatedWallet = updatedWallets.find(w => w.address === selectedWallet.address);
            setSelectedWallet(updatedWallet);
        } catch (error) {
            console.error('Error funding wallet:', error);
            setError(`Failed to fund wallet: ${error.message}`);
        } finally {
            setIsFunding(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto mt-8 px-4">
            <Head>
                <title>Temporary Wallet Test Page</title>
            </Head>

            <h1 className="text-3xl font-bold text-center mb-8">Temporary Wallet Test Page</h1>

            {!isConnected ? (
                <div className="card text-center py-8">
                    <h2 className="text-xl font-medium mb-4">Connect Your Wallet</h2>
                    <p className="text-gray-600 mb-6">Please connect your wallet to test the temporary wallet system.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Main wallet info */}
                    <div className="bg-white shadow rounded-lg p-6">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">Your Main Wallet</h2>
                        <p><strong>Address:</strong> {address}</p>
                    </div>

                    {/* Create new temporary wallet */}
                    <div className="bg-white shadow rounded-lg p-6">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">Create New Temporary Wallet</h2>
                        <TemporaryWalletCreator
                            onWalletCreated={(wallet) => {
                                setMessage(`New temporary wallet created: ${wallet.address}`);
                                setWallets(prev => [wallet, ...prev]);
                            }}
                        />
                    </div>

                    {/* Wallet List */}
                    <div className="bg-white shadow rounded-lg p-6">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">Your Temporary Wallets</h2>

                        {message && (
                            <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-green-700">{message}</p>
                                    </div>
                                </div>
                            </div>
                        )}

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

                        {isLoading ? (
                            <div className="flex justify-center py-4">
                                <svg className="animate-spin h-6 w-6 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </div>
                        ) : wallets.length === 0 ? (
                            <div className="text-center py-4 text-gray-500">
                                <p>No temporary wallets found</p>
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
                                                Balance
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Created
                                            </th>
                                            <th scope="col" className="relative px-6 py-3">
                                                <span className="sr-only">Actions</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {wallets.map((wallet) => (
                                            <tr
                                                key={wallet.address}
                                                className={`cursor-pointer ${selectedWallet?.address === wallet.address ? 'bg-indigo-50' : ''}`}
                                                onClick={() => handleSelectWallet(wallet)}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                                                    {wallet.address.substring(0, 6)}...{wallet.address.substring(wallet.address.length - 4)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {wallet.purpose || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {wallet.balance || '0'} MATIC
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {new Date(wallet.createdAt).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${wallet.hasEnoughFunds
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-red-100 text-red-800'
                                                        }`}>
                                                        {wallet.hasEnoughFunds ? 'Funded' : 'Needs MATIC'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Fund Selected Wallet Section */}
                        {selectedWallet && (
                            <div className="mt-6 pt-6 border-t border-gray-200">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Fund Selected Wallet</h3>
                                <p className="mb-4 text-sm text-gray-600">
                                    Send MATIC from your main wallet to the selected temporary wallet to cover transaction fees.
                                </p>

                                <div className="flex items-center space-x-4">
                                    <div className="w-1/3">
                                        <label htmlFor="fundAmount" className="block text-sm font-medium text-gray-700 mb-1">
                                            MATIC Amount
                                        </label>
                                        <input
                                            type="number"
                                            id="fundAmount"
                                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                            value={fundAmount}
                                            onChange={(e) => setFundAmount(e.target.value)}
                                            min="0.001"
                                            step="0.001"
                                        />
                                    </div>

                                    <button
                                        onClick={handleFundWallet}
                                        disabled={isFunding}
                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                                    >
                                        {isFunding ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Funding...
                                            </>
                                        ) : (
                                            'Fund Wallet'
                                        )}
                                    </button>
                                </div>

                                <div className="mt-4">
                                    <p className="text-sm text-gray-600">
                                        <strong>Selected wallet:</strong> {selectedWallet.address}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        <strong>Current balance:</strong> {selectedWallet.balance || '0'} MATIC
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Usage Instructions */}
                    <div className="bg-white shadow rounded-lg p-6">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">Testing Instructions</h2>
                        <ol className="list-decimal list-inside space-y-2 text-gray-700">
                            <li>Create a new temporary wallet using the form above</li>
                            <li>Select the wallet from the list by clicking on it</li>
                            <li>Fund the wallet with a small amount of MATIC (0.01 is sufficient for testing)</li>
                            <li>Once funded, the wallet can be used for zero-knowledge proof creation</li>
                            <li>Wallets are automatically archived after use or can be manually archived</li>
                        </ol>
                    </div>
                </div>
            )}
        </div>
    );
} 