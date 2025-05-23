/**
 * Dynamic Contract Registry
 * 
 * This module provides dynamic contract address resolution based on:
 * 1. Environment variables (highest priority)
 * 2. Deployment files from contracts package
 * 3. Network-specific defaults
 * 
 * This replaces hardcoded addresses with a maintainable system that
 * automatically adapts to different environments and deployments.
 */

// Dynamic imports for Node.js compatibility
let fs, path;

// Initialize Node.js modules only in server environment
if (typeof window === 'undefined') {
  try {
    fs = require('fs');
    path = require('path');
  } catch (error) {
    console.warn('Node.js modules not available:', error.message);
  }
}

// Network chain IDs
export const CHAIN_IDS = {
  ETHEREUM_MAINNET: 1,
  ETHEREUM_GOERLI: 5,
  ETHEREUM_SEPOLIA: 11155111,
  POLYGON_MAINNET: 137,
  POLYGON_MUMBAI: 80001,
  POLYGON_AMOY: 80002,
  HARDHAT_LOCAL: 31337,
  LOCALHOST: 1337
};

// Contract types
export const CONTRACT_TYPES = {
  PROOF_OF_FUNDS: 'ProofOfFunds',
  ZK_VERIFIER: 'ZKVerifier'
};

/**
 * Load deployment data from contracts package
 * @param {string} contractType - Type of contract to load
 * @param {number} chainId - Chain ID to load for
 * @returns {Object|null} Deployment data or null if not found
 */
function loadDeploymentData(contractType, chainId) {
  try {
    // Try to find the contracts package directory
    const possiblePaths = [
      // From frontend package
      path.join(process.cwd(), '../contracts/deployments'),
      // From common package
      path.join(process.cwd(), '../../packages/contracts/deployments'),
      // From root
      path.join(process.cwd(), 'packages/contracts/deployments'),
      // Absolute fallback
      '/Users/karpel/Desktop/GitHub/proof-of-funds/packages/contracts/deployments'
    ];

    let deploymentsDir = null;
    for (const deploymentPath of possiblePaths) {
      if (fs.existsSync(deploymentPath)) {
        deploymentsDir = deploymentPath;
        break;
      }
    }

    if (!deploymentsDir) {
      console.warn('Deployments directory not found, using fallback addresses');
      return null;
    }

    const deploymentFiles = fs.readdirSync(deploymentsDir);
    
    // Look for network-specific deployment files
    const networkNames = {
      [CHAIN_IDS.POLYGON_AMOY]: ['amoy', 'polygon-amoy'],
      [CHAIN_IDS.POLYGON_MUMBAI]: ['mumbai', 'polygon-mumbai'],
      [CHAIN_IDS.POLYGON_MAINNET]: ['polygon', 'polygon-mainnet'],
      [CHAIN_IDS.ETHEREUM_MAINNET]: ['ethereum', 'mainnet'],
      [CHAIN_IDS.ETHEREUM_GOERLI]: ['goerli'],
      [CHAIN_IDS.ETHEREUM_SEPOLIA]: ['sepolia'],
      [CHAIN_IDS.HARDHAT_LOCAL]: ['hardhat', 'localhost'],
      [CHAIN_IDS.LOCALHOST]: ['localhost', 'hardhat']
    };

    const possibleNetworkNames = networkNames[chainId] || [];
    
    // Try to find deployment file for this network and contract type
    for (const networkName of possibleNetworkNames) {
      for (const fileName of deploymentFiles) {
        if (fileName.toLowerCase().includes(networkName.toLowerCase())) {
          try {
            const filePath = path.join(deploymentsDir, fileName);
            const deploymentData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // Check if this deployment matches our contract type
            if (contractType === CONTRACT_TYPES.ZK_VERIFIER && 
                (fileName.includes('zkverifier') || fileName.includes('zk-verifier'))) {
              return deploymentData;
            } else if (contractType === CONTRACT_TYPES.PROOF_OF_FUNDS && 
                       !fileName.includes('zkverifier') && !fileName.includes('zk-verifier')) {
              return deploymentData;
            }
          } catch (error) {
            console.warn(`Failed to parse deployment file ${fileName}:`, error.message);
          }
        }
      }
    }

    // Try generic deployment files
    const genericFiles = ['simple-deployment.json', 'deployment.json'];
    for (const fileName of genericFiles) {
      if (deploymentFiles.includes(fileName)) {
        try {
          const filePath = path.join(deploymentsDir, fileName);
          const deploymentData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (contractType === CONTRACT_TYPES.PROOF_OF_FUNDS) {
            return deploymentData;
          }
        } catch (error) {
          console.warn(`Failed to parse deployment file ${fileName}:`, error.message);
        }
      }
    }

    return null;
  } catch (error) {
    console.warn('Error loading deployment data:', error.message);
    return null;
  }
}

/**
 * Get contract address for a specific chain and contract type
 * @param {string} contractType - Type of contract (PROOF_OF_FUNDS or ZK_VERIFIER)
 * @param {number} chainId - Chain ID
 * @returns {string|null} Contract address or null if not found
 */
export function getContractAddress(contractType, chainId) {
  // 1. First check environment variables (highest priority)
  const envVarName = `${contractType.toUpperCase()}_CONTRACT_ADDRESS_${chainId}`;
  const envAddress = process.env[envVarName];
  if (envAddress && envAddress !== 'undefined') {
    console.log(`Using ${contractType} address from environment: ${envAddress}`);
    return envAddress;
  }

  // 2. Check generic environment variables
  if (contractType === CONTRACT_TYPES.PROOF_OF_FUNDS) {
    const genericEnvAddress = process.env.CONTRACT_ADDRESS || process.env.PROOF_OF_FUNDS_CONTRACT_ADDRESS;
    if (genericEnvAddress && genericEnvAddress !== 'undefined') {
      console.log(`Using ${contractType} address from generic environment: ${genericEnvAddress}`);
      return genericEnvAddress;
    }
  } else if (contractType === CONTRACT_TYPES.ZK_VERIFIER) {
    const zkEnvAddress = process.env.ZK_VERIFIER_CONTRACT_ADDRESS || process.env.ZK_VERIFIER_ADDRESS;
    if (zkEnvAddress && zkEnvAddress !== 'undefined') {
      console.log(`Using ${contractType} address from environment: ${zkEnvAddress}`);
      return zkEnvAddress;
    }
  }

  // 3. Try to load from deployment files
  try {
    const deploymentData = loadDeploymentData(contractType, chainId);
    if (deploymentData) {
      const address = deploymentData.contractAddress || deploymentData.address;
      if (address) {
        console.log(`Using ${contractType} address from deployment file: ${address}`);
        return address;
      }
    }
  } catch (error) {
    console.warn(`Error loading deployment data for ${contractType}:`, error.message);
  }

  // 4. Fallback to network-specific defaults (only for known testnets)
  const fallbackAddresses = {
    [CONTRACT_TYPES.PROOF_OF_FUNDS]: {
      [CHAIN_IDS.POLYGON_AMOY]: '0x19180Cc2d399257F2ea6212A2985eBEcA9EC9970', // Updated deployment
      [CHAIN_IDS.HARDHAT_LOCAL]: null, // Will be deployed dynamically
      [CHAIN_IDS.LOCALHOST]: null // Will be deployed dynamically
    },
    [CONTRACT_TYPES.ZK_VERIFIER]: {
      [CHAIN_IDS.POLYGON_AMOY]: '0x9E98DdFD14e47295a9e900a3dF332EcF6a9587B5', // From deployment
      [CHAIN_IDS.HARDHAT_LOCAL]: null,
      [CHAIN_IDS.LOCALHOST]: null
    }
  };

  const fallbackAddress = fallbackAddresses[contractType]?.[chainId];
  if (fallbackAddress) {
    console.log(`Using ${contractType} fallback address for chain ${chainId}: ${fallbackAddress}`);
    return fallbackAddress;
  }

  // 5. No address found
  console.warn(`No ${contractType} contract address found for chain ID ${chainId}`);
  return null;
}

/**
 * Get the current network's contract address
 * @param {string} contractType - Type of contract
 * @param {Object} options - Options for address resolution
 * @returns {string|null} Contract address or null
 */
export function getCurrentContractAddress(contractType, options = {}) {
  const { 
    chainId = process.env.CHAIN_ID || CHAIN_IDS.POLYGON_AMOY,
    required = true 
  } = options;

  const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
  const address = getContractAddress(contractType, numericChainId);

  if (!address && required) {
    throw new Error(
      `Contract address for ${contractType} not found on chain ${numericChainId}. ` +
      `Please deploy the contract or set the ${contractType.toUpperCase()}_CONTRACT_ADDRESS_${numericChainId} environment variable.`
    );
  }

  return address;
}

/**
 * Get all contract addresses for a given chain
 * @param {number} chainId - Chain ID
 * @returns {Object} Object with all contract addresses
 */
export function getAllContractAddresses(chainId) {
  return {
    proofOfFunds: getContractAddress(CONTRACT_TYPES.PROOF_OF_FUNDS, chainId),
    zkVerifier: getContractAddress(CONTRACT_TYPES.ZK_VERIFIER, chainId)
  };
}

/**
 * Validate that a contract address is properly formatted
 * @param {string} address - Address to validate
 * @returns {boolean} True if valid Ethereum address
 */
export function isValidContractAddress(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  // Check if it's a valid Ethereum address (42 characters, starts with 0x)
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethAddressRegex.test(address);
}

/**
 * Get network name from chain ID
 * @param {number} chainId - Chain ID
 * @returns {string} Network name
 */
export function getNetworkName(chainId) {
  const networkNames = {
    [CHAIN_IDS.ETHEREUM_MAINNET]: 'Ethereum Mainnet',
    [CHAIN_IDS.ETHEREUM_GOERLI]: 'Ethereum Goerli',
    [CHAIN_IDS.ETHEREUM_SEPOLIA]: 'Ethereum Sepolia',
    [CHAIN_IDS.POLYGON_MAINNET]: 'Polygon Mainnet',
    [CHAIN_IDS.POLYGON_MUMBAI]: 'Polygon Mumbai',
    [CHAIN_IDS.POLYGON_AMOY]: 'Polygon Amoy',
    [CHAIN_IDS.HARDHAT_LOCAL]: 'Hardhat Local',
    [CHAIN_IDS.LOCALHOST]: 'Localhost'
  };

  return networkNames[chainId] || `Unknown Network (${chainId})`;
}