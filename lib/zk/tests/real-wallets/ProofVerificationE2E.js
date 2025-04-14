// File: /lib/zk/tests/real-wallets/ProofVerificationE2E.js
// End-to-end tests for ZK proof verification with real wallets
import { ethers } from 'ethers';
import { WalletFixture } from './WalletFixture.js';
import { TestnetProvider } from './TestnetProvider.js';
import fs from 'fs';
import path from 'path';

// Import ZK proof system components
import { generateStandardProof, generateThresholdProof, generateMaximumProof } from '../../src/zkProofGenerator.js';
import { verifyProof } from '../../src/zkProofVerifier.js';
import { serializeProof, deserializeProof } from '../../src/zkProofSerializer.js';

class ProofVerificationE2E {
    constructor(config) {
        // Default to Polygon Amoy for our project's primary testnet
        this.config = {
            network: 'polygon_amoy',
            ...config
        };

        this.testnetProvider = new TestnetProvider(this.config);
        this.walletFixture = new WalletFixture({
            provider: this.testnetProvider.getProvider(),
            fundingWallet: this.testnetProvider.getFundingWallet(),
            dataDir: this.config.fixtureDir,
            networkProvider: this.testnetProvider
        });

        this.testResults = {
            standardProof: [],
            thresholdProof: [],
            maximumProof: [],
            smartContractVerification: []
        };

        // Get currency info for reporting
        this.currencyInfo = this.testnetProvider.getCurrencyInfo();

        // Create results directory
        this.resultsDir = this.config.resultsDir || path.join(__dirname, 'results');
        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        }
    }

    /**
     * Run all proof verification tests
     */
    async runAllTests() {
        try {
            console.log(`Starting E2E proof verification tests on ${this.currencyInfo.name}...`);

            // Check network availability with retries
            await this.retryOperation(
                async () => {
                    const networkAvailable = await this.testnetProvider.checkNetworkAvailability();
                    if (!networkAvailable) {
                        throw new Error(`${this.currencyInfo.name} testnet network unavailable`);
                    }
                    return true;
                },
                'Network availability check',
                3, // 3 retries
                5000 // 5 second delay between retries
            );

            // Get chain ID for reporting
            const chainId = await this.testnetProvider.getChainId();
            console.log(`Connected to ${this.currencyInfo.name} (Chain ID: ${chainId})`);

            // Generate test wallets with different balances
            await this.setupTestWallets();

            // Run tests for all proof types with independent error handling
            const testResults = await Promise.allSettled([
                this.testStandardProof().catch(error => {
                    console.error('Standard proof tests failed but continuing with other tests:', error);
                    this.saveErrorLog(error, 'standard_proof');
                }),
                this.testThresholdProof().catch(error => {
                    console.error('Threshold proof tests failed but continuing with other tests:', error);
                    this.saveErrorLog(error, 'threshold_proof');
                }),
                this.testMaximumProof().catch(error => {
                    console.error('Maximum proof tests failed but continuing with other tests:', error);
                    this.saveErrorLog(error, 'maximum_proof');
                })
            ]);

            console.log(`Completed ${testResults.filter(r => r.status === 'fulfilled').length} of 3 proof type tests`);

            // Test smart contract verification if enabled
            if (this.config.smartContractTest) {
                try {
                    await this.testSmartContractVerification();
                } catch (error) {
                    console.error('Smart contract verification failed but continuing:', error);
                    this.saveErrorLog(error, 'smart_contract');
                }
            }

            // Save test results
            this.saveTestResults();

            // Check if all tests succeeded
            const allTests = [
                ...testResults,
                this.config.smartContractTest ? { status: this.testResults.smartContractVerification.some(r => r.success) ? 'fulfilled' : 'rejected' } : null
            ].filter(Boolean);
            
            const successCount = allTests.filter(r => r.status === 'fulfilled').length;
            
            if (successCount === allTests.length) {
                console.log('E2E tests completed successfully');
            } else {
                console.log(`E2E tests completed with ${allTests.length - successCount} of ${allTests.length} test categories failing`);
            }
            
            return {
                success: successCount === allTests.length,
                totalCategories: allTests.length,
                successfulCategories: successCount
            };
        } catch (error) {
            console.error('E2E test infrastructure failed:', error);
            // Save error log
            this.saveErrorLog(error, 'infrastructure');
            throw error;
        } finally {
            // Clean up test wallets
            if (!this.config.preserveWallets) {
                try {
                    await this.walletFixture.cleanupWallets();
                } catch (cleanupError) {
                    console.error('Failed to clean up wallets:', cleanupError);
                }
            }
        }
    }
    
    /**
     * Retry an operation with exponential backoff
     * @param {Function} operation - The operation to retry
     * @param {string} operationName - Name of the operation for logging
     * @param {number} maxRetries - Maximum number of retries
     * @param {number} initialDelay - Initial delay in ms
     * @returns {Promise<any>} - Result of the operation
     */
    async retryOperation(operation, operationName, maxRetries = 3, initialDelay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                if (attempt <= maxRetries) {
                    const delay = initialDelay * Math.pow(2, attempt - 1);
                    console.log(`${operationName} failed (attempt ${attempt}/${maxRetries + 1}), retrying in ${delay}ms: ${error.message}`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Save detailed error log
     * @param {Error} error - The error to log
     * @param {string} category - Error category (test type)
     */
    saveErrorLog(error, category = 'general') {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const filePath = path.join(this.resultsDir, `e2e-test-error-${category}-${timestamp}.log`);

        const errorLog = `
E2E Test Error (${category})
=============
Timestamp: ${new Date().toISOString()}
Network: ${this.currencyInfo.name}
Error Category: ${category}
Error Message: ${error.message}
Stack Trace:
${error.stack}

Test Configuration:
${JSON.stringify(this.config, null, 2)}

Environment Details:
- Node Version: ${process.version}
- Platform: ${process.platform}
- Memory Usage: ${JSON.stringify(process.memoryUsage())}
`;

        fs.writeFileSync(filePath, errorLog);
        console.log(`Error log for "${category}" saved to ${filePath}`);
    }

    /**
     * Set up test wallets with various balances
     */
    async setupTestWallets() {
        console.log('Setting up test wallets...');
        
        // Load configuration for wallet balances with defaults
        const balances = {
            standard: this.config.standardProofBalance || '0.05',
            threshold: this.config.thresholdProofBalance || '0.1',
            maximum: this.config.maximumProofBalance || '0.01',
            zeroBalance: this.config.includeZeroBalanceTest ? '0' : null
        };
        
        // Allow configurable confirmation wait time
        const confirmationWaitTime = this.config.confirmationWaitTime || 10000; // Default 10s

        // Create wallets with retries
        try {
            // Create wallet with exact balance for standard proof tests
            // For Polygon, we use smaller amounts to conserve testnet funds
            this.standardProofWallet = await this.retryOperation(
                async () => this.walletFixture.createWallet({
                    label: 'standard-proof-wallet',
                    balance: balances.standard,
                    persist: true
                }),
                'Create standard proof wallet',
                2
            );

            // Create wallet with high balance for threshold proof tests
            this.thresholdProofWallet = await this.retryOperation(
                async () => this.walletFixture.createWallet({
                    label: 'threshold-proof-wallet',
                    balance: balances.threshold,
                    persist: true
                }),
                'Create threshold proof wallet',
                2
            );

            // Create wallet with low balance for maximum proof tests
            this.maximumProofWallet = await this.retryOperation(
                async () => this.walletFixture.createWallet({
                    label: 'maximum-proof-wallet',
                    balance: balances.maximum,
                    persist: true
                }),
                'Create maximum proof wallet',
                2
            );
            
            // Optionally create zero balance wallet for edge case testing
            if (balances.zeroBalance !== null) {
                this.zeroBalanceWallet = await this.retryOperation(
                    async () => this.walletFixture.createWallet({
                        label: 'zero-balance-wallet',
                        balance: balances.zeroBalance,
                        persist: true
                    }),
                    'Create zero balance wallet',
                    2
                );
            }

            // Wait for wallet funding to be confirmed
            console.log(`Waiting for ${confirmationWaitTime/1000}s for transactions to be confirmed...`);
            await new Promise(resolve => setTimeout(resolve, confirmationWaitTime));

            // Set exact balances for testing with retry
            await this.retryOperation(
                async () => this.walletFixture.setExactBalance(this.standardProofWallet, balances.standard),
                'Set exact standard proof wallet balance',
                2
            );
            
            console.log('Test wallets created successfully');
            
            // Log wallet addresses and balances for diagnostics
            const walletInfo = [
                { type: 'Standard', wallet: this.standardProofWallet, balance: await this.walletFixture.getBalance(this.standardProofWallet.address) },
                { type: 'Threshold', wallet: this.thresholdProofWallet, balance: await this.walletFixture.getBalance(this.thresholdProofWallet.address) },
                { type: 'Maximum', wallet: this.maximumProofWallet, balance: await this.walletFixture.getBalance(this.maximumProofWallet.address) }
            ];
            
            if (this.zeroBalanceWallet) {
                walletInfo.push({ 
                    type: 'Zero Balance', 
                    wallet: this.zeroBalanceWallet, 
                    balance: await this.walletFixture.getBalance(this.zeroBalanceWallet.address) 
                });
            }
            
            console.log('Test wallet information:');
            walletInfo.forEach(info => {
                console.log(`- ${info.type} Wallet: ${info.wallet.address} (${info.balance} ${this.currencyInfo.symbol})`);
            });
            
        } catch (error) {
            console.error('Failed to set up test wallets:', error);
            // Attempt cleanup in case of partial success
            await this.walletFixture.cleanupWallets();
            throw error;
        }
    }

    /**
     * Test standard proof generation and verification
     */
    async testStandardProof() {
        console.log('Testing standard proof...');

        // Get actual balance
        const balance = await this.walletFixture.getBalance(this.standardProofWallet.address);
        const balanceWei = ethers.utils.parseEther(balance);

        // Generate and verify several standard proofs with different parameters
        for (let i = 0; i < 3; i++) {
            try {
                const startTime = Date.now();
                console.log(`Generating standard proof ${i + 1} of 3...`);

                // Create proof
                const proof = await generateStandardProof({
                    address: this.standardProofWallet.address,
                    amount: balanceWei.toString(),
                    privateKey: this.standardProofWallet.privateKey,
                    nonce: ethers.utils.hexlify(ethers.utils.randomBytes(16)),
                    chainId: await this.testnetProvider.getChainId()
                });

                console.log(`Serializing and deserializing proof...`);
                // Serialize and deserialize proof (to test serialization)
                const serialized = serializeProof(proof);
                const deserialized = deserializeProof(serialized);

                console.log(`Verifying proof...`);
                // Verify proof
                const verification = await verifyProof(deserialized);
                const endTime = Date.now();

                // Record result
                this.testResults.standardProof.push({
                    success: verification.isValid,
                    address: this.standardProofWallet.address,
                    amount: balance,
                    currency: this.currencyInfo.symbol,
                    network: this.currencyInfo.name,
                    executionTime: endTime - startTime,
                    timestamp: new Date().toISOString()
                });

                if (!verification.isValid) {
                    console.error('Standard proof verification failed');
                } else {
                    console.log(`Standard proof ${i + 1} verified successfully in ${endTime - startTime}ms`);
                }
            } catch (error) {
                console.error('Standard proof test failed:', error);
                this.testResults.standardProof.push({
                    success: false,
                    address: this.standardProofWallet.address,
                    amount: balance,
                    currency: this.currencyInfo.symbol,
                    network: this.currencyInfo.name,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    /**
     * Test threshold proof generation and verification
     */
    async testThresholdProof() {
        console.log('Testing threshold proof...');

        // Get actual balance
        const balance = await this.walletFixture.getBalance(this.thresholdProofWallet.address);
        const balanceWei = ethers.utils.parseEther(balance);

        // Test threshold amounts (less than actual balance)
        const thresholds = [
            ethers.utils.parseEther('0.01').toString(),
            ethers.utils.parseEther('0.05').toString(),
            ethers.utils.parseEther('0.095').toString()
        ];

        for (let i = 0; i < thresholds.length; i++) {
            try {
                const startTime = Date.now();
                console.log(`Generating threshold proof ${i + 1} of ${thresholds.length} with threshold ${ethers.utils.formatEther(thresholds[i])} ${this.currencyInfo.symbol}...`);

                // Create proof
                const proof = await generateThresholdProof({
                    address: this.thresholdProofWallet.address,
                    threshold: thresholds[i],
                    actualBalance: balanceWei.toString(),
                    privateKey: this.thresholdProofWallet.privateKey,
                    nonce: ethers.utils.hexlify(ethers.utils.randomBytes(16)),
                    chainId: await this.testnetProvider.getChainId()
                });

                console.log(`Serializing and deserializing proof...`);
                // Serialize and deserialize proof
                const serialized = serializeProof(proof);
                const deserialized = deserializeProof(serialized);

                console.log(`Verifying proof...`);
                // Verify proof
                const verification = await verifyProof(deserialized);
                const endTime = Date.now();

                // Record result
                this.testResults.thresholdProof.push({
                    success: verification.isValid,
                    address: this.thresholdProofWallet.address,
                    threshold: ethers.utils.formatEther(thresholds[i]),
                    actualBalance: balance,
                    currency: this.currencyInfo.symbol,
                    network: this.currencyInfo.name,
                    executionTime: endTime - startTime,
                    timestamp: new Date().toISOString()
                });

                if (!verification.isValid) {
                    console.error(`Threshold proof verification failed for threshold ${ethers.utils.formatEther(thresholds[i])} ${this.currencyInfo.symbol}`);
                } else {
                    console.log(`Threshold proof ${i + 1} verified successfully in ${endTime - startTime}ms`);
                }
            } catch (error) {
                console.error('Threshold proof test failed:', error);
                this.testResults.thresholdProof.push({
                    success: false,
                    address: this.thresholdProofWallet.address,
                    threshold: ethers.utils.formatEther(thresholds[i]),
                    actualBalance: balance,
                    currency: this.currencyInfo.symbol,
                    network: this.currencyInfo.name,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    /**
     * Test maximum proof generation and verification
     */
    async testMaximumProof() {
        console.log('Testing maximum proof...');

        // Get actual balance
        const balance = await this.walletFixture.getBalance(this.maximumProofWallet.address);
        const balanceWei = ethers.utils.parseEther(balance);

        // Test maximum amounts (more than actual balance)
        const maximums = [
            ethers.utils.parseEther('0.01').toString(), // Equal to balance
            ethers.utils.parseEther('0.05').toString(), // Greater than balance
            ethers.utils.parseEther('0.1').toString()   // Much greater than balance
        ];

        for (let i = 0; i < maximums.length; i++) {
            try {
                const startTime = Date.now();
                console.log(`Generating maximum proof ${i + 1} of ${maximums.length} with maximum ${ethers.utils.formatEther(maximums[i])} ${this.currencyInfo.symbol}...`);

                // Create proof
                const proof = await generateMaximumProof({
                    address: this.maximumProofWallet.address,
                    maximum: maximums[i],
                    actualBalance: balanceWei.toString(),
                    privateKey: this.maximumProofWallet.privateKey,
                    nonce: ethers.utils.hexlify(ethers.utils.randomBytes(16)),
                    chainId: await this.testnetProvider.getChainId()
                });

                console.log(`Serializing and deserializing proof...`);
                // Serialize and deserialize proof
                const serialized = serializeProof(proof);
                const deserialized = deserializeProof(serialized);

                console.log(`Verifying proof...`);
                // Verify proof
                const verification = await verifyProof(deserialized);
                const endTime = Date.now();

                // Record result
                this.testResults.maximumProof.push({
                    success: verification.isValid,
                    address: this.maximumProofWallet.address,
                    maximum: ethers.utils.formatEther(maximums[i]),
                    actualBalance: balance,
                    currency: this.currencyInfo.symbol,
                    network: this.currencyInfo.name,
                    executionTime: endTime - startTime,
                    timestamp: new Date().toISOString()
                });

                if (!verification.isValid) {
                    console.error(`Maximum proof verification failed for maximum ${ethers.utils.formatEther(maximums[i])} ${this.currencyInfo.symbol}`);
                } else {
                    console.log(`Maximum proof ${i + 1} verified successfully in ${endTime - startTime}ms`);
                }
            } catch (error) {
                console.error('Maximum proof test failed:', error);
                this.testResults.maximumProof.push({
                    success: false,
                    address: this.maximumProofWallet.address,
                    maximum: ethers.utils.formatEther(maximums[i]),
                    actualBalance: balance,
                    currency: this.currencyInfo.symbol,
                    network: this.currencyInfo.name,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    /**
     * Test smart contract verification using ZKVerifier.sol
     */
    async testSmartContractVerification() {
        console.log('Testing smart contract verification...');

        // Get contract instance
        const verifierAddress = this.config.verifierContractAddress;
        if (!verifierAddress) {
            throw new Error('Verifier contract address required for smart contract tests');
        }

        console.log(`Using verifier contract at ${verifierAddress}`);
        // Get contract ABI - adjust path as needed for Polygon deployment
        let verifierAbi;
        try {
            verifierAbi = require('../../smart-contracts/artifacts/contracts/ZKVerifier.sol/ZKVerifier.json').abi;
        } catch (error) {
            console.error('Error loading verifier ABI:', error);
            console.log('Attempting to load from alternative path...');
            try {
                verifierAbi = require('../../../smart-contracts/artifacts/contracts/ZKVerifier.sol/ZKVerifier.json').abi;
            } catch (altError) {
                throw new Error(`Unable to load ZKVerifier ABI: ${error.message}. Make sure the contract is compiled and deployed to Polygon.`);
            }
        }

        const verifierContract = new ethers.Contract(
            verifierAddress,
            verifierAbi,
            this.testnetProvider.getProvider()
        );

        // Test with standard proof
        try {
            const balance = await this.walletFixture.getBalance(this.standardProofWallet.address);
            const balanceWei = ethers.utils.parseEther(balance);

            console.log(`Generating proof for smart contract verification with balance ${balance} ${this.currencyInfo.symbol}...`);
            // Generate proof
            const proof = await generateStandardProof({
                address: this.standardProofWallet.address,
                amount: balanceWei.toString(),
                privateKey: this.standardProofWallet.privateKey,
                nonce: ethers.utils.hexlify(ethers.utils.randomBytes(16)),
                chainId: await this.testnetProvider.getChainId()
            });

            console.log(`Preparing data for on-chain verification...`);
            // Prepare data for on-chain verification
            const proofData = ethers.utils.defaultAbiCoder.encode(
                ['bytes32', 'address', 'uint256'],
                [proof.hash, this.standardProofWallet.address, balanceWei]
            );

            console.log(`Sending verification transaction to the blockchain...`);
            // Call contract verification method
            const connectedContract = verifierContract.connect(this.testnetProvider.getFundingWallet());

            // Polygon may need different gas settings
            const gasPrice = await this.testnetProvider.getProvider().getGasPrice();
            const gasLimit = await connectedContract.estimateGas.verifyStandardProof(
                proof.publicSignals,
                proof.proof,
                proofData
            );

            console.log(`Estimated gas limit: ${gasLimit.toString()}, gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

            const verificationTx = await connectedContract.verifyStandardProof(
                proof.publicSignals,
                proof.proof,
                proofData,
                {
                    gasLimit: gasLimit.mul(12).div(10), // Add 20% buffer
                    gasPrice
                }
            );

            console.log(`Transaction sent, waiting for confirmation: ${verificationTx.hash}`);
            if (this.testnetProvider.getTransactionUrl) {
                console.log(`Transaction details: ${this.testnetProvider.getTransactionUrl(verificationTx.hash)}`);
            }

            // Wait for transaction confirmation - Polygon might need more confirmations
            const receipt = await verificationTx.wait(2);
            console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

            // Check verification events
            const verificationEvent = receipt.events.find(e => e.event === 'ProofVerified');
            const verificationResult = verificationEvent?.args?.verified || false;

            // Record result
            this.testResults.smartContractVerification.push({
                success: verificationResult,
                proofType: 'standard',
                contractAddress: verifierAddress,
                transactionHash: receipt.transactionHash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                currency: this.currencyInfo.symbol,
                network: this.currencyInfo.name,
                timestamp: new Date().toISOString()
            });

            console.log(`Smart contract verification ${verificationResult ? 'succeeded' : 'failed'}`);
        } catch (error) {
            console.error('Smart contract verification failed:', error);
            this.testResults.smartContractVerification.push({
                success: false,
                proofType: 'standard',
                contractAddress: verifierAddress,
                currency: this.currencyInfo.symbol,
                network: this.currencyInfo.name,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Save test results to file
     */
    saveTestResults() {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const filePath = path.join(this.resultsDir, `e2e-test-results-${timestamp}.json`);

        const results = {
            timestamp,
            network: this.currencyInfo.name,
            networkId: this.config.network,
            currency: this.currencyInfo.symbol,
            standardProof: this.testResults.standardProof,
            thresholdProof: this.testResults.thresholdProof,
            maximumProof: this.testResults.maximumProof,
            smartContractVerification: this.testResults.smartContractVerification,
            summary: {
                standardProofSuccess: this.testResults.standardProof.filter(r => r.success).length,
                standardProofTotal: this.testResults.standardProof.length,
                thresholdProofSuccess: this.testResults.thresholdProof.filter(r => r.success).length,
                thresholdProofTotal: this.testResults.thresholdProof.length,
                maximumProofSuccess: this.testResults.maximumProof.filter(r => r.success).length,
                maximumProofTotal: this.testResults.maximumProof.length,
                smartContractSuccess: this.testResults.smartContractVerification.filter(r => r.success).length,
                smartContractTotal: this.testResults.smartContractVerification.length
            }
        };

        fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
        console.log(`Test results saved to ${filePath}`);

        // Generate summary report
        const reportPath = path.join(this.resultsDir, `e2e-test-report-${timestamp}.md`);
        const report = this.generateTestReport(results);
        fs.writeFileSync(reportPath, report);
        console.log(`Test report saved to ${reportPath}`);
    }

    /**
     * Generate markdown test report
     * @param {Object} results - Test results
     * @returns {string} Markdown report
     */
    generateTestReport(results) {
        const { summary } = results;

        return `# ZK Proof System E2E Test Report

## Test Summary
- **Date**: ${new Date(results.timestamp).toLocaleString()}
- **Network**: ${results.network}
- **Currency**: ${results.currency}

## Results Summary
| Proof Type | Success | Total | Success Rate |
|------------|---------|-------|--------------|
| Standard Proof | ${summary.standardProofSuccess} | ${summary.standardProofTotal} | ${Math.round(summary.standardProofSuccess / summary.standardProofTotal * 100)}% |
| Threshold Proof | ${summary.thresholdProofSuccess} | ${summary.thresholdProofTotal} | ${Math.round(summary.thresholdProofSuccess / summary.thresholdProofTotal * 100)}% |
| Maximum Proof | ${summary.maximumProofSuccess} | ${summary.maximumProofTotal} | ${Math.round(summary.maximumProofSuccess / summary.maximumProofTotal * 100)}% |
| Smart Contract | ${summary.smartContractSuccess} | ${summary.smartContractTotal} | ${summary.smartContractTotal > 0 ? Math.round(summary.smartContractSuccess / summary.smartContractTotal * 100) : 'N/A'}% |

## Standard Proof Tests
${results.standardProof.map((r, i) => `
### Test ${i + 1}
- **Success**: ${r.success}
- **Address**: ${r.address}
- **Amount**: ${r.amount} ${r.currency}
- **Execution Time**: ${r.executionTime}ms
${r.error ? `- **Error**: ${r.error}` : ''}
`).join('\n')}

## Threshold Proof Tests
${results.thresholdProof.map((r, i) => `
### Test ${i + 1}
- **Success**: ${r.success}
- **Address**: ${r.address}
- **Threshold**: ${r.threshold} ${r.currency}
- **Actual Balance**: ${r.actualBalance} ${r.currency}
- **Execution Time**: ${r.executionTime}ms
${r.error ? `- **Error**: ${r.error}` : ''}
`).join('\n')}

## Maximum Proof Tests
${results.maximumProof.map((r, i) => `
### Test ${i + 1}
- **Success**: ${r.success}
- **Address**: ${r.address}
- **Maximum**: ${r.maximum} ${r.currency}
- **Actual Balance**: ${r.actualBalance} ${r.currency}
- **Execution Time**: ${r.executionTime}ms
${r.error ? `- **Error**: ${r.error}` : ''}
`).join('\n')}

${results.smartContractVerification.length > 0 ? `
## Smart Contract Verification Tests
${results.smartContractVerification.map((r, i) => `
### Test ${i + 1}
- **Success**: ${r.success}
- **Proof Type**: ${r.proofType}
- **Contract Address**: ${r.contractAddress}
- **Transaction Hash**: ${r.transactionHash || 'N/A'}
${r.blockNumber ? `- **Block Number**: ${r.blockNumber}` : ''}
${r.gasUsed ? `- **Gas Used**: ${r.gasUsed}` : ''}
${r.error ? `- **Error**: ${r.error}` : ''}
`).join('\n')}
` : ''}

## Conclusion

Overall test success rate: ${Math.round((
            summary.standardProofSuccess +
            summary.thresholdProofSuccess +
            summary.maximumProofSuccess +
            summary.smartContractSuccess
        ) / (
                summary.standardProofTotal +
                summary.thresholdProofTotal +
                summary.maximumProofTotal +
                summary.smartContractTotal
            ) * 100)}%

${(
                summary.standardProofSuccess === summary.standardProofTotal &&
                summary.thresholdProofSuccess === summary.thresholdProofTotal &&
                summary.maximumProofSuccess === summary.maximumProofTotal &&
                (summary.smartContractTotal === 0 || summary.smartContractSuccess === summary.smartContractTotal)
            ) ? '✅ All tests passed successfully.' : '❌ Some tests failed. Review detailed results for more information.'}
`;
    }
}

// Export the test runner
export default ProofVerificationE2E; 