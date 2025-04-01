/**
 * Proof of Funds Verification Page
 * 
 * This page enables users to verify proofs of funds created on the Arbitr platform.
 * It supports multiple verification methods including transaction hash verification
 * and direct blockchain contract verification.
 * 
 * Key Features:
 * - Transaction hash verification that extracts proof data from the blockchain
 * - Support for multiple verification types: standard, threshold, maximum, and zero-knowledge proofs
 * - Direct smart contract verification for proof validation
 * - Status indicators for verification results
 * - Detailed verification result display
 * 
 * Technical Implementation:
 * - Uses RPC connections to the Polygon Amoy testnet to fetch transaction data
 * - Dynamically parses transaction logs to extract proof data
 * - Utilizes wagmi hooks for contract reading
 * - Implements error handling and fallback mechanisms for RPC connections
 * - Provides detailed debugging information for verification failures
 * 
 * Related Components:
 * - Smart contract: ProofOfFunds.sol - Contains the verification logic
 * - API: pages/api/verify-transaction.js - Server-side verification endpoint
 * 
 * Note: This component requires a working provider to connect to the blockchain.
 * For local development, it uses Alchemy's public Polygon Amoy RPC endpoint.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useContractRead } from 'wagmi';
import { ethers } from 'ethers';
import { ZK_VERIFIER_ADDRESS, PROOF_TYPES, ZK_PROOF_TYPES, CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/constants';
import Head from 'next/head';
import Layout from '../components/Layout';
import { decryptProof } from '../lib/zk/proofEncryption';
import { verifyProofLocally } from '../lib/zk/zkProofVerifier';

// Browser-friendly RPC URLs that support CORS
const RPC_OPTIONS = [
    "https://polygon-amoy.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161", // Public Infura endpoint
    "https://polygon-amoy-api.gateway.fm/v4/2ce4fdf25cca5a5b8c59756d98fe6b42", // Gateway.fm
    "https://rpc-amoy.polygon.technology", // Official Polygon endpoint
];

// Function to try multiple providers until one works
const getWorkingProvider = async () => {
    // First check if window.ethereum is available (MetaMask or similar)
    if (typeof window !== 'undefined' && window.ethereum) {
        try {
            // Use the injected provider
            console.log("Using injected Web3 provider");
            return new ethers.providers.Web3Provider(window.ethereum);
        } catch (e) {
            console.warn("Error using injected provider:", e);
        }
    }

    // Try each RPC URL until one works
    for (const rpcUrl of RPC_OPTIONS) {
        try {
            console.log(`Trying RPC URL: ${rpcUrl}`);
            const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
            // Do a quick test call
            await provider.getNetwork();
            console.log(`Success with provider: ${rpcUrl}`);
            return provider;
        } catch (e) {
            console.warn(`Failed to connect to ${rpcUrl}:`, e.message);
        }
    }

    throw new Error("Could not connect to any Polygon Amoy provider. Please install MetaMask or try again later.");
};

export default function VerifyPage() {
    const router = useRouter();
    const [userInitiatedConnection, setUserInitiatedConnection] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('userInitiatedConnection') === 'true';
        }
        return false;
    });

    const [proofCategory, setProofCategory] = useState('standard'); // 'standard' or 'zk'
    const [proofType, setProofType] = useState('standard'); // 'standard', 'threshold', 'maximum'
    const [zkProofType, setZkProofType] = useState('standard'); // 'standard', 'threshold', 'maximum'
    const [verificationMode, setVerificationMode] = useState('transaction'); // Only 'transaction' now
    const [walletAddress, setWalletAddress] = useState('');
    const [transactionHash, setTransactionHash] = useState('');
    const [amount, setAmount] = useState('');
    const [coinType, setCoinType] = useState('ETH'); // New state for coin type
    const [verificationStatus, setVerificationStatus] = useState(null); // null, true, false
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [proofDetails, setProofDetails] = useState(null); // To store proof details from transaction

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

            console.log("Getting proof from transaction:", txHash);
            console.log("Contract address:", CONTRACT_ADDRESS);

            // Try client-side verification first (using browser provider)
            try {
                // Try to get a working provider first
                const provider = await getWorkingProvider();
                console.log("Using ethers provider with:", provider.connection?.url || "Web3Provider");

                // Get transaction receipt using ethers
                const receipt = await provider.getTransactionReceipt(txHash);
                console.log("Transaction receipt:", receipt);

                if (!receipt) {
                    throw new Error('Transaction not found on the network. Make sure you\'re verifying a transaction from the correct network.');
                }

                // Continue with the existing verification logic...
                console.log("Transaction logs count:", receipt.logs?.length || 0);

                // Check transaction status
                if (receipt.status !== 1) {
                    throw new Error('Transaction failed on the blockchain');
                }

                // Get the full transaction data
                const txData = await provider.getTransaction(txHash);
                console.log("Transaction data:", txData);

                // Check if this transaction was sent to our contract
                if (txData && txData.to) {
                    if (txData.to.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
                        console.warn(`WARNING: Transaction was sent to ${txData.to}, but our contract address is ${CONTRACT_ADDRESS}`);
                    } else {
                        console.log("Transaction was sent to our contract address ✓");
                    }
                }

                // Initialize contract interface to parse logs
                const contractInterface = new ethers.utils.Interface(CONTRACT_ABI);

                // Create contract instance
                const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

                // First check if we have any logs matching our contract address
                const contractLogs = receipt.logs.filter(log =>
                    log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()
                );

                console.log(`Found ${contractLogs.length} logs for contract ${CONTRACT_ADDRESS}`);

                // Variable to store the actual contract address we end up using
                let actualContractAddress = CONTRACT_ADDRESS;
                let actualContract = contract;

                if (contractLogs.length === 0) {
                    console.log("Looking for logs in all addresses in this transaction...");
                    const uniqueAddresses = [...new Set(receipt.logs.map(log => log.address.toLowerCase()))];
                    console.log("Unique contract addresses in logs:", uniqueAddresses);

                    if (uniqueAddresses.length > 0) {
                        // The contract might be deployed at a different address
                        console.log("Possible contract address mismatch. Check if your contract is actually at:", uniqueAddresses[0]);

                        // Try with first contract address found in logs
                        const possibleContractLogs = receipt.logs.filter(log =>
                            log.address.toLowerCase() === uniqueAddresses[0].toLowerCase()
                        );

                        if (possibleContractLogs.length > 0) {
                            console.log(`Found ${possibleContractLogs.length} logs for possible contract ${uniqueAddresses[0]}`);
                            console.log("Attempting to parse logs with our ABI...");

                            try {
                                const testLog = contractInterface.parseLog(possibleContractLogs[0]);
                                console.log("Successfully parsed log from alternate contract address:", testLog);

                                // If we can parse it, use these logs instead
                                console.log("Using logs from alternate contract address");
                                actualContractAddress = uniqueAddresses[0];
                                actualContract = new ethers.Contract(actualContractAddress, CONTRACT_ABI, provider);
                                contractLogs.push(...possibleContractLogs);
                            } catch (e) {
                                console.log("Could not parse logs from alternate contract:", e.message);
                            }
                        }
                    }

                    if (contractLogs.length === 0) {
                        // Try to dump all events to see what's there
                        console.log("Trying to parse all logs regardless of contract address:");
                        receipt.logs.forEach((log, index) => {
                            try {
                                const parsedLog = contractInterface.parseLog(log);
                                console.log(`Log ${index} from ${log.address}:`, parsedLog.name);
                            } catch (e) {
                                console.log(`Log ${index} from ${log.address}: Could not parse`);
                            }
                        });

                        throw new Error('No logs found for the proof contract - the CONTRACT_ADDRESS may be incorrect');
                    }
                }

                // Parse logs...
                console.log("All events from our contract:");
                const parsedLogs = [];
                contractLogs.forEach((log, index) => {
                    try {
                        const parsedLog = contractInterface.parseLog(log);
                        console.log(`Event ${index}:`, parsedLog.name);
                        parsedLogs.push({
                            log,
                            parsedLog
                        });
                    } catch (e) {
                        console.log(`Event ${index}: Failed to parse`, e.message);
                    }
                });

                // Find proof event...
                const proofSubmittedLog = parsedLogs.find(entry =>
                    entry.parsedLog.name === 'ProofSubmitted' ||
                    entry.parsedLog.name.includes('Proof')
                );

                if (!proofSubmittedLog) {
                    console.log("No ProofSubmitted event found. Available events:",
                        parsedLogs.map(entry => entry.parsedLog.name));
                    throw new Error('No proof submission found in this transaction');
                }

                console.log("Found proof event:", proofSubmittedLog.parsedLog.name);

                // Extract data from the event
                const parsedLog = proofSubmittedLog.parsedLog;

                // Log all the event arguments to debug
                console.log("Event arguments:", Object.keys(parsedLog.args));
                for (const key in parsedLog.args) {
                    if (isNaN(parseInt(key))) { // Skip numeric keys, which are duplicates
                        const value = parsedLog.args[key];
                        // Convert BigNumber to string if needed
                        const displayValue = value && value._isBigNumber ? value.toString() : value;
                        console.log(`  ${key}: ${displayValue}`);
                    }
                }

                // Try to extract the important values
                const userAddress = parsedLog.args.user || parsedLog.args.wallet || parsedLog.args.owner;
                const proofTypeValue = parsedLog.args.proofType ?
                    (parsedLog.args.proofType._isBigNumber ?
                        parsedLog.args.proofType.toNumber() :
                        parsedLog.args.proofType) : 0;
                const proofHash = parsedLog.args.proofHash || parsedLog.args.hash;

                if (!userAddress) {
                    throw new Error('Could not find user address in event data');
                }

                console.log("Found proof data:", {
                    user: userAddress,
                    proofType: proofTypeValue,
                    proofHash: proofHash
                });

                // Parse the transaction input using ethers
                let amountFromTx = "0";
                let tokenSymbol = "ETH"; // Default to ETH

                if (txData && txData.data) {
                    try {
                        // Try to decode the function call
                        const decodedInput = contractInterface.parseTransaction({ data: txData.data });
                        console.log("Decoded function call:", decodedInput.name);
                        console.log("Function arguments:", decodedInput.args);

                        // Try to find threshold amount which is usually the verified amount
                        if (decodedInput.args && decodedInput.args.thresholdAmount) {
                            amountFromTx = ethers.utils.formatEther(decodedInput.args.thresholdAmount);
                        }
                        // Otherwise try other amount parameters
                        else if (decodedInput.args && decodedInput.args.amount) {
                            amountFromTx = ethers.utils.formatEther(decodedInput.args.amount);
                        }

                        // Get token symbol if available
                        if (decodedInput.args && decodedInput.args.tokenSymbol) {
                            tokenSymbol = decodedInput.args.tokenSymbol;
                        }
                    } catch (e) {
                        console.log("Could not decode transaction input:", e.message);
                    }
                }

                // Now get the proof data directly from the contract using ethers
                console.log(`Getting proof data for user ${userAddress} from contract at ${actualContractAddress}`);

                let proofData;
                try {
                    // Using the contract's getProof method directly
                    proofData = await actualContract.getProof(userAddress);
                    console.log("Proof data from contract:", proofData);
                } catch (e) {
                    console.error("Error getting proof data from contract:", e);
                    // Continue with event data only
                    proofData = {
                        thresholdAmount: ethers.BigNumber.from(0),
                        timestamp: null,
                        expiryTime: null
                    };
                }

                // Extract timestamp
                let timestamp = null;
                if (proofData.timestamp && proofData.timestamp._isBigNumber) {
                    timestamp = new Date(proofData.timestamp.toNumber() * 1000).toLocaleString();
                }

                // Extract expiry
                let expiryTime = null;
                if (proofData.expiryTime && proofData.expiryTime._isBigNumber) {
                    expiryTime = new Date(proofData.expiryTime.toNumber() * 1000).toLocaleString();
                }

                // Use threshold amount from contract data if available
                let thresholdAmount = "0";
                if (proofData.thresholdAmount && proofData.thresholdAmount._isBigNumber) {
                    thresholdAmount = ethers.utils.formatEther(proofData.thresholdAmount);
                }

                // Save all proof details
                const details = {
                    user: userAddress,
                    proofType: proofTypeValue,
                    proofHash: proofHash,
                    thresholdAmount: thresholdAmount !== "0" ? thresholdAmount : "0",
                    amount: amountFromTx !== "0" ? amountFromTx : thresholdAmount,
                    tokenSymbol: tokenSymbol,
                    timestamp: timestamp,
                    expiryTime: expiryTime,
                    txHash: txHash,
                    contractAddress: actualContractAddress
                };

                // Set amount and coin type automatically
                setAmount(details.thresholdAmount !== "0" ? details.thresholdAmount : details.amount);
                setCoinType(details.tokenSymbol);

                // Set proof details for display
                setProofDetails(details);

                return details;

            } catch (browserError) {
                // If client-side verification fails due to CORS or provider issues,
                // fall back to the server-side API
                console.warn("Browser-based verification failed:", browserError.message);
                console.log("Falling back to server-side API verification...");

                // Try the server-side API
                try {
                    const response = await fetch('/api/verify-transaction', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ txHash }),
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.error || 'Server verification failed');
                    }

                    console.log("Server-side verification successful:", data);

                    // Set form values from API response
                    setAmount(data.proofDetails.amount);
                    setCoinType(data.proofDetails.tokenSymbol);
                    setProofDetails(data.proofDetails);

                    return data.proofDetails;
                } catch (apiError) {
                    console.error("API verification also failed:", apiError);
                    throw new Error(`Verification failed: ${browserError.message}. Server fallback also failed: ${apiError.message}`);
                }
            }

        } catch (err) {
            console.error('Error getting proof from transaction:', err);
            setError(err.message || 'Failed to get proof from transaction');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // Add example transaction hashes that are known to work
    const EXAMPLE_TX_HASHES = [
        "0xff7fc1cf90fbab2222f2c6bd6f3046a7e057930ba17645ce6d1f863edc30b2d3", // Example from logs
    ];

    // Handle clicking on example transaction hash
    const useExampleHash = (hash) => {
        setTransactionHash(hash);
    };

    // Add more detailed validation feedback
    const getTransactionHashStatus = (hash) => {
        if (!hash) return null;

        // Check if it's a contract address (42 chars with 0x)
        if (hash.length === 42 && /^0x[0-9a-fA-F]{40}$/.test(hash)) {
            return {
                valid: false,
                message: "This looks like a contract address, not a transaction hash. Transaction hashes are 66 characters long."
            };
        }

        // Check if it's a valid transaction hash
        if (/^0x[0-9a-fA-F]{64}$/.test(hash)) {
            return {
                valid: true,
                message: "Valid transaction hash format"
            };
        }

        // Other invalid format
        return {
            valid: false,
            message: "Invalid transaction hash format. It should be 66 characters long (including 0x) and contain only hexadecimal characters."
        };
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        setError(null);
        setVerificationStatus(null);
        setProofDetails(null);

        try {
            // Only transaction-based verification now
            if (!transactionHash) {
                setError("Please enter a transaction hash");
                return;
            }

            // Validate transaction hash format
            const hashStatus = getTransactionHashStatus(transactionHash);
            if (!hashStatus.valid) {
                setError(hashStatus.message);
                return;
            }

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

            // Set the wallet address from the proof data for internal use
            setWalletAddress(proofData.user);

            // Note: We don't require the user to enter an amount anymore
            // We use the amount extracted from the transaction

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
        } catch (error) {
            console.error('Error verifying proof:', error);
            setError(error.message || 'Failed to verify proof');
            setVerificationStatus(false);
        } finally {
            setIsLoading(false);
        }
    };

    const isVerifying = isLoadingStandard || isLoadingThreshold || isLoadingMaximum || isLoadingZK || isLoading;

    return (
        <Layout title="Verify Proof of Funds">
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <header className="mb-8">
                    <div className="flex justify-between items-center">
                        <h1 className="text-3xl font-bold text-gray-800">Verify Proof of Funds</h1>
                    </div>
                    <p className="mt-2 text-gray-600">
                        Verify a proof of funds by entering the transaction hash or ZK proof reference ID.
                    </p>
                </header>

            <main>
                <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                    <div className="mb-4">
                        <label htmlFor="txHash" className="block text-gray-700 font-medium mb-2">
                            Transaction Hash
                        </label>
                        <div className="flex">
                            <input
                                type="text"
                                id="txHash"
                                value={transactionHash}
                                onChange={(e) => setTransactionHash(e.target.value)}
                                placeholder="0x..."
                                className="flex-grow px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={handleVerify}
                                disabled={isVerifying || !transactionHash}
                                className={`px-4 py-2 rounded-r-md font-medium ${isVerifying || !transactionHash
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-blue-500 text-white hover:bg-blue-600'
                                    }`}
                            >
                                {isVerifying ? 'Verifying...' : 'Verify'}
                            </button>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                            Enter the blockchain transaction hash that contains the proof submission.
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-4 bg-red-100 border border-red-300 text-red-700 rounded-md">
                            <p className="font-medium">Verification Failed</p>
                            <p>{error}</p>
                        </div>
                    )}

                    {proofDetails && (
                        <div className="border border-gray-200 rounded-md overflow-hidden">
                            <div className={`p-4 text-white font-medium ${verificationStatus ? 'bg-green-500' : 'bg-yellow-500'}`}>
                                {verificationStatus ? 'Proof Verified Successfully' : 'Proof Information Retrieved'}
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500">Proof ID</h3>
                                        <p className="mt-1">{proofDetails.proofId}</p>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500">User Address</h3>
                                        <p className="mt-1 break-all">{proofDetails.user}</p>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500">Proof Type</h3>
                                        <p className="mt-1">{proofDetails.proofType === 0 ? 'Standard' : proofDetails.proofType === 1 ? 'Threshold (At Least)' : 'Maximum (At Most)'}</p>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500">Amount</h3>
                                        <p className="mt-1">
                                            {proofDetails.amount} {proofDetails.tokenSymbol}
                                        </p>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500">Expiry Date</h3>
                                        <p className="mt-1">{proofDetails.expiryDate}</p>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500">Contract Address</h3>
                                        <p className="mt-1 break-all">{proofDetails.contractAddress}</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-gray-500">Proof Hash</h3>
                                    <p className="mt-1 break-all">{proofDetails.proofHash}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            </div>
        </Layout>
    );
} 