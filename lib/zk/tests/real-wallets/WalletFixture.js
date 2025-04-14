// File: /lib/zk/tests/real-wallets/WalletFixture.js
// This class manages test wallets for the ZK proof system
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

export class WalletFixture {
    constructor(config) {
        this.provider = config.provider;
        this.fundingWallet = config.fundingWallet;
        this.dataDir = config.dataDir || path.join(__dirname, 'fixtures');
        this.wallets = [];
        this.networkProvider = config.networkProvider; // TestnetProvider reference
        this.currencySymbol = this.networkProvider ?
            this.networkProvider.getCurrencyInfo().symbol : 'MATIC'; // Default to MATIC for Polygon
        this.ensureDataDirExists();
    }

    ensureDataDirExists() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    /**
     * Create a test wallet with specified balance
     * @param {Object} options - Wallet creation options
     * @param {string} options.label - Label for wallet identification
     * @param {string} options.balance - Amount to fund in native currency (MATIC for Polygon)
     * @param {boolean} options.persist - Whether to save wallet to disk
     * @returns {Object} The created wallet
     */
    async createWallet(options) {
        // Generate a new wallet with deterministic seed if needed
        const wallet = options.mnemonic
            ? ethers.Wallet.fromMnemonic(options.mnemonic)
            : ethers.Wallet.createRandom();

        // Connect to provider
        const connectedWallet = wallet.connect(this.provider);

        // Fund the wallet if balance is specified
        if (options.balance) {
            console.log(`Funding wallet ${connectedWallet.address} with ${options.balance} ${this.currencySymbol}...`);
            const tx = await this.fundingWallet.sendTransaction({
                to: connectedWallet.address,
                value: ethers.utils.parseEther(options.balance)
            });
            await tx.wait(2); // Wait for 2 confirmations
            console.log(`Funding transaction confirmed: ${tx.hash}`);

            // Add explorer link if available
            if (this.networkProvider) {
                console.log(`Transaction details: ${this.networkProvider.getTransactionUrl(tx.hash)}`);
            }
        }

        // Save wallet if persistence is requested
        if (options.persist) {
            this.persistWallet(connectedWallet, options.label);
        }

        // Add to internal wallet list
        this.wallets.push({
            address: connectedWallet.address,
            privateKey: connectedWallet.privateKey,
            label: options.label,
            balance: options.balance
        });

        return connectedWallet;
    }

    /**
     * Persist wallet to disk for later use
     * @param {ethers.Wallet} wallet - The wallet to persist
     * @param {string} label - Wallet label
     */
    persistWallet(wallet, label) {
        const walletData = {
            address: wallet.address,
            privateKey: wallet.privateKey,
            label: label,
            timestamp: new Date().toISOString()
        };

        const filePath = path.join(this.dataDir, `${label || wallet.address}.json`);
        fs.writeFileSync(filePath, JSON.stringify(walletData, null, 2));
    }

    /**
     * Load a persisted wallet
     * @param {string} labelOrAddress - Wallet label or address
     * @returns {ethers.Wallet} The loaded wallet
     */
    loadWallet(labelOrAddress) {
        // Try loading by label first
        let filePath = path.join(this.dataDir, `${labelOrAddress}.json`);

        // If not found, try loading by address
        if (!fs.existsSync(filePath)) {
            const files = fs.readdirSync(this.dataDir);
            for (const file of files) {
                const data = JSON.parse(fs.readFileSync(path.join(this.dataDir, file)));
                if (data.address === labelOrAddress) {
                    filePath = path.join(this.dataDir, file);
                    break;
                }
            }
        }

        if (!fs.existsSync(filePath)) {
            throw new Error(`Wallet not found: ${labelOrAddress}`);
        }

        const walletData = JSON.parse(fs.readFileSync(filePath));
        const wallet = new ethers.Wallet(walletData.privateKey);
        return wallet.connect(this.provider);
    }

    /**
     * Get current balance for a wallet
     * @param {string} address - Wallet address
     * @returns {Promise<string>} Balance in native currency (MATIC for Polygon)
     */
    async getBalance(address) {
        const balance = await this.provider.getBalance(address);
        return ethers.utils.formatEther(balance);
    }

    /**
     * Set wallet balance to exact amount (for standard proof testing)
     * @param {ethers.Wallet} wallet - Wallet to adjust
     * @param {string} targetBalance - Target balance in native currency
     */
    async setExactBalance(wallet, targetBalance) {
        const currentBalance = await this.getBalance(wallet.address);
        const currentBalanceBN = ethers.utils.parseEther(currentBalance);
        const targetBalanceBN = ethers.utils.parseEther(targetBalance);

        console.log(`Adjusting balance of ${wallet.address} from ${currentBalance} to ${targetBalance} ${this.currencySymbol}...`);

        if (currentBalanceBN.lt(targetBalanceBN)) {
            // Need to add funds
            const difference = targetBalanceBN.sub(currentBalanceBN);
            console.log(`Adding ${ethers.utils.formatEther(difference)} ${this.currencySymbol} to wallet...`);

            const tx = await this.fundingWallet.sendTransaction({
                to: wallet.address,
                value: difference
            });
            await tx.wait(2);
            console.log(`Funding transaction confirmed: ${tx.hash}`);
        } else if (currentBalanceBN.gt(targetBalanceBN)) {
            // Need to remove funds
            const difference = currentBalanceBN.sub(targetBalanceBN);

            // Account for gas costs by adding a small buffer
            // Polygon gas prices are typically different than Ethereum
            const gasPrice = await this.provider.getGasPrice();

            // Polygon often has higher gas limit requirements
            const gasLimit = 21000; // Standard transfer gas
            const gasCost = gasPrice.mul(gasLimit);

            // Ensure we account for gas costs
            const amountToSend = difference.sub(gasCost);

            if (amountToSend.lte(0)) {
                console.log(`Difference (${ethers.utils.formatEther(difference)} ${this.currencySymbol}) is too small to cover gas costs.`);
                return;
            }

            console.log(`Removing ${ethers.utils.formatEther(amountToSend)} ${this.currencySymbol} from wallet...`);

            // Send excess funds back to funding wallet
            const tx = await wallet.sendTransaction({
                to: this.fundingWallet.address,
                value: amountToSend,
                gasLimit,
                gasPrice
            });
            await tx.wait(2);
            console.log(`Return transaction confirmed: ${tx.hash}`);
        }

        // Verify balance after adjustment
        const newBalance = await this.getBalance(wallet.address);
        const newBalanceBN = ethers.utils.parseEther(newBalance);

        // Allow small rounding/gas differences (0.0001 ETH/MATIC)
        const tolerance = ethers.utils.parseEther('0.0001');
        const difference = newBalanceBN.sub(targetBalanceBN).abs();

        if (difference.gt(tolerance)) {
            throw new Error(`Failed to set exact balance. Target: ${targetBalance}, Actual: ${newBalance} ${this.currencySymbol}`);
        }

        console.log(`Balance successfully adjusted to ${newBalance} ${this.currencySymbol}`);
    }

    /**
     * Clean up test wallets by returning funds to funding wallet
     */
    async cleanupWallets() {
        console.log(`Cleaning up test wallets...`);
        const gasPrice = await this.provider.getGasPrice();
        const gasLimit = 21000; // Standard transfer gas

        for (const walletInfo of this.wallets) {
            try {
                const wallet = new ethers.Wallet(walletInfo.privateKey, this.provider);
                const balance = await this.provider.getBalance(wallet.address);

                // Only attempt transfer if balance is sufficient to cover gas
                if (balance.gt(gasPrice.mul(gasLimit).mul(2))) {
                    const amountToSend = balance.sub(gasPrice.mul(gasLimit));

                    console.log(`Returning ${ethers.utils.formatEther(amountToSend)} ${this.currencySymbol} from ${wallet.address} to funding wallet...`);

                    const tx = await wallet.sendTransaction({
                        to: this.fundingWallet.address,
                        value: amountToSend,
                        gasLimit,
                        gasPrice
                    });
                    await tx.wait(1);
                    console.log(`Return transaction confirmed: ${tx.hash}`);
                } else {
                    console.log(`Skipping wallet ${wallet.address} - insufficient balance to cover gas costs`);
                }
            } catch (error) {
                console.error(`Error cleaning up wallet ${walletInfo.address}:`, error);
            }
        }
        console.log(`Wallet cleanup completed`);
    }
} 