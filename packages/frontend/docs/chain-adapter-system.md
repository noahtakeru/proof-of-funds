# Chain Adapter System

This document explains the Chain Adapter System implemented for the Proof of Funds platform to handle multiple blockchain networks.

## Overview

The Chain Adapter System provides a unified interface for interacting with different blockchain networks. It follows the Adapter pattern, providing a consistent API for common operations such as:

- Getting wallet balances
- Retrieving transaction history
- Signing messages
- Verifying signatures
- Validating addresses

## Architecture

The system consists of the following components:

### 1. ChainAdapter Interface

The `ChainAdapter` interface defines a common API for all blockchain adapters. It includes methods for:

- `getBalance`: Retrieve the balance of an address
- `getTransactions`: Get transaction history for an address
- `validateAddress`: Check if an address is valid for the specific chain
- `signMessage`: Sign a message with the connected wallet
- `getAddressFromSignature`: Recover the address that signed a message
- `connect`: Connect to a wallet
- `disconnect`: Disconnect from a wallet

### 2. Chain-Specific Implementations

Each supported blockchain has its own implementation of the `ChainAdapter` interface:

- `EVMChainAdapter`: For Ethereum-compatible chains (Ethereum, Polygon, Arbitrum, Optimism)
- `SolanaChainAdapter`: For Solana (placeholder for future implementation)
- `BitcoinChainAdapter`: For Bitcoin (placeholder for future implementation)

### 3. Chain Adapter Registry

The `ChainAdapterRegistry` provides a centralized registry for managing and accessing chain adapters. It:

- Tracks supported networks and their configurations
- Creates and caches adapter instances
- Provides methods to get adapters by chain ID or type
- Manages connection status for all adapters

### 4. React Integration

The `useChain` hook provides easy access to chain adapters in React components. It:

- Manages connection state
- Provides methods for wallet operations
- Handles wallet events (account changes, network changes)
- Automatically refreshes wallet balances

### 5. Wallet Management

The `walletManager` utility provides functions for managing multiple wallets across different chains:

- Connect multiple wallets
- Format addresses for display
- Track wallets in local storage
- Create temporary wallets for proof generation

## Usage Examples

### Getting a Chain Adapter

```typescript
import chainRegistry, { ChainType } from '../utils/chains';

// Get adapter by chain ID
const ethereumAdapter = chainRegistry.getAdapter(1);

// Get adapter by chain type
const polygonAdapter = chainRegistry.getAdapterByType(ChainType.EVM, 137);
```

### Using the useChain Hook in React Components

```tsx
import { useChain } from '../utils/hooks/useChain';
import { ChainType } from '../utils/chains';

function WalletComponent() {
  const {
    chainId,
    chainName,
    connectionStatus,
    walletAddress,
    balance,
    connect,
    disconnect,
    signMessage
  } = useChain(ChainType.EVM, 1); // Ethereum Mainnet
  
  return (
    <div>
      <h2>Chain: {chainName}</h2>
      {walletAddress ? (
        <>
          <p>Connected: {walletAddress}</p>
          <p>Balance: {balance ? ethers.utils.formatEther(balance) : '0'} ETH</p>
          <button onClick={disconnect}>Disconnect</button>
        </>
      ) : (
        <button onClick={connect}>Connect Wallet</button>
      )}
    </div>
  );
}
```

### Managing Multiple Wallets

```typescript
import { connectWallet, disconnectWallet, WalletConnectionOptions } from '../utils/walletManager';
import { ChainType } from '../utils/chains';

// Connect to Ethereum
const ethereumOptions: WalletConnectionOptions = {
  chainType: ChainType.EVM,
  chainId: 1
};
const ethereumWallet = await connectWallet(ethereumOptions);

// Connect to Polygon
const polygonOptions: WalletConnectionOptions = {
  chainType: ChainType.EVM,
  chainId: 137
};
const polygonWallet = await connectWallet(polygonOptions);

// Now you have two connected wallets
console.log(ethereumWallet, polygonWallet);

// Disconnect a wallet when done
await disconnectWallet(ethereumWallet);
```

## Supported Networks

### EVM Chains

- Ethereum Mainnet (Chain ID: 1)
- Polygon (Chain ID: 137)
- Arbitrum (Chain ID: 42161)
- Optimism (Chain ID: 10)

### Testnets

- Sepolia (Chain ID: 11155111)
- Polygon Mumbai (Chain ID: 80001)
- Arbitrum Goerli (Chain ID: 421613)

### Future Support

- Solana (MainNet and Devnet)
- Bitcoin

## Chain Types

The system defines three chain types:

- `ChainType.EVM`: Ethereum Virtual Machine compatible chains
- `ChainType.SOLANA`: Solana blockchain
- `ChainType.BITCOIN`: Bitcoin blockchain

## Extensibility

The Chain Adapter System is designed to be easily extended:

1. Create a new adapter implementing the `ChainAdapter` interface
2. Add network configurations to the `ChainAdapterRegistry`
3. Update the `ChainType` enum with the new chain type

## Best Practices

1. Always check connection status before performing wallet operations
2. Use the `ChainAdapterRegistry` to get adapters instead of creating them directly
3. Implement proper error handling for chain operations
4. Use the React hooks for component integration
5. Support multiple wallets for better user experience