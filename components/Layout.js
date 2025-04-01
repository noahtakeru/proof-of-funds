/**
 * Layout Component
 * 
 * Provides a consistent page structure across the application.
 * This component wraps all pages with common elements including:
 * 
 * - Document head with title and meta tags
 * - Navigation bar for site-wide navigation
 * - Main content area with appropriate spacing and container sizing
 * - Footer with copyright information
 */

import React from 'react';
import Link from 'next/link';
import Head from 'next/head';

const Layout = ({ children, title = 'Proof of Funds - Polygon' }) => {
    return (
        <>
            <Head>
                <title>{title}</title>
                <meta name="description" content="Proof of Funds on Polygon Amoy testnet" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <div className="min-h-screen flex flex-col bg-gray-100">
                <nav className="bg-white shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-16">
                            <div className="flex">
                                <div className="flex-shrink-0 flex items-center">
                                    <Link href="/">
                                        <span className="text-xl font-bold text-indigo-600 cursor-pointer">
                                            Proof of Funds
                                        </span>
                                    </Link>
                                </div>
                                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                    <Link href="/zk-home">
                                        <span className="border-indigo-500 text-gray-900 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium cursor-pointer">
                                            ZK Proofs
                                        </span>
                                    </Link>
                                    <Link href="/create-zk">
                                        <span className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium cursor-pointer">
                                            Create Proof
                                        </span>
                                    </Link>
                                    <Link href="/verify-zk">
                                        <span className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium cursor-pointer">
                                            Verify Proof
                                        </span>
                                    </Link>
                                    <Link href="/manage-zk">
                                        <span className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium cursor-pointer">
                                            Manage Proofs
                                        </span>
                                    </Link>
                                    <Link href="/test-temp-wallet">
                                        <span className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium cursor-pointer">
                                            Test Wallet
                                        </span>
                                    </Link>
                                </div>
                            </div>
                            <div className="hidden sm:ml-6 sm:flex sm:items-center">
                                <button
                                    type="button"
                                    className="bg-indigo-600 p-1 rounded-full text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    <span className="sr-only">Connect Wallet</span>
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </nav>

                <main className="flex-grow py-10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        {children}
                    </div>
                </main>

                <footer className="bg-white">
                    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                        <p className="text-center text-sm text-gray-500">
                            © 2024 Proof of Funds on Polygon | <a href="https://polygon.technology/" className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">Polygon Technology</a>
                        </p>
                    </div>
                </footer>
            </div>
        </>
    );
};

export default Layout; 