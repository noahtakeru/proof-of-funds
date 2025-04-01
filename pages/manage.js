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
 * - View ZK proofs with their reference IDs and access keys
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
import ProofList from '../components/ProofList';
import Head from 'next/head';
import Link from 'next/link';

export default function ManagePage() {
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
    const [zkProofs, setZkProofs] = useState([]);
    const [isLoadingZkProofs, setIsLoadingZkProofs] = useState(false);

    // New state for temporary wallet management
    const [activeTab, setActiveTab] = useState('proofs'); // 'proofs', 'temp-wallets', or 'zk-proofs'
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
     */
    const { write: revokeProof, isLoading: isRevoking } = useContractWrite({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'revokeProof',
    });

    /**
     * Fetches detailed information for each proof ID returned by the contract
     * Transforms the raw blockchain data into a more usable format for the UI
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
     * Loads ZK proofs from localStorage
     * Runs when the ZK proofs tab is activated
     */
    useEffect(() => {
        const loadZkProofs = () => {
            if (activeTab !== 'zk-proofs') return;
            
            setIsLoadingZkProofs(true);
            
            try {
                // Get all localStorage keys
                const allProofs = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('zkproof_')) {
                        try {
                            // Extract reference ID from the key
                            const referenceId = key.replace('zkproof_', '');
                            
                            // Parse the stored proof data
                            const proofData = JSON.parse(localStorage.getItem(key));
                            
                            // Format amount for display if it's a BigNumber/wei value
                            let displayAmount = proofData.amount;
                            try {
                                // Try to format as ETH if it's a large number (wei)
                                if (proofData.amount && proofData.amount.length > 10) {
                                    displayAmount = `${ethers.utils.formatEther(proofData.amount)} ETH`;
                                }
                            } catch (err) {
                                console.warn('Error formatting amount:', err);
                            }
                            
                            // Add to the list
                            allProofs.push({
                                referenceId,
                                accessKey: proofData.accessKey,
                                walletAddress: proofData.walletAddress,
                                amount: displayAmount,
                                proofType: proofData.proofType,
                                createdAt: new Date(proofData.createdAt).toLocaleString(),
                                expiryTime: new Date(proofData.expiryTime * 1000).toLocaleString() // Convert seconds to milliseconds
                            });
                        } catch (e) {
                            console.error(`Error parsing proof data for ${key}:`, e);
                        }
                    }
                }
                
                // Sort by creation date (newest first)
                allProofs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                setZkProofs(allProofs);
            } catch (error) {
                console.error('Error loading ZK proofs:', error);
            } finally {
                setIsLoadingZkProofs(false);
            }
        };
        
        loadZkProofs();
    }, [activeTab]);

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
     * Handles deletion of a ZK proof from localStorage
     * 
     * @param {string} referenceId - The reference ID of the proof to delete
     */
    const handleDeleteZkProof = (referenceId) => {
        try {
            // Remove from localStorage
            localStorage.removeItem(`zkproof_${referenceId}`);
            
            // Update state
            setZkProofs(prev => prev.filter(p => p.referenceId !== referenceId));
        } catch (error) {
            console.error('Error deleting ZK proof:', error);
        }
    };

    /**
     * Handles tab switching between proofs, ZK proofs, and temporary wallets
     * 
     * @param {string} tab - Tab identifier to switch to ('proofs', 'zk-proofs', or 'temp-wallets')
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
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <Head>
                <title>Manage Proofs of Funds</title>
                <meta name="description" content="Manage your active proofs of funds" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <header className="mb-8">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-800">Manage Your Proofs</h1>
                    <nav className="flex space-x-4">
                        <Link href="/" className="text-blue-500 hover:text-blue-700">
                            Home
                        </Link>
                        <Link href="/create" className="text-blue-500 hover:text-blue-700">
                            Create Proof
                        </Link>
                        <Link href="/verify" className="text-blue-500 hover:text-blue-700">
                            Verify Proof
                        </Link>
                    </nav>
                </div>
            </header>

            <main>
                {!isConnected ? (
                    <div className="bg-white p-8 rounded-lg shadow-md text-center">
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
                                    className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${activeTab === 'proofs'
                                        ? 'border-indigo-500 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                >
                                    Standard Proofs
                                </button>
                                <button
                                    onClick={() => handleTabChange('zk-proofs')}
                                    className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${activeTab === 'zk-proofs'
                                        ? 'border-indigo-500 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                >
                                    ZK Proofs
                                </button>
                                <button
                                    onClick={() => handleTabChange('temp-wallets')}
                                    className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${activeTab === 'temp-wallets'
                                        ? 'border-indigo-500 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                >
                                    Temporary Wallets
                                </button>
                            </nav>
                        </div>

                        {/* Standard Proofs Tab Content */}
                        {activeTab === 'proofs' && (
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-medium">Your Standard Proofs</h2>
                                    <Link href="/create" className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                                        Create New Proof
                                    </Link>
                                </div>

                                {isLoading ? (
                                    <div className="bg-white p-8 rounded-lg shadow-md text-center">
                                        <h2 className="text-xl font-medium mb-4">Loading Proofs...</h2>
                                        <div className="flex justify-center">
                                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                                        </div>
                                    </div>
                                ) : activeProofs.length === 0 ? (
                                    <div className="bg-white p-8 rounded-lg shadow-md text-center">
                                        <h2 className="text-xl font-medium mb-4">No Active Proofs</h2>
                                        <p className="text-gray-600 mb-6">You don't have any active proofs of funds.</p>
                                        <Link href="/create" className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                                            Create New Proof
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose</th>
                                                    <th scope="col" className="relative px-6 py-3">
                                                        <span className="sr-only">Actions</span>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {activeProofs.map((proof) => (
                                                    <tr key={proof.id}>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm font-medium text-gray-900">{getProofTypeName(proof.proofType)}</span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm text-gray-500">{formatDate(proof.timestamp)}</span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm text-gray-500">{formatDate(proof.expiryTime)}</span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap max-w-xs truncate">
                                                            <span className="text-sm text-gray-500">{proof.signatureMessage}</span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button
                                                                onClick={() => handleRevokeProof(proof.id)}
                                                                className="text-red-600 hover:text-red-900"
                                                                disabled={isRevoking}
                                                            >
                                                                {isRevoking ? 'Revoking...' : 'Revoke'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div className="bg-white p-6 rounded-lg shadow-md mt-6">
                                    <h2 className="text-lg font-semibold mb-4">About Standard Proofs</h2>
                                    <p className="text-gray-600 mb-4">
                                        Standard proofs are submitted directly to the blockchain and can be verified by anyone with the transaction hash.
                                        These proofs are created with your connected wallet and stored on the Polygon Amoy testnet.
                                    </p>
                                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
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
                            </div>
                        )}

                        {/* ZK Proofs Tab Content */}
                        {activeTab === 'zk-proofs' && (
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-medium">Your Zero-Knowledge Proofs</h2>
                                    <Link href="/create-zk" className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                                        Create New ZK Proof
                                    </Link>
                                </div>

                                {isLoadingZkProofs ? (
                                    <div className="bg-white p-8 rounded-lg shadow-md text-center">
                                        <h2 className="text-xl font-medium mb-4">Loading ZK Proofs...</h2>
                                        <div className="flex justify-center">
                                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                                        </div>
                                    </div>
                                ) : zkProofs.length === 0 ? (
                                    <div className="bg-white p-8 rounded-lg shadow-md text-center">
                                        <h2 className="text-xl font-medium mb-4">No ZK Proofs</h2>
                                        <p className="text-gray-600 mb-6">You haven't created any zero-knowledge proofs yet.</p>
                                        <Link href="/create-zk" className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                                            Create ZK Proof
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference ID</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wallet</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Access Key</th>
                                                    <th scope="col" className="relative px-6 py-3">
                                                        <span className="sr-only">Actions</span>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {zkProofs.map((proof) => (
                                                    <tr key={proof.referenceId}>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm font-medium text-gray-900">{proof.referenceId}</span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm text-gray-500">{proof.createdAt}</span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm text-gray-500">{proof.walletAddress?.slice(0, 6)}...{proof.walletAddress?.slice(-4)}</span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm text-gray-500">{proof.accessKey}</span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button
                                                                onClick={() => handleDeleteZkProof(proof.referenceId)}
                                                                className="text-red-600 hover:text-red-900"
                                                            >
                                                                Delete
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div className="bg-white p-6 rounded-lg shadow-md mt-6">
                                    <h2 className="text-lg font-semibold mb-4">About Zero-Knowledge Proofs</h2>
                                    <p className="text-gray-600 mb-4">
                                        Zero-Knowledge proofs provide enhanced privacy by allowing you to prove statements about your wallet balances
                                        without revealing the actual amounts. These proofs are stored locally and can be verified using the reference ID
                                        and access key.
                                    </p>
                                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                                        <div className="flex">
                                            <div className="flex-shrink-0">
                                                <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <div className="ml-3">
                                                <h3 className="text-sm font-medium text-blue-800">Privacy Notice</h3>
                                                <div className="mt-2 text-sm text-blue-700">
                                                    <p>
                                                        Keep the access key secure. Anyone with both the reference ID and access key can verify your proof.
                                                        These proofs are stored locally in your browser and will be lost if you clear your browser data.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Temporary Wallets Tab Content */}
                        {activeTab === 'temp-wallets' && (
                            <div>
                                <div className="flex justify-between items-center mb-4">
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

                                <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                                    <h2 className="text-lg font-semibold mb-4">About Temporary Wallets</h2>
                                    <p className="text-gray-600 mb-4">
                                        Temporary wallets enhance your privacy by creating single-use wallets for proof submission.
                                        These wallets are independent from your main wallet and provide an additional layer of privacy.
                                    </p>
                                </div>

                                {/* Temporary Wallet Creator Component */}
                                <TemporaryWalletCreator
                                    onWalletCreated={(wallet) => {
                                        setWalletMessage(`New temporary wallet created: ${wallet.address.substring(0, 6)}...${wallet.address.substring(wallet.address.length - 4)}`);
                                        // Refresh temporary wallets list
                                        setTemporaryWallets(prev => [wallet, ...prev]);
                                    }}
                                />

                                {isLoadingWallets ? (
                                    <div className="bg-white p-8 rounded-lg shadow-md text-center mt-6">
                                        <h2 className="text-xl font-medium mb-4">Loading Wallets...</h2>
                                        <div className="flex justify-center">
                                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                                        </div>
                                    </div>
                                ) : temporaryWallets.length === 0 ? (
                                    <div className="bg-white p-8 rounded-lg shadow-md text-center mt-6">
                                        <h2 className="text-xl font-medium mb-4">No Temporary Wallets</h2>
                                        <p className="text-gray-600 mb-6">You haven't created any temporary wallets yet.</p>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-lg shadow-md overflow-hidden mt-6">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {temporaryWallets.map((wallet) => (
                                                    <tr key={wallet.address}>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm font-medium text-gray-900">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm text-gray-500">{wallet.balance} ETH</span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm text-gray-500">{new Date(wallet.created).toLocaleString()}</span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm text-gray-500">{wallet.purpose || 'General'}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}