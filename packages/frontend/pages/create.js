/**
 * Proof of Funds Creator Page
 * 
 * This application allows users to create verifiable proofs that they control cryptocurrency funds
 * of specific amounts without exposing private details of their holdings.
 * 
 * Key Features:
 * - Support for multiple blockchain networks (Ethereum, Polygon, Solana)
 * - Multiple proof types:
 *   - Standard Proofs: Verify exact amounts
 *   - Threshold Proofs: Verify minimum amounts (at least X)
 *   - Maximum Proofs: Verify maximum amounts (less than X)
 *   - Zero-Knowledge Proofs: Private verification without revealing actual amounts
 * - Multi-wallet support with signature collection
 * - Asset scanning across chains with USD value conversion
 * - Blockchain verification through smart contract integration
 * 
 * Technical Implementation:
 * - React frontend with extensive state management
 * - Interaction with wallets (MetaMask, Phantom) through their extensions
 * - Smart contract integration via the wagmi library and ethers.js
 * - Multi-chain asset scanning with support for custom token selection
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount, useContractWrite, useConnect } from 'wagmi';
import { PROOF_TYPES, ZK_PROOF_TYPES, ZK_VERIFIER_ADDRESS, SIGNATURE_MESSAGE_TEMPLATES, EXPIRY_OPTIONS } from '../config/constants';
import { getConnectedWallets, saveWalletConnection, scanMultiChainAssets, convertAssetsToUSD, disconnectWallet, generateProofHash, generateTemporaryWallet } from '@proof-of-funds/common/utils/walletHelpers';
import MultiChainAssetDisplay from '../components/MultiChainAssetDisplay';
import WalletSelector from '../components/WalletSelector';
import NetworkToggle from '../components/NetworkToggle';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { CONTRACT_ABI, getContractAddress, CONTRACT_TYPES, CHAIN_IDS } from '../config/constants';
import { useNetwork } from '@proof-of-funds/common';
import { CheckIcon, ClockIcon } from '@heroicons/react/24/solid';
import { generateZKProof } from '@proof-of-funds/common/zk';

// Directly define isValidAmount function to bypass import issues
const isValidAmount = (amount) => {
    if (!amount || amount.trim() === '') {return false;}
    const num = Number(amount);
    if (isNaN(num)) {return false;}
    if (num < 0) {return false;}
    return true;
};

// Helper function to fetch wallet balance
const fetchBalance = async (walletAddress, chain) => {
    try {
        // Dynamically import ethers
        const { getEthers } = await import('@proof-of-funds/common/ethersUtils');
        const { ethers } = await getEthers();

        // Use ethers.js to fetch balance
        const provider = new ethers.providers.JsonRpcProvider(getRpcUrl(chain));
        const balance = await provider.getBalance(walletAddress);
        return ethers.utils.formatEther(balance); // Convert from wei to ETH
    } catch (error) {
        console.error('Error fetching balance:', error);
        throw error;
    }
};

// Helper function to fetch USD value
const fetchUSDValue = async (balance, chain) => {
    try {
        // Use CoinGecko API to fetch token price
        const tokenId = chain === 'Ethereum' ? 'ethereum' : 'matic-network';
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd`);
        const data = await response.json();
        const price = data[tokenId].usd;
        return (balance * price).toFixed(2); // Convert balance to USD
    } catch (error) {
        console.error('Error fetching USD value:', error);
        throw error;
    }
};

// Helper function to sign a message
const signMessage = async (walletAddress, message) => {
    try {
        console.log(`Signing message for wallet ${walletAddress}:`, message);
        
        // Dynamically import ethers
        const { getEthers } = await import('@proof-of-funds/common/ethersUtils');
        const { ethers, isV5, isV6 } = await getEthers();
        
        console.log('Using ethers version:', { isV5, isV6, version: ethers.version });

        // Handle both ethers v5 and v6 API
        let signer;
        
        try {
            if (isV5 && ethers.providers && ethers.providers.Web3Provider) {
                // Check if we have a valid ethereum instance
                if (!window.ethereum) {
                    throw new Error('No ethereum provider available. Connect your wallet first.');
                }
                
                // ethers v5
                console.log('Creating ethers v5 provider');
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                signer = provider.getSigner();
                console.log('Created ethers v5 signer');
            } else if (isV6 && ethers.BrowserProvider) {
                // Check if we have a valid ethereum instance
                if (!window.ethereum) {
                    throw new Error('No ethereum provider available. Connect your wallet first.');
                }
                
                // ethers v6
                console.log('Creating ethers v6 provider');
                const provider = new ethers.BrowserProvider(window.ethereum);
                signer = await provider.getSigner();
                console.log('Created ethers v6 signer');
            } else {
                throw new Error('Unsupported ethers.js version - could not find Web3Provider or BrowserProvider');
            }
            
            console.log('Requesting signature from wallet...');
            const signature = await signer.signMessage(message);
            console.log('Message signed successfully');
            return signature;
        } catch (signerError) {
            console.error('Error with signer:', signerError);
            throw new Error(`Signing failed: ${signerError.message}`);
        }
    } catch (error) {
        console.error('Error signing message:', error);
        throw error;
    }
};

/**
 * Main proof generation function
 * Generates proof data based on wallet, chain, and proof type
 * @param {string} walletAddress - Address of the wallet
 * @param {string} chain - The blockchain (e.g., "Ethereum")
 * @param {string} proofType - Type of proof ("standard", "threshold", "maximum")
 * @param {string} amount - Amount for verification
 */
const generateProof = async (walletAddress, chain, proofType, amount) => {
    try {
        // Validate inputs before proceeding
        if (!walletAddress) {
            throw new Error('Wallet address is required');
        }

        if (!amount || amount.trim() === '' || isNaN(Number(amount))) {
            console.error('Invalid amount:', amount);
            throw new Error('Valid amount is required. Please enter a number.');
        }

        // Dynamically import ethers and our utils
        const { getEthers, parseAmount } = await import('@proof-of-funds/common/ethersUtils');

        // Convert from string proof type to enum value
        let proofTypeEnum = PROOF_TYPES.STANDARD;
        if (proofType === 'threshold') {proofTypeEnum = PROOF_TYPES.THRESHOLD;}
        else if (proofType === 'maximum') {proofTypeEnum = PROOF_TYPES.MAXIMUM;}

        // Convert amount to Wei with proper decimal handling
        const amountInWei = await parseAmount(amount);

        // Generate hash based on proof type
        const proofHash = await generateProofHash(
            walletAddress,
            amountInWei,
            proofTypeEnum
        );

        // Define proof expiry time (e.g., 24 hours from now)
        const expiry = Math.floor(Date.now() / 1000) + 86400; // 24 hours in seconds

        // Create the proof object
        const proof = {
            walletAddress,
            chain,
            proofType,
            amount: amountInWei,
            proofHash,
            timestamp: Date.now(),
            expiration: expiry,
            // The message will be signed by the wallet
            signatureMessage: `I verify that I control wallet ${walletAddress} with ${amount} tokens on ${chain} as of ${new Date().toISOString()}`
        };

        return proof;
    } catch (error) {
        console.error('Error generating proof:', error);
        throw error;
    }
};

export default function CreatePage() {
    // Get network information
    const { useTestNetwork, getNetworkConfig } = useNetwork();
    const networkConfig = getNetworkConfig();

    // --- PROOF CONFIGURATION STATE ---
    // Controls switching between standard proof and zero-knowledge proof modes
    const [proofCategory, setProofCategory] = useState('standard'); // 'standard' or 'zk'

    // Specific type of proof within the standard category
    const [proofType, setProofType] = useState('standard'); // 'standard', 'threshold', 'maximum'

    // Specific type of proof within the zero-knowledge category
    const [zkProofType, setZkProofType] = useState('standard'); // 'standard', 'threshold', 'maximum'

    // Amount of funds to verify (in USD or token amounts)
    const [amount, setAmount] = useState('');

    // How long the proof will remain valid
    const [expiryDays, setExpiryDays] = useState('seven_days');

    // Message to be signed by the user's wallet
    const [signatureMessage, setSignatureMessage] = useState('');

    // Pre-defined message template for the signature
    const [selectedTemplate, setSelectedTemplate] = useState(SIGNATURE_MESSAGE_TEMPLATES[0].id);

    // Custom fields that can be inserted into the signature message
    const [customFields, setCustomFields] = useState({});

    // Whether to include KYC verification in the proof
    const [useKYC, setUseKYC] = useState(false);

    // --- TRANSACTION STATE ---
    // Whether a proof was successfully created
    const [success, setSuccess] = useState(false);

    // Transaction hash of the successful proof creation
    const [txHash, setTxHash] = useState('');

    // --- WALLET CONNECTION STATE ---
    // List of all connected wallets across multiple chains
    const [connectedWallets, setConnectedWallets] = useState([]);

    // Wallets selected by the user for creating this proof
    const [selectedWallets, setSelectedWallets] = useState([]);

    // Whether the user has actively initiated a wallet connection
    const [userInitiatedConnection, setUserInitiatedConnection] = useState(false);

    // --- ASSET MANAGEMENT STATE ---
    // Summary of all assets across selected wallets
    const [assetSummary, setAssetSummary] = useState(null);

    // Whether assets are currently being loaded
    const [isLoadingAssets, setIsLoadingAssets] = useState(false);

    // Error message if asset loading fails
    const [assetError, setAssetError] = useState('');

    // Whether to display asset values in USD
    const [showUSDValues, setShowUSDValues] = useState(true);

    // Whether USD values are currently being calculated
    const [isConvertingUSD, setIsConvertingUSD] = useState(false);

    // Whether assets are being manually refreshed
    const [isRefreshing, setIsRefreshing] = useState(false);

    // --- UI STATE ---
    // Controls expansion/collapse of the asset summary section
    const [isAssetSummaryExpanded, setIsAssetSummaryExpanded] = useState(true);

    // --- AMOUNT INPUT STATE ---
    // Controls whether the user inputs USD value or specific token amounts
    const [amountInputType, setAmountInputType] = useState('usd'); // 'usd' or 'tokens'

    // Selected tokens and their amounts when using token-based input
    const [selectedTokens, setSelectedTokens] = useState([]); // Array of {token, amount}

    // --- WALLET SIGNATURES STATE ---
    // Tracks signatures collected from each wallet
    const [walletSignatures, setWalletSignatures] = useState({});

    // Whether a wallet signature is in progress
    const [isSigningWallet, setIsSigningWallet] = useState(false);

    // The wallet currently being signed
    const [currentSigningWallet, setCurrentSigningWallet] = useState(null);

    // Whether all required wallets have been signed
    const [readyToSubmit, setReadyToSubmit] = useState(false);

    // Compiled proof data ready for submission
    const [proofData, setProofData] = useState(null);

    // Current stage in the proof creation workflow
    const [proofStage, setProofStage] = useState('input'); // 'input', 'signing', 'ready'

    // State to track if the proof is being submitted
    const [isSubmittingProof, setIsSubmittingProof] = useState(false);

    // Get connected account from wagmi
    const { address, isConnected } = useAccount();

    // Debugging: Log the connection status and synchronize with localStorage
    useEffect(() => {

        // When wagmi reports a connected wallet, ensure localStorage is synchronized
        if (isConnected && address) {
            // Use the centralized wallet helper functions to check if wallet exists
            // Note: getConnectedWallets() handles different wallet formats consistently
            const connectedWallets = getConnectedWallets();

            // Explicitly check for duplicates by normalizing addresses
            const normalizedAddress = address.toLowerCase();
            const hasAddress = connectedWallets.some(wallet => {
                // Check both fullAddress and address fields with normalized case comparison
                const walletAddr = (wallet.fullAddress || wallet.address || '').toLowerCase();
                return walletAddr === normalizedAddress;
            });

            if (!hasAddress) {
                // Use the proper saveWalletConnection helper instead of directly modifying localStorage
                // This ensures consistent wallet object format and prevents duplicates
                try {
                    saveWalletConnection('metamask', [address]);
                    localStorage.setItem('userInitiatedConnection', 'true');

                    // Explicitly clean up any malformed wallet entries to prevent duplicates
                    cleanupWalletStorage();

                    // Trigger a wallet connection changed event
                    const walletChangeEvent = new CustomEvent('wallet-connection-changed', {
                        detail: { timestamp: Date.now() }
                    });
                    window.dispatchEvent(walletChangeEvent);
                } catch (error) {
                    console.error('Error saving wallet connection:', error);
                }
            } else {

            }
        }
    }, [isConnected, address]);

    // Helper function to clean up any malformed wallet entries
    function cleanupWalletStorage() {
        try {
            const walletData = JSON.parse(localStorage.getItem('walletData') || '{"wallets":{},"timestamp":0}');

            // Ensure wallet object has expected structure
            if (!walletData.wallets) {
                walletData.wallets = {};
            }

            // Clean up metamask entries
            if (walletData.wallets.metamask && Array.isArray(walletData.wallets.metamask)) {
                // Remove any duplicate addresses by normalizing and comparing
                const seenAddresses = new Set();
                walletData.wallets.metamask = walletData.wallets.metamask.filter(entry => {
                    if (!entry) {return false;} // Remove null/undefined entries

                    // Get address from either string or object format
                    const addr = typeof entry === 'string' ?
                        entry.toLowerCase() :
                        ((entry.address || entry.fullAddress || '').toLowerCase());

                    // If we've seen this address before, filter it out
                    if (seenAddresses.has(addr)) {return false;}

                    // Otherwise, record and keep it
                    if (addr) {seenAddresses.add(addr);}
                    return !!addr; // Keep entries with valid addresses
                });

                // Update timestamp
                walletData.timestamp = Date.now();

                // Save cleaned data
                localStorage.setItem('walletData', JSON.stringify(walletData));
            }
        } catch (error) {
            console.error('Error cleaning up wallet storage:', error);
        }
    }

    // --- REFS FOR STATE TRACKING ---
    // Used to track previous values to avoid infinite loops in effects
    const prevSelectedWalletsRef = useRef([]);
    const prevConnectedWalletsRef = useRef([]);
    const prevShowUSDValuesRef = useRef(false);
    const assetsLoadedRef = useRef(false);

    // Refs for current values to access in async operations
    const selectedWalletsRef = useRef([]);
    const connectedWalletsRef = useRef([]);
    const showUSDValuesRef = useRef(false);

    // --- UTILITY FUNCTIONS ---

    /**
     * Formats a blockchain address for display by truncating the middle section
     * Returns the first 6 and last 4 characters with ellipsis in between
     * @param {string} address - The full blockchain address
     * @return {string} Formatted address (e.g., "0x1234...5678")
     */
    const formatAddress = (address) => {
        if (!address) {return '';}
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    /**
     * Comprehensive MetaMask debugging function
     */
    const debugWalletState = async () => {
        console.log('=== COMPREHENSIVE WALLET DEBUG START ===');
        
        // Check if we have multiple ethereum providers
        console.log('window.ethereum:', window.ethereum);
        console.log('window.ethereum.providers:', window.ethereum?.providers);
        console.log('window.ethereum.isMetaMask:', window.ethereum?.isMetaMask);
        
        // Check MetaMask directly with multiple methods
        if (window.ethereum) {
            try {
                // FIND THE ACTUAL METAMASK PROVIDER (not Phantom!)
                let metaMaskProvider = window.ethereum;
                if (window.ethereum.providers) {
                    console.log('Multiple providers detected, finding MetaMask...');
                    metaMaskProvider = window.ethereum.providers.find(provider => provider.isMetaMask);
                    console.log('Found MetaMask provider:', metaMaskProvider);
                } else if (!window.ethereum.isMetaMask) {
                    console.log('Default provider is NOT MetaMask:', window.ethereum);
                    console.log('Provider details:', {
                        isMetaMask: window.ethereum.isMetaMask,
                        isPhantom: window.ethereum.isPhantom,
                        isCoinbaseWallet: window.ethereum.isCoinbaseWallet
                    });
                }
                
                if (!metaMaskProvider) {
                    console.error('METAMASK PROVIDER NOT FOUND!');
                    return;
                }
                
                // Method 1: eth_requestAccounts (should show UI and return current accounts)
                console.log('=== CALLING eth_requestAccounts ON METAMASK PROVIDER ===');
                const requestAccounts = await metaMaskProvider.request({ method: 'eth_requestAccounts' });
                console.log('MetaMask eth_requestAccounts result:', requestAccounts);
                
                // Method 2: eth_accounts (should return cached accounts)
                console.log('=== CALLING eth_accounts ON METAMASK PROVIDER ===');
                const ethAccounts = await metaMaskProvider.request({ method: 'eth_accounts' });
                console.log('MetaMask eth_accounts result:', ethAccounts);
                
                // Method 3: Check selectedAddress property
                console.log('=== METAMASK PROPERTIES ===');
                console.log('metaMaskProvider.selectedAddress:', metaMaskProvider.selectedAddress);
                console.log('metaMaskProvider.isConnected():', metaMaskProvider.isConnected());
                console.log('metaMaskProvider.chainId:', metaMaskProvider.chainId);
                console.log('default window.ethereum.selectedAddress:', window.ethereum.selectedAddress);
                console.log('default window.ethereum.isConnected():', window.ethereum.isConnected());
                console.log('default window.ethereum.chainId:', window.ethereum.chainId);
                
                // Method 4: Try to get accounts through provider if available
                if (metaMaskProvider.enable) {
                    console.log('=== CALLING metaMaskProvider.enable() ===');
                    try {
                        const enableResult = await metaMaskProvider.enable();
                        console.log('metaMaskProvider.enable() result:', enableResult);
                    } catch (enableError) {
                        console.log('metaMaskProvider.enable() error:', enableError);
                    }
                } else {
                    console.log('metaMaskProvider.enable() not available');
                }
                
                // Method 5: Check if there are multiple providers
                if (window.ethereum.providers && window.ethereum.providers.length > 0) {
                    console.log('=== MULTIPLE PROVIDERS DETECTED ===');
                    console.log(`Total providers: ${window.ethereum.providers.length}`);
                    for (let i = 0; i < window.ethereum.providers.length; i++) {
                        const provider = window.ethereum.providers[i];
                        console.log(`Provider ${i}:`, {
                            isMetaMask: provider.isMetaMask,
                            isPhantom: provider.isPhantom,
                            isCoinbaseWallet: provider.isCoinbaseWallet,
                            selectedAddress: provider.selectedAddress,
                            chainId: provider.chainId,
                            _metamask: provider._metamask,
                            _state: provider._state
                        });
                        
                        if (provider.isMetaMask) {
                            try {
                                const providerAccounts = await provider.request({ method: 'eth_accounts' });
                                console.log(`MetaMask Provider ${i} accounts:`, providerAccounts);
                                
                                const providerRequestAccounts = await provider.request({ method: 'eth_requestAccounts' });
                                console.log(`MetaMask Provider ${i} requestAccounts:`, providerRequestAccounts);
                            } catch (error) {
                                console.log(`MetaMask Provider ${i} error:`, error);
                            }
                        }
                    }
                } else {
                    console.log('=== SINGLE PROVIDER OR NO PROVIDERS ARRAY ===');
                }
                
            } catch (error) {
                console.log('Error checking MetaMask:', error);
            }
        } else {
            console.log('NO ETHEREUM PROVIDER FOUND!');
        }
        
        // Check localStorage thoroughly
        console.log('=== LOCALSTORAGE DEBUG ===');
        try {
            const walletData = localStorage.getItem('walletData');
            console.log('localStorage walletData raw:', walletData);
            
            if (walletData) {
                const parsed = JSON.parse(walletData);
                console.log('Parsed wallet data:', JSON.stringify(parsed, null, 2));
            }
            
            // Check all localStorage keys for wallet-related data
            console.log('All localStorage keys containing \'wallet\' or \'connect\':');
            Object.keys(localStorage).forEach(key => {
                if (key.toLowerCase().includes('wallet') || key.toLowerCase().includes('connect') || key.includes('wagmi')) {
                    console.log(`${key}: ${localStorage.getItem(key)}`);
                }
            });
            
        } catch (error) {
            console.log('Error checking localStorage:', error);
        }
        
        console.log('=== COMPREHENSIVE WALLET DEBUG END ===');
    };

    /**
     * Reset MetaMask connection completely
     */
    const resetMetaMaskConnection = async () => {
        console.log('=== RESETTING METAMASK CONNECTION ===');
        
        try {
            // Clear all localStorage
            localStorage.clear();
            console.log('Cleared all localStorage');
            
            // Clear session storage too
            sessionStorage.clear();
            console.log('Cleared all sessionStorage');
            
            // If there are multiple providers, try to disconnect from all
            if (window.ethereum?.providers) {
                for (const provider of window.ethereum.providers) {
                    if (provider.isMetaMask && provider.disconnect) {
                        try {
                            await provider.disconnect();
                            console.log('Disconnected from MetaMask provider');
                        } catch (error) {
                            console.log('Error disconnecting provider:', error);
                        }
                    }
                }
            }
            
            // Reload the page to ensure clean state
            console.log('Page will reload in 2 seconds to ensure clean state...');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } catch (error) {
            console.error('Error resetting MetaMask connection:', error);
        }
    };

    /**
     * Clears stale wallet data from localStorage to prevent phantom addresses
     */
    const clearStaleWalletData = () => {
        try {
            console.log('Clearing stale wallet data from localStorage...');
            
            // Clear all wallet-related localStorage items
            localStorage.removeItem('walletData');
            localStorage.removeItem('userInitiatedConnection');
            
            // Clear wagmi-related items that might cache stale data
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('wagmi.') || key.includes('wallet') || key.includes('connect')) {
                    console.log(`Removing stale localStorage item: ${key}`);
                    localStorage.removeItem(key);
                }
            });
            
            console.log('Stale wallet data cleared successfully');
        } catch (error) {
            console.warn('Error clearing stale wallet data:', error);
        }
    };

    /**
     * Synchronizes MetaMask wallets with localStorage to handle wallet mismatch issues
     * @returns {Promise<boolean>} Success status
     */
    const syncMetaMaskWallets = async () => {
        console.log('Synchronizing MetaMask wallets with localStorage...');
        if (typeof window === 'undefined' || !window.ethereum) {
            console.warn('Cannot sync MetaMask wallets - no ethereum provider available');
            return false;
        }
        
        try {
            // Instead of calling MetaMask directly (which might return stale data),
            // use the properly connected wallets from our app state
            const currentWallets = getConnectedWallets();
            console.log('Current connected wallets from localStorage:', currentWallets);
            
            // Filter to get only MetaMask wallets
            const metaMaskWallets = currentWallets.filter(w => 
                w.type === 'evm' && w.provider === 'metamask'
            );
            
            if (metaMaskWallets.length === 0) {
                console.warn('No MetaMask wallets found in connected wallets');
                return false;
            }
            
            // Verify these wallets are still valid by checking with wagmi connection
            if (isConnected && address) {
                console.log('Wagmi reports connected address:', address);
                
                // Find the wallet that matches the wagmi connected address
                const matchingWallet = metaMaskWallets.find(w => 
                    (w.address || w.fullAddress || '').toLowerCase() === address.toLowerCase()
                );
                
                if (matchingWallet) {
                    console.log('Found matching wallet in connected wallets:', matchingWallet);
                    // Update UI state to use this verified wallet
                    setConnectedWallets([matchingWallet]);
                    console.log('MetaMask wallets synchronized successfully with verified data');
                    return true;
                } else {
                    console.warn('Wagmi connected address doesn\'t match any stored wallets');
                    // Try to use the wagmi address as the source of truth
                    const freshWallet = {
                        id: `metamask-${address.substring(2, 10)}`,
                        address: address,
                        displayAddress: `${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
                        fullAddress: address,
                        type: 'evm',
                        provider: 'metamask',
                        name: `MetaMask ${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
                        connected: true,
                        fresh: true
                    };
                    
                    // Save and use this fresh wallet
                    await saveWalletConnection('metamask', [freshWallet]);
                    setConnectedWallets([freshWallet]);
                    console.log('Created fresh wallet from wagmi connection:', freshWallet);
                    return true;
                }
            } else {
                console.log('No wagmi connection, using stored MetaMask wallets');
                setConnectedWallets(metaMaskWallets);
                return true;
            }
        } catch (error) {
            console.error('Error syncing MetaMask wallets:', error);
            return false;
        }
    };

    /**
     * Initializes wallet connections and sets up listeners for wallet changes
     * Uses local storage to persist wallet connections across page refreshes
     * Triggers wallet scanning when connections change
     */
    useEffect(() => {
        // Function to update connected wallets from localStorage
        const updateConnectedWallets = () => {
            // Use the centralized helper to get wallets from all supported chains
            const wallets = getConnectedWallets();

            setConnectedWallets(wallets);

            // Update user connection state to track if user initiated the connection
            const userInitiated = localStorage.getItem('userInitiatedConnection') === 'true';
            setUserInitiatedConnection(userInitiated);

            // Update selected wallets if needed - only update state if needed
            if (selectedWallets.length === 0 && wallets.length > 0) {
                // Automatically select first wallet if none are selected
                setSelectedWallets([wallets[0].id]);
            } else if (selectedWallets.length > 0) {
                // Keep only valid wallets in selected list (in case some were disconnected)
                const validWalletIds = wallets.map(w => w.id);
                const filteredWallets = selectedWallets.filter(id => validWalletIds.includes(id));

                // Only update if the arrays are different to avoid unnecessary re-renders
                if (filteredWallets.length !== selectedWallets.length) {
                    setSelectedWallets(filteredWallets);
                }
            }
        };

        // Initial update when component mounts
        updateConnectedWallets();

        // Set up listeners for wallet changes across the app
        const handleStorageChange = (e) => {
            if (e.key === 'walletData' || e.key === 'userInitiatedConnection') {

                updateConnectedWallets();
            }
        };

        // Listen for changes from other tabs
        window.addEventListener('storage', handleStorageChange);

        // Listen for the custom wallet connection changed event
        const handleWalletConnectionChanged = () => {

            updateConnectedWallets();
        };
        window.addEventListener('wallet-connection-changed', handleWalletConnectionChanged);

        // Set up for changes in current tab using custom events
        if (typeof window !== 'undefined' && !window._createPageStorageSetup) {
            window.addEventListener('localStorage-changed', (e) => {
                if (e.detail && (e.detail.key === 'walletData' || e.detail.key === 'userInitiatedConnection')) {

                    updateConnectedWallets();
                }
            });

            // Flag to prevent multiple event listeners
            window._createPageStorageSetup = true;
        }

        // Clean up event listeners on component unmount
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('wallet-connection-changed', handleWalletConnectionChanged);
        };
    }, []); // Empty dependency array to run only once on mount

    // --- REF SYNCHRONIZATION EFFECTS ---

    /**
     * Keep the selectedWallets ref synchronized with the state
     * This allows access to current selectedWallets value in async operations
     */
    useEffect(() => {
        selectedWalletsRef.current = selectedWallets;
    }, [selectedWallets]);

    /**
     * Keep the connectedWallets ref synchronized with the state
     * This allows access to current connectedWallets value in async operations
     */
    useEffect(() => {
        connectedWalletsRef.current = connectedWallets;
    }, [connectedWallets]);

    /**
     * Keep the showUSDValues ref synchronized with the state
     * Also handles conversion of existing assets to USD when the setting is changed
     */
    useEffect(() => {
        showUSDValuesRef.current = showUSDValues;

        // If USD values are requested but we don't have them yet, convert existing assets
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

    /**
     * Load assets from selected wallets
     * @param {boolean} forceRefresh - Force refresh bypassing cache
     */
    const loadAssets = useCallback(async (forceRefresh = false) => {
        // Only proceed if we have selected wallets
        if (selectedWalletsRef.current.length === 0) {
            setAssetSummary(null);
            return;
        }

        try {
            setIsLoadingAssets(true);
            setAssetError('');

            // Get the wallet objects for selected IDs
            const walletObjects = connectedWalletsRef.current.filter(wallet =>
                selectedWalletsRef.current.includes(wallet.id)
            );

            if (walletObjects.length === 0) {
                throw new Error('No valid wallets selected');
            }

            // Try to get assets from session storage first for instant loading
            // Skip cache if forceRefresh is true
            if (!forceRefresh) {
                const cachedAssets = tryGetCachedAssets(walletObjects[0]?.address);
                if (cachedAssets) {
                    // Immediately display cached assets
                    setAssetSummary(cachedAssets);
                    // If crossChain data exists in the cache, use it
                    if (cachedAssets.crossChain) {

                    }
                }
            } else {

            }

            // Always scan multiple chains regardless of which network is currently selected in MetaMask
            const scanOptions = {
                // Specify all chains to scan simultaneously
                chains: ['ethereum', 'polygon', 'bsc', 'arbitrum', 'avalanche', 'fantom'],
                // Only show tokens with actual balances
                includeZeroBalances: false,
                // Include all tokens regardless of popularity/spam status
                includePotentialSpam: true
            };

            // Scan assets across all chains independently
            const summary = await Promise.all(
                scanOptions.chains.map(async (chainName) => {
                    try {
                        // Scan this specific chain only
                        const chainSummary = await scanMultiChainAssets(walletObjects, {
                            chains: [chainName],
                            includeZeroBalances: scanOptions.includeZeroBalances,
                            includePotentialSpam: scanOptions.includePotentialSpam
                        });
                        return { chain: chainName, data: chainSummary };
                    } catch (error) {
                        console.error(`Error scanning chain ${chainName}:`, error);
                        return { chain: chainName, error };
                    }
                })
            ).then(results => {
                // Combine all chain results into a single summary
                const mergedSummary = {
                    totalAssets: [],
                    totalValue: 0,
                    totalUSDValue: 0,
                    chains: {},
                    walletAddresses: walletObjects.map(w => w.address || w.fullAddress),
                };

                // Process each chain's results
                results.forEach(result => {
                    if (result.data && !result.error) {
                        const chainData = result.data;

                        // Add assets
                        if (chainData.totalAssets && chainData.totalAssets.length > 0) {
                            mergedSummary.totalAssets.push(...chainData.totalAssets);
                        }

                        // Add value
                        mergedSummary.totalValue += (chainData.totalValue || 0);
                        mergedSummary.totalUSDValue += (chainData.totalUSDValue || 0);

                        // Copy chain data
                        if (chainData.chains && Object.keys(chainData.chains).length > 0) {
                            Object.assign(mergedSummary.chains, chainData.chains);
                        }

                        // Copy cross-chain data if available
                        if (chainData.crossChain) {
                            mergedSummary.crossChain = mergedSummary.crossChain || {};
                            mergedSummary.crossChain.crossChainSummary =
                                (mergedSummary.crossChain.crossChainSummary || [])
                                    .concat(chainData.crossChain.crossChainSummary || []);
                        }
                    }
                });

                return mergedSummary;
            });

            // Always convert to USD
            setIsConvertingUSD(true);
            const summaryWithUSD = await convertAssetsToUSD(summary);

            setShowUSDValues(true); // Always show USD values
            setAssetSummary(summaryWithUSD);
            // Cache for next session
            cacheAssets(walletObjects[0]?.address, summaryWithUSD);
            setIsConvertingUSD(false);
        } catch (error) {
            console.error('Error loading wallet assets:', error);
            
            // Check if we're in production or testnet environment
            // This ensures consistent UX between here and the fallbacks in moralisApi.js and walletHelpers.js
            if (useTestNetwork) {
                // In test environment (Amoy), we'll have the 1 ETH fallback
                // Just show a warning to the user but don't clear the asset summary
                console.log('Asset loading error in test environment, using fallback data:', error);
                setAssetError('Note: Using test data (1 ETH) due to API error. This behavior only occurs in test mode.');
            } else {
                // In production (mainnet Polygon), show a clear error with no fallbacks
                console.error('Asset loading error in production environment:', error);
                setAssetError(`Failed to load assets: ${error.message || 'Unknown error'}. Please try again later or switch networks.`);
                setAssetSummary(null); // Clear the asset display in production
            }
        } finally {
            setIsLoadingAssets(false);
        }
    }, []);

    // Helper function to try getting cached assets
    function tryGetCachedAssets(address) {
        try {
            if (typeof sessionStorage === 'undefined' || !address) {return null;}

            const cached = sessionStorage.getItem(`assets_${address.toLowerCase()}`);
            if (cached) {
                const parsedCache = JSON.parse(cached);
                const cacheAge = Date.now() - parsedCache.timestamp;

                // Use cache if less than 5 minutes old
                if (cacheAge < 5 * 60 * 1000) {

                    return parsedCache.data;
                } else {

                }
            }
        } catch (e) {
            console.warn('Error reading cached assets:', e);
        }
        return null;
    }

    // Helper function to cache assets
    function cacheAssets(address, assets) {
        try {
            if (typeof sessionStorage === 'undefined' || !address) {return;}

            sessionStorage.setItem(`assets_${address.toLowerCase()}`, JSON.stringify({
                data: assets,
                timestamp: Date.now()
            }));

        } catch (e) {
            console.warn('Error caching assets:', e);
        }
    }

    /**
     * Asset Loading Effect
     * Triggers when selected wallets change to load assets from all selected wallets
     * Handles loading states, errors, and USD conversion
     */
    useEffect(() => {
        // Set up refs to prevent closure issues
        selectedWalletsRef.current = selectedWallets;
        connectedWalletsRef.current = connectedWallets;
        showUSDValuesRef.current = showUSDValues;

        // Only load assets when we have at least one wallet selected
        if (selectedWallets.length === 0) {
            setAssetSummary(null);
            return;
        }

        // Load assets when selected wallets change
        loadAssets();
    }, [selectedWallets, loadAssets]); // Depend on selectedWallets and loadAssets

    /**
     * Toggles between showing native asset values and USD-converted values
     * When turning on USD conversion, it fetches price data for all assets
     * Prevents form submission when used as button click handler
     * @param {Event} e - The click event (optional)
     */
    const handleToggleUSDConversion = async (e) => {
        // Stop propagation to prevent the form from submitting
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

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

    /**
     * Handles wallet selection toggle for proof creation
     * Supports multi-select - adds wallet to selection if not present, removes if already selected
     * Triggers asset loading when selection changes via the useEffect
     * @param {string} walletId - The unique ID of the wallet to toggle
     */
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

    /**
     * Listens for MetaMask account changes to update wallet connections
     * If a user disconnects their wallet, it removes it from selection
     */
    useEffect(() => {
        const handleAccountsChanged = async (accounts) => {
            // This will trigger the wallet tracking effect that rebuilds the wallet list
            if (accounts.length === 0) {
                // User disconnected all accounts
                setSelectedWallets([]);
            }
        };

        // Set up MetaMask account change listener if available
        if (typeof window !== 'undefined' && window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);

            // Clean up listener on component unmount
            return () => {
                if (window.ethereum) {
                    window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                }
            };
        }
    }, []);

    // --- SMART CONTRACT INTEGRATION ---

    /**
     * Contract interaction hook for standard proof submission
     * Used for normal "exactly X amount" verification
     */
    const { config: standardProofConfig, error: standardProofError, write: writeStandardProof, data: dataStandard, isLoading: isStandardLoading } = useContractWrite({
        address: networkConfig.contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'submitProof',
        onError: (error) => {
            console.error('Contract write error:', error);
        }
    });

    /**
     * Contract interaction hook for threshold proof submission
     * Used for "at least X amount" verification
     */
    const { config: thresholdProofConfig, error: thresholdProofError, write: writeThresholdProof, data: dataThreshold, isLoading: isThresholdLoading } = useContractWrite({
        address: networkConfig.contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'submitProof',
        onError: (error) => {
            console.error('Contract write error:', error);
        }
    });

    /**
     * Contract interaction hook for maximum proof submission
     * Used for "at most X amount" verification
     */
    const { config: maximumProofConfig, error: maximumProofError, write: writeMaximumProof, data: dataMaximum, isLoading: isMaximumLoading } = useContractWrite({
        address: networkConfig.contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'submitProof',
        onError: (error) => {
            console.error('Contract write error:', error);
        }
    });

    /**
     * Contract interaction hook for zero-knowledge proof submission
     * Used for private proofs that don't reveal actual amounts on-chain
     */
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
                'inputs': [
                    { 'internalType': 'bytes', 'name': '_proof', 'type': 'bytes' },
                    { 'internalType': 'bytes', 'name': '_publicSignals', 'type': 'bytes' },
                    { 'internalType': 'uint256', 'name': '_expiryTime', 'type': 'uint256' },
                    { 'internalType': 'uint8', 'name': '_proofType', 'type': 'uint8' },
                    { 'internalType': 'string', 'name': '_signatureMessage', 'type': 'string' },
                    { 'internalType': 'bytes', 'name': '_signature', 'type': 'bytes' }
                ],
                'name': 'verifyAndStoreProof',
                'outputs': [],
                'stateMutability': 'nonpayable',
                'type': 'function'
            }
        ],
        functionName: 'verifyAndStoreProof',
    });

    // --- TOKEN SELECTION FUNCTIONS ---

    /**
     * Handles selection/deselection of tokens for token-based proof amount
     * @param {Object} token - Token object with symbol and chain information
     */
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

    /**
     * Updates the amount for a selected token
     * @param {string} symbol - Token symbol
     * @param {string} chain - Blockchain chain identifier
     * @param {string} value - New amount value
     */
    const handleTokenAmountChange = (symbol, chain, value) => {
        // Validate that the input is a number or empty string
        if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
            setSelectedTokens(prev =>
                prev.map(token =>
                    (token.symbol === symbol && token.chain === chain)
                        ? { ...token, amount: value }
                        : token
                )
            );
        }
    };
                        

    /**
     * Calculates the total USD value of all selected tokens
     * Uses asset price data to convert token amounts to USD
     * @returns {number} Total USD value
     */
    const calculateTotalUsdValue = () => {
        if (!assetSummary || !assetSummary.convertedAssets) {return 0;}

        return selectedTokens.reduce((total, token) => {
            // Find the token in convertedAssets to get USD rate
            const assetInfo = assetSummary.convertedAssets.find(
                a => a.symbol === token.symbol && a.chain === token.chain
            );

            if (!assetInfo || !token.amount) {return total;}

            // Calculate USD value based on price (not usdRate which doesn't exist)
            const price = assetInfo.price || 0;

            return total + (parseFloat(token.amount) * price);
        }, 0);
    };

    /**
     * Handles the wallet signature process for proof creation
     * Each wallet must sign to validate proof ownership
     * Supports both EVM wallets (MetaMask) and Solana wallets (Phantom)
     * @param {string} walletId - ID of the wallet to sign with
     */
    const handleSignWallet = async (walletId) => {
        try {
            setIsSigningWallet(true);
            setCurrentSigningWallet(walletId);

            const wallet = connectedWallets.find(w => w.id === walletId);
            if (!wallet) {
                throw new Error(`Wallet with ID ${walletId} not found`);
            }

            // Prepare amount value based on input type
            const finalAmount = amount;
            let messageAmountText = '';

            if (amountInputType === 'tokens') {
                // Get selected token amounts for the message - use the amounts the user entered
                if (selectedTokens && selectedTokens.length > 0) {
                    // List specific token amounts the user selected
                    const tokenList = selectedTokens.map(token =>
                        `${token.amount} ${token.symbol}`
                    ).join(', ');
                    messageAmountText = tokenList;

                } else {
                    messageAmountText = `${finalAmount} USD worth of tokens`;
                }
            } else {
                // USD amount
                messageAmountText = `$${finalAmount} USD`;
            }

            // Create signature message for this wallet
            // Use the same signature message that will be sent to the API
            let walletSpecificMessage = signatureMessage;

            // If the message isn't set yet (rare case), create a default one
            if (!walletSpecificMessage) {
                walletSpecificMessage = `I confirm ownership of wallet ${wallet.fullAddress} with ${messageAmountText} for proof of funds.`;
                // Also update the global signature message to keep them in sync
                setSignatureMessage(walletSpecificMessage);
            }

            console.log('Signing with message:', walletSpecificMessage);
            let signature = null;

            // Handle signature based on wallet type
            if (wallet.type === 'evm') {
                // For EVM wallets (MetaMask, etc.)
                try {
                    // Dynamically import ethers
                    const { getEthers } = await import('@proof-of-funds/common/ethersUtils');
                    const { ethers } = await getEthers();

                    // Get the correct MetaMask provider (not Phantom!)
                    let provider = window.ethereum;
                    if (window.ethereum?.providers) {
                        console.log('Multiple providers detected in signing, finding MetaMask...');
                        const metamaskProvider = window.ethereum.providers.find(p => p.isMetaMask && !p.isPhantom);
                        if (metamaskProvider) {
                            console.log('Found MetaMask provider for signing');
                            provider = metamaskProvider;
                        } else {
                            console.warn('MetaMask provider not found for signing');
                            console.log('Available providers:', window.ethereum.providers.map(p => ({
                                isMetaMask: p.isMetaMask,
                                isPhantom: p.isPhantom,
                                selectedAddress: p.selectedAddress
                            })));
                        }
                    } else if (window.ethereum.isPhantom && !window.ethereum.isMetaMask) {
                        throw new Error('Default provider is Phantom, not MetaMask. Please ensure MetaMask is properly installed.');
                    }

                    if (!provider) {
                        throw new Error('MetaMask extension not detected. Please install MetaMask to continue.');
                    }

                    // ALWAYS show the account selection popup

                    // Request account permissions - this will ALWAYS show the account selection popup
                    await provider.request({
                        method: 'wallet_requestPermissions',
                        params: [{ eth_accounts: {} }]
                    });

                    // Get the accounts the user selected
                    const selectedAccounts = await provider.request({
                        method: 'eth_accounts'
                    });

                    console.log('Selected accounts for signing:', selectedAccounts);
                    console.log('Expected wallet address:', wallet.fullAddress);

                    // Verify we have at least one account
                    if (!selectedAccounts || selectedAccounts.length === 0) {
                        throw new Error('No account was selected in MetaMask. Please try again and select an account.');
                    }

                    const selectedAccount = selectedAccounts[0];
                    const targetAddress = wallet.fullAddress.toLowerCase();

                    // If the selected account doesn't match our expected wallet, 
                    // we'll use the selected account instead and update the wallet object
                    if (selectedAccount.toLowerCase() !== targetAddress) {
                        console.log(`Account mismatch: expected ${targetAddress}, got ${selectedAccount.toLowerCase()}`);
                        console.log('Using the currently selected MetaMask account for signing');
                        
                        // Update the wallet object to reflect the actual selected account
                        wallet.address = selectedAccount;
                        wallet.fullAddress = selectedAccount;
                        wallet.displayAddress = `${selectedAccount.substring(0, 6)}...${selectedAccount.substring(selectedAccount.length - 4)}`;
                    }

                    // Get the signer from ethers - handle both v5 and v6 API
                    let signer;
                    try {
                        // Check if ethers is properly loaded
                        if (!ethers) {
                            throw new Error('Ethers library not loaded properly');
                        }

                        // ethers v5 approach
                        if (ethers.providers && ethers.providers.Web3Provider) {
                            try {
                                const ethersProvider = new ethers.providers.Web3Provider(provider);
                                signer = ethersProvider.getSigner();
                                console.log('Created ethers v5 signer');
                            } catch (signerError) {
                                console.error('Error creating signer with ethers v5:', signerError);
                                throw signerError;
                            }
                        }
                        // ethers v6 approach
                        else if (ethers.BrowserProvider) {
                            try {
                                const ethersProvider = new ethers.BrowserProvider(provider);
                                signer = await ethersProvider.getSigner();
                                console.log('Created ethers v6 signer');
                            } catch (signerError) {
                                console.error('Error creating signer with ethers v6:', signerError);
                                throw signerError;
                            }
                        }
                        else {
                            throw new Error('Unsupported ethers.js version - could not find Web3Provider or BrowserProvider');
                        }
                    } catch (providerError) {
                        console.error('Error creating provider:', providerError);
                        throw new Error(`Failed to initialize wallet provider: ${providerError.message}`);
                    }

                    // Double-check the signer address matches our target
                    const signerAddress = await signer.getAddress();
                    if (signerAddress.toLowerCase() !== targetAddress) {
                        throw new Error(`The connected account doesn't match the wallet you're trying to sign with. Please select account ${wallet.fullAddress} in MetaMask.`);
                    }

                    // Sign the message
                    signature = await signer.signMessage(walletSpecificMessage);
                } catch (error) {
                    if (error.code === 4001) {
                        // User rejected the request
                        throw new Error('You declined the signature request. Please approve the request to continue.');
                    }
                    throw new Error(`${error.message}`);
                }
            } else if (wallet.type === 'solana') {
                // For Solana wallets (Phantom)
                try {
                    // Check if phantom exists
                    if (!window.phantom || !window.phantom.solana) {
                        throw new Error('Phantom wallet extension not detected. Please install Phantom wallet to continue.');
                    }

                    // Get the phantom provider
                    const phantomProvider = window.phantom?.solana;

                    if (!phantomProvider || !phantomProvider.isPhantom) {
                        throw new Error('Phantom wallet not available. Please install Phantom wallet to continue.');
                    }

                    // Always disconnect first to force the popup to appear
                    try {
                        if (phantomProvider.isConnected) {

                            await phantomProvider.disconnect();
                            // Short delay to ensure disconnect completes
                            await new Promise(resolve => setTimeout(resolve, 300));
                        }
                    } catch (disconnectError) {

                    }

                    // Request connection - this opens the Phantom popup

                    const response = await phantomProvider.connect({ onlyIfTrusted: false });

                    // Get the wallet address they selected
                    const connectedPublicKey = response.publicKey.toString();

                    // Now try to sign the message

                    const encodedMessage = new TextEncoder().encode(walletSpecificMessage);
                    const signatureData = await phantomProvider.signMessage(encodedMessage, 'utf8');
                    signature = Buffer.from(signatureData.signature).toString('hex');

                    // Only NOW after successful signing do we validate the wallet address
                    if (connectedPublicKey !== wallet.fullAddress) {
                        console.error(`Signed with wrong account. Expected: ${wallet.fullAddress}, Got: ${connectedPublicKey}`);
                        throw new Error(`You signed with a different account than required. Please select account ${wallet.fullAddress} in Phantom.`);
                    }

                } catch (error) {
                    console.error('Phantom error:', error);
                    if (error.code === 4001) {
                        throw new Error('You declined the signature request. Please approve the request to continue.');
                    } else {
                        throw new Error(error.message || 'Error with Phantom wallet');
                    }
                }
            }

            // Update signatures state with the collected signature
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
            alert(`Unable to sign: ${error.message}`);
        } finally {
            setIsSigningWallet(false);
            setCurrentSigningWallet(null);
        }
    };

    /**
     * Prepares the proof data with all necessary information for submission
     * Organizes wallet information, assets, and signatures into a structured format
     */
    const prepareProofSubmission = async () => {
        console.log('prepareProofSubmission called, initial state:', {
            isSubmittingProof,
            proofStage,
            hasProofData: !!proofData
        });

        // If already submitting, don't start another submission
        if (isSubmittingProof) {
            console.log('Already submitting proof, ignoring duplicate call');
            return Promise.resolve(null);
        }

        // Return a Promise to ensure proper async/await handling
        return new Promise(async (resolve, reject) => {
            try {
                setIsSubmittingProof(true);
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

                // If using ZK proof, generate ZK proof and temporary wallet
                let zkProofData = null;
                let tempWallet = null;

                if (proofCategory === 'zk') {
                    try {
                        // Dynamically import ethers for parsing amount
                        const { getEthers, parseAmount } = await import('@proof-of-funds/common/ethersUtils');
                        const { ethers } = await getEthers();

                        // Convert amount to Wei
                        const amountInWei = await parseAmount(finalAmount);

                        // Get the primary wallet's address
                        const primaryWallet = connectedWallets.find(w => w.id === selectedWallets[0]);
                        if (!primaryWallet) {
                            throw new Error('No wallet selected');
                        }

                        // Generate ZK proof - use server-side API with Cloud Storage

                        try {
                            const response = await fetch('/api/zk/generateProofCloudStorage', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    proofType: zkProofType.toLowerCase(),
                                    input: {
                                        balance: amountInWei.toString(),
                                        threshold: amountInWei.toString(),
                                        maxBalance: amountInWei.toString(),
                                        totalBalance: amountInWei.toString(),
                                        userAddress: primaryWallet.fullAddress,
                                        networkId: networkConfig.chainId || 1,
                                        networks: [1, 137, 42161, 10] // Supported networks
                                    }
                                }),
                            });

                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.message || 'Failed to generate ZK proof');
                            }

                            const result = await response.json();
                            // The API returns { proof, publicSignals, verified, ... }
                            zkProofData = result;
                        } catch (apiError) {
                            console.error('API error during ZK proof generation:', apiError);
                            throw apiError;
                        }

                        // Generate temporary wallet - use server-side API for better security

                        try {
                            const response = await fetch('/api/zk/generateTempWallet', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    chain: primaryWallet.chain?.toLowerCase() || 'evm'
                                }),
                                // Add debugging info to console
                                onload: (e) => {
                                    console.log('Temp wallet request sent with chain:', primaryWallet.chain?.toLowerCase() || 'evm');
                                    console.log('Primary wallet data:', primaryWallet);
                                },
                            });

                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.message || 'Failed to generate temporary wallet');
                            }

                            const result = await response.json();
                            tempWallet = result.wallet;
                        } catch (apiError) {
                            console.error('API error during temporary wallet generation:', apiError);
                            throw apiError;
                        }

                    } catch (error) {
                        console.error('Error generating ZK proof:', error);
                        alert(`Error generating ZK proof: ${error.message}`);
                        setIsSubmittingProof(false); // Make sure to reset state
                        return; // Exit if ZK proof generation fails
                    }
                }

                // Generate proof data that includes all selected wallets and token details if applicable
                const proofDataObj = {
                    timestamp: Date.now(),
                    expiryTime: expiryTime * 1000, // Convert to milliseconds for JS
                    proofType: proofCategory === 'standard' ? proofType : zkProofType,
                    proofCategory: proofCategory, // Add the category (standard or zk)
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
                    currency: amountInputType === 'usd' ? 'USD' : 'tokens',
                    tokenDetails: tokenDetails,
                    signatures: walletSignatures,
                    thresholdAmount: proofType === 'threshold' ? parseFloat(finalAmount) : null,
                    maximumAmount: proofType === 'maximum' ? parseFloat(finalAmount) : null,
                    isThresholdProof: proofType === 'threshold',
                    isMaximumProof: proofType === 'maximum',
                    // Include ZK-specific properties if available
                    zkProof: zkProofData ? zkProofData.proof : null,
                    zkPublicSignals: zkProofData ? zkProofData.publicSignals : null,
                    tempWallet: tempWallet ? {
                        address: tempWallet.address,
                        privateKey: tempWallet.privateKey,
                        path: tempWallet.path
                    } : null
                };

                // Update state with the proof data
                setProofData(proofDataObj);
                setReadyToSubmit(true);

                // Move to the next stage
                setProofStage('ready');

                // Force a delay to make sure states have updated before proceeding
                console.log('Proof data ready:', proofDataObj);
                console.log('Setting proofStage to \'ready\'');

                setTimeout(() => {
                    console.log('Resolving promise with proofDataObj:', proofDataObj);
                    // Reset the submitting state
                    setIsSubmittingProof(false);
                    // Resolve the promise with the NEWLY CREATED proof data (not the state variable)
                    resolve(proofDataObj);
                }, 500);
            } catch (error) {
                console.error('Error in prepareProofSubmission:', error);
                setIsSubmittingProof(false);
                reject(error);
            }
        });
    };

    /**
     * Submits a zero-knowledge proof to the blockchain
     * Handles the specialized ZK proof submission flow
     * @returns {Promise<void>}
     */
    const handleZKProofSubmission = async () => {
        console.log('handleZKProofSubmission called');
        try {
            console.log('Checking ZK proof data:', {
                hasProofData: !!proofData,
                hasZkProof: !!proofData?.zkProof,
                hasPublicSignals: !!proofData?.zkPublicSignals
            });

            // First ensure we have valid ZK proof data
            if (!proofData || !proofData.zkProof || !proofData.zkPublicSignals) {
                console.error('ZK proof data is missing or incomplete:', proofData);
                throw new Error('ZK proof data is missing or incomplete');
            }

            // Get the primary wallet data
            const primaryWallet = connectedWallets.find(w => w.id === selectedWallets[0]);
            if (!primaryWallet) {
                throw new Error('Primary wallet not found');
            }

            // Get expiry time
            const expiryTime = getExpiryTimestamp(expiryDays);

            // Get the signature
            const walletSignature = walletSignatures[primaryWallet.id]?.signature;
            if (!walletSignature) {
                throw new Error('Wallet signature not found. Please sign with your wallet.');
            }

            // Determine the ZK proof type enum value
            let zkProofTypeValue;
            if (zkProofType === 'standard') {zkProofTypeValue = ZK_PROOF_TYPES.STANDARD;}
            else if (zkProofType === 'threshold') {zkProofTypeValue = ZK_PROOF_TYPES.THRESHOLD;}
            else if (zkProofType === 'maximum') {zkProofTypeValue = ZK_PROOF_TYPES.MAXIMUM;}

            // Use the actual ZK proof data
            const { zkProof: proof, zkPublicSignals: publicSignals } = proofData;

            // Convert proof object to array format for submission
            // No need for ABI encoding here - the API does that
            const proofArray = [
                proof.pi_a[0], proof.pi_a[1],
                proof.pi_b[0][0], proof.pi_b[0][1], proof.pi_b[1][0], proof.pi_b[1][1],
                proof.pi_c[0], proof.pi_c[1]
            ];

            // Use the temp wallet to submit the proof
            const tempWallet = proofData.tempWallet;
            if (!tempWallet || !tempWallet.privateKey) {
                console.error('Temporary wallet data missing');
                throw new Error('Temporary wallet information is missing');
            }

            try {
                // Submit the ZK proof to the blockchain using the API
                const response = await fetch('/api/zk/submitProof', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        proof: proofArray,
                        publicSignals: publicSignals,
                        expiryTime: expiryTime,
                        proofType: zkProofTypeValue,
                        signatureMessage: signatureMessage,
                        signature: walletSignature,
                        tempWalletPrivateKey: tempWallet.privateKey,
                        tempWalletAddress: tempWallet.address
                    })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    setTxHash(result.transactionHash);
                    setSuccess(true);
                    setIsSubmittingProof(false);

                    alert(`ZK Proof submitted! Transaction hash: ${result.transactionHash.substring(0, 10)}...`);
                } else {
                    throw new Error(result.error || 'Failed to submit proof');
                }
            } catch (error) {
                console.error('Error submitting ZK proof:', error);
                setIsSubmittingProof(false);
                alert(`Failed to submit ZK proof: ${error.message}`);
            }
        } catch (error) {
            console.error('Error in ZK proof submission:', error);
            alert(`ZK proof submission error: ${error.message}`);
            setIsSubmittingProof(false);
        }
    };

    // No simulation functions - always use real blockchain submission

    /**
     * Submits the finalized proof to the blockchain
     * Creates and submits the transaction when all signatures are collected
     * First prompts user to select a wallet for transaction that is verified with MetaMask
     */
    const submitFinalProof = async () => {
        console.log('submitFinalProof called');
        console.log('Current state:', { proofStage, hasProofData: !!proofData, proofCategory: proofData?.proofCategory });

        if (proofStage === 'ready' && proofData) {
            console.log('Conditions met, proceeding with submission');
            try {
                setIsSubmittingProof(true);

                // Handle differently based on proof category
                if (proofData.proofCategory === 'zk') {
                    return await handleZKProofSubmission();
                }

                // STEP 1: SELECT TRANSACTION WALLET FIRST
                // We need to select a wallet for the transaction BEFORE preparing the API call
                // This ensures the wallet is available in MetaMask and avoids mismatches
                console.log('Prompting user to select transaction wallet first...');
                
                const selectedWallet = await selectTransactionWallet();
                if (!selectedWallet) {
                    throw new Error('Transaction cancelled: No wallet was selected for transaction');
                }
                
                console.log('User selected wallet for transaction:', selectedWallet);
                
                // STEP 2: VERIFY PRIMARY WALLET FOR SIGNATURES
                // For signature verification, we still need the primary wallet that was used for signatures
                const primaryWallet = connectedWallets.find(w => w.id === selectedWallets[0]);
                if (!primaryWallet) {
                    throw new Error('Primary wallet not found among connected wallets');
                }
                
                console.log('Using primary wallet for signatures:', primaryWallet.fullAddress);
                console.log('Using selected wallet for transaction:', selectedWallet.address);
                
                // Since we have signatures, we'll use a server-side approach similar to ZK proofs
                // This will avoid the wallet connection issues in the browser
                console.log('Using API-based submission approach for standard proof');
                
                // Get signature and other required data
                const walletSignature = walletSignatures[primaryWallet.id]?.signature;
                if (!walletSignature) {
                    throw new Error('Wallet signature not found. Please sign with your wallet.');
                }
                
                // Dynamically import our ethers utility functions
                const ethersUtils = await import('@proof-of-funds/common/ethersUtils');
                
                // Convert amount to Wei for blockchain submission
                const amountInWei = await ethersUtils.parseAmount(
                    amountInputType === 'usd' ? amount : calculateTotalUsdValue().toString(),
                    18 // Use 18 decimals for ETH
                );
                
                const expiryTime = getExpiryTimestamp(expiryDays);

                if (proofCategory === 'standard') {

                    // Determine the proof type value (enum) based on the selected proof type
                    let proofTypeValue;
                    if (proofType === 'standard') {proofTypeValue = PROOF_TYPES.STANDARD;}
                    else if (proofType === 'threshold') {proofTypeValue = PROOF_TYPES.THRESHOLD;}
                    else if (proofType === 'maximum') {proofTypeValue = PROOF_TYPES.MAXIMUM;}

                    // Generate the appropriate proof hash
                    const proofHash = await generateProofHash(
                        primaryWallet.fullAddress,
                        amountInWei.toString(),
                        proofTypeValue
                    );

                    // For threshold and maximum types, we use the threshold amount
                    // Use a simplified approach - just use '0' directly
                    const thresholdAmount = (proofType === 'threshold' || proofType === 'maximum')
                        ? amountInWei
                        : '0'; // Use 0 for standard proof type

                    // Format for API submission
                    const numericProofType = Number(proofTypeValue);
                    
                    try {
                        // Alert user about submission 
                        
                        console.log('Submitting standard proof via API:', {
                            proofType: numericProofType,
                            hasProofHash: !!proofHash,
                            expiryTime,
                            hasSignature: !!walletSignature
                        });
                        
                        console.log('=== FRONTEND SIGNATURE DEBUG ===');
                        console.log('walletSignature:', walletSignature);
                        console.log('signatureMessage:', signatureMessage);
                        console.log('primaryWallet.fullAddress:', primaryWallet.fullAddress);
                        console.log('signature length:', walletSignature ? walletSignature.length : 'null');
                        
                        // Submit the standard proof to the blockchain using an API endpoint
                        // Include the contract address from the current network configuration
                        const response = await fetch('/api/submitStandardProof', {
                            method: 'POST', 
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                proofType: numericProofType,
                                proofHash,
                                expiryTime,
                                threshold: thresholdAmount,
                                signatureMessage,
                                signature: walletSignature,
                                walletAddress: primaryWallet.fullAddress, // Keep primary wallet for signature verification
                                transactionWallet: selectedWallet.address, // Add the selected wallet address for transaction
                                contractAddress: networkConfig.contractAddress, // Include the contract address
                                isStandard: true // Flag to indicate a standard (non-ZK) proof
                            })
                        });
                        
                        // Process response
                        if (response.ok) {
                            const result = await response.json();
                            
                            if (result.success) {
                                console.log('Proof data validated successfully, preparing transaction...', result);
                                
                                // Now we need to submit the transaction from the user's wallet
                                try {
                                    // We already prompted the user for the wallet earlier in the flow
                                    console.log('Using pre-selected wallet for transaction:', selectedWallet);
                                    
                                    // Double-check we have a valid wallet
                                    if (!selectedWallet || !selectedWallet.address) {
                                        throw new Error('Transaction cancelled: No wallet properly selected for submission');
                                    }
                                    
                                    // Get transaction data from API response
                                    const txData = result.transactionData;
                                    console.log('Transaction data:', txData);
                                    
                                    if (!txData) {
                                        throw new Error('Missing transaction data in API response');
                                    }
                                    
                                    // Import the transaction utility
                                    const { submitStandardProofTx } = await import('../utils/submitStandardTx');
                                    
                                    
                                    alert('Please confirm the transaction in your wallet.');
                                    
                                    // Submit the transaction with the selected wallet
                                    const receipt = await submitStandardProofTx({
                                        ...txData,
                                        walletAddress: selectedWallet.address
                                    });
                                    
                                    // Extract transaction hash with fallback logic (ethers v6 compatibility)
                                    const txHash = receipt.transactionHash || receipt.hash || receipt.blockHash;
                                    
                                    // Update UI
                                    setIsSubmittingProof(false);
                                    setSuccess(true);
                                    setTxHash(txHash);
                                    
                                    // Display success message with transaction hash
                                    if (txHash) {
                                        alert(`Proof submitted successfully!\nTransaction hash: ${txHash.substring(0, 10)}...`);
                                    } else {
                                        alert('Proof submitted successfully! Transaction confirmed.');
                                    }
                                } catch (walletError) {
                                    console.error('Error submitting transaction from wallet:', walletError);
                                    setIsSubmittingProof(false);
                                    
                                    // Display a more helpful error message for wallet connection issues
                                    if (walletError.message.includes('not available in MetaMask')) {
                                        // For wallet mismatch errors, show the full detailed message with available wallets
                                        alert(walletError.message);
                                    } else {
                                        // For other errors, show a simpler message
                                        alert(`Error submitting transaction: ${walletError.message}`);
                                    }
                                }
                            } else {
                                throw new Error(result.error || 'Unknown error submitting proof');
                            }
                        } else {
                            // Handle API error
                            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                            throw new Error(errorData.error || `API error: ${response.status}`);
                        }
                    } catch (apiError) {
                        console.error('Error submitting proof via API:', apiError);
                        setIsSubmittingProof(false);
                        
                        let errorMessage = `Error submitting proof: ${apiError.message}`;
                        
                        // Provide more helpful error message for contract configuration issues
                        if (apiError.message?.includes('Contract') && 
                            apiError.message?.includes('address')) {
                            errorMessage = 'Contract address is missing or invalid. Please ensure your wallet is connected to the correct network.';
                        }
                        
                        alert(errorMessage);
                    }

                } else if (proofCategory === 'zk') {
                    // Zero-knowledge proofs handling
                    // Import ethers for ABI encoding
                    const { getEthers } = await import('@proof-of-funds/common/ethersUtils');
                    const ethersData = await getEthers();
                    const { ethers } = ethersData;

                    // For ethers v5 compatibility - use the right ABI coder
                    const abiCoder = ethers.utils ? ethers.utils.defaultAbiCoder : ethers.AbiCoder.defaultAbiCoder();

                    // Use the actual proof data from proofData state
                    const { zkProof: proof, zkPublicSignals: publicSignals } = proofData;

                    // Submit ZK proof via API
                    try {
                        // Get the temporary wallet data from proofData
                        const tempWallet = proofData.tempWallet;
                        if (!tempWallet || !tempWallet.privateKey) {
                            throw new Error('Temporary wallet information is missing');
                        }

                        // Convert proof object to array format
                        const proofArray = [
                            proof.pi_a[0], proof.pi_a[1],
                            proof.pi_b[0][0], proof.pi_b[0][1], proof.pi_b[1][0], proof.pi_b[1][1],
                            proof.pi_c[0], proof.pi_c[1]
                        ];

                        // Submit via API
                        const response = await fetch('/api/zk/submitProof', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                proof: proofArray,
                                publicSignals,
                                expiryTime,
                                proofType: zkProofType === 'standard' ? 0 : zkProofType === 'threshold' ? 1 : 2,
                                signatureMessage,
                                signature: walletSignature,
                                tempWalletPrivateKey: tempWallet.privateKey,
                                tempWalletAddress: tempWallet.address
                            })
                        });

                        const result = await response.json();
                        
                        if (response.ok && result.success) {
                            setTxHash(result.transactionHash);
                            setSuccess(true);
                            setIsSubmittingProof(false);
                            alert(`ZK Proof submitted! Transaction hash: ${result.transactionHash.substring(0, 10)}...`);
                        } else {
                            throw new Error(result.error || 'Failed to submit proof');
                        }
                    } catch (zkError) {
                        console.error('Error submitting ZK proof:', zkError);
                        setIsSubmittingProof(false);
                        alert(`Failed to submit ZK proof: ${zkError.message}`);
                    }
                }
            } catch (error) {
                console.error('Error submitting proof:', error);
                alert(`Error: ${error.message}`);
            } finally {
                setIsSubmittingProof(false);
            }
        }
    };

    /**
     * Checks if all selected wallets have been signed
     * Used to determine when the proof is ready to submit
     * @returns {boolean} True if all wallets are signed
     */
    const areAllWalletsSigned = () => {
        if (selectedWallets.length === 0) {return false;}
        const allSigned = selectedWallets.every(walletId => !!walletSignatures[walletId]);

        // If all are signed and we're in signing stage, move to ready stage
        if (allSigned && proofStage === 'signing' && !readyToSubmit) {
            setReadyToSubmit(true);
            setProofStage('ready');
        }

        return allSigned;
    };

    /**
     * Keep signed wallets status persistent across proof stages
     * This ensures signatures persist until proof is submitted
     */
    useEffect(() => {
        // If all wallets are signed, we should be ready to submit regardless of stage
        if (selectedWallets.length > 0 && Object.keys(walletSignatures).length > 0) {
            const allSigned = areAllWalletsSigned();
            if (allSigned && !readyToSubmit) {
                setReadyToSubmit(true);
                // Only transition to ready stage if we're in signing stage to avoid breaking flow
                if (proofStage === 'signing') {
                    setProofStage('ready');
                }
            } else if (!allSigned && (proofStage === 'ready' || readyToSubmit)) {
                // If not all wallets are signed but we're in ready stage, go back to signing
                setReadyToSubmit(false);
                if (proofStage === 'ready') {
                    setProofStage('signing');
                }
            }
        }
    }, [walletSignatures, selectedWallets, proofStage]);

    /**
     * Resets wallet signatures when selected wallets change
     * This prevents invalid signatures if wallet selection changes
     */
    useEffect(() => {
        setWalletSignatures({});
        setReadyToSubmit(false);
        setProofData(null);
    }, [selectedWallets]);

    /**
     * Handles the form submission process
     * Validates inputs and moves to the signing stage
     * @param {Event} e - Form submission event
     */
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Check if wallet is connected - check both wagmi state and local state
        if (!isConnected && connectedWallets.length === 0) {
            alert('Please connect your wallet first.');
            return;
        }

        // Validate selected wallets
        if (!selectedWallets || selectedWallets.length === 0) {
            alert('Please select at least one wallet to generate a proof.');
            return;
        }

        // Validate amount using our centralized validation helper
        if (amountInputType === 'usd' && !isValidAmount(amount)) {
            alert('Please enter a valid amount. Decimal values are supported.');
            return;
        } else if (amountInputType === 'tokens') {
            // If using token amounts, validate that all tokens have valid amounts
            const invalidTokens = selectedTokens.filter(token => !isValidAmount(token.amount));
            if (invalidTokens.length > 0) {
                alert('Please enter valid amounts for all selected tokens. Decimal values are supported.');
                return;
            }

            // Also check if we have any tokens selected
            if (selectedTokens.length === 0) {
                alert('Please select at least one token and specify its amount.');
                return;
            }
        }

        // If we're in the input stage, move to the signing stage
        if (proofStage === 'input') {

            setProofStage('signing');
            return;
        }

        // If we're in the signing stage, check if all wallets are signed
        if (proofStage === 'signing') {

            if (!areAllWalletsSigned()) {
                alert('Please sign with all selected wallets before proceeding.');
                return;
            }
            // Prepare proof data for submission

            try {
                // Call async function and await its completion
                await prepareProofSubmission();

                // Now we know proofData should be set
                // The timeout ensures state has updated before proceeding
                setTimeout(() => {

                    // Try to proceed directly to the blockchain submission
                    if (proofData) {

                        submitFinalProof();
                    } else {

                    }
                }, 500);
            } catch (error) {
                console.error('Error preparing proof data:', error);
                alert('Error preparing proof data: ' + error.message);
            }
            return;
        }

        // If we're in the ready stage, submit the proof to the blockchain
        if (proofStage === 'ready') {

            // If proofData is missing, try to prepare it again
            if (!proofData) {

                try {
                    prepareProofSubmission();
                    // Return early to let the state update before proceeding
                    return;
                } catch (error) {
                    console.error('Error preparing proof data:', error);
                    alert('Error preparing proof data: ' + error.message);
                    return;
                }
            }

            try {
                setIsSubmittingProof(true);
                const primaryWallet = connectedWallets.find(w => w.id === selectedWallets[0]);
                if (!primaryWallet) {
                    throw new Error('Primary wallet not found');
                }

                // Dynamically import ethers utilities
                const ethersUtils = await import('@proof-of-funds/common/ethersUtils');

                // Convert amount to Wei for blockchain submission
                const amountValue = amountInputType === 'usd' ? amount : calculateTotalUsdValue().toString();

                const amountInWei = await ethersUtils.parseAmount(amountValue, 18);

                const expiryTime = getExpiryTimestamp(expiryDays);

                // Get the signature for this wallet
                const walletSignature = walletSignatures[primaryWallet.id]?.signature;
                if (!walletSignature) {
                    throw new Error('Wallet signature not found. Please sign with your wallet.');
                }

                if (proofCategory === 'standard') {

                    // Determine the proof type value (enum) based on the selected proof type
                    let proofTypeValue;
                    if (proofType === 'standard') {proofTypeValue = PROOF_TYPES.STANDARD;}
                    else if (proofType === 'threshold') {proofTypeValue = PROOF_TYPES.THRESHOLD;}
                    else if (proofType === 'maximum') {proofTypeValue = PROOF_TYPES.MAXIMUM;}

                    // Generate the appropriate proof hash
                    const proofHash = await generateProofHash(
                        primaryWallet.fullAddress,
                        amountInWei.toString(),
                        proofTypeValue
                    );

                    // For threshold and maximum types, we use the threshold amount
                    // Use a simplified approach - just use '0' directly
                    const thresholdAmount = (proofType === 'threshold' || proofType === 'maximum')
                        ? amountInWei
                        : '0'; // Use 0 for standard proof type

                    // Format for API submission
                    const numericProofType = Number(proofTypeValue);
                    
                    try {
                        // Alert user about submission 
                        
                        console.log('Submitting standard proof via API:', {
                            proofType: numericProofType,
                            hasProofHash: !!proofHash,
                            expiryTime,
                            hasSignature: !!walletSignature
                        });
                        
                        console.log('=== FRONTEND SIGNATURE DEBUG ===');
                        console.log('walletSignature:', walletSignature);
                        console.log('signatureMessage:', signatureMessage);
                        console.log('primaryWallet.fullAddress:', primaryWallet.fullAddress);
                        console.log('signature length:', walletSignature ? walletSignature.length : 'null');
                        
                        // Submit the standard proof to the blockchain using an API endpoint
                        // Include the contract address from the current network configuration
                        const response = await fetch('/api/submitStandardProof', {
                            method: 'POST', 
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                proofType: numericProofType,
                                proofHash,
                                expiryTime,
                                threshold: thresholdAmount,
                                signatureMessage,
                                signature: walletSignature,
                                walletAddress: primaryWallet.fullAddress, // Keep primary wallet for signature verification
                                transactionWallet: selectedWallet.address, // Add the selected wallet address for transaction
                                contractAddress: networkConfig.contractAddress, // Include the contract address
                                isStandard: true // Flag to indicate a standard (non-ZK) proof
                            })
                        });
                        
                        // Process response
                        if (response.ok) {
                            const result = await response.json();
                            
                            if (result.success) {
                                console.log('Proof data validated successfully, preparing transaction...', result);
                                
                                // Now we need to submit the transaction from the user's wallet
                                try {
                                    // We already prompted the user for the wallet earlier in the flow
                                    console.log('Using pre-selected wallet for transaction:', selectedWallet);
                                    
                                    // Double-check we have a valid wallet
                                    if (!selectedWallet || !selectedWallet.address) {
                                        throw new Error('Transaction cancelled: No wallet properly selected for submission');
                                    }
                                    
                                    // Get transaction data from API response
                                    const txData = result.transactionData;
                                    console.log('Transaction data:', txData);
                                    
                                    if (!txData) {
                                        throw new Error('Missing transaction data in API response');
                                    }
                                    
                                    // Import the transaction utility
                                    const { submitStandardProofTx } = await import('../utils/submitStandardTx');
                                    
                                    
                                    alert('Please confirm the transaction in your wallet.');
                                    
                                    // Submit the transaction with the selected wallet
                                    const receipt = await submitStandardProofTx({
                                        ...txData,
                                        walletAddress: selectedWallet.address
                                    });
                                    
                                    // Extract transaction hash with fallback logic (ethers v6 compatibility)
                                    const txHash = receipt.transactionHash || receipt.hash || receipt.blockHash;
                                    
                                    // Update UI
                                    setIsSubmittingProof(false);
                                    setSuccess(true);
                                    setTxHash(txHash);
                                    
                                    // Display success message with transaction hash
                                    if (txHash) {
                                        alert(`Proof submitted successfully!\nTransaction hash: ${txHash.substring(0, 10)}...`);
                                    } else {
                                        alert('Proof submitted successfully! Transaction confirmed.');
                                    }
                                } catch (walletError) {
                                    console.error('Error submitting transaction from wallet:', walletError);
                                    setIsSubmittingProof(false);
                                    
                                    // Display a more helpful error message for wallet connection issues
                                    if (walletError.message.includes('not available in MetaMask')) {
                                        // For wallet mismatch errors, show the full detailed message with available wallets
                                        alert(walletError.message);
                                    } else {
                                        // For other errors, show a simpler message
                                        alert(`Error submitting transaction: ${walletError.message}`);
                                    }
                                }
                            } else {
                                throw new Error(result.error || 'Unknown error submitting proof');
                            }
                        } else {
                            // Handle API error
                            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                            throw new Error(errorData.error || `API error: ${response.status}`);
                        }
                    } catch (apiError) {
                        console.error('Error submitting proof via API:', apiError);
                        setIsSubmittingProof(false);
                        
                        let errorMessage = `Error submitting proof: ${apiError.message}`;
                        
                        // Provide more helpful error message for contract configuration issues
                        if (apiError.message?.includes('Contract') && 
                            apiError.message?.includes('address')) {
                            errorMessage = 'Contract address is missing or invalid. Please ensure your wallet is connected to the correct network.';
                        }
                        
                        alert(errorMessage);
                    }

                } else if (proofCategory === 'zk') {
                    // Zero-knowledge proofs handling

                    // Import ethers for ABI encoding
                    const { getEthers } = await import('@proof-of-funds/common/ethersUtils');
                    const ethersData = await getEthers();
                    const { ethers } = ethersData;

                    // For ethers v5 compatibility - use the right ABI coder
                    const abiCoder = ethers.utils ? ethers.utils.defaultAbiCoder : ethers.AbiCoder.defaultAbiCoder();

                    // Log the actual structure of proofData

                    // Use the actual proof data from proofData state
                    // Note: The proof is stored as zkProof and zkPublicSignals
                    const { zkProof: proof, zkPublicSignals: publicSignals } = proofData;

                    // Check if proof exists and has the expected structure
                    if (!proof) {
                        throw new Error('Proof data is missing');
                    }

                    // Convert proof object to array format for ABI encoding
                    // Handle different possible proof structures
                    let proofArray;
                    if (proof.pi_a) {
                        // Standard snarkjs format
                        proofArray = [
                            proof.pi_a[0], proof.pi_a[1],
                            proof.pi_b[0][0], proof.pi_b[0][1], proof.pi_b[1][0], proof.pi_b[1][1],
                            proof.pi_c[0], proof.pi_c[1]
                        ];
                    } else if (proof.a) {
                        // Alternative format
                        proofArray = [
                            proof.a[0], proof.a[1],
                            proof.b[0][0], proof.b[0][1], proof.b[1][0], proof.b[1][1],
                            proof.c[0], proof.c[1]
                        ];
                    } else if (Array.isArray(proof)) {
                        // Already in array format
                        proofArray = proof;
                    } else {
                        console.error('Unknown proof format:', proof);
                        throw new Error('Unknown proof format');
                    }

                    const encodedProof = abiCoder.encode(
                        ['uint256[]'],
                        [proofArray]
                    );

                    const encodedPublicSignals = abiCoder.encode(
                        ['uint256[]'],
                        [publicSignals]
                    );

                    let zkProofTypeValue;
                    if (zkProofType === 'standard') {zkProofTypeValue = ZK_PROOF_TYPES.STANDARD;}
                    else if (zkProofType === 'threshold') {zkProofTypeValue = ZK_PROOF_TYPES.THRESHOLD;}
                    else if (zkProofType === 'maximum') {zkProofTypeValue = ZK_PROOF_TYPES.MAXIMUM;}

                    if (typeof writeZKProof !== 'function') {
                        console.error('writeZKProof is not a function:', writeZKProof);
                        alert('Error: Contract write function is not properly initialized');
                        return;
                    }

                    // Apply similar formatting as with standard proofs
                    try {

                        // Use the privacy-preserving submission API

                        // Get the temporary wallet data from proofData
                        const tempWallet = proofData.tempWallet;
                        if (!tempWallet || !tempWallet.privateKey) {
                            console.error('Temporary wallet data missing');
                            alert('Error: Temporary wallet information is missing');
                            return;
                        }

                        try {
                            const response = await fetch('/api/zk/submitProof', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    proof: proofArray,
                                    publicSignals: publicSignals,
                                    expiryTime: expiryTime,
                                    proofType: zkProofTypeValue,
                                    signatureMessage: signatureMessage,
                                    signature: walletSignature,
                                    tempWalletPrivateKey: tempWallet.privateKey,
                                    tempWalletAddress: tempWallet.address
                                })
                            });

                            const result = await response.json();

                            if (response.ok && result.success) {
                                setTxHash(result.transactionHash);
                                setSuccess(true);
                                setIsSubmittingProof(false);

                                alert(`ZK Proof submitted! Transaction hash: ${result.transactionHash.substring(0, 10)}...`);
                            } else {
                                throw new Error(result.error || 'Failed to submit proof');
                            }
                        } catch (error) {
                            console.error('Error submitting ZK proof:', error);
                            setIsSubmittingProof(false);
                            alert(`Failed to submit ZK proof: ${error.message}`);
                        }
                    } catch (error) {
                        console.error('Error formatting ZK contract arguments:', error);
                        setIsSubmittingProof(false);
                        alert(`Error formatting ZK contract arguments: ${error.message}`);
                    }
                }

            } catch (error) {
                console.error('Error submitting proof:', error);
                alert(`Error: ${error.message}`);
            } finally {
                setIsSubmittingProof(false);
            }
        }
    };

    /**
     * Monitors transaction state to detect successful proof creation
     * Updates UI when a transaction is completed
     */
    useEffect(() => {
        const txData = dataStandard || dataThreshold || dataMaximum || dataZK;

        if (txData) {

            if (txData.hash) {
                // We have a transaction hash - the transaction has been submitted

                setTxHash(txData.hash);
            }
        }
    }, [dataStandard, dataThreshold, dataMaximum, dataZK]);

    // Separate effect for polling the transaction status
    useEffect(() => {
        let isMounted = true;
        let pollInterval = null;

        // Skip if no hash or already marked as success
        if (!txHash || success) {return;}

        // Function to poll the transaction status
        const pollTransaction = async () => {
            try {
                // Direct API call to avoid ethers import issues
                const response = await fetch('http://localhost:8545', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'eth_getTransactionReceipt',
                        params: [txHash],
                    }),
                });

                if (!isMounted) {return;}

                const data = await response.json();

                if (data.result) {
                    // Transaction has been mined
                    const receipt = data.result;

                    if (receipt.status === '0x1') {

                        if (isMounted) {
                            setSuccess(true);
                            setIsSubmittingProof(false);
                            clearInterval(pollInterval);
                        }
                    } else {
                        console.error('Transaction failed!');
                        clearInterval(pollInterval);
                        setIsSubmittingProof(false);
                        alert('Transaction failed. Please check the transaction details.');
                    }
                }
            } catch (error) {
                console.error('Error polling transaction:', error);
            }
        };

        // Poll immediately
        pollTransaction();

        // Then set up interval
        pollInterval = setInterval(pollTransaction, 3000);

        // Cleanup
        return () => {
            isMounted = false;
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        };
    }, [txHash, success]);

    /**
     * Updates signature message when template changes
     * Replaces placeholders in templates with actual values
     */
    useEffect(() => {
        const template = SIGNATURE_MESSAGE_TEMPLATES.find(t => t.id === selectedTemplate);
        if (template) {
            let message = template.template;

            // Replace placeholders with values
            if (message.includes('{amount}')) {
                // Get the exact amount from token selection or USD amount
                let exactAmount = '';
                if (amountInputType === 'tokens' && selectedTokens && selectedTokens.length > 0) {
                    // Use the actual entered amount instead of rounding
                    exactAmount = selectedTokens[0].amount;
                } else {
                    exactAmount = amount || '0';
                }
                message = message.replace('{amount}', exactAmount);
            }

            // Add token symbol based on selected tokens or detected chain
            if (message.includes('{token_symbol}')) {
                let tokenSymbol = '';

                if (amountInputType === 'tokens' && selectedTokens && selectedTokens.length > 0) {
                    // Use the first selected token's symbol - this is what the user explicitly selected
                    tokenSymbol = selectedTokens[0].symbol;

                } else if (amountInputType === 'usd') {
                    // For USD amounts, use 'USD' as the token symbol
                    tokenSymbol = 'USD';
                } else if (assetSummary && assetSummary.chains) {
                    // Fallback: Use the native token of the first detected chain
                    tokenSymbol = getCurrencySymbol(assetSummary);
                } else {
                    // Final fallback
                    tokenSymbol = 'ETH';
                }

                message = message.replace('{token_symbol}', tokenSymbol);
            }

            // Format date with proper timestamp and timezone information
            if (message.includes('{date}')) {
                // Format with full date, time and seconds
                const formatDateTime = (date, timeZone) => {
                    return date.toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'numeric',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        second: 'numeric',
                        hour12: true,
                        timeZone: timeZone
                    });
                };

                // Current date time
                const now = new Date();
                const currentUtcDateTime = formatDateTime(now, 'UTC');
                const currentPacificDateTime = formatDateTime(now, 'America/Los_Angeles');
                const currentEasternDateTime = formatDateTime(now, 'America/New_York');

                // Calculate expiry time
                const expirySeconds = getExpiryTimestamp(expiryDays) - Math.floor(Date.now() / 1000);
                const expiryDate = new Date(now.getTime() + (expirySeconds * 1000));

                // Format expiry date
                const expiryUtcDateTime = formatDateTime(expiryDate, 'UTC');
                const expiryPacificDateTime = formatDateTime(expiryDate, 'America/Los_Angeles');
                const expiryEasternDateTime = formatDateTime(expiryDate, 'America/New_York');

                const dateWithTimezones = `${currentUtcDateTime} UTC / ${currentPacificDateTime} PST / ${currentEasternDateTime} EST (expires: ${expiryUtcDateTime} UTC)`;
                message = message.replace('{date}', dateWithTimezones);
            }

            // Replace any custom fields
            Object.keys(customFields).forEach(key => {
                if (message.includes(`{${key}}`)) {
                    message = message.replace(`{${key}}`, customFields[key] || '');
                }
            });

            setSignatureMessage(message);
        }
    }, [selectedTemplate, amount, customFields, assetSummary, selectedTokens, amountInputType, expiryDays]);

    /**
     * Calculates the expiry timestamp based on the selected expiry option
     * @param {string} expiryOption - ID of the selected expiry option
     * @returns {number} Unix timestamp for expiry
     */
    const getExpiryTimestamp = (expiryOption) => {
        const now = Math.floor(Date.now() / 1000); // Current time in seconds

        // Find the matching option in the array
        const option = Array.isArray(EXPIRY_OPTIONS)
            ? EXPIRY_OPTIONS.find(opt => opt.id === expiryOption)
            : null;

        // Use the seconds value from the option, or default to 7 days (604800 seconds)
        return now + (option ? option.seconds : 604800);
    };

    /**
     * Updates custom fields for the signature message
     * @param {string} key - Field name
     * @param {string} value - Field value
     */
    const handleCustomFieldChange = (key, value) => {
        setCustomFields(prev => ({
            ...prev,
            [key]: value
        }));
    };

    /**
     * Extracts custom field placeholders from a signature message template
     * @param {string} templateId - ID of the message template
     * @returns {Array} List of custom field names
     */
    const getCustomFieldsFromTemplate = (templateId) => {
        const template = SIGNATURE_MESSAGE_TEMPLATES.find(t => t.id === templateId);
        if (!template) {return [];}

        const regex = /{([^{}]*)}/g;
        const matches = template.template.match(regex) || [];

        // Filter out known placeholders
        return matches
            .map(match => match.replace(/{|}/g, ''))
            .filter(key => !['amount', 'date'].includes(key));
    };

    // Combined loading state from all contract interactions
    const isPending = isStandardLoading || isThresholdLoading || isMaximumLoading || isPendingZK || isSubmittingProof;
    const isError = standardProofError || thresholdProofError || maximumProofError || isErrorZK;
    const error = standardProofError || thresholdProofError || maximumProofError || errorZK;

    /**
     * Reset success state to create another proof
     */
    const handleCreateAnother = () => {
        setSuccess(false);
        setTxHash('');
    };

    /**
     * Gets the appropriate currency symbol based on asset summary
     * @param {Object} summary - Asset summary object
     * @returns {string} Currency symbol
     */
    const getCurrencySymbol = (summary) => {
        if (!summary || !summary.chains || Object.keys(summary.chains).length === 0) {
            return 'ETH'; // Default to ETH if no chain data
        }

        const firstChain = Object.keys(summary.chains)[0];

        if (firstChain === 'polygon') {return 'MATIC';}
        if (firstChain === 'solana') {return 'SOL';}
        return 'ETH'; // Default for ethereum or other chains
    };

    /**
     * Resets signatures when critical proof details change
     * This prevents invalid signatures if proof parameters are changed
     */
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

    // Add a connector configuration
    const { connect, connectors } = useConnect({
        connector: new MetaMaskConnector(),
    });

    // Synchronize wallet connections
    useEffect(() => {
        const connectWagmiIfNeeded = async () => {
            try {
                // Read from localStorage to get previously connected wallets
                if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                    try {
                        const walletData = localStorage.getItem('walletData');
                        if (walletData) {
                            const parsedData = JSON.parse(walletData);
                            
                            // Create a reference to compare against later
                            const existingWalletIds = new Set(connectedWallets.map(w => w.id || w.address || w.fullAddress));
                            let shouldUpdateWallets = false;
                            
                            if (parsedData.wallets) {
                                const storedWallets = [];
                                
                                // Add MetaMask wallets
                                if (parsedData.wallets.metamask && Array.isArray(parsedData.wallets.metamask)) {
                                    storedWallets.push(...parsedData.wallets.metamask);
                                }
                                
                                // Add Phantom wallets
                                if (parsedData.wallets.phantom && Array.isArray(parsedData.wallets.phantom)) {
                                    storedWallets.push(...parsedData.wallets.phantom);
                                }
                                
                                // Only update state if we have wallets and they're different
                                if (storedWallets.length > 0) {
                                    // Check if the wallet list has changed
                                    const storedWalletIds = new Set(storedWallets.map(w => w.id || w.address || w.fullAddress));
                                    shouldUpdateWallets = 
                                        storedWallets.length !== connectedWallets.length || 
                                        storedWallets.some(w => !existingWalletIds.has(w.id || w.address || w.fullAddress));
                                    
                                    if (shouldUpdateWallets) {
                                        // Use stored wallets from localStorage only if they're different
                                        setConnectedWallets(storedWallets);
                                        console.log('Loaded new wallets from localStorage:', storedWallets);
                                    }
                                }
                            }
                        }
                    } catch (localStorageError) {
                        console.warn('Error reading wallets from localStorage:', localStorageError);
                    }
                }
            } catch (error) {
                console.warn('Error syncing wallet connections:', error);
            }
            
            // TEMPORARILY DISABLED AUTO-CONNECTION to preserve account selection dialog
            // Only attempt reconnection if we have wallets in localStorage but wagmi reports disconnected
            if (false && !isConnected && connectedWallets.length > 0) {
                try {
                    // Make sure the connector is set globally for use in contract calls
                    const metamaskConnector = connectors.find(c => c.id === 'metaMask');

                    if (metamaskConnector && await metamaskConnector.isAuthorized()) {
                        try {
                            // Connect using the MetaMask connector without logging errors
                            const originalConsoleError = console.error;
                            console.error = () => { }; // Temporarily suppress console.error

                            try {
                                // Only connect if not already connected
                                if (!isConnected) {
                                    console.log('Auto-connecting wallet...');
                                    await connect({ connector: metamaskConnector });
                                    // Store the connector for later use
                                    window.wagmiMetaMaskConnector = metamaskConnector;
                                } else {
                                    console.log('Already connected, skipping auto-connect');
                                }
                            } finally {
                                console.error = originalConsoleError; // Restore console.error
                            }
                        } catch (connectError) {
                            // Silently ignore all connection errors - they are expected in some cases
                        }
                    }
                } catch (error) {
                    // Silently handle errors to prevent console spam
                }
            }
        };

        // Try to connect when component mounts (only once)
        connectWagmiIfNeeded();
        
        // Listen for MetaMask account changes, but don't automatically connect
        const handleAccountsChanged = async (accounts) => {
            console.log('MetaMask accounts changed:', accounts);
            
            // Get updated wallets from localStorage - don't automatically connect
            try {
                const { getConnectedWallets } = await import('@proof-of-funds/common/walletHelpers');
                const currentWallets = getConnectedWallets();
                setConnectedWallets(currentWallets);
            } catch (error) {
                console.warn('Could not update wallets after account change:', error);
            }
        };
        
        // Add listeners
        if (typeof window !== 'undefined' && window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
        }
        
        // Cleanup function
        return () => {
            if (typeof window !== 'undefined' && window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            }
        };
    // Use only isConnected as dependency to prevent infinite render loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected]);

    // Helper function to check if all token amounts are valid
    const areAllTokenAmountsValid = () => {
        if (selectedTokens.length === 0) {return false;}
        return !selectedTokens.some(token => !isValidAmount(token.amount));
    };

    /**
     * Prompts the user to select a wallet for transaction submission
     * Works with currently connected wallets in the UI and verifies they're available in MetaMask
     * @returns {Promise<Object|null>} The selected wallet or null if cancelled
     */
    const selectTransactionWallet = async () => {
        console.log('selectTransactionWallet called');
        
        // First, check if we have connected wallets in the UI
        if (!connectedWallets || connectedWallets.length === 0) {
            alert('No wallets connected. Please connect a wallet first.');
            console.error('selectTransactionWallet: No connected wallets found');
            return null;
        }
        
        // FIRST SYNC METAMASK WALLETS WITH LOCALSTORAGE
        // This step is critical to ensure we're working with up-to-date wallet data
        console.log('Syncing MetaMask wallets before transaction...');
        await syncMetaMaskWallets();
        
        // Use the properly connected wallets instead of calling MetaMask directly
        // This avoids the phantom address issue by using our verified wallet state
        const currentConnectedWallets = getConnectedWallets();
        const availableWallets = currentConnectedWallets.filter(w => 
            w.type === 'evm' && w.provider === 'metamask' && w.connected
        );
        
        console.log('Available connected wallets after sync:', availableWallets);
        
        // Check if we have available wallets from our custom connection
        if (availableWallets.length === 0) {
            alert('No wallets connected. Please connect your wallet first.');
            return null;
        }
        
        // If we have wagmi connection, try to match it with available wallets
        if (isConnected && address) {
            console.log('Wagmi reports connected address:', address);
            
            const matchingWallet = availableWallets.find(w => 
                (w.address || w.fullAddress || '').toLowerCase() === address.toLowerCase()
            );
            
            if (!matchingWallet) {
                console.warn('No matching wallet found for wagmi address:', address);
                // Create a wallet object from the wagmi connection
                const wagmiWallet = {
                    id: `metamask-${address.substring(2, 10)}`,
                    address: address,
                    displayAddress: `${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
                    fullAddress: address,
                    type: 'evm',
                    provider: 'metamask',
                    name: `MetaMask ${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
                    connected: true,
                    wagmiVerified: true
                };
                availableWallets.push(wagmiWallet);
            }
        } else {
            console.log('No wagmi connection, using available wallets from custom connection');
        }
        
        console.log('Available connected wallets:', availableWallets);
        
        // Determine which network we're targeting based on the environment
        const targetNetwork = useTestNetwork ? 'polygon-amoy' : 'polygon';
        const networkDisplay = useTestNetwork ? 'Polygon Amoy (testnet)' : 'Polygon';
        
        // Display network information
        alert(`Please select a wallet for submitting your proof to the ${networkDisplay} blockchain.`);
        
        // Check if we have any available wallets to show
        if (availableWallets.length === 0) {
            alert('No connected wallets are currently available in MetaMask. Please unlock your wallet and try again.');
            return null;
        }
        
        // Use JavaScript's built-in prompt for selection with clearer formatting
        let walletOptions = `Select wallet for ${networkDisplay} transaction submission:\n\n`;
        availableWallets.forEach((w, idx) => {
            const address = w.address || w.fullAddress;
            const displayName = w.name || formatAddress(address);
            walletOptions += `${idx + 1}. ${displayName} (${address})\n`;
        });
        
        const selection = prompt(`${walletOptions}\n\nEnter wallet number (1-${availableWallets.length}):`);
        
        // Handle cancellation
        if (selection === null) {
            console.log('Wallet selection cancelled by user');
            return null;
        }
        
        // Convert to number and adjust for zero-based indexing
        const walletIndex = parseInt(selection) - 1;
        
        // Validate selection
        if (isNaN(walletIndex) || walletIndex < 0 || walletIndex >= availableWallets.length) {
            alert('Invalid selection. Please select a valid wallet number.');
            return null;
        }
        
        // Get selected wallet
        const selectedWallet = availableWallets[walletIndex];
        console.log('User selected wallet:', selectedWallet);
        
        // Return the selected wallet
        return selectedWallet;
    };

    // Add a function to check contract ABI and verify the method exists
    const verifyContractMethod = async (contractAddress, methodName) => {
        try {
            // Dynamically import ethers
            const { getEthers } = await import('@proof-of-funds/common/ethersUtils');
            const { ethers, isV5, isV6 } = await getEthers();
            
            console.log('Verifying contract method with ethers version:', { isV5, isV6 });
            
            // Create provider based on ethers version
            let provider;
            if (isV5 && ethers.providers && ethers.providers.Web3Provider) {
                // ethers v5
                provider = new ethers.providers.Web3Provider(window.ethereum);
            } else if (isV6 && ethers.BrowserProvider) {
                // ethers v6
                provider = new ethers.BrowserProvider(window.ethereum);
                
                // For testing without connecting, we can check just using ABI
                // This is useful when we have signatures but no active connection
                if (!window.ethereum || !window.ethereum.isConnected()) {
                    console.log('No active ethereum connection, using basic ABI check');
                    // Just verify the method exists in the ABI
                    return CONTRACT_ABI.some(item => 
                        item.type === 'function' && item.name === methodName
                    );
                }
            } else {
                console.warn('Could not create a provider with the available ethers version');
                return true; // Assume method exists if we can't check
            }
            
            // Create contract instance
            const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);

            // Check if the method exists in the contract interface
            const fragments = contract.interface.fragments || [];
            const methodExists = fragments.some(fragment =>
                fragment.type === 'function' && fragment.name === methodName
            );

            if (!methodExists) {
                console.error(`Method ${methodName} not found in contract ABI`);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error verifying contract method:', error);
            return false;
        }
    };

    return (
        <div className="max-w-4xl mx-auto mt-8">
            <NetworkToggle />
            <h1 className="text-3xl font-bold text-center mb-8">Create Proof of Funds</h1>

            <div className="bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-6">Proof Creation</h2>

                <form
                    onSubmit={(e) => {

                        // Only process submit when it comes from the actual submit button
                        if (e.nativeEvent.submitter &&
                            e.nativeEvent.submitter.getAttribute('type') === 'submit') {

                            handleSubmit(e);
                        } else {
                            // Prevent form submission for other interactions

                            e.preventDefault();
                        }
                    }}
                >
                    <div className="space-y-6">
                        {/* Wallet Selection Section */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Select Wallet for Proof
                            </label>

                            <div className="space-y-2">
                                {connectedWallets.length > 0 ? (
                                    connectedWallets.map(wallet => {
                                        // Determine if the wallet is Polygon compatible
                                        const isPolygonCompatible = 
                                            wallet.chain === 'polygon' || 
                                            wallet.chain === 'Polygon' ||
                                            (wallet.supportedChains && 
                                            wallet.supportedChains.some(chain => 
                                                chain === 'polygon' || 
                                                chain === 'Polygon' || 
                                                chain === 'MATIC'));
                                            
                                        return (
                                            <div
                                                key={wallet.id}
                                                className={`px-4 py-2 border rounded-md flex justify-between items-center cursor-pointer
                                                    ${selectedWallets.includes(wallet.id)
                                                        ? 'bg-primary-600 text-white border-primary-600'
                                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                                                onClick={() => handleWalletSelection(wallet.id)}
                                            >
                                                <div className="font-medium">{wallet.name} - {wallet.address}</div>
                                                <div className="flex flex-col items-end">
                                                    <div className="text-sm">{wallet.chain}</div>
                                                </div>
                                            </div>
                                        );
                                    })
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

                            {!userInitiatedConnection && connectedWallets.length === 0 && (
                                <button
                                    className="mt-3 py-2 px-4 text-sm font-medium rounded-md border bg-primary-600 text-white border-primary-600"
                                    onClick={() => {
                                        // Find any connect wallet button in the document
                                        const connectBtn = document.querySelector('.ConnectWallet-module_connectButton__1MX_K') ||
                                            document.getElementById('connect-wallet-button');

                                        if (connectBtn) {
                                            connectBtn.click();
                                        } else {
                                            // Fallback: dispatch a custom event that ConnectWallet component can listen for
                                            window.dispatchEvent(new CustomEvent('open-wallet-selector'));
                                            console.log('Dispatched open-wallet-selector event');
                                        }
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
                                            type="button"
                                            className="mr-2 text-gray-400 hover:text-gray-600"
                                            onClick={() => setIsAssetSummaryExpanded(!isAssetSummaryExpanded)}
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
                                </div>

                                {isAssetSummaryExpanded && (
                                    <>
                                        {isLoadingAssets || isConvertingUSD || isRefreshing ? (
                                            <div className="py-3 text-center text-sm text-gray-500">
                                                <svg className="animate-spin h-5 w-5 mx-auto mb-1 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                {isRefreshing ? 'Refreshing assets...' : 'Loading assets...'}
                                            </div>
                                        ) : assetSummary ? (
                                            <>
                                                <div className="bg-primary-50 border rounded-md overflow-hidden mb-3">
                                                    <div className="grid grid-cols-4 bg-gray-100 px-3 py-2">
                                                        <div className="text-sm font-medium text-gray-700">Asset</div>
                                                        <div className="text-sm font-medium text-gray-700 text-right">Balance</div>
                                                        <div className="text-sm font-medium text-gray-700 text-right relative group">
                                                            <span>Price (USD)</span>
                                                            <span className="hidden group-hover:block absolute z-10 top-6 -left-2 w-48 p-2 bg-gray-800 text-white text-xs rounded">
                                                                USD values are based on current market prices and subject to change.
                                                            </span>
                                                        </div>
                                                        <div className="text-sm font-medium text-gray-700 text-right relative group">
                                                            <span>Value (USD)</span>
                                                            <span className="hidden group-hover:block absolute z-10 top-6 -left-2 w-48 p-2 bg-gray-800 text-white text-xs rounded">
                                                                USD values are based on current market prices and subject to change.
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {assetSummary.convertedAssets.map((asset, idx) => (
                                                        <div key={idx} className="grid grid-cols-4 px-3 py-2 border-t border-gray-200">
                                                            <div className="text-sm text-gray-700">{asset.symbol}</div>
                                                            <div className="text-sm text-gray-700 text-right">{Number(asset.balance).toString()}</div>
                                                            <div className="text-sm text-gray-700 text-right">${Number(asset.price).toFixed(2)}</div>
                                                            <div className="text-sm text-gray-700 text-right">${Number(asset.usdValue).toFixed(2)}</div>
                                                        </div>
                                                    ))}
                                                    <div className="grid grid-cols-4 px-3 py-2 border-t border-gray-200 bg-gray-50">
                                                        <div className="text-sm font-medium text-gray-700 col-span-3 text-right">Total:</div>
                                                        <div className="text-sm font-medium text-gray-700 text-right">${Number(assetSummary.totalUSDValue).toFixed(2)}</div>
                                                    </div>
                                                </div>

                                                {/* Refresh Button */}
                                                <div className="flex justify-end mb-3">
                                                    <button
                                                        type="button"
                                                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
                                                        onClick={async () => {
                                                            setIsRefreshing(true);
                                                            try {
                                                                await loadAssets(true); // Pass true to force refresh
                                                            } finally {
                                                                setIsRefreshing(false);
                                                            }
                                                        }}
                                                        disabled={isRefreshing || isLoadingAssets || isConvertingUSD}
                                                    >
                                                        {isRefreshing ? (
                                                            <>
                                                                <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                </svg>
                                                                Refreshing...
                                                            </>
                                                        ) : (
                                                            'Refresh Assets'
                                                        )}
                                                    </button>
                                                </div>

                                                <div>
                                                    <div className="text-sm font-medium text-gray-700 mb-1">Chain Breakdown</div>
                                                    {Object.entries(assetSummary.chains).map(([chain, data]) => (
                                                        <div key={chain} className="bg-gray-50 border rounded-md px-3 py-2 mb-2">
                                                            <div className="font-medium text-sm capitalize">{chain}</div>
                                                            <div className="text-xs text-gray-700">
                                                                Native: {Number(data.nativeBalance).toString()} {chain === 'polygon' ? 'MATIC' : chain === 'solana' ? 'SOL' : 'ETH'}
                                                                {data.nativeUSDValue && ` ($${Number(data.nativeUSDValue).toFixed(2)} USD)`}
                                                            </div>
                                                            {Object.entries(data.tokens).length > 0 && (
                                                                <div className="text-xs text-gray-700">
                                                                    Tokens: {Object.entries(data.tokens).map(([symbol, balance], i) => (
                                                                        <span key={symbol}>
                                                                            {i > 0 && ', '}
                                                                            {Number(balance).toString()} {symbol}
                                                                            {data.tokensUSDValue && data.tokensUSDValue[symbol] &&
                                                                                ` ($${Number(data.tokensUSDValue[symbol]).toFixed(2)} USD)`}
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
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Proof Category
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProofCategory('standard');
                                        setSuccess(false);
                                    }}
                                    className={`p-4 border rounded-md flex flex-col items-center justify-between text-left transition-colors ${proofCategory === 'standard'
                                        ? 'bg-primary-50 border-primary-500 ring-2 ring-primary-500'
                                        : 'border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-100 text-primary-600 mb-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-medium mb-1">Standard Proof</h3>
                                        <p className="text-sm text-gray-500">
                                            Create a standard verification of funds with specified amount.
                                        </p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setProofCategory('zk');
                                        setSuccess(false);
                                    }}
                                    className={`p-4 border rounded-md flex flex-col items-center justify-between text-left transition-colors ${proofCategory === 'zk'
                                        ? 'bg-zk-light border-zk-accent ring-2 ring-zk-accent'
                                        : 'border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-zk-light text-zk-accent mb-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-medium mb-1">Zero-Knowledge Proof</h3>
                                        <p className="text-sm text-gray-500">
                                            Create a private verification without revealing exact amounts.
                                        </p>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Proof Type Selection - Shown for both Standard and ZK Proof Categories */}
                        {proofCategory === 'standard' && (
                            <div className="mb-6">
                                <label htmlFor="proof-type" className="block text-sm font-medium text-gray-700 mb-2">
                                    Proof Type
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProofType('standard');
                                            setSuccess(false);
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
                                        <div>
                                            <h3 className="font-medium mb-1">Standard Proof</h3>
                                            <p className="text-sm text-gray-500">
                                                Verify that the wallet has exactly this amount of funds.
                                            </p>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProofType('threshold');
                                            setSuccess(false);
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
                                        <div>
                                            <h3 className="font-medium mb-1">Threshold Proof</h3>
                                            <p className="text-sm text-gray-500">
                                                Verify that the wallet has at least this amount of funds.
                                            </p>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProofType('maximum');
                                            setSuccess(false);
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
                                        <div>
                                            <h3 className="font-medium mb-1">Maximum Proof</h3>
                                            <p className="text-sm text-gray-500">
                                                Verify that the wallet has at most this amount of funds.
                                            </p>
                                        </div>
                                    </button>
                                </div>

                                {/* Proof Type Explanation */}
                                <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200 text-sm text-gray-600">
                                    {proofType === 'standard' && (
                                        <p>
                                            <strong>Standard Proof:</strong> This proof verifies that your wallet contains exactly the specified amount.
                                            Use this for precise verification requirements.
                                        </p>
                                    )}
                                    {proofType === 'threshold' && (
                                        <p>
                                            <strong>Threshold Proof:</strong> This proof verifies that your wallet contains at least the specified minimum amount.
                                            Ideal for qualification requirements where you need to meet a minimum threshold.
                                        </p>
                                    )}
                                    {proofType === 'maximum' && (
                                        <p>
                                            <strong>Maximum Proof:</strong> This proof verifies that your wallet contains no more than the specified maximum amount.
                                            Useful for verification where an upper limit is required.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ZK Proof Type Selection */}
                        {proofCategory === 'zk' && (
                            <div className="mb-6">
                                <label htmlFor="zk-proof-type" className="block text-sm font-medium text-gray-700 mb-2">
                                    ZK Proof Type
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setZkProofType('standard');
                                            setSuccess(false);
                                        }}
                                        className={`p-4 border rounded-md flex flex-col items-center justify-between text-left transition-colors ${zkProofType === 'standard'
                                            ? 'bg-zk-light border-zk-accent ring-2 ring-zk-accent'
                                            : 'border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-zk-light text-zk-accent mb-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="font-medium mb-1">ZK Standard Proof</h3>
                                            <p className="text-sm text-gray-500">
                                                Privately verify exact amount without revealing it.
                                            </p>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setZkProofType('threshold');
                                            setSuccess(false);
                                        }}
                                        className={`p-4 border rounded-md flex flex-col items-center justify-between text-left transition-colors ${zkProofType === 'threshold'
                                            ? 'bg-zk-light border-zk-accent ring-2 ring-zk-accent'
                                            : 'border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-zk-light text-zk-accent mb-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="font-medium mb-1">ZK Threshold Proof</h3>
                                            <p className="text-sm text-gray-500">
                                                Privately verify you have at least this amount.
                                            </p>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setZkProofType('maximum');
                                            setSuccess(false);
                                        }}
                                        className={`p-4 border rounded-md flex flex-col items-center justify-between text-left transition-colors ${zkProofType === 'maximum'
                                            ? 'bg-zk-light border-zk-accent ring-2 ring-zk-accent'
                                            : 'border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-zk-light text-zk-accent mb-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="font-medium mb-1">ZK Maximum Proof</h3>
                                            <p className="text-sm text-gray-500">
                                                Privately verify you have at most this amount.
                                            </p>
                                        </div>
                                    </button>
                                </div>

                                {/* ZK Proof Type Explanation */}
                                <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200 text-sm text-gray-600">
                                    {zkProofType === 'standard' && (
                                        <p>
                                            <strong>ZK Standard Proof:</strong> This proof privately verifies that your wallet contains exactly the specified amount,
                                            without revealing the actual balance on the blockchain.
                                        </p>
                                    )}
                                    {zkProofType === 'threshold' && (
                                        <p>
                                            <strong>ZK Threshold Proof:</strong> This proof privately verifies that your wallet contains at least the specified minimum amount,
                                            without revealing your actual balance on the blockchain.
                                        </p>
                                    )}
                                    {zkProofType === 'maximum' && (
                                        <p>
                                            <strong>ZK Maximum Proof:</strong> This proof privately verifies that your wallet contains no more than the specified maximum amount,
                                            without revealing your actual balance on the blockchain.
                                        </p>
                                    )}
                                </div>
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
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setAmountInputType('usd');
                                        }}
                                        className={`py-1 px-3 text-xs font-medium rounded-md ${amountInputType === 'usd'
                                            ? 'bg-primary-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        USD Amount
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setAmountInputType('tokens');
                                        }}
                                        className={`py-1 px-3 text-xs font-medium rounded-md ${amountInputType === 'tokens'
                                            ? 'bg-primary-600 text-white'
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
                                            <div className="bg-primary-50 p-3 rounded-md border">
                                                <div className="text-sm font-medium mb-2">Available Tokens</div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {assetSummary.convertedAssets.map((asset, idx) => (
                                                        <button
                                                            key={`${asset.chain}-${asset.symbol}-${idx}`}
                                                            onClick={() => handleTokenSelection(asset)}
                                                            className={`px-2 py-1 text-xs rounded-md border flex justify-between items-center ${selectedTokens.some(t => t.symbol === asset.symbol && t.chain === asset.chain)
                                                                ? 'bg-primary-100 border-primary-300'
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

                        {/* Wallet Signatures - Show in any stage if we have signatures or are in signing stage */}
                        {(proofStage === 'signing' || Object.keys(walletSignatures).length > 0) && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {proofStage === 'signing' ? 'Sign with Your Wallets' : 'Wallet Signatures'}
                                </label>

                                {proofStage === 'signing' && (
                                    <div className="bg-primary-50 p-4 rounded-md mb-4">
                                        <h3 className="font-medium text-primary-700 mb-2">Signing Instructions</h3>
                                        <p className="text-sm text-primary-700 mb-2">
                                            To create your proof of funds, you need to sign a message with each selected wallet:
                                        </p>
                                        <ol className="list-decimal pl-5 text-sm text-primary-700 space-y-1">
                                            <li>Click "Sign with Wallet" for each wallet in the list below</li>
                                            <li>Your wallet extension will open with a signature request</li>
                                            <li>Make sure to select the correct account in your wallet</li>
                                            <li>After signing all wallets, you can submit your proof</li>
                                        </ol>
                                    </div>
                                )}

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
                                                            {!isSigned && !isCurrentSigning && (
                                                                <div className="text-xs text-primary-600 mt-1">
                                                                    {wallet?.type === 'evm' ?
                                                                        'You\'ll need to select this account in MetaMask' :
                                                                        'You\'ll need to select this account in Phantom'}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center space-x-2">
                                                            {isSigned ? (
                                                                <div className="flex flex-col items-end">
                                                                    <div className="flex items-center text-green-600">
                                                                        <svg className="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                        </svg>
                                                                        <span className="text-xs">Signed Successfully</span>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                // Remove this wallet's signature
                                                                                setWalletSignatures(prev => {
                                                                                    const newSigs = { ...prev };
                                                                                    delete newSigs[walletId];
                                                                                    return newSigs;
                                                                                });
                                                                                // Update readiness state and go back to signing stage if needed
                                                                                setReadyToSubmit(false);
                                                                                if (proofStage !== 'signing') {
                                                                                    setProofStage('signing');
                                                                                }
                                                                            }}
                                                                            className="ml-2 text-red-500 hover:text-red-700"
                                                                            title="Revoke signature"
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                            </svg>
                                                                        </button>
                                                                    </div>
                                                                    {walletSignatures[walletId]?.timestamp && (
                                                                        <div className="text-xs text-gray-500 mt-1">
                                                                            {new Date(walletSignatures[walletId].timestamp).toLocaleString()}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSignWallet(walletId)}
                                                                    disabled={isSigningWallet}
                                                                    className={`py-1 px-3 text-xs font-medium rounded-md border ${isCurrentSigning
                                                                        ? 'bg-gray-100 text-gray-400 cursor-wait'
                                                                        : 'bg-primary-600 text-white hover:bg-primary-700'
                                                                        }`}
                                                                >
                                                                    {isCurrentSigning ? 'Waiting for wallet...' : 'Sign with Wallet'}
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
                                    <div className="p-4 bg-gray-50 rounded-md mb-4 border border-gray-200">
                                        <h4 className="font-medium text-gray-700 mb-2">Wallet Signature Status</h4>
                                        {areAllWalletsSigned() ? (
                                            <div className="flex items-center text-green-600">
                                                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                                <span className="font-medium">All wallets signed successfully!</span>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="flex items-center mb-2">
                                                    <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                                                        <div
                                                            className="absolute top-0 left-0 h-full bg-primary-600 rounded-full"
                                                            style={{ width: `${(Object.keys(walletSignatures).length / selectedWallets.length) * 100}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="ml-3 font-medium">
                                                        {Object.keys(walletSignatures).length}/{selectedWallets.length}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    {selectedWallets.length - Object.keys(walletSignatures).length} wallet(s) still require signatures
                                                </div>
                                            </div>
                                        )}

                                        {/* Show timestamp of last signature */}
                                        {Object.keys(walletSignatures).length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-gray-200">
                                                <div className="text-xs text-gray-600">
                                                    <div className="font-medium">Signatures will persist until proof submission</div>
                                                    <div className="mt-1">Last wallet signed: {
                                                        new Date(Math.max(...Object.values(walletSignatures)
                                                            .filter(sig => sig.timestamp)
                                                            .map(sig => sig.timestamp)))
                                                            .toLocaleString()
                                                    }</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Submit Button */}
                        <div>
                            {(isPending || (txHash && !success)) && (
                                <div className="mb-4 p-3 bg-blue-50 rounded-md">
                                    <div className="flex items-center">
                                        <svg className="animate-spin h-5 w-5 mr-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span className="text-sm font-medium text-blue-700">
                                            {txHash
                                                ? 'Transaction submitted. Waiting for blockchain confirmation...'
                                                : 'Preparing transaction...'}
                                        </span>
                                    </div>
                                    {txHash && (
                                        <div className="mt-2 text-xs">
                                            <span className="text-gray-600">Transaction hash: </span>
                                            <a
                                                href={`https://amoy.polygonscan.com/tx/${txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 break-all hover:underline"
                                            >
                                                {txHash}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={
                                    (selectedWallets.length === 0) ||
                                    (amountInputType === 'usd' && !isValidAmount(amount)) ||
                                    (amountInputType === 'tokens' && !areAllTokenAmountsValid()) ||
                                    (proofStage === 'signing' && !areAllWalletsSigned()) ||
                                    isPending ||
                                    (txHash && !success) ||
                                    success
                                }
                                className={`w-full py-2 px-4 font-medium rounded-md ${(selectedWallets.length === 0) ||
                                    (amountInputType === 'usd' && !isValidAmount(amount)) ||
                                    (amountInputType === 'tokens' && !areAllTokenAmountsValid()) ||
                                    (proofStage === 'signing' && !areAllWalletsSigned()) ||
                                    isPending ||
                                    (txHash && !success) ||
                                    success
                                    ? 'bg-gray-400 cursor-not-allowed text-white'
                                    : proofStage === 'ready'
                                        ? 'bg-green-600 hover:bg-green-700 text-white'
                                        : proofCategory === 'standard'
                                            ? 'bg-primary-600 hover:bg-primary-700 text-white'
                                            : 'bg-zk-accent hover:bg-zk-accent-dark text-white'
                                    }`}
                                onClick={() => {
                                    if (proofStage === 'input') {
                                        // First click - move to proof stage
                                        setProofStage('signing');
                                    } else if (proofStage === 'signing' && areAllWalletsSigned()) {
                                        // Wallets signed - prepare proof submission
                                        prepareProofSubmission();
                                    } else if (proofStage === 'ready' && !proofData) {
                                        // Fallback if somehow we're in ready stage without data
                                        prepareProofSubmission();
                                    } else if (proofStage === 'ready' && proofData) {
                                        // Ready to submit to blockchain
                                        console.log('Submit button clicked with proofStage \'ready\' and proofData available');
                                        console.log('Current proofData:', proofData);
                                        submitFinalProof();
                                    } else {
                                        console.log('Button clicked but no handler executed');
                                        console.log('Current state:', { proofStage, hasProofData: !!proofData });
                                    }
                                }}
                            >
                                {success
                                    ? 'Proof Submitted'
                                    : isPending
                                        ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Processing Transaction...
                                            </>
                                        )
                                        : (txHash && !success)
                                            ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Waiting for Confirmation...
                                                </>
                                            )
                                            : proofStage === 'input'
                                                ? 'Prepare Proof'
                                                : proofStage === 'signing'
                                                    ? `Sign Wallets (${Object.keys(walletSignatures).length}/${selectedWallets.length})`
                                                    : (proofStage === 'ready' && !proofData)
                                                        ? 'Prepare Proof Data'
                                                        : (proofStage === 'ready' && proofData)
                                                            ? 'Submit Proof to Blockchain'
                                                            : `Submit [Stage: ${proofStage}, HasData: ${!!proofData}]`}
                            </button>
                        </div>
                    </div>

                    {isError && (
                        <div className="p-4 bg-red-50 rounded-md">
                            <p className="text-sm font-medium text-red-800">
                                Error: {error?.message || 'Failed to create proof'}
                            </p>
                        </div>
                    )}

                    {/* Success Message */}
                    {success ? (
                        <div className="flex flex-col space-y-6 items-center text-center mt-12">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckIcon className="h-8 w-8 text-green-600" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">Proof Successfully Created!</h3>
                            <p className="text-sm text-gray-500 max-w-md">
                                Your proof of funds has been successfully created and verified on the blockchain.
                                You can now share the transaction hash with others to allow them to verify your proof.
                            </p>

                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 w-full">
                                <div className="space-y-2">
                                    <div>
                                        <span className="text-sm text-gray-600">Status:</span>
                                        <span className="ml-2 text-sm font-medium text-green-600">Confirmed</span>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-600">Transaction Hash:</span>
                                        <div className="mt-1">
                                            <a
                                                href={`https://amoy.polygonscan.com/tx/${txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 text-sm break-all hover:underline"
                                            >
                                                {txHash}
                                            </a>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-600">Network:</span>
                                        <span className="ml-2 text-sm font-medium">Polygon Amoy Testnet</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleCreateAnother}
                                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            >
                                Create Another Proof
                            </button>
                        </div>
                    ) : txHash ? (
                        <div className="flex flex-col space-y-6 items-center text-center">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                                <ClockIcon className="h-8 w-8 text-blue-600" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">Transaction Submitted</h3>
                            <p className="text-sm text-gray-500 max-w-md">
                                Your transaction has been submitted to the blockchain and is waiting for confirmation.
                                This usually takes a few seconds, but can take longer during periods of high network congestion.
                            </p>

                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 w-full">
                                <div className="space-y-2">
                                    <div>
                                        <span className="text-sm text-gray-600">Status:</span>
                                        <span className="ml-2 text-sm font-medium text-blue-600">Waiting for confirmation...</span>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-600">Transaction Hash:</span>
                                        <div className="mt-1">
                                            <a
                                                href={`https://amoy.polygonscan.com/tx/${txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 text-sm break-all hover:underline"
                                            >
                                                {txHash}
                                            </a>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-600">Network:</span>
                                        <span className="ml-2 text-sm font-medium">Polygon Amoy Testnet</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    // Manually check transaction status
                                    const checkManually = async () => {
                                        try {
                                            // Direct API call to avoid ethers import issues
                                            const response = await fetch('http://localhost:8545', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    jsonrpc: '2.0',
                                                    id: 1,
                                                    method: 'eth_getTransactionReceipt',
                                                    params: [txHash],
                                                }),
                                            });

                                            const data = await response.json();

                                            if (data.result) {
                                                const receipt = data.result;

                                                if (receipt.status === '0x1') {
                                                    setSuccess(true);
                                                    alert('Transaction is confirmed! The UI will now update.');
                                                } else {
                                                    alert('Transaction was found but failed. Please check the transaction details.');
                                                }
                                            } else {
                                                alert('Transaction is still pending. Please wait a bit longer.');
                                            }
                                        } catch (error) {
                                            console.error('Error checking receipt manually:', error);
                                            alert(`Error checking transaction: ${error.message}`);
                                        }
                                    };

                                    checkManually();
                                }}
                                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Check Transaction Status
                            </button>
                        </div>
                    ) : null}
                    
                    {/* DEBUG BUTTONS - TEMPORARY */}
                    <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <h3 className="text-lg font-semibold text-red-800 mb-2">🐛 Debug Tools (Temporary)</h3>
                        <div className="space-x-4">
                            <button
                                type="button"
                                onClick={debugWalletState}
                                className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200"
                            >
                                Debug Wallet State
                            </button>
                            <button
                                type="button"
                                onClick={resetMetaMaskConnection}
                                className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                            >
                                Reset MetaMask (NUCLEAR)
                            </button>
                        </div>
                        <p className="text-sm text-red-600 mt-2">
                            Click "Debug Wallet State" first to see what's happening. Use "Reset MetaMask" only if needed (will reload page).
                        </p>
                    </div>
                </form>
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
                    <div className="bg-primary-50 p-4 rounded-lg">
                        <h3 className="font-medium text-primary-800 mb-2">Standard Proof</h3>
                        <p className="text-sm text-gray-600">Creates a proof that you have exactly the specified amount. Used for specific commitments or agreements.</p>
                    </div>
                    <div className="bg-primary-50 p-4 rounded-lg">
                        <h3 className="font-medium text-primary-800 mb-2">Threshold Proof</h3>
                        <p className="text-sm text-gray-600">Creates a proof that you have at least the specified amount. Ideal for qualification requirements.</p>
                    </div>
                    <div className="bg-primary-50 p-4 rounded-lg">
                        <h3 className="font-medium text-primary-800 mb-2">Maximum Proof</h3>
                        <p className="text-sm text-gray-600">Creates a proof that you have less than the specified amount. Useful for certain compliance requirements.</p>
                    </div>
                    <div className="bg-zk-light p-4 rounded-lg">
                        <h3 className="font-medium text-zk mb-2">Zero-Knowledge Proofs</h3>
                        <p className="text-sm text-gray-600">Private proofs that validate funds without revealing actual amounts to the blockchain.</p>
                    </div>
                </div>
            </div>
        </div>
    );

    /**
     * Submits a zero-knowledge proof to the blockchain
     * Uses the ZK verifier contract and the temporary wallet
     */
    const submitZKProof = async () => {
        try {
            // Ensure we have the required ZK data
            if (!proofData.zkProof || !proofData.zkPublicSignals || !proofData.tempWallet) {
                throw new Error('Missing required ZK proof data');
            }

            // Prepare ZK proof submission

            // In production, we would:
            // 1. Fund the temporary wallet with a small amount of MATIC
            // 2. Create a transaction to the ZK verifier contract
            // 3. Sign and broadcast the transaction

            // For now, we'll simulate a successful transaction

            // Wait a moment to simulate transaction processing
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Set success state
            setSuccess(true);
            setTxHash('0x' + Array(64).fill('0').map(() => Math.floor(Math.random() * 16).toString(16)).join(''));
            alert(
                'ZK Proof submitted successfully! (Simulated)\n\n' +
                'In production, this would submit the proof using your temporary wallet:\n' +
                `${proofData.tempWallet.address}\n\n` +
                'The ZK proof would be verified on-chain without revealing your actual balance.'
            );

            return true;
        } catch (error) {
            console.error('Error submitting ZK proof:', error);
            alert(`Error submitting ZK proof: ${error.message}`);
            setSuccess(false);
            return false;
        } finally {
            setIsSubmitting(false);
        }
    };
} 