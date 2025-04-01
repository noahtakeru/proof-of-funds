/**
 * Proof Management Page
 * 
 * This page allows users to manage their active proof of funds on the blockchain.
 * Users can view all their active proofs, check their expiration dates, and revoke
 * proofs that are no longer needed.
 * 
 * Key Features:
 * - View active proofs with detailed information (type, creation date, expiry)
 * - Revoke proofs that are no longer needed
 * - Manage temporary wallets for privacy-preserving proofs
 * - Responsive design with proper loading states and empty states
 * - Integration with the ProofOfFunds smart contract on Polygon Amoy testnet
 * 
 * Technical Implementation:
 * - Uses wagmi hooks for blockchain interaction (useContractRead, useContractWrite)
 * - Fetches proof details from the smart contract
 * - Implements optimistic UI updates when revoking proofs
 * - Manages wallet connection state from localStorage
 * - Integrates temporary wallet system for privacy-preserving proofs
 * 
 * @module ManagePage
 * @see pages/create.js - For creating new proofs
 * @see pages/verify.js - For verifying proofs
 * @see smart-contracts/contracts/ProofOfFunds.sol - Smart contract implementation
 */

import { useState, useEffect } from 'react';
import { useAccount, useContractRead, useContractWrite } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/constants';
import TemporaryWalletCreator from '../components/TemporaryWalletCreator';
import { getTemporaryWalletsWithBalances, recycleUnusedWallets } from '../lib/walletHelpers/tempWalletManager';

// Using the imported constants - Smart contract address on Polygon Amoy testnet
// const CONTRACT_ADDRESS = '0xD6bd1eFCE3A2c4737856724f96F39037a3564890';

export default function ManagePage() {
    /**
     * Component State:
     * @state {boolean} userInitiatedConnection - Whether user has explicitly connected their wallet
     * @state {Array} activeProofs - List of the user's active proofs fetched from the blockchain
     * @state {boolean} isLoading - Whether proofs are currently being loaded
     * @state {string} activeTab - Currently active tab (proofs or temp-wallets)
     * @state {Array} temporaryWallets - List of temporary wallets with balance information
     * @state {boolean} isLoadingWallets - Whether temporary wallets are being loaded
     */
    // Track if user has explicitly initiated a wallet connection
    const [userInitiatedConnection, setUserInitiatedConnection] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('userInitiatedConnection') === 'true';
        }
        return false;
    });

    const { address, isConnected } = useAccount();
    const [activeProofs, setActiveProofs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // New state for temporary wallet management
    const [activeTab, setActiveTab] = useState('proofs'); // 'proofs' or 'temp-wallets'
    const [temporaryWallets, setTemporaryWallets] = useState([]);
    const [isLoadingWallets, setIsLoadingWallets] = useState(false);
    const [walletMessage, setWalletMessage] = useState('');
    const [walletError, setWalletError] = useState('');

    /**
     * Listens for changes to the userInitiatedConnection flag in localStorage
     * This ensures the component stays in sync with global wallet connection state
     */
    useEffect(() => {
        const handleStorageChange = () => {
            setUserInitiatedConnection(localStorage.getItem('userInitiatedConnection') === 'true');
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('storage', handleStorageChange);
            return () => window.removeEventListener('storage', handleStorageChange);
        }
    }, []);

    /**
     * Contract read hook to get the list of user's proof IDs
     * Only enabled if the user is connected and has explicitly initiated connection
     */
    const { data: proofIds, refetch: refetchProofIds } = useContractRead({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getUserProofs',
        args: [address || '0x0000000000000000000000000000000000000000'],
        enabled: isConnected && userInitiatedConnection,
    });

    /**
     * Contract write hook for revoking proofs
     * Used when the user wants to invalidate a previously created proof
     * 
     * @see smart-contracts/contracts/ProofOfFunds.sol - revokeProof function
     */
    const { write: revokeProof, isLoading: isRevoking } = useContractWrite({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'revokeProof',
    });

    /**
     * Fetches detailed information for each proof ID returned by the contract
     * Transforms the raw blockchain data into a more usable format for the UI
     * 
     * Note: Currently using a simulated implementation with mock data
     * In production, this would fetch actual proof details from the blockchain
     */
    useEffect(() => {
        const fetchProofDetails = async () => {
            if (!proofIds || !proofIds.length) {
                setActiveProofs([]);
                setIsLoading(false);
                return;
            }

            try {
                // In a production environment, this would be replaced with actual
                // blockchain calls to get the detailed proof information
                const proofPromises = proofIds.map(id =>
                    fetch(`https://api-amoy.polygonscan.com/api?module=proxy&action=eth_call&to=${CONTRACT_ADDRESS}&data=0x<function_signature>000000000000000000000000${id.toString(16).padStart(64, '0')}`)
                        .then(res => res.json())
                        .then(data => {
                            // Simulated result for development
                            return {
                                id: Number(id),
                                timestamp: Date.now() - Math.floor(Math.random() * 10000000),
                                expiryTime: Date.now() + Math.floor(Math.random() * 10000000),
                                proofType: Math.floor(Math.random() * 3), // 0: standard, 1: threshold, 2: maximum
                                thresholdAmount: Math.floor(Math.random() * 1000),
                                isRevoked: false,
                                signatureMessage: "Sample signature message for proof " + id
                            };
                        })
                );

                const proofs = await Promise.all(proofPromises);
                // Filter to only show active and non-expired proofs
                setActiveProofs(proofs.filter(p => !p.isRevoked && p.expiryTime > Date.now()));
            } catch (error) {
                console.error("Error fetching proof details:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProofDetails();
    }, [proofIds, isConnected]);

    /**
     * Loads temporary wallets with their balance information
     * Fetches wallet data from localStorage and gets balance from the blockchain
     */
    useEffect(() => {
        const loadTemporaryWallets = async () => {
            if (activeTab !== 'temp-wallets') return;

            setIsLoadingWallets(true);
            setWalletMessage('');
            setWalletError('');

            try {
                // Get temporary wallets with balance information
                const wallets = await getTemporaryWalletsWithBalances();
                setTemporaryWallets(wallets);

                // Recycle unused wallets (older than 24 hours)
                const recycledCount = await recycleUnusedWallets(24);

                if (recycledCount > 0) {
                    setWalletMessage(`${recycledCount} unused wallet(s) automatically archived`);
                }
            } catch (error) {
                console.error('Error loading temporary wallets:', error);
                setWalletError('Failed to load temporary wallets');
            } finally {
                setIsLoadingWallets(false);
            }
        };

        loadTemporaryWallets();

        // Set up refresh interval when temp wallets tab is active
        let interval;
        if (activeTab === 'temp-wallets') {
            interval = setInterval(loadTemporaryWallets, 60000); // Refresh every minute
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeTab]);

    /**
     * Handles the revocation of a specific proof
     * Calls the revokeProof function on the smart contract and updates the UI
     * 
     * @param {number} proofId - The ID of the proof to revoke
     * @returns {Promise<void>}
     */
    const handleRevokeProof = async (proofId) => {
        if (!isConnected) return;

        try {
            // Call the smart contract to revoke the proof
            revokeProof({
                args: [proofId],
            });

            // Optimistically update UI before blockchain confirmation
            setActiveProofs(proofs => proofs.filter(p => p.id !== proofId));

            // Refetch the list of proofs to ensure UI is in sync with blockchain state
            refetchProofIds();
        } catch (error) {
            console.error('Error revoking proof:', error);
        }
    };

    /**
     * Handles tab switching between proofs and temporary wallets
     * 
     * @param {string} tab - Tab identifier to switch to ('proofs' or 'temp-wallets')
     */
    const handleTabChange = (tab) => {
        setActiveTab(tab);
    };

    /**
     * Formats a timestamp as a locale-appropriate date and time string
     * 
     * @param {number} timestamp - Unix timestamp in milliseconds
     * @returns {string} Formatted date and time
     */
    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    /**
     * Converts a numeric proof type to its human-readable name
     * 
     * @param {number} type - Proof type (0: Standard, 1: Threshold, 2: Maximum)
     * @returns {string} Human-readable proof type name
     */
    const getProofTypeName = (type) => {
        switch (type) {
            case 0: return 'Standard';
            case 1: return 'Threshold';
            case 2: return 'Maximum';
            default: return 'Unknown';
        }
    };

    return (
        <div className="max-w-4xl mx-auto mt-8">
            <h1 className="text-3xl font-bold text-center mb-8">Manage Your Proofs</h1>

            {!isConnected ? (
                <div className="card text-center py-8">
                    <h2 className="text-xl font-medium mb-4">Connect Your Wallet</h2>
                    <p className="text-gray-600 mb-6">Please connect your wallet to manage your proofs.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Tab Navigation */}
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex" aria-label="Tabs">
                            <button
                                onClick={() => handleTabChange('proofs')}
                                className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${activeTab === 'proofs'
                                    ? 'border-indigo-500 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                Proofs
                            </button>
                            <button
                                onClick={() => handleTabChange('temp-wallets')}
                                className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${activeTab === 'temp-wallets'
                                    ? 'border-indigo-500 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                Temporary Wallets
                            </button>
                        </nav>
                    </div>

                    {/* Proofs Tab Content */}
                    {activeTab === 'proofs' && (
                        <>
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-medium">Your Active Proofs</h2>
                                <a href="/create" className="btn btn-primary">Create New Proof</a>
                            </div>

                            {isLoading ? (
                                <div className="card text-center py-8">
                                    <h2 className="text-xl font-medium mb-4">Loading Proofs...</h2>
                                    <div className="flex justify-center">
                                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
                                    </div>
                                </div>
                            ) : activeProofs.length === 0 ? (
                                <div className="card text-center py-8">
                                    <h2 className="text-xl font-medium mb-4">No Active Proofs</h2>
                                    <p className="text-gray-600 mb-6">You don't have any active proofs of funds.</p>
                                    <a href="/create" className="btn btn-primary">Create New Proof</a>
                                </div>
                            ) : (
                                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-300">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Type</th>
                                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Created</th>
                                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Expires</th>
                                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Purpose</th>
                                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                                    <span className="sr-only">Actions</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {activeProofs.map((proof) => (
                                                <tr key={proof.id}>
                                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                                        {getProofTypeName(proof.proofType)}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                        {formatDate(proof.timestamp)}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                        {formatDate(proof.expiryTime)}
                                                    </td>
                                                    <td className="px-3 py-4 text-sm text-gray-500 max-w-xs truncate">
                                                        {proof.signatureMessage}
                                                    </td>
                                                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                        <button
                                                            onClick={() => handleRevokeProof(proof.id)}
                                                            className="text-red-600 hover:text-red-900"
                                                        >
                                                            Revoke
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="card mt-8">
                                <h2 className="text-xl font-semibold mb-4">About Proof Management</h2>
                                <p className="text-gray-600 mb-4">
                                    This dashboard allows you to view and manage all your active proofs of funds on the Polygon blockchain.
                                    You can revoke proofs that are no longer needed or create new ones for different purposes.
                                </p>

                                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-4">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="ml-3">
                                            <h3 className="text-sm font-medium text-yellow-800">Important Note</h3>
                                            <div className="mt-2 text-sm text-yellow-700">
                                                <p>
                                                    Revoking a proof is permanent and cannot be undone. Once revoked, a proof can no longer be verified by third parties.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Temporary Wallets Tab Content */}
                    {activeTab === 'temp-wallets' && (
                        <>
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-medium">Temporary Wallet Management</h2>
                            </div>

                            {walletMessage && (
                                <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-sm text-green-700">{walletMessage}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {walletError && (
                                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-sm text-red-700">{walletError}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <p className="text-gray-600 mb-6">
                                Temporary wallets enhance your privacy by creating single-use wallets for proof submission.
                                These wallets are independent from your main wallet and provide an additional layer of privacy.
                            </p>

                            {/* Temporary Wallet Creator Component */}
                            <TemporaryWalletCreator
                                onWalletCreated={(wallet) => {
                                    setWalletMessage(`New temporary wallet created: ${wallet.address.substring(0, 6)}...${wallet.address.substring(wallet.address.length - 4)}`);
                                    // Refresh temporary wallets list
                                    setTemporaryWallets(prev => [wallet, ...prev]);
                                }}
                            />
                        </>
                    )}
                </div>
            )}
        </div>
    );
} 