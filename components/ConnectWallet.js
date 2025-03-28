/**
 * ConnectWallet Component
 * 
 * A reusable component that handles wallet connections across the application.
 * This component provides a unified interface for connecting to different blockchain
 * wallets (Ethereum/EVM and Solana), displaying connected wallet information,
 * and managing wallet connections.
 * 
 * Key Features:
 * - Wallet connection button that opens a wallet selector modal
 * - Connected wallet display with dropdown menu
 * - Ability to connect multiple wallets simultaneously
 * - Wallet disconnection functionality
 * - Synchronized wallet state across multiple components using localStorage
 * - Support for both MetaMask (EVM chains) and Phantom (Solana) wallets
 * 
 * The component actively listens for wallet connection changes from other
 * components using a custom localStorage interceptor, ensuring consistent
 * wallet state across the application.
 */

import { useEffect, useState, useRef } from 'react';
import WalletSelector from './WalletSelector';
import { getConnectedWallets, disconnectWallet } from '../lib/walletHelpers';
import { useDisconnect } from 'wagmi';

export default function ConnectWallet() {
    const [showWalletSelector, setShowWalletSelector] = useState(false);
    const [connectedWallets, setConnectedWallets] = useState([]);
    const [showWalletMenu, setShowWalletMenu] = useState(false);
    const [disconnectingWallets, setDisconnectingWallets] = useState({});
    const [buttonClicked, setButtonClicked] = useState(false);
    const walletMenuRef = useRef(null);
    const connectBtnRef = useRef(null);

    // Get the wagmi disconnect function
    const { disconnect: wagmiDisconnect } = useDisconnect();

    // Make wagmi disconnect function available globally for walletHelpers.js
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.wagmiDisconnect = wagmiDisconnect;

            // Clean up on unmount
            return () => {
                delete window.wagmiDisconnect;
            };
        }
    }, [wagmiDisconnect]);

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

            // Use the centralized disconnect helper which now handles wagmi disconnect
            await disconnectWallet(wallet.type, wallet.fullAddress);

            // Force an immediate update of the wallet list
            setTimeout(() => {
                updateConnectedWallets();
                setDisconnectingWallets(prev => ({
                    ...prev,
                    [walletId]: false
                }));

                // Dispatch an event to notify other components about wallet changes
                const walletChangeEvent = new CustomEvent('wallet-connection-changed', {
                    detail: { timestamp: Date.now() }
                });
                window.dispatchEvent(walletChangeEvent);
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

        // Dispatch a custom event to notify other components about wallet changes
        const walletChangeEvent = new CustomEvent('wallet-connection-changed', {
            detail: { timestamp: Date.now() }
        });
        window.dispatchEvent(walletChangeEvent);
        console.log('Dispatched wallet-connection-changed event');
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

    // Update the useEffect hook that monitors connected wallets
    useEffect(() => {
        // Close the wallet menu if there are no connected wallets left
        if (showWalletMenu && connectedWallets.length === 0) {
            // Close the menu after a short delay to show the empty state
            setTimeout(() => {
                setShowWalletMenu(false);
            }, 1500);
        }
    }, [connectedWallets.length, showWalletMenu]);

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
                            {connectedWallets.length > 0 ? (
                                connectedWallets.map(wallet => (
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
                                ))
                            ) : (
                                <div className="px-4 py-6 text-center">
                                    <div className="text-sm text-gray-500 mb-2">No wallets connected</div>
                                    <div className="text-xs text-gray-400">Menu will close automatically...</div>
                                </div>
                            )}
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
                id="connect-wallet-button"
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