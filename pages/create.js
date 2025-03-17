import { useState, useEffect } from 'react';
import { useAccount, useContractWrite } from 'wagmi';
import { ethers } from 'ethers';
import { PROOF_TYPES, ZK_PROOF_TYPES, ZK_VERIFIER_ADDRESS, SIGNATURE_MESSAGE_TEMPLATES, EXPIRY_OPTIONS } from '../config/constants';

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
    const [selectedWallet, setSelectedWallet] = useState(null);
    const [connectedWallets, setConnectedWallets] = useState([]);

    const { address, isConnected } = useAccount();

    // Format address for display
    const formatAddress = (address) => {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    // Track connected wallets
    useEffect(() => {
        const updateWalletList = async () => {
            const wallets = [];

            // Check MetaMask
            if (typeof window !== 'undefined' && window.ethereum && window.ethereum.isMetaMask && window.ethereum.request) {
                try {
                    // Get all MetaMask accounts that have explicitly granted permission
                    const accounts = await window.ethereum.request({ method: 'eth_accounts' });

                    if (accounts && accounts.length > 0) {
                        // Add each account as a separate wallet
                        accounts.forEach(account => {
                            wallets.push({
                                id: `metamask-${account.substring(2, 10)}`,
                                name: 'MetaMask',
                                address: formatAddress(account),
                                fullAddress: account,
                                chain: 'Polygon',
                                type: 'evm'
                            });
                        });
                    }
                } catch (error) {
                    console.error('Error checking MetaMask accounts:', error);
                }
            }

            // Check Phantom
            if (typeof window !== 'undefined' && window.solana && window.solana.isConnected) {
                const phantomAddress = window.solana.publicKey?.toString();
                if (phantomAddress) {
                    wallets.push({
                        id: `phantom-${phantomAddress.substring(0, 8)}`,
                        name: 'Phantom',
                        address: formatAddress(phantomAddress),
                        fullAddress: phantomAddress,
                        chain: 'Solana',
                        type: 'solana'
                    });
                }
            }

            setConnectedWallets(wallets);

            // Update selected wallet if needed
            if (selectedWallet && !wallets.find(w => w.id === selectedWallet)) {
                // If previously selected wallet is no longer connected, clear the selection
                setSelectedWallet(null);
            } else if (wallets.length > 0 && !selectedWallet) {
                // If there's at least one wallet and nothing selected, select the first one
                setSelectedWallet(wallets[0].id);
            }
        };

        updateWalletList();
    }, [isConnected, address, selectedWallet]);

    // Set up listener for MetaMask account changes
    useEffect(() => {
        const handleAccountsChanged = async (accounts) => {
            // This will trigger the wallet tracking effect that rebuilds the wallet list
            if (accounts.length === 0) {
                // User disconnected all accounts
                setSelectedWallet(null);
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

    // Handle proof submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedWallet) return;

        try {
            const wallet = connectedWallets.find(w => w.id === selectedWallet);
            if (!wallet) {
                throw new Error('Selected wallet not found');
            }

            const amountInWei = ethers.utils.parseEther(amount || '0');
            const expiryTime = getExpiryTimestamp(expiryDays);

            if (wallet.type === 'evm') {
                // Check if we need to switch to this MetaMask account
                if (!address || wallet.fullAddress.toLowerCase() !== address.toLowerCase()) {
                    try {
                        // Show the account selector UI to let the user switch accounts
                        await window.ethereum.request({
                            method: 'wallet_requestPermissions',
                            params: [{ eth_accounts: {} }]
                        });

                        // Get the currently selected account after user interaction
                        const accounts = await window.ethereum.request({
                            method: 'eth_requestAccounts'
                        });

                        // Verify if the user selected the correct account
                        if (!accounts.some(acc => acc.toLowerCase() === wallet.fullAddress.toLowerCase())) {
                            throw new Error('Please select the wallet you want to use for creating this proof');
                        }

                        // Switch to the correct chain if needed
                        await window.ethereum.request({
                            method: 'wallet_switchEthereumChain',
                            params: [{ chainId: '0x13882' }], // Polygon Amoy testnet (80002 in decimal)
                        });
                    } catch (switchError) {
                        // Handle errors from chain or account switch
                        throw new Error(`Error switching to the selected wallet: ${switchError.message}`);
                    }
                }

                // Submit Ethereum proof
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
                    // Zero-knowledge proofs
                    // In a real implementation, this would generate a ZK proof first
                    // For now, we'll mock the proof and public signals
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

                    const mockSignature = ethers.utils.toUtf8Bytes("mock-signature"); // In a real app, this would be a real signature

                    writeZKProof({
                        args: [
                            mockProof,
                            mockPublicSignals,
                            expiryTime,
                            zkProofTypeValue,
                            signatureMessage,
                            mockSignature
                        ],
                    });
                }
            } else if (wallet.type === 'solana') {
                // Handle Solana wallet differently
                if (!window.solana || !window.solana.isConnected) {
                    throw new Error('Phantom wallet not connected');
                }

                // Make sure we're using the right Phantom account
                if (window.solana.publicKey?.toString() !== wallet.fullAddress) {
                    throw new Error('Please select the correct account in the Phantom wallet');
                }

                // For now, just sign a message since we're mocking the Solana proof creation
                const encodedMessage = new TextEncoder().encode(signatureMessage);
                const signature = await window.solana.signMessage(encodedMessage, 'utf8');

                console.log('Solana proof created with signature:', signature);

                // Mock successful transaction for UI feedback
                setTxHash('solana-' + Date.now().toString(16));
                setSuccess(true);
            }
        } catch (error) {
            console.error('Error submitting proof:', error);
        }
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
        const option = EXPIRY_OPTIONS.find(opt => opt.id === expiryOption);
        return now + (option ? option.seconds : 604800); // Default to 7 days
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

    return (
        <div className="max-w-4xl mx-auto mt-8 px-4">
            <h1 className="text-3xl font-bold text-center mb-8">Create Proof of Funds</h1>

            {success ? (
                <div className="bg-white p-8 rounded-lg shadow-md">
                    <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-semibold mt-4">Proof Created Successfully!</h2>
                        <p className="text-gray-600 mt-2">
                            Your proof of funds has been created and is now verifiable.
                        </p>

                        <div className="mt-6 border-t border-b border-gray-200 py-4">
                            <h3 className="text-lg font-medium mb-2">Transaction Details</h3>
                            <div className="flex items-center justify-center">
                                <span className="text-gray-500 text-sm font-mono break-all">
                                    {txHash}
                                </span>
                                <button
                                    onClick={() => {
                                        const selectedWalletObj = connectedWallets.find(w => w.id === selectedWallet);
                                        const network = selectedWalletObj?.type === 'solana' ? 'solana' : 'polygon';
                                        let url = '';
                                        if (network === 'solana') {
                                            url = `https://explorer.solana.com/tx/${txHash}?cluster=devnet`;
                                        } else {
                                            url = `https://amoy.polygonscan.com/tx/${txHash}`;
                                        }
                                        window.open(url, '_blank');
                                    }}
                                    className="ml-2 text-blue-600 hover:text-blue-800"
                                >
                                    View
                                </button>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-center space-x-4">
                            <button
                                onClick={handleCreateAnother}
                                className="btn btn-primary"
                            >
                                Create Another Proof
                            </button>
                            <button
                                onClick={() => window.location.href = '/verify'}
                                className="btn btn-secondary"
                            >
                                Verify Proof
                            </button>
                        </div>
                    </div>
                </div>
            ) : connectedWallets.length === 0 ? (
                <div className="bg-white p-8 rounded-lg shadow-md text-center">
                    <h2 className="text-xl font-medium mb-4">Connect Your Wallet</h2>
                    <p className="text-gray-600 mb-6">Please connect your wallet to create a proof of funds.</p>
                </div>
            ) : (
                <div className="bg-white p-8 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-6">Proof Creation Form</h2>

                    <div className="space-y-6">
                        {/* Wallet Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Select Wallet for Proof
                            </label>
                            <div className="grid grid-cols-1 gap-3">
                                {connectedWallets.map(wallet => (
                                    <button
                                        key={wallet.id}
                                        type="button"
                                        onClick={() => setSelectedWallet(wallet.id)}
                                        className={`py-2 px-4 text-sm font-medium rounded-md border flex justify-between items-center ${selectedWallet === wallet.id
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center">
                                            <span>{wallet.name} - {wallet.address}</span>
                                        </div>
                                        <span className="text-xs opacity-75">{wallet.chain}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Proof Category Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Proof Category
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProofCategory('standard');
                                        setProofType('standard');
                                    }}
                                    className={`py-2 px-4 text-sm font-medium rounded-md border ${proofCategory === 'standard'
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    Standard Proofs
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProofCategory('zk');
                                        setZkProofType('standard');
                                    }}
                                    className={`py-2 px-4 text-sm font-medium rounded-md border ${proofCategory === 'zk'
                                        ? 'bg-purple-600 text-white border-purple-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    Zero-Knowledge Proofs
                                </button>
                            </div>
                            <p className="mt-2 text-sm text-gray-500">
                                {proofCategory === 'standard'
                                    ? 'Standard proofs verify your funds while revealing the exact amount.'
                                    : 'Zero-knowledge proofs allow verification without revealing the actual amount.'}
                            </p>
                        </div>

                        {/* Proof Type Selection */}
                        {proofCategory === 'standard' ? (
                            <div>
                                <label htmlFor="proof-type" className="block text-sm font-medium text-gray-700 mb-1">
                                    Proof Type
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setProofType('standard')}
                                        className={`py-2 px-4 text-sm font-medium rounded-md border ${proofType === 'standard'
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        Standard
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProofType('threshold')}
                                        className={`py-2 px-4 text-sm font-medium rounded-md border ${proofType === 'threshold'
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        Threshold
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProofType('maximum')}
                                        className={`py-2 px-4 text-sm font-medium rounded-md border ${proofType === 'maximum'
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        Maximum
                                    </button>
                                </div>
                                <p className="mt-2 text-sm text-gray-500">
                                    {proofType === 'standard' && 'Prove that your wallet has exactly this amount'}
                                    {proofType === 'threshold' && 'Prove that your wallet has at least this amount'}
                                    {proofType === 'maximum' && 'Prove that your wallet has less than this amount'}
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
                                        onClick={() => setZkProofType('standard')}
                                        className={`py-2 px-4 text-sm font-medium rounded-md border ${zkProofType === 'standard'
                                            ? 'bg-purple-600 text-white border-purple-600'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        ZK Standard
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setZkProofType('threshold')}
                                        className={`py-2 px-4 text-sm font-medium rounded-md border ${zkProofType === 'threshold'
                                            ? 'bg-purple-600 text-white border-purple-600'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        ZK Threshold
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setZkProofType('maximum')}
                                        className={`py-2 px-4 text-sm font-medium rounded-md border ${zkProofType === 'maximum'
                                            ? 'bg-purple-600 text-white border-purple-600'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        ZK Maximum
                                    </button>
                                </div>
                                <p className="mt-2 text-sm text-gray-500">
                                    {zkProofType === 'standard' && 'Privately prove that your wallet has exactly this amount'}
                                    {zkProofType === 'threshold' && 'Privately prove that your wallet has at least this amount'}
                                    {zkProofType === 'maximum' && 'Privately prove that your wallet has less than this amount'}
                                </p>
                            </div>
                        )}

                        {/* Amount Input */}
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

                        {/* Expiry Time Selection */}
                        <div>
                            <label htmlFor="expiry" className="block text-sm font-medium text-gray-700 mb-1">
                                Proof Expiration
                            </label>
                            <select
                                id="expiry"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
                                value={expiryDays}
                                onChange={(e) => setExpiryDays(e.target.value)}
                            >
                                <option value="one_day">1 Day</option>
                                <option value="seven_days">7 Days</option>
                                <option value="thirty_days">30 Days</option>
                                <option value="ninety_days">90 Days</option>
                            </select>
                        </div>

                        {/* Signature Message */}
                        <div>
                            <label htmlFor="signature-template" className="block text-sm font-medium text-gray-700 mb-1">
                                Signature Template
                            </label>
                            <select
                                id="signature-template"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border mb-2"
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                            >
                                {SIGNATURE_MESSAGE_TEMPLATES.map(template => (
                                    <option key={template.id} value={template.id}>
                                        {template.name}
                                    </option>
                                ))}
                            </select>

                            {/* Custom Fields */}
                            {getCustomFieldsFromTemplate(selectedTemplate).map(field => (
                                <div key={field} className="mb-2">
                                    <label htmlFor={`field-${field}`} className="block text-sm font-medium text-gray-700 mb-1">
                                        {field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </label>
                                    <input
                                        type="text"
                                        id={`field-${field}`}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
                                        value={customFields[field] || ''}
                                        onChange={(e) => handleCustomFieldChange(field, e.target.value)}
                                    />
                                </div>
                            ))}

                            <label htmlFor="signature-message" className="block text-sm font-medium text-gray-700 mb-1">
                                Signature Message (Purpose)
                            </label>
                            <textarea
                                id="signature-message"
                                value={signatureMessage}
                                onChange={(e) => setSignatureMessage(e.target.value)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border h-20"
                                placeholder="Enter a message describing the purpose of this proof..."
                            ></textarea>
                            <p className="mt-1 text-xs text-gray-500">
                                Include a purpose for this proof to prevent reuse in other contexts.
                            </p>
                        </div>

                        {/* KYC Option */}
                        <div className="flex items-center">
                            <input
                                id="use-kyc"
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                checked={useKYC}
                                onChange={(e) => setUseKYC(e.target.checked)}
                            />
                            <label htmlFor="use-kyc" className="ml-2 block text-sm text-gray-700">
                                Link verified identity (KYC) to this proof
                            </label>
                        </div>

                        {/* Submit Button */}
                        <div>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!amount || isPending}
                                className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${!amount || isPending
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : proofCategory === 'standard'
                                        ? 'bg-blue-600 hover:bg-blue-700'
                                        : 'bg-purple-600 hover:bg-purple-700'
                                    }`}
                            >
                                {isPending ? 'Creating Proof...' : 'Create Proof'}
                            </button>
                        </div>

                        {/* Error Message */}
                        {isError && (
                            <div className="rounded-md bg-red-50 p-4 mt-4">
                                <div className="flex">
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800">Error creating proof</h3>
                                        <div className="mt-2 text-sm text-red-700">
                                            <p>{error?.message || 'There was an error creating your proof.'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
} 