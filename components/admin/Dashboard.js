import { useState, useEffect } from 'react';
import { PROOF_TYPES, ZK_PROOF_TYPES } from '../../config/constants';

export default function AdminDashboard() {
    const [metrics, setMetrics] = useState({
        activeProofs: {
            standard: 0,
            threshold: 0,
            maximum: 0,
            zk: 0
        },
        systemHealth: {
            gasUsage: '0',
            apiResponseTime: '0',
            uptime: '0',
            errorRate: '0'
        },
        userActivity: {
            newUsers: 0,
            active24h: 0,
            active7d: 0,
            active30d: 0,
            verificationAttempts: {
                success: 0,
                failed: 0
            }
        }
    });

    // Mock data for demonstration
    useEffect(() => {
        // Simulate API fetch
        setTimeout(() => {
            setMetrics({
                activeProofs: {
                    standard: 123,
                    threshold: 45,
                    maximum: 67,
                    zk: 89
                },
                systemHealth: {
                    gasUsage: '0.0005 ETH',
                    apiResponseTime: '200ms',
                    uptime: '99.9%',
                    errorRate: '0.1%'
                },
                userActivity: {
                    newUsers: 12,
                    active24h: 345,
                    active7d: 2345,
                    active30d: 5678,
                    verificationAttempts: {
                        success: 1234,
                        failed: 56
                    }
                }
            });
        }, 500);
    }, []);

    return (
        <div className="space-y-8">
            {/* Active Proofs Section */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Active Proofs Summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(metrics.activeProofs).map(([type, count]) => (
                        <div key={type} className="p-4 border rounded">
                            <div className="text-gray-600 capitalize">{type} Proofs</div>
                            <div className="text-2xl font-bold">{count}</div>
                        </div>
                    ))}
                </div>

                {/* Chart placeholder */}
                <div className="mt-6 h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500 italic">Proof creation chart over time would appear here</p>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded">
                        <div className="text-gray-600">Average Proof Duration</div>
                        <div className="text-2xl font-bold">32 days</div>
                    </div>
                    <div className="p-4 border rounded">
                        <div className="text-gray-600">Most Popular Proof</div>
                        <div className="text-2xl font-bold">Standard</div>
                    </div>
                    <div className="p-4 border rounded">
                        <div className="text-gray-600">Proof Creation Rate</div>
                        <div className="text-2xl font-bold">18/day</div>
                    </div>
                </div>
            </div>

            {/* System Health Section */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">System Health Metrics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(metrics.systemHealth).map(([metric, value]) => (
                        <div key={metric} className="p-4 border rounded">
                            <div className="text-gray-600 capitalize">{metric.replace(/([A-Z])/g, ' $1')}</div>
                            <div className="text-2xl font-bold">{value}</div>
                        </div>
                    ))}
                </div>

                {/* Chart placeholder */}
                <div className="mt-6 h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500 italic">System performance metrics chart would appear here</p>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded">
                        <div className="text-gray-600">Avg Contract Call Cost</div>
                        <div className="text-2xl font-bold">0.0003 MATIC</div>
                    </div>
                    <div className="p-4 border rounded">
                        <div className="text-gray-600">Last System Restart</div>
                        <div className="text-2xl font-bold">12 days ago</div>
                    </div>
                </div>
            </div>

            {/* User Activity Section */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">User Activity</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 border rounded">
                        <div className="text-gray-600">New Users</div>
                        <div className="text-2xl font-bold">{metrics.userActivity.newUsers}</div>
                    </div>
                    <div className="p-4 border rounded">
                        <div className="text-gray-600">Active (24h)</div>
                        <div className="text-2xl font-bold">{metrics.userActivity.active24h}</div>
                    </div>
                    <div className="p-4 border rounded">
                        <div className="text-gray-600">Active (7d)</div>
                        <div className="text-2xl font-bold">{metrics.userActivity.active7d}</div>
                    </div>
                    <div className="p-4 border rounded">
                        <div className="text-gray-600">Active (30d)</div>
                        <div className="text-2xl font-bold">{metrics.userActivity.active30d}</div>
                    </div>
                </div>

                {/* Chart placeholder */}
                <div className="mt-6 h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500 italic">User activity chart would appear here</p>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded">
                        <div className="text-gray-600">Verification Success Rate</div>
                        <div className="text-2xl font-bold">
                            {Math.round((metrics.userActivity.verificationAttempts.success /
                                (metrics.userActivity.verificationAttempts.success +
                                    metrics.userActivity.verificationAttempts.failed) || 0) * 100)}%
                        </div>
                    </div>
                    <div className="p-4 border rounded">
                        <div className="text-gray-600">Verification Attempts</div>
                        <div className="text-2xl font-bold">
                            {metrics.userActivity.verificationAttempts.success +
                                metrics.userActivity.verificationAttempts.failed}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 