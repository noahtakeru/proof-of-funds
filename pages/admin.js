import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import AdminDashboard from '../components/admin/Dashboard';
import ProofManagement from '../components/admin/ProofManagement';
import UserManagement from '../components/admin/UserManagement';
import ContractManagement from '../components/admin/ContractManagement';
import SystemConfig from '../components/admin/SystemConfig';
import AuditLogs from '../components/admin/AuditLogs';

export default function AdminPage() {
    // Add a flag to track user-initiated connection, initialized from localStorage
    const [userInitiatedConnection, setUserInitiatedConnection] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('userInitiatedConnection') === 'true';
        }
        return false;
    });

    const { address } = useAccount();
    const [activeTab, setActiveTab] = useState('dashboard');

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

    // TODO: Implement proper admin role verification
    const isAdmin = userInitiatedConnection && true; // Replace with actual admin verification logic that requires connection

    if (!isAdmin) {
        return <div className="p-8">You must connect your wallet with admin privileges to access this page.</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto py-8">
                <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

                <div className="flex space-x-4 mb-8">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`px-4 py-2 rounded ${activeTab === 'dashboard' ? 'bg-blue-500 text-white' : 'bg-white'}`}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('proofs')}
                        className={`px-4 py-2 rounded ${activeTab === 'proofs' ? 'bg-blue-500 text-white' : 'bg-white'}`}
                    >
                        Proof Management
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 rounded ${activeTab === 'users' ? 'bg-blue-500 text-white' : 'bg-white'}`}
                    >
                        User Management
                    </button>
                    <button
                        onClick={() => setActiveTab('contracts')}
                        className={`px-4 py-2 rounded ${activeTab === 'contracts' ? 'bg-blue-500 text-white' : 'bg-white'}`}
                    >
                        Contract Management
                    </button>
                    <button
                        onClick={() => setActiveTab('config')}
                        className={`px-4 py-2 rounded ${activeTab === 'config' ? 'bg-blue-500 text-white' : 'bg-white'}`}
                    >
                        System Configuration
                    </button>
                    <button
                        onClick={() => setActiveTab('audit')}
                        className={`px-4 py-2 rounded ${activeTab === 'audit' ? 'bg-blue-500 text-white' : 'bg-white'}`}
                    >
                        Audit & Compliance
                    </button>
                </div>

                {activeTab === 'dashboard' && <AdminDashboard />}
                {activeTab === 'proofs' && <ProofManagement />}
                {activeTab === 'users' && <UserManagement />}
                {activeTab === 'contracts' && <ContractManagement />}
                {activeTab === 'config' && <SystemConfig />}
                {activeTab === 'audit' && <AuditLogs />}
            </div>
        </div>
    );
} 