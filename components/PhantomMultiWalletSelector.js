import { useState, useEffect, useRef } from 'react';
import { disconnectWallet, getConnectedWallets, saveWalletConnection } from '../lib/walletHelpers';

export default function PhantomMultiWalletSelector({ onClose }) {
    const [accounts, setAccounts] = useState([]);
    const [selectedAccounts, setSelectedAccounts] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [connecting, setConnecting] = useState(false);
    const selectorRef = useRef(null);

    // Set up click outside handler
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (selectorRef.current && !selectorRef.current.contains(event.target)) {
                handleClose();
            }
        };

        // Add event listener to document
        document.addEventListener('mousedown', handleClickOutside);

        // Add visibility to body
        document.body.style.overflow = 'hidden';

        return () => {
            // Remove event listener from document
            document.removeEventListener('mousedown', handleClickOutside);
            document.body.style.overflow = 'auto';
        };
    }, []);

    // Initialize and load all available Phantom wallets on mount
    useEffect(() => {
        const loadPhantomWallets = async () => {
            setIsLoading(true);
            setError('');

            try {
                // Make sure Phantom is installed
                if (!window.solana || !window.solana.isPhantom) {
                    setError('Phantom wallet is not installed. Please install Phantom extension first.');
                    setIsLoading(false);
                    return;
                }

                // Get already connected wallets from our storage
                const connectedWallets = getConnectedWallets()
                    .filter(wallet => wallet.type === 'solana')
                    .map(wallet => wallet.fullAddress);

                // Initialize selected accounts from already connected wallets
                const initialSelected = {};
                connectedWallets.forEach(addr => {
                    initialSelected[addr] = true;
                });
                setSelectedAccounts(initialSelected);

                // Force disconnect from Phantom to make sure we get a fresh connection
                if (window.solana.isConnected) {
                    await window.solana.disconnect();
                    // Small delay to ensure disconnect completes
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                // Connect to get current default account
                const response = await window.solana.connect({ onlyIfTrusted: true });
                const currentAccount = response.publicKey.toString();

                // Get all wallets from Phantom
                // In Phantom extension, the user can click the account switcher icon to see all accounts
                // Here we're mimicking that by showing accounts from the extension
                const phantomAccounts = [
                    { address: currentAccount, label: 'Current Wallet', isActive: true }
                ];

                // Note: We will later instruct users to switch accounts in Phantom to connect more
                setAccounts(phantomAccounts);

                // If current wallet isn't marked as connected, add it to selectedAccounts
                if (!initialSelected[currentAccount]) {
                    setSelectedAccounts(prev => ({ ...prev, [currentAccount]: true }));
                }
            } catch (error) {
                console.error("Error loading Phantom wallets:", error);
                setError(error.message || 'Failed to connect to Phantom wallet');
            }

            setIsLoading(false);
        };

        loadPhantomWallets();
    }, []);

    // Toggle wallet selection
    const toggleWalletSelection = (address) => {
        setSelectedAccounts(prev => ({
            ...prev,
            [address]: !prev[address]
        }));
    };

    // Connect a new wallet (will guide the user to switch accounts in Phantom first)
    const connectNewWallet = async () => {
        try {
            setError('');
            setConnecting(true);

            // First disconnect current connection
            if (window.solana.isConnected) {
                await window.solana.disconnect();
                // Wait for disconnect to complete
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Then connect to get the new wallet
            const response = await window.solana.connect({ onlyIfTrusted: false });
            const newWalletAddress = response.publicKey.toString();

            // Check if this wallet is already in our list
            const walletExists = accounts.some(acc => acc.address === newWalletAddress);

            if (!walletExists) {
                // Add the new wallet to our list
                setAccounts(prev => [
                    ...prev,
                    { address: newWalletAddress, label: `Wallet ${prev.length + 1}`, isActive: true }
                ]);

                // Mark it as selected
                setSelectedAccounts(prev => ({ ...prev, [newWalletAddress]: true }));
            } else {
                setError('This wallet is already in your list');
            }
        } catch (error) {
            console.error("Error connecting new wallet:", error);
            setError(error.message || 'Failed to connect new wallet');
        } finally {
            setConnecting(false);
        }
    };

    // Save all selected wallets and close
    const saveAndClose = async () => {
        try {
            setConnecting(true);
            setError('');

            // Get addresses of selected wallets
            const selectedAddresses = Object.entries(selectedAccounts)
                .filter(([_, isSelected]) => isSelected)
                .map(([address]) => address);

            if (selectedAddresses.length === 0) {
                setError('Please select at least one wallet');
                setConnecting(false);
                return;
            }

            // Save selected wallet connections (creates phantom entry in walletData)
            saveWalletConnection('phantom', selectedAddresses);

            // Close selector after successful connection
            setTimeout(() => {
                if (typeof onClose === 'function') {
                    onClose();
                }
            }, 500);
        } catch (error) {
            console.error("Error saving wallet connections:", error);
            setError(error.message || 'Failed to save wallet connections');
            setConnecting(false);
        }
    };

    // Function to safely close the modal
    const handleClose = () => {
        if (typeof onClose === 'function') {
            onClose();
        }
    };

    // Format wallet address for display
    const formatAddress = (address) => {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    return (
        <div
            ref={selectorRef}
            className="p-6 wallet-selector"
            style={{
                position: 'relative',
                zIndex: 10000
            }}
        >
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Connect Phantom Wallets</h2>
                <button
                    onClick={handleClose}
                    className="text-gray-500 hover:text-gray-700 p-2"
                    aria-label="Close"
                >
                    ✕
                </button>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                    {error}
                </div>
            )}

            <div className="mb-4 text-sm text-gray-600">
                Select the Phantom wallets you'd like to connect:
            </div>

            <div className="max-h-60 overflow-y-auto mb-4">
                {isLoading ? (
                    <div className="flex items-center justify-center py-4">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                        Loading wallets...
                    </div>
                ) : accounts.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                        No Phantom wallets available. Click "Connect New Wallet" to begin.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {accounts.map((account) => (
                            <div
                                key={account.address}
                                className="p-3 border rounded-lg flex justify-between items-center"
                            >
                                <div>
                                    <div className="font-medium">{account.label}</div>
                                    <div className="text-sm text-gray-500">{formatAddress(account.address)}</div>
                                </div>
                                <label className="inline-flex items-center">
                                    <input
                                        type="checkbox"
                                        className="form-checkbox h-5 w-5 text-blue-600"
                                        checked={!!selectedAccounts[account.address]}
                                        onChange={() => toggleWalletSelection(account.address)}
                                    />
                                </label>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-3">
                <button
                    onClick={connectNewWallet}
                    disabled={connecting || isLoading}
                    className="w-full p-3 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors flex items-center justify-center"
                >
                    {connecting ? (
                        <span className="inline-block w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2"></span>
                    ) : null}
                    <span>Add Another Wallet</span>
                </button>

                <div className="text-xs text-gray-500 italic text-center px-4">
                    Use this button to connect additional wallets. You will need to switch accounts in your Phantom extension to connect a different wallet.
                </div>

                <button
                    onClick={saveAndClose}
                    disabled={connecting || isLoading || Object.keys(selectedAccounts).filter(k => selectedAccounts[k]).length === 0}
                    className="w-full p-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                    {connecting ? (
                        <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                    ) : null}
                    <span>Connect Selected Wallets</span>
                </button>
            </div>
        </div>
    );
} 