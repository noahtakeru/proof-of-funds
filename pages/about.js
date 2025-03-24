import Link from 'next/link';

export default function AboutPage() {
    return (
        <div className="max-w-4xl mx-auto py-10 px-4 about-page">
            <h1 className="text-4xl font-bold text-center mb-10">About <span className="text-primary-600">Arbitr<span className="text-zk-accent">.</span></span></h1>

            <div className="space-y-12">
                <section className="py-12 border-b border-gray-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
                            <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
                                <h1 className="mt-1 text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight xl:text-6xl xl:tracking-tight">
                                    <span className="block">About</span>
                                    <span className="block text-primary-600">Arbitr Proof of Funds</span>
                                </h1>
                                <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                                    Revolutionizing financial verifications through secure, private, and reliable proof of funds solutions.
                                </p>
                            </div>
                            <div className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
                                <div className="relative mx-auto w-full rounded-lg shadow-lg">
                                    <div className="relative block w-full bg-white rounded-lg overflow-hidden">
                                        <img
                                            className="w-full"
                                            src="/images/team.jpg"
                                            alt="Arbitr team"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">Our Mission</h2>
                    <p className="text-lg text-gray-700 mb-6">
                        Arbitr is revolutionizing the way financial verification happens on the blockchain.
                        Our mission is to create trust and transparency in digital financial transactions
                        without compromising privacy or security.
                    </p>
                    <p className="text-lg text-gray-700">
                        We believe that in a decentralized world, the ability to prove ownership and financial capacity
                        should be accessible to everyone, without revealing sensitive information.
                    </p>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="feature-card bg-white shadow-lg p-6">
                        <div className="h-12 w-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Privacy-First Approach</h3>
                        <p className="text-gray-600">
                            Using cutting-edge zero-knowledge proofs, Arbitr allows users to prove they have sufficient
                            funds without revealing actual balances or sensitive information.
                        </p>
                    </div>

                    <div className="feature-card bg-white shadow-lg p-6">
                        <div className="h-12 w-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Multi-Chain Support</h3>
                        <p className="text-gray-600">
                            Our platform bridges multiple blockchains, allowing users to verify assets across
                            networks, creating a unified financial verification experience.
                        </p>
                    </div>
                </div>

                <section className="py-12 bg-zk-light">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
                            <div>
                                <h2 className="text-3xl font-extrabold text-gray-900">
                                    Zero-Knowledge Technology
                                </h2>
                                <p className="mt-4 text-lg text-gray-500">
                                    Our platform uses advanced zero-knowledge proofs to verify asset ownership without revealing sensitive information. This cryptographic breakthrough ensures your financial privacy remains intact.
                                </p>
                                <div className="mt-6">
                                    <Link href="/tech" className="text-zk font-medium hover:text-zk-accent-dark">
                                        Learn more about our tech &rarr;
                                    </Link>
                                </div>
                            </div>
                            <div className="mt-12 lg:mt-0">
                                <div className="bg-white rounded-lg shadow-xl overflow-hidden">
                                    <div className="px-6 py-8 sm:p-10">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 bg-zk-accent rounded-md p-3">
                                                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                            </div>
                                            <div className="ml-5">
                                                <h3 className="text-lg font-medium text-gray-900">Private by Design</h3>
                                                <p className="mt-2 text-sm text-gray-500">Enhanced privacy protection using zero-knowledge cryptography.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">Our Story</h2>
                    <p className="text-lg text-gray-700 mb-6">
                        Founded in 2025 by Noah Karpel, Arbitr emerged from the realization that the financial world needed a
                        solution for secure verification that didn't compromise privacy.
                    </p>
                    <p className="text-lg text-gray-700 mb-6">
                        After years of working in both traditional finance and blockchain technology, Noah identified a critical
                        gap in how users could verify their financial capacity without exposing themselves to security risks.
                    </p>
                    <p className="text-lg text-gray-700 mb-6">
                        With extensive experience in consumer fintech, Noah brings a deep understanding of user needs, financial
                        regulations, and privacy concerns to Arbitr. This expertise has shaped our platform to be both user-friendly
                        and compliant with emerging regulatory frameworks.
                    </p>
                    <div className="flex items-center">
                        <div className="w-16 h-16 bg-primary-100 rounded-full mr-4 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-primary-600">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold">Noah Karpel</h3>
                            <p className="text-gray-600">Kenny's Boyfriend</p>
                        </div>
                    </div>
                </section>

                <div className="border-t pt-8">
                    <h2 className="text-2xl font-semibold mb-4">Ready to Experience Arbitr?</h2>
                    <p className="text-lg text-gray-700 mb-6">
                        Join the growing community of users and businesses that trust Arbitr for secure financial verification.
                    </p>
                    <div className="flex space-x-4">
                        <a href="/create" className="btn btn-primary">Create Your First Proof</a>
                        <a href="/verify" className="btn btn-secondary">Verify a Proof</a>
                    </div>
                </div>
            </div>
        </div>
    );
} 