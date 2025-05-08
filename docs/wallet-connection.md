# Wallet Connection System

This document explains how the wallet connection system works in our application, allowing users to connect and manage multiple accounts from MetaMask and Phantom wallets.

## Overview

Our application supports both Ethereum (via MetaMask) and Solana (via Phantom) wallets. The wallet connection system allows users to:

1. Connect multiple accounts from MetaMask through the native MetaMask UI
2. Connect a Phantom wallet account for Solana
3. View all connected accounts in a dropdown menu
4. Select specific accounts when creating proofs
5. Disconnect individual accounts as needed

## How It Works

### Initial Connection

1. When a user clicks the "Connect Wallet" button, they are presented with options for MetaMask or Phantom.
2. Upon selecting a wallet type:
   - For MetaMask: The native MetaMask account selector UI appears, allowing the user to select which accounts to give permission to the application.
   - For Phantom: The Phantom wallet popup appears for the user to approve the connection.
3. After connection, the button changes to "Manage Wallets" and displays the first connected wallet's address.

### Native Account Selection

- **MetaMask**: We use the `wallet_requestPermissions` method with `eth_accounts` parameter, which displays the official MetaMask account selection UI. This allows users to select one or more accounts to connect to our application.
- **Phantom**: We first disconnect if already connected to ensure the connection prompt is shown, allowing users to select which account to connect.

### Wallet Management

- Clicking "Manage Wallets" shows a dropdown with all connected wallets.
- Each wallet in the dropdown is displayed with:
  - Wallet provider name (MetaMask or Phantom)
  - Shortened wallet address
  - Network (Polygon or Solana)
  - A disconnect button
- The dropdown also includes an "Add Another Wallet" option to connect additional wallets.

### Account Tracking

- **MetaMask accounts**: Tracked using the `eth_accounts` method to retrieve all accounts that have explicitly granted permission to the application. We also listen to the `accountsChanged` event to update the wallet list when users change accounts in MetaMask.
- **Phantom accounts**: Tracked by checking the current `window.solana.publicKey` and listening to connect/disconnect events.
- Each wallet appears as a separate entry in the wallet list, even if they come from the same provider.

## Creating Proofs

When creating a proof:

1. The user is presented with a list of all connected wallets and selects which one to use.
2. If the selected wallet is not the currently active wallet:
   - For MetaMask: The system will request the user to switch to the correct account using the native MetaMask UI.
   - For Phantom: The system will verify the correct account is active.
3. The proof is created using the selected wallet's credentials.

## Implementation Details

- The `ConnectWallet.js` component manages the UI for displaying and managing wallets.
- The `WalletSelector.js` component handles the initial wallet connection process, showing wallet options and initiating the connection.
- The `create.js` page tracks connected wallets and allows wallet selection for proof creation.

Each wallet is tracked with the following information:
- `id`: A unique identifier for the wallet (`[wallet-type]-[portion-of-address]`)
- `name`: The wallet provider name ("MetaMask" or "Phantom")
- `address`: A shortened version of the wallet address for display
- `fullAddress`: The complete wallet address for transactions
- `chain`: The blockchain being used ("Polygon" or "Solana")
- `type`: The wallet type ("evm" or "solana")

## Code Adjustments

useEffect(() => {
    const handleAccountsChanged = async (accounts) => {
        if (accounts.length === 0) {
            // User disconnected all accounts
            setConnectedWallets(prev => prev.filter(w => w.type !== 'evm'));
        } else {
            // Update the connected wallets with the new accounts
            setConnectedWallets(accounts.map(account => ({
                id: `metamask-${account.substring(0, 8)}`,
                name: 'MetaMask',
                address: formatAddress(account),
                fullAddress: account,
                chain: 'Polygon',
                type: 'evm'
            })));
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

// Add a flag to track if the user initiated a connection
const [userInitiatedConnection, setUserInitiatedConnection] = useState(false);

// Modify the fetchAllAccounts to only run if user initiated
useEffect(() => {
    if (userInitiatedConnection && isConnected && address) {
        const fetchAllAccounts = async () => {
            try {
                if (window.ethereum && window.ethereum.request) {
                    // Get all connected accounts from MetaMask
                    const accounts = await window.ethereum.request({
                        method: 'eth_accounts'
                    });

                    if (accounts && accounts.length > 0) {
                        // Keep only solana wallets
                        const nonMetaMaskWallets = connectedWallets.filter(w => w.type !== 'evm');

                        // Add all connected MetaMask accounts as separate entries
                        const metaMaskWallets = accounts.map(account => ({
                            id: `metamask-${account.substring(2, 10)}`,
                            name: 'MetaMask',
                            address: formatAddress(account),
                            fullAddress: account,
                            chain: 'Polygon',
                            type: 'evm'
                        }));

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
}, [userInitiatedConnection, isConnected, address]);

// Function to initiate connection
const initiateConnection = () => {
    setUserInitiatedConnection(true);
    setShowWalletSelector(true); // Show the wallet selector UI
};

// Ensure the wallet selector is shown
return (
    <div>
        <button onClick={initiateConnection} className="btn btn-primary">
            Connect Wallet
        </button>
        {showWalletSelector && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl overflow-hidden max-w-md w-full">
                    <WalletSelector onClose={() => setShowWalletSelector(false)} />
                </div>
            </div>
        )}
    </div>
); 

// Ensure no automatic connection logic is present
useEffect(() => {
    // Only run connection logic if explicitly triggered by user action
    if (userInitiatedConnection) {
        // Connection logic here
    }
}, [userInitiatedConnection]); 