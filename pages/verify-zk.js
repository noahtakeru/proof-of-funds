import { useState } from 'react';
import Layout from '../components/Layout';
import VerificationForm from '../components/VerificationForm';
import VerificationResult from '../components/VerificationResult';
import { decryptProof } from '../lib/zk/proofEncryption';
import { verifyProofLocally } from '../lib/zk/zkProofVerifier';
import { validateReferenceId } from '../lib/zk/referenceId';

export default function VerifyZkPage() {
    const [verificationResult, setVerificationResult] = useState(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState('');

    const handleVerify = async (referenceId, accessKey) => {
        setIsVerifying(true);
        setError('');

        try {
            // Validate reference ID format
            if (!validateReferenceId(referenceId)) {
                throw new Error('Invalid reference ID format');
            }

            // Simulate fetching the encrypted proof from the database
            // In a real implementation, this would be an API call
            const fetchedProof = await fetchEncryptedProof(referenceId);

            if (!fetchedProof) {
                throw new Error('Proof not found');
            }

            // Decrypt the proof using the provided access key
            const decryptedProof = decryptProof(fetchedProof.encryptedData, accessKey);

            if (!decryptedProof) {
                throw new Error('Invalid access key or corrupted proof data');
            }

            // Verify the proof locally
            const isValid = verifyProofLocally(
                decryptedProof.proofData,
                decryptedProof.walletAddress,
                decryptedProof.proofType
            );

            // Set verification result with all necessary data
            setVerificationResult({
                isValid,
                isExpired: new Date(decryptedProof.expiresAt) < new Date(),
                isRevoked: fetchedProof.isRevoked,
                proofType: decryptedProof.proofType,
                createdAt: decryptedProof.createdAt,
                expiresAt: decryptedProof.expiresAt,
                walletAddress: decryptedProof.walletAddress,
                amount: decryptedProof.amount,
                threshold: decryptedProof.threshold
            });
        } catch (err) {
            console.error('Verification error:', err);
            setError(err.message || 'Failed to verify proof');
            setVerificationResult(null);
        } finally {
            setIsVerifying(false);
        }
    };

    // Mock function to simulate fetching a proof from the database
    const fetchEncryptedProof = async (referenceId) => {
        // This is just a simulation - in a real app, this would be an API call
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay

        // Sample data for demo purposes
        const mockProofs = {
            'ABCD1234': {
                encryptedData: JSON.stringify({
                    proofData: {
                        proof: { a: [1, 2], b: [[3, 4], [5, 6]], c: [7, 8] },
                        publicSignals: ['0x1234567890abcdef1234567890abcdef12345678']
                    },
                    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
                    proofType: 'balance',
                    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    amount: '1000',
                    threshold: '500'
                }),
                isRevoked: false,
                createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            },
            'EFGH5678': {
                encryptedData: JSON.stringify({
                    proofData: {
                        proof: { a: [8, 7], b: [[6, 5], [4, 3]], c: [2, 1] },
                        publicSignals: ['0xabcdef1234567890abcdef1234567890abcdef12']
                    },
                    walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
                    proofType: 'threshold',
                    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
                    expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Expired
                    amount: '5000',
                    threshold: '1000'
                }),
                isRevoked: true,
                createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
            }
        };

        const cleanRefId = referenceId.replace(/-/g, '').toUpperCase();
        return mockProofs[cleanRefId] || null;
    };

    return (
        <Layout title="Verify ZK Proof of Funds">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:px-6">
                        <h1 className="text-2xl font-bold text-gray-900">Verify Zero-Knowledge Proof</h1>
                        <p className="mt-1 max-w-2xl text-sm text-gray-500">
                            Enter the reference ID and access key to verify a zero-knowledge proof.
                        </p>
                    </div>

                    <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                        <VerificationForm onVerify={handleVerify} isVerifying={isVerifying} />

                        {error && (
                            <div className="mt-4 p-4 bg-red-50 rounded-md">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-red-700">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {verificationResult && (
                            <div className="mt-6">
                                <h2 className="text-lg font-medium text-gray-900">Verification Result</h2>
                                <div className="mt-2">
                                    <VerificationResult result={verificationResult} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sample Reference IDs for Testing */}
                    <div className="bg-gray-50 px-4 py-5 sm:p-6">
                        <h3 className="text-lg font-medium text-gray-900">Sample Reference IDs for Testing</h3>
                        <div className="mt-2 grid grid-cols-1 gap-5 sm:grid-cols-2">
                            <div className="bg-white overflow-hidden shadow rounded-lg">
                                <div className="px-4 py-5 sm:p-6">
                                    <h3 className="text-lg font-medium text-gray-900">Valid Proof</h3>
                                    <dl className="mt-2">
                                        <div className="sm:grid sm:grid-cols-3 sm:gap-4">
                                            <dt className="text-sm font-medium text-gray-500">Reference ID</dt>
                                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">ABCD-1234</dd>
                                        </div>
                                        <div className="mt-2 sm:grid sm:grid-cols-3 sm:gap-4">
                                            <dt className="text-sm font-medium text-gray-500">Access Key</dt>
                                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">testkey123</dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>

                            <div className="bg-white overflow-hidden shadow rounded-lg">
                                <div className="px-4 py-5 sm:p-6">
                                    <h3 className="text-lg font-medium text-gray-900">Expired & Revoked Proof</h3>
                                    <dl className="mt-2">
                                        <div className="sm:grid sm:grid-cols-3 sm:gap-4">
                                            <dt className="text-sm font-medium text-gray-500">Reference ID</dt>
                                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">EFGH-5678</dd>
                                        </div>
                                        <div className="mt-2 sm:grid sm:grid-cols-3 sm:gap-4">
                                            <dt className="text-sm font-medium text-gray-500">Access Key</dt>
                                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">expiredkey</dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
} 