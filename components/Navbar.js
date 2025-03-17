import Link from 'next/link';
import ConnectWallet from './ConnectWallet';
import { useState } from 'react';

export default function Navbar() {
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = () => {
        setRefreshing(true);
        // Force a page refresh
        window.location.reload();
    };

    return (
        <nav className="bg-white shadow">
            <div className="container mx-auto px-4">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        <Link href="/" className="flex-shrink-0 flex items-center">
                            <span className="text-xl font-bold text-primary-600">Proof of Funds</span>
                        </Link>

                        <div className="hidden md:ml-6 md:flex md:space-x-8">
                            <Link href="/" className="text-gray-600 hover:text-primary-600 px-3 py-2 text-sm font-medium">
                                Home
                            </Link>
                            <Link href="/create" className="text-gray-600 hover:text-primary-600 px-3 py-2 text-sm font-medium">
                                Create Proof
                            </Link>
                            <Link href="/verify" className="text-gray-600 hover:text-primary-600 px-3 py-2 text-sm font-medium">
                                Verify Proof
                            </Link>
                            <Link href="/manage" className="text-gray-600 hover:text-primary-600 px-3 py-2 text-sm font-medium">
                                Manage Proofs
                            </Link>
                        </div>
                    </div>

                    <div className="flex items-center">
                        <ConnectWallet />
                    </div>
                </div>
            </div>
        </nav>
    );
} 