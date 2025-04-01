/**
 * Verification Form Component
 * 
 * Displays a form for users to verify proofs using reference IDs
 */

import React, { useState } from 'react';
import { validateReferenceId, formatReferenceId } from '../lib/zk/referenceId';

const VerificationForm = ({ onVerify }) => {
    const [referenceId, setReferenceId] = useState('');
    const [accessKey, setAccessKey] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Format the reference ID as the user types
    const handleReferenceIdChange = (e) => {
        const input = e.target.value.replace(/-/g, '').substring(0, 8);
        setReferenceId(input);
        setError('');
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate reference ID
        if (!validateReferenceId(referenceId)) {
            setError('Please enter a valid 8-character reference ID');
            return;
        }

        // Validate access key
        if (!accessKey.trim()) {
            setError('Please enter the access key provided by the proof creator');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            // Call the verification function
            if (onVerify) {
                await onVerify(referenceId, accessKey);
            }
        } catch (error) {
            setError(error.message || 'Verification failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Format the reference ID for display
    const displayReferenceId = referenceId.length === 8
        ? formatReferenceId(referenceId)
        : referenceId;

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Verify Proof of Funds</h2>

            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
                    <p>{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="referenceId">
                        Reference ID
                    </label>
                    <input
                        id="referenceId"
                        type="text"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                        placeholder="XXXX-XXXX"
                        value={displayReferenceId}
                        onChange={handleReferenceIdChange}
                        maxLength={9} // 8 chars + 1 hyphen
                        required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Enter the 8-character reference ID provided by the proof creator
                    </p>
                </div>

                <div className="mb-6">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="accessKey">
                        Access Key
                    </label>
                    <input
                        id="accessKey"
                        type="password"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                        placeholder="Enter access key"
                        value={accessKey}
                        onChange={(e) => setAccessKey(e.target.value)}
                        required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Enter the access key provided separately by the proof creator
                    </p>
                </div>

                <div className="flex items-center justify-between">
                    <button
                        type="submit"
                        className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Verifying...' : 'Verify Proof'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default VerificationForm;