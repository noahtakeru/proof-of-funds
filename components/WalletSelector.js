import { useState, useEffect, useRef } from 'react';
import { connectMetaMask, connectPhantom, saveWalletConnection } from '../lib/walletHelpers';

export default function WalletSelector({ onClose }) {
    console.log('WalletSelector component rendered');

    // Add ref to main container
    const selectorRef = useRef(null);

    const [availableWallets, setAvailableWallets] = useState([
        {
            id: 'metamask',
            name: 'MetaMask',
            chain: 'Polygon/Ethereum',
            isInstalled: false,
            icon: (
                <svg width="28" height="28" viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M32.958 1L19.698 10.898L22.134 5.223L32.958 1Z" fill="#E17726" stroke="#E17726" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2.64233 1L15.7598 11.0041L13.4673 5.22304L2.64233 1Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M28.2603 23.9878L24.7292 29.4269L32.2207 31.4965L34.4001 24.1195L28.2603 23.9878Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M1.21973 24.1195L3.38066 31.4965L10.8722 29.4269L7.3526 23.9878L1.21973 24.1195Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M10.4703 14.8377L8.39551 17.9876L15.8054 18.3159L15.5533 10.3039L10.4703 14.8377Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M25.1309 14.8382L19.9531 10.1899L19.7715 18.3164L27.1813 17.9881L25.1309 14.8382Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M10.8721 29.4263L15.3279 27.2045L11.4995 24.181L10.8721 29.4263Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20.2715 27.2045L24.7273 29.4263L24.0999 24.181L20.2715 27.2045Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            )
        },
        {
            id: 'phantom',
            name: 'Phantom',
            chain: 'Solana',
            isInstalled: false,
            icon: (
                <svg width="28" height="28" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="128" height="128" rx="64" fill="url(#paint0_linear)" />
                    <path d="M110.584 64.9142H99.142C99.142 41.7651 80.453 23 57.3931 23C36.6215 23 19.2452 37.9158 15.7773 57.7207C15.0179 62.6645 14.8937 67.0538 15.0841 70.9177C15.2744 74.3786 15.8333 77.8394 16.7678 81.0524C16.8629 81.147 16.9579 81.3361 17.053 81.4308C17.1481 81.5254 17.1481 81.5254 17.2431 81.6201C18.1777 83.0389 19.2975 84.0799 20.5124 84.0799H39.9639C40.3427 84.0799 40.6265 83.7964 40.6265 83.4182C40.6265 83.2291 40.5314 83.04 40.4364 82.9454C39.1265 81.3361 38.2869 79.4404 37.9268 77.4502C37.5667 75.2694 37.6618 73.0887 38.1919 70.9177C40.0609 62.0958 47.877 55.5399 57.2981 55.5399C67.6618 55.5399 76.1902 64.1551 76.1902 74.6621C76.1902 75.46 76.1331 76.3213 76.019 77.1718C75.905 77.9697 76.4734 78.7041 77.266 78.8196L87.4161 80.1062C87.5539 80.1271 87.6917 80.1271 87.8296 80.1062C88.5699 80.0115 89.0999 79.3483 89.0049 78.5895C88.905 77.7799 88.8526 76.9703 88.8526 76.1399C88.8526 68.1423 84.1972 61.0494 77.1995 57.5884V57.5884C77.0095 57.4939 76.8145 57.3992 76.6195 57.3046C76.4245 57.2099 76.3294 57.0208 76.3294 56.7373C76.3294 56.5482 76.3294 56.3591 76.4245 56.2644C76.5195 56.1698 76.7145 56.0751 76.9095 56.0751C87.3399 57.7787 95.2232 65.7578 98.0844 76.1608C98.3492 77.1809 99.2647 77.9012 100.308 77.9012H110.584C111.387 77.9012 112 77.2223 112 76.4128V66.4234C112 65.6347 111.387 64.9142 110.584 64.9142Z" fill="white" />
                    <defs>
                        <linearGradient id="paint0_linear" x1="64" y1="0" x2="64" y2="128" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#534BB1" />
                            <stop offset="1" stopColor="#551BF9" />
                        </linearGradient>
                    </defs>
                </svg>
            )
        }
    ]);
    const [error, setError] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [selectedWallet, setSelectedWallet] = useState(null);

    useEffect(() => {
        // Check which wallets are installed
        const checkWallets = async () => {
            try {
                console.log('Checking for installed wallets...');

                // Check for MetaMask
                const isMetaMaskAvailable = typeof window !== 'undefined' &&
                    window.ethereum &&
                    (window.ethereum.isMetaMask ||
                        (window.ethereum.providers &&
                            window.ethereum.providers.some(provider => provider.isMetaMask)));

                // Check for Phantom
                const isPhantomAvailable = typeof window !== 'undefined' &&
                    window.solana &&
                    window.solana.isPhantom;

                console.log('Wallet availability:', {
                    metamask: isMetaMaskAvailable,
                    phantom: isPhantomAvailable
                });

                setAvailableWallets(prev =>
                    prev.map(wallet => {
                        if (wallet.id === 'metamask') {
                            return { ...wallet, isInstalled: isMetaMaskAvailable };
                        } else if (wallet.id === 'phantom') {
                            return { ...wallet, isInstalled: isPhantomAvailable };
                        }
                        return wallet;
                    })
                );
            } catch (err) {
                console.error('Error checking wallet availability:', err);
                setError('Failed to detect wallets. Please refresh the page and try again.');
            }
        };

        checkWallets();

        // Make sure the modal is properly cleaned up on unmount
        return () => {
            console.log('WalletSelector component unmounting');
        };
    }, []);

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

    const handleConnect = async (walletId) => {
        console.log(`Attempting to connect to ${walletId}...`);
        setError('');
        setConnecting(true);
        setSelectedWallet(walletId);

        try {
            let accounts = [];

            if (walletId === 'metamask') {
                // Use our centralized util for MetaMask connection
                accounts = await connectMetaMask();
                console.log('MetaMask accounts:', accounts);
                // Save the connection data
                saveWalletConnection('metamask', accounts);
            } else if (walletId === 'phantom') {
                // For Phantom, we need to inform the user that they need to select the correct wallet in the extension first
                console.log('Connecting to currently selected Phantom wallet');

                // Give user instructions via the UI
                setSelectedWallet(walletId);
                setError('Note: Phantom only connects the currently active wallet in the extension. To connect a different wallet, switch accounts in the Phantom extension first, then try connecting again.');

                // Wait a moment for the user to read the instruction before proceeding
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Use our centralized util for Phantom connection
                accounts = await connectPhantom();
                console.log('Phantom accounts:', accounts);

                // Save the connection data
                saveWalletConnection('phantom', accounts);
            }

            // Close the dialog after successful connection
            setTimeout(() => {
                console.log('Connection successful, closing wallet selector');
                if (typeof onClose === 'function') {
                    onClose();
                } else {
                    console.error('onClose is not a function:', onClose);
                }
            }, 500);
        } catch (error) {
            console.error(`Error connecting to ${walletId}:`, error);
            setError(`Failed to connect: ${error.message || 'Unknown error'}`);
            setConnecting(false);
            setSelectedWallet(null);

            // Clean up any session flags if error occurs
            if (walletId === 'phantom') {
                sessionStorage.removeItem('phantom_force_ui_connect');
            }
        }
    };

    // Function to safely close the modal
    const handleClose = () => {
        console.log('Closing wallet selector modal');
        if (typeof onClose === 'function') {
            onClose();
        } else {
            console.error('onClose is not a function:', onClose);
        }
    };

    // Show only the selected wallet if one is selected
    const filteredWallets = selectedWallet
        ? availableWallets.filter(wallet => wallet.id === selectedWallet)
        : availableWallets;

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
                <h2 className="text-xl font-bold">Connect Wallet</h2>
                <button
                    onClick={handleClose}
                    className="text-gray-500 hover:text-gray-700 p-2"
                    aria-label="Close"
                >
                    ✕
                </button>
            </div>

            <div className="mb-4 text-sm text-gray-600">
                {!selectedWallet
                    ? 'Select a wallet to connect with'
                    : connecting ? `Connecting to ${selectedWallet === 'metamask' ? 'MetaMask' : 'Phantom'}...` : ''}
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                    {error}
                </div>
            )}

            <div className="space-y-3">
                {filteredWallets.map(wallet => (
                    <div
                        key={wallet.id}
                        className={`p-4 border rounded-lg flex justify-between items-center ${wallet.isInstalled
                            ? connecting && selectedWallet === wallet.id
                                ? 'border-blue-300 bg-blue-50'
                                : 'border-gray-300 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all'
                            : 'border-gray-200 bg-gray-50 opacity-70'
                            }`}
                        onClick={() => wallet.isInstalled && !connecting && handleConnect(wallet.id)}
                    >
                        <div className="flex items-center">
                            <div className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center">
                                {wallet.icon}
                            </div>
                            <div className="ml-3">
                                <div className="font-medium">{wallet.name}</div>
                                <div className="text-sm text-gray-500">{wallet.chain}</div>
                            </div>
                        </div>

                        <div>
                            {wallet.isInstalled ? (
                                connecting && selectedWallet === wallet.id ? (
                                    <span className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                                ) : (
                                    <span className="text-sm text-blue-600">Connect</span>
                                )
                            ) : (
                                <span className="text-sm text-gray-500">Not Installed</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
} 