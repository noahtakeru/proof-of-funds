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
import { getConnectedWallets, disconnectWallet } from '@proof-of-funds/common/utils/walletHelpers';

// Import real implementation
import { useDisconnect } from '@proof-of-funds/common/utils/wallet';

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
        
        // Check specifically for Phantom wallets to ensure they're being loaded
        const phantomWallets = wallets.filter(wallet => wallet.type === 'phantom');
        console.log('Phantom wallets loaded:', phantomWallets.length);
        
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

            // Clear any walletConnectChoice to prevent auto-reconnect
            if (typeof localStorage !== 'undefined') {
                // Clear any additional connection flags for this specific wallet
                try {
                    // Explicitly clear provider state for this wallet
                    if (wallet.type === 'evm' || wallet.provider === 'metamask') {
                        if (window.ethereum && window.ethereum.isMetaMask) {
                            console.log('Clearing MetaMask connection state');
                            // This additional cleanup might help prevent auto-reconnect
                            localStorage.removeItem(`${wallet.address.toLowerCase()}_disconnected`);
                        }
                    }
                } catch (e) {
                    console.warn('Error cleaning up wallet specific state:', e);
                }
            }
            
            // Force an immediate update of the wallet list
            setTimeout(() => {
                // Double check all wallets are properly removed
                updateConnectedWallets();
                setDisconnectingWallets(prev => ({
                    ...prev,
                    [walletId]: false
                }));

                // Dispatch an event to notify other components about wallet changes
                const walletChangeEvent = new CustomEvent('wallet-connection-changed', {
                    detail: { timestamp: Date.now(), disconnected: true }
                });
                window.dispatchEvent(walletChangeEvent);
                
                // Close the menu after disconnecting the wallet
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

    // Group wallets by type for icon display
    const groupWalletsByType = () => {
        const walletGroups = {};

        connectedWallets.forEach(wallet => {
            if (!walletGroups[wallet.type]) {
                walletGroups[wallet.type] = [];
            }
            walletGroups[wallet.type].push(wallet);
        });

        return walletGroups;
    };

    // Get icon for wallet type
    const getWalletIcon = (type) => {
        // Convert type to lowercase
        const lowerType = type.toLowerCase();

        // Check for EVM wallets (MetaMask)
        if (lowerType === 'evm' || lowerType === 'metamask') {
            return (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="12" fill="#F6851B" />
                    <path d="M17.6889 8L12.0889 11.4667L13.0667 9.04444L17.6889 8Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.1" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6.31111 8L11.8444 11.5111L10.9333 9.04444L6.31111 8Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.1" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M15.5556 15.6889L14.2222 17.9111L17.8 18.9333L18.8667 15.7333L15.5556 15.6889Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.1" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5.13334 15.7333L6.20001 18.9333L9.77779 17.9111L8.44445 15.6889L5.13334 15.7333Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.1" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9.55556 12.8445L8.71111 14.2667L12.2667 14.4L12.1334 10.6667L9.55556 12.8445Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.1" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14.4444 12.8445L11.8444 10.6223L11.7778 14.4L15.2889 14.2667L14.4444 12.8445Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.1" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9.77777 17.9111L12.0444 16.8L10.1333 15.7556L9.77777 17.9111Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.1" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M11.9555 16.8L14.2222 17.9111L13.8667 15.7556L11.9555 16.8Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        }
        // Check for Solana wallets (Phantom)
        else if (lowerType === 'solana' || lowerType === 'phantom') {
            return (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="12" fill="#6A4FF0" />
                    <path d="M18.8306 11.6428H16.5714C16.5714 7.8358 13.4755 4.714 9.7143 4.714C6.4153 4.714 3.6428 7.0858 2.9694 10.2641C2.8163 11.1429 2.7898 11.9388 2.8254 12.6429C2.8612 13.2962 2.9714 13.9464 3.1694 14.5071C3.1857 14.5235 3.2021 14.5561 3.2184 14.5724C3.2347 14.5887 3.2347 14.5887 3.251 14.605C3.4592 14.8602 3.6959 15.0439 3.9551 15.0439H7.9959C8.0582 15.0439 8.1123 15.0011 8.1123 14.9438C8.1123 14.9111 8.0959 14.8784 8.0796 14.862C7.8204 14.5561 7.6612 14.2112 7.5939 13.8438C7.5266 13.4276 7.5429 13.0113 7.6388 12.6429C8.0133 11.0439 9.7551 9.8949 11.7 9.8949C13.9224 9.8949 15.7306 11.7194 15.7306 14.0113C15.7306 14.1622 15.7184 14.3255 15.7 14.4765C15.6816 14.6275 15.7918 14.7622 15.9347 14.7839L17.8408 15.0255C17.8714 15.0286 17.9021 15.0286 17.9327 15.0255C18.0755 15.0071 18.1755 14.8928 18.1571 14.737C18.1387 14.5887 18.1306 14.4397 18.1306 14.2908C18.1306 12.8357 17.2592 11.5724 15.959 10.9367V10.9367C15.9202 10.9193 15.8812 10.9021 15.8422 10.8847C15.8032 10.8674 15.7878 10.835 15.7878 10.7908C15.7878 10.7622 15.7878 10.7337 15.8042 10.7174C15.8206 10.701 15.851 10.6847 15.8846 10.6847C17.8408 11.0194 19.2653 12.5133 19.7878 14.2939C19.8398 14.4847 20.0194 14.6123 20.2224 14.6123H18.8306C19.0449 14.6123 19.1633 14.4868 19.1633 14.3235V11.9317C19.1633 11.7684 19.0449 11.6428 18.8306 11.6428Z" fill="white" />
                </svg>
            );
        }
        else if (lowerType === 'walletconnect') {
            return (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="12" fill="#3396FF" />
                    <path d="M7.8 9C10.1254 6.6746 13.8746 6.6746 16.2 9L16.4 9.2C16.5 9.3 16.5 9.5 16.4 9.6L15.4 10.6C15.35 10.65 15.25 10.65 15.2 10.6L14.9 10.3C13.3254 8.7254 10.6746 8.7254 9.1 10.3L8.8 10.6C8.75 10.65 8.65 10.65 8.6 10.6L7.6 9.6C7.5 9.5 7.5 9.3 7.6 9.2L7.8 9Z" fill="white" />
                    <path d="M17.85 10.2L18.7 11.05C18.8 11.15 18.8 11.35 18.7 11.45L14.15 16C14.05 16.1 13.85 16.1 13.75 16L10.5 12.75C10.475 12.725 10.425 12.725 10.4 12.75L7.15 16C7.05 16.1 6.85 16.1 6.75 16L2.2 11.45C2.1 11.35 2.1 11.15 2.2 11.05L3.05 10.2C3.15 10.1 3.35 10.1 3.45 10.2L6.7 13.45C6.725 13.475 6.775 13.475 6.8 13.45L10.05 10.2C10.15 10.1 10.35 10.1 10.45 10.2L13.7 13.45C13.725 13.475 13.775 13.475 13.8 13.45L17.05 10.2C17.15 10.1 17.35 10.1 17.45 10.2H17.85Z" fill="white" />
                </svg>
            );
        }
        // Default wallet icon
        else {
            return (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="12" fill="#E2E8F0" />
                    <path d="M17 9V7C17 6.46957 16.7893 5.96086 16.4142 5.58579C16.0391 5.21071 15.5304 5 15 5H7C6.46957 5 5.96086 5.21071 5.58579 5.58579C5.21071 5.96086 5 6.46957 5 7V17C5 17.5304 5.21071 18.0391 5.58579 18.4142C5.96086 18.7893 6.46957 19 7 19H15C15.5304 19 16.0391 18.7893 16.4142 18.4142C16.7893 18.0391 17 17.5304 17 17V15" stroke="#4A5568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M19 9H13C12.4477 9 12 9.44772 12 10V14C12 14.5523 12.4477 15 13 15H19C19.5523 15 20 14.5523 20 14V10C20 9.44772 19.5523 9 19 9Z" stroke="#4A5568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        }
    };

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
        const walletGroups = groupWalletsByType();

        return (
            <div className="relative">
                <div className="flex items-center gap-2">
                    <div className="flex items-center space-x-2 mr-2">
                        {Object.keys(walletGroups).map(walletType => (
                            <div key={walletType} className="relative">
                                <div className="flex items-center justify-center">
                                    {getWalletIcon(walletType)}
                                    {walletGroups[walletType].length > 1 && (
                                        <span className="absolute -top-2 -right-2 bg-primary-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                                            {walletGroups[walletType].length}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={toggleWalletMenu}
                        className="btn btn-primary whitespace-nowrap"
                        style={{ minWidth: '160px' }}
                    >
                        {connectedWallets.length > 0 ? 'Manage Wallets' : 'Add Wallet'}
                    </button>
                </div>

                {/* Wallet Menu Dropdown */}
                {showWalletMenu && (
                    <div
                        ref={walletMenuRef}
                        className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg z-50 py-1 border border-gray-200"
                    >
                        <div className="px-4 py-2 text-sm text-gray-700 font-medium border-b border-gray-200">
                            Connected Wallets
                        </div>

                        <div className="py-1">
                            {connectedWallets.length > 0 ? (
                                connectedWallets.map(wallet => (
                                    <div
                                        key={wallet.id}
                                        className="px-4 py-3 hover:bg-gray-50 flex justify-between items-center"
                                    >
                                        <div className="flex items-center">
                                            <div className="mr-2 flex-shrink-0">
                                                {getWalletIcon(wallet.type)}
                                            </div>
                                            <div className="flex-grow min-w-0 mr-2">
                                                <div className="text-sm font-medium truncate">{wallet.name}</div>
                                                <div className="text-xs text-gray-500 truncate">{wallet.displayAddress || wallet.address}</div>
                                                <div className="text-xs text-gray-400">{wallet.chain}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDisconnect(wallet.id)}
                                            disabled={disconnectingWallets[wallet.id]}
                                            className="text-xs bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 disabled:opacity-50 py-1 px-2 rounded flex-shrink-0"
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

                        <div className="border-t border-gray-200 px-4 py-3">
                            <button
                                onClick={handleAddWallet}
                                className="w-full text-center text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-800 py-2 px-4 rounded-md flex items-center justify-center"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 00-1 1v5H4a1 1 0 100 2h5v5a1 1 0 102 0v-5h5a1 1 0 100-2h-5V4a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                Add Wallet
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
                className="btn btn-primary whitespace-nowrap"
                style={{ minWidth: '160px', zIndex: 50 }}
            >
                {buttonClicked ? 'Connecting...' : 'Connect Wallet'}
            </button>

            {/* Always render the modal at the document root level */}
            {renderWalletSelector()}
        </>
    );
} 