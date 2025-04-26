/**
 * API route for transaction-based proof verification
 * 
 * This endpoint bypasses CORS issues by using the server to fetch transaction data
 * from the blockchain. It accepts a transaction hash and returns the proof details.
 */

import { ethers } from 'ethers';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../../config/constants';

// Array of server-side RPC URLs for Polygon Amoy to try
const SERVER_RPC_URLS = [
    "https://polygon-amoy.g.alchemy.com/v2/demo",
    "https://polygon-amoy.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
    "https://polygon-amoy-api.gateway.fm/v4/2ce4fdf25cca5a5b8c59756d98fe6b42",
    "https://rpc-amoy.polygon.technology"
];

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Extract the transaction hash from the request body
    const { txHash } = req.body;

    if (!txHash) {
        return res.status(400).json({ error: 'Transaction hash is required' });
    }

    console.log("API: Verifying transaction:", txHash);

    // Try each RPC endpoint until one works
    let lastError = null;

    for (const rpcUrl of SERVER_RPC_URLS) {
        try {
            console.log(`API: Trying RPC URL: ${rpcUrl}`);

            // Create a provider for the Polygon Amoy network
            const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

            // Test the connection first
            await provider.getNetwork();

            // Get the transaction receipt
            const receipt = await provider.getTransactionReceipt(txHash);

            if (!receipt) {
                console.log(`API: Transaction not found using ${rpcUrl}`);
                lastError = `Transaction not found using ${rpcUrl}`;
                continue; // Try next RPC URL
            }

            console.log(`API: Transaction found with ${receipt.logs?.length || 0} logs`);

            // Check transaction status
            if (receipt.status !== 1) {
                return res.status(400).json({
                    error: 'Transaction failed on the blockchain'
                });
            }

            // Get full transaction data
            const txData = await provider.getTransaction(txHash);

            // Initialize contract interface to parse logs
            const contractInterface = new ethers.utils.Interface(CONTRACT_ABI);

            // Create contract instance
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

            // Get logs from this transaction that match our contract address
            const contractLogs = receipt.logs.filter(log =>
                log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()
            );

            console.log(`API: Found ${contractLogs.length} logs for contract ${CONTRACT_ADDRESS}`);

            // Variable to store the actual contract address we end up using
            let actualContractAddress = CONTRACT_ADDRESS;
            let actualContract = contract;

            // If no logs found for our expected contract address, check other addresses
            if (contractLogs.length === 0) {
                // Get all unique addresses in the logs
                const uniqueAddresses = [...new Set(receipt.logs.map(log => log.address.toLowerCase()))];
                console.log("API: Unique addresses in logs:", uniqueAddresses);

                if (uniqueAddresses.length > 0) {
                    // Try with first contract address found in logs
                    const possibleContractLogs = receipt.logs.filter(log =>
                        log.address.toLowerCase() === uniqueAddresses[0].toLowerCase()
                    );

                    if (possibleContractLogs.length > 0) {
                        try {
                            // Try to parse one of the logs with our ABI
                            const testLog = contractInterface.parseLog(possibleContractLogs[0]);
                            console.log("API: Successfully parsed log with alternate address:", testLog.name);

                            // If we can parse it, use these logs instead
                            actualContractAddress = uniqueAddresses[0];
                            actualContract = new ethers.Contract(actualContractAddress, CONTRACT_ABI, provider);
                            contractLogs.push(...possibleContractLogs);
                        } catch (e) {
                            console.log("API: Could not parse logs from alternate contract:", e.message);
                        }
                    }
                }

                if (contractLogs.length === 0) {
                    console.log("API: No logs could be parsed with our ABI");
                    // Dump all events to see what's happening
                    receipt.logs.forEach((log, i) => {
                        console.log(`API: Log ${i} from ${log.address}: Topics: ${JSON.stringify(log.topics)}`);
                    });

                    lastError = 'No logs found for the proof contract - CONTRACT_ADDRESS may be incorrect';
                    continue; // Try next RPC URL
                }
            }

            // Parse logs to find proof events
            const parsedLogs = [];
            contractLogs.forEach((log) => {
                try {
                    const parsedLog = contractInterface.parseLog(log);
                    console.log("API: Found event:", parsedLog.name);
                    parsedLogs.push({ log, parsedLog });
                } catch (e) {
                    console.log("API: Couldn't parse log:", e.message);
                }
            });

            // Try to find ProofSubmitted or any similar event
            const proofSubmittedLog = parsedLogs.find(entry =>
                entry.parsedLog.name === 'ProofSubmitted' ||
                entry.parsedLog.name.includes('Proof')
            );

            if (!proofSubmittedLog) {
                console.log("API: No ProofSubmitted event found");
                lastError = 'No proof submission found in this transaction';
                continue; // Try next RPC URL
            }

            // Extract data from the event
            const parsedLog = proofSubmittedLog.parsedLog;
            console.log("API: Found proof event:", parsedLog.name);

            // Log all the event arguments to debug
            console.log("API: Event arguments:");
            for (const key in parsedLog.args) {
                if (isNaN(parseInt(key))) { // Skip numeric keys, which are duplicates
                    const value = parsedLog.args[key];
                    // Convert BigNumber to string if needed
                    const displayValue = value && value._isBigNumber ? value.toString() : value;
                    console.log(`  ${key}: ${displayValue}`);
                }
            }

            // Try to extract the important values
            const userAddress = parsedLog.args.user || parsedLog.args.wallet || parsedLog.args.owner;
            const proofTypeValue = parsedLog.args.proofType ?
                (parsedLog.args.proofType._isBigNumber ?
                    parsedLog.args.proofType.toNumber() :
                    parsedLog.args.proofType) : 0;
            const proofHash = parsedLog.args.proofHash || parsedLog.args.hash;

            if (!userAddress) {
                lastError = 'Could not find user address in event data';
                continue; // Try next RPC URL
            }

            // Parse the transaction input
            let amountFromTx = "0";
            let tokenSymbol = "ETH"; // Default to ETH

            if (txData && txData.data) {
                try {
                    // Try to decode the function call
                    const decodedInput = contractInterface.parseTransaction({ data: txData.data });
                    console.log("API: Decoded function call:", decodedInput.name);

                    // Try to find threshold amount which is usually the verified amount
                    if (decodedInput.args && decodedInput.args.thresholdAmount) {
                        amountFromTx = ethers.utils.formatEther(decodedInput.args.thresholdAmount);
                    }
                    // Otherwise try other amount parameters
                    else if (decodedInput.args && decodedInput.args.amount) {
                        amountFromTx = ethers.utils.formatEther(decodedInput.args.amount);
                    }

                    // Get token symbol if available
                    if (decodedInput.args && decodedInput.args.tokenSymbol) {
                        tokenSymbol = decodedInput.args.tokenSymbol;
                    }
                } catch (e) {
                    console.log("API: Could not decode transaction input:", e.message);
                }
            }

            // Now get the proof data directly from the contract
            let proofData;
            try {
                // Using the contract's getProof method directly
                proofData = await actualContract.getProof(userAddress);
                console.log("API: Proof data from contract:", proofData);
            } catch (e) {
                console.error("API: Error getting proof data from contract:", e);
                // Continue with event data only
                proofData = {
                    thresholdAmount: ethers.BigNumber.from(0),
                    timestamp: null,
                    expiryTime: null
                };
            }

            // Extract timestamp
            let timestamp = null;
            if (proofData.timestamp && proofData.timestamp._isBigNumber) {
                timestamp = new Date(proofData.timestamp.toNumber() * 1000).toLocaleString();
            }

            // Extract expiry
            let expiryTime = null;
            if (proofData.expiryTime && proofData.expiryTime._isBigNumber) {
                expiryTime = new Date(proofData.expiryTime.toNumber() * 1000).toLocaleString();
            }

            // Use threshold amount from contract data if available
            let thresholdAmount = "0";
            if (proofData.thresholdAmount && proofData.thresholdAmount._isBigNumber) {
                thresholdAmount = ethers.utils.formatEther(proofData.thresholdAmount);
            }

            // Build the response data
            const details = {
                user: userAddress,
                proofType: proofTypeValue,
                proofHash: proofHash,
                thresholdAmount: thresholdAmount !== "0" ? thresholdAmount : "0",
                amount: amountFromTx !== "0" ? amountFromTx : thresholdAmount,
                tokenSymbol: tokenSymbol,
                timestamp: timestamp,
                expiryTime: expiryTime,
                txHash: txHash,
                contractAddress: actualContractAddress
            };

            return res.status(200).json({ success: true, proofDetails: details });
        } catch (error) {
            console.error(`API Error with ${rpcUrl}:`, error.message);
            lastError = error.message;
            // Continue trying other RPC URLs
        }
    }

    // If we get here, all RPC URLs failed
    console.error('All API RPC connections failed. Last error:', lastError);
    return res.status(500).json({
        error: lastError || 'An error occurred while verifying the transaction',
        message: 'Could not connect to any blockchain providers. Please try again later.'
    });
} 