import { useState } from 'react';
import { PROOF_TYPES, ZK_PROOF_TYPES } from '@/config/constants';

export default function EducationalGuide() {
    const [activeTab, setActiveTab] = useState<'overview' | 'proofTypes' | 'verification' | 'security'>('overview');
    const [isOpen, setIsOpen] = useState(false);

    const toggleGuide = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative">
            {/* Hamburger button for mobile */}
            <button
                onClick={toggleGuide}
                className="md:hidden fixed bottom-6 right-6 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                aria-label="Toggle educational guide"
            >
                {isOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                )}
            </button>

            {/* Guide content - hidden on mobile unless toggled */}
            <div className={`premium-card fade-in ${isOpen ? 'fixed inset-0 z-40 m-4 md:static md:m-0' : 'hidden md:block'}`}>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 border-b flex justify-between items-center">
                    <h3 className="text-base font-medium text-blue-800">Understanding Proof of Funds</h3>
                    <button
                        onClick={toggleGuide}
                        className="md:hidden text-blue-800 hover:text-blue-600 transition-colors"
                        aria-label="Close guide"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="border-b overflow-x-auto">
                    <nav className="flex -mb-px px-4">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'overview'
                                ? 'border-b-2 border-blue-500 text-blue-600'
                                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('proofTypes')}
                            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'proofTypes'
                                ? 'border-b-2 border-blue-500 text-blue-600'
                                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Proof Types
                        </button>
                        <button
                            onClick={() => setActiveTab('verification')}
                            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'verification'
                                ? 'border-b-2 border-blue-500 text-blue-600'
                                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Verification
                        </button>
                        <button
                            onClick={() => setActiveTab('security')}
                            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'security'
                                ? 'border-b-2 border-blue-500 text-blue-600'
                                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Security
                        </button>
                    </nav>
                </div>

                <div className="p-5 overflow-y-auto max-h-[calc(100vh-10rem)] md:max-h-none">
                    {activeTab === 'overview' && (
                        <div className="space-y-4">
                            <h4 className="font-medium text-gray-900">What is Proof of Funds?</h4>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                Proof of Funds (PoF) is a verification system that allows you to prove you have a certain amount of funds in your wallet without revealing the exact balance. This is useful for various applications such as:
                            </p>
                            <ul className="text-sm text-gray-600 list-disc pl-5 space-y-2">
                                <li>Qualifying for participation in token sales or NFT mints</li>
                                <li>Verifying financial requirements for services or platforms</li>
                                <li>Demonstrating financial capacity without exposing your full balance</li>
                                <li>Meeting minimum balance requirements for certain DeFi protocols</li>
                            </ul>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                Our system uses blockchain technology to create tamper-proof, verifiable proofs that can be checked by any third party without requiring them to trust us as an intermediary.
                            </p>
                        </div>
                    )}

                    {activeTab === 'proofTypes' && (
                        <div className="space-y-5">
                            <div className="p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
                                <h4 className="font-medium text-gray-900 flex items-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 mr-2 text-xs">1</span>
                                    Standard Proof
                                </h4>
                                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                                    Verifies that you have exactly the specified amount. Useful when you need to prove a precise balance.
                                </p>
                            </div>

                            <div className="p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
                                <h4 className="font-medium text-gray-900 flex items-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 mr-2 text-xs">2</span>
                                    Threshold Proof
                                </h4>
                                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                                    Verifies that you have at least the specified amount. Ideal for minimum balance requirements.
                                </p>
                            </div>

                            <div className="p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
                                <h4 className="font-medium text-gray-900 flex items-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 mr-2 text-xs">3</span>
                                    Maximum Proof
                                </h4>
                                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                                    Verifies that you have less than the specified amount. Useful for capped participation or tiered access.
                                </p>
                            </div>

                            <div className="p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
                                <h4 className="font-medium text-gray-900 flex items-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-600 mr-2 text-xs">ZK</span>
                                    Zero-Knowledge Proof
                                </h4>
                                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                                    Provides the highest level of privacy. Proves fund ownership without revealing any specific amounts or wallet details.
                                </p>
                            </div>

                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                                <p className="text-sm text-blue-700 leading-relaxed">
                                    <span className="font-medium">Pro Tip:</span> Choose the proof type that provides just enough information for your specific use case while maximizing your privacy.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'verification' && (
                        <div className="space-y-4">
                            <h4 className="font-medium text-gray-900">How Verification Works</h4>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                Our verification process is designed to be simple, secure, and transparent:
                            </p>

                            <ol className="text-sm text-gray-600 list-decimal pl-5 space-y-3">
                                <li className="pl-1">
                                    <span className="font-medium text-gray-900">Proof Creation:</span> You connect your wallet and generate a proof of your funds, selecting the type of proof and amount.
                                </li>
                                <li className="pl-1">
                                    <span className="font-medium text-gray-900">Signature:</span> You sign a message with your private key to confirm ownership of the wallet and funds.
                                </li>
                                <li className="pl-1">
                                    <span className="font-medium text-gray-900">On-chain Storage:</span> The proof is stored on the blockchain with a timestamp and expiration date.
                                </li>
                                <li className="pl-1">
                                    <span className="font-medium text-gray-900">Verification:</span> Anyone can verify your proof by entering your wallet address on the verification page.
                                </li>
                            </ol>

                            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100 mt-3">
                                <p className="text-sm text-yellow-700 leading-relaxed">
                                    <span className="font-medium">Important:</span> Verifiers only see what you've chosen to prove - not your actual balance or transaction history.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="space-y-4">
                            <h4 className="font-medium text-gray-900">Security Features</h4>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                Our system incorporates several security features to protect your information:
                            </p>

                            <ul className="text-sm text-gray-600 space-y-3">
                                <li className="flex items-start">
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 mr-2 text-xs flex-shrink-0 mt-0.5">✓</span>
                                    <div>
                                        <span className="font-medium text-gray-900">Expiration Dates:</span> All proofs have an expiration date to prevent outdated information from being used.
                                    </div>
                                </li>
                                <li className="flex items-start">
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 mr-2 text-xs flex-shrink-0 mt-0.5">✓</span>
                                    <div>
                                        <span className="font-medium text-gray-900">Revocation:</span> You can revoke a proof at any time if you no longer want it to be valid.
                                    </div>
                                </li>
                                <li className="flex items-start">
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 mr-2 text-xs flex-shrink-0 mt-0.5">✓</span>
                                    <div>
                                        <span className="font-medium text-gray-900">Signature Verification:</span> Custom signature messages ensure the proof is being used for its intended purpose.
                                    </div>
                                </li>
                                <li className="flex items-start">
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 mr-2 text-xs flex-shrink-0 mt-0.5">✓</span>
                                    <div>
                                        <span className="font-medium text-gray-900">Zero-Knowledge Options:</span> For maximum privacy, zero-knowledge proofs reveal minimal information.
                                    </div>
                                </li>
                            </ul>

                            <div className="p-4 bg-green-50 rounded-lg border border-green-100 mt-3">
                                <p className="text-sm text-green-700 leading-relaxed">
                                    <span className="font-medium">Best Practice:</span> Regularly check your active proofs and revoke any that are no longer needed to maintain optimal security.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
} 