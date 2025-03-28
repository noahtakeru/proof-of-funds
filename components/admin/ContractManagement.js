/**
 * Contract Management Component
 * 
 * Administrative interface for managing smart contracts within the Arbitr platform.
 * Allows administrators to monitor, inspect, and upgrade the deployed smart contracts
 * that power the proof of funds verification system.
 * 
 * Key features:
 * - Overview of all deployed contracts with status and metrics
 * - Detailed contract information including:
 *   - Contract address
 *   - Version history
 *   - Deployment date
 *   - Network information
 *   - Usage statistics (function calls and gas consumption)
 * - Contract upgrade workflow:
 *   - Input new contract address
 *   - Document upgrade notes
 *   - Safety warnings and confirmation
 * 
 * The component handles two primary contracts:
 * - ProofOfFunds: Main contract for standard proof verification
 * - ZKVerifier: Zero-knowledge proof verification contract
 * 
 * Note: Currently using mock data for demonstration.
 * Production implementation would interact with blockchain networks
 * to fetch real contract data and perform upgrades.
 */

import { useState, useEffect } from 'react';
import { CONTRACT_ADDRESS, ZK_VERIFIER_ADDRESS } from '../../config/constants';

export default function ContractManagement() {
    const [contracts, setContracts] = useState([]);
    const [selectedContract, setSelectedContract] = useState(null);
    const [upgradeMode, setUpgradeMode] = useState(false);
    const [newContractAddress, setNewContractAddress] = useState('');
    const [upgradeNotes, setUpgradeNotes] = useState('');

    // Mock data for demonstration
    useEffect(() => {
        const mockContracts = [
            {
                id: '1',
                name: 'ProofOfFunds',
                address: CONTRACT_ADDRESS,
                version: 'v1.0.2',
                deploymentDate: '2023-01-15',
                network: 'Polygon Amoy',
                functionCalls: 1245,
                avgGasUsage: '0.0003 MATIC',
                status: 'active'
            },
            {
                id: '2',
                name: 'ZKVerifier',
                address: ZK_VERIFIER_ADDRESS,
                version: 'v0.9.5',
                deploymentDate: '2023-02-10',
                network: 'Polygon Amoy',
                functionCalls: 567,
                avgGasUsage: '0.0012 MATIC',
                status: 'active'
            }
        ];
        setContracts(mockContracts);
    }, []);

    const handleUpgradeContract = (contractId) => {
        if (!newContractAddress || !upgradeNotes) {
            alert('Please enter a new contract address and upgrade notes');
            return;
        }

        // In production, this would call an API to upgrade the contract
        alert(`Contract ${contractId} would be upgraded to ${newContractAddress}`);

        // Update local state for demo
        setContracts(contracts.map(contract =>
            contract.id === contractId ?
                { ...contract, address: newContractAddress, version: `v${parseFloat(contract.version.slice(1)) + 0.1}`, deploymentDate: new Date().toISOString().split('T')[0] } :
                contract
        ));

        setUpgradeMode(false);
        setNewContractAddress('');
        setUpgradeNotes('');
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Smart Contract Management</h2>

            {/* Contracts Overview */}
            <div className="mb-8">
                <h3 className="text-lg font-medium mb-4">Deployed Contracts</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contracts.map(contract => (
                        <div key={contract.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-semibold text-lg">{contract.name}</h4>
                                <span className={`px-2 py-1 rounded-full text-xs ${contract.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                    {contract.status}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">Version: {contract.version}</p>
                            <p className="text-sm text-gray-600 mb-2">Address: {contract.address}</p>
                            <p className="text-sm text-gray-600 mb-4">Deployed: {contract.deploymentDate}</p>

                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <div className="border rounded p-2 text-center">
                                    <p className="text-xs text-gray-500">Function Calls</p>
                                    <p className="font-medium">{contract.functionCalls}</p>
                                </div>
                                <div className="border rounded p-2 text-center">
                                    <p className="text-xs text-gray-500">Avg Gas</p>
                                    <p className="font-medium">{contract.avgGasUsage}</p>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-2">
                                <button
                                    onClick={() => setSelectedContract(contract)}
                                    className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm"
                                >
                                    Details
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedContract(contract);
                                        setUpgradeMode(true);
                                    }}
                                    className="px-3 py-1 bg-purple-500 text-white rounded-md text-sm"
                                >
                                    Upgrade
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Contract Details Modal */}
            {selectedContract && !upgradeMode && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
                        <h3 className="text-lg font-semibold mb-4">{selectedContract.name} Details</h3>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <p className="text-gray-600">Contract Address</p>
                                <p className="font-medium">{selectedContract.address}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Version</p>
                                <p className="font-medium">{selectedContract.version}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Deployment Date</p>
                                <p className="font-medium">{selectedContract.deploymentDate}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Network</p>
                                <p className="font-medium">{selectedContract.network}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Function Calls</p>
                                <p className="font-medium">{selectedContract.functionCalls}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Average Gas Usage</p>
                                <p className="font-medium">{selectedContract.avgGasUsage}</p>
                            </div>
                        </div>

                        <h4 className="font-medium mb-2">Function Call Frequency</h4>
                        <div className="h-40 p-4 mb-6 bg-gray-50 rounded flex items-center justify-center">
                            <p className="text-gray-500 italic">Function call chart would appear here</p>
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={() => setSelectedContract(null)}
                                className="px-4 py-2 bg-gray-300 rounded"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Contract Upgrade Modal */}
            {selectedContract && upgradeMode && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
                        <h3 className="text-lg font-semibold mb-4">Upgrade {selectedContract.name}</h3>

                        <div className="mb-4">
                            <p className="text-gray-600 mb-1">Current Contract Address</p>
                            <p className="font-medium mb-4">{selectedContract.address}</p>

                            <label className="block text-gray-600 mb-1">New Contract Address</label>
                            <input
                                type="text"
                                className="w-full border rounded p-2 mb-4"
                                placeholder="0x..."
                                value={newContractAddress}
                                onChange={(e) => setNewContractAddress(e.target.value)}
                            />

                            <label className="block text-gray-600 mb-1">Upgrade Notes</label>
                            <textarea
                                className="w-full border rounded p-2 mb-4"
                                rows="3"
                                placeholder="Describe the changes in this upgrade..."
                                value={upgradeNotes}
                                onChange={(e) => setUpgradeNotes(e.target.value)}
                            ></textarea>
                        </div>

                        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6">
                            <p className="text-yellow-700 font-medium">Warning</p>
                            <p className="text-yellow-600 text-sm">Upgrading a contract is a sensitive operation that can affect user data and functionality. Make sure you have tested the new contract thoroughly.</p>
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setUpgradeMode(false);
                                    setNewContractAddress('');
                                    setUpgradeNotes('');
                                }}
                                className="px-4 py-2 bg-gray-300 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleUpgradeContract(selectedContract.id)}
                                className="px-4 py-2 bg-purple-600 text-white rounded"
                            >
                                Confirm Upgrade
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 