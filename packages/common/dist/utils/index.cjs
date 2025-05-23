/**
 * Utils Module - Package Index
 * 
 * Exports utility functions from the utils package
 */

// Export utilities
module.exports = { getEthers, isValidAmount, parseAmount, parseEther, getZeroWei } from './ethersUtils.js';
module.exports = { default as ethersUtils } from './ethersUtils.js';
module.exports = { getTokenPricesWithMoralis, getWalletAssetsWithValue, getWalletTokens } from './moralisApi.js';
module.exports = { default as moralisApi } from './moralisApi.js';

// Export wallet utilities (be specific to avoid conflicts)
module.exports = { CHAIN_IDS as CHAIN_IDS_MAPPINGS, CHAIN_NAMES, getChainName, getChainId, getRpcUrl, getExplorerUrl } from './chainMappings.js';
module.exports = { default as chainMappings } from './chainMappings.js';
module.exports = { 
  WALLET_TYPES, 
  getConnectedWallets,
  saveWalletConnection,
  disconnectWallet,
  disconnectAllWallets,
  isWalletConnected
} from './walletCore.js';
module.exports = { default as walletCore } from './walletCore.js';
module.exports = { connectMetaMask as connectMetaMaskEVM, signMessageWithMetaMask, switchChain, addChain } from './evmWallets.js';
module.exports = { default as evmWallets } from './evmWallets.js';
module.exports = { connectPhantom, disconnectPhantom, signMessageWithPhantom, isPhantomAvailable } from './solanaWallets.js';
module.exports = { default as solanaWallets } from './solanaWallets.js';

// Export legacy wallet helpers (for backward compatibility) - use named exports to avoid conflicts
module.exports = { 
  connectMetaMask as connectMetaMaskLegacy,
  disconnectWallet as disconnectWalletLegacy,
  getConnectedWallets as getConnectedWalletsLegacy,
  saveWalletConnection as saveWalletConnectionLegacy
} from './walletHelpers.js';
module.exports = { useAccount, useConnect, useDisconnect } from './wallet.js';