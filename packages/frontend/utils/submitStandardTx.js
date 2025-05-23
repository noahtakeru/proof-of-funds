/**
 * Utility function to submit a standard proof transaction from user wallet
 * Supports both ethers v5 and v6
 */

/**
 * Submit a standard proof transaction using the user's wallet
 * @param {Object} transactionData - Transaction data from API
 * @returns {Promise<Object>} - Transaction receipt
 */
export async function submitStandardProofTx(transactionData) {
  // CRITICAL: Isolate MetaMask provider FIRST to prevent Phantom interference
  if (!window.ethereum) {
    throw new Error("No ethereum provider available. Connect your wallet first.");
  }
  
  // Isolate MetaMask provider from Phantom IMMEDIATELY
  let metaMaskProvider = window.ethereum;
  if (window.ethereum?.providers) {
    console.log("🔍 Multiple providers detected, isolating MetaMask...");
    const foundProvider = window.ethereum.providers.find(p => p.isMetaMask && !p.isPhantom);
    if (foundProvider) {
      console.log("✅ Found and isolated MetaMask provider");
      metaMaskProvider = foundProvider;
    } else {
      throw new Error("MetaMask provider not found among multiple providers. Please ensure MetaMask is connected.");
    }
  } else if (window.ethereum?.isMetaMask) {
    console.log("✅ Using single MetaMask provider");
    metaMaskProvider = window.ethereum;
  } else {
    throw new Error("MetaMask provider not detected. Please connect MetaMask.");
  }
  
  // CRITICAL: Block transaction if not on Polygon Amoy using ISOLATED MetaMask provider
  const currentChainId = await metaMaskProvider.request({ method: 'eth_chainId' });
  const polygonAmoyChainId = '0x13882'; // 80002 in hex
  
  console.log(`🔍 Network check: Current ${currentChainId} (${parseInt(currentChainId, 16)}), Required ${polygonAmoyChainId} (80002)`);
  
  if (currentChainId !== polygonAmoyChainId) {
    console.log("🔄 Switching to Polygon Amoy network...");
    
    try {
      await metaMaskProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: polygonAmoyChainId }],
      });
      console.log("✅ Network switched successfully");
    } catch (switchError) {
      if (switchError.code === 4902) {
        console.log("Adding Polygon Amoy network...");
        await metaMaskProvider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: polygonAmoyChainId,
            chainName: 'Polygon Amoy Testnet',
            nativeCurrency: {
              name: 'MATIC',
              symbol: 'MATIC',
              decimals: 18,
            },
            rpcUrls: ['https://rpc-amoy.polygon.technology/'],
            blockExplorerUrls: ['https://amoy.polygonscan.com/'],
          }],
        });
        console.log("✅ Network added and switched");
      } else if (switchError.code === 4001) {
        // User rejected the switch
        throw new Error("Please switch to Polygon Amoy network in MetaMask to continue.");
      } else {
        throw switchError;
      }
    }
  } else {
    console.log("✅ Already on correct network");
  }
  
  // Dynamically import ethers utility
  const { getEthers } = await import('@proof-of-funds/common/ethersUtils');
  const { ethers, isV5, isV6 } = await getEthers();
  console.log("Using ethers version:", { isV5, isV6 });
  
  // Get a signer for the transaction based on ethers version
  let signer;
  
  // Get provider based on ethers version
  if (isV5 && ethers.providers) {
    // MetaMask provider already isolated at function start

    // ethers v5
    console.log("Creating ethers v5 provider");
    const provider = new ethers.providers.Web3Provider(metaMaskProvider);
    
    // Get the currently available accounts from MetaMask
    console.log("Getting available MetaMask accounts...");
    
    try {
      // Get fresh accounts directly from MetaMask - this gets ACTUAL current accounts, not cached ones
      const rawAccounts = await metaMaskProvider.request({
        method: 'eth_requestAccounts'
      });
      
      console.log("Fresh MetaMask accounts from eth_requestAccounts:", rawAccounts);
      
      if (!rawAccounts || rawAccounts.length === 0) {
        throw new Error("No accounts connected in MetaMask. Please connect an account first.");
      }
      
      // Request accounts in the provider
      await provider.send("eth_requestAccounts", []);
      
      // If the user specified a transaction wallet address, check if it's available
      // This wallet may be different from the signature wallet (transactionData.walletAddress)
      const walletToUse = transactionData.transactionWallet || transactionData.walletAddress;
      
      if (walletToUse) {
        const targetAddress = walletToUse.toLowerCase();
        
        // Enhanced logging to diagnose wallet mismatch issues
        console.log("Available MetaMask accounts (normalized):", rawAccounts.map(acc => acc.toLowerCase()));
        console.log("Target wallet address (normalized):", targetAddress);
        
        // More robust checking to handle potential case mismatches or format issues
        const matchingAccount = rawAccounts.find(acc => acc.toLowerCase() === targetAddress);
        
        if (matchingAccount) {
          // The requested account is available - use it
          console.log(`Requested wallet ${targetAddress} is available in MetaMask`);
          signer = provider.getSigner(matchingAccount);
          console.log(`Using ethers v5 signer for requested wallet: ${matchingAccount}`);
        } else {
          // The requested wallet is not available - show what is available
          const availableAddresses = rawAccounts.map(acc => `- ${acc}`).join('\n');
          
          throw new Error(
            `The wallet address you selected (${targetAddress}) is not available in MetaMask.\n\n` +
            `Currently available accounts in MetaMask:\n${availableAddresses}\n\n` +
            `Please switch to one of these accounts in MetaMask or connect the wallet you selected.`
          );
        }
      } else {
        // No specific wallet requested, use the default
        signer = provider.getSigner();
        const address = await signer.getAddress();
        console.log(`Using default ethers v5 signer: ${address}`);
      }
    } catch (error) {
      console.error("Error accessing MetaMask accounts:", error);
      throw new Error(`Error with MetaMask: ${error.message}`);
    }
  } else if (isV6 && ethers.BrowserProvider) {
    // MetaMask provider already isolated at function start

    // ethers v6
    console.log("Creating ethers v6 provider");
    
    // Create provider with explicit network configuration to avoid ENS issues
    const provider = new ethers.BrowserProvider(metaMaskProvider, "any");
    
    // For ethers v6, get the currently available accounts and offer to use one of them
    console.log("Getting available MetaMask accounts...");
    
    try {
      // Get fresh accounts directly from MetaMask - this gets ACTUAL current accounts, not cached ones
      const rawAccounts = await metaMaskProvider.request({
        method: 'eth_requestAccounts'
      });
      
      console.log("Fresh MetaMask accounts from eth_requestAccounts:", rawAccounts);
      
      if (!rawAccounts || rawAccounts.length === 0) {
        throw new Error("No accounts connected in MetaMask. Please connect an account first.");
      }
      
      // If the user specified a transaction wallet address, check if it's available
      // This may be different from the signature wallet (transactionData.walletAddress)
      const walletToUse = transactionData.transactionWallet || transactionData.walletAddress;
      
      if (walletToUse) {
        const targetAddress = walletToUse.toLowerCase();
        
        // Enhanced logging to diagnose wallet mismatch issues
        console.log("Available MetaMask accounts (normalized):", rawAccounts.map(acc => acc.toLowerCase()));
        console.log("Target wallet address (normalized):", targetAddress);
        
        // More robust checking to handle potential case mismatches or format issues
        const matchingAccount = rawAccounts.find(acc => acc.toLowerCase() === targetAddress);
        
        if (matchingAccount) {
          // The requested account is available in MetaMask
          console.log(`Requested wallet ${targetAddress} is available in MetaMask`);
          
          // Get the signer through the provider
          const accounts = await provider.listAccounts();
          
          // Enhanced logging for ethers v6 account resolution
          console.log("Provider accounts:", accounts.map(acc => ({address: acc.address.toLowerCase()})));
          
          const providerAccount = accounts.find(acc => acc.address.toLowerCase() === targetAddress);
          
          if (providerAccount) {
            signer = await provider.getSigner(providerAccount.address);
            console.log(`Using ethers v6 signer for requested wallet: ${providerAccount.address}`);
          } else {
            console.log(`Warning: Account found in raw accounts but not in provider accounts`);
            // Fall back to error handling
            const availableAddresses = rawAccounts.map(acc => `- ${acc}`).join('\n');
            throw new Error(
              `The wallet address you selected (${targetAddress}) is not available in MetaMask provider accounts.\n\n` +
              `Currently available accounts in MetaMask:\n${availableAddresses}\n\n` +
              `Please switch to one of these accounts in MetaMask or connect the wallet you selected.`
            );
          }
        } else {
          // If we get here, the requested account wasn't found
          // Show which accounts are actually available
          const availableAddresses = rawAccounts.map(acc => `- ${acc}`).join('\n');
          
          throw new Error(
            `The wallet address you selected (${targetAddress}) is not available in MetaMask.\n\n` +
            `Currently available accounts in MetaMask:\n${availableAddresses}\n\n` +
            `Please switch to one of these accounts in MetaMask or connect the wallet you selected.`
          );
        }
      }
      
      // If no specific wallet was requested, use the first available one
      const accounts = await provider.listAccounts();
      signer = await provider.getSigner();
      console.log(`Using default ethers v6 signer: ${await signer.getAddress()}`);
      
    } catch (error) {
      console.error("Error accessing MetaMask accounts:", error);
      throw new Error(`Error with MetaMask: ${error.message}`);
    }
  } else {
    throw new Error('Unsupported ethers.js version');
  }
  
  // Debug the contract ABI being used
  console.log("Contract ABI length:", transactionData.contractABI.length);
  console.log("Contract ABI functions:", transactionData.contractABI.map(item => item.name));
  
  // Import the full contract ABI to avoid issues with partial ABI
  const { CONTRACT_ABI } = await import('@proof-of-funds/common/config/constants');
  console.log("Using full CONTRACT_ABI with", CONTRACT_ABI.length, "functions");
  
  // Create contract instance with full ABI
  const contract = new ethers.Contract(
    transactionData.contractAddress,
    CONTRACT_ABI,
    signer
  );
  
  console.log("Submitting transaction from user wallet...");
  
  // Final network verification before transaction (informational only)
  const finalChainId = await signer.provider.getNetwork();
  const chainIdNumber = Number(finalChainId.chainId);
  console.log(`Final network check: Connected to chain ${chainIdNumber} (${chainIdNumber === 80002 ? 'Polygon Amoy ✅' : 'Wrong network ⚠️'})`);
  
  // Ensure proper data types for ethers v6 - MOVED UP to fix variable access issue
  const proofType = Number(transactionData.proofType);
  const proofHash = String(transactionData.proofHash);
  const expiryTime = BigInt(transactionData.expiryTime);
  const threshold = BigInt(transactionData.threshold);
  const signatureMessage = String(transactionData.signatureMessage);
  
  // Ensure signature is properly formatted as bytes for ethers v6
  let signature = String(transactionData.signature);
  if (!signature.startsWith('0x')) {
    signature = '0x' + signature;
  }
  
  // Validate signature format (should be 132 characters: 0x + 130 hex chars)
  if (signature.length !== 132) {
    console.warn(`Signature length is ${signature.length}, expected 132. Signature: ${signature}`);
  }

  // Let ethers handle gas estimation automatically - no manual estimation
  // This follows security assessment rules: no fake implementations
  console.log("🔢 Letting ethers.js handle gas estimation automatically (no manual overrides)");
  
  console.log("Transaction parameters:", {
    proofType,
    proofHash,
    expiryTime: expiryTime.toString(),
    threshold: threshold.toString(),
    signatureMessage,
    signature
  });

  // Pre-flight checks before transaction submission
  try {
    console.log("🔍 Running pre-flight diagnostics...");
    
    // Check account balance
    const balance = await signer.provider.getBalance(await signer.getAddress());
    console.log(`💰 Account balance: ${ethers.formatEther(balance)} MATIC`);
    
    // Check gas price info (for informational purposes only)
    const gasPrice = await signer.provider.getFeeData();
    console.log(`⛽ Current gas price: ${ethers.formatUnits(gasPrice.gasPrice, 'gwei')} gwei`);
    console.log(`💰 Account has balance: ${ethers.formatEther(balance)} MATIC`);
    
    // Check current nonce
    const nonce = await signer.provider.getTransactionCount(await signer.getAddress());
    console.log(`🔢 Current nonce: ${nonce}`);
    
    // Verify contract exists
    const contractCode = await signer.provider.getCode(transactionData.contractAddress);
    console.log(`📜 Contract exists: ${contractCode !== '0x' ? '✅' : '❌'}`);
    console.log(`📜 Contract code length: ${contractCode.length}`);
    
    // Test basic contract connectivity first
    try {
      console.log("🧪 Testing basic contract connectivity...");
      
      // Try a simple view function call first to check if contract is accessible
      try {
        const currentProof = await contract.getProof(await signer.getAddress());
        console.log("✅ Contract view function accessible - existing proof check completed");
      } catch (viewError) {
        console.warn("⚠️ Contract view function failed:", viewError.message);
        // This might be normal if no proof exists
      }
      
      // Now test contract call simulation (without sending transaction)
      console.log("🧪 Testing contract call simulation...");
      const result = await contract.submitProof.staticCall(
        proofType,
        proofHash,
        expiryTime,
        threshold,
        signatureMessage,
        signature
      );
      console.log("✅ Contract call simulation successful");
    } catch (simError) {
      console.warn("⚠️ Contract simulation failed:", simError.message);
      console.warn("This might indicate a contract-level issue before gas estimation");
      
      // Try to analyze the specific revert reason
      if (simError.message.includes('revert')) {
        console.warn("🔍 Contract reverted - checking possible reasons:");
        console.warn("- Check if contract is paused");
        console.warn("- Verify signature validity");
        console.warn("- Check expiry time bounds");
        console.warn("- Verify threshold amount for proof type");
      }
    }
    
  } catch (diagnosticError) {
    console.warn("🔧 Diagnostic check failed:", diagnosticError.message);
  }

  let tx;
  let lastError;
  
  // Try transaction submission with retry logic for RPC issues
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`🚀 Submitting transaction to MetaMask (attempt ${attempt}/3)...`);
      
      // Add a small delay between retries
      if (attempt > 1) {
        console.log(`⏳ Waiting 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Use legacy gas pricing to avoid MetaMask EIP-1559 issues on Polygon Amoy
      const feeData = await signer.provider.getFeeData();
      const legacyGasPrice = feeData.gasPrice;
      
      console.log(`⛽ Using legacy gas price: ${ethers.formatUnits(legacyGasPrice, 'gwei')} gwei`);
      
      tx = await contract.submitProof(
        proofType,
        proofHash,
        expiryTime,
        threshold,
        signatureMessage,
        signature,
        {
          gasPrice: legacyGasPrice, // Use legacy gas pricing
          type: 0 // Legacy transaction type
        }
      );
      
      console.log("✅ Transaction submitted:", tx.hash);
      break; // Success, exit retry loop
      
    } catch (contractError) {
      lastError = contractError;
      console.error(`❌ Contract call failed (attempt ${attempt}/3):`, contractError);
      
      // For -32603 RPC errors, try to retry
      if (contractError.code === -32603 && attempt < 3) {
        console.log("🔄 RPC error detected, will retry...");
        continue;
      }
      
      // Enhanced error analysis for MetaMask RPC errors
      if (contractError.code === -32603) {
        console.error("🔍 Analyzing MetaMask RPC error -32603:");
        console.error("- This is typically a blockchain/RPC node issue");
        console.error("- Could be: insufficient funds, gas estimation failure, network congestion");
        console.error("- Full error details:", JSON.stringify(contractError, null, 2));
        
        // Try to decode the transaction data for debugging
        if (contractError.transaction) {
          console.error("🔍 Failed transaction details:", contractError.transaction);
        }
        
        throw new Error(`MetaMask RPC Error (after ${attempt} attempts): The transaction failed at the blockchain level. This could be due to insufficient balance, network congestion, or a temporary RPC node issue. Please check your balance and try again in a few minutes.`);
      }
      
      // For other errors, don't retry
      break;
    }
  }
  
  // If we exit the loop without success, handle the last error
  if (!tx && lastError) {
    // Provide more specific error information
    if (lastError.code === 'UNCONFIGURED_NAME') {
      throw new Error(`Ethers.js configuration error: ${lastError.reason || lastError.message}. This may be due to ENS configuration or network issues.`);
    } else if (lastError.reason) {
      throw new Error(`Smart contract error: ${lastError.reason}`);
    } else if (lastError.code === 'UNPREDICTABLE_GAS_LIMIT') {
      throw new Error(`Gas estimation failed: The transaction would likely fail. This could be due to insufficient balance or a contract issue.`);
    } else if (lastError.code === 'USER_REJECTED') {
      throw new Error(`Transaction cancelled: User rejected the transaction in MetaMask.`);
    } else {
      throw new Error(`Transaction failed: ${lastError.message}`);
    }
  }
  
  // Wait for transaction confirmation
  const receipt = await tx.wait();
  console.log("Transaction confirmed:", receipt);
  console.log("Receipt properties:", Object.keys(receipt));
  console.log("Transaction hash from receipt:", receipt.transactionHash || receipt.hash);
  
  // In ethers v6, the transaction hash might be in receipt.hash instead of receipt.transactionHash
  const txHash = receipt.transactionHash || receipt.hash || tx.hash;
  
  return {
    transactionHash: txHash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed ? receipt.gasUsed.toString() : 'unknown'
  };
}