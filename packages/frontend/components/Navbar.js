/**
 * Navigation Bar Component
 * 
 * Provides the primary navigation for the Arbitr platform, allowing users
 * to move between different sections of the application.
 * 
 * Key features:
 * - Responsive design that adapts to different screen sizes
 * - Visual indication of the currently active route
 * - Branding elements with the Arbitr logo and name
 * - Integrated wallet connection interface via the ConnectWallet component
 * - Dynamic route highlighting based on the current page
 * 
 * The navbar is sticky-positioned at the top of the viewport to ensure
 * navigation controls are always accessible to the user regardless of
 * scroll position.
 */

import Link from 'next/link';
import ConnectWallet from './ConnectWallet';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

// Dynamically import these components to avoid hydration errors
const UserProfileDropdown = dynamic(() => import('./user/UserProfileDropdown'), { ssr: false });
const AdminNavLinks = dynamic(() => import('./AdminNavLinks'), { ssr: false });

export default function Navbar() {
    const [refreshing, setRefreshing] = useState(false);
    const router = useRouter();
    const [activeRoute, setActiveRoute] = useState('/');

    useEffect(() => {
        setActiveRoute(router.pathname);
    }, [router.pathname]);

    const getActiveClass = (href) => {
        const isActive = router.pathname === href;
        return isActive ? 'text-primary-600 border-primary-600' : 'text-gray-500 hover:text-gray-700 border-transparent hover:border-gray-300';
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
                                        <span className="text-zk-accent">.</span>
                                    </span>
                                </div>
                                <span className="text-xs text-gray-500 -mt-1">Proof of Funds</span>
                            </div>
                        </Link>

                        <div className="hidden md:ml-6 md:flex md:space-x-8">
                            <Link
                                href="/"
                                className={getActiveClass('/')}
                            >
                                Home
                            </Link>
                            <Link
                                href="/create"
                                className={getActiveClass('/create')}
                            >
                                Create Proof
                            </Link>
                            <Link
                                href="/verify"
                                className={getActiveClass('/verify')}
                            >
                                Verify Proof
                            </Link>
                            <Link
                                href="/manage"
                                className={getActiveClass('/manage')}
                            >
                                Manage Proofs
                            </Link>
                            <Link
                                href="/about"
                                className={getActiveClass('/about')}
                            >
                                About
                            </Link>
                            <Link
                                href="/tech"
                                className={getActiveClass('/tech')}
                            >
                                Tech
                            </Link>
                            
                            <AdminNavLinks />
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <ConnectWallet />
                        <UserProfileDropdown />
                    </div>
                </div>
            </div>
        </nav>
    );
} 