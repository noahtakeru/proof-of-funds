import { useState, useEffect } from 'react';
import { useContractRead } from 'wagmi';
import { ethers } from 'ethers';
import { ZK_VERIFIER_ADDRESS, PROOF_TYPES, ZK_PROOF_TYPES } from '../config/constants';

// Smart contract address on Polygon Amoy testnet
const CONTRACT_ADDRESS = '0xD6bd1eFCE3A2c4737856724f96F39037a3564890';
const ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "_user", "type": "address" },
            { "internalType": "uint256", "name": "_amount", "type": "uint256" }
        ],
        "name": "verifyProof",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "_user", "type": "address" },
            { "internalType": "uint256", "name": "_amount", "type": "uint256" }
        ],
        "name": "verifyThresholdProof",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "_user", "type": "address" },
            { "internalType": "uint256", "name": "_amount", "type": "uint256" }
        ],
        "name": "verifyMaximumProof",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    }
];

export default function VerifyPage() {
    // Add a flag to track user-initiated connection, initialized from localStorage
    const [userInitiatedConnection, setUserInitiatedConnection] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('userInitiatedConnection') === 'true';
        }
        return false;
    });

    const [proofCategory, setProofCategory] = useState('standard'); // 'standard' or 'zk'
    const [proofType, setProofType] = useState('standard'); // 'standard', 'threshold', 'maximum'
    const [zkProofType, setZkProofType] = useState('standard'); // 'standard', 'threshold', 'maximum'
    const [walletAddress, setWalletAddress] = useState('');
    const [amount, setAmount] = useState('');
    const [verificationStatus, setVerificationStatus] = useState(null); // null, true, false

    // Update userInitiatedConnection if it changes in localStorage
    useEffect(() => {
        const handleStorageChange = () => {
            setUserInitiatedConnection(localStorage.getItem('userInitiatedConnection') === 'true');
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('storage', handleStorageChange);
            return () => window.removeEventListener('storage', handleStorageChange);
        }
    }, []);

    // Read contract for standard proof verification
    const { data: standardProofResult, isLoading: isLoadingStandard, refetch: refetchStandard } = useContractRead({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'verifyProof',
        args: [walletAddress || '0x0000000000000000000000000000000000000000', ethers.utils.parseEther(amount || '0')],
        enabled: false, // Only run when explicitly initiated by verification
    });

    // Read contract for threshold proof verification
    const { data: thresholdProofResult, isLoading: isLoadingThreshold, refetch: refetchThreshold } = useContractRead({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'verifyThresholdProof',
        args: [walletAddress || '0x0000000000000000000000000000000000000000', ethers.utils.parseEther(amount || '0')],
        enabled: false,
    });

    // Read contract for maximum proof verification
    const { data: maximumProofResult, isLoading: isLoadingMaximum, refetch: refetchMaximum } = useContractRead({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'verifyMaximumProof',
        args: [walletAddress || '0x0000000000000000000000000000000000000000', ethers.utils.parseEther(amount || '0')],
        enabled: false,
    });

    // Read contract for ZK proof verification
    const { data: zkProofResult, isLoading: isLoadingZK, refetch: refetchZK } = useContractRead({
        address: ZK_VERIFIER_ADDRESS,
        abi: [
            {
                "inputs": [
                    { "internalType": "address", "name": "_user", "type": "address" }
                ],
                "name": "verifyZKProof",
                "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
                "stateMutability": "view",
                "type": "function"
            }
        ],
        functionName: 'verifyZKProof',
        args: [walletAddress || '0x0000000000000000000000000000000000000000'],
        enabled: false,
    });

    const handleVerify = async (e) => {
        e.preventDefault();
        if (!walletAddress || !amount) return;

        setVerificationStatus(null);

        try {
            if (proofCategory === 'standard') {
                // Verify standard proofs
                if (proofType === 'standard') {
                    await refetchStandard();
                    setVerificationStatus(standardProofResult);
                } else if (proofType === 'threshold') {
                    await refetchThreshold();
                    setVerificationStatus(thresholdProofResult);
                } else if (proofType === 'maximum') {
                    await refetchMaximum();
                    setVerificationStatus(maximumProofResult);
                }
            } else if (proofCategory === 'zk') {
                // Verify ZK proofs
                await refetchZK();
                setVerificationStatus(zkProofResult);
            }
        } catch (error) {
            console.error('Error verifying proof:', error);
            setVerificationStatus(false);
        }
    };

    const isVerifying = isLoadingStandard || isLoadingThreshold || isLoadingMaximum || isLoadingZK;
    const isLoading = isVerifying;

    return (
        <div className="max-w-3xl mx-auto mt-8">
            <h1 className="text-3xl font-bold text-center mb-8">Verify Proof of Funds</h1>

            <div className="bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-6">Proof Verification</h2>

                <div>
                    <label htmlFor="proof-category" className="block text-sm font-medium text-gray-700 mb-1">
                        Proof Category
                    </label>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <button
                            type="button"
                            onClick={() => {
                                setProofCategory('standard');
                                setVerificationStatus(null);
                            }}
                            className={`py-2 px-4 text-sm font-medium rounded-md border ${proofCategory === 'standard'
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            Standard Proofs
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setProofCategory('zk');
                                setVerificationStatus(null);
                            }}
                            className={`py-2 px-4 text-sm font-medium rounded-md border ${proofCategory === 'zk'
                                ? 'bg-zk-accent text-white border-zk-accent'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            Zero-Knowledge Proofs
                        </button>
                    </div>
                </div>

                <form onSubmit={handleVerify}>
                    <div className="space-y-6">
                        <p className="text-sm text-gray-500">
                            {proofCategory === 'standard'
                                ? 'Standard proofs verify funds while revealing the exact amount.'
                                : 'Zero-knowledge proofs verify funds without revealing sensitive information.'}
                        </p>

                        {proofCategory === 'standard' ? (
                            <div>
                                <label htmlFor="proof-type" className="block text-sm font-medium text-gray-700 mb-1">
                                    Proof Type
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProofType('standard');
                                            setVerificationStatus(null);
                                        }}
                                        className={`py-2 px-4 text-sm font-medium rounded-md border ${proofType === 'standard'
                                            ? 'bg-primary-600 text-white border-primary-600'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        Standard
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProofType('threshold');
                                            setVerificationStatus(null);
                                        }}
                                        className={`py-2 px-4 text-sm font-medium rounded-md border ${proofType === 'threshold'
                                            ? 'bg-primary-600 text-white border-primary-600'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        Threshold
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProofType('maximum');
                                            setVerificationStatus(null);
                                        }}
                                        className={`py-2 px-4 text-sm font-medium rounded-md border ${proofType === 'maximum'
                                            ? 'bg-primary-600 text-white border-primary-600'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        Maximum
                                    </button>
                                </div>
                                <p className="mt-2 text-sm text-gray-500">
                                    {proofType === 'standard' && 'Verify that the wallet has exactly this amount'}
                                    {proofType === 'threshold' && 'Verify that the wallet has at least this amount'}
                                    {proofType === 'maximum' && 'Verify that the wallet has less than this amount'}
                                </p>
                            </div>
                        ) : (
                            <div>
                                <label htmlFor="zk-proof-type" className="block text-sm font-medium text-gray-700 mb-1">
                                    Zero-Knowledge Proof Type
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setZkProofType('standard');
                                            setVerificationStatus(null);
                                        }}
                                        className={`py-2 px-4 text-sm font-medium rounded-md border ${zkProofType === 'standard'
                                            ? 'bg-zk-accent text-white border-zk-accent'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        ZK Standard
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setZkProofType('threshold');
                                            setVerificationStatus(null);
                                        }}
                                        className={`py-2 px-4 text-sm font-medium rounded-md border ${zkProofType === 'threshold'
                                            ? 'bg-zk-accent text-white border-zk-accent'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        ZK Threshold
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setZkProofType('maximum');
                                            setVerificationStatus(null);
                                        }}
                                        className={`py-2 px-4 text-sm font-medium rounded-md border ${zkProofType === 'maximum'
                                            ? 'bg-zk-accent text-white border-zk-accent'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        ZK Maximum
                                    </button>
                                </div>
                                <p className="mt-2 text-sm text-gray-500">
                                    {zkProofType === 'standard' && 'Verify a private proof of exactly this amount'}
                                    {zkProofType === 'threshold' && 'Verify a private proof of at least this amount'}
                                    {zkProofType === 'maximum' && 'Verify a private proof of less than this amount'}
                                </p>
                            </div>
                        )}

                        <div>
                            <label htmlFor="wallet-address" className="block text-sm font-medium text-gray-700 mb-1">
                                Wallet Address
                            </label>
                            <input
                                type="text"
                                id="wallet-address"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
                                placeholder="0x..."
                                value={walletAddress}
                                onChange={(e) => setWalletAddress(e.target.value)}
                            />
                        </div>

                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                                Amount (MATIC)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    id="amount"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
                                    placeholder="Enter amount"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    min="0"
                                    step="0.001"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                    <span className="text-gray-500 sm:text-sm">MATIC</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isVerifying || !walletAddress || !amount}
                                className={`px-4 py-2 rounded-md ${isVerifying || !walletAddress || !amount
                                    ? 'bg-gray-400 cursor-not-allowed text-white'
                                    : proofCategory === 'standard'
                                        ? 'bg-primary-600 hover:bg-primary-700 text-white'
                                        : 'bg-zk-accent hover:bg-zk-accent-dark text-white'
                                    }`}
                            >
                                {isVerifying ? 'Verifying...' : 'Verify Proof'}
                            </button>
                        </div>

                        {verificationStatus !== null && (
                            <div className={`p-4 rounded-md ${verificationStatus ? 'bg-green-50' : 'bg-red-50'}`}>
                                <p className={`text-sm font-medium ${verificationStatus ? 'text-green-800' : 'text-red-800'}`}>
                                    {verificationStatus
                                        ? `The wallet ${walletAddress} has a valid ${proofCategory === 'standard' ? proofType : 'ZK ' + zkProofType} proof for ${amount} MATIC.`
                                        : `No valid ${proofCategory === 'standard' ? proofType : 'ZK ' + zkProofType} proof found for ${walletAddress} with amount ${amount} MATIC.`}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Information Section - Moved to bottom to match create.js */}
                    <div className="mt-12 border-t pt-6">
                        <h2 className="text-xl font-semibold mb-4">About Proof Verification</h2>
                        <p className="text-gray-600 mb-4">
                            This tool allows you to verify if a wallet address has a valid proof of funds on the Polygon blockchain
                            without revealing their private information.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="bg-primary-50 p-4 rounded-lg">
                                <h3 className="font-medium text-primary-700 mb-2">Standard Proof</h3>
                                <p className="text-sm text-gray-600">Verifies that a wallet has exactly the specified amount. Used for specific commitments or agreements.</p>
                            </div>
                            <div className="bg-primary-50 p-4 rounded-lg">
                                <h3 className="font-medium text-primary-700 mb-2">Threshold Proof</h3>
                                <p className="text-sm text-gray-600">Verifies that a wallet has at least the specified amount. Ideal for qualification requirements.</p>
                            </div>
                            <div className="bg-primary-50 p-4 rounded-lg">
                                <h3 className="font-medium text-primary-700 mb-2">Maximum Proof</h3>
                                <p className="text-sm text-gray-600">Verifies that a wallet has less than the specified amount. Useful for certain compliance requirements.</p>
                            </div>
                            <div className="bg-zk-light p-4 rounded-lg">
                                <h3 className="font-medium text-zk mb-2">Zero-Knowledge Proofs</h3>
                                <p className="text-sm text-gray-600">
                                    Verify proofs without revealing the actual amounts. Perfect for private verification.
                                </p>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
} 