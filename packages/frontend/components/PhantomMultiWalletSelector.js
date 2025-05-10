/**
 * Phantom Multi-Wallet Selector Component
 * 
 * Specialized interface for detecting and connecting multiple Phantom wallet accounts.
 * This component provides a wizard-like experience to guide users through the process
 * of detecting multiple Solana wallets from the Phantom browser extension and selecting
 * which ones to connect.
 * 
 * Key features:
 * - Interactive multi-step wallet detection process
 * - Detection of wallet changes via Phantom's accountChanged events
 * - Selection interface for choosing which detected wallets to connect
 * - Automatic detection of already detected wallets to prevent duplicates
 * - Integration with the wallet connection persistence system
 * - Clear status and error handling for user feedback
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onClose - Callback function to close the selector modal
 */

import { useState, useEffect, useRef } from 'react';
import { saveWalletConnection } from '@proof-of-funds/common/utils/walletHelpers';
import { usePhantomMultiWallet } from '@proof-of-funds/common/PhantomMultiWalletContext';

export default function PhantomMultiWalletSelector({ onClose }) {
    const [detectedWallets, setDetectedWallets] = useState([]);
    const [selectedWalletIds, setSelectedWalletIds] = useState(new Set());
    const [status, setStatus] = useState('initial'); // initial, detecting, listening, selecting, success, error
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    // Get context for multi wallet functionality
    const phantomMultiWallet = usePhantomMultiWallet();

    // References for managing connection state
    const detectionInProgressRef = useRef(false);
    const detectedPublicKeysRef = useRef(new Set());
    const accountChangeListenerRef = useRef(null);

    // Set up account change listener - only triggered after explicit user action
    useEffect(() => {
        // Function to handle wallet account changes - ONLY after explicit authentication
        const handleAccountChange = (publicKey) => {
            // Skip automatic detection on initial load - require explicit auth first
            if (status === 'initial' || !publicKey) {
                console.log('Phantom wallet disconnected or initial state - skipping auto-detection');
                return;
            }

            const walletAddress = publicKey.toString();
            console.log('Phantom wallet account changed:', walletAddress);

            // Make sure this is coming from Phantom - prevent cross-wallet detection
            if (!window.solana || !window.solana.isPhantom) {
                console.log('Ignoring wallet event - not from Phantom');
                return;
            }
            
            // Ensure this wallet address is from Phantom, not another provider
            const matchesCurrentPhantomWallet = window.solana.publicKey && 
                                               window.solana.publicKey.toString() === walletAddress;
            if (!matchesCurrentPhantomWallet) {
                console.log('Ignoring wallet address - not from current Phantom connection');
                return;
            }

            // Only add to our list if not already there
            if (!detectedPublicKeysRef.current.has(walletAddress)) {
                // Ensure walletAddress is a string before using substring
                const displayAddress = typeof walletAddress === 'string' && walletAddress.length > 10
                    ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`
                    : walletAddress;
                
                // Create unique ID specifically for Phantom to prevent ID collisions
                const phantomPrefix = 'phantom-wallet-';
                const uniqueId = `${phantomPrefix}${walletAddress.substring(0, 10)}`;
                
                const newWallet = {
                    id: uniqueId,
                    address: walletAddress,
                    displayAddress: displayAddress,
                    type: 'phantom',
                    provider: 'phantom',
                    name: `Phantom Wallet ${detectedWallets.length + 1}`
                };

                setDetectedWallets(prev => [...prev, newWallet]);
                detectedPublicKeysRef.current.add(walletAddress);

                // Auto-select newly detected wallets ONLY in listening mode (explicit user action)
                if (status === 'detecting' || status === 'listening') {
                    setSelectedWalletIds(prev => {
                        const newSet = new Set(prev);
                        newSet.add(uniqueId);
                        return newSet;
                    });
                }

                if (status === 'listening') {
                    setMessage(`New wallet ${displayAddress} detected!`);
                    setStatus('selecting');
                }
            } else if (status === 'listening') {
                // If wallet is already detected but we're in listening mode, provide feedback
                // Ensure walletAddress is a string before using substring
                const displayAddress = typeof walletAddress === 'string' && walletAddress.length > 10
                    ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`
                    : walletAddress;
                setMessage(`Wallet ${displayAddress} already detected. Try switching to a different wallet in Phantom.`);
            }
        };

        // Only set up the listener if Phantom is available AND after explicit user action
        if (window.solana && window.solana.isPhantom && status !== 'initial') {
            // Set the listener and save reference
            console.log('Setting up Phantom account change listener');
            accountChangeListenerRef.current = handleAccountChange;
            window.solana.on('accountChanged', handleAccountChange);
            
            // Only check current connection in detecting/listening modes (after user action)
            if ((status === 'detecting' || status === 'listening') && 
                window.solana.isConnected && window.solana.publicKey) {
                handleAccountChange(window.solana.publicKey);
            }
        }

        // Clean up the listener on component unmount
        return () => {
            if (window.solana && window.solana.isPhantom && accountChangeListenerRef.current) {
                console.log('Removing Phantom account change listener');
                window.solana.off('accountChanged', accountChangeListenerRef.current);
                accountChangeListenerRef.current = null;
            }
        };
    }, [status, detectedWallets.length]);

    // Toggle wallet selection
    const toggleWalletSelection = (walletId) => {
        // Ensure we're only selecting Phantom wallets by validating ID
        if (!walletId.startsWith('phantom-wallet-')) {
            console.warn('Attempted to select non-Phantom wallet:', walletId);
            return;
        }
        
        setSelectedWalletIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(walletId)) {
                newSet.delete(walletId);
            } else {
                newSet.add(walletId);
            }
            return newSet;
        });
    };

    // Select all wallets - only Phantom wallets
    const selectAllWallets = () => {
        // Filter for only Phantom wallets
        const phantomWalletIds = detectedWallets
            .filter(wallet => wallet.type === 'phantom' && wallet.id.startsWith('phantom-wallet-'))
            .map(wallet => wallet.id);
        
        setSelectedWalletIds(new Set(phantomWalletIds));
    };

    // Deselect all wallets
    const deselectAllWallets = () => {
        setSelectedWalletIds(new Set());
    };

    // Start the wallet detection process with enhanced detection
    const startWalletDetection = async () => {
        try {
            // Reset state
            setError('');
            setMessage('Preparing to connect to Phantom wallet...');
            
            // Always start fresh - clear any existing wallets
            setDetectedWallets([]);
            setSelectedWalletIds(new Set());
            detectedPublicKeysRef.current.clear();
            
            // Update status to detecting - this will enable the account change listener
            setStatus('detecting');

            // Check if Phantom is installed
            if (!window.solana || !window.solana.isPhantom) {
                setError('Phantom wallet not detected. Please install Phantom extension first.');
                setStatus('error');
                return;
            }

            // Clear any previously discovered wallets to ensure clean start
            try {
                // Clear localStorage items related to Phantom wallet discovery
                localStorage.removeItem('phantomDiscoveredWallets');
                
                // Explicitly disconnect any existing Phantom connections
                if (window.solana.isConnected) {
                    try {
                        await window.solana.disconnect();
                        console.log('Disconnected existing Phantom connection for fresh start');
                    } catch (disconnectErr) {
                        console.log('Disconnect attempt (expected):', disconnectErr);
                    }
                }
                
                setMessage('Please approve connection in the Phantom wallet popup...');
            } catch (e) {
                console.warn('Error clearing previous wallet data:', e);
            }

            // Now detect the initial wallet
            await detectInitialWallet();

        } catch (error) {
            console.error('Error starting wallet detection:', error);
            setError(`Failed to start detection: ${error.message || 'Unknown error'}`);
            setStatus('error');
        }
    };
    
    // Helper function to get currently authenticated Phantom wallets
    // This now only returns the currently authenticated wallet
    const getStoredPhantomWallets = () => {
        try {
            // Only get officially authenticated and currently connected wallets
            // by checking if Phantom is connected and has a public key
            if (window.solana && 
                window.solana.isPhantom && 
                window.solana.isConnected && 
                window.solana.publicKey) {
                
                // Get the current wallet address
                const currentWallet = window.solana.publicKey.toString();
                console.log('Retrieved currently authenticated Phantom wallet:', currentWallet);
                
                // Return just the authenticated wallet
                return [currentWallet];
            }
            
            console.log('No currently authenticated Phantom wallets found');
            return [];
        } catch (e) {
            console.error("Error getting authenticated Phantom wallet:", e);
            return [];
        }
    };

    // Detect the initial wallet
    const detectInitialWallet = async () => {
        try {
            // Reset detection in progress flag
            detectionInProgressRef.current = true;
            setMessage('Opening Phantom wallet selection popup...');

            // Force a new connection with a popup
            console.log("Requesting Phantom wallet connection...");

            let response = null;

            // Force a new connection with authentication to ensure user explicitly approves
            try {
                // First disconnect to ensure we get a fresh auth popup
                if (window.solana.isConnected) {
                    try {
                        await window.solana.disconnect();
                    } catch (disconnectErr) {
                        console.log("Disconnection attempt (expected):", disconnectErr);
                    }
                }

                // Always make a new connection with explicit auth popup
                response = await window.solana.connect({ 
                    onlyIfTrusted: false // Force showing the popup
                });
                console.log("Phantom connection response with auth:", response);
            } catch (connectErr) {
                throw new Error(`Phantom connection failed: ${connectErr.message}`);
            }

            const walletAddress = response.publicKey.toString();
            console.log("Connected to wallet:", walletAddress);

            // Format wallet address for display
            // Ensure walletAddress is a string before using substring
            const displayAddress = typeof walletAddress === 'string' && walletAddress.length > 10
                ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`
                : walletAddress;

            // Request a signature to establish trust - but make it non-blocking
            try {
                const message = `Proof of Funds: Wallet Detection\n\nThis signature confirms this wallet for multi-wallet use. You can select additional wallets after this step.\n\nWallet: ${displayAddress}`;
                const encodedMessage = new TextEncoder().encode(message);

                // Add a timeout to the signature request in case it hangs
                const signPromise = window.solana.signMessage(encodedMessage, "utf8");
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Signature request timed out")), 15000)
                );

                await Promise.race([signPromise, timeoutPromise])
                    .catch(err => {
                        console.log("Message signing skipped:", err.message);
                    });
            } catch (signError) {
                console.log("User declined to sign the message or signing failed:", signError);
                // We still continue with the detection, signing is optional
            }

            // Check if this wallet is already in our list
            const isAlreadyDetected = detectedPublicKeysRef.current.has(walletAddress);

            // Only add this wallet to our list if it's not already there
            if (!isAlreadyDetected) {
                // Create unique ID specifically for Phantom to prevent ID collisions
                const phantomPrefix = 'phantom-wallet-';
                const uniqueId = `${phantomPrefix}${walletAddress.substring(0, 10)}`;
                
                const newWallet = {
                    id: uniqueId,
                    address: walletAddress,
                    displayAddress: displayAddress,
                    type: 'phantom', 
                    provider: 'phantom',
                    name: `Phantom Wallet ${detectedWallets.length + 1}`
                };
                setDetectedWallets(prev => [...prev, newWallet]);
                detectedPublicKeysRef.current.add(walletAddress);

                // Auto-select the detected wallet
                setSelectedWalletIds(prev => {
                    const newSet = new Set(prev);
                    newSet.add(uniqueId);
                    return newSet;
                });

                setMessage(`Wallet ${displayAddress} detected successfully!`);
            } else {
                setMessage(`Wallet ${displayAddress} is already detected.`);
            }

            setStatus('selecting');
            detectionInProgressRef.current = false;

        } catch (error) {
            console.error('Error detecting wallet:', error);
            const errorMessage = getPhantomErrorMessage(error);
            setError(errorMessage);
            setStatus('selecting');
            detectionInProgressRef.current = false;
        }
    };

    // Get a user-friendly error message for Phantom wallet errors
    const getPhantomErrorMessage = (error) => {
        // Handle specific error codes from Phantom
        if (error.code === 4001) {
            return 'Connection request was rejected. Please approve the connection in the Phantom popup.';
        } else if (error.code === -32002) {
            return 'A connection request is already pending. Please check your Phantom wallet extension.';
        } else if (error.code === -32603) {
            return 'Phantom extension encountered an internal error. Please try refreshing the page.';
        } else if (error.name === 'WalletConnectionError') {
            return 'Unable to connect to Phantom wallet. Please ensure the extension is installed and unlocked.';
        } else if (error.message?.includes('disconnected port')) {
            return 'Connection to Phantom was interrupted. This often happens when another wallet extension is also active. Try disabling other wallet extensions temporarily.';
        }

        // Default error message
        return `Connection failed: ${error.message || 'Unknown error'}. Try refreshing the page or restarting your browser.`;
    };

    // Start listening for wallet changes - guide user to change wallets in the extension
    const startListeningForWalletChanges = async () => {
        try {
            setStatus('listening');
            setMessage('Opening Phantom wallet and waiting for wallet changes...');

            // Force open the Phantom wallet popup by requesting a connection
            if (window.solana && window.solana.isPhantom) {
                try {
                    // First disconnect to ensure we get a fresh auth popup
                    if (window.solana.isConnected) {
                        try {
                            await window.solana.disconnect();
                        } catch (err) {
                            console.log("Disconnection attempt (expected):", err);
                        }
                    }
                    
                    // Request a new connection with proper authentication
                    console.log("Requesting new Phantom wallet connection...");
                    setMessage('Please approve connection in the Phantom popup...');
                    
                    try {
                        // Request a new connection (force auth popup)
                        const response = await window.solana.connect({ 
                            onlyIfTrusted: false // Force showing the popup
                        });
                        
                        console.log("New wallet connected:", response.publicKey.toString());
                        setMessage('New wallet connected! You can now select this wallet.');
                    } catch (connectErr) {
                        console.log("Connection attempt result:", connectErr);
                        setMessage('Please try connecting a wallet using the Phantom extension.');
                    }
                } catch (error) {
                    console.error("Error opening Phantom wallet:", error);
                    setMessage('Please open your Phantom wallet extension manually and switch wallets.');
                }
            } else {
                setError('Phantom wallet not detected. Please install the Phantom extension first.');
                setStatus('error');
            }
        } catch (error) {
            console.error("Error starting wallet detection:", error);
            setError(`Failed to start wallet detection: ${error.message || 'Unknown error'}`);
            setStatus('error');
        }
    };

    // Cleanup function when component unmounts
    useEffect(() => {
        return () => {
            // Clear in-memory wallet list to prevent memory leaks
            detectedPublicKeysRef.current.clear();
        };
    }, []);

    // Complete the detection process and save selected wallets
    const handleFinish = async () => {
        try {
            // Get selected wallet addresses
            const selectedWallets = detectedWallets.filter(wallet =>
                selectedWalletIds.has(wallet.id)
            );

            // Exit if no wallets were selected
            if (selectedWallets.length === 0) {
                setError('No wallets were selected. Please select at least one wallet.');
                return;
            }

            setStatus('success');
            setMessage('Saving your selected wallets...');

            // Get selected wallet addresses, but verify they're actually authenticated
            const selectedWalletAddresses = selectedWallets.map(wallet => wallet.address);

            // Get the currently authenticated Phantom wallet to verify
            let currentlyAuthenticatedWallet = null;
            if (window.solana && window.solana.isPhantom && window.solana.isConnected && window.solana.publicKey) {
                currentlyAuthenticatedWallet = window.solana.publicKey.toString();
            }

            console.log("Currently authenticated Phantom wallet:", currentlyAuthenticatedWallet);
            console.log("Selected wallets to save:", selectedWalletAddresses);

            // Keep track of which wallets we successfully saved
            const savedWallets = [];

            // Only save wallets that have been properly authenticated
            for (const walletAddress of selectedWalletAddresses) {
                // Verify this is a wallet we detected through proper authentication
                const isDetectedWallet = detectedPublicKeysRef.current.has(walletAddress);
                
                if (isDetectedWallet) {
                    // This wallet was properly detected through the Phantom popup
                    await saveWalletConnection('phantom', [walletAddress]);
                    savedWallets.push(walletAddress);
                    console.log(`Saved authenticated wallet: ${walletAddress}`);
                } else {
                    console.warn(`Skipped saving unauthenticated wallet: ${walletAddress}`);
                }
            }
            
            // Update message to show how many were actually saved
            setMessage(`Successfully saved ${savedWallets.length} authenticated wallet(s)!`);
            
            // Force refresh of wallet UI in all components
            const refreshEvent = new CustomEvent('wallet-connection-changed', {
                detail: { timestamp: Date.now(), walletType: 'phantom', refreshUI: true }
            });
            window.dispatchEvent(refreshEvent);

            // Mark as user initiated to start asset scanning
            localStorage.setItem('userInitiatedConnection', 'true');
            
            // Clear any previous disconnection flag since user is explicitly connecting
            localStorage.removeItem('user_disconnected_wallets');

            // Dispatch an event to notify other components about the wallet connection change
            const walletChangeEvent = new CustomEvent('wallet-connection-changed', {
                detail: { timestamp: Date.now(), walletType: 'phantom' }
            });
            window.dispatchEvent(walletChangeEvent);
            console.log('Dispatched wallet-connection-changed event from PhantomMultiWalletSelector');

            setMessage(`Successfully saved ${selectedWallets.length} wallet(s)!`);

            // Notify parent about connection completion after a brief delay
            // to allow the user to see the success message
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (error) {
            console.error('Error in finish process:', error);
            setError(`Error saving wallets: ${error.message || 'Unknown error'}`);
            setStatus('error');
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Connect Phantom Wallets</h2>
                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-700 p-2"
                    aria-label="Close"
                >
                    ✕
                </button>
            </div>

            {/* Detected wallets display */}
            {detectedWallets.length > 0 && status !== 'success' && (
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium text-lg">Detected Wallets ({detectedWallets.length})</h3>
                        <div className="flex items-center space-x-2 text-sm">
                            <button
                                onClick={selectAllWallets}
                                className="text-blue-600 hover:text-blue-800"
                            >
                                Select All
                            </button>
                            <span>|</span>
                            <button
                                onClick={deselectAllWallets}
                                className="text-blue-600 hover:text-blue-800"
                            >
                                Deselect All
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
                        {detectedWallets.map((wallet) => (
                            <div
                                key={wallet.id}
                                className={`p-3 rounded-md border flex items-center justify-between cursor-pointer transition-colors ${selectedWalletIds.has(wallet.id)
                                    ? 'bg-blue-50 border-blue-300'
                                    : 'bg-gray-50 border-gray-200'
                                    }`}
                                onClick={() => toggleWalletSelection(wallet.id)}
                            >
                                <div className="flex items-center">
                                    <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full flex items-center justify-center text-xs mr-3 flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M18.9,8.5H5.1c-1.6,0-2.8,1.3-2.8,2.8v5.4c0,1.6,1.3,2.8,2.8,2.8h13.7c1.6,0,2.8-1.3,2.8-2.8v-5.4C21.7,9.8,20.4,8.5,18.9,8.5z M12,15.3c-0.9,0-1.6-0.7-1.6-1.6s0.7-1.6,1.6-1.6s1.6,0.7,1.6,1.6S12.9,15.3,12,15.3z M18.5,9.9c-0.2,0-0.4-0.2-0.4-0.4s0.2-0.4,0.4-0.4s0.4,0.2,0.4,0.4S18.7,9.9,18.5,9.9z" />
                                            <path d="M17.7,4.5L17.7,4.5l-3.8,0c-0.2,0-0.4,0.2-0.4,0.4s0.2,0.4,0.4,0.4l3.8,0c0.2,0,0.4-0.2,0.4-0.4S17.9,4.5,17.7,4.5z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="font-mono text-sm truncate">{wallet.displayAddress}</div>
                                        <div className="text-xs text-gray-500">Phantom Wallet</div>
                                    </div>
                                </div>
                                <div className="ml-3">
                                    <div className={`w-5 h-5 border rounded-md flex items-center justify-center ${selectedWalletIds.has(wallet.id)
                                        ? 'bg-blue-600 border-blue-600'
                                        : 'bg-white border-gray-300'
                                        }`}>
                                        {selectedWalletIds.has(wallet.id) && (
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Initial state */}
            {status === 'initial' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md mb-6">
                    <h3 className="font-medium text-blue-800 mb-2">Detect Multiple Phantom Wallets</h3>
                    <p className="text-sm text-blue-700 mb-4">
                        Detect and select multiple Phantom wallets to use simultaneously in this app.
                    </p>
                    <ol className="list-decimal pl-5 text-sm text-blue-700 mb-4 space-y-2">
                        <li>Click "Start Detection" to begin</li>
                        <li>Select a wallet when the Phantom popup appears</li>
                        <li>Find more wallets by switching directly in the Phantom extension</li>
                        <li>Select which detected wallets you want to connect</li>
                    </ol>
                    <button
                        onClick={startWalletDetection}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
                    >
                        <span className="flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                            Start Detection
                        </span>
                    </button>
                </div>
            )}

            {/* Detecting state */}
            {status === 'detecting' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-blue-800">Opening Wallet Selector</h3>
                        <div className="inline-block w-5 h-5 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>

                    <div className="bg-white p-3 rounded-md border border-blue-100 mb-4">
                        <p className="text-sm text-blue-800">{message}</p>
                    </div>

                    <div className="text-sm text-blue-700 mb-4">
                        <p>When the Phantom popup appears:</p>
                        <p className="mt-2">1. Select the wallet you want to detect</p>
                        <p className="mt-1">2. Click "Connect" to approve the connection</p>
                    </div>
                </div>
            )}

            {/* Listening state - actively listening for wallet changes */}
            {status === 'listening' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-blue-800">Listening for Wallet Changes</h3>
                        <div className="inline-block w-5 h-5 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>

                    <div className="bg-white p-3 rounded-md border border-blue-100 mb-4">
                        <p className="text-sm text-blue-800">{message}</p>
                    </div>

                    <div className="text-sm text-blue-700 mb-4">
                        <p className="font-medium mb-1">To detect another wallet:</p>
                        <ol className="list-decimal pl-5 space-y-1 mt-2">
                            <li>Open the Phantom browser extension</li>
                            <li>Click on the wallet icon in the top-right</li>
                            <li>Select a different wallet from your list</li>
                            <li>Or click "Add new wallet" to create/import one</li>
                        </ol>
                    </div>

                    <button
                        onClick={() => setStatus('selecting')}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
                    >
                        <span className="flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Stop Listening
                        </span>
                    </button>
                </div>
            )}

            {/* Selection state - after wallets are detected, selecting which to connect */}
            {status === 'selecting' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md mb-6">
                    <h3 className="font-medium text-blue-800 mb-2">Select Wallets to Connect</h3>

                    <div className="bg-white p-3 rounded-md border border-blue-100 mb-4">
                        <p className="text-sm text-blue-800">{message}</p>
                    </div>

                    <div className="text-sm text-blue-700 mb-4">
                        <p className="font-medium mb-1">
                            {selectedWalletIds.size} of {detectedWallets.length} wallets selected
                        </p>
                        <p>• Check the wallets you want to connect</p>
                        <p>• Click "Detect More Wallets" to find additional wallets</p>
                        <p>• Click "Connect Selected Wallets" when ready</p>
                    </div>

                    <div className="flex gap-3 mb-3">
                        <button
                            onClick={startListeningForWalletChanges}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
                        >
                            <span className="flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                Detect More Wallets
                            </span>
                        </button>
                    </div>

                    <button
                        onClick={handleFinish}
                        disabled={selectedWalletIds.size === 0}
                        className={`w-full px-4 py-2 text-white rounded-md font-medium ${selectedWalletIds.size > 0
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-gray-400 cursor-not-allowed'
                            }`}
                    >
                        <span className="flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Connect {selectedWalletIds.size} Selected {selectedWalletIds.size === 1 ? 'Wallet' : 'Wallets'}
                        </span>
                    </button>
                </div>
            )}

            {/* Final success state */}
            {status === 'success' && (
                <div className="my-8 text-center text-green-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-lg font-medium">Successfully connected {selectedWalletIds.size} wallet(s)!</p>
                    <p className="text-sm text-gray-600 mt-2">
                        You can now use all your connected Phantom wallets simultaneously.
                    </p>
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md">
                    {error}
                    {status === 'error' && (
                        <div className="mt-4">
                            <button
                                onClick={() => {
                                    setError('');
                                    setStatus('initial');
                                }}
                                className="px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* How it works footer */}
            {status !== 'success' && (
                <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500">
                    <p className="mb-1"><strong>How wallet detection works:</strong></p>
                    <p>• We listen for wallet changes in the Phantom extension</p>
                    <p>• Simply switch wallets in Phantom to detect more</p>
                    <p>• Select which detected wallets you want to connect</p>
                    <p>• You'll be able to use all connected wallets simultaneously</p>
                </div>
            )}
        </div>
    );
}
