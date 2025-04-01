/**
 * Share Proof Dialog Component
 * 
 * A modal dialog that displays the reference ID and access key for a newly created
 * zero-knowledge proof and provides options to copy or share them.
 * 
 * @param {Object} props Component props
 * @param {string} props.referenceId The formatted reference ID of the proof
 * @param {string} props.accessKey The access key for decrypting the proof
 * @param {Function} props.onClose Function to call when the dialog is closed
 * @param {Function} props.onManage Function to call when the "Manage Proofs" button is clicked
 */

import { useState } from 'react';

export default function ShareProofDialog({ referenceId, accessKey, onClose, onManage }) {
    const [copied, setCopied] = useState(false);
    
    // Combines reference ID and access key into a shareable format
    const getShareText = () => {
        return `Reference ID: ${referenceId}\nAccess Key: ${accessKey}\n\nUse these to verify my proof of funds.`;
    };
    
    // Copies the share text to the clipboard
    const copyToClipboard = () => {
        navigator.clipboard.writeText(getShareText())
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
            });
    };
    
    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4">
                {/* Backdrop */}
                <div className="fixed inset-0 bg-black opacity-30" onClick={onClose}></div>
                
                {/* Dialog */}
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full z-50 p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">
                        Proof Created Successfully
                    </h2>
                    
                    <p className="text-gray-600 mb-4">
                        Your zero-knowledge proof has been created. Save the reference ID and access key
                        to share with others for verification.
                    </p>
                    
                    <div className="mb-4 space-y-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Reference ID</label>
                            <div className="flex mt-1">
                                <input
                                    type="text"
                                    readOnly
                                    value={referenceId}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Access Key</label>
                            <div className="flex mt-1">
                                <input
                                    type="text"
                                    readOnly
                                    value={accessKey}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-yellow-700">
                                    Save this information securely. Anyone with both the reference ID and
                                    access key can verify your proof.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                        <button
                            onClick={copyToClipboard}
                            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                        >
                            {copied ? '✓ Copied!' : 'Copy to Clipboard'}
                        </button>
                        
                        <div className="flex gap-3">
                            <button
                                onClick={onManage}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                            >
                                Manage Proofs
                            </button>
                            
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}