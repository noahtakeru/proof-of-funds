// File: /lib/zk/tests/real-wallets/TestnetProvider.js
// This class manages testnet connections
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

export class TestnetProvider {
    /**
     * Create testnet provider with configurable network
     * @param {Object} config - Provider configuration
     * @param {string} config.network - Network name (polygon_amoy, polygon_mumbai, sepolia, etc.)
     * @param {string} config.rpcUrl - Optional custom RPC URL
     * @param {string} config.fundingKey - Private key for funding wallet
     * @param {string} config.infuraKey - Optional Infura API key
     * @param {string} config.alchemyKey - Optional Alchemy API key
     */
    constructor(config) {
        this.config = config;
        this.provider = this.createProvider();
        this.fundingWallet = this.createFundingWallet();
        this.networkInfo = this.getNetworkInfo();
    }

    /**
     * Get network currency and other details
     * @private
     * @returns {Object} Network information
     */
    getNetworkInfo() {
        // Default to polygon information
        let info = {
            name: 'Polygon Amoy',
            currency: 'MATIC',
            currencyDecimals: 18,
            explorer: 'https://www.oklink.com/amoy'
        };

        switch (this.config.network) {
            case 'polygon_amoy':
                info = {
                    name: 'Polygon Amoy',
                    currency: 'MATIC',
                    currencyDecimals: 18,
                    explorer: 'https://www.oklink.com/amoy'
                };
                break;
            case 'polygon_mumbai':
                info = {
                    name: 'Polygon Mumbai',
                    currency: 'MATIC',
                    currencyDecimals: 18,
                    explorer: 'https://mumbai.polygonscan.com'
                };
                break;
            case 'sepolia':
                info = {
                    name: 'Ethereum Sepolia',
                    currency: 'ETH',
                    currencyDecimals: 18,
                    explorer: 'https://sepolia.etherscan.io'
                };
                break;
            case 'goerli':
                info = {
                    name: 'Ethereum Goerli',
                    currency: 'ETH',
                    currencyDecimals: 18,
                    explorer: 'https://goerli.etherscan.io'
                };
                break;
        }

        return info;
    }

    /**
     * Create appropriate provider based on configuration
     * @returns {ethers.providers.Provider} The configured provider
     */
    createProvider() {
        // If custom RPC URL is provided, use it
        if (this.config.rpcUrl) {
            return new ethers.providers.JsonRpcProvider(this.config.rpcUrl);
        }

        // Use default providers for known networks
        switch (this.config.network) {
            case 'polygon_amoy':
                // Polygon Amoy is currently the target testnet for PoF
                return new ethers.providers.JsonRpcProvider('https://rpc-amoy.polygon.technology');
            case 'polygon_mumbai':
                // Polygon Mumbai is the legacy testnet for Polygon
                if (this.config.alchemyKey) {
                    return new ethers.providers.AlchemyProvider('maticmum', this.config.alchemyKey);
                }
                return new ethers.providers.JsonRpcProvider('https://rpc-mumbai.maticvigil.com');
            case 'sepolia':
                return new ethers.providers.InfuraProvider('sepolia', this.config.infuraKey);
            case 'goerli':
                return new ethers.providers.InfuraProvider('goerli', this.config.infuraKey);
            case 'localhost':
                return new ethers.providers.JsonRpcProvider('http://localhost:8545');
            default:
                // Default to Polygon Amoy for our project
                console.log(`Unknown network: ${this.config.network}, defaulting to Polygon Amoy testnet`);
                return new ethers.providers.JsonRpcProvider('https://rpc-amoy.polygon.technology');
        }
    }

    /**
     * Create funding wallet from private key
     * @returns {ethers.Wallet} Connected funding wallet
     */
    createFundingWallet() {
        if (!this.config.fundingKey) {
            throw new Error('Funding wallet private key required');
        }

        return new ethers.Wallet(this.config.fundingKey, this.provider);
    }

    /**
     * Get provider instance
     * @returns {ethers.providers.Provider} The provider
     */
    getProvider() {
        return this.provider;
    }

    /**
     * Get funding wallet instance
     * @returns {ethers.Wallet} The funding wallet
     */
    getFundingWallet() {
        return this.fundingWallet;
    }

    /**
     * Get chain ID for current network
     * @returns {Promise<number>} Chain ID
     */
    async getChainId() {
        const network = await this.provider.getNetwork();
        return network.chainId;
    }

    /**
     * Get network currency information
     * @returns {Object} Currency information
     */
    getCurrencyInfo() {
        return {
            symbol: this.networkInfo.currency,
            decimals: this.networkInfo.currencyDecimals,
            name: this.networkInfo.name
        };
    }

    /**
     * Check if network is available
     * @returns {Promise<boolean>} Network availability
     */
    async checkNetworkAvailability() {
        try {
            const blockNumber = await this.provider.getBlockNumber();
            return blockNumber > 0;
        } catch (error) {
            console.error('Network availability check failed:', error);
            return false;
        }
    }

    /**
     * Get recommended gas price
     * @returns {Promise<string>} Gas price in Gwei
     */
    async getGasPrice() {
        const gasPrice = await this.provider.getGasPrice();
        return ethers.utils.formatUnits(gasPrice, 'gwei');
    }

    /**
     * Get block explorer URL for given address
     * @param {string} address - Wallet address
     * @returns {string} Explorer URL
     */
    getExplorerUrl(address) {
        return `${this.networkInfo.explorer}/address/${address}`;
    }

    /**
     * Get transaction explorer URL
     * @param {string} txHash - Transaction hash
     * @returns {string} Explorer URL
     */
    getTransactionUrl(txHash) {
        return `${this.networkInfo.explorer}/tx/${txHash}`;
    }
} 