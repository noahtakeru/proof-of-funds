import { useEffect, useState, useRef } from 'react';
import WalletSelector from './WalletSelector';
import { getConnectedWallets, disconnectWallet } from '../lib/walletHelpers';

export default function ConnectWallet() {
    const [showWalletSelector, setShowWalletSelector] = useState(false);
    const [connectedWallets, setConnectedWallets] = useState([]);
    const [showWalletMenu, setShowWalletMenu] = useState(false);
    const [disconnectingWallets, setDisconnectingWallets] = useState({});
    const [buttonClicked, setButtonClicked] = useState(false);
    const walletMenuRef = useRef(null);
    const connectBtnRef = useRef(null);

    // Utility function to add a synthetic event listener for localStorage changes
    const setupLocalStorageListener = () => {
        // Listen for changes from other components
        const handleStorageChange = (e) => {
            if (e.key === 'walletData' || e.key === 'userInitiatedConnection') {
                console.log('Storage change detected in ConnectWallet:', e.key);
                updateConnectedWallets();
            }
        };

        // Add storage event listener for changes from other tabs
        window.addEventListener('storage', handleStorageChange);

        // Set up for changes in the current tab
        if (typeof window !== 'undefined' && !window._walletStorageInterceptor) {
            const originalSetItem = localStorage.setItem;
            const originalRemoveItem = localStorage.removeItem;

            localStorage.setItem = function (key, value) {
                // Call original first
                originalSetItem.apply(this, arguments);

                // Only trigger for wallet-related keys
                if (key === 'walletData' || key === 'userInitiatedConnection') {
                    console.log(`localStorage.setItem intercepted in ConnectWallet: ${key}`);

                    // Create and dispatch a custom event 
                    const event = new CustomEvent('localStorage-changed', {
                        detail: { key, newValue: value }
                    });
                    window.dispatchEvent(event);
                }
            };

            localStorage.removeItem = function (key) {
                // Call original first
                originalRemoveItem.apply(this, arguments);

                // Only trigger for wallet-related keys
                if (key === 'walletData' || key === 'userInitiatedConnection') {
                    console.log(`localStorage.removeItem intercepted in ConnectWallet: ${key}`);

                    // Create and dispatch a custom event 
                    const event = new CustomEvent('localStorage-changed', {
                        detail: { key, removed: true }
                    });
                    window.dispatchEvent(event);
                }
            };

            window._walletStorageInterceptor = true;
        }

        // Listen for the custom localStorage-changed event
        const handleLocalChange = (e) => {
            if (e.detail && (e.detail.key === 'walletData' || e.detail.key === 'userInitiatedConnection')) {
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

    // Function to initiate connection - directly open the wallet selector
    const initiateConnection = () => {
        console.log('Connect button clicked, opening wallet selector');
        setButtonClicked(true);

        // Force the modal to open on the next render cycle
        setTimeout(() => {
            setShowWalletSelector(true);
            setButtonClicked(false);
        }, 50);
    };

    // Handle disconnect for a wallet
    const handleDisconnect = async (walletId) => {
        try {
            // Set disconnecting state for only this wallet
            setDisconnectingWallets(prev => ({
                ...prev,
                [walletId]: true
            }));

            const wallet = connectedWallets.find(w => w.id === walletId);
            if (!wallet) {
                setDisconnectingWallets(prev => ({
                    ...prev,
                    [walletId]: false
                }));
                return;
            }

            console.log('Disconnecting wallet:', wallet);

            // Use the centralized disconnect helper
            await disconnectWallet(wallet.type, wallet.fullAddress);

            // Force an immediate update of the wallet list
            setTimeout(() => {
                updateConnectedWallets();
                setDisconnectingWallets(prev => ({
                    ...prev,
                    [walletId]: false
                }));
                setShowWalletMenu(false);
            }, 300);
        } catch (error) {
            console.error('Error disconnecting wallet:', error);
            setDisconnectingWallets(prev => ({
                ...prev,
                [walletId]: false
            }));
        }
    };

    // Close the wallet selector
    const handleWalletSelectorClose = () => {
        console.log('Closing wallet selector');
        setShowWalletSelector(false);
        // Refresh the wallet list when closing the selector
        updateConnectedWallets();
    };

    // Toggle the wallet menu
    const toggleWalletMenu = () => {
        // Force refresh wallet list when opening menu
        if (!showWalletMenu) {
            updateConnectedWallets();
        }
        setShowWalletMenu(prev => !prev);
    };

    // Show the wallet selector to add a new wallet
    const handleAddWallet = () => {
        setShowWalletMenu(false);
        setShowWalletSelector(true);
    };

    // Debug function to log the component state
    useEffect(() => {
        console.log('ConnectWallet state:', {
            showWalletSelector,
            connectedWallets: connectedWallets.length,
            buttonClicked,
            modalVisible: !!document.querySelector('.wallet-modal-container')
        });
    }, [showWalletSelector, connectedWallets.length, buttonClicked]);

    // Render the WalletSelector modal - separate from conditional rendering
    const renderWalletSelector = () => {
        if (!showWalletSelector) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 wallet-modal-container">
                <div
                    className="bg-white rounded-lg shadow-xl max-w-md w-full"
                    style={{ maxHeight: '90vh', overflowY: 'auto' }}
                >
                    <WalletSelector onClose={handleWalletSelectorClose} />
                </div>
            </div>
        );
    };

    if (connectedWallets.length > 0) {
        // Count wallet types
        const phantomCount = connectedWallets.filter(w => w.type === 'solana').length;
        const evmCount = connectedWallets.filter(w => w.type === 'evm').length;

        return (
            <div className="relative">
                <div className="flex items-center gap-2">
                    <div className="mr-2">
                        {/* Shows summary of connected wallets */}
                        <div className="flex items-center text-sm text-gray-600">
                            {phantomCount > 0 && (
                                <span className="flex items-center mr-2">
                                    <span className="inline-block w-4 h-4 mr-1 bg-indigo-500 rounded-full"></span>
                                    <span>{phantomCount} Phantom {phantomCount === 1 ? 'Wallet' : 'Wallets'}</span>
                                </span>
                            )}
                            {evmCount > 0 && (
                                <span className="flex items-center">
                                    <span className="inline-block w-4 h-4 mr-1 bg-orange-500 rounded-full"></span>
                                    <span>{evmCount} EVM {evmCount === 1 ? 'Wallet' : 'Wallets'}</span>
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
                                        disabled={disconnectingWallets[wallet.id]}
                                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                                    >
                                        {disconnectingWallets[wallet.id] ? 'Disconnecting...' : 'Disconnect'}
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

                {/* Render wallet selector modal */}
                {renderWalletSelector()}
            </div>
        );
    }

    // For users with no wallets, simply show the connect button
    // and render the selector modal outside of the conditional
    return (
        <>
            <button
                ref={connectBtnRef}
                onClick={initiateConnection}
                className="btn btn-primary"
                style={{ zIndex: 50 }} // Ensure button is clickable
            >
                Connect Wallet{buttonClicked ? '...' : ''}
            </button>

            {/* Always render the modal at the document root level */}
            {renderWalletSelector()}
        </>
    );
} 