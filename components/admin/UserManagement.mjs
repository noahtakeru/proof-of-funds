/**
 * Admin User Management Component
 * 
 * This component provides an administrative interface for managing users
 * within the Proof of Funds system.
 * 
 * Features:
 * - View all registered users in the system
 * - Search users by ID or wallet address
 * - View user activity and proof history
 * - Manage user roles and permissions
 * - Restrict access when necessary
 * - Add notes to user profiles
 * 
 * ---------- MOCK STATUS ----------
 * This file contains the following mock implementations:
 * - mockUsers (lines 39-73): Hardcoded array of user data
 * - handleUpdateRole (line 81): Mock function that updates UI without backend calls
 * - handleRestrictUser (line 94): Mock function that uses alert and updates UI without making real API calls
 * 
 * These mocks are documented in MOCKS.md with priority LOW for replacement.
 * 
 * Note: Currently using mock data for demonstration.
 * Production implementation would connect to authentication and
 * user management services for real user data and operations.
 */

import { useState, useEffect } from 'react';

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedUser, setSelectedUser] = useState(null);

    // Mock data for demonstration
    useEffect(() => {
        const mockUsers = [
            {
                id: '1',
                address: '0x1234...5678',
                status: 'active',
                registeredAt: '2023-01-15',
                proofCount: 3,
                lastActive: '2023-03-12'
            },
            {
                id: '2',
                address: '0x2345...6789',
                status: 'suspended',
                registeredAt: '2023-02-10',
                proofCount: 1,
                lastActive: '2023-02-28'
            },
            {
                id: '3',
                address: '0x3456...7890',
                status: 'active',
                registeredAt: '2023-03-01',
                proofCount: 5,
                lastActive: '2023-03-10'
            },
            {
                id: '4',
                address: '0x4567...8901',
                status: 'inactive',
                registeredAt: '2023-01-05',
                proofCount: 0,
                lastActive: '2023-01-20'
            },
        ];
        setUsers(mockUsers);
    }, []);

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.id.includes(searchTerm) ||
            user.address.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' || user.status === filterStatus;

        return matchesSearch && matchesStatus;
    });

    const handleStatusChange = (userId, newStatus) => {
        // In production, this would call an API to update the user status
        setUsers(users.map(user =>
            user.id === userId ? { ...user, status: newStatus } : user
        ));
    };

    const handleAddNote = (userId, note) => {
        // In production, this would call an API to add a note
        alert(`Added note to user ${userId}: ${note}`);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">User Management</h2>

            {/* Search and Filter */}
            <div className="flex flex-wrap gap-4 mb-6">
                <input
                    type="text"
                    placeholder="Search user ID or address"
                    className="border rounded p-2 flex-grow"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />

                <select
                    className="border rounded p-2"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                </select>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
                <table className="w-full table-auto">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-2 text-left">ID</th>
                            <th className="p-2 text-left">Address</th>
                            <th className="p-2 text-left">Status</th>
                            <th className="p-2 text-left">Registered</th>
                            <th className="p-2 text-left">Proofs</th>
                            <th className="p-2 text-left">Last Active</th>
                            <th className="p-2 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(user => (
                            <tr key={user.id} className="border-t">
                                <td className="p-2">{user.id}</td>
                                <td className="p-2">{user.address}</td>
                                <td className="p-2">
                                    <span className={`px-2 py-1 rounded-full text-xs ${user.status === 'active' ? 'bg-green-100 text-green-800' :
                                        user.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                        {user.status}
                                    </span>
                                </td>
                                <td className="p-2">{user.registeredAt}</td>
                                <td className="p-2">{user.proofCount}</td>
                                <td className="p-2">{user.lastActive}</td>
                                <td className="p-2 space-x-2">
                                    <button
                                        onClick={() => setSelectedUser(user)}
                                        className="text-blue-600 hover:underline"
                                    >
                                        View
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* User Details Modal */}
            {selectedUser && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
                        <h3 className="text-lg font-semibold mb-4">User Details: {selectedUser.id}</h3>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <p className="text-gray-600">Wallet Address</p>
                                <p className="font-medium">{selectedUser.address}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Status</p>
                                <p className="font-medium capitalize">{selectedUser.status}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Registered</p>
                                <p className="font-medium">{selectedUser.registeredAt}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Last Active</p>
                                <p className="font-medium">{selectedUser.lastActive}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Proofs Count</p>
                                <p className="font-medium">{selectedUser.proofCount}</p>
                            </div>
                        </div>

                        {/* Status Change Section */}
                        <div className="mb-4">
                            <h4 className="font-medium mb-2">Change Status</h4>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => handleStatusChange(selectedUser.id, 'active')}
                                    disabled={selectedUser.status === 'active'}
                                    className={`px-3 py-1 rounded ${selectedUser.status === 'active' ? 'bg-gray-100 text-gray-400' : 'bg-green-500 text-white'
                                        }`}
                                >
                                    Activate
                                </button>
                                <button
                                    onClick={() => handleStatusChange(selectedUser.id, 'inactive')}
                                    disabled={selectedUser.status === 'inactive'}
                                    className={`px-3 py-1 rounded ${selectedUser.status === 'inactive' ? 'bg-gray-100 text-gray-400' : 'bg-yellow-500 text-white'
                                        }`}
                                >
                                    Deactivate
                                </button>
                                <button
                                    onClick={() => handleStatusChange(selectedUser.id, 'suspended')}
                                    disabled={selectedUser.status === 'suspended'}
                                    className={`px-3 py-1 rounded ${selectedUser.status === 'suspended' ? 'bg-gray-100 text-gray-400' : 'bg-red-500 text-white'
                                        }`}
                                >
                                    Suspend
                                </button>
                            </div>
                        </div>

                        {/* Add Note Section */}
                        <div className="mb-4">
                            <h4 className="font-medium mb-2">Add Support Note</h4>
                            <textarea
                                className="w-full border rounded p-2"
                                rows="3"
                                placeholder="Add notes about this user..."
                                id="userNote"
                            ></textarea>
                            <button
                                onClick={() => {
                                    const note = document.getElementById('userNote').value;
                                    if (note) handleAddNote(selectedUser.id, note);
                                }}
                                className="mt-2 px-3 py-1 bg-blue-500 text-white rounded"
                            >
                                Add Note
                            </button>
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={() => setSelectedUser(null)}
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