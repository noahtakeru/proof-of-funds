import { useState, useEffect, useRef } from 'react';
import { useAccount, useContractWrite } from 'wagmi';
import { ethers } from 'ethers';
import { PROOF_TYPES, ZK_PROOF_TYPES, ZK_VERIFIER_ADDRESS, SIGNATURE_MESSAGE_TEMPLATES, EXPIRY_OPTIONS } from '../config/constants';
import { getConnectedWallets, scanMultiChainAssets, convertAssetsToUSD, disconnectWallet } from '../lib/walletHelpers';
import MultiChainAssetDisplay from '../components/MultiChainAssetDisplay';
import WalletSelector from '../components/WalletSelector';

// Smart contract address on Polygon Amoy testnet
const CONTRACT_ADDRESS = '0xD6bd1eFCE3A2c4737856724f96F39037a3564890';
const ABI = [
    {
        "inputs": [
            { "internalType": "uint256", "name": "_amount", "type": "uint256" },
            { "internalType": "uint256", "name": "_expiryTime", "type": "uint256" },
            { "internalType": "string", "name": "_signatureMessage", "type": "string" }
        ],
        "name": "submitProof",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "_thresholdAmount", "type": "uint256" },
            { "internalType": "uint256", "name": "_expiryTime", "type": "uint256" },
            { "internalType": "string", "name": "_signatureMessage", "type": "string" }
        ],
        "name": "submitThresholdProof",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "_maxAmount", "type": "uint256" },
            { "internalType": "uint256", "name": "_expiryTime", "type": "uint256" },
            { "internalType": "string", "name": "_signatureMessage", "type": "string" }
        ],
        "name": "submitMaximumProof",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

export default function CreatePage() {
    const [proofCategory, setProofCategory] = useState('standard'); // 'standard' or 'zk'
    const [proofType, setProofType] = useState('standard'); // 'standard', 'threshold', 'maximum'
    const [zkProofType, setZkProofType] = useState('standard'); // 'standard', 'threshold', 'maximum'
    const [amount, setAmount] = useState('');
    const [expiryDays, setExpiryDays] = useState('seven_days');
    const [signatureMessage, setSignatureMessage] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState(SIGNATURE_MESSAGE_TEMPLATES[0].id);
    const [customFields, setCustomFields] = useState({});
    const [useKYC, setUseKYC] = useState(false);
    const [success, setSuccess] = useState(false);
    const [txHash, setTxHash] = useState('');

    // For wallet connection state management
    const [connectedWallets, setConnectedWallets] = useState([]);
    const [selectedWallets, setSelectedWallets] = useState([]);
    const [userInitiatedConnection, setUserInitiatedConnection] = useState(false);

    // For multi-chain assets
    const [assetSummary, setAssetSummary] = useState(null);
    const [isLoadingAssets, setIsLoadingAssets] = useState(false);
    const [assetError, setAssetError] = useState('');
    const [showUSDValues, setShowUSDValues] = useState(true);
    const [isConvertingUSD, setIsConvertingUSD] = useState(false);

    // For asset summary expansion state
    const [isAssetSummaryExpanded, setIsAssetSummaryExpanded] = useState(true);

    // For amount input type selection
    const [amountInputType, setAmountInputType] = useState('usd'); // 'usd' or 'tokens'
    const [selectedTokens, setSelectedTokens] = useState([]); // Array of {token, amount}

    // For wallet signatures tracking
    const [walletSignatures, setWalletSignatures] = useState({});
    const [isSigningWallet, setIsSigningWallet] = useState(false);
    const [currentSigningWallet, setCurrentSigningWallet] = useState(null);
    const [readyToSubmit, setReadyToSubmit] = useState(false);
    const [proofData, setProofData] = useState(null);

    const { address, isConnected } = useAccount();

    // Use refs to track previous values to avoid infinite loops
    const prevSelectedWalletsRef = useRef([]);
    const prevConnectedWalletsRef = useRef([]);
    const prevShowUSDValuesRef = useRef(false);
    const assetsLoadedRef = useRef(false);

    // Add the missing refs for current values
    const selectedWalletsRef = useRef([]);
    const connectedWalletsRef = useRef([]);
    const showUSDValuesRef = useRef(false);

    // Format address for display
    const formatAddress = (address) => {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    // Import and use the getConnectedWallets helper from walletHelpers
    useEffect(() => {
        // Function to update connected wallets from localStorage
        const updateConnectedWallets = () => {
            // Use the centralized helper to get wallets
            const wallets = getConnectedWallets();
            console.log('Updated wallet list in create.js:', wallets);
            setConnectedWallets(wallets);

            // Update user connection state
            const userInitiated = localStorage.getItem('userInitiatedConnection') === 'true';
            setUserInitiatedConnection(userInitiated);

            // Update selected wallets if needed - only update state if needed
            if (selectedWallets.length === 0 && wallets.length > 0) {
                setSelectedWallets([wallets[0].id]);
            } else if (selectedWallets.length > 0) {
                // Keep only valid wallets in selected list
                const validWalletIds = wallets.map(w => w.id);
                const filteredWallets = selectedWallets.filter(id => validWalletIds.includes(id));

                // Only update if the arrays are different
                if (filteredWallets.length !== selectedWallets.length) {
                    setSelectedWallets(filteredWallets);
                }
            }
        };

        // Initial update
        updateConnectedWallets();

        // Set up listeners for wallet changes across the app
        const handleStorageChange = (e) => {
            if (e.key === 'walletData' || e.key === 'userInitiatedConnection') {
                console.log(`Storage change detected in create.js: ${e.key}`);
                updateConnectedWallets();
            }
        };

        // Listen for changes from other tabs
        window.addEventListener('storage', handleStorageChange);

        // Set up for changes in current tab
        if (typeof window !== 'undefined' && !window._createPageStorageSetup) {
            window.addEventListener('localStorage-changed', (e) => {
                if (e.detail && (e.detail.key === 'walletData' || e.detail.key === 'userInitiatedConnection')) {
                    console.log(`localStorage-changed event in create.js: ${e.detail.key}`);
                    updateConnectedWallets();
                }
            });

            window._createPageStorageSetup = true;
        }

        // Clean up
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []); // Empty dependency array to run only once on mount

    // Update refs when values change
    useEffect(() => {
        selectedWalletsRef.current = selectedWallets;
    }, [selectedWallets]);

    useEffect(() => {
        connectedWalletsRef.current = connectedWallets;
    }, [connectedWallets]);

    useEffect(() => {
        showUSDValuesRef.current = showUSDValues;
        // If showUSDValues is true but we already have assets loaded without USD values,
        // convert them to USD
        if (showUSDValues && assetSummary && !assetSummary.convertedAssets) {
            (async () => {
                try {
                    setIsConvertingUSD(true);
                    const summaryWithUSD = await convertAssetsToUSD(assetSummary);
                    setAssetSummary(summaryWithUSD);
                } catch (error) {
                    console.error('Error converting to USD:', error);
                    setAssetError(`Failed to convert to USD: ${error.message || 'Unknown error'}`);
                } finally {
                    setIsConvertingUSD(false);
                }
            })();
        }
    }, [showUSDValues, assetSummary]);

    // This effect will handle asset loading
    useEffect(() => {
        let isMounted = true;

        const loadAssets = async () => {
            // Only proceed if we have selected wallets
            if (selectedWalletsRef.current.length === 0) {
                if (isMounted) setAssetSummary(null);
                return;
            }

            try {
                if (isMounted) {
                    setIsLoadingAssets(true);
                    setAssetError('');
                }

                // Get the wallet objects for selected IDs
                const walletObjects = connectedWalletsRef.current.filter(wallet =>
                    selectedWalletsRef.current.includes(wallet.id)
                );

                if (walletObjects.length === 0) {
                    throw new Error('No valid wallets selected');
                }

                // Scan assets across all selected wallets
                const summary = await scanMultiChainAssets(walletObjects);
                console.log('Asset summary:', summary);

                // Convert to USD if needed
                if (showUSDValuesRef.current) {
                    if (isMounted) setIsConvertingUSD(true);
                    const summaryWithUSD = await convertAssetsToUSD(summary);
                    if (isMounted) {
                        setAssetSummary(summaryWithUSD);
                        setIsConvertingUSD(false);
                    }
                } else {
                    if (isMounted) setAssetSummary(summary);
                }
            } catch (error) {
                console.error('Error loading wallet assets:', error);
                if (isMounted) {
                    setAssetError(`Failed to load assets: ${error.message || 'Unknown error'}`);
                    setAssetSummary(null);
                }
            } finally {
                if (isMounted) setIsLoadingAssets(false);
            }
        };

        loadAssets();

        return () => {
            isMounted = false;
        };
    }, [selectedWallets]); // Only depend on selectedWallets

    // Toggle USD conversion
    const handleToggleUSDConversion = async () => {
        if (!showUSDValues && assetSummary) {
            // If turning on USD conversion, convert existing assets
            try {
                setIsConvertingUSD(true);
                const summaryWithUSD = await convertAssetsToUSD(assetSummary);
                setAssetSummary(summaryWithUSD);
                setShowUSDValues(true);
            } catch (error) {
                console.error('Error converting to USD:', error);
                setAssetError(`Failed to convert to USD: ${error.message || 'Unknown error'}`);
            } finally {
                setIsConvertingUSD(false);
            }
        } else {
            // Just toggle the flag, the useEffect will handle reloading
            setShowUSDValues(!showUSDValues);
        }
    };

    // Handle wallet selection (now supports multiple selection)
    const handleWalletSelection = (walletId) => {
        setSelectedWallets(prev => {
            // If already selected, remove it
            if (prev.includes(walletId)) {
                return prev.filter(id => id !== walletId);
            }
            // Otherwise add it
            return [...prev, walletId];
        });
    };

    // Set up listener for MetaMask account changes
    useEffect(() => {
        const handleAccountsChanged = async (accounts) => {
            // This will trigger the wallet tracking effect that rebuilds the wallet list
            if (accounts.length === 0) {
                // User disconnected all accounts
                setSelectedWallets([]);
            }
        };

        if (typeof window !== 'undefined' && window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);

            return () => {
                if (window.ethereum) {
                    window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                }
            };
        }
    }, []);

    // Contract write hooks
    const {
        write: writeStandardProof,
        isLoading: isPendingStandard,
        isError: isErrorStandard,
        error: errorStandard,
        data: dataStandard
    } = useContractWrite({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'submitProof',
    });

    const {
        write: writeThresholdProof,
        isLoading: isPendingThreshold,
        isError: isErrorThreshold,
        error: errorThreshold,
        data: dataThreshold
    } = useContractWrite({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'submitThresholdProof',
    });

    const {
        write: writeMaximumProof,
        isLoading: isPendingMaximum,
        isError: isErrorMaximum,
        error: errorMaximum,
        data: dataMaximum
    } = useContractWrite({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'submitMaximumProof',
    });

    const {
        write: writeZKProof,
        isLoading: isPendingZK,
        isError: isErrorZK,
        error: errorZK,
        data: dataZK
    } = useContractWrite({
        address: ZK_VERIFIER_ADDRESS,
        abi: [
            {
                "inputs": [
                    { "internalType": "bytes", "name": "_proof", "type": "bytes" },
                    { "internalType": "bytes", "name": "_publicSignals", "type": "bytes" },
                    { "internalType": "uint256", "name": "_expiryTime", "type": "uint256" },
                    { "internalType": "uint8", "name": "_proofType", "type": "uint8" },
                    { "internalType": "string", "name": "_signatureMessage", "type": "string" },
                    { "internalType": "bytes", "name": "_signature", "type": "bytes" }
                ],
                "name": "verifyAndStoreProof",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ],
        functionName: 'verifyAndStoreProof',
    });

    // Handle token selection for multi-token input
    const handleTokenSelection = (token) => {
        setSelectedTokens(prev => {
            // Check if token is already selected
            const existingToken = prev.find(t => t.symbol === token.symbol && t.chain === token.chain);
            if (existingToken) {
                // If already selected, remove it
                return prev.filter(t => t.symbol !== token.symbol || t.chain !== token.chain);
            }
            // Otherwise add it with empty amount
            return [...prev, { ...token, amount: '' }];
        });
    };

    // Handle token amount change
    const handleTokenAmountChange = (symbol, chain, value) => {
        setSelectedTokens(prev =>
            prev.map(token =>
                (token.symbol === symbol && token.chain === chain)
                    ? { ...token, amount: value }
                    : token
            )
        );
    };

    // Calculate total USD value from selected tokens
    const calculateTotalUsdValue = () => {
        if (!assetSummary || !assetSummary.convertedAssets) return 0;

        return selectedTokens.reduce((total, token) => {
            // Find the token in convertedAssets to get USD rate
            const assetInfo = assetSummary.convertedAssets.find(
                a => a.symbol === token.symbol && a.chain === token.chain
            );

            if (!assetInfo || !token.amount) return total;

            // Calculate USD value based on rate
            const usdRate = assetInfo.usdRate || 0;
            return total + (parseFloat(token.amount) * usdRate);
        }, 0);
    };

    // Handle signing for a specific wallet
    const handleSignWallet = async (walletId) => {
        try {
            setIsSigningWallet(true);
            setCurrentSigningWallet(walletId);

            const wallet = connectedWallets.find(w => w.id === walletId);
            if (!wallet) {
                throw new Error(`Wallet with ID ${walletId} not found`);
            }

            // Prepare amount value based on input type
            let finalAmount = amount;
            if (amountInputType === 'tokens') {
                finalAmount = calculateTotalUsdValue().toString();
            }

            // Create signature message for this wallet
            let walletSpecificMessage = `I confirm ownership of wallet ${wallet.fullAddress} with ${finalAmount} ${amountInputType === 'usd' ? 'USD' : 'worth of tokens'} for proof of funds.`;

            let signature = null;

            // Handle signature based on wallet type
            if (wallet.type === 'evm') {
                // For EVM wallets (MetaMask, etc.)
                try {
                    // Get the correct provider
                    let provider = window.ethereum;
                    if (window.ethereum?.providers) {
                        const metamaskProvider = window.ethereum.providers.find(p => p.isMetaMask);
                        if (metamaskProvider) {
                            provider = metamaskProvider;
                        }
                    }

                    if (!provider) {
                        throw new Error('MetaMask provider not found. Please install MetaMask.');
                    }

                    // ALWAYS show the account selection popup
                    console.log("Opening MetaMask account selection popup...");

                    // Request account permissions - this will ALWAYS show the account selection popup
                    await provider.request({
                        method: 'wallet_requestPermissions',
                        params: [{ eth_accounts: {} }]
                    });

                    // Get the accounts the user selected
                    const selectedAccounts = await provider.request({
                        method: 'eth_accounts'
                    });

                    // Normalize addresses for comparison (lowercase)
                    const targetAddress = wallet.fullAddress.toLowerCase();
                    const selectedAccount = selectedAccounts.length > 0 ? selectedAccounts[0].toLowerCase() : null;

                    // Verify the user selected the correct account - only AFTER they've made their selection
                    if (!selectedAccount) {
                        throw new Error('No account selected in MetaMask');
                    }

                    if (selectedAccount !== targetAddress) {
                        throw new Error(`Wrong account selected. Expected: ${wallet.fullAddress}, Got: ${selectedAccount}`);
                    }

                    // Get the signer from ethers
                    const ethersProvider = new ethers.providers.Web3Provider(provider);
                    const signer = ethersProvider.getSigner();

                    // Double-check the signer address matches our target
                    const signerAddress = await signer.getAddress();
                    if (signerAddress.toLowerCase() !== targetAddress) {
                        throw new Error(`Connected account (${signerAddress}) does not match the wallet you're trying to sign with (${wallet.fullAddress})`);
                    }

                    // Sign the message
                    signature = await signer.signMessage(walletSpecificMessage);
                } catch (error) {
                    if (error.code === 4001) {
                        // User rejected the request
                        throw new Error('Signature request rejected by user');
                    }
                    throw new Error(`Error signing with MetaMask: ${error.message}`);
                }
            } else if (wallet.type === 'solana') {
                // For Solana wallets (Phantom)
                try {
                    // Check if phantom exists
                    if (!window.phantom || !window.phantom.solana) {
                        throw new Error('Phantom wallet extension not detected. Please install Phantom wallet.');
                    }

                    // Get the phantom provider
                    const phantomProvider = window.phantom?.solana;

                    if (!phantomProvider || !phantomProvider.isPhantom) {
                        throw new Error('Phantom wallet not available');
                    }

                    console.log("Opening Phantom popup without any pre-validation");

                    // Always disconnect first to force the popup to appear
                    try {
                        if (phantomProvider.isConnected) {
                            console.log("Disconnecting from Phantom to ensure UI shows up");
                            await phantomProvider.disconnect();
                            // Short delay to ensure disconnect completes
                            await new Promise(resolve => setTimeout(resolve, 300));
                        }
                    } catch (disconnectError) {
                        console.log("Error disconnecting, but continuing anyway:", disconnectError);
                    }

                    // Request connection - this opens the Phantom popup
                    console.log("Requesting Phantom wallet connection with popup...");
                    const response = await phantomProvider.connect({ onlyIfTrusted: false });

                    // Get the wallet address they selected
                    const connectedPublicKey = response.publicKey.toString();
                    console.log("Connected to Phantom wallet:", connectedPublicKey);

                    // Now try to sign the message
                    console.log("Requesting signature from Phantom...");
                    const encodedMessage = new TextEncoder().encode(walletSpecificMessage);
                    const signatureData = await phantomProvider.signMessage(encodedMessage, "utf8");
                    signature = Buffer.from(signatureData.signature).toString('hex');
                    console.log("Message signed successfully");

                    // Only NOW after successful signing do we validate the wallet address
                    if (connectedPublicKey !== wallet.fullAddress) {
                        console.error(`Signed with wrong account. Expected: ${wallet.fullAddress}, Got: ${connectedPublicKey}`);
                        throw new Error(`Error signing with Phantom: Wrong account selected. Please select ${wallet.fullAddress} in Phantom.`);
                    }

                } catch (error) {
                    console.error("Phantom error:", error);
                    if (error.code === 4001) {
                        throw new Error('User rejected the signing request');
                    } else {
                        throw new Error(error.message || 'Error with Phantom wallet');
                    }
                }
            }

            // Update signatures state
            if (signature) {
                setWalletSignatures(prev => ({
                    ...prev,
                    [walletId]: {
                        signature,
                        message: walletSpecificMessage,
                        timestamp: Date.now()
                    }
                }));
            }
        } catch (error) {
            console.error('Error signing with wallet:', error);
            alert(`Error signing: ${error.message}`);
        } finally {
            setIsSigningWallet(false);
            setCurrentSigningWallet(null);
        }
    };

    // Prepare proof data and signatures
    const prepareProofSubmission = () => {
        // Prepare amount value based on input type
        let finalAmount = amount;
        let tokenDetails = [];

        if (amountInputType === 'tokens') {
            finalAmount = calculateTotalUsdValue().toString();
            tokenDetails = selectedTokens.map(token => ({
                symbol: token.symbol,
                chain: token.chain,
                amount: token.amount,
                usdValue: token.amount * (
                    assetSummary?.convertedAssets?.find(
                        a => a.symbol === token.symbol && a.chain === token.chain
                    )?.usdRate || 0
                )
            }));
        }

        const expiryTime = getExpiryTimestamp(expiryDays);

        // Generate proof data that includes all selected wallets and token details if applicable
        const proofDataObj = {
            timestamp: Date.now(),
            expiryTime: expiryTime * 1000, // Convert to milliseconds for JS
            proofType: proofCategory === 'standard' ? proofType : zkProofType,
            wallets: selectedWallets.map(id => {
                const wallet = connectedWallets.find(w => w.id === id);
                return {
                    id: wallet.id,
                    address: wallet.fullAddress,
                    chain: wallet.chain,
                    type: wallet.type
                };
            }),
            assets: assetSummary ? assetSummary.totalAssets : [],
            totalValue: showUSDValues && assetSummary ?
                assetSummary.totalUSDValue :
                (assetSummary && assetSummary.totalAssets.length > 0 ?
                    assetSummary.totalAssets.reduce((sum, asset) => sum + asset.balance, 0) : 0),
            currency: amountInputType === 'usd' ? "USD" : "tokens",
            tokenDetails: tokenDetails,
            signatures: walletSignatures,
            thresholdAmount: proofType === 'threshold' ? parseFloat(finalAmount) : null,
            maximumAmount: proofType === 'maximum' ? parseFloat(finalAmount) : null,
            isThresholdProof: proofType === 'threshold',
            isMaximumProof: proofType === 'maximum'
        };

        setProofData(proofDataObj);
        setReadyToSubmit(true);
    };

    // Submit final proof after all signatures are collected
    const submitFinalProof = async () => {
        if (!proofData || !readyToSubmit) return;

        try {
            const primaryWallet = connectedWallets.find(w => w.id === selectedWallets[0]);
            if (!primaryWallet) {
                throw new Error('Primary wallet not found');
            }

            // For demo purposes, we'll just submit the proof with the primary wallet
            // In a real app, you might merge all signatures or submit different proofs

            // Convert amount to Wei for blockchain submission
            const amountInWei = ethers.utils.parseEther(
                amountInputType === 'usd' ? amount : calculateTotalUsdValue().toString()
            );

            const expiryTime = getExpiryTimestamp(expiryDays);

            if (proofCategory === 'standard') {
                if (proofType === 'standard') {
                    writeStandardProof({
                        args: [amountInWei, expiryTime, signatureMessage],
                    });
                } else if (proofType === 'threshold') {
                    writeThresholdProof({
                        args: [amountInWei, expiryTime, signatureMessage],
                    });
                } else if (proofType === 'maximum') {
                    writeMaximumProof({
                        args: [amountInWei, expiryTime, signatureMessage],
                    });
                }
            } else if (proofCategory === 'zk') {
                // Zero-knowledge proofs handling (mock implementation)
                const mockProof = ethers.utils.defaultAbiCoder.encode(
                    ['uint256[]'],
                    [[1, 2, 3, 4, 5, 6, 7, 8]]
                );

                const mockPublicSignals = ethers.utils.defaultAbiCoder.encode(
                    ['uint256[]'],
                    [[amountInWei.toString()]]
                );

                let zkProofTypeValue;
                if (zkProofType === 'standard') zkProofTypeValue = ZK_PROOF_TYPES.STANDARD;
                else if (zkProofType === 'threshold') zkProofTypeValue = ZK_PROOF_TYPES.THRESHOLD;
                else if (zkProofType === 'maximum') zkProofTypeValue = ZK_PROOF_TYPES.MAXIMUM;

                // Use the signature from the primary wallet
                const primarySignature = walletSignatures[primaryWallet.id]?.signature ||
                    ethers.utils.toUtf8Bytes("mock-signature");

                writeZKProof({
                    args: [
                        mockProof,
                        mockPublicSignals,
                        expiryTime,
                        zkProofTypeValue,
                        signatureMessage,
                        primarySignature
                    ],
                });
            }

            // Reset states after submission
            setReadyToSubmit(false);
            setProofData(null);

        } catch (error) {
            console.error('Error submitting final proof:', error);
            alert(`Failed to submit proof: ${error.message}`);
        }
    };

    // Check if all wallets have been signed
    const areAllWalletsSigned = () => {
        if (selectedWallets.length === 0) return false;
        const allSigned = selectedWallets.every(walletId => !!walletSignatures[walletId]);

        // If all are signed and we're in signing stage, move to ready stage
        if (allSigned && proofStage === 'signing' && !readyToSubmit) {
            setReadyToSubmit(true);
            setProofStage('ready');
        }

        return allSigned;
    };

    // Reset wallet signatures when selected wallets change
    useEffect(() => {
        setWalletSignatures({});
        setReadyToSubmit(false);
        setProofData(null);
    }, [selectedWallets]);

    // Define the handleSubmit function for the button click
    const handleSubmit = (e) => {
        e.preventDefault();

        if (selectedWallets.length === 0) {
            alert('Please select at least one wallet');
            return;
        }

        if (amountInputType === 'usd' && !amount) {
            alert('Please enter an amount');
            return;
        }

        if (amountInputType === 'tokens' && selectedTokens.length === 0) {
            alert('Please select at least one token');
            return;
        }

        // Prepare proof details first
        const finalAmount = amountInputType === 'usd'
            ? amount
            : calculateTotalUsdValue().toString();

        const tokenDetails = amountInputType === 'tokens'
            ? selectedTokens.map(token => ({
                symbol: token.symbol,
                chain: token.chain,
                amount: token.amount,
                usdValue: token.amount * (
                    assetSummary?.convertedAssets?.find(
                        a => a.symbol === token.symbol && a.chain === token.chain
                    )?.usdRate || 0
                )
            }))
            : [];

        const expiryTime = getExpiryTimestamp(expiryDays);

        // Generate proof data
        const proofDataObj = {
            timestamp: Date.now(),
            expiryTime: expiryTime * 1000, // Convert to milliseconds for JS
            proofType: proofCategory === 'standard' ? proofType : zkProofType,
            wallets: selectedWallets.map(id => {
                const wallet = connectedWallets.find(w => w.id === id);
                return {
                    id: wallet.id,
                    address: wallet.fullAddress,
                    chain: wallet.chain,
                    type: wallet.type
                };
            }),
            assets: assetSummary ? assetSummary.totalAssets : [],
            totalValue: showUSDValues && assetSummary
                ? assetSummary.totalUSDValue
                : (assetSummary && assetSummary.totalAssets.length > 0
                    ? assetSummary.totalAssets.reduce((sum, asset) => sum + asset.balance, 0)
                    : 0),
            currency: amountInputType === 'usd' ? "USD" : "tokens",
            tokenDetails: tokenDetails,
            thresholdAmount: proofType === 'threshold' ? parseFloat(finalAmount) : null,
            maximumAmount: proofType === 'maximum' ? parseFloat(finalAmount) : null,
            isThresholdProof: proofType === 'threshold',
            isMaximumProof: proofType === 'maximum'
        };

        setProofData(proofDataObj);

        // Move to signing stage
        setProofStage('signing');
    };

    // Check for transaction completion
    useEffect(() => {
        if (dataStandard || dataThreshold || dataMaximum || dataZK) {
            const txData = dataStandard || dataThreshold || dataMaximum || dataZK;
            if (txData.hash) {
                setTxHash(txData.hash);
                setSuccess(true);
            }
        }
    }, [dataStandard, dataThreshold, dataMaximum, dataZK]);

    // Update signature message when template changes
    useEffect(() => {
        const template = SIGNATURE_MESSAGE_TEMPLATES.find(t => t.id === selectedTemplate);
        if (template) {
            let message = template.template;
            // Replace placeholders with values
            if (message.includes('{amount}')) {
                message = message.replace('{amount}', amount || '0');
            }
            if (message.includes('{date}')) {
                message = message.replace('{date}', new Date().toLocaleDateString());
            }
            // Replace any custom fields
            Object.keys(customFields).forEach(key => {
                if (message.includes(`{${key}}`)) {
                    message = message.replace(`{${key}}`, customFields[key] || '');
                }
            });
            setSignatureMessage(message);
        }
    }, [selectedTemplate, amount, customFields]);

    // Get expiry timestamp based on selection
    const getExpiryTimestamp = (expiryOption) => {
        const now = Math.floor(Date.now() / 1000); // Current time in seconds

        // Find the matching option in the array
        const option = Array.isArray(EXPIRY_OPTIONS)
            ? EXPIRY_OPTIONS.find(opt => opt.id === expiryOption)
            : null;

        // Use the seconds value from the option, or default to 7 days (604800 seconds)
        return now + (option ? option.seconds : 604800);
    };

    // Handle custom field changes
    const handleCustomFieldChange = (key, value) => {
        setCustomFields(prev => ({
            ...prev,
            [key]: value
        }));
    };

    // Extract custom field placeholders from the template
    const getCustomFieldsFromTemplate = (templateId) => {
        const template = SIGNATURE_MESSAGE_TEMPLATES.find(t => t.id === templateId);
        if (!template) return [];

        const regex = /{([^{}]*)}/g;
        const matches = template.template.match(regex) || [];

        // Filter out known placeholders
        return matches
            .map(match => match.replace(/{|}/g, ''))
            .filter(key => !['amount', 'date'].includes(key));
    };

    const isPending = isPendingStandard || isPendingThreshold || isPendingMaximum || isPendingZK;
    const isError = isErrorStandard || isErrorThreshold || isErrorMaximum || isErrorZK;
    const error = errorStandard || errorThreshold || errorMaximum || errorZK;

    // Reset success state
    const handleCreateAnother = () => {
        setSuccess(false);
        setTxHash('');
    };

    // Helper function to get currency symbol based on asset summary
    const getCurrencySymbol = (summary) => {
        if (!summary || !summary.chains || Object.keys(summary.chains).length === 0) {
            return 'ETH'; // Default to ETH if no chain data
        }

        const firstChain = Object.keys(summary.chains)[0];

        if (firstChain === 'polygon') return 'MATIC';
        if (firstChain === 'solana') return 'SOL';
        return 'ETH'; // Default for ethereum or other chains
    };

    // Fix 2: Revise the proof submission flow and add state to track stages
    const [proofStage, setProofStage] = useState('input'); // 'input', 'signing', 'ready'

    // Add useEffect to reset signatures when critical proof details change
    useEffect(() => {
        // When the amount or proof details change, invalidate existing signatures
        if (Object.keys(walletSignatures).length > 0) {
            setWalletSignatures({});
            if (proofStage !== 'input') {
                setProofStage('input');
                setReadyToSubmit(false);
                setProofData(null);
            }
        }
    }, [amount, proofCategory, proofType, zkProofType, amountInputType, selectedTokens, expiryDays]);

    return (
        <div className="max-w-4xl mx-auto mt-8">
            <h1 className="text-3xl font-bold text-center mb-8">Create Proof of Funds</h1>

            <div className="bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-6">Proof Creation</h2>

                <div className="space-y-6">
                    {/* Wallet Selection Section */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Select Wallet for Proof
                        </label>

                        <div className="space-y-2">
                            {connectedWallets.length > 0 ? (
                                connectedWallets.map(wallet => (
                                    <div
                                        key={wallet.id}
                                        className={`px-4 py-2 border rounded-md flex justify-between items-center cursor-pointer
                                            ${selectedWallets.includes(wallet.id)
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                                        onClick={() => handleWalletSelection(wallet.id)}
                                    >
                                        <div className="font-medium">{wallet.name} - {wallet.address}</div>
                                        <div className="text-sm">{wallet.chain}</div>
                                    </div>
                                ))
                            ) : userInitiatedConnection ? (
                                <div className="text-sm text-gray-500 italic">
                                    No wallets connected. Please connect a wallet to create a proof.
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500 italic">
                                    Please connect a wallet to continue.
                                </div>
                            )}
                        </div>

                        {!userInitiatedConnection && (
                            <button
                                className="mt-3 py-2 px-4 text-sm font-medium rounded-md border bg-blue-600 text-white border-blue-600"
                                onClick={() => {
                                    document.getElementById('connect-wallet-button').click();
                                }}
                            >
                                Connect Wallet
                            </button>
                        )}
                    </div>

                    {/* Asset Summary Section */}
                    {selectedWallets.length > 0 && (
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center">
                                    <button
                                        onClick={() => setIsAssetSummaryExpanded(!isAssetSummaryExpanded)}
                                        className="mr-2 text-gray-500 hover:text-gray-700"
                                        aria-expanded={isAssetSummaryExpanded}
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className={`h-5 w-5 transition-transform ${isAssetSummaryExpanded ? 'transform rotate-0' : 'transform rotate-180'}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    <label className="block text-sm font-medium text-gray-700">Asset Summary</label>
                                </div>
                                <div className="flex items-center">
                                    <span className="text-xs mr-2 text-gray-500">Show USD Values</span>
                                    <button
                                        onClick={handleToggleUSDConversion}
                                        disabled={isLoadingAssets || isConvertingUSD}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full ${showUSDValues ? 'bg-blue-600' : 'bg-gray-300'}`}
                                        aria-checked={showUSDValues}
                                        role="switch"
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showUSDValues ? 'translate-x-6' : 'translate-x-1'}`}
                                        />
                                    </button>
                                </div>
                            </div>

                            {isAssetSummaryExpanded && (
                                <>
                                    {isLoadingAssets || isConvertingUSD ? (
                                        <div className="py-3 text-center text-sm text-gray-500">
                                            <svg className="animate-spin h-5 w-5 mx-auto mb-1 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Loading assets...
                                        </div>
                                    ) : assetSummary ? (
                                        <>
                                            <div className="mb-3">
                                                <div className="text-sm font-medium">Total Value: {showUSDValues
                                                    ? `$${Number(assetSummary.totalUSDValue).toFixed(2)} USD`
                                                    : 'Multiple Assets'}
                                                </div>
                                            </div>
                                            <div className="bg-gray-50 border rounded-md overflow-hidden mb-3">
                                                <div className="grid grid-cols-2 bg-gray-100 px-3 py-2">
                                                    <div className="text-sm font-medium text-gray-700">Asset</div>
                                                    <div className="text-sm font-medium text-gray-700 text-right">Balance</div>
                                                </div>
                                                {(showUSDValues ? assetSummary.convertedAssets : assetSummary.totalAssets).map((asset, idx) => (
                                                    <div key={idx} className="grid grid-cols-2 px-3 py-2 border-t border-gray-200">
                                                        <div className="text-sm text-gray-700">{asset.symbol}</div>
                                                        <div className="text-sm text-gray-700 text-right">{Number(asset.balance).toFixed(6)}</div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div>
                                                <div className="text-sm font-medium text-gray-700 mb-1">Chain Breakdown</div>
                                                {Object.entries(assetSummary.chains).map(([chain, data]) => (
                                                    <div key={chain} className="bg-gray-50 border rounded-md px-3 py-2 mb-2">
                                                        <div className="font-medium text-sm capitalize">{chain}</div>
                                                        <div className="text-xs text-gray-700">
                                                            Native: {Number(data.nativeBalance).toFixed(6)} {chain === 'polygon' ? 'MATIC' : chain === 'solana' ? 'SOL' : 'ETH'}
                                                        </div>
                                                        {Object.entries(data.tokens).length > 0 && (
                                                            <div className="text-xs text-gray-700">
                                                                Tokens: {Object.entries(data.tokens).map(([symbol, balance], i) => (
                                                                    <span key={symbol}>
                                                                        {i > 0 && ', '}
                                                                        {Number(balance).toFixed(6)} {symbol}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-sm text-gray-500 py-2">No assets found</div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Proof Category */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Proof Category
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                className={`py-2 px-4 text-sm font-medium rounded-md border ${proofCategory === 'standard'
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    }`}
                                onClick={() => setProofCategory('standard')}
                            >
                                Standard Proofs
                            </button>
                            <button
                                type="button"
                                className={`py-2 px-4 text-sm font-medium rounded-md border ${proofCategory === 'zk'
                                    ? 'bg-purple-600 text-white border-purple-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    }`}
                                onClick={() => setProofCategory('zk')}
                            >
                                Zero-Knowledge Proofs
                            </button>
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                            {proofCategory === 'standard'
                                ? 'Standard proofs verify funds while revealing the exact amount.'
                                : 'Zero-knowledge proofs allow verification without revealing the actual amount.'}
                        </p>
                    </div>

                    {/* Proof Type */}
                    {proofCategory === 'standard' ? (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Proof Type
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    className={`py-2 px-4 text-sm font-medium rounded-md border ${proofType === 'standard'
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                    onClick={() => setProofType('standard')}
                                >
                                    Standard
                                </button>
                                <button
                                    type="button"
                                    className={`py-2 px-4 text-sm font-medium rounded-md border ${proofType === 'threshold'
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                    onClick={() => setProofType('threshold')}
                                >
                                    Threshold
                                </button>
                                <button
                                    type="button"
                                    className={`py-2 px-4 text-sm font-medium rounded-md border ${proofType === 'maximum'
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                    onClick={() => setProofType('maximum')}
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Zero-Knowledge Proof Type
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    className={`py-2 px-4 text-sm font-medium rounded-md border ${zkProofType === 'standard'
                                        ? 'bg-purple-600 text-white border-purple-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                    onClick={() => setZkProofType('standard')}
                                >
                                    ZK Standard
                                </button>
                                <button
                                    type="button"
                                    className={`py-2 px-4 text-sm font-medium rounded-md border ${zkProofType === 'threshold'
                                        ? 'bg-purple-600 text-white border-purple-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                    onClick={() => setZkProofType('threshold')}
                                >
                                    ZK Threshold
                                </button>
                                <button
                                    type="button"
                                    className={`py-2 px-4 text-sm font-medium rounded-md border ${zkProofType === 'maximum'
                                        ? 'bg-purple-600 text-white border-purple-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                    onClick={() => setZkProofType('maximum')}
                                >
                                    ZK Maximum
                                </button>
                            </div>
                            <p className="mt-2 text-sm text-gray-500">
                                {zkProofType === 'standard' && 'Create a private proof of exactly this amount'}
                                {zkProofType === 'threshold' && 'Create a private proof of at least this amount'}
                                {zkProofType === 'maximum' && 'Create a private proof of less than this amount'}
                            </p>
                        </div>
                    )}

                    {/* Amount Input */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label htmlFor="amount-type" className="block text-sm font-medium text-gray-700">
                                Amount Type
                            </label>
                            <div className="flex items-center">
                                <button
                                    onClick={() => setAmountInputType('usd')}
                                    className={`mr-2 py-1 px-3 text-xs font-medium rounded-md ${amountInputType === 'usd'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    USD Value
                                </button>
                                <button
                                    onClick={() => setAmountInputType('tokens')}
                                    className={`py-1 px-3 text-xs font-medium rounded-md ${amountInputType === 'tokens'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Token Amounts
                                </button>
                            </div>
                        </div>

                        {amountInputType === 'usd' ? (
                            // USD Amount Input
                            <div className="relative">
                                <input
                                    type="number"
                                    id="amount"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
                                    placeholder="Enter USD amount"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    min="0"
                                    step="0.01"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                    <span className="text-gray-500 sm:text-sm">USD</span>
                                </div>
                            </div>
                        ) : (
                            // Token Amounts Input
                            <div className="space-y-3">
                                {assetSummary && assetSummary.convertedAssets ? (
                                    <>
                                        <div className="text-xs text-gray-500 mb-2">
                                            Select tokens and specify amounts to include in your proof
                                        </div>

                                        {/* Token selector */}
                                        <div className="bg-gray-50 p-3 rounded-md border">
                                            <div className="text-sm font-medium mb-2">Available Tokens</div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {assetSummary.convertedAssets.map((asset, idx) => (
                                                    <button
                                                        key={`${asset.chain}-${asset.symbol}-${idx}`}
                                                        onClick={() => handleTokenSelection(asset)}
                                                        className={`px-2 py-1 text-xs rounded-md border flex justify-between items-center ${selectedTokens.some(t => t.symbol === asset.symbol && t.chain === asset.chain)
                                                            ? 'bg-blue-100 border-blue-300'
                                                            : 'bg-white border-gray-200'
                                                            }`}
                                                    >
                                                        <span>{asset.symbol}</span>
                                                        <span className="text-gray-500 text-xs">{asset.chain}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Selected tokens and amounts */}
                                        {selectedTokens.length > 0 && (
                                            <div className="bg-white p-3 rounded-md border">
                                                <div className="text-sm font-medium mb-2">Selected Tokens</div>
                                                <div className="space-y-2">
                                                    {selectedTokens.map((token, idx) => (
                                                        <div key={idx} className="flex items-center space-x-2">
                                                            <input
                                                                type="number"
                                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-xs p-1 border"
                                                                placeholder={`Amount of ${token.symbol}`}
                                                                value={token.amount}
                                                                onChange={(e) => handleTokenAmountChange(token.symbol, token.chain, e.target.value)}
                                                                min="0"
                                                                step="0.000001"
                                                            />
                                                            <div className="text-sm whitespace-nowrap">{token.symbol} ({token.chain})</div>
                                                            <button
                                                                onClick={() => handleTokenSelection(token)}
                                                                className="text-red-500 hover:text-red-700"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="text-right text-sm font-medium mt-2">
                                                    Approx. USD Value: ${calculateTotalUsdValue().toFixed(2)}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-sm text-gray-500 italic">
                                        Connect wallets and load assets to select tokens
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Expiration */}
                    <div>
                        <label htmlFor="expiry" className="block text-sm font-medium text-gray-700 mb-1">
                            Proof Expiration
                        </label>
                        <select
                            id="expiry"
                            value={expiryDays}
                            onChange={(e) => setExpiryDays(e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
                        >
                            {Array.isArray(EXPIRY_OPTIONS) ?
                                EXPIRY_OPTIONS.map(option => (
                                    <option key={option.id} value={option.id}>
                                        {option.label}
                                    </option>
                                ))
                                :
                                // Fallback options if EXPIRY_OPTIONS is not an array
                                [
                                    { id: 'one_day', label: '1 Day' },
                                    { id: 'seven_days', label: '7 Days' },
                                    { id: 'thirty_days', label: '30 Days' },
                                    { id: 'ninety_days', label: '90 Days' }
                                ].map(option => (
                                    <option key={option.id} value={option.id}>
                                        {option.label}
                                    </option>
                                ))
                            }
                        </select>
                    </div>

                    {/* Wallet Signatures */}
                    {proofStage === 'signing' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Sign with Your Wallets
                            </label>

                            <div className="space-y-3 mb-4">
                                {selectedWallets.length > 0 ? (
                                    <div className="border rounded-md divide-y">
                                        {selectedWallets.map(walletId => {
                                            const wallet = connectedWallets.find(w => w.id === walletId);
                                            const isSigned = !!walletSignatures[walletId];
                                            const isCurrentSigning = currentSigningWallet === walletId && isSigningWallet;

                                            return (
                                                <div key={walletId} className="p-3 flex items-center justify-between">
                                                    <div className="flex flex-col">
                                                        <div className="font-medium">{wallet?.name || 'Wallet'}</div>
                                                        <div className="text-xs text-gray-500">{wallet?.address || wallet?.fullAddress}</div>
                                                        <div className="text-xs text-gray-500">{wallet?.chain}</div>
                                                    </div>

                                                    <div className="flex items-center space-x-2">
                                                        {isSigned ? (
                                                            <div className="flex items-center text-green-600">
                                                                <svg className="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                </svg>
                                                                <span className="text-xs">Signed</span>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSignWallet(walletId)}
                                                                disabled={isSigningWallet}
                                                                className={`py-1 px-3 text-xs font-medium rounded-md border ${isCurrentSigning
                                                                    ? 'bg-gray-100 text-gray-400 cursor-wait'
                                                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                                                    }`}
                                                            >
                                                                {isCurrentSigning ? 'Signing...' : 'Sign with Wallet'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-500 italic">
                                        Please select at least one wallet to sign
                                    </div>
                                )}
                            </div>

                            {/* Signature status summary */}
                            {selectedWallets.length > 0 && (
                                <div className="text-sm mb-2">
                                    {areAllWalletsSigned() ? (
                                        <div className="text-green-600">
                                            ✓ All wallets signed successfully
                                        </div>
                                    ) : (
                                        <div className="text-gray-600">
                                            {Object.keys(walletSignatures).length} of {selectedWallets.length} wallets signed
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Submit Button */}
                    <div>
                        <button
                            type="button"
                            onClick={
                                proofStage === 'input'
                                    ? handleSubmit
                                    : proofStage === 'ready'
                                        ? submitFinalProof
                                        : null // No action in signing stage, just display status
                            }
                            disabled={
                                isPending ||
                                (selectedWallets.length === 0) ||
                                (amountInputType === 'usd' && !amount) ||
                                (amountInputType === 'tokens' && selectedTokens.length === 0) ||
                                (proofStage === 'signing' && !areAllWalletsSigned())
                            }
                            className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${isPending ||
                                (selectedWallets.length === 0) ||
                                (amountInputType === 'usd' && !amount) ||
                                (amountInputType === 'tokens' && selectedTokens.length === 0) ||
                                (proofStage === 'signing' && !areAllWalletsSigned())
                                ? 'bg-gray-400 cursor-not-allowed'
                                : proofStage === 'ready'
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : proofCategory === 'standard'
                                        ? 'bg-blue-600 hover:bg-blue-700'
                                        : 'bg-purple-600 hover:bg-purple-700'
                                }`}
                        >
                            {isPending
                                ? 'Processing...'
                                : proofStage === 'input'
                                    ? 'Prepare Proof'
                                    : proofStage === 'signing'
                                        ? `Sign Wallets (${Object.keys(walletSignatures).length}/${selectedWallets.length})`
                                        : 'Submit Proof to Blockchain'}
                        </button>
                    </div>

                    {isError && (
                        <div className="p-4 bg-red-50 rounded-md">
                            <p className="text-sm font-medium text-red-800">
                                Error: {error?.message || 'Failed to create proof'}
                            </p>
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div className="p-4 bg-green-50 rounded-md">
                            <div className="flex items-center text-green-800 font-medium mb-2">
                                <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Proof of Funds created successfully!
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                                Your proof has been submitted to the blockchain and can now be verified.
                            </p>
                            <div className="flex flex-wrap items-center text-sm">
                                <span className="text-gray-600 mr-1">Transaction:</span>
                                <a
                                    href={`https://amoy.polygonscan.com/tx/${txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 break-all hover:underline"
                                >
                                    {txHash}
                                </a>
                            </div>
                            <button
                                onClick={handleCreateAnother}
                                className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                                Create Another Proof
                            </button>
                        </div>
                    )}
                </div>

                {/* Information Section */}
                <div className="mt-12 border-t pt-6">
                    <h2 className="text-xl font-semibold mb-4">About Proof Creation</h2>
                    <p className="text-gray-600 mb-4">
                        This tool allows you to create a verifiable proof of funds on the Polygon blockchain
                        without revealing your private information. You can choose between standard proofs that reveal the exact amount
                        or zero-knowledge proofs that verify funds without revealing specific amounts.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <h3 className="font-medium text-blue-800 mb-2">Standard Proof</h3>
                            <p className="text-sm text-gray-600">Creates a proof that you have exactly the specified amount. Used for specific commitments or agreements.</p>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <h3 className="font-medium text-blue-800 mb-2">Threshold Proof</h3>
                            <p className="text-sm text-gray-600">Creates a proof that you have at least the specified amount. Ideal for qualification requirements.</p>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <h3 className="font-medium text-blue-800 mb-2">Maximum Proof</h3>
                            <p className="text-sm text-gray-600">Creates a proof that you have less than the specified amount. Useful for certain compliance requirements.</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                            <h3 className="font-medium text-purple-800 mb-2">Zero-Knowledge Proofs</h3>
                            <p className="text-sm text-gray-600">Private proofs that validate funds without revealing actual amounts to the blockchain.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 