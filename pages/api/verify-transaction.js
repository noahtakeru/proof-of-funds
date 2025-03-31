/**
 * Proof of Funds Transaction Verification API
 * 
 * This API endpoint provides server-side verification of proof-of-funds transactions
 * on the Polygon Amoy blockchain. It retrieves and parses transaction data to extract
 * proof details for verification purposes.
 * 
 * Key Features:
 * - CORS-friendly operation (avoids browser CORS issues with direct RPC connections)
 * - Multi-provider fallback system for reliable blockchain access
 * - Detailed proof data extraction from transaction logs
 * - Comprehensive error handling and debugging information
 * 
 * @route   GET /api/verify-transaction
 * @param   {string} hash - Transaction hash to verify
 * @returns {object} Proof details and verification status
 * 
 * Technical Implementation:
 * - Uses ethers.js for blockchain interaction
 * - Implements fallback RPC providers for reliability
 * - Parses transaction logs using contract ABIs
 * - Extracts relevant proof data including user address, proof type, and amounts
 * 
 * Related Components:
 * - pages/verify.js: Frontend verification page
 * - smart-contracts/contracts/ProofOfFunds.sol: Smart contract containing verification logic
 */

// Array of RPC URLs for the Polygon Amoy testnet, used as fallbacks
const POLYGON_AMOY_RPC_URLS = [
    'https://polygon-amoy.g.alchemy.com/v2/demo',
    'https://polygon-amoy-rpc.publicnode.com',
    'https://amoy.polygon.drpc.org'
];

// The contract address for the Proof of Funds contract
const CONTRACT_ADDRESS = '0xD6bd1eFCE3A2c4737856724f96F39037a3564890';

/**
 * API route handler for transaction verification
 * Fetches transaction details and extracts proof data
 * 
 * @param {object} req - Next.js request object
 * @param {object} res - Next.js response object
 */
export default async function handler(req, res) {
    // Get the transaction hash from the query parameters
    const { hash } = req.query;

    // Validate the transaction hash
    if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
        return res.status(400).json({
            error: 'Invalid transaction hash provided. A valid transaction hash starts with 0x followed by 64 hexadecimal characters.'
        });
    }

    console.log(`Verifying transaction with hash: ${hash}`);

    let lastError = null;
    let provider = null;

    // Try each RPC URL until one works
    for (const rpcUrl of POLYGON_AMOY_RPC_URLS) {
        try {
            console.log(`Attempting to connect to RPC URL: ${rpcUrl}`);
            const { ethers } = await import('ethers');
            provider = new ethers.providers.JsonRpcProvider(rpcUrl);

            // Test the connection with a simple call
            await provider.getNetwork();
            console.log(`Successfully connected to ${rpcUrl}`);
            break; // Exit the loop if connection is successful
        } catch (error) {
            console.error(`Failed to connect to ${rpcUrl}:`, error);
            lastError = error;
            provider = null;
        }
    }

    if (!provider) {
        return res.status(500).json({
            error: `Failed to connect to any RPC provider. Please try again later. Last error: ${lastError?.message || 'Unknown error'}`
        });
    }

    try {
        const { ethers } = await import('ethers');

        // Fetch the transaction receipt
        console.log(`Fetching transaction receipt for hash: ${hash}`);
        const receipt = await provider.getTransactionReceipt(hash);

        if (!receipt) {
            return res.status(404).json({
                error: 'Transaction not found. Please make sure you entered a valid transaction hash on the Polygon Amoy network.'
            });
        }

        console.log('Transaction receipt found:', {
            blockNumber: receipt.blockNumber,
            status: receipt.status,
            logs: receipt.logs.length
        });

        if (receipt.status !== 1) {
            return res.status(400).json({
                error: 'Transaction failed. This transaction was reverted on the blockchain.'
            });
        }

        // Check if the transaction was sent to our contract
        console.log(`Looking for logs from contract address: ${CONTRACT_ADDRESS}`);

        const logsFromContract = receipt.logs.filter(log =>
            log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()
        );

        console.log(`Found ${logsFromContract.length} logs from the contract address`);

        /**
         * Parses and extracts proof data from transaction logs
         * @param {Array} logs - Transaction logs to parse
         * @param {string} contractAddress - Address of the contract to use for parsing
         * @returns {Object|null} Extracted proof data or null if parsing failed
         */
        const extractProofData = async (logs, contractAddress) => {
            try {
                // Import the ABI from the local file
                const abi = [
                    {
                        "anonymous": false,
                        "inputs": [
                            {
                                "indexed": true,
                                "internalType": "uint256",
                                "name": "proofId",
                                "type": "uint256"
                            },
                            {
                                "indexed": true,
                                "internalType": "address",
                                "name": "user",
                                "type": "address"
                            },
                            {
                                "indexed": false,
                                "internalType": "enum ProofOfFunds.ProofType",
                                "name": "proofType",
                                "type": "uint8"
                            },
                            {
                                "indexed": false,
                                "internalType": "bytes32",
                                "name": "proofHash",
                                "type": "bytes32"
                            },
                            {
                                "indexed": false,
                                "internalType": "uint256",
                                "name": "expiryTime",
                                "type": "uint256"
                            }
                        ],
                        "name": "ProofSubmitted",
                        "type": "event"
                    }
                ];

                const contract = new ethers.Contract(contractAddress, abi, provider);

                // Parse the logs using the contract interface
                const parsedLogs = logs.map(log => {
                    try {
                        return contract.interface.parseLog(log);
                    } catch (e) {
                        console.error('Error parsing log:', e);
                        return null;
                    }
                }).filter(Boolean);

                console.log(`Successfully parsed ${parsedLogs.length} logs`);

                if (parsedLogs.length === 0) {
                    return null;
                }

                // Find the ProofSubmitted event
                const proofSubmittedEvent = parsedLogs.find(log => log.name === 'ProofSubmitted');

                if (!proofSubmittedEvent) {
                    console.warn('ProofSubmitted event not found in the parsed logs');
                    return null;
                }

                console.log('Found ProofSubmitted event:', proofSubmittedEvent.name);

                // Extract proof data from the event
                const proofId = proofSubmittedEvent.args.proofId.toString();
                const userAddress = proofSubmittedEvent.args.user;
                const proofType = parseInt(proofSubmittedEvent.args.proofType);
                const proofHash = proofSubmittedEvent.args.proofHash;
                const expiryTime = proofSubmittedEvent.args.expiryTime.toNumber();

                console.log('Extracted proof data:', {
                    proofId,
                    userAddress,
                    proofType,
                    proofHash,
                    expiryTime
                });

                // Get full proof details from the contract
                try {
                    // This will throw if the function doesn't exist or fails
                    const proofResult = await contract.getProof(proofId);
                    console.log('Proof details from contract:', proofResult);

                    // Extract values from the getProof result if available
                    let signatureMessage = '';

                    // If getProof returns results, extract the signature message
                    if (proofResult && proofResult.length > 5) {
                        signatureMessage = proofResult[5];
                    }

                    // Parse amount from signature message
                    let amount = '0';
                    let tokenSymbol = 'ETH';

                    if (signatureMessage.includes('at least')) {
                        const match = signatureMessage.match(/at least ([0-9.]+)/);
                        if (match && match[1]) {
                            amount = match[1];
                        }
                    } else if (signatureMessage.includes('at most')) {
                        const match = signatureMessage.match(/at most ([0-9.]+)/);
                        if (match && match[1]) {
                            amount = match[1];
                        }
                    }

                    // Extract additional data from transaction input if available
                    const tx = await provider.getTransaction(hash);
                    if (tx && tx.data) {
                        console.log('Transaction input data:', tx.data);
                        // Further decoding of input data could be done here
                    }

                    return {
                        proofId,
                        userAddress,
                        proofType,
                        proofHash,
                        expiryTime,
                        expiryDate: new Date(expiryTime * 1000).toLocaleString(),
                        amount,
                        tokenSymbol,
                        signatureMessage,
                        contractAddress,
                        txHash: hash
                    };
                } catch (proofError) {
                    console.error('Error getting full proof details:', proofError);

                    // Return basic proof data even if full details can't be retrieved
                    return {
                        proofId,
                        userAddress,
                        proofType,
                        proofHash,
                        expiryTime,
                        expiryDate: new Date(expiryTime * 1000).toLocaleString(),
                        amount: '0',
                        tokenSymbol: 'ETH',
                        signatureMessage: '',
                        contractAddress,
                        txHash: hash
                    };
                }
            } catch (error) {
                console.error(`Error extracting proof data from ${contractAddress}:`, error);
                return null;
            }
        };

        // Try to extract proof data from our known contract
        let proofData = null;

        if (logsFromContract.length > 0) {
            proofData = await extractProofData(logsFromContract, CONTRACT_ADDRESS);
        }

        // If we couldn't extract from our contract, try with the first contract in the logs
        if (!proofData && receipt.logs.length > 0) {
            console.log('No proof data found from known contract, trying to extract from the first log');
            const alternateContractAddress = receipt.logs[0].address;
            console.log(`Trying alternate contract address: ${alternateContractAddress}`);
            proofData = await extractProofData(receipt.logs, alternateContractAddress);
        }

        if (!proofData) {
            return res.status(400).json({
                error: 'This transaction does not appear to be a valid proof submission. No proof data could be extracted.'
            });
        }

        /**
         * Converts numeric proof type to human-readable name
         * @param {number} type - Proof type enum value
         * @returns {string} Human-readable proof type name
         */
        const getProofTypeName = (type) => {
            switch (type) {
                case 0:
                    return 'Standard';
                case 1:
                    return 'Threshold';
                case 2:
                    return 'Maximum';
                case 3:
                    return 'Zero-Knowledge';
                default:
                    return 'Unknown';
            }
        };

        // Format the response
        const formattedProofData = {
            ...proofData,
            proofType: getProofTypeName(proofData.proofType),
            verified: true
        };

        // Return the verification result
        return res.status(200).json({ proofData: formattedProofData });
    } catch (error) {
        console.error('Error verifying transaction:', error);
        return res.status(500).json({
            error: `Error verifying transaction: ${error.message}`
        });
    }
} 