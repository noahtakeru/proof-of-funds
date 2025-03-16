import React from 'react';

const UnderstandingPOF = () => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Understanding Proof of Funds</h2>
            <div className="space-y-4 text-gray-700">
                <p>
                    Proof of Funds (POF) documents verify that you have sufficient liquid assets to complete a transaction, providing
                    confidence to counterparties about your financial capacity.
                </p>
                <div className="space-y-3">
                    <h3 className="text-md font-medium text-gray-800">Common use cases:</h3>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Real estate purchases and development projects</li>
                        <li>Business acquisitions and investment opportunities</li>
                        <li>High-value asset purchases and transactions</li>
                        <li>Tender participation and contract bidding</li>
                    </ul>
                </div>
                <div className="space-y-3">
                    <h3 className="text-md font-medium text-gray-800">Types of verification:</h3>
                    <ul className="space-y-3">
                        <li>
                            <span className="font-medium text-blue-600">Standard:</span>
                            <p className="mt-1">Verifies an exact amount of funds in a wallet.</p>
                        </li>
                        <li>
                            <span className="font-medium text-blue-600">Threshold:</span>
                            <p className="mt-1">Confirms a wallet holds at least a minimum amount of funds.</p>
                        </li>
                        <li>
                            <span className="font-medium text-blue-600">Maximum:</span>
                            <p className="mt-1">Validates that funds don't exceed a specified maximum amount.</p>
                        </li>
                    </ul>
                </div>
                <div className="space-y-3">
                    <h3 className="text-md font-medium text-gray-800">Security features:</h3>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>All proofs are cryptographically signed on the blockchain</li>
                        <li>Zero-knowledge proofs available for enhanced privacy</li>
                        <li>Tamper-proof verification through smart contracts</li>
                        <li>Time-limited validity with automatic expiration</li>
                    </ul>
                </div>
                <div className="pt-2 border-t border-gray-100 mt-3">
                    <p className="text-sm text-gray-600">
                        All proof of funds are digitally signed and can be verified through our secure verification page.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default UnderstandingPOF; 