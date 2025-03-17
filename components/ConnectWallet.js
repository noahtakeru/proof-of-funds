import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useEffect, useState, useRef } from 'react';
import WalletSelector from './WalletSelector';

export default function ConnectWallet() {
    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();
    const [showWalletSelector, setShowWalletSelector] = useState(false);
    const [connectedWallets, setConnectedWallets] = useState([]);
    const [showWalletMenu, setShowWalletMenu] = useState(false);
    const walletMenuRef = useRef(null);

    // Phantom wallet state
    const [phantomAddress, setPhantomAddress] = useState(null);
    const [isPhantomConnected, setIsPhantomConnected] = useState(false);

    // Add a flag to track if the user initiated a connection
    // Initialize from localStorage if available
    const [userInitiatedConnection, setUserInitiatedConnection] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('userInitiatedConnection') === 'true';
        }
        return false;
    });

    // Format address for display
    const formatAddress = (address) => {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    // Modify the checkPhantomConnection to only run if user initiated
    useEffect(() => {
        const checkPhantomConnection = async () => {
            if (userInitiatedConnection && typeof window !== 'undefined' && window.solana) {
                try {
                    // Check if already connected
                    if (window.solana.isConnected) {
                        const publicKey = window.solana.publicKey?.toString();
                        if (publicKey) {
                            setPhantomAddress(publicKey);
                            setIsPhantomConnected(true);

                            // Add to connected wallets list if not already there
                            setConnectedWallets(prev => {
                                const existingWallet = prev.find(w =>
                                    w.fullAddress === publicKey &&
                                    w.type === 'solana'
                                );

                                if (!existingWallet) {
                                    return [...prev, {
                                        id: `phantom-${publicKey.substring(0, 8)}`,
                                        name: 'Phantom',
                                        address: formatAddress(publicKey),
                                        fullAddress: publicKey,
                                        chain: 'Solana',
                                        type: 'solana'
                                    }];
                                }
                                return prev;
                            });
                        }
                    }

                    // Listen for connection events
                    window.solana.on('connect', () => {
                        const publicKey = window.solana.publicKey?.toString();
                        if (publicKey) {
                            setPhantomAddress(publicKey);
                            setIsPhantomConnected(true);

                            // Add to connected wallets list
                            setConnectedWallets(prev => {
                                const existingWallet = prev.find(w =>
                                    w.fullAddress === publicKey &&
                                    w.type === 'solana'
                                );

                                if (!existingWallet) {
                                    return [...prev, {
                                        id: `phantom-${publicKey.substring(0, 8)}`,
                                        name: 'Phantom',
                                        address: formatAddress(publicKey),
                                        fullAddress: publicKey,
                                        chain: 'Solana',
                                        type: 'solana'
                                    }];
                                }
                                return prev;
                            });
                        }
                    });

                    window.solana.on('disconnect', () => {
                        setPhantomAddress(null);
                        setIsPhantomConnected(false);

                        // Remove Phantom wallets from connected wallets list
                        setConnectedWallets(prev =>
                            prev.filter(w => w.type !== 'solana')
                        );
                    });
                } catch (error) {
                    console.error('Error checking Phantom connection:', error);
                }
            }
        };

        checkPhantomConnection();

        // Cleanup event listeners on unmount
        return () => {
            if (typeof window !== 'undefined' && window.solana) {
                window.solana.removeAllListeners('connect');
                window.solana.removeAllListeners('disconnect');
            }
        };
    }, [userInitiatedConnection]);

    // Function to initiate connection
    const initiateConnection = () => {
        setUserInitiatedConnection(true);
        // Store in localStorage to persist across pages
        if (typeof window !== 'undefined') {
            localStorage.setItem('userInitiatedConnection', 'true');
        }
        setShowWalletSelector(true);
    };

    // Listen for wallet connections from other components
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'lastWalletConnection') {
                try {
                    const data = JSON.parse(e.newValue);
                    if (data && data.wallet && data.accounts && data.accounts.length > 0) {
                        console.log('Detected wallet connection from another component:', data);

                        if (data.wallet === 'metamask') {
                            // Immediately update our wallet list with the selected accounts
                            const metaMaskWallets = data.accounts.map(account => ({
                                id: `metamask-${account.toLowerCase()}`,
                                name: 'MetaMask',
                                address: formatAddress(account),
                                fullAddress: account,
                                chain: 'Polygon',
                                type: 'evm'
                            }));

                            setConnectedWallets(prev => {
                                const nonMetaMaskWallets = prev.filter(w => w.type !== 'evm');
                                return [...nonMetaMaskWallets, ...metaMaskWallets];
                            });

                            // This will also trigger the userInitiatedConnection flag
                            setUserInitiatedConnection(true);
                            if (typeof window !== 'undefined') {
                                localStorage.setItem('userInitiatedConnection', 'true');
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error processing wallet connection data:', error);
                }
            }
        };

        if (typeof window !== 'undefined') {
            // Listen for the storage event
            window.addEventListener('storage', handleStorageChange);

            // Also check for direct changes in the same window
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = function (key, value) {
                // Call the original setItem first
                const result = originalSetItem.apply(this, arguments);

                // Create and dispatch a synthetic event
                const event = new StorageEvent('storage', {
                    key: key,
                    newValue: value,
                    oldValue: localStorage.getItem(key),
                    storageArea: localStorage
                });
                window.dispatchEvent(event);

                return result;
            };
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('storage', handleStorageChange);
                // Restore original localStorage.setItem if we modified it
                if (window._originalSetItem) {
                    localStorage.setItem = window._originalSetItem;
                    delete window._originalSetItem;
                }
            }
        };
    }, [formatAddress]);

    // Set up synthetic storage event handler
    useEffect(() => {
        // Set up the synthetic event handler for direct localStorage changes
        // But only do it once to avoid stacking multiple handlers
        if (typeof window !== 'undefined' && !window._originalSetItem) {
            window._originalSetItem = localStorage.setItem;
            localStorage.setItem = function (key, value) {
                // Call the original setItem first
                const result = window._originalSetItem.apply(this, arguments);

                // Create and dispatch a synthetic event
                const event = new StorageEvent('storage', {
                    key: key,
                    newValue: value,
                    oldValue: localStorage.getItem(key),
                    storageArea: localStorage
                });
                window.dispatchEvent(event);

                return result;
            };
        }

        return () => {
            // Cleanup will be handled by the main storage event listener
        };
    }, []);

    // Listen for account changes in MetaMask
    useEffect(() => {
        const handleAccountsChanged = async (accounts) => {
            if (accounts.length === 0) {
                // User disconnected all accounts
                setConnectedWallets(prev => prev.filter(w => w.type !== 'evm'));
            } else {
                // Update the connected wallets with the new accounts
                const metaMaskWallets = accounts.map(account => ({
                    // Use the full address in the ID to ensure uniqueness
                    id: `metamask-${account.toLowerCase()}`,
                    name: 'MetaMask',
                    address: formatAddress(account),
                    fullAddress: account,
                    chain: 'Polygon',
                    type: 'evm'
                }));

                // Log the wallets for debugging
                console.log('MetaMask wallets updated:', metaMaskWallets);

                // Replace all existing MetaMask wallets with the new ones
                setConnectedWallets(prev => {
                    const nonMetaMaskWallets = prev.filter(w => w.type !== 'evm');
                    return [...nonMetaMaskWallets, ...metaMaskWallets];
                });
            }
        };

        if (typeof window !== 'undefined' && window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
        }

        return () => {
            if (typeof window !== 'undefined' && window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            }
        };
    }, []);

    // Track MetaMask connection only when explicitly connected
    useEffect(() => {
        if (userInitiatedConnection && isConnected && address) {
            const fetchAllAccounts = async () => {
                try {
                    if (window.ethereum && window.ethereum.request) {
                        // Get all connected accounts from MetaMask
                        const accounts = await window.ethereum.request({
                            method: 'eth_accounts'
                        });

                        console.log('All connected MetaMask accounts:', accounts);

                        if (accounts && accounts.length > 0) {
                            // Keep only solana wallets
                            const nonMetaMaskWallets = connectedWallets.filter(w => w.type !== 'evm');

                            // Add all connected MetaMask accounts as separate entries
                            const metaMaskWallets = accounts.map(account => ({
                                // Use the full address in the ID to ensure uniqueness
                                id: `metamask-${account.toLowerCase()}`,
                                name: 'MetaMask',
                                address: formatAddress(account),
                                fullAddress: account,
                                chain: 'Polygon',
                                type: 'evm'
                            }));

                            console.log('MetaMask wallets to add:', metaMaskWallets);

                            // Update state with all wallets
                            setConnectedWallets([...nonMetaMaskWallets, ...metaMaskWallets]);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching MetaMask accounts:', error);
                }
            };

            fetchAllAccounts();
        }
    }, [userInitiatedConnection, isConnected, address, connectedWallets]);

    // Close wallet menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (walletMenuRef.current && !walletMenuRef.current.contains(event.target)) {
                setShowWalletMenu(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleDisconnect = (walletId) => {
        if (walletId.startsWith('metamask-')) {
            // For MetaMask, disconnect completely regardless of number of accounts
            disconnect();

            // Also remove this wallet from our list immediately
            setConnectedWallets(prev => prev.filter(w => w.id !== walletId));

            // If this was the last MetaMask wallet, we should properly reset state
            const remainingMetaMaskWallets = connectedWallets.filter(w =>
                w.type === 'evm' && w.id !== walletId
            );

            if (remainingMetaMaskWallets.length === 0) {
                // Reset userInitiatedConnection to prevent auto-reconnect
                setUserInitiatedConnection(false);
                // Remove from localStorage
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('userInitiatedConnection');
                }
            }
        } else if (walletId.startsWith('phantom-')) {
            // Phantom only allows one connected account at a time
            window.solana.disconnect();
        }

        setShowWalletMenu(false);
    };

    const handleWalletSelectorClose = () => {
        setShowWalletSelector(false);
    };

    const toggleWalletMenu = () => {
        setShowWalletMenu(!showWalletMenu);
    };

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
                        className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg z-10 border"
                    >
                        <div className="py-1 border-b">
                            <div className="px-4 py-2 text-sm font-medium text-gray-700">
                                Connected Wallets
                            </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                            {connectedWallets.map(wallet => (
                                <div
                                    key={wallet.id}
                                    className="px-4 py-3 hover:bg-gray-50 flex justify-between items-center"
                                >
                                    <div>
                                        <div className="font-medium text-sm">
                                            {wallet.name}
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-center">
                                            <span className="mr-1">{wallet.address}</span>
                                            <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded">
                                                {wallet.chain}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDisconnect(wallet.id)}
                                        className="text-red-500 hover:text-red-700 text-xs"
                                    >
                                        Disconnect
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="py-1 border-t">
                            <button
                                onClick={handleAddWallet}
                                className="px-4 py-2 text-sm text-primary-600 hover:bg-gray-50 w-full text-left flex items-center"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                Add Another Wallet
                            </button>
                        </div>
                    </div>
                )}

                {/* Wallet Selector Modal */}
                {showWalletSelector && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl overflow-hidden max-w-md w-full">
                            <WalletSelector onClose={handleWalletSelectorClose} />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div>
            <button onClick={initiateConnection} className="btn btn-primary">
                Connect Wallet
            </button>
            {showWalletSelector && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl overflow-hidden max-w-md w-full">
                        <WalletSelector onClose={handleWalletSelectorClose} />
                    </div>
                </div>
            )}
        </div>
    );
} 