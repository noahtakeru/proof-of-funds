/**
 * Proof Verification Page
 * 
 * This page allows users to verify proof of funds created on the Arbitr platform.
 * It interacts with smart contracts on the Polygon blockchain to validate various
 * types of fund verification proofs.
 * 
 * Key features:
 * - Support for multiple verification types:
 *   - Standard proofs (exact amount verification)
 *   - Threshold proofs (minimum amount verification)
 *   - Maximum proofs (maximum amount verification)
 *   - Zero-knowledge proofs (private verification)
 * - Blockchain-based verification through smart contract calls
 * - User-friendly verification UI with status indicators
 * - Detailed verification results display
 * 
 * The page uses wagmi hooks for contract interaction, enabling direct verification
 * against the deployed Arbitr proof of funds contracts on Polygon network.
 */

import { useState, useEffect } from 'react';
import { useContractRead } from 'wagmi';
import { ethers } from 'ethers';
import { ZK_VERIFIER_ADDRESS, PROOF_TYPES, ZK_PROOF_TYPES, CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/constants';

// Smart contract address on Polygon Amoy testnet
// const CONTRACT_ADDRESS = '0xD6bd1eFCE3A2c4737856724f96F39037a3564890';

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
    const [verificationMode, setVerificationMode] = useState('wallet'); // 'wallet' or 'transaction'
    const [walletAddress, setWalletAddress] = useState('');
    const [transactionHash, setTransactionHash] = useState('');
    const [amount, setAmount] = useState('');
    const [coinType, setCoinType] = useState('ETH'); // New state for coin type
    const [verificationStatus, setVerificationStatus] = useState(null); // null, true, false
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

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
        abi: CONTRACT_ABI,
        functionName: 'verifyStandardProof',
        args: [walletAddress || '0x0000000000000000000000000000000000000000', ethers.utils.parseEther(amount || '0')],
        enabled: false, // Only run when explicitly initiated by verification
    });

    // Read contract for threshold proof verification
    const { data: thresholdProofResult, isLoading: isLoadingThreshold, refetch: refetchThreshold } = useContractRead({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'verifyThresholdProof',
        args: [walletAddress || '0x0000000000000000000000000000000000000000', ethers.utils.parseEther(amount || '0')],
        enabled: false,
    });

    // Read contract for maximum proof verification
    const { data: maximumProofResult, isLoading: isLoadingMaximum, refetch: refetchMaximum } = useContractRead({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
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

    // Function to extract proof data from transaction hash
    const getProofFromTransaction = async (txHash) => {
        try {
            setIsLoading(true);
            setError(null);

            // Create provider based on network
            let provider;
            if (typeof window !== 'undefined' && window.ethereum) {
                const chainId = await window.ethereum.request({ method: 'eth_chainId' });
                if (chainId === '0x7a69' || chainId === '0x539') { // Hardhat (31337) or localhost (1337)
                    provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
                } else {
                    provider = new ethers.providers.Web3Provider(window.ethereum);
                }
            } else {
                // Fallback to Hardhat local network
                provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
            }

            // Get transaction receipt
            const receipt = await provider.getTransactionReceipt(txHash);

            if (!receipt) {
                throw new Error('Transaction not found');
            }

            if (receipt.status !== 1) {
                throw new Error('Transaction failed');
            }

            // Initialize contract interface to parse logs
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

            // Find the ProofSubmitted event in the logs
            const proofSubmittedEvent = receipt.logs
                .filter(log => log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase())
                .map(log => {
                    try {
                        return contract.interface.parseLog(log);
                    } catch (e) {
                        return null;
                    }
                })
                .filter(parsedLog => parsedLog && parsedLog.name === 'ProofSubmitted')
                .shift();

            if (!proofSubmittedEvent) {
                throw new Error('No proof submission found in this transaction');
            }

            // Extract user address and proof type from the event
            const userAddress = proofSubmittedEvent.args.user;
            const proofTypeValue = proofSubmittedEvent.args.proofType;

            // Get the actual proof data from the contract
            const proofData = await contract.getProof(userAddress);

            return {
                user: userAddress,
                proofType: proofTypeValue,
                proofHash: proofSubmittedEvent.args.proofHash,
                thresholdAmount: proofData.thresholdAmount
            };

        } catch (err) {
            console.error('Error getting proof from transaction:', err);
            setError(err.message || 'Failed to get proof from transaction');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        setError(null);
        setVerificationStatus(null);

        try {
            if (verificationMode === 'wallet') {
                // Traditional wallet-based verification
                if (!walletAddress || !amount || !coinType) return;

                if (proofCategory === 'standard') {
                    // Verify standard proofs
                    if (proofType === 'standard') {
                        await refetchStandard();
                        // Wait for the result to be available
                        setTimeout(() => {
                            setVerificationStatus(standardProofResult);
                        }, 500);
                    } else if (proofType === 'threshold') {
                        await refetchThreshold();
                        // Wait for the result to be available
                        setTimeout(() => {
                            setVerificationStatus(thresholdProofResult);
                        }, 500);
                    } else if (proofType === 'maximum') {
                        await refetchMaximum();
                        // Wait for the result to be available
                        setTimeout(() => {
                            setVerificationStatus(maximumProofResult);
                        }, 500);
                    }
                } else if (proofCategory === 'zk') {
                    // Verify ZK proofs
                    await refetchZK();
                    // Wait for the result to be available
                    setTimeout(() => {
                        setVerificationStatus(zkProofResult);
                    }, 500);
                }
            } else {
                // Transaction-based verification
                if (!transactionHash || !amount || !coinType) return;

                setIsLoading(true);

                // Get proof data from transaction
                const proofData = await getProofFromTransaction(transactionHash);

                if (!proofData) {
                    setVerificationStatus(false);
                    return;
                }

                // Determine the proof type from the proof data
                let proofTypeEnum;
                let proofTypeStr;

                if (proofData.proofType === 0) {
                    proofTypeEnum = PROOF_TYPES.STANDARD;
                    proofTypeStr = 'standard';
                    setProofType('standard');
                } else if (proofData.proofType === 1) {
                    proofTypeEnum = PROOF_TYPES.THRESHOLD;
                    proofTypeStr = 'threshold';
                    setProofType('threshold');
                } else if (proofData.proofType === 2) {
                    proofTypeEnum = PROOF_TYPES.MAXIMUM;
                    proofTypeStr = 'maximum';
                    setProofType('maximum');
                }

                // Set the wallet address from the proof data
                setWalletAddress(proofData.user);

                // Now perform the appropriate verification based on proof type
                let verified = false;

                if (proofTypeStr === 'standard') {
                    await refetchStandard();
                    verified = standardProofResult;
                } else if (proofTypeStr === 'threshold') {
                    await refetchThreshold();
                    verified = thresholdProofResult;
                } else if (proofTypeStr === 'maximum') {
                    await refetchMaximum();
                    verified = maximumProofResult;
                }

                setVerificationStatus(verified);
                setIsLoading(false);
            }
        } catch (error) {
            console.error('Error verifying proof:', error);
            setError(error.message || 'Failed to verify proof');
            setVerificationStatus(false);
            setIsLoading(false);
        }
    };

    const isVerifying = isLoadingStandard || isLoadingThreshold || isLoadingMaximum || isLoadingZK || isLoading;

    return (
        <div className="max-w-3xl mx-auto mt-8">
            <h1 className="text-3xl font-bold text-center mb-8">Verify Proof of Funds</h1>

            <div className="bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-6">Proof Verification</h2>

                {/* Verification Mode Selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Verification Method
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setVerificationMode('wallet');
                                setVerificationStatus(null);
                                setError(null);
                            }}
                            className={`py-2 px-4 text-sm font-medium rounded-md border ${verificationMode === 'wallet'
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            Verify by Wallet Address
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setVerificationMode('transaction');
                                setVerificationStatus(null);
                                setError(null);
                            }}
                            className={`py-2 px-4 text-sm font-medium rounded-md border ${verificationMode === 'transaction'
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            Verify by Transaction Hash
                        </button>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                        {verificationMode === 'wallet'
                            ? 'Verify a proof using the wallet address that created it.'
                            : 'Verify a proof using the transaction hash from when it was created.'}
                    </p>
                </div>

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

                        {verificationMode === 'wallet' && proofCategory === 'standard' && (
                            <div>
                                <label htmlFor="proof-type" className="block text-sm font-medium text-gray-700 mb-1">
                                    Proof Type
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProofType('standard');
                                            setVerificationStatus(null);
                                        }}
                                        className={`p-4 border rounded-md flex flex-col items-center justify-between text-left transition-colors ${proofType === 'standard'
                                            ? 'bg-primary-50 border-primary-500 ring-2 ring-primary-500'
                                            : 'border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-100 text-primary-600 mb-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <h3 className="font-medium">Standard</h3>
                                        <p className="text-sm text-gray-500">Exact amount</p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProofType('threshold');
                                            setVerificationStatus(null);
                                        }}
                                        className={`p-4 border rounded-md flex flex-col items-center justify-between text-left transition-colors ${proofType === 'threshold'
                                            ? 'bg-primary-50 border-primary-500 ring-2 ring-primary-500'
                                            : 'border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-100 text-primary-600 mb-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                            </svg>
                                        </div>
                                        <h3 className="font-medium">Threshold</h3>
                                        <p className="text-sm text-gray-500">At least this amount</p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProofType('maximum');
                                            setVerificationStatus(null);
                                        }}
                                        className={`p-4 border rounded-md flex flex-col items-center justify-between text-left transition-colors ${proofType === 'maximum'
                                            ? 'bg-primary-50 border-primary-500 ring-2 ring-primary-500'
                                            : 'border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-100 text-primary-600 mb-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                            </svg>
                                        </div>
                                        <h3 className="font-medium">Maximum</h3>
                                        <p className="text-sm text-gray-500">At most this amount</p>
                                    </button>
                                </div>

                                <div className="mb-6 p-3 bg-gray-50 rounded-md border border-gray-200 text-sm text-gray-600">
                                    {proofType === 'standard' && (
                                        <p>
                                            <strong>Standard Verification:</strong> This verifies that the wallet contains exactly the specified amount.
                                        </p>
                                    )}
                                    {proofType === 'threshold' && (
                                        <p>
                                            <strong>Threshold Verification:</strong> This verifies that the wallet contains at least the specified amount.
                                        </p>
                                    )}
                                    {proofType === 'maximum' && (
                                        <p>
                                            <strong>Maximum Verification:</strong> This verifies that the wallet contains no more than the specified amount.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {verificationMode === 'wallet' && proofCategory === 'zk' && (
                            <div>
                                <label htmlFor="proof-type" className="block text-sm font-medium text-gray-700 mb-1">
                                    Zero-Knowledge Proof Type
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setZkProofType('standard');
                                            setVerificationStatus(null);
                                        }}
                                        className={`p-4 border rounded-md flex flex-col items-center justify-between text-left transition-colors ${zkProofType === 'standard'
                                            ? 'bg-zk-light border-zk-accent ring-2 ring-zk-accent'
                                            : 'border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-zk-light text-zk-accent mb-3">
                                            <span className="font-bold">ZK</span>
                                        </div>
                                        <h3 className="font-medium">ZK Standard</h3>
                                        <p className="text-sm text-gray-500">Private exact amount</p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setZkProofType('threshold');
                                            setVerificationStatus(null);
                                        }}
                                        className={`p-4 border rounded-md flex flex-col items-center justify-between text-left transition-colors ${zkProofType === 'threshold'
                                            ? 'bg-zk-light border-zk-accent ring-2 ring-zk-accent'
                                            : 'border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-zk-light text-zk-accent mb-3">
                                            <span className="font-bold">ZK</span>
                                        </div>
                                        <h3 className="font-medium">ZK Threshold</h3>
                                        <p className="text-sm text-gray-500">Private minimum amount</p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setZkProofType('maximum');
                                            setVerificationStatus(null);
                                        }}
                                        className={`p-4 border rounded-md flex flex-col items-center justify-between text-left transition-colors ${zkProofType === 'maximum'
                                            ? 'bg-zk-light border-zk-accent ring-2 ring-zk-accent'
                                            : 'border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-zk-light text-zk-accent mb-3">
                                            <span className="font-bold">ZK</span>
                                        </div>
                                        <h3 className="font-medium">ZK Maximum</h3>
                                        <p className="text-sm text-gray-500">Private maximum amount</p>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Input fields based on verification mode */}
                        {verificationMode === 'wallet' ? (
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
                        ) : (
                            <div>
                                <label htmlFor="transaction-hash" className="block text-sm font-medium text-gray-700 mb-1">
                                    Transaction Hash
                                </label>
                                <input
                                    type="text"
                                    id="transaction-hash"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
                                    placeholder="0x..."
                                    value={transactionHash}
                                    onChange={(e) => setTransactionHash(e.target.value)}
                                />
                                <p className="mt-1 text-sm text-gray-500">
                                    Enter the transaction hash from when the proof was created
                                </p>
                            </div>
                        )}

                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                                Amount
                            </label>
                            <div className="flex rounded-md">
                                <input
                                    type="number"
                                    id="amount"
                                    className="block w-full rounded-l-md border-r-0 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
                                    placeholder="Enter amount"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    min="0"
                                    step="0.001"
                                />
                                <input
                                    type="text"
                                    id="coin-type"
                                    className="block w-24 rounded-r-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border text-center"
                                    placeholder="ETH"
                                    value={coinType}
                                    onChange={(e) => setCoinType(e.target.value.toUpperCase())}
                                />
                            </div>
                            <p className="mt-1 text-sm text-gray-500">Enter coin ticker like ETH, MATIC, BTC, etc.</p>
                        </div>

                        {error && (
                            <div className="p-2 bg-red-50 rounded-md text-sm text-red-800">
                                Error: {error}
                            </div>
                        )}

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isVerifying ||
                                    (verificationMode === 'wallet' && (!walletAddress || !amount || !coinType)) ||
                                    (verificationMode === 'transaction' && (!transactionHash || !amount || !coinType))}
                                className={`px-4 py-2 rounded-md ${isVerifying ||
                                    (verificationMode === 'wallet' && (!walletAddress || !amount || !coinType)) ||
                                    (verificationMode === 'transaction' && (!transactionHash || !amount || !coinType))
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
                                        ? verificationMode === 'wallet'
                                            ? `The wallet ${walletAddress} has a valid ${proofCategory === 'standard' ? proofType : 'ZK ' + zkProofType} proof for ${amount} ${coinType}.`
                                            : `The transaction ${transactionHash.substring(0, 10)}...${transactionHash.substring(transactionHash.length - 8)} contains a valid proof for ${amount} ${coinType}.`
                                        : verificationMode === 'wallet'
                                            ? `No valid ${proofCategory === 'standard' ? proofType : 'ZK ' + zkProofType} proof found for ${walletAddress} with amount ${amount} ${coinType}.`
                                            : `No valid proof found in transaction ${transactionHash.substring(0, 10)}...${transactionHash.substring(transactionHash.length - 8)} for ${amount} ${coinType}.`}
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