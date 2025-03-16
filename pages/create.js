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

    const { address, isConnected } = useAccount();

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

    // Extract custom field placeholders from the template
    const getCustomFieldsFromTemplate = (templateId) => {
        const template = SIGNATURE_MESSAGE_TEMPLATES.find(t => t.id === templateId);
        if (!template) return [];

        const regex = /{([^{}]*)}/g;
        const matches = template.template.match(regex) || [];

        return matches
            .map(match => match.replace(/{|}/g, ''))
            .filter(field => !['amount', 'date'].includes(field));
    };

    // Contract write hook for standard proof
    const { write: writeStandardProof, isPending: isPendingStandard, isError: isErrorStandard, error: errorStandard, data: dataStandard } = useContractWrite({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'submitProof',
    });

    // Contract write hook for threshold proof
    const { write: writeThresholdProof, isPending: isPendingThreshold, isError: isErrorThreshold, error: errorThreshold, data: dataThreshold } = useContractWrite({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'submitThresholdProof',
    });

    // Contract write hook for maximum proof
    const { write: writeMaximumProof, isPending: isPendingMaximum, isError: isErrorMaximum, error: errorMaximum, data: dataMaximum } = useContractWrite({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'submitMaximumProof',
    });

    // Contract write hook for ZK proofs
    const { write: writeZKProof, isPending: isPendingZK, isError: isErrorZK, error: errorZK, data: dataZK } = useContractWrite({
        address: ZK_VERIFIER_ADDRESS,
        abi: [
            {
                "inputs": [
                    { "internalType": "bytes", "name": "_proof", "type": "bytes" },
                    { "internalType": "bytes", "name": "_publicSignals", "type": "bytes" },
                    { "internalType": "uint256", "name": "_expiryTime", "type": "uint256" },
                    { "internalType": "enum ZKVerifier.ZKProofType", "name": "_proofType", "type": "uint8" },
                    { "internalType": "string", "name": "_signatureMessage", "type": "string" },
                    { "internalType": "bytes", "name": "_signature", "type": "bytes" }
                ],
                "name": "submitZKProof",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ],
        functionName: 'submitZKProof',
    });

    // Handle template change
    const handleTemplateChange = (e) => {
        const templateId = e.target.value;
        setSelectedTemplate(templateId);
        // Reset custom fields when template changes
        setCustomFields({});
    };

    // Update custom field value
    const updateCustomField = (field, value) => {
        setCustomFields(prev => ({ ...prev, [field]: value }));
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isConnected) return;

        const expiryTime = EXPIRY_OPTIONS[expiryDays] || EXPIRY_OPTIONS.SEVEN_DAYS;

        try {
            if (proofCategory === 'standard') {
                // Standard (non-ZK) proofs
                if (proofType === 'standard') {
                    writeStandardProof({
                        args: [ethers.utils.parseEther(amount), expiryTime, signatureMessage],
                    });
                } else if (proofType === 'threshold') {
                    writeThresholdProof({
                        args: [ethers.utils.parseEther(amount), expiryTime, signatureMessage],
                    });
                } else if (proofType === 'maximum') {
                    writeMaximumProof({
                        args: [ethers.utils.parseEther(amount), expiryTime, signatureMessage],
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
                    [[ethers.utils.parseEther(amount).toString()]]
                );

                let zkProofTypeValue;
                if (zkProofType === 'standard') zkProofTypeValue = ZK_PROOF_TYPES.STANDARD;
                else if (zkProofType === 'threshold') zkProofTypeValue = ZK_PROOF_TYPES.THRESHOLD;
                else if (zkProofType === 'maximum') zkProofTypeValue = ZK_PROOF_TYPES.MAXIMUM;

                writeZKProof({
                    args: [
                        mockProof,
                        mockPublicSignals,
                        expiryTime,
                        zkProofTypeValue,
                        signatureMessage,
                        ethers.utils.toUtf8Bytes("mock-signature") // In a real app, this would be a real signature
                    ],
                });
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

    const isPending = isPendingStandard || isPendingThreshold || isPendingMaximum || isPendingZK;
    const isError = isErrorStandard || isErrorThreshold || isErrorMaximum || isErrorZK;
    const error = errorStandard || errorThreshold || errorMaximum || errorZK;

    return (
        <div className="max-w-4xl mx-auto mt-8">
            <h1 className="text-3xl font-bold text-center mb-8">Create Proof of Funds</h1>

            {!isConnected ? (
                <div className="bg-white p-8 rounded-lg shadow-md text-center">
                    <h2 className="text-xl font-medium mb-4">Connect Your Wallet</h2>
                    <p className="text-gray-600 mb-6">Please connect your wallet to create a proof of funds.</p>
                </div>
            ) : (
                <div className="bg-white p-8 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-6">Proof Creation Form</h2>

                    <div className="space-y-6">
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
                                onChange={handleTemplateChange}
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
                                        onChange={(e) => updateCustomField(field, e.target.value)}
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

                        {/* Success Message */}
                        {success && (
                            <div className="rounded-md bg-green-50 p-4 mt-4">
                                <div className="flex">
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-green-800">Proof Created Successfully</h3>
                                        <div className="mt-2 text-sm text-green-700">
                                            <p>Your proof has been created on the Polygon blockchain.</p>
                                            {txHash && (
                                                <p className="mt-1">
                                                    Transaction Hash: <a href={`https://amoy.polygonscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="font-medium underline">{txHash.substring(0, 10)}...{txHash.substring(txHash.length - 8)}</a>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Information Section */}
                    <div className="mt-12 border-t pt-6">
                        <h2 className="text-xl font-semibold mb-4">About Proof of Funds</h2>
                        <p className="text-gray-600 mb-4">
                            Creating a proof of funds allows you to cryptographically verify ownership of assets on the Polygon blockchain
                            without revealing your private information.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <h3 className="font-medium text-blue-800 mb-2">Standard Proof</h3>
                                <p className="text-sm text-gray-600">Proves that you own exactly the specified amount. Useful for specific commitments.</p>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <h3 className="font-medium text-blue-800 mb-2">Threshold Proof</h3>
                                <p className="text-sm text-gray-600">Proves that you own at least the specified amount. Useful for qualification requirements.</p>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <h3 className="font-medium text-blue-800 mb-2">Maximum Proof</h3>
                                <p className="text-sm text-gray-600">Proves that you own less than the specified amount. Useful for certain compliance requirements.</p>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-lg">
                                <h3 className="font-medium text-purple-800 mb-2">Zero-Knowledge Proofs</h3>
                                <p className="text-sm text-gray-600">Private proofs that validate your funds without revealing actual amounts to the blockchain.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 