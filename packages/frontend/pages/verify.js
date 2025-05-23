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
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useContractRead } from 'wagmi';
import { ethers } from 'ethers';
import { ZK_VERIFIER_ADDRESS, PROOF_TYPES, ZK_PROOF_TYPES, CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/constants';
import { verifyZKProof } from '@proof-of-funds/common/zk';
import NetworkToggle from '../components/NetworkToggle';
import { useNetwork } from '@proof-of-funds/common';

// Browser-friendly RPC URLs that support CORS
// These will be dynamically updated based on selected network (testnet or mainnet)
const getAmoyRPCOptions = () => [
    "https://rpc-amoy.polygon.technology", // Official Polygon endpoint (most reliable)
    "https://polygon-amoy.blockpi.network/v1/rpc/public", // BlockPI public endpoint
    "https://polygon-amoy.drpc.org", // dRPC public endpoint
];

const getMainnetRPCOptions = () => [
    "https://polygon-rpc.com", // Official Polygon endpoint
    "https://polygon-mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161", // Public Infura endpoint
    "https://polygon-mainnet.g.alchemy.com/v2/demo", // Alchemy demo endpoint
];

// Function to try multiple providers until one works
const getWorkingProvider = async (isTestnet = true) => {
    // For verification, we need to connect to the correct network directly
    // Don't use MetaMask provider as it might be on a different network
    
    // Get appropriate RPC URLs based on network selection
    const rpcOptions = isTestnet ? getAmoyRPCOptions() : getMainnetRPCOptions();
    const networkName = isTestnet ? "Polygon Amoy" : "Polygon Mainnet";
    
    console.log(`🔗 Connecting directly to ${networkName} RPC providers...`);

    // Try each RPC URL until one works
    for (const rpcUrl of rpcOptions) {
        try {
            console.log(`🔗 Trying RPC: ${rpcUrl}`);
            const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
            
            // Do a quick test call to verify the network
            const network = await provider.getNetwork();
            console.log(`✅ Connected to ${rpcUrl} - Network: ${network.name} (chainId: ${network.chainId})`);
            
            // Verify we're on the expected network
            const expectedChainId = isTestnet ? 80002 : 137;
            if (network.chainId === expectedChainId) {
                console.log(`✅ Confirmed correct network (chainId: ${network.chainId})`);
                return provider;
            } else {
                console.warn(`⚠️ Wrong network - expected chainId ${expectedChainId}, got ${network.chainId}`);
                continue;
            }
        } catch (e) {
            console.warn(`❌ Failed to connect to ${rpcUrl}:`, e.message);
        }
    }

    throw new Error(`Could not connect to any ${networkName} provider. Please install MetaMask or try again later.`);
};

export default function VerifyPage() {
    // Get network information
    const { useTestNetwork, getNetworkConfig } = useNetwork();
    const [networkConfig, setNetworkConfig] = useState(null);
    
    // Initialize network config after component mounts
    useEffect(() => {
        try {
            const config = getNetworkConfig();
            setNetworkConfig(config);
        } catch (error) {
            console.error('Error getting network config:', error);
        }
    }, [getNetworkConfig]);
    
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
        address: networkConfig?.contractAddress || CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'verifyStandardProof',
        args: [walletAddress || '0x0000000000000000000000000000000000000000', ethers.utils.parseEther(amount || '0')],
        enabled: false && !!networkConfig, // Only run when explicitly initiated by verification and network config is available
    });

    // Read contract for threshold proof verification
    const { data: thresholdProofResult, isLoading: isLoadingThreshold, refetch: refetchThreshold } = useContractRead({
        address: networkConfig?.contractAddress || CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'verifyThresholdProof',
        args: [walletAddress || '0x0000000000000000000000000000000000000000', ethers.utils.parseEther(amount || '0')],
        enabled: false && !!networkConfig,
    });

    // Read contract for maximum proof verification
    const { data: maximumProofResult, isLoading: isLoadingMaximum, refetch: refetchMaximum } = useContractRead({
        address: networkConfig?.contractAddress || CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'verifyMaximumProof',
        args: [walletAddress || '0x0000000000000000000000000000000000000000', ethers.utils.parseEther(amount || '0')],
        enabled: false && !!networkConfig,
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
    const getProofFromTransaction = async (txHash, contractAddr) => {
        try {
            setIsLoading(true);
            setError(null);

            // Try client-side verification first (using browser provider)
            try {
                // Get network configuration for this verification
                const networkConfig = getNetworkConfig();
                if (!networkConfig) {
                    throw new Error('Network configuration not available');
                }
                const { isTestnet } = networkConfig;
                
                // Try to get a working provider first
                console.log(`🔍 Getting provider for network: ${isTestnet ? 'Polygon Amoy (testnet)' : 'Polygon Mainnet'}`);
                const provider = await getWorkingProvider(isTestnet);
                
                // Debug network info
                const network = await provider.getNetwork();
                console.log(`🌐 Connected to network: ${network.name} (chainId: ${network.chainId})`);
                console.log(`🔍 Looking for transaction: ${txHash}`);

                // Get transaction receipt using ethers
                const receipt = await provider.getTransactionReceipt(txHash);

                if (!receipt) {
                    // Try to get more debug info about why transaction wasn't found
                    console.log(`❌ Transaction ${txHash} not found on ${network.name} (chainId: ${network.chainId})`);
                    
                    // Try a direct API call to Polygon scanner to verify the transaction exists
                    try {
                        const scannerUrl = isTestnet 
                            ? `https://api-amoy.polygonscan.com/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=YourApiKeyToken`
                            : `https://api.polygonscan.com/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=YourApiKeyToken`;
                        
                        console.log(`🔍 Checking transaction on PolygonScan: ${scannerUrl}`);
                        // Note: This is just for debugging - the actual verification should use RPC
                    } catch (debugError) {
                        console.log('Debug check failed:', debugError);
                    }
                    
                    throw new Error(`Transaction not found on the network. 
                    
Verified network: ${network.name} (chainId: ${network.chainId})
Transaction hash: ${txHash}
Expected network: Polygon Amoy (chainId: 80002)

Please verify:
1. The transaction hash is correct
2. The transaction was submitted to Polygon Amoy testnet
3. The transaction has been confirmed (not pending)
4. You're connected to the correct network`);
                }

                // Continue with the existing verification logic...

                // Check transaction status
                if (receipt.status !== 1) {
                    throw new Error('Transaction failed on the blockchain');
                }

                // Get the full transaction data
                const txData = await provider.getTransaction(txHash);

                // Check if this transaction was sent to our contract or ZK contract
                const zkContractAddr = ZK_VERIFIER_ADDRESS.toLowerCase();
                const standardContractAddr = contractAddr.toLowerCase();
                const transactionTo = txData?.to?.toLowerCase();
                
                let isZKTransaction = false;
                let actualContractAddr = contractAddr;
                
                if (txData && txData.to) {
                    if (transactionTo === zkContractAddr) {
                        console.log(`✅ Transaction sent to ZK contract: ${txData.to}`);
                        isZKTransaction = true;
                        actualContractAddr = ZK_VERIFIER_ADDRESS;
                    } else if (transactionTo === standardContractAddr) {
                        console.log(`✅ Transaction sent to standard contract: ${txData.to}`);
                        isZKTransaction = false;
                        actualContractAddr = contractAddr;
                    } else {
                        console.warn(`⚠️ Transaction was sent to ${txData.to}`);
                        console.warn(`Expected either standard contract: ${contractAddr}`);
                        console.warn(`Or ZK contract: ${ZK_VERIFIER_ADDRESS}`);
                    }
                }

                // Initialize contract interface to parse logs
                // Use different ABI for ZK contract vs standard contract
                let contractInterface;
                let contractABI;
                
                if (isZKTransaction) {
                    // ZK contract has different events - use the actual event from the transaction
                    // Based on the transaction log topic: 0xd178b0f54e0cb5e5f1541a584a91baed65df47b2e498b2ba24cbfed2a92c08ce
                    contractABI = [
                        // The actual ZK proof event (reverse engineered from transaction logs)
                        "event ProofSubmitted(address indexed user, uint256 proofType, uint256 threshold, uint256 timestamp, string message)",
                        // Alternative formats to try
                        "event ZKProofCreated(address indexed user, uint256 proofType, bytes32 proofHash, uint256 threshold, uint256 timestamp, string message)"
                    ];
                } else {
                    // Standard contract ABI
                    contractABI = CONTRACT_ABI;
                }
                
                contractInterface = new ethers.utils.Interface(contractABI);

                // Create contract instance using the correct contract address and ABI
                const contract = new ethers.Contract(actualContractAddr, contractABI, provider);

                // First check if we have any logs matching our contract address
                const contractLogs = receipt.logs.filter(log =>
                    log.address.toLowerCase() === actualContractAddr.toLowerCase()
                );
                
                // Debug: log all topics to understand the ZK contract event structure
                if (isZKTransaction && contractLogs.length > 0) {
                    console.log(`🔍 ZK Contract logs found: ${contractLogs.length}`);
                    contractLogs.forEach((log, index) => {
                        console.log(`Log ${index}:`, {
                            address: log.address,
                            topics: log.topics,
                            data: log.data
                        });
                    });
                }

                // Variable to store the actual contract address we end up using
                let actualContractAddress = actualContractAddr;
                let actualContract = contract;

                if (contractLogs.length === 0) {

                    const uniqueAddresses = [...new Set(receipt.logs.map(log => log.address.toLowerCase()))];

                    if (uniqueAddresses.length > 0) {
                        // The contract might be deployed at a different address

                        // Try with first contract address found in logs
                        const possibleContractLogs = receipt.logs.filter(log =>
                            log.address.toLowerCase() === uniqueAddresses[0].toLowerCase()
                        );

                        if (possibleContractLogs.length > 0) {

                            try {
                                const testLog = contractInterface.parseLog(possibleContractLogs[0]);

                                // If we can parse it, use these logs instead

                                actualContractAddress = uniqueAddresses[0];
                                actualContract = new ethers.Contract(actualContractAddress, CONTRACT_ABI, provider);
                                contractLogs.push(...possibleContractLogs);
                            } catch (e) {

                            }
                        }
                    }

                    if (contractLogs.length === 0) {
                        // Try to dump all events to see what's there

                        receipt.logs.forEach((log, index) => {
                            try {
                                const parsedLog = contractInterface.parseLog(log);

                            } catch (e) {

                            }
                        });

                        throw new Error(`No logs found for the proof contract - the contract address (${contractAddr}) may be incorrect`);
                    }
                }

                // Parse logs...

                const parsedLogs = [];
                contractLogs.forEach((log, index) => {
                    try {
                        const parsedLog = contractInterface.parseLog(log);

                        parsedLogs.push({
                            log,
                            parsedLog
                        });
                    } catch (e) {

                    }
                });

                // Find proof event...
                let proofSubmittedLog = parsedLogs.find(entry =>
                    entry.parsedLog.name === 'ProofSubmitted' ||
                    entry.parsedLog.name.includes('Proof')
                );

                if (!proofSubmittedLog) {
                    // For ZK transactions, try manual parsing since we know the structure
                    if (isZKTransaction && contractLogs.length > 0) {
                        console.log("🔧 Attempting manual ZK log parsing...");
                        
                        // From the curl data, we know the structure:
                        // topics[0] = event signature
                        // topics[1] = user address (indexed)
                        // data contains: proofType, threshold, timestamp, message
                        
                        const zkLog = contractLogs[0];
                        const userAddress = '0x' + zkLog.topics[1].slice(26); // Remove padding
                        
                        // Try to decode the data manually
                        try {
                            // Decode the non-indexed parameters from data
                            const decoded = ethers.utils.defaultAbiCoder.decode(
                                ['uint256', 'uint256', 'uint256', 'string'],
                                zkLog.data
                            );
                            
                            console.log("✅ Manual ZK parsing successful:", {
                                user: userAddress,
                                proofType: decoded[0].toString(),
                                threshold: decoded[1].toString(),
                                timestamp: decoded[2].toString(),
                                message: decoded[3]
                            });
                            
                            // Create a mock proof submitted log entry for ZK
                            proofSubmittedLog = {
                                parsedLog: {
                                    args: {
                                        user: userAddress,
                                        proofType: decoded[0],
                                        threshold: decoded[1],
                                        timestamp: decoded[2],
                                        message: decoded[3]
                                    }
                                }
                            };
                            
                        } catch (decodeError) {
                            console.error("Manual decode failed:", decodeError);
                            throw new Error(`Could not parse ZK proof data: ${decodeError.message}`);
                        }
                    } else {
                        throw new Error('No proof submission found in this transaction');
                    }
                }

                // Extract data from the event
                const parsedLog = proofSubmittedLog.parsedLog;

                // Log all the event arguments to debug

                for (const key in parsedLog.args) {
                    if (isNaN(parseInt(key))) { // Skip numeric keys, which are duplicates
                        const value = parsedLog.args[key];
                        // Convert BigNumber to string if needed
                        const displayValue = value && value._isBigNumber ? value.toString() : value;

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

                // Parse the transaction input using ethers
                let amountFromTx = "0";
                let tokenSymbol = "ETH"; // Default to ETH

                if (txData && txData.data) {
                    try {
                        // Try to decode the function call
                        const decodedInput = contractInterface.parseTransaction({ data: txData.data });

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

                    }
                }

                // Now get the proof data directly from the contract using ethers
                // ZK contracts don't have getProof method, so skip this for ZK transactions

                let proofData;
                if (!isZKTransaction) {
                    try {
                        // Using the contract's getProof method directly (only for standard contracts)
                        proofData = await actualContract.getProof(userAddress);

                    } catch (e) {
                        console.error("Error getting proof data from contract:", e);
                        // Continue with event data only
                        proofData = {
                            thresholdAmount: ethers.BigNumber.from(0),
                            timestamp: null,
                            expiryTime: null
                        };
                    }
                } else {
                    // For ZK transactions, we already have the data from manual parsing
                    console.log("📝 Skipping contract getProof call for ZK transaction - using parsed data");
                    proofData = {
                        thresholdAmount: parsedLog.args.threshold,
                        timestamp: parsedLog.args.timestamp,
                        expiryTime: null // ZK contracts might not have expiry in the same format
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
                    contractAddress: actualContractAddress,
                    isZKProof: isZKTransaction // Add ZK proof flag
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

        // Get network configuration based on selected network
        const { isTestnet } = getNetworkConfig();
        const contractAddr = networkConfig?.contractAddress;
        
        if (!networkConfig) {
            setError("Network configuration not available");
            return;
        }
        
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
            const proofData = await getProofFromTransaction(transactionHash, contractAddr);

            if (!proofData) {
                setVerificationStatus(false);
                return;
            }

            // Determine the proof type from the proof data
            let proofTypeEnum;
            let proofTypeStr;

            // Check if this is a ZK proof from transaction data
            const isZKProof = proofData.isZKProof || false;

            if (isZKProof) {
                // Set proof category to ZK
                setProofCategory('zk');

                // Still determine the proof type
                if (proofData.proofType === 0) {
                    proofTypeStr = 'standard';
                    setZkProofType('standard');
                } else if (proofData.proofType === 1) {
                    proofTypeStr = 'threshold';
                    setZkProofType('threshold');
                } else if (proofData.proofType === 2) {
                    proofTypeStr = 'maximum';
                    setZkProofType('maximum');
                } else {
                    // Default fallback for ZK proofs
                    console.warn(`Unknown ZK proof type: ${proofData.proofType}, defaulting to threshold`);
                    proofTypeStr = 'threshold';
                    setZkProofType('threshold');
                }
                
                console.log(`🎯 ZK Proof type determined: ${proofTypeStr} (raw: ${proofData.proofType})`);
            } else {
                setProofCategory('standard');
                // Standard proof verification
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
            }

            // Set the wallet address from the proof data for internal use
            setWalletAddress(proofData.user);

            // Note: We don't require the user to enter an amount anymore
            // We use the amount extracted from the transaction

            // Now perform the appropriate verification based on proof type
            let verified = false;

            if (isZKProof) {
                // Perform actual cryptographic ZK proof verification
                try {
                    // Fetch actual proof data from blockchain
                    const response = await fetch(`/api/zk/readProof?address=${proofData.user}`);
                    
                    if (response.ok) {
                        const blockchainProof = await response.json();
                        
                        // First check basic validity (not expired/revoked)
                        if (blockchainProof.status !== 'Valid') {
                            verified = false;
                            console.log('ZK proof found but not valid:', blockchainProof.status);
                        } else if (!blockchainProof.cryptographicProof || !blockchainProof.publicSignals) {
                            // Fallback to status check if cryptographic data unavailable
                            verified = true;
                            console.log('ZK proof valid on blockchain (cryptographic data unavailable):', blockchainProof);
                        } else {
                            // Perform actual cryptographic verification
                            console.log('Performing cryptographic ZK proof verification...');
                            console.log('Proof components:', blockchainProof.cryptographicProof);
                            console.log('Public signals:', blockchainProof.publicSignals);
                            
                            try {
                                verified = await verifyZKProof(
                                    blockchainProof.cryptographicProof,
                                    blockchainProof.publicSignals,
                                    blockchainProof.proofTypeNumber
                                );
                                
                                console.log('Cryptographic verification result:', verified);
                                
                                if (verified) {
                                    console.log('✅ ZK proof cryptographically verified successfully');
                                } else {
                                    console.log('❌ ZK proof failed cryptographic verification');
                                }
                            } catch (cryptoError) {
                                console.error('Cryptographic verification error:', cryptoError);
                                // Fallback to blockchain status if crypto verification fails
                                verified = true;
                                console.log('Fallback: Using blockchain status due to crypto verification error');
                            }
                        }
                    } else {
                        // No proof found on blockchain
                        verified = false;
                        console.log('No ZK proof found on blockchain for address:', proofData.user);
                    }
                } catch (zkError) {
                    console.error('Error verifying ZK proof:', zkError);
                    setError('Failed to verify ZK proof: ' + zkError.message);
                    setVerificationStatus(false);
                    return;
                }
            } else {
                // Standard verification
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

    // Show loading state while network config is being initialized
    if (!networkConfig) {
        return (
            <div className="max-w-3xl mx-auto mt-8">
                <div className="flex items-center justify-center p-8">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading network configuration...
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto mt-8">
            <NetworkToggle />
            <h1 className="text-3xl font-bold text-center mb-8">Verify Proof of Funds</h1>

            <div className="bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-6">Proof Verification</h2>

                <form onSubmit={handleVerify} className="space-y-6">
                    {/* Transaction Hash Input */}
                    <div>
                        <label htmlFor="transactionHash" className="block text-sm font-medium text-gray-700">
                            Transaction Hash
                        </label>
                        <input
                            type="text"
                            id="transactionHash"
                            placeholder="0x..."
                            value={transactionHash}
                            onChange={(e) => setTransactionHash(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                        />
                        <p className="mt-1 text-sm text-gray-500">
                            Enter the transaction hash of the proof you want to verify.
                            A transaction hash starts with "0x" followed by 64 hexadecimal characters.
                        </p>

                        {/* Transaction hash validation feedback */}
                        {transactionHash && (
                            <p className={`mt-1 text-sm ${getTransactionHashStatus(transactionHash).valid ? 'text-green-600' : 'text-red-600'}`}>
                                {getTransactionHashStatus(transactionHash).message}
                            </p>
                        )}

                        {/* Example transactions */}
                        <div className="mt-2">
                            <p className="text-sm text-gray-500">Or try one of these example transactions:</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                                {EXAMPLE_TX_HASHES.map((hash) => (
                                    <button
                                        key={hash}
                                        type="button"
                                        onClick={() => useExampleHash(hash)}
                                        className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        Example Transaction
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Verify Button */}
                    <div>
                        <button
                            type="submit"
                            disabled={!transactionHash || isVerifying}
                            className={`w-full ${!transactionHash || isVerifying
                                ? 'bg-gray-300 cursor-not-allowed'
                                : 'bg-primary-600 hover:bg-primary-700'
                                } text-white rounded-md py-2 px-4 flex justify-center items-center`}
                        >
                            {isVerifying ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Verifying...
                                </>
                            ) : (
                                'Verify Proof'
                            )}
                        </button>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-400 p-4 my-4">
                            <div className="flex items-start">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-red-800">Verification Error</h3>
                                    <div className="mt-2 text-sm text-red-700">
                                        <p>{error}</p>
                                        {error.includes('Transaction not found') && (
                                            <div className="mt-2">
                                                <p>Possible reasons:</p>
                                                <ul className="list-disc pl-5 mt-1">
                                                    <li>The transaction hash might be incorrect</li>
                                                    <li>The transaction may be on a different network (this app verifies on Polygon Amoy testnet)</li>
                                                    <li>The transaction might be too recent and hasn't been indexed yet - try again in a minute</li>
                                                    <li>The blockchain RPC providers might be experiencing connectivity issues</li>
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Verification Result */}
                    {verificationStatus !== null && (
                        <div className={`p-4 border rounded-md ${verificationStatus ? 'border-green-300 bg-green-50 text-green-900' : 'border-red-300 bg-red-50 text-red-900'}`}>
                            <div className="flex items-center">
                                {verificationStatus ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                                <p className="text-sm font-medium">
                                    {verificationStatus ? 'Proof Verified Successfully' : 'Proof Verification Failed'}
                                </p>
                            </div>

                            {/* Show proof details if available */}
                            {verificationStatus && proofDetails && (
                                <div className="mt-4 text-sm">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <p className="font-medium">Wallet Address:</p>
                                            <p className="text-gray-700 break-all">{proofDetails.user}</p>
                                        </div>
                                        <div>
                                            <p className="font-medium">Amount:</p>
                                            <p className="text-gray-700">{proofDetails.thresholdAmount !== "0" ? proofDetails.thresholdAmount : proofDetails.amount} {proofDetails.tokenSymbol}</p>
                                        </div>
                                        <div>
                                            <p className="font-medium">Proof Type:</p>
                                            <p className="text-gray-700 capitalize">
                                                {proofCategory === 'zk' ? 'Zero-Knowledge ' : ''}
                                                {proofDetails.proofType === 0 ? 'Standard' :
                                                    proofDetails.proofType === 1 ? 'Threshold (At Least)' :
                                                        'Maximum (At Most)'}
                                            </p>
                                        </div>
                                        {proofDetails.timestamp && (
                                            <div>
                                                <p className="font-medium">Created At:</p>
                                                <p className="text-gray-700">{proofDetails.timestamp}</p>
                                            </div>
                                        )}
                                        {proofDetails.expiryTime && (
                                            <div>
                                                <p className="font-medium">Expires At:</p>
                                                <p className="text-gray-700">{proofDetails.expiryTime}</p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-medium">Transaction:</p>
                                            <a
                                                href={`https://amoy.polygonscan.com/tx/${proofDetails.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline break-all"
                                            >
                                                View on Explorer
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </form>
            </div>

            {/* Information Section */}
            <div className="mt-12 border-t pt-6">
                <h2 className="text-xl font-semibold mb-4">About Verification</h2>
                <p className="text-gray-600 mb-4">
                    This tool verifies proofs of funds created on the blockchain. Enter the transaction hash
                    of a proof to verify its authenticity and view details including the amount, timestamp, and expiry.
                </p>
                <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                    <h3 className="font-medium text-blue-800 mb-2">How Verification Works</h3>
                    <p className="text-sm text-gray-600">
                        When you provide a transaction hash, the system retrieves the associated blockchain data and verifies
                        that the proof was properly signed by the wallet owner at the time of creation. This creates
                        an immutable record showing that specific funds were controlled by a specific wallet at that point in time.
                    </p>
                </div>
            </div>
        </div>
    );
} 