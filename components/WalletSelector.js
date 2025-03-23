import { useState, useEffect, useRef } from 'react';
import { connectMetaMask, connectPhantom, saveWalletConnection } from '../lib/walletHelpers';
import PhantomMultiWalletSelector from './PhantomMultiWalletSelector';
import { SUPPORTED_CHAINS } from '../config/constants';

export default function WalletSelector({ onClose }) {
    console.log('WalletSelector component rendered');

    // Add ref to main container
    const selectorRef = useRef(null);

    const [availableWallets, setAvailableWallets] = useState([
        {
            id: 'metamask',
            name: 'MetaMask',
            chain: 'Multi-Chain',
            supportedChains: ['Ethereum', 'Polygon', 'BNB Chain'],
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
            id: 'phantomMulti',
            name: 'Phantom',
            chain: 'Solana',
            supportedChains: ['Solana'],
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
        },
        {
            id: 'walletconnect',
            name: 'WalletConnect',
            chain: 'Multi-Chain',
            supportedChains: ['Ethereum', 'Polygon', 'BNB Chain', 'Solana'],
            isInstalled: true, // Always available as it's a web-based service
            icon: (
                <svg width="28" height="28" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M96 48C96 74.51 74.51 96 48 96C21.49 96 0 74.51 0 48C0 21.49 21.49 0 48 0C74.51 0 96 21.49 96 48Z" fill="#3396FF" />
                    <path d="M24.42 32.5C35.1486 21.7714 52.2514 21.7714 62.98 32.5L63.8512 33.3712C64.2174 33.7374 64.2174 34.3317 63.8512 34.6979L59.3754 39.1737C59.1923 39.3568 58.8952 39.3568 58.7121 39.1737L57.5172 37.9788C50.0469 30.5085 37.3531 30.5085 29.8828 37.9788L28.5879 39.2737C28.4048 39.4568 28.1077 39.4568 27.9246 39.2737L23.4488 34.7979C23.0826 34.4317 23.0826 33.8374 23.4488 33.4712L24.42 32.5ZM70.68 40.2L74.5684 44.0884C74.9346 44.4546 74.9346 45.0489 74.5684 45.4151L54.4496 65.5339C54.0834 65.9001 53.4891 65.9001 53.1229 65.5339L39.2491 51.6601C39.1575 51.5685 39.0043 51.5685 38.9127 51.6601L25.0389 65.5339C24.6727 65.9001 24.0784 65.9001 23.7122 65.5339L3.59343 45.4151C3.22724 45.0489 3.22724 44.4546 3.59343 44.0884L7.48185 40.2C7.84804 39.8338 8.44233 39.8338 8.80852 40.2L22.6823 54.0739C22.7739 54.1655 22.9271 54.1655 23.0187 54.0739L36.8925 40.2C37.2587 39.8338 37.853 39.8338 38.2192 40.2L52.093 54.0739C52.1846 54.1655 52.3378 54.1655 52.4294 54.0739L66.3032 40.2C66.6694 39.8338 67.2637 39.8338 67.6299 40.2H70.68Z" fill="white" />
                </svg>
            )
        }
    ]);
    const [error, setError] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [selectedWallet, setSelectedWallet] = useState(null);
    const [showMultiWalletSelector, setShowMultiWalletSelector] = useState(false);
    const [selectedChain, setSelectedChain] = useState(null);

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
                        } else if (wallet.id === 'phantomMulti') {
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
            if (walletId === 'metamask') {
                // Use our centralized util for MetaMask connection
                const accounts = await connectMetaMask();
                console.log('MetaMask accounts:', accounts);
                // Save the connection data
                saveWalletConnection('metamask', accounts);

                // Close the dialog after successful connection
                setTimeout(() => {
                    console.log('Connection successful, closing wallet selector');
                    if (typeof onClose === 'function') {
                        onClose();
                    } else {
                        console.error('onClose is not a function:', onClose);
                    }
                }, 500);
            } else if (walletId === 'phantomMulti') {
                // Open the multi-wallet selector
                setShowMultiWalletSelector(true);
            } else if (walletId === 'walletconnect') {
                // Implementation pending - would integrate WalletConnect SDK
                setError('WalletConnect integration coming soon!');
                setConnecting(false);
            }
        } catch (error) {
            console.error(`Error connecting to ${walletId}:`, error);
            setError(`Failed to connect: ${error.message || 'Unknown error'}`);
            setConnecting(false);
            setSelectedWallet(null);
        }
    };

    // Function to handle close from the MultiWalletSelector
    const handleMultiWalletSelectorClose = () => {
        setShowMultiWalletSelector(false);
        // Close the dialog after the multi-wallet selector is closed
        if (typeof onClose === 'function') {
            onClose();
        } else {
            console.error('onClose is not a function:', onClose);
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

    // If the multi-wallet selector is open, show that instead
    if (showMultiWalletSelector) {
        return <PhantomMultiWalletSelector onClose={handleMultiWalletSelectorClose} />;
    }

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
                    : connecting ? `Connecting to ${selectedWallet === 'metamask' ? 'MetaMask' : selectedWallet === 'phantomMulti' ? 'Phantom' : 'WalletConnect'}...` : ''}
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
                                ? wallet.id === 'metamask'
                                    ? 'border-orange-300 bg-gradient-to-r from-amber-50 to-orange-50'
                                    : wallet.id === 'phantomMulti'
                                        ? 'border-indigo-300 bg-gradient-to-r from-indigo-50 to-purple-50'
                                        : 'border-blue-300 bg-gradient-to-r from-blue-50 to-sky-50'
                                : wallet.id === 'metamask'
                                    ? 'border-orange-200 hover:border-orange-500 hover:shadow-md cursor-pointer transition-all bg-gradient-to-r from-amber-50 to-orange-50'
                                    : wallet.id === 'phantomMulti'
                                        ? 'border-indigo-200 hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all bg-gradient-to-r from-indigo-50 to-purple-50'
                                        : 'border-blue-200 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all bg-gradient-to-r from-blue-50 to-sky-50'
                            : 'border-gray-200 bg-gray-50 opacity-70'
                            }`}
                        onClick={() => wallet.isInstalled && !connecting && handleConnect(wallet.id)}
                    >
                        <div className="flex items-center flex-1">
                            <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center bg-white`}>
                                {wallet.icon}
                            </div>
                            <div className="ml-3 flex-1">
                                <div className={`font-medium ${wallet.id === 'metamask' ? 'text-orange-900' : wallet.id === 'phantomMulti' ? 'text-indigo-900' : 'text-blue-900'}`}>{wallet.name}</div>
                                <div className={`text-sm ${wallet.id === 'metamask' ? 'text-orange-700' : wallet.id === 'phantomMulti' ? 'text-indigo-700' : 'text-blue-700'}`}>{wallet.chain}</div>
                            </div>
                            <div className="ml-3 text-xs flex flex-wrap justify-end gap-1 max-w-[120px]">
                                {wallet.supportedChains.map((chain, idx) => (
                                    <span key={idx} className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{chain}</span>
                                ))}
                            </div>
                        </div>

                        <div className="ml-3">
                            {wallet.isInstalled ? (
                                connecting && selectedWallet === wallet.id ? (
                                    <span className={`inline-block w-5 h-5 border-2 ${wallet.id === 'metamask' ? 'border-orange-500' : wallet.id === 'phantomMulti' ? 'border-indigo-500' : 'border-blue-500'} border-t-transparent rounded-full animate-spin`}></span>
                                ) : (
                                    <button className={`px-3 py-1 rounded-full text-xs ${wallet.id === 'metamask' ? 'bg-orange-100 text-orange-800' : wallet.id === 'phantomMulti' ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'}`}>
                                        Connect
                                    </button>
                                )
                            ) : (
                                <button className="px-3 py-1 rounded-full text-xs bg-gray-200 text-gray-600 cursor-not-allowed">
                                    Install
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 text-center text-sm text-gray-500">
                <p>By connecting a wallet, you agree to our <a href="#" className="text-blue-600 hover:underline">Terms of Service</a> and acknowledge that you have read and understand our <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>.</p>
            </div>
        </div>
    );
} 