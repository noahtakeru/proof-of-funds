import { useState, useEffect } from 'react';
import { saveWalletConnection } from '../lib/walletHelpers';

export default function PhantomMultiWalletSelector({ onClose }) {
    const [connectedWallets, setConnectedWallets] = useState([]);
    const [status, setStatus] = useState('selection'); // selection, connecting, asking, success, error
    const [error, setError] = useState('');
    const [isAskingForMore, setIsAskingForMore] = useState(false);

    // Connect to Phantom and handle wallet connection
    const connectPhantomWallet = async () => {
        try {
            setStatus('connecting');
            setError('');

            // Check if Phantom is installed
            if (!window.solana || !window.solana.isPhantom) {
                setError('Phantom wallet not detected. Please install Phantom extension first.');
                setStatus('error');
                return;
            }

            // Disconnect any existing connections to ensure clean state
            if (window.solana.isConnected) {
                await window.solana.disconnect();
                // Wait a moment for disconnect to complete
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Connect to Phantom wallet
            const response = await window.solana.connect({ onlyIfTrusted: false });
            const walletAddress = response.publicKey.toString();

            // Request a signature to establish trust with the site
            // This will trigger the signature popup
            const message = `Connect wallet ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)} to Proof of Funds`;
            const encodedMessage = new TextEncoder().encode(message);

            try {
                // This will trigger the signature popup
                await window.solana.signMessage(encodedMessage, "utf8");
            } catch (signError) {
                // If user rejects the signature, we'll still continue but log it
                console.log("User declined to sign the message", signError);
                // We don't throw here since we still want to allow the connection
            }

            // Check if this wallet is already in our list
            if (connectedWallets.some(wallet => wallet.address === walletAddress)) {
                setError('This wallet is already selected. Please switch to a different wallet in Phantom and try again.');
                setStatus('selection');
                return;
            }

            // Add the new wallet to our connected list
            const newWallet = {
                address: walletAddress,
                displayAddress: `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`,
            };

            setConnectedWallets(prev => [...prev, newWallet]);
            setStatus('asking');
            setIsAskingForMore(true);

        } catch (error) {
            console.error('Error connecting to Phantom wallet:', error);

            // If user rejected the request, set a friendly error message
            if (error.code === 4001) { // User rejected error code
                setError('Connection request was rejected. Please approve the connection in the Phantom popup.');
            } else {
                setError(`Failed to connect: ${error.message || 'Unknown error'}`);
            }

            setStatus('selection');
        }
    };

    // Handle the user's decision to connect another wallet or finish
    const handleContinue = () => {
        setIsAskingForMore(false);
        setStatus('selection');
    };

    // Complete the connection process and save all wallets
    const handleFinish = () => {
        try {
            setStatus('success');

            // Get all connected wallet addresses
            const walletAddresses = connectedWallets.map(wallet => wallet.address);

            // Save the connection information
            if (walletAddresses.length > 0) {
                saveWalletConnection('phantom', walletAddresses);
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

            {status === 'selection' && (
                <div className="my-4">
                    {connectedWallets.length > 0 && (
                        <div className="mb-4">
                            <h3 className="font-medium mb-3 text-lg">Connected Wallets ({connectedWallets.length})</h3>
                            <div className="space-y-2 mb-6 max-h-60 overflow-y-auto pr-1">
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
                            <div className="h-px bg-gray-200 my-4"></div>
                        </div>
                    )}

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md mb-6">
                        <h3 className="font-medium text-blue-800 mb-2">
                            {connectedWallets.length === 0
                                ? "Connect a Phantom Wallet"
                                : "Add another Phantom Wallet"}
                        </h3>
                        <p className="text-sm text-blue-700 mb-4">
                            Please select the wallet you want to connect in your Phantom extension, then click the button below.
                        </p>
                        <div className="flex gap-3 flex-wrap">
                            <button
                                onClick={connectPhantomWallet}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 flex-grow"
                            >
                                <span className="flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                    Connect Selected Wallet
                                </span>
                            </button>
                            {connectedWallets.length > 0 && (
                                <button
                                    onClick={handleFinish}
                                    className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md font-medium hover:bg-gray-200 flex-grow"
                                >
                                    <span className="flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        Finish with {connectedWallets.length} {connectedWallets.length === 1 ? 'wallet' : 'wallets'}
                                    </span>
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-blue-600 mt-3">
                            <b>Tip:</b> To connect a different wallet, first open Phantom extension and switch to the desired account before clicking "Connect".
                        </p>
                    </div>
                </div>
            )}

            {status === 'connecting' && (
                <div className="my-8 text-center">
                    <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-600">Waiting for Phantom wallet connection...</p>
                    <p className="text-sm text-gray-500 mt-2">
                        Please approve the connection request in the Phantom popup.
                    </p>
                    <img
                        src="https://phantom.app/img/phantom-logo.svg"
                        alt="Phantom"
                        className="h-12 mx-auto mt-6 opacity-70"
                    />
                </div>
            )}

            {status === 'asking' && (
                <div className="my-4">
                    {connectedWallets.length > 0 && (
                        <div className="mb-4">
                            <h3 className="font-medium mb-3 text-lg">Connected Wallets ({connectedWallets.length})</h3>
                            <div className="space-y-2 mb-6 max-h-60 overflow-y-auto pr-1">
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

                            <div className="h-px bg-gray-200 my-4"></div>
                        </div>
                    )}

                    {isAskingForMore ? (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md mb-6">
                            <h3 className="font-medium text-blue-800 mb-2">Would you like to add another wallet?</h3>
                            <p className="text-sm text-blue-700 mb-4">
                                You can connect multiple Phantom wallets to use simultaneously.
                            </p>
                            <div className="flex gap-3 flex-wrap">
                                <button
                                    onClick={handleContinue}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 flex-grow"
                                >
                                    <span className="flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                        </svg>
                                        Add Another Wallet
                                    </span>
                                </button>
                                <button
                                    onClick={handleFinish}
                                    className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md font-medium hover:bg-gray-200 flex-grow"
                                >
                                    <span className="flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        Finish with {connectedWallets.length} {connectedWallets.length === 1 ? 'wallet' : 'wallets'}
                                    </span>
                                </button>
                            </div>
                            <p className="text-xs text-blue-600 mt-3">
                                <b>Tip:</b> To connect a different wallet, first switch accounts in your Phantom extension, then click "Add Another Wallet".
                            </p>
                        </div>
                    ) : (
                        <div className="my-8 text-center">
                            <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-gray-600">Preparing for next wallet...</p>
                        </div>
                    )}
                </div>
            )}

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

            {error && (
                <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md">
                    {error}
                    {status === 'error' && (
                        <div className="mt-4">
                            <button
                                onClick={() => {
                                    setError('');
                                    setStatus('selection');
                                }}
                                className="px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            )}

            {status !== 'success' && (
                <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500">
                    <p className="mb-1"><strong>How it works:</strong></p>
                    <p>1. Select the wallet you want to connect in your Phantom extension.</p>
                    <p>2. Click "Connect Selected Wallet" to connect that specific wallet.</p>
                    <p>3. Repeat to add multiple wallets - each time selecting a different wallet in Phantom first.</p>
                </div>
            )}
        </div>
    );
}
