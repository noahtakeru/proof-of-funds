import { useState, useEffect, useRef } from 'react';
import { saveWalletConnection } from '../lib/walletHelpers';

export default function PhantomMultiWalletSelector({ onClose }) {
    const [connectedWallets, setConnectedWallets] = useState([]);
    const [status, setStatus] = useState('initial'); // initial, connecting, paused, success, error
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    // References for managing connection state
    const connectionInProgressRef = useRef(false);
    const connectedPublicKeysRef = useRef(new Set());

    // Start the wallet connection process
    const startWalletConnection = async () => {
        try {
            // Reset state
            setError('');
            setMessage('Connecting to Phantom wallet...');
            setStatus('connecting');

            // Check if Phantom is installed
            if (!window.solana || !window.solana.isPhantom) {
                setError('Phantom wallet not detected. Please install Phantom extension first.');
                setStatus('error');
                return;
            }

            // Now connect to the wallet
            await connectWallet();

        } catch (error) {
            console.error('Error starting wallet connection:', error);
            setError(`Failed to start connection: ${error.message || 'Unknown error'}`);
            setStatus('error');
        }
    };

    // Connect to a wallet and handle the connection process
    const connectWallet = async () => {
        try {
            // Reset connection in progress flag to allow new connection attempt
            connectionInProgressRef.current = true;
            setMessage('Opening Phantom wallet selection popup...');

            // Force a new connection with a popup
            console.log("Requesting Phantom wallet connection...");
            const response = await window.solana.connect({ onlyIfTrusted: false });
            console.log("Connection response:", response);

            const walletAddress = response.publicKey.toString();
            console.log("Connected to wallet:", walletAddress);

            // Format wallet address for display
            const displayAddress = `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;

            // Request a signature to establish trust
            try {
                const message = `Connect wallet ${displayAddress} to Proof of Funds`;
                const encodedMessage = new TextEncoder().encode(message);
                await window.solana.signMessage(encodedMessage, "utf8");
            } catch (signError) {
                console.log("User declined to sign the message", signError);
                // We'll still continue with the connection
            }

            // Check if this wallet is already in our list (only for internal tracking)
            const isAlreadyConnected = connectedPublicKeysRef.current.has(walletAddress);

            // Only add this wallet to our list if it's not already there
            if (!isAlreadyConnected) {
                const newWallet = {
                    address: walletAddress,
                    displayAddress: displayAddress,
                };
                setConnectedWallets(prev => [...prev, newWallet]);
                connectedPublicKeysRef.current.add(walletAddress);
                setMessage(`New wallet ${displayAddress} connected successfully!`);
            } else {
                setMessage(`Wallet ${displayAddress} is already connected.`);
            }

            setStatus('paused');
            connectionInProgressRef.current = false;

        } catch (error) {
            console.error('Error connecting to wallet:', error);
            if (error.code === 4001) { // User rejected
                setError('Connection request was rejected. Please approve the connection in the Phantom popup.');
            } else {
                setError(`Connection failed: ${error.message || 'Unknown error'}`);
            }
            setStatus('paused');
            connectionInProgressRef.current = false;
        }
    };

    // Handle clicking the "Connect Next Wallet" button
    const handleConnectNextWallet = async () => {
        try {
            // Reset any errors
            setError('');

            // If a connection is in progress, ignore this request
            if (connectionInProgressRef.current) {
                return;
            }

            // Update UI to show disconnection is happening
            setStatus('connecting');
            setMessage('Disconnecting current wallet...');

            // First, disconnect from the current wallet to ensure a clean connection
            try {
                if (window.solana && window.solana.isConnected) {
                    await window.solana.disconnect();
                    console.log("Successfully disconnected from wallet");

                    // Also clear any connection state in Phantom if that method exists
                    if (window.solana._handleDisconnect) {
                        window.solana._handleDisconnect();
                    }
                }

                // Wait to ensure the disconnection is complete
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (disconnectError) {
                console.log("Error during disconnect (non-critical):", disconnectError);
                // Continue anyway since we're trying to connect a new wallet
            }

            // Now update UI to show we're connecting
            setMessage('Opening Phantom wallet selector...');

            // Now connect to the new wallet
            await connectWallet();

        } catch (error) {
            console.error('Error in connect next wallet flow:', error);
            setError(`Connection failed: ${error.message || 'Unknown error'}`);
            setStatus('paused');
            connectionInProgressRef.current = false;
        }
    };

    // Cleanup function when component unmounts
    useEffect(() => {
        return () => {
            // Disconnect from Phantom if connected
            if (window.solana && window.solana.isConnected) {
                window.solana.disconnect().catch(console.error);
            }
        };
    }, []);

    // Complete the connection process and save all wallets
    const handleFinish = () => {
        try {
            setStatus('success');

            // Disconnect from Phantom if connected
            if (window.solana && window.solana.isConnected) {
                window.solana.disconnect().catch(console.error);
            }

            // Get all connected wallet addresses
            const walletAddresses = connectedWallets.map(wallet => wallet.address);

            // Save the connection information - 
            // We need to save each wallet address individually since saveWalletConnection
            // only processes the first item in the array for phantom wallets
            if (walletAddresses.length > 0) {
                // Track successful saves
                let saveSuccess = true;

                // Save each wallet address individually
                walletAddresses.forEach(address => {
                    const result = saveWalletConnection('phantom', [address]);
                    if (!result) {
                        saveSuccess = false;
                        console.error('Failed to save wallet:', address);
                    }
                });

                // Log the result
                if (saveSuccess) {
                    console.log(`Successfully saved ${walletAddresses.length} Phantom wallets`);
                } else {
                    console.warn('Some wallets may not have been saved properly');
                }
            }

            // Close the selector after a short delay
            setTimeout(() => {
                if (typeof onClose === 'function') {
                    onClose();
                }
            }, 1500);
        } catch (error) {
            console.error('Error saving wallet connections:', error);
            setError(`Failed to save connections: ${error.message}`);
            setStatus('error');
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Connect Multiple Phantom Wallets</h2>
                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-700 p-2"
                    aria-label="Close"
                >
                    ✕
                </button>
            </div>

            {/* Connected wallets display */}
            {connectedWallets.length > 0 && status !== 'success' && (
                <div className="mb-6">
                    <h3 className="font-medium mb-3 text-lg">Connected Wallets ({connectedWallets.length})</h3>
                    <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
                        {connectedWallets.map((wallet, index) => (
                            <div key={wallet.address} className="p-3 bg-gray-50 rounded-md border border-gray-200 flex items-center">
                                <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full flex items-center justify-center text-xs mr-3 flex-shrink-0">
                                    {index + 1}
                                </div>
                                <div>
                                    <div className="font-mono text-sm truncate">{wallet.displayAddress}</div>
                                    <div className="text-xs text-gray-500">Phantom Wallet</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Initial state */}
            {status === 'initial' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md mb-6">
                    <h3 className="font-medium text-blue-800 mb-2">Connect Multiple Phantom Wallets</h3>
                    <p className="text-sm text-blue-700 mb-4">
                        Connect multiple Phantom wallets to use them simultaneously in this app.
                    </p>
                    <ol className="list-decimal pl-5 text-sm text-blue-700 mb-4 space-y-2">
                        <li>Click "Start Connection" to begin</li>
                        <li>Select a wallet when the Phantom popup appears</li>
                        <li>Click "Connect Next Wallet" to add additional wallets</li>
                        <li>Select a different wallet in the Phantom popup each time</li>
                    </ol>
                    <button
                        onClick={startWalletConnection}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
                    >
                        <span className="flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                            Start Connection
                        </span>
                    </button>
                </div>
            )}

            {/* Connecting state */}
            {status === 'connecting' && (
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
                        <p className="mt-2">1. Select the wallet you want to connect</p>
                        <p className="mt-1">2. Click "Connect" to approve the connection</p>
                    </div>
                </div>
            )}

            {/* Paused state - after a wallet is connected, waiting for user action */}
            {status === 'paused' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md mb-6">
                    <h3 className="font-medium text-blue-800 mb-2">Wallet Connection</h3>

                    <div className="bg-white p-3 rounded-md border border-blue-100 mb-4">
                        <p className="text-sm text-blue-800">{message}</p>
                    </div>

                    <div className="text-sm text-blue-700 mb-4">
                        <p className="font-medium mb-1">To connect additional wallets:</p>
                        <p>• Click "Connect Next Wallet" below</p>
                        <p>• The system will disconnect the current wallet first</p>
                        <p>• When the popup appears, select a different wallet</p>
                    </div>

                    <div className="flex gap-3 mb-3">
                        <button
                            onClick={handleConnectNextWallet}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
                        >
                            <span className="flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                Connect Next Wallet
                            </span>
                        </button>
                    </div>

                    <button
                        onClick={handleFinish}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700"
                    >
                        <span className="flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Complete with {connectedWallets.length} {connectedWallets.length === 1 ? 'Wallet' : 'Wallets'}
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
                    <p className="text-lg font-medium">Successfully connected {connectedWallets.length} wallet(s)!</p>
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
                    <p className="mb-1"><strong>How multi-wallet connection works:</strong></p>
                    <p>• The system disconnects between each wallet connection</p>
                    <p>• This ensures a clean selection in the Phantom popup</p>
                    <p>• Select a different wallet in the popup each time</p>
                    <p>• Each wallet needs to approve the connection only once</p>
                </div>
            )}
        </div>
    );
}
