/**
 * Blacklist Checker Service
 * 
 * This service verifies wallet addresses against known blacklists
 * from multiple sources. It supports caching results to reduce
 * unnecessary API calls and provides proper error handling.
 */

import { ChainType } from '../utils/chains/ChainAdapterRegistry';

/**
 * Configuration for blacklist sources
 */
export interface BlacklistSourceConfig {
  id: string;                  // Unique identifier for the source
  name: string;                // Human-readable name of the source
  enabled: boolean;            // Whether this source is active
  apiUrl: string;              // API endpoint URL
  apiKey?: string;             // Optional API key
  supportedChains: ChainType[] // Chains supported by this source
  priority: number;            // Priority order (lower is higher priority)
  cacheTime: number;           // Cache validity time in milliseconds
}

/**
 * Blacklist check result from a single source
 */
export interface BlacklistCheckResult {
  source: string;              // Source ID
  sourceName: string;          // Human-readable source name
  address: string;             // The checked address
  isBlacklisted: boolean;      // Whether the address is blacklisted
  category?: string;           // Optional category/reason for blacklisting
  riskScore?: number;          // Optional risk score (0-100)
  details?: Record<string, any>; // Additional source-specific details
  timestamp: number;           // When the check was performed
}

/**
 * Aggregated blacklist check result from all sources
 */
export interface AggregatedBlacklistResult {
  address: string;             // The checked address
  isBlacklisted: boolean;      // Whether the address is blacklisted on any source
  results: BlacklistCheckResult[]; // Results from each source
  highestRiskScore?: number;   // Highest risk score from all sources
  timestamp: number;           // When the check was performed
}

/**
 * Cache entry format
 */
interface CacheEntry {
  result: BlacklistCheckResult;
  expires: number;
}

/**
 * Blacklist Checker Service
 */
export class BlacklistChecker {
  private sources: BlacklistSourceConfig[] = [];
  private cache: Map<string, CacheEntry> = new Map();
  private defaultCacheTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  /**
   * Initialize with blacklist sources
   */
  constructor(sources?: BlacklistSourceConfig[]) {
    if (sources) {
      this.addSources(sources);
    } else {
      this.addDefaultSources();
    }
  }

  /**
   * Add default blacklist sources
   */
  private addDefaultSources(): void {
    this.addSources([
      {
        id: 'chainalysis',
        name: 'Chainalysis',
        enabled: true,
        apiUrl: 'https://public-api.chainalysis.com/api/v1/address',
        apiKey: process.env.CHAINALYSIS_API_KEY,
        supportedChains: [ChainType.EVM, ChainType.BITCOIN],
        priority: 1,
        cacheTime: this.defaultCacheTime,
      },
      {
        id: 'trmLabs',
        name: 'TRM Labs',
        enabled: true,
        apiUrl: 'https://api.trmlabs.com/public/v1/screening/addresses',
        apiKey: process.env.TRM_API_KEY,
        supportedChains: [ChainType.EVM, ChainType.BITCOIN, ChainType.SOLANA],
        priority: 2,
        cacheTime: this.defaultCacheTime,
      },
      {
        id: 'elliptic',
        name: 'Elliptic',
        enabled: true,
        apiUrl: 'https://api.elliptic.co/v2/screening/address',
        apiKey: process.env.ELLIPTIC_API_KEY,
        supportedChains: [ChainType.EVM, ChainType.BITCOIN],
        priority: 3,
        cacheTime: this.defaultCacheTime,
      }
    ]);
  }

  /**
   * Add multiple blacklist sources
   */
  public addSources(sources: BlacklistSourceConfig[]): void {
    for (const source of sources) {
      this.addSource(source);
    }
  }

  /**
   * Add a single blacklist source
   */
  public addSource(source: BlacklistSourceConfig): void {
    // Check for duplicate source ID
    const existingIndex = this.sources.findIndex(s => s.id === source.id);
    if (existingIndex >= 0) {
      this.sources[existingIndex] = source;
    } else {
      this.sources.push(source);
    }
    
    // Sort sources by priority
    this.sources.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Remove a blacklist source by ID
   */
  public removeSource(sourceId: string): boolean {
    const initialLength = this.sources.length;
    this.sources = this.sources.filter(source => source.id !== sourceId);
    return this.sources.length < initialLength;
  }

  /**
   * Enable or disable a blacklist source
   */
  public setSourceEnabled(sourceId: string, enabled: boolean): boolean {
    const source = this.sources.find(s => s.id === sourceId);
    if (source) {
      source.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Get all configured sources
   */
  public getSources(): BlacklistSourceConfig[] {
    return [...this.sources];
  }

  /**
   * Check if a cache entry exists and is valid
   */
  private getCachedResult(
    address: string,
    sourceId: string
  ): BlacklistCheckResult | null {
    const cacheKey = `${sourceId}:${address.toLowerCase()}`;
    const entry = this.cache.get(cacheKey);
    
    // First check if entry exists
    if (!entry) {
      return null;
    }
    
    // Check if entry is expired
    const now = Date.now();
    if (entry.expires <= now) {
      // Remove expired entry
      this.cache.delete(cacheKey);
      return null;
    }
    
    // Return valid cached result
    return entry.result;
  }

  /**
   * Store result in cache
   */
  private cacheResult(
    result: BlacklistCheckResult,
    cacheTime: number
  ): void {
    const cacheKey = `${result.source}:${result.address.toLowerCase()}`;
    this.cache.set(cacheKey, {
      result,
      expires: Date.now() + cacheTime
    });
  }

  /**
   * Clear all cached results
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check address against a specific blacklist source
   */
  private async checkAddressWithSource(
    address: string,
    chainType: ChainType,
    source: BlacklistSourceConfig
  ): Promise<BlacklistCheckResult> {
    // Check if source supports this chain type
    if (!source.supportedChains.includes(chainType)) {
      return {
        source: source.id,
        sourceName: source.name,
        address,
        isBlacklisted: false,
        category: 'Unsupported chain',
        timestamp: Date.now()
      };
    }

    // Check cache first
    const cachedResult = this.getCachedResult(address, source.id);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      let result: BlacklistCheckResult;
      
      // Implement source-specific API calls
      switch (source.id) {
        case 'chainalysis':
          result = await this.checkChainalysis(address, chainType, source);
          break;
        case 'trmLabs':
          result = await this.checkTrmLabs(address, chainType, source);
          break;
        case 'elliptic':
          result = await this.checkElliptic(address, chainType, source);
          break;
        default:
          throw new Error(`Unsupported blacklist source: ${source.id}`);
      }

      // Cache the result
      this.cacheResult(result, source.cacheTime);
      return result;
    } catch (error) {
      console.error(`Error checking address ${address} with ${source.name}:`, error);
      
      // Return a failed check result
      return {
        source: source.id,
        sourceName: source.name,
        address,
        isBlacklisted: false,
        category: 'API Error',
        details: { error: error instanceof Error ? error.message : String(error) },
        timestamp: Date.now()
      };
    }
  }

  /**
   * Check address with Chainalysis API
   */
  private async checkChainalysis(
    address: string,
    chainType: ChainType,
    source: BlacklistSourceConfig
  ): Promise<BlacklistCheckResult> {
    if (!source.apiKey) {
      throw new Error('Chainalysis API key not configured');
    }

    const assetType = this.getChainAssetType(chainType);
    const url = `${source.apiUrl}/${address}?assetType=${assetType}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Token': source.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Chainalysis API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      source: source.id,
      sourceName: source.name,
      address,
      isBlacklisted: data.risk !== 'none',
      category: data.category || undefined,
      riskScore: this.normalizeRiskScore(data.risk),
      details: data,
      timestamp: Date.now()
    };
  }

  /**
   * Check address with TRM Labs API
   */
  private async checkTrmLabs(
    address: string,
    chainType: ChainType,
    source: BlacklistSourceConfig
  ): Promise<BlacklistCheckResult> {
    if (!source.apiKey) {
      throw new Error('TRM Labs API key not configured');
    }

    const chain = this.getTrmChainName(chainType);
    const url = source.apiUrl;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${source.apiKey}`
      },
      body: JSON.stringify({
        addresses: [{
          address,
          chain
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`TRM Labs API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const addressResult = data.addresses?.[0];
    
    if (!addressResult) {
      throw new Error('Invalid response from TRM Labs API');
    }

    return {
      source: source.id,
      sourceName: source.name,
      address,
      isBlacklisted: addressResult.riskScore > 70, // Using 70 as a threshold
      category: addressResult.highRiskCategory || undefined,
      riskScore: addressResult.riskScore || 0,
      details: addressResult,
      timestamp: Date.now()
    };
  }

  /**
   * Check address with Elliptic API
   */
  private async checkElliptic(
    address: string,
    chainType: ChainType,
    source: BlacklistSourceConfig
  ): Promise<BlacklistCheckResult> {
    if (!source.apiKey) {
      throw new Error('Elliptic API key not configured');
    }

    const assetType = this.getEllipticAssetType(chainType);
    const url = `${source.apiUrl}/${assetType}/${address}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-api-key': source.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Elliptic API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      source: source.id,
      sourceName: source.name,
      address,
      isBlacklisted: data.riskScore > 75, // Using 75 as a threshold
      category: data.categories?.[0]?.name || undefined,
      riskScore: data.riskScore || 0,
      details: data,
      timestamp: Date.now()
    };
  }

  /**
   * Convert chain type to Chainalysis asset type
   */
  private getChainAssetType(chainType: ChainType): string {
    switch (chainType) {
      case ChainType.EVM:
        return 'ETH';
      case ChainType.BITCOIN:
        return 'BTC';
      case ChainType.SOLANA:
        return 'SOL';
      default:
        throw new Error(`Unsupported chain type for Chainalysis: ${chainType}`);
    }
  }

  /**
   * Convert chain type to TRM Labs chain name
   */
  private getTrmChainName(chainType: ChainType): string {
    switch (chainType) {
      case ChainType.EVM:
        return 'ethereum';
      case ChainType.BITCOIN:
        return 'bitcoin';
      case ChainType.SOLANA:
        return 'solana';
      default:
        throw new Error(`Unsupported chain type for TRM Labs: ${chainType}`);
    }
  }

  /**
   * Convert chain type to Elliptic asset type
   */
  private getEllipticAssetType(chainType: ChainType): string {
    switch (chainType) {
      case ChainType.EVM:
        return 'eth';
      case ChainType.BITCOIN:
        return 'btc';
      default:
        throw new Error(`Unsupported chain type for Elliptic: ${chainType}`);
    }
  }

  /**
   * Normalize risk score to 0-100 scale
   */
  private normalizeRiskScore(risk: string | number): number {
    if (typeof risk === 'number') {
      return Math.max(0, Math.min(100, risk));
    }
    
    // Convert string risk levels to numeric scores
    switch (risk?.toLowerCase()) {
      case 'high':
        return 90;
      case 'medium':
        return 65;
      case 'low':
        return 30;
      case 'none':
      default:
        return 0;
    }
  }

  /**
   * Check address against all enabled blacklist sources
   */
  public async checkAddress(
    address: string,
    chainType: ChainType
  ): Promise<AggregatedBlacklistResult> {
    const enabledSources = this.sources.filter(source => source.enabled);
    
    if (enabledSources.length === 0) {
      throw new Error('No enabled blacklist sources configured');
    }

    // Check each source in parallel
    const resultPromises = enabledSources.map(source => 
      this.checkAddressWithSource(address, chainType, source)
        .catch(error => {
          console.error(`Error checking source ${source.name}:`, error);
          return {
            source: source.id,
            sourceName: source.name,
            address,
            isBlacklisted: false,
            category: 'Error',
            details: { error: error instanceof Error ? error.message : String(error) },
            timestamp: Date.now()
          } as BlacklistCheckResult;
        })
    );

    const results = await Promise.all(resultPromises);
    
    // Determine if address is blacklisted on any source
    const isBlacklisted = results.some(result => result.isBlacklisted);
    
    // Calculate highest risk score
    const riskScores = results
      .filter(result => typeof result.riskScore === 'number')
      .map(result => result.riskScore as number);
    
    const highestRiskScore = riskScores.length > 0 
      ? Math.max(...riskScores)
      : undefined;

    return {
      address,
      isBlacklisted,
      results,
      highestRiskScore,
      timestamp: Date.now()
    };
  }

  /**
   * Check multiple addresses against all enabled blacklist sources
   */
  public async checkMultipleAddresses(
    addresses: string[],
    chainType: ChainType
  ): Promise<Record<string, AggregatedBlacklistResult>> {
    const resultPromises = addresses.map(address => 
      this.checkAddress(address, chainType)
        .then(result => [address.toLowerCase(), result] as const)
        .catch(error => {
          console.error(`Error checking address ${address}:`, error);
          return [address.toLowerCase(), {
            address,
            isBlacklisted: false,
            results: [{
              source: 'error',
              sourceName: 'Error',
              address,
              isBlacklisted: false,
              category: 'Error',
              details: { error: error instanceof Error ? error.message : String(error) },
              timestamp: Date.now()
            }],
            timestamp: Date.now()
          }] as const;
        })
    );

    const results = await Promise.all(resultPromises);
    return Object.fromEntries(results);
  }
}

export default BlacklistChecker;