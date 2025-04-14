/**
 * @file ContractAddressRegistry.ts
 * @description Registry for contract addresses across multiple chains
 */

interface ContractDeployment {
  address: string;
  deployedAt: number; // Block number
  deployer: string;
  implementation?: string; // For proxy contracts
  version: string;
}

interface ChainConfig {
  name: string;
  rpcUrls: string[];
  blockExplorerUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

/**
 * Registry for contract addresses across multiple chains
 */
export class ContractAddressRegistry {
  private deployments: Map<string, Map<number, ContractDeployment[]>> = new Map();
  private chainConfigs: Map<number, ChainConfig> = new Map();
  
  constructor() {
    this.initialize();
  }
  
  /**
   * Initialize the registry with known deployments
   */
  private initialize(): void {
    // Initialize chain configurations
    this.initializeChainConfigs();
    
    // Load deployments from deployment files
    this.loadDeployments();
  }
  
  /**
   * Initialize chain configurations
   */
  private initializeChainConfigs(): void {
    // Ethereum Mainnet
    this.chainConfigs.set(1, {
      name: 'Ethereum Mainnet',
      rpcUrls: ['https://mainnet.infura.io/v3/${INFURA_API_KEY}'],
      blockExplorerUrls: ['https://etherscan.io'],
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      }
    });
    
    // Ethereum Goerli
    this.chainConfigs.set(5, {
      name: 'Goerli Testnet',
      rpcUrls: ['https://goerli.infura.io/v3/${INFURA_API_KEY}'],
      blockExplorerUrls: ['https://goerli.etherscan.io'],
      nativeCurrency: {
        name: 'Goerli Ether',
        symbol: 'ETH',
        decimals: 18
      }
    });
    
    // Ethereum Sepolia
    this.chainConfigs.set(11155111, {
      name: 'Sepolia Testnet',
      rpcUrls: ['https://sepolia.infura.io/v3/${INFURA_API_KEY}'],
      blockExplorerUrls: ['https://sepolia.etherscan.io'],
      nativeCurrency: {
        name: 'Sepolia Ether',
        symbol: 'ETH',
        decimals: 18
      }
    });
    
    // Polygon Mainnet
    this.chainConfigs.set(137, {
      name: 'Polygon Mainnet',
      rpcUrls: ['https://polygon-rpc.com'],
      blockExplorerUrls: ['https://polygonscan.com'],
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
      }
    });
    
    // Polygon Mumbai
    this.chainConfigs.set(80001, {
      name: 'Polygon Mumbai',
      rpcUrls: ['https://rpc-mumbai.maticvigil.com'],
      blockExplorerUrls: ['https://mumbai.polygonscan.com'],
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
      }
    });
    
    // Polygon Amoy Testnet
    this.chainConfigs.set(80002, {
      name: 'Polygon Amoy',
      rpcUrls: ['https://rpc-amoy.polygon.technology'],
      blockExplorerUrls: ['https://www.oklink.com/amoy'],
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
      }
    });
    
    // Hardhat local
    this.chainConfigs.set(31337, {
      name: 'Hardhat Local',
      rpcUrls: ['http://localhost:8545'],
      blockExplorerUrls: [],
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      }
    });
  }
  
  /**
   * Load deployments from deployment files
   */
  private loadDeployments(): void {
    try {
      // For ESM compatibility, we'll use hardcoded deployments instead of dynamic imports
      // In a real implementation, you would use dynamic imports or fetch this from an API
      const simpleDeployments = [
        {
          contractName: 'ProofOfFundsSimple',
          chainId: 80001, // Mumbai
          address: '0x23F3B2CBCFDB589D1101BE5E019EFBA8B3D4D4B9',
          blockNumber: 2000000,
          deployer: '0x1234567890123456789012345678901234567890',
          version: '1.0.0'
        },
        {
          contractName: 'ProofOfFundsSimple',
          chainId: 80002, // Amoy
          address: '0x42F0A74198843A4C97849099527a711Eb27b6e66',
          blockNumber: 3000000,
          deployer: '0x1234567890123456789012345678901234567890',
          version: '1.0.0'
        },
        {
          contractName: 'ProofOfFundsSimple',
          chainId: 31337, // Hardhat
          address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
          blockNumber: 1,
          deployer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          version: '1.0.0'
        }
      ];
      
      // Process each hardcoded deployment
      for (const deployment of simpleDeployments) {
        this.addDeployment(
          deployment.contractName,
          deployment.chainId,
          deployment.address,
          deployment.blockNumber,
          deployment.deployer,
          undefined,
          deployment.version
        );
      }
    } catch (error) {
      console.error('Error loading deployments:', error);
      // Initialize with hardcoded fallback addresses for critical testnets
      this.initializeFallbackDeployments();
    }
  }
  
  /**
   * Initialize fallback deployments if loading fails
   */
  private initializeFallbackDeployments(): void {
    // Hardcoded testnet addresses as fallback
    // Sepolia testnet
    this.addDeployment(
      'ProofOfFundsSimple',
      11155111,
      '0xFB3F6A805FDc22C33DCE3740CD07DF14B62C57F1', // Example address
      1000000,
      '0x1234567890123456789012345678901234567890',
      undefined,
      '1.0.0'
    );
    
    // Mumbai testnet
    this.addDeployment(
      'ProofOfFundsSimple',
      80001,
      '0x23F3B2CBCFDB589D1101BE5E019EFBA8B3D4D4B9', // Example address
      2000000,
      '0x1234567890123456789012345678901234567890',
      undefined,
      '1.0.0'
    );
    
    // Amoy testnet
    this.addDeployment(
      'ProofOfFundsSimple',
      80002,
      '0x42F0A74198843A4C97849099527a711Eb27b6e66', // Example address
      3000000,
      '0x1234567890123456789012345678901234567890',
      undefined,
      '1.0.0'
    );
    
    // Hardhat local
    this.addDeployment(
      'ProofOfFundsSimple',
      31337,
      '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Default Hardhat first deployment address
      1,
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Default Hardhat account
      undefined,
      '1.0.0'
    );
  }
  
  /**
   * Add a contract deployment to the registry
   * @param contractName Name of the contract
   * @param chainId Chain ID where the contract is deployed
   * @param address Contract address
   * @param deployedAt Block number of deployment
   * @param deployer Address of deployer
   * @param implementation Address of implementation (for proxy contracts)
   * @param version Version of the contract
   */
  addDeployment(
    contractName: string,
    chainId: number,
    address: string,
    deployedAt: number,
    deployer: string,
    implementation?: string,
    version: string = '1.0.0'
  ): void {
    // Initialize nested maps if they don't exist
    if (!this.deployments.has(contractName)) {
      this.deployments.set(contractName, new Map());
    }
    
    const contractDeployments = this.deployments.get(contractName)!;
    if (!contractDeployments.has(chainId)) {
      contractDeployments.set(chainId, []);
    }
    
    // Add the deployment to the list
    contractDeployments.get(chainId)!.push({
      address,
      deployedAt,
      deployer,
      implementation,
      version
    });
    
    // Sort deployments by block number, most recent first
    contractDeployments.get(chainId)!.sort((a, b) => b.deployedAt - a.deployedAt);
  }
  
  /**
   * Get the address of a contract on a specific chain
   * @param contractName Name of the contract
   * @param chainId Chain ID where the contract is deployed
   * @param version Optional specific version to retrieve
   * @returns Contract address or undefined if not found
   */
  getAddress(contractName: string, chainId: number, version?: string): string | undefined {
    const contractDeployments = this.deployments.get(contractName);
    if (!contractDeployments) {
      return undefined;
    }
    
    const chainDeployments = contractDeployments.get(chainId);
    if (!chainDeployments || chainDeployments.length === 0) {
      return undefined;
    }
    
    // If version is specified, find that specific version
    if (version) {
      const versionDeployment = chainDeployments.find(d => d.version === version);
      return versionDeployment?.address;
    }
    
    // Otherwise, return the most recent deployment
    return chainDeployments[0].address;
  }
  
  /**
   * Get all deployments of a contract on a specific chain
   * @param contractName Name of the contract
   * @param chainId Chain ID where the contract is deployed
   * @returns Array of deployments or empty array if none found
   */
  getAllDeployments(contractName: string, chainId: number): ContractDeployment[] {
    const contractDeployments = this.deployments.get(contractName);
    if (!contractDeployments) {
      return [];
    }
    
    const chainDeployments = contractDeployments.get(chainId);
    if (!chainDeployments) {
      return [];
    }
    
    return [...chainDeployments];
  }
  
  /**
   * Get all chains where a contract is deployed
   * @param contractName Name of the contract
   * @returns Array of chain IDs
   */
  getDeployedChains(contractName: string): number[] {
    const contractDeployments = this.deployments.get(contractName);
    if (!contractDeployments) {
      return [];
    }
    
    return [...contractDeployments.keys()];
  }
  
  /**
   * Get all contract names in the registry
   * @returns Array of contract names
   */
  getContractNames(): string[] {
    return [...this.deployments.keys()];
  }
  
  /**
   * Get information about a chain
   * @param chainId Chain ID
   * @returns Chain configuration or undefined if not found
   */
  getChainInfo(chainId: number): ChainConfig | undefined {
    return this.chainConfigs.get(chainId);
  }
  
  /**
   * Get all supported chains
   * @returns Array of chain IDs
   */
  getSupportedChains(): number[] {
    return [...this.chainConfigs.keys()];
  }
  
  /**
   * Check if a chain is supported
   * @param chainId Chain ID
   * @returns True if the chain is supported
   */
  isChainSupported(chainId: number): boolean {
    return this.chainConfigs.has(chainId);
  }
  
  /**
   * Add support for a new chain
   * @param chainId Chain ID
   * @param chainConfig Chain configuration
   */
  addChainSupport(chainId: number, chainConfig: ChainConfig): void {
    this.chainConfigs.set(chainId, chainConfig);
  }
}