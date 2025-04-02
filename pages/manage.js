import { useState, useEffect } from 'react';
import { useAccount, useContractRead, useContractWrite } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/constants';

// Using the imported constants - Smart contract address on Polygon Amoy testnet
// const CONTRACT_ADDRESS = '0xD6bd1eFCE3A2c4737856724f96F39037a3564890';

export default function ManagePage() {
    // Add a flag to track user-initiated connection, initialized from localStorage
    const [userInitiatedConnection, setUserInitiatedConnection] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('userInitiatedConnection') === 'true';
        }
        return false;
    });

    const { address, isConnected } = useAccount();
    const [activeProofs, setActiveProofs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Update userInitiatedConnection if it changes in localStorage
    useEffect(() => {
        const handleStorageChange = () => {
            setUserInitiatedConnection(localStorage.getItem('userInitiatedConnection') === 'true');
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('storage', handleStorageChange);
            return () => window.removeEventListener('storage', handleStorageChange);
        }
    }, []);

    // Read user's proofs - only if user has explicitly initiated a connection
    const { data: proofIds, refetch: refetchProofIds } = useContractRead({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getUserProofs',
        args: [address || '0x0000000000000000000000000000000000000000'],
        enabled: isConnected && userInitiatedConnection,
    });

    // Contract write hook for revocation
    const { write: revokeProof, isLoading: isRevoking } = useContractWrite({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'revokeProof',
    });

    // Get details for each proof
    useEffect(() => {
        const fetchProofDetails = async () => {
            if (!proofIds || !proofIds.length) {
                setActiveProofs([]);
                setIsLoading(false);
                return;
            }

            try {
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
                setActiveProofs(proofs.filter(p => !p.isRevoked && p.expiryTime > Date.now()));
            } catch (error) {
                console.error("Error fetching proof details:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProofDetails();
    }, [proofIds, isConnected]);

    // Handle proof revocation
    const handleRevokeProof = async (proofId) => {
        if (!isConnected) return;

        try {
            revokeProof({
                args: [proofId],
            });

            // Optimistically update UI
            setActiveProofs(proofs => proofs.filter(p => p.id !== proofId));

            // Refetch proof IDs after successful revocation
            refetchProofIds();
        } catch (error) {
            console.error('Error revoking proof:', error);
        }
    };

    // Format timestamp for display
    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    // Get proof type name
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
            ) : isLoading ? (
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
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-medium">Your Active Proofs</h2>
                        <a href="/create" className="btn btn-primary">Create New Proof</a>
                    </div>

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
        </div>
    );
} 