import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import ProofList from '../components/ProofList';
import ShareProofDialog from '../components/ShareProofDialog';

// Mock wallet connection (similar to create-zk.js)
const mockConnectWallet = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        balance: '10.5',
        chainId: 1
    };
};

// Mock function to fetch proofs for a wallet
const mockFetchProofs = async (walletAddress) => {
    await new Promise(resolve => setTimeout(resolve, 800));

    // Sample data for demo
    return [
        {
            id: '1',
            referenceId: 'ABCD1234',
            accessKey: 'testkey123',
            proofType: 'balance',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            isRevoked: false,
            walletAddress: walletAddress,
            amount: '1000',
            threshold: null
        },
        {
            id: '2',
            referenceId: 'EFGH5678',
            accessKey: 'expiredkey',
            proofType: 'threshold',
            createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Expired
            isRevoked: false,
            walletAddress: walletAddress,
            amount: '5000',
            threshold: '1000'
        },
        {
            id: '3',
            referenceId: 'IJKL9012',
            accessKey: 'revokedkey',
            proofType: 'maximum',
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
            isRevoked: true,
            walletAddress: walletAddress,
            amount: '2500',
            threshold: null
        }
    ];
};

export default function ManageZkPage() {
    const [wallet, setWallet] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [proofs, setProofs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedProof, setSelectedProof] = useState(null);
    const [showShareDialog, setShowShareDialog] = useState(false);

    const connectWallet = async () => {
        setIsConnecting(true);
        setError('');

        try {
            const walletData = await mockConnectWallet();
            setWallet(walletData);

            // Load proofs after connecting
            loadProofs(walletData.address);
        } catch (err) {
            console.error('Wallet connection error:', err);
            setError('Failed to connect wallet: ' + (err.message || 'Unknown error'));
        } finally {
            setIsConnecting(false);
        }
    };

    const loadProofs = async (address) => {
        setIsLoading(true);
        setError('');

        try {
            const fetchedProofs = await mockFetchProofs(address);
            setProofs(fetchedProofs);
        } catch (err) {
            console.error('Error loading proofs:', err);
            setError('Failed to load proofs: ' + (err.message || 'Unknown error'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleShareProof = (proof) => {
        setSelectedProof(proof);
        setShowShareDialog(true);
    };

    const handleRevokeProof = async (proofId) => {
        setIsLoading(true);
        setError('');

        try {
            // In a real app, this would be an API call to revoke the proof
            await new Promise(resolve => setTimeout(resolve, 500));

            // Update the proof in the list
            setProofs(proofs.map(proof =>
                proof.id === proofId
                    ? { ...proof, isRevoked: true }
                    : proof
            ));
        } catch (err) {
            console.error('Error revoking proof:', err);
            setError('Failed to revoke proof: ' + (err.message || 'Unknown error'));
        } finally {
            setIsLoading(false);
        }
    };

    const closeShareDialog = () => {
        setShowShareDialog(false);
        setSelectedProof(null);
    };

    return (
        <Layout title="Manage ZK Proofs">
            <div className="max-w-6xl mx-auto">
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:px-6">
                        <h1 className="text-2xl font-bold text-gray-900">Manage Zero-Knowledge Proofs</h1>
                        <p className="mt-1 max-w-2xl text-sm text-gray-500">
                            View, share, and revoke your generated ZK proofs.
                        </p>
                    </div>

                    <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                        {!wallet ? (
                            <div className="text-center">
                                <button
                                    type="button"
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    onClick={connectWallet}
                                    disabled={isConnecting}
                                >
                                    {isConnecting ? 'Connecting...' : 'Connect Wallet to View Your Proofs'}
                                </button>
                            </div>
                        ) : (
                            <div>
                                <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="ml-3 flex-1 md:flex md:justify-between">
                                            <p className="text-sm text-blue-700">
                                                Connected wallet: {wallet.address.substring(0, 6)}...{wallet.address.substring(wallet.address.length - 4)}
                                            </p>
                                            <p className="mt-3 text-sm md:mt-0 md:ml-6">
                                                <button
                                                    className="whitespace-nowrap font-medium text-blue-700 hover:text-blue-600"
                                                    onClick={() => loadProofs(wallet.address)}
                                                >
                                                    Refresh <span aria-hidden="true">&rarr;</span>
                                                </button>
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <div className="mb-4 p-4 bg-red-50 rounded-md">
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
                                    <div className="flex justify-center items-center py-12">
                                        <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span className="text-gray-600">Loading your proofs...</span>
                                    </div>
                                ) : (
                                    <ProofList
                                        proofs={proofs}
                                        onShare={handleShareProof}
                                        onRevoke={handleRevokeProof}
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 px-4 py-5 sm:p-6">
                        <h3 className="text-lg font-medium text-gray-900">About Managing Proofs</h3>
                        <div className="mt-2 text-sm text-gray-500">
                            <p>
                                You can share your proofs with others by clicking the "Share" button.
                                This will give you a reference ID and access key that others can use to verify your proof.
                            </p>
                            <p className="mt-2">
                                If you no longer want a proof to be valid, you can revoke it using the "Revoke" button.
                                Once revoked, the proof can no longer be verified, even with the correct reference ID and access key.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {showShareDialog && selectedProof && (
                <ShareProofDialog
                    referenceId={selectedProof.referenceId}
                    accessKey={selectedProof.accessKey}
                    expiresAt={selectedProof.expiresAt}
                    onClose={closeShareDialog}
                />
            )}
        </Layout>
    );
} 