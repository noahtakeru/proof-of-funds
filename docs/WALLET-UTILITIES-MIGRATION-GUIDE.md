# Wallet Utilities Migration Guide

This guide helps you transition from the legacy wallet utilities to the consolidated wallet utilities structure.

## Overview

The wallet utilities have been refactored to provide a more consistent and maintainable approach to wallet integration. The new structure includes:

1. `walletCore.js` - Core wallet functionality shared across wallet types
2. `evmWallets.js` - Utilities specific to EVM-compatible wallets (MetaMask)
3. `solanaWallets.js` - Utilities specific to Solana wallets (Phantom)
4. `chainMappings.js` - Centralized chain ID, name, and RPC URL mappings
5. `useUnifiedWallet.js` - React hook providing a unified interface for all wallet types

## Migration Steps

### 1. Import from the consolidated modules

**Before:**
```javascript
import { connectMetaMask, saveWalletConnection } from '@proof-of-funds/common/src/utils/walletHelpers';
```

**After:**
```javascript
// For EVM wallets
import { connectMetaMask } from '@proof-of-funds/common/src/utils/evmWallets';
// For Solana wallets
import { connectPhantom } from '@proof-of-funds/common/src/utils/solanaWallets';
// For shared wallet functionality
import { saveWalletConnection, getConnectedWallets } from '@proof-of-funds/common/src/utils/walletCore';
// For chain info
import { getChainName, getRpcUrl } from '@proof-of-funds/common/src/utils/chainMappings';
```

### 2. Use React hook for components

**Before:**
```javascript
import { useEffect, useState } from 'react';
import { connectMetaMask, getConnectedWallets } from '@proof-of-funds/common/src/utils/walletHelpers';

function WalletButton() {
  const [wallets, setWallets] = useState([]);
  
  useEffect(() => {
    setWallets(getConnectedWallets());
    
    const handleConnectionChange = () => {
      setWallets(getConnectedWallets());
    };
    
    window.addEventListener('wallet-connection-changed', handleConnectionChange);
    return () => {
      window.removeEventListener('wallet-connection-changed', handleConnectionChange);
    };
  }, []);
  
  const handleConnect = async () => {
    try {
      await connectMetaMask();
    } catch (error) {
      console.error(error);
    }
  };
  
  return (
    <button onClick={handleConnect}>
      {wallets.length > 0 ? 'Connected' : 'Connect Wallet'}
    </button>
  );
}
```

**After:**
```javascript
import { useUnifiedWallet } from '@proof-of-funds/common/src/hooks';

function WalletButton() {
  const { connectedWallets, connect, isConnecting } = useUnifiedWallet();
  
  const handleConnect = async () => {
    try {
      await connect('metamask');
    } catch (error) {
      console.error(error);
    }
  };
  
  return (
    <button onClick={handleConnect} disabled={isConnecting}>
      {connectedWallets.length > 0 ? 'Connected' : 'Connect Wallet'}
    </button>
  );
}
```

### 3. Use consolidated chain mappings

**Before:**
```javascript
function getRpcUrl(chain) {
  const chainName = typeof chain === 'string' ? chain.toLowerCase() : 'unknown';
  
  const rpcEndpoints = {
    ethereum: 'https://ethereum.publicnode.com',
    polygon: 'https://polygon-rpc.com',
    // ...other mappings
  };
  
  return rpcEndpoints[chainName] || null;
}

// Using chain IDs
function getChainName(chainId) {
  const chainIdMappings = {
    1: 'ethereum',
    137: 'polygon',
    // ...other mappings
  };
  
  return chainIdMappings[chainId] || 'unknown';
}
```

**After:**
```javascript
import { getRpcUrl, getChainName, CHAIN_IDS } from '@proof-of-funds/common/src/utils/chainMappings';

// Get RPC URL for a chain (works with both names and IDs)
const polygonRpc = getRpcUrl('polygon');
const ethereumRpc = getRpcUrl(1);

// Get chain name from ID
const chainName = getChainName(137); // 'polygon'

// Check chain constants
console.log(CHAIN_IDS[1]); // 'ethereum'
```

## Using with Wallet Connect

When integrating with Wallet Connect, use the EVM wallet utilities:

```javascript
import { saveWalletConnection, WALLET_TYPES } from '@proof-of-funds/common/src/utils/walletCore';

// After connecting with Wallet Connect
async function onWalletConnectSuccess(provider, accounts, chainId) {
  const wallet = {
    address: accounts[0],
    fullAddress: accounts[0],
    chainId,
    chain: getChainName(chainId),
    type: WALLET_TYPES.WALLETCONNECT,
    connectedAt: Date.now(),
    id: `${WALLET_TYPES.WALLETCONNECT}-${accounts[0]}`
  };
  
  await saveWalletConnection(WALLET_TYPES.WALLETCONNECT, wallet);
}
```

## Backward Compatibility

For backward compatibility, the legacy wallet helpers are still exported from the utilities module. However, it's recommended to migrate to the new utilities for improved consistency and maintainability.

> Note: The legacy helpers will be deprecated in future versions.

## Error Handling

The new wallet utilities integrate with the unified error handling system:

```javascript
import { connectMetaMask } from '@proof-of-funds/common/src/utils/evmWallets';

try {
  await connectMetaMask();
} catch (error) {
  if (error.code === 'WALLET_CONNECTION_FAILED') {
    // Handle connection failure
  } else if (error.code === 'WALLET_SIGNATURE_REJECTED') {
    // Handle user rejection
  }
}
```