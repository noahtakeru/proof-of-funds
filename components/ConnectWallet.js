import { useEffect, useState, useRef } from 'react';
import WalletSelector from './WalletSelector';
import { getConnectedWallets, disconnectWallet } from '../lib/walletHelpers';

export default function ConnectWallet() {
    const [showWalletSelector, setShowWalletSelector] = useState(false);
    const [connectedWallets, setConnectedWallets] = useState([]);
    const [showWalletMenu, setShowWalletMenu] = useState(false);
    const walletMenuRef = useRef(null);

    // Utility function to add a synthetic event listener for localStorage changes
    const setupLocalStorageListener = () => {
        // Listen for changes from other components
        const handleStorageChange = (e) => {
            if (e.key === 'lastWalletConnection' || e.key === 'userInitiatedConnection') {
                console.log('Storage change detected in ConnectWallet:', e.key);
                updateConnectedWallets();
            }
        };

        // Add storage event listener for changes from other tabs
        window.addEventListener('storage', handleStorageChange);

        // Set up for changes in the current tab
        if (typeof window !== 'undefined' && !window._walletStorageInterceptor) {
            const originalSetItem = localStorage.setItem;

            localStorage.setItem = function (key, value) {
                // Call original first
                originalSetItem.apply(this, arguments);

                // Only trigger for wallet-related keys
                if (key === 'lastWalletConnection' || key === 'userInitiatedConnection') {
                    console.log(`localStorage.setItem intercepted in ConnectWallet: ${key}`);

                    // Create and dispatch a custom event 
                    const event = new CustomEvent('localStorage-changed', {
                        detail: { key, newValue: value }
                    });
                    window.dispatchEvent(event);
                }
            };

            window._walletStorageInterceptor = true;
        }

        // Listen for the custom localStorage-changed event
        const handleLocalChange = (e) => {
            if (e.detail && (e.detail.key === 'lastWalletConnection' || e.detail.key === 'userInitiatedConnection')) {
                console.log(`localStorage-changed event in ConnectWallet: ${e.detail.key}`);
                updateConnectedWallets();
            }
        };

        window.addEventListener('localStorage-changed', handleLocalChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('localStorage-changed', handleLocalChange);
        };
    };

    // Function to update connected wallets from localStorage
    const updateConnectedWallets = () => {
        const wallets = getConnectedWallets();
        console.log('Updated wallet list in ConnectWallet:', wallets);
        setConnectedWallets(wallets);
    };

    // Initialize wallet state and set up storage listener
    useEffect(() => {
        updateConnectedWallets();
        const cleanup = setupLocalStorageListener();

        // Set up click outside handler for wallet menu
        const handleClickOutside = (event) => {
            if (walletMenuRef.current && !walletMenuRef.current.contains(event.target)) {
                setShowWalletMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            cleanup();
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Function to initiate connection
    const initiateConnection = () => {
        setShowWalletSelector(true);
    };

    // Handle disconnect for a wallet
    const handleDisconnect = async (walletId) => {
        try {
            const wallet = connectedWallets.find(w => w.id === walletId);
            if (!wallet) return;

            // Use the centralized disconnect helper
            await disconnectWallet(wallet.type, wallet.fullAddress);

            // Update the wallet list
            updateConnectedWallets();

            // Close the menu
            setShowWalletMenu(false);
        } catch (error) {
            console.error('Error disconnecting wallet:', error);
        }
    };

    // Close the wallet selector
    const handleWalletSelectorClose = () => {
        setShowWalletSelector(false);
    };

    // Toggle the wallet menu
    const toggleWalletMenu = () => {
        setShowWalletMenu(prev => !prev);
    };

    // Show the wallet selector to add a new wallet
    const handleAddWallet = () => {
        setShowWalletMenu(false);
        setShowWalletSelector(true);
    };

    if (connectedWallets.length > 0) {
        return (
            <div className="relative">
                <div className="flex items-center gap-2">
                    <div className="mr-2">
                        {/* Shows only the first connected wallet in the main view */}
                        <div className="flex items-center text-sm text-gray-600">
                            <span>
                                {connectedWallets[0].name}: {connectedWallets[0].address}
                            </span>
                            {connectedWallets.length > 1 && (
                                <span className="ml-1 text-xs text-primary-600">
                                    +{connectedWallets.length - 1} more
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={toggleWalletMenu}
                        className="btn btn-primary text-sm"
                    >
                        {connectedWallets.length > 0 ? 'Manage Wallets' : 'Add Wallet'}
                    </button>
                </div>

                {/* Wallet Menu Dropdown */}
                {showWalletMenu && (
                    <div
                        ref={walletMenuRef}
                        className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg z-10 py-1"
                    >
                        <div className="px-4 py-2 text-sm text-gray-700 font-medium border-b border-gray-200">
                            Connected Wallets
                        </div>

                        <div className="max-h-80 overflow-y-auto py-1">
                            {connectedWallets.map(wallet => (
                                <div
                                    key={wallet.id}
                                    className="px-4 py-2 hover:bg-gray-50 flex justify-between items-center"
                                >
                                    <div>
                                        <div className="text-sm font-medium">{wallet.name}</div>
                                        <div className="text-xs text-gray-500">{wallet.address}</div>
                                    </div>
                                    <button
                                        onClick={() => handleDisconnect(wallet.id)}
                                        className="text-xs text-red-500 hover:text-red-700"
                                    >
                                        Disconnect
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-gray-200 px-4 py-2">
                            <button
                                onClick={handleAddWallet}
                                className="w-full text-center text-sm text-blue-600 hover:text-blue-800"
                            >
                                + Add Wallet
                            </button>
                        </div>
                    </div>
                )}

                {/* Wallet Selector Modal */}
                {showWalletSelector && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                            <WalletSelector onClose={handleWalletSelectorClose} />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <button
            onClick={initiateConnection}
            className="btn btn-primary"
        >
            Connect Wallet
        </button>
    );
} 