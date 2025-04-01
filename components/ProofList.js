/**
 * Proof List Component
 * 
 * Displays a list of proofs created by the user
 */

import React from 'react';
import { formatReferenceId } from '../lib/zk/referenceId';

const ProofList = ({ proofs, onShare, onRevoke }) => {
    if (!proofs || proofs.length === 0) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
                <p className="text-gray-500">No proofs found. Create a proof first.</p>
            </div>
        );
    }

    // Format timestamp to readable date
    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    // Format proof type
    const formatProofType = (type) => {
        switch (type) {
            case 0:
                return 'Standard';
            case 1:
                return 'Threshold';
            case 2:
                return 'Maximum';
            default:
                return 'Unknown';
        }
    };

    // Check if a proof is expired
    const isExpired = (expiresAt) => {
        return Date.now() > expiresAt;
    };

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
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
                            Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {proofs.map((proof) => (
                        <tr key={proof.referenceId}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                                {formatReferenceId(proof.referenceId)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatProofType(proof.proofType)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(proof.createdAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(proof.expiresAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {proof.isRevoked ? (
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                        Revoked
                                    </span>
                                ) : isExpired(proof.expiresAt) ? (
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                                        Expired
                                    </span>
                                ) : (
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                        Active
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => onShare(proof)}
                                        className="text-indigo-600 hover:text-indigo-900"
                                        disabled={proof.isRevoked || isExpired(proof.expiresAt)}
                                    >
                                        Share
                                    </button>
                                    {!proof.isRevoked && (
                                        <button
                                            onClick={() => onRevoke(proof.referenceId)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            Revoke
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ProofList;