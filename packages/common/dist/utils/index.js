/**
 * Utils Module - Package Index
 * 
 * Exports utility functions from the utils package
 */

// Export utilities
export { getEthers, isValidAmount, parseAmount, parseEther, getZeroWei } from './ethersUtils.js';
export { default as ethersUtils } from './ethersUtils.js';
export { getTokenPricesWithMoralis, getWalletAssetsWithValue, getWalletTokens } from './moralisApi.js';
export { default as moralisApi } from './moralisApi.js';

// Export wallet utilities (be specific to avoid conflicts)
export { CHAIN_IDS as CHAIN_IDS_MAPPINGS, CHAIN_NAMES, getChainName, getChainId, getRpcUrl, getExplorerUrl } from './chainMappings.js';
export { default as chainMappings } from './chainMappings.js';
export { 
  WALLET_TYPES, 
  getConnectedWallets,
  saveWalletConnection,
  disconnectWallet,
  disconnectAllWallets,
  isWalletConnected
} from './walletCore.js';
export { default as walletCore } from './walletCore.js';
export { connectMetaMask as connectMetaMaskEVM, signMessageWithMetaMask, switchChain, addChain } from './evmWallets.js';
export { default as evmWallets } from './evmWallets.js';
export { connectPhantom, disconnectPhantom, signMessageWithPhantom, isPhantomAvailable } from './solanaWallets.js';
export { default as solanaWallets } from './solanaWallets.js';

// Export legacy wallet helpers (for backward compatibility) - use named exports to avoid conflicts
export { 
  connectMetaMask as connectMetaMaskLegacy,
  disconnectWallet as disconnectWalletLegacy,
  getConnectedWallets as getConnectedWalletsLegacy,
  saveWalletConnection as saveWalletConnectionLegacy
} from './walletHelpers.js';
export { useAccount, useConnect, useDisconnect } from './wallet.js';