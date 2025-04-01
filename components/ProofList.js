/**
 * Proof List Component
 * 
 * Displays a list of zero-knowledge proofs and allows the user to manage them.
 * 
 * @param {Object} props Component props
 * @param {Array} props.proofs Array of proof objects to display
 * @param {Function} props.onDeleteProof Function to call when a proof is deleted
 * @param {boolean} props.loading Whether the proofs are currently loading
 */

import { useState } from 'react';
import Link from 'next/link';

export default function ProofList({ proofs = [], onDeleteProof, loading = false }) {
    const [selectedProof, setSelectedProof] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    
    const handleViewDetails = (proof) => {
        setSelectedProof(proof);
        setShowDetails(true);
    };
    
    const closeDetails = () => {
        setShowDetails(false);
    };
    
    // Format a proof date string
    const formatDate = (dateStr) => {
        try {
            return new Date(dateStr).toLocaleString();
        } catch (e) {
            return dateStr;
        }
    };
    
    // Get a readable proof type name
    const getProofTypeName = (type) => {
        switch (Number(type)) {
            case 0: return 'Standard (Equal To)';
            case 1: return 'Threshold (At Least)';
            case 2: return 'Maximum (At Most)';
            default: return 'Unknown';
        }
    };
    
    // If loading, show a loading indicator
    if (loading) {
        return (
            <div className="bg-white p-8 rounded-lg shadow-md text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading proofs...</p>
            </div>
        );
    }
    
    // If no proofs, show an empty state
    if (!proofs || proofs.length === 0) {
        return (
            <div className="bg-white p-8 rounded-lg shadow-md text-center">
                <h2 className="text-xl font-semibold mb-2">No Proofs Found</h2>
                <p className="text-gray-600 mb-6">You haven't created any zero-knowledge proofs yet.</p>
                
                <Link href="/create-zk" className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                    Create a Proof
                </Link>
            </div>
        );
    }
    
    return (
        <div>
            <div className="bg-white rounded-lg shadow-md overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Reference ID
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Created
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Expires
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {proofs.map((proof, index) => (
                            <tr key={proof.referenceId || index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {proof.referenceId || proof.formattedReferenceId || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {getProofTypeName(proof.proofType)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {formatDate(proof.createdAt)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {formatDate(proof.expiryTime)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button
                                        onClick={() => handleViewDetails(proof)}
                                        className="text-blue-600 hover:text-blue-900 mr-4"
                                    >
                                        Details
                                    </button>
                                    <button
                                        onClick={() => onDeleteProof && onDeleteProof(proof.referenceId)}
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
            
            {/* Proof Details Modal */}
            {showDetails && selectedProof && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        {/* Backdrop */}
                        <div className="fixed inset-0 bg-black opacity-30" onClick={closeDetails}></div>
                        
                        {/* Modal */}
                        <div className="bg-white rounded-lg shadow-xl max-w-md w-full z-50 p-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4">
                                Proof Details
                            </h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500">Reference ID</h3>
                                    <p className="mt-1">{selectedProof.referenceId || selectedProof.formattedReferenceId}</p>
                                </div>
                                
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500">Access Key</h3>
                                    <p className="mt-1">{selectedProof.accessKey || 'Not available'}</p>
                                </div>
                                
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500">Wallet Address</h3>
                                    <p className="mt-1 break-all">{selectedProof.walletAddress}</p>
                                </div>
                                
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500">Proof Type</h3>
                                    <p className="mt-1">{getProofTypeName(selectedProof.proofType)}</p>
                                </div>
                                
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500">Created At</h3>
                                    <p className="mt-1">{formatDate(selectedProof.createdAt)}</p>
                                </div>
                                
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500">Expires At</h3>
                                    <p className="mt-1">{formatDate(selectedProof.expiryTime)}</p>
                                </div>
                                
                                {selectedProof.amount && (
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500">Amount</h3>
                                        <p className="mt-1">{selectedProof.amount} ETH</p>
                                    </div>
                                )}
                            </div>
                            
                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={closeDetails}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}