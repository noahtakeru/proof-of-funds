import Link from 'next/link';
import ConnectWallet from './ConnectWallet';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Navbar() {
    const [refreshing, setRefreshing] = useState(false);
    const router = useRouter();
    const [activeRoute, setActiveRoute] = useState('/');

    useEffect(() => {
        setActiveRoute(router.pathname);
    }, [router.pathname]);

    const isActive = (path) => {
        return path === activeRoute;
    };

    const handleRefresh = () => {
        setRefreshing(true);
        // Force a page refresh
        window.location.reload();
    };

    return (
        <nav className="bg-white shadow sticky top-0 z-50">
            <div className="container mx-auto px-4">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        <Link href="/" className="flex-shrink-0 flex items-center">
                            <div className="flex flex-col items-start">
                                <div className="logo-pop flex items-center">
                                    <span className="text-2xl font-extrabold text-primary-600">
                                        <span>Arbitr</span>
                                        <span className="text-zk">.</span>
                                    </span>
                                </div>
                                <span className="text-xs text-gray-500 -mt-1">Proof of Funds</span>
                            </div>
                        </Link>

                        <div className="hidden md:ml-6 md:flex md:space-x-8">
                            <Link
                                href="/"
                                className={`px-3 py-2 text-sm font-medium ${isActive('/')
                                    ? 'nav-link-active'
                                    : 'text-gray-600 hover:text-primary-600'}`}
                            >
                                Home
                            </Link>
                            <Link
                                href="/create"
                                className={`px-3 py-2 text-sm font-medium ${isActive('/create')
                                    ? 'nav-link-active'
                                    : 'text-gray-600 hover:text-primary-600'}`}
                            >
                                Create Proof
                            </Link>
                            <Link
                                href="/verify"
                                className={`px-3 py-2 text-sm font-medium ${isActive('/verify')
                                    ? 'nav-link-active'
                                    : 'text-gray-600 hover:text-primary-600'}`}
                            >
                                Verify Proof
                            </Link>
                            <Link
                                href="/manage"
                                className={`px-3 py-2 text-sm font-medium ${isActive('/manage')
                                    ? 'nav-link-active'
                                    : 'text-gray-600 hover:text-primary-600'}`}
                            >
                                Manage Proofs
                            </Link>
                            <Link
                                href="/about"
                                className={`px-3 py-2 text-sm font-medium ${isActive('/about')
                                    ? 'nav-link-active'
                                    : 'text-gray-600 hover:text-primary-600'}`}
                            >
                                About
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