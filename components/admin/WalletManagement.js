/**
 * Wallet Management Component
 * 
 * Administrative interface for managing wallet connections and localStorage data
 * within the Arbitr platform. Provides tools to inspect, maintain, and troubleshoot
 * wallet-related data stored in the browser's localStorage.
 * 
 * Key features:
 * - Wallet Data Discovery: Automatically scans multiple localStorage keys
 *   to find and consolidate wallet data from different sources:
 *   - Native wallet storage (MetaMask, Phantom)
 *   - Application-specific wallet data
 *   - Multi-wallet connections
 * 
 * - Wallet Administration Tools:
 *   - View all connected wallets across the application
 *   - Remove individual wallet connections
 *   - Clear all wallet data (system reset capability)
 *   - Refresh wallet data to see real-time state
 * 
 * - Detailed Wallet Information Display:
 *   - Wallet type (Ethereum/Polygon/Solana)
 *   - Blockchain network/chain ID
 *   - Wallet addresses with proper formatting
 *   - Storage location for debugging
 * 
 * - Duplicate Detection: Intelligently merges wallet data from multiple
 *   storage locations to prevent duplicate entries
 * 
 * This component serves as both an administrative tool and a debugging
 * utility for wallet connection issues that users might experience.
 * 
 * Note: Directly manipulates localStorage, which should be handled with
 * caution in production environments to maintain data integrity.
 */

import { useState, useEffect } from 'react';

export default function WalletManagement() {
    const [wallets, setWallets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        loadWallets();
    }, []);

    const loadWallets = () => {
        setIsLoading(true);
        try {
            // Check all potential localStorage keys for wallet data
            const storageKeys = [
                'walletAccounts',
                'selectedWallets',
                'connectedWallet',
                'publicKey',
                'phantomWallet',
                'metamaskWallet'
            ];

            let foundWallets = [];

            storageKeys.forEach(key => {
                try {
                    const data = localStorage.getItem(key);
                    if (!data) return;

                    const parsed = JSON.parse(data);

                    if (Array.isArray(parsed)) {
                        // Handle arrays of wallet objects
                        parsed.forEach(wallet => {
                            if (wallet && wallet.address) {
                                foundWallets.push({
                                    ...wallet,
                                    storageKey: key
                                });
                            }
                        });
                    } else if (typeof parsed === 'object' && parsed !== null && parsed.address) {
                        // Handle single wallet object
                        foundWallets.push({
                            ...parsed,
                            storageKey: key
                        });
                    }
                } catch (e) {
                    console.error(`Error parsing ${key}:`, e);
                }
            });

            // Remove duplicates
            const uniqueWallets = [];
            const seen = new Set();

            foundWallets.forEach(wallet => {
                const key = `${wallet.address}-${wallet.wallet || 'unknown'}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueWallets.push(wallet);
                }
            });

            setWallets(uniqueWallets);
            setMessage({
                text: uniqueWallets.length ? `Found ${uniqueWallets.length} wallets` : 'No wallets found in localStorage',
                type: 'info'
            });
        } catch (error) {
            console.error('Error loading wallets:', error);
            setMessage({ text: 'Error loading wallets from localStorage', type: 'error' });
        }
        setIsLoading(false);
    };

    const removeWallet = (walletToRemove) => {
        try {
            const { address, wallet: walletType, storageKey } = walletToRemove;

            // Remove from the specific storage location
            if (storageKey) {
                const data = localStorage.getItem(storageKey);
                if (data) {
                    const parsed = JSON.parse(data);

                    if (Array.isArray(parsed)) {
                        // Filter out the wallet from array
                        const updated = parsed.filter(w =>
                            !(w.address === address &&
                                (w.wallet === walletType || !walletType || !w.wallet))
                        );
                        localStorage.setItem(storageKey, JSON.stringify(updated));
                    } else if (typeof parsed === 'object' && parsed.address === address) {
                        // If it's the exact object, remove it
                        localStorage.removeItem(storageKey);
                    }
                }
            }

            // Update the UI
            setWallets(prevWallets =>
                prevWallets.filter(w => !(w.address === address &&
                    (w.wallet === walletType || !walletType || !w.wallet)))
            );

            setMessage({ text: `Wallet ${address.substring(0, 8)}... removed successfully`, type: 'success' });
        } catch (error) {
            console.error('Error removing wallet:', error);
            setMessage({ text: 'Error removing wallet', type: 'error' });
        }
    };

    const clearAllWallets = () => {
        try {
            // Clear all known wallet storage keys
            const storageKeys = [
                'walletAccounts',
                'selectedWallets',
                'connectedWallet',
                'publicKey',
                'phantomWallet',
                'metamaskWallet'
            ];

            storageKeys.forEach(key => {
                localStorage.removeItem(key);
            });

            setWallets([]);
            setMessage({ text: 'All wallet data cleared from localStorage', type: 'success' });
        } catch (error) {
            console.error('Error clearing wallets:', error);
            setMessage({ text: 'Error clearing wallet data', type: 'error' });
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">Wallet Management</h2>
                    <div className="space-x-2">
                        <button
                            onClick={loadWallets}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                        >
                            Refresh
                        </button>
                        <button
                            onClick={clearAllWallets}
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                        >
                            Clear All Wallets
                        </button>
                    </div>
                </div>

                {message.text && (
                    <div className={`p-3 rounded mb-4 ${message.type === 'error' ? 'bg-red-100 text-red-700' :
                        message.type === 'success' ? 'bg-green-100 text-green-700' :
                            'bg-blue-100 text-blue-700'
                        }`}>
                        {message.text}
                    </div>
                )}

                {isLoading ? (
                    <div className="text-center py-8">Loading wallet data...</div>
                ) : wallets.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No wallets found in localStorage</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Wallet Type
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Chain ID
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Address
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Storage Key
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {wallets.map((wallet, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {wallet.wallet || 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {wallet.chainId || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 break-all">
                                            {wallet.address}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {wallet.storageKey}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => removeWallet(wallet)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
} 