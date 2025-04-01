/**
 * Share Proof Dialog Component
 * 
 * Modal dialog for sharing proof reference ID and access key
 */

import React, { useState } from 'react';
import { formatReferenceId } from '../lib/zk/referenceId';

const ShareProofDialog = ({ proof, onClose }) => {
    const [copySuccess, setCopySuccess] = useState('');

    if (!proof) return null;

    // Format the proof information for sharing
    const sharingText = `
Proof of Funds Verification
--------------------------
Reference ID: ${formatReferenceId(proof.referenceId)}
Access Key: ${proof.accessKey}
Expires: ${new Date(proof.expiresAt).toLocaleString()}

To verify this proof, visit: ${window.location.origin}/verify
`;

    // Copy text to clipboard
    const handleCopy = () => {
        navigator.clipboard.writeText(sharingText).then(
            () => {
                setCopySuccess('Copied!');
                setTimeout(() => setCopySuccess(''), 2000);
            },
            () => {
                setCopySuccess('Failed to copy');
            }
        );
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div className="relative mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
                <div className="mt-3">
                    <div className="flex justify-between items-center pb-3">
                        <h3 className="text-lg font-medium text-gray-900">Share Proof of Funds</h3>
                        <button
                            className="text-gray-400 hover:text-gray-500"
                            onClick={onClose}
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="mt-2">
                        <p className="text-sm text-gray-500 mb-4">
                            Share this information with the party that needs to verify your funds.
                            Keep the access key secure - it gives access to your proof details.
                        </p>

                        <div className="bg-gray-50 p-3 rounded-md">
                            <div className="mb-2">
                                <label className="block text-sm font-medium text-gray-700">Reference ID</label>
                                <div className="mt-1 flex rounded-md shadow-sm">
                                    <input
                                        type="text"
                                        readOnly
                                        value={formatReferenceId(proof.referenceId)}
                                        className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md sm:text-sm border-gray-300 bg-gray-100"
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700">Access Key</label>
                                <div className="mt-1 flex rounded-md shadow-sm">
                                    <input
                                        type="text"
                                        readOnly
                                        value={proof.accessKey}
                                        className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md sm:text-sm border-gray-300 bg-gray-100"
                                    />
                                </div>
                            </div>

                            <div className="mb-2">
                                <label className="block text-sm font-medium text-gray-700">Expires</label>
                                <div className="mt-1">
                                    <p className="text-sm text-gray-500">
                                        {new Date(proof.expiresAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700">Verification URL</label>
                                <div className="mt-1">
                                    <p className="text-sm text-indigo-600">
                                        {window.location.origin}/verify
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4">
                            <button
                                type="button"
                                className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                                onClick={handleCopy}
                            >
                                {copySuccess || 'Copy All Information'}
                            </button>
                        </div>

                        <div className="mt-2">
                            <button
                                type="button"
                                className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                                onClick={onClose}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareProofDialog;