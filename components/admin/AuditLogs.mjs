/**
 * Admin Audit Logs Component
 * 
 * This component displays a comprehensive audit log interface for administrators,
 * allowing them to review system activity and security events.
 * 
 * Features:
 * - Searchable and filterable audit log entries
 * - Detailed view for specific events
 * - Filtering by date range, event type, and user
 * - Color-coded severity levels
 * - Export functionality
 * 
 * ---------- MOCK STATUS ----------
 * This file contains the following mock implementations:
 * - mockLogs (lines 48-95): Hardcoded array of audit log entries
 * - Export functionality (line 154): Simulates export without generating real files
 * 
 * These mocks are documented in MOCKS.md with priority LOW for replacement.
 * 
 * Note: Currently using mock data for demonstration.
 * Production implementation would connect to secure audit logging
 * services and backend APIs for comprehensive audit trail.
 */

import { useState, useEffect } from 'react';

export default function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterDateRange, setFilterDateRange] = useState('all');
    const [selectedLog, setSelectedLog] = useState(null);

    // Mock data for demonstration
    useEffect(() => {
        const mockLogs = [
            {
                id: '1',
                timestamp: '2023-03-16T10:23:45',
                user: '0x1234...5678',
                action: 'CREATE_PROOF',
                category: 'proof',
                details: 'Created a standard proof of funds',
                ip: '192.168.1.12'
            },
            {
                id: '2',
                timestamp: '2023-03-16T09:15:22',
                user: '0x2345...6789',
                action: 'VERIFY_PROOF',
                category: 'proof',
                details: 'Verified proof #5678',
                ip: '192.168.1.87'
            },
            {
                id: '3',
                timestamp: '2023-03-15T16:42:11',
                user: 'admin',
                action: 'REVOKE_PROOF',
                category: 'admin',
                details: 'Admin revoked proof #1234 for user 0x3456...7890',
                ip: '192.168.1.1'
            },
            {
                id: '4',
                timestamp: '2023-03-15T14:35:28',
                user: '0x4567...8901',
                action: 'CONNECT_WALLET',
                category: 'auth',
                details: 'User connected wallet',
                ip: '192.168.1.45'
            },
            {
                id: '5',
                timestamp: '2023-03-14T11:12:34',
                user: 'admin',
                action: 'UPDATE_SYSTEM_CONFIG',
                category: 'admin',
                details: 'Admin updated system configuration: Enabled ZK proofs',
                ip: '192.168.1.1'
            },
        ];
        setLogs(mockLogs);
        setFilteredLogs(mockLogs);
    }, []);

    // Filter logs based on search and filters
    useEffect(() => {
        let result = logs;

        // Filter by search term
        if (searchTerm) {
            result = result.filter(log =>
                log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.details.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Filter by category
        if (filterCategory !== 'all') {
            result = result.filter(log => log.category === filterCategory);
        }

        // Filter by date range
        if (filterDateRange !== 'all') {
            const now = new Date();
            const dayInMs = 24 * 60 * 60 * 1000;
            let startDate;

            switch (filterDateRange) {
                case 'today':
                    startDate = new Date(now.setHours(0, 0, 0, 0));
                    break;
                case 'yesterday':
                    startDate = new Date(now.setHours(0, 0, 0, 0) - dayInMs);
                    break;
                case 'last7days':
                    startDate = new Date(now.getTime() - 7 * dayInMs);
                    break;
                case 'last30days':
                    startDate = new Date(now.getTime() - 30 * dayInMs);
                    break;
                default:
                    startDate = null;
            }

            if (startDate) {
                result = result.filter(log => new Date(log.timestamp) >= startDate);
            }
        }

        setFilteredLogs(result);
    }, [logs, searchTerm, filterCategory, filterDateRange]);

    const handleExportLogs = (format) => {
        // In production, this would generate and download the file
        alert(`Logs would be exported in ${format.toUpperCase()} format in production`);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Audit & Compliance</h2>

            {/* Search and Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="md:col-span-2">
                    <input
                        type="text"
                        placeholder="Search logs..."
                        className="w-full border rounded p-2"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div>
                    <select
                        className="w-full border rounded p-2"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <option value="all">All Categories</option>
                        <option value="proof">Proof</option>
                        <option value="auth">Authentication</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>

                <div>
                    <select
                        className="w-full border rounded p-2"
                        value={filterDateRange}
                        onChange={(e) => setFilterDateRange(e.target.value)}
                    >
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="last7days">Last 7 Days</option>
                        <option value="last30days">Last 30 Days</option>
                    </select>
                </div>
            </div>

            {/* Export Buttons */}
            <div className="flex space-x-2 mb-4">
                <button
                    onClick={() => handleExportLogs('csv')}
                    className="px-4 py-2 bg-gray-200 rounded text-sm"
                >
                    Export as CSV
                </button>
                <button
                    onClick={() => handleExportLogs('json')}
                    className="px-4 py-2 bg-gray-200 rounded text-sm"
                >
                    Export as JSON
                </button>
                <button
                    onClick={() => handleExportLogs('pdf')}
                    className="px-4 py-2 bg-gray-200 rounded text-sm"
                >
                    Export as PDF
                </button>
            </div>

            {/* Logs Table */}
            <div className="overflow-x-auto">
                <table className="w-full table-auto">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-2 text-left">ID</th>
                            <th className="p-2 text-left">Time</th>
                            <th className="p-2 text-left">User</th>
                            <th className="p-2 text-left">Action</th>
                            <th className="p-2 text-left">Details</th>
                            <th className="p-2 text-left">IP</th>
                            <th className="p-2 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLogs.map(log => (
                            <tr key={log.id} className="border-t">
                                <td className="p-2">{log.id}</td>
                                <td className="p-2">{new Date(log.timestamp).toLocaleString()}</td>
                                <td className="p-2">{log.user}</td>
                                <td className="p-2">
                                    <span className={`px-2 py-1 rounded-full text-xs ${log.category === 'admin' ? 'bg-purple-100 text-purple-800' :
                                        log.category === 'auth' ? 'bg-blue-100 text-blue-800' :
                                            'bg-green-100 text-green-800'
                                        }`}>
                                        {log.action}
                                    </span>
                                </td>
                                <td className="p-2">{log.details}</td>
                                <td className="p-2">{log.ip}</td>
                                <td className="p-2">
                                    <button
                                        onClick={() => setSelectedLog(log)}
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

            {/* Log Details Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
                        <h3 className="text-lg font-semibold mb-4">Log Details: {selectedLog.id}</h3>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <p className="text-gray-600">Timestamp</p>
                                <p className="font-medium">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">User</p>
                                <p className="font-medium">{selectedLog.user}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Action</p>
                                <p className="font-medium">{selectedLog.action}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Category</p>
                                <p className="font-medium capitalize">{selectedLog.category}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">IP Address</p>
                                <p className="font-medium">{selectedLog.ip}</p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <p className="text-gray-600">Details</p>
                            <p className="font-medium">{selectedLog.details}</p>
                        </div>

                        <div className="p-3 bg-gray-50 rounded mb-6">
                            <h4 className="font-medium mb-2">Technical Details</h4>
                            <pre className="text-xs overflow-x-auto">
                                {JSON.stringify({
                                    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                                    request_id: "req_" + Math.random().toString(36).substring(2, 10),
                                    session_id: "sess_" + Math.random().toString(36).substring(2, 10),
                                    referrer: "/create"
                                }, null, 2)}
                            </pre>
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={() => setSelectedLog(null)}
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