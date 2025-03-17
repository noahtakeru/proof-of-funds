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