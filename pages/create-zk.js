import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import ShareProofDialog from '../components/ShareProofDialog';
import { generateAccessKey, encryptProof, hashAccessKey } from '../lib/zk/proofEncryption';
import { formatReferenceId, generateReferenceId } from '../lib/zk/referenceId';

// Mock wallet connection - in a real app, use ethers.js or a wallet provider
const mockConnectWallet = async () => {
    // Simulate wallet connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        balance: '10.5',
        chainId: 1
    };
};

// Mock function to generate ZK proof - in a real app, use a ZK library
const mockGenerateProof = async (walletAddress, proofType, amount, threshold) => {
    // Simulate proof generation
    await new Promise(resolve => setTimeout(resolve, 2000));

    return {
        proof: { a: [1, 2], b: [[3, 4], [5, 6]], c: [7, 8] },
        publicSignals: [walletAddress]
    };
};

export default function CreateZkPage() {
    const router = useRouter();
    const [wallet, setWallet] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [proofType, setProofType] = useState('balance');
    const [amount, setAmount] = useState('');
    const [threshold, setThreshold] = useState('');
    const [expirationDays, setExpirationDays] = useState(30);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [createdProof, setCreatedProof] = useState(null);
    const [showShareDialog, setShowShareDialog] = useState(false);

    const connectWallet = async () => {
        setIsConnecting(true);
        setError('');

        try {
            const walletData = await mockConnectWallet();
            setWallet(walletData);
        } catch (err) {
            console.error('Wallet connection error:', err);
            setError('Failed to connect wallet: ' + (err.message || 'Unknown error'));
        } finally {
            setIsConnecting(false);
        }
    };

    const handleCreateProof = async (e) => {
        e.preventDefault();

        if (!wallet) {
            setError('Please connect your wallet first');
            return;
        }

        if (proofType === 'threshold' && (!threshold || isNaN(parseFloat(threshold)))) {
            setError('Please enter a valid threshold amount');
            return;
        }

        if (!amount || isNaN(parseFloat(amount))) {
            setError('Please enter a valid amount');
            return;
        }

        setIsGenerating(true);
        setError('');

        try {
            // Generate the ZK proof
            const zkProof = await mockGenerateProof(
                wallet.address,
                proofType,
                amount,
                threshold
            );

            // Generate access key for the proof
            const accessKey = generateAccessKey();

            // Generate a unique reference ID
            const referenceId = generateReferenceId(wallet.address, proofType);

            // Calculate expiration date
            const createdAt = new Date();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + parseInt(expirationDays));

            // Create the proof payload
            const proofData = {
                proofData: zkProof,
                walletAddress: wallet.address,
                proofType,
                createdAt: createdAt.toISOString(),
                expiresAt: expiresAt.toISOString(),
                amount,
                threshold: proofType === 'threshold' ? threshold : null
            };

            // Encrypt the proof
            const encryptedData = encryptProof(proofData, accessKey);

            // Hash the access key for storage
            const accessKeyHash = hashAccessKey(accessKey);

            // In a real app, save to database here
            console.log('Proof created:', {
                referenceId,
                accessKeyHash,
                encryptedData,
                isRevoked: false,
                createdAt: createdAt.toISOString(),
                expiresAt: expiresAt.toISOString()
            });

            // Set the created proof data for display
            setCreatedProof({
                referenceId,
                accessKey,
                expiresAt: expiresAt.toISOString()
            });

            // Show the share dialog
            setShowShareDialog(true);
        } catch (err) {
            console.error('Proof generation error:', err);
            setError('Failed to generate proof: ' + (err.message || 'Unknown error'));
        } finally {
            setIsGenerating(false);
        }
    };

    const closeShareDialog = () => {
        setShowShareDialog(false);
        // Clear form after sharing
        setAmount('');
        setThreshold('');
        setProofType('balance');
    };

    return (
        <Layout title="Create ZK Proof of Funds">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:px-6">
                        <h1 className="text-2xl font-bold text-gray-900">Create Zero-Knowledge Proof</h1>
                        <p className="mt-1 max-w-2xl text-sm text-gray-500">
                            Generate a zero-knowledge proof of your wallet balance without revealing your exact balance.
                        </p>
                    </div>

                    <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                        <div className="mb-6">
                            {wallet ? (
                                <div className="bg-green-50 border border-green-400 rounded p-4">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-sm font-medium text-green-800">
                                                Wallet connected: {wallet.address.substring(0, 6)}...{wallet.address.substring(wallet.address.length - 4)}
                                            </p>
                                            <p className="text-sm text-green-700 mt-1">
                                                Balance: {wallet.balance} ETH
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    onClick={connectWallet}
                                    disabled={isConnecting}
                                >
                                    {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleCreateProof}>
                            <div className="space-y-6">
                                <div>
                                    <label htmlFor="proofType" className="block text-sm font-medium text-gray-700">
                                        Proof Type
                                    </label>
                                    <select
                                        id="proofType"
                                        name="proofType"
                                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                        value={proofType}
                                        onChange={(e) => setProofType(e.target.value)}
                                    >
                                        <option value="balance">Standard Balance Proof</option>
                                        <option value="threshold">Threshold Proof</option>
                                        <option value="maximum">Maximum Amount Proof</option>
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                                        {proofType === 'threshold' ? 'Actual Balance' : 'Balance Amount'}
                                    </label>
                                    <div className="mt-1 relative rounded-md shadow-sm">
                                        <input
                                            type="text"
                                            name="amount"
                                            id="amount"
                                            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md"
                                            placeholder="0.00"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                        />
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                            <span className="text-gray-500 sm:text-sm">ETH</span>
                                        </div>
                                    </div>
                                </div>

                                {proofType === 'threshold' && (
                                    <div>
                                        <label htmlFor="threshold" className="block text-sm font-medium text-gray-700">
                                            Threshold Amount (Prove you have at least this much)
                                        </label>
                                        <div className="mt-1 relative rounded-md shadow-sm">
                                            <input
                                                type="text"
                                                name="threshold"
                                                id="threshold"
                                                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md"
                                                placeholder="0.00"
                                                value={threshold}
                                                onChange={(e) => setThreshold(e.target.value)}
                                            />
                                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                <span className="text-gray-500 sm:text-sm">ETH</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="expiration" className="block text-sm font-medium text-gray-700">
                                        Proof Expiration
                                    </label>
                                    <select
                                        id="expiration"
                                        name="expiration"
                                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                        value={expirationDays}
                                        onChange={(e) => setExpirationDays(e.target.value)}
                                    >
                                        <option value="1">1 day</option>
                                        <option value="7">7 days</option>
                                        <option value="30">30 days</option>
                                        <option value="90">90 days</option>
                                    </select>
                                </div>
                            </div>

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

                            <div className="mt-6">
                                <button
                                    type="submit"
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    disabled={!wallet || isGenerating}
                                >
                                    {isGenerating ? 'Generating Proof...' : 'Generate Proof'}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="bg-gray-50 px-4 py-5 sm:p-6">
                        <h3 className="text-lg font-medium text-gray-900">About Zero-Knowledge Proofs</h3>
                        <div className="mt-2 text-sm text-gray-500">
                            <p>
                                Zero-knowledge proofs allow you to prove you have funds without revealing your actual balance.
                                This provides privacy while still verifying your financial status.
                            </p>
                            <p className="mt-2">
                                The generated proof creates a reference ID and access key that you can share with others.
                                They can verify your proof without seeing your wallet address or exact balance.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {showShareDialog && createdProof && (
                <ShareProofDialog
                    referenceId={createdProof.referenceId}
                    accessKey={createdProof.accessKey}
                    expiresAt={createdProof.expiresAt}
                    onClose={closeShareDialog}
                />
            )}
        </Layout>
    );
} 