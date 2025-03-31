/**
 * Proof of Funds Creator Page
 * 
 * A page that allows users to create cryptographic proofs of their fund ownership
 * without revealing the exact amounts. This component handles the entire proof creation
 * flow from wallet connection to blockchain transaction submission.
 * 
 * Key Features:
 * - Support for multiple blockchain networks (Ethereum, Polygon, Solana)
 * - Various proof types (standard, threshold, maximum, zero-knowledge)
 * - Multi-wallet support and asset scanning across chains
 * - Signature generation and blockchain transaction submission
 * - Responsive UI with step-by-step creation flow
 * 
 * Technical Implementation:
 * - Integration with wallets (MetaMask, Phantom) using wagmi library and ethers.js
 * - Smart contract interaction for proof submission on Polygon Amoy testnet
 * - Optimistic UI updates with loading and error states
 * - Dynamic form validation based on selected proof type
 * - Local storage for persisting wallet connections
 * 
 * Smart Contract Integration:
 * - Connects to the ProofOfFunds contract on Polygon Amoy testnet
 * - Calls the submitProof() function to store proofs on-chain
 * - Generates cryptographic hashes based on user inputs
 * 
 * Related Files:
 * - components/ConnectWallet.js: Wallet connection component
 * - lib/walletHelpers.js: Utility functions for wallet interactions
 * - lib/ethersUtils.js: Ethereum-specific utilities
 * - smart-contracts/contracts/ProofOfFunds.sol: Smart contract implementation
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useContractWrite, useContractRead, useAccount, usePrepareContractSend } from 'wagmi';
import { parseEther } from 'viem';
import Head from 'next/head';
import Link from 'next/link';
import { useMemo } from 'react';
import ConnectWallet from '../components/ConnectWallet';
import { getConnectedWallets } from '../lib/walletHelpers';
import { getChainForWallet, getWalletBalance, calculateUsdValue } from '../lib/assetHelpers';
import { PROOF_OF_FUNDS_ABI, PROOF_OF_FUNDS_ADDRESS, PROOF_TYPES, EXPIRY_OPTIONS, SIGNATURE_MESSAGES } from '../config/constants';

export default function Create() {
    const router = useRouter();

    // State for the proof creation form
    const [step, setStep] = useState(1); // 1: Connect wallet, 2: Select details, 3: Review, 4: Success
    const [wallets, setWallets] = useState([]);
    const [selectedWallet, setSelectedWallet] = useState(null);
    const [selectedChain, setSelectedChain] = useState(null);
    const [proofType, setProofType] = useState(PROOF_TYPES.STANDARD);
    const [amount, setAmount] = useState('');
    const [expiryOption, setExpiryOption] = useState('one_week');
    const [maxAmount, setMaxAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [transactionHash, setTransactionHash] = useState('');
    const [assetScanComplete, setAssetScanComplete] = useState(false);
    const [walletBalances, setWalletBalances] = useState({});
    const [userInitiatedConnection, setUserInitiatedConnection] = useState(false);

    /**
     * Fetches wallet balance data for connected wallets
     * Triggers whenever wallets change or a wallet is selected
     */
    useEffect(() => {
        // Function to fetch wallet balances
        const fetchWalletBalances = async () => {
            if (!wallets || wallets.length === 0) return;

            setAssetScanComplete(false);
            const balances = {};

            for (const wallet of wallets) {
                try {
                    // Get chain for this wallet
                    const chain = getChainForWallet(wallet.type);

                    // Get balance from the chain
                    const balance = await getWalletBalance(wallet.address, chain);

                    // Calculate USD value
                    const usdValue = await calculateUsdValue(balance, chain);

                    balances[wallet.id] = {
                        balance,
                        usdValue,
                        chain
                    };
                } catch (error) {
                    console.error(`Error fetching balance for wallet ${wallet.address}:`, error);
                    balances[wallet.id] = {
                        balance: '0',
                        usdValue: 0,
                        chain: 'unknown',
                        error: error.message
                    };
                }
            }

            setWalletBalances(balances);
            setAssetScanComplete(true);
        };

        if (wallets.length > 0 && userInitiatedConnection) {
            fetchWalletBalances();
        }
    }, [wallets, userInitiatedConnection, selectedWallet]);

    /**
     * Monitors localStorage for wallet connection changes from other components
     * Updates connected wallets list when changes are detected
     */
    useEffect(() => {
        // Update wallet list from localStorage
        const updateWalletList = () => {
            const connectedWallets = getConnectedWallets();
            setWallets(connectedWallets);

            // Check if user initiated connection is true in localStorage
            const userInitiated = localStorage.getItem('userInitiatedConnection') === 'true';
            setUserInitiatedConnection(userInitiated);

            // If wallets were connected but none selected yet, select the first one
            if (connectedWallets.length > 0 && !selectedWallet) {
                setSelectedWallet(connectedWallets[0]);
            }
        };

        // Initial load
        updateWalletList();

        // Set up event listener for wallet changes
        const handleWalletChange = () => {
            console.log('Wallet connection changed event received in Create.js');
            updateWalletList();
        };

        window.addEventListener('wallet-connection-changed', handleWalletChange);

        // Set up localStorage change listener
        const handleStorageChange = (e) => {
            if (e.key === 'walletData' || e.key === 'userInitiatedConnection') {
                updateWalletList();
            }
        };

        window.addEventListener('storage', handleStorageChange);

        // Listen for the custom localStorage-changed event
        const handleLocalChange = (e) => {
            if (e.detail && (e.detail.key === 'walletData' || e.detail.key === 'userInitiatedConnection')) {
                updateWalletList();
            }
        };

        window.addEventListener('localStorage-changed', handleLocalChange);

        return () => {
            window.removeEventListener('wallet-connection-changed', handleWalletChange);
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('localStorage-changed', handleLocalChange);
        };
    }, [selectedWallet]);

    /**
     * Calculates expiry time based on selected option
     * @returns {number} Unix timestamp for proof expiration
     */
    const calculateExpiryTime = () => {
        const now = Math.floor(Date.now() / 1000); // Current time in seconds

        switch (expiryOption) {
            case 'one_day':
                return now + 86400; // 1 day in seconds
            case 'one_week':
                return now + 604800; // 1 week in seconds
            case 'one_month':
                return now + 2592000; // 30 days in seconds
            case 'three_months':
                return now + 7776000; // 90 days in seconds
            case 'six_months':
                return now + 15552000; // 180 days in seconds
            case 'one_year':
                return now + 31536000; // 365 days in seconds
            default:
                return now + 604800; // Default to 1 week
        }
    };

    /**
     * Handles the proof generation process
     * Creates a signature and submits transaction to the blockchain
     */
    const generateProof = async () => {
        if (!selectedWallet || !amount) {
            setError('Please complete all required fields');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // First, import ethers dynamically
            const { getEthers, parseAmount } = await import('../lib/ethersUtils');
            const ethers = await getEthers();

            // Get the wallet and the signer
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();

            // Get the selected wallet's address
            const walletAddress = selectedWallet.address;

            // Calculate expiry time
            const expiryTime = calculateExpiryTime();

            // Create the contract instance
            const contract = new ethers.Contract(
                PROOF_OF_FUNDS_ADDRESS,
                PROOF_OF_FUNDS_ABI,
                signer
            );

            // Generate the signature message based on proof type
            let signatureMessage = '';
            let proofHash = '';

            // Parse the amount to handle decimal values
            const parsedAmount = parseAmount(amount, 18); // Assuming ETH with 18 decimals for now

            if (proofType === PROOF_TYPES.STANDARD) {
                signatureMessage = SIGNATURE_MESSAGES.STANDARD.replace('{amount}', amount);
                proofHash = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ['address', 'uint256', 'uint8'],
                        [walletAddress, parsedAmount, PROOF_TYPES.STANDARD]
                    )
                );
            } else if (proofType === PROOF_TYPES.THRESHOLD) {
                signatureMessage = SIGNATURE_MESSAGES.THRESHOLD.replace('{amount}', amount);
                proofHash = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ['address', 'uint256', 'uint8'],
                        [walletAddress, parsedAmount, PROOF_TYPES.THRESHOLD]
                    )
                );
            } else if (proofType === PROOF_TYPES.MAXIMUM) {
                // For maximum type, use the maxAmount
                signatureMessage = SIGNATURE_MESSAGES.MAXIMUM.replace('{amount}', maxAmount);
                proofHash = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ['address', 'uint256', 'uint8'],
                        [walletAddress, parseAmount(maxAmount, 18), PROOF_TYPES.MAXIMUM]
                    )
                );
            } else if (proofType === PROOF_TYPES.ZK) {
                signatureMessage = SIGNATURE_MESSAGES.ZK;
                // ZK proof would handle this differently
            }

            // Submit the proof to the contract
            console.log('Submitting proof to contract:', {
                proofType,
                proofHash,
                expiryTime,
                signatureMessage
            });

            let tx;
            if (proofType === PROOF_TYPES.ZK) {
                // Handle ZK proof submission differently
                setError('ZK proofs are not yet implemented');
                setLoading(false);
                return;
            } else {
                // Standard, Threshold, or Maximum proof
                tx = await contract.submitProof(
                    proofType,
                    proofHash,
                    expiryTime,
                    signatureMessage
                );
            }

            console.log('Transaction submitted:', tx);
            setTransactionHash(tx.hash);

            // Wait for transaction to be mined
            const receipt = await tx.wait();
            console.log('Transaction mined:', receipt);

            setSuccess(true);
            setStep(4); // Move to success step
        } catch (err) {
            console.error('Error generating proof:', err);
            setError(err.message || 'Failed to generate proof. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // ... Rest of the component rendering ...
} 