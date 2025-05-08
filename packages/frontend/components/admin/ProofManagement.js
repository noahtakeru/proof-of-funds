/**
 * Proof Management Component
 * 
 * Administrative interface for managing proof of funds records within the Arbitr platform.
 * Allows administrators to view, filter, search, and perform actions on proofs created by users.
 * 
 * Key features:
 * - Searchable and filterable table of all proof records
 * - Filtering by proof type (standard, threshold, maximum, zero-knowledge)
 * - Filtering by status (active, expired, revoked)
 * - Detail view for individual proofs
 * - Administrative actions:
 *   - Revoking active proofs (for compliance or security reasons)
 *   - Extending proof expiration dates
 * 
 * Each proof record contains:
 * - Unique identifier
 * - User wallet address
 * - Proof type
 * - Status
 * - Creation and expiration dates
 * 
 * Note: Currently using mock data for demonstration.
 * Production implementation would connect to blockchain contracts
 * and backend services for actual proof management.
 */

import { useState, useEffect } from 'react';
import { PROOF_TYPES, ZK_PROOF_TYPES } from '../../config/constants';

export default function ProofManagement() {
    const [proofs, setProofs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedProof, setSelectedProof] = useState(null);

    // Mock data for demonstration
    useEffect(() => {
        const mockProofs = [
            { id: '1', user: '0x1234...5678', type: 'standard', status: 'active', createdAt: '2023-03-10', expiresAt: '2023-04-10' },
            { id: '2', user: '0x2345...6789', type: 'threshold', status: 'expired', createdAt: '2023-02-15', expiresAt: '2023-03-15' },
            { id: '3', user: '0x3456...7890', type: 'maximum', status: 'active', createdAt: '2023-03-01', expiresAt: '2023-06-01' },
            { id: '4', user: '0x4567...8901', type: 'zk', status: 'revoked', createdAt: '2023-01-20', expiresAt: '2023-04-20' },
            { id: '5', user: '0x5678...9012', type: 'standard', status: 'active', createdAt: '2023-03-05', expiresAt: '2023-04-05' },
        ];
        setProofs(mockProofs);
    }, []);

    const filteredProofs = proofs.filter(proof => {
        const matchesSearch = proof.id.includes(searchTerm) ||
            proof.user.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || proof.type === filterType;
        const matchesStatus = filterStatus === 'all' || proof.status === filterStatus;

        return matchesSearch && matchesType && matchesStatus;
    });

    const handleRevokeProof = (proofId) => {
        // Implementation would call the contract to revoke a proof
        alert(`Revoke proof ${proofId} - would call contract in production`);

        // Update local state for demo
        setProofs(proofs.map(p =>
            p.id === proofId ? { ...p, status: 'revoked' } : p
        ));
    };

    const handleExtendProof = (proofId) => {
        // Implementation would call the contract to extend a proof's expiration
        alert(`Extend proof ${proofId} - would call contract in production`);

        // Update local state for demo
        const extendedDate = new Date();
        extendedDate.setMonth(extendedDate.getMonth() + 3);

        setProofs(proofs.map(p =>
            p.id === proofId ? { ...p, expiresAt: extendedDate.toISOString().split('T')[0] } : p
        ));
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Proof Management</h2>

            {/* Search and Filter */}
            <div className="flex flex-wrap gap-4 mb-6">
                <input
                    type="text"
                    placeholder="Search proof ID or user address"
                    className="border rounded p-2 flex-grow"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />

                <select
                    className="border rounded p-2"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                >
                    <option value="all">All Types</option>
                    <option value="standard">Standard</option>
                    <option value="threshold">Threshold</option>
                    <option value="maximum">Maximum</option>
                    <option value="zk">Zero-Knowledge</option>
                </select>

                <select
                    className="border rounded p-2"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="revoked">Revoked</option>
                </select>
            </div>

            {/* Proofs Table */}
            <div className="overflow-x-auto">
                <table className="w-full table-auto">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-2 text-left">ID</th>
                            <th className="p-2 text-left">User</th>
                            <th className="p-2 text-left">Type</th>
                            <th className="p-2 text-left">Status</th>
                            <th className="p-2 text-left">Created</th>
                            <th className="p-2 text-left">Expires</th>
                            <th className="p-2 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProofs.map(proof => (
                            <tr key={proof.id} className="border-t">
                                <td className="p-2">{proof.id}</td>
                                <td className="p-2">{proof.user}</td>
                                <td className="p-2 capitalize">{proof.type}</td>
                                <td className="p-2">
                                    <span className={`px-2 py-1 rounded-full text-xs ${proof.status === 'active' ? 'bg-green-100 text-green-800' :
                                        proof.status === 'expired' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                        {proof.status}
                                    </span>
                                </td>
                                <td className="p-2">{proof.createdAt}</td>
                                <td className="p-2">{proof.expiresAt}</td>
                                <td className="p-2 space-x-2">
                                    <button
                                        onClick={() => setSelectedProof(proof)}
                                        className="text-blue-600 hover:underline"
                                    >
                                        View
                                    </button>
                                    {proof.status === 'active' && (
                                        <>
                                            <button
                                                onClick={() => handleRevokeProof(proof.id)}
                                                className="text-red-600 hover:underline"
                                            >
                                                Revoke
                                            </button>
                                            <button
                                                onClick={() => handleExtendProof(proof.id)}
                                                className="text-green-600 hover:underline"
                                            >
                                                Extend
                                            </button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Proof Details Modal */}
            {selectedProof && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
                        <h3 className="text-lg font-semibold mb-4">Proof Details: {selectedProof.id}</h3>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <p className="text-gray-600">User Address</p>
                                <p className="font-medium">{selectedProof.user}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Type</p>
                                <p className="font-medium capitalize">{selectedProof.type}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Status</p>
                                <p className="font-medium capitalize">{selectedProof.status}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Created</p>
                                <p className="font-medium">{selectedProof.createdAt}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Expires</p>
                                <p className="font-medium">{selectedProof.expiresAt}</p>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-2">
                            {selectedProof.status === 'active' && (
                                <>
                                    <button
                                        onClick={() => handleRevokeProof(selectedProof.id)}
                                        className="px-4 py-2 bg-red-500 text-white rounded"
                                    >
                                        Revoke Proof
                                    </button>
                                    <button
                                        onClick={() => handleExtendProof(selectedProof.id)}
                                        className="px-4 py-2 bg-green-500 text-white rounded"
                                    >
                                        Extend Expiration
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => setSelectedProof(null)}
                                className="px-4 py-2 bg-gray-300 rounded"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 