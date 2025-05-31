# Services Usage Examples

This document provides examples of how to use the various services in your application.

## Transaction History Processor Usage Examples

## Basic Usage

```typescript
import { TransactionHistoryProcessor } from './services';

// Create a new processor instance
const processor = new TransactionHistoryProcessor();

// Get transactions from a specific chain
async function getEthereumTransactions(address) {
  // Ethereum mainnet chainId = 1
  const transactions = await processor.getChainTransactions(address, 1);
  console.log(`Found ${transactions.length} Ethereum transactions`);
  return transactions;
}

// Get transactions from all supported chains
async function getAllTransactions(address) {
  const transactions = await processor.getAllChainTransactions(address);
  console.log(`Found ${transactions.length} transactions across all chains`);
  return transactions;
}

// Filter transactions by date range
async function getRecentTransactions(address, daysBack = 30) {
  const now = Math.floor(Date.now() / 1000);
  const startDate = now - (daysBack * 24 * 60 * 60); // 30 days ago
  
  const options = {
    startDate,
    includeIncoming: true,
    includeOutgoing: true,
    status: ['success']
  };
  
  const transactions = await processor.getAllChainTransactions(address, options);
  return transactions;
}
```

## Filtering Examples

```typescript
import { TransactionHistoryProcessor } from './services';
import { BigNumber } from 'ethers';

const processor = new TransactionHistoryProcessor();

// Filter by minimum value
async function getLargeTransactions(address) {
  const options = {
    minValue: BigNumber.from('1000000000000000000'), // 1 ETH or equivalent
    status: ['success']
  };
  
  return processor.getAllChainTransactions(address, options);
}

// Filter by counterparty
async function getTransactionsWithCounterparty(address, counterparty) {
  const options = {
    counterparties: [counterparty],
    status: ['success', 'pending']
  };
  
  return processor.getAllChainTransactions(address, options);
}

// Custom filtering
async function getCustomFilteredTransactions(address) {
  // First get all transactions
  const allTransactions = await processor.getAllChainTransactions(address);
  
  // Then apply custom filter
  const filtered = processor.filterTransactions(allTransactions, tx => {
    // Example: Only include transactions on weekends
    const date = new Date(tx.timestamp * 1000);
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  });
  
  return filtered;
}
```

## Using for Proof Generation

```typescript
import { TransactionHistoryProcessor } from './services';

const processor = new TransactionHistoryProcessor();

async function generateProofData(address) {
  // Define options for proof generation
  const options = {
    // Last 90 days
    startDate: Math.floor(Date.now() / 1000) - (90 * 24 * 60 * 60),
    // Only successful transactions
    status: ['success'],
    // Only outgoing transactions (shows funds the user controlled)
    includeIncoming: false,
    includeOutgoing: true
  };
  
  // Get prepared data for proof generation
  const { transactions, aggregation } = await processor.prepareTransactionsForProof(
    address, 
    options
  );
  
  console.log(`Total transactions: ${aggregation.count}`);
  console.log(`Total value: ${aggregation.totalValue.toString()}`);
  
  if (aggregation.totalValueUSD) {
    console.log(`Total USD value: $${aggregation.totalValueUSD.toFixed(2)}`);
  }
  
  // Now you can use this data to generate your proof
  return {
    address,
    transactions,
    aggregation,
    timestamp: Math.floor(Date.now() / 1000)
  };
}
```

## Integration with UI Components

```typescript
import React, { useState, useEffect } from 'react';
import { TransactionHistoryProcessor } from './services';

const processor = new TransactionHistoryProcessor();

function TransactionHistoryComponent({ address }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function loadTransactions() {
      try {
        setLoading(true);
        const result = await processor.getAllChainTransactions(address);
        setTransactions(result);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadTransactions();
  }, [address]);
  
  if (loading) return <div>Loading transaction history...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <h2>Transaction History</h2>
      {transactions.length === 0 ? (
        <p>No transactions found</p>
      ) : (
        <ul>
          {transactions.map(tx => (
            <li key={tx.id}>
              {new Date(tx.timestamp * 1000).toLocaleDateString()}: 
              {tx.value.toString()} on chain {tx.chainId}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## BlacklistChecker Usage Examples

This section provides examples of how to use the BlacklistChecker service in your application.

## Basic Usage

```typescript
import { BlacklistChecker } from './services';
import { ChainType } from '../utils/chains/ChainAdapterRegistry';

// Create a new checker instance with default sources
const checker = new BlacklistChecker();

// Check a single address
async function checkAddress(address) {
  // Check on Ethereum network
  const result = await checker.checkAddress(address, ChainType.EVM);
  
  if (result.isBlacklisted) {
    console.log(`⚠️ Address ${address} is blacklisted!`);
    
    // Log details from each source that flagged it
    for (const sourceResult of result.results) {
      if (sourceResult.isBlacklisted) {
        console.log(`- Flagged by ${sourceResult.sourceName}`);
        console.log(`  Category: ${sourceResult.category || 'Unknown'}`);
        console.log(`  Risk score: ${sourceResult.riskScore || 'N/A'}`);
      }
    }
    
    return false; // Blacklisted, do not proceed
  } else {
    console.log(`✅ Address ${address} is not blacklisted`);
    return true; // Not blacklisted, safe to proceed
  }
}

// Check multiple addresses at once
async function checkMultipleAddresses(addresses) {
  const results = await checker.checkMultipleAddresses(addresses, ChainType.EVM);
  
  // Process results
  const blacklistedAddresses = [];
  const safeAddresses = [];
  
  for (const [address, result] of Object.entries(results)) {
    if (result.isBlacklisted) {
      blacklistedAddresses.push(address);
    } else {
      safeAddresses.push(address);
    }
  }
  
  console.log(`Found ${blacklistedAddresses.length} blacklisted addresses`);
  
  return {
    blacklistedAddresses,
    safeAddresses
  };
}
```

## Configuring Custom Sources

```typescript
import { BlacklistChecker, BlacklistSourceConfig } from './services';
import { ChainType } from '../utils/chains/ChainAdapterRegistry';

// Configure with custom sources
const customSources: BlacklistSourceConfig[] = [
  {
    id: 'chainalysis',
    name: 'Chainalysis',
    enabled: true,
    apiUrl: 'https://public-api.chainalysis.com/api/v1/address',
    apiKey: process.env.CHAINALYSIS_API_KEY,
    supportedChains: [ChainType.EVM, ChainType.BITCOIN],
    priority: 1,
    cacheTime: 24 * 60 * 60 * 1000, // 24 hours
  },
  {
    id: 'customSource',
    name: 'Internal Blacklist',
    enabled: true,
    apiUrl: 'https://api.internal.example.com/blacklist',
    apiKey: process.env.INTERNAL_API_KEY,
    supportedChains: [ChainType.EVM, ChainType.BITCOIN, ChainType.SOLANA],
    priority: 0, // Higher priority than Chainalysis
    cacheTime: 6 * 60 * 60 * 1000, // 6 hours - refresh more often
  }
];

const checker = new BlacklistChecker(customSources);

// Add a new source after initialization
checker.addSource({
  id: 'newSource',
  name: 'New Blacklist Provider',
  enabled: true,
  apiUrl: 'https://api.newprovider.com/check',
  apiKey: process.env.NEW_PROVIDER_API_KEY,
  supportedChains: [ChainType.EVM],
  priority: 2,
  cacheTime: 12 * 60 * 60 * 1000 // 12 hours
});

// Disable a source temporarily
checker.setSourceEnabled('chainalysis', false);

// Get list of all configured sources
const sources = checker.getSources();
console.log(`Configured sources: ${sources.length}`);
sources.forEach(source => {
  console.log(`- ${source.name} (${source.enabled ? 'enabled' : 'disabled'})`);
});
```

## Integration with Transaction Processing

```typescript
import { BlacklistChecker, TransactionHistoryProcessor } from './services';
import { ChainType } from '../utils/chains/ChainAdapterRegistry';

const checker = new BlacklistChecker();
const processor = new TransactionHistoryProcessor();

// Check transactions for blacklisted counterparties
async function checkTransactionCounterparties(address) {
  // Get all transactions
  const transactions = await processor.getAllChainTransactions(address);
  
  // Extract unique counterparty addresses
  const counterparties = new Set();
  for (const tx of transactions) {
    if (tx.from.toLowerCase() !== address.toLowerCase()) {
      counterparties.add(tx.from.toLowerCase());
    }
    if (tx.to.toLowerCase() !== address.toLowerCase()) {
      counterparties.add(tx.to.toLowerCase());
    }
  }
  
  // Check all counterparties
  const counterpartyArray = Array.from(counterparties) as string[];
  const results = await checker.checkMultipleAddresses(counterpartyArray, ChainType.EVM);
  
  // Filter blacklisted counterparties
  const blacklistedCounterparties = Object.entries(results)
    .filter(([_, result]) => result.isBlacklisted)
    .map(([address, _]) => address);
  
  // Find transactions with blacklisted counterparties
  const riskyTransactions = transactions.filter(tx => {
    const from = tx.from.toLowerCase();
    const to = tx.to.toLowerCase();
    return blacklistedCounterparties.includes(from) || blacklistedCounterparties.includes(to);
  });
  
  return {
    riskyTransactions,
    blacklistedCounterparties
  };
}
```

## React Component for Address Verification

```tsx
import React, { useState } from 'react';
import { BlacklistChecker } from './services';
import { ChainType } from '../utils/chains/ChainAdapterRegistry';

const checker = new BlacklistChecker();

interface AddressVerificationProps {
  onVerificationComplete: (result: { isBlacklisted: boolean }) => void;
}

function AddressVerification({ onVerificationComplete }: AddressVerificationProps) {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleVerify = async () => {
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Invalid Ethereum address format');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const checkResult = await checker.checkAddress(address, ChainType.EVM);
      setResult(checkResult);
      
      // Notify parent component
      if (onVerificationComplete) {
        onVerificationComplete(checkResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="address-verification">
      <h3>Verify Wallet Address</h3>
      <div className="input-group">
        <input
          type="text"
          placeholder="Enter Ethereum address (0x...)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <button 
          onClick={handleVerify}
          disabled={loading}
        >
          {loading ? 'Checking...' : 'Verify'}
        </button>
      </div>
      
      {error && (
        <div className="error-message">{error}</div>
      )}
      
      {result && (
        <div className={`result ${result.isBlacklisted ? 'blacklisted' : 'safe'}`}>
          <h4>
            {result.isBlacklisted 
              ? '⚠️ Address is blacklisted'
              : '✅ Address is not blacklisted'}
          </h4>
          
          {result.highestRiskScore !== undefined && (
            <div className="risk-score">
              Risk Score: {result.highestRiskScore}/100
            </div>
          )}
          
          <div className="sources">
            <h5>Results from {result.results.length} sources:</h5>
            <ul>
              {result.results.map((sourceResult, index) => (
                <li key={index} className={sourceResult.isBlacklisted ? 'blacklisted' : 'safe'}>
                  {sourceResult.sourceName}: {sourceResult.isBlacklisted ? 'BLACKLISTED' : 'Clear'}
                  {sourceResult.category && ` (${sourceResult.category})`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
```

## VerificationResultFormatter Usage Examples

See the dedicated examples file `VerificationResultFormatter.examples.md` for comprehensive usage examples of the VerificationResultFormatter service.