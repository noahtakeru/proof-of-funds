import React from 'react';

/**
 * Component for displaying multi-chain assets in a standardized format
 * 
 * @param {Object} props
 * @param {Object} props.assetSummary - The asset summary data to display
 * @param {boolean} props.showUSDValues - Whether to show USD values
 * @param {boolean} props.isLoading - Whether the assets are loading
 * @param {string} props.error - Error message if any
 * @param {Function} props.onRefresh - Optional refresh function for manual asset refresh
 */
const MultiChainAssetDisplay = ({ assetSummary, showUSDValues, isLoading, error, onRefresh }) => {
    // Get chain ID for network detection
    const [chainId, setChainId] = React.useState(null);
    
    // Get chain ID on component mount
    React.useEffect(() => {
        async function getChainId() {
            if (typeof window !== 'undefined' && window.ethereum) {
                try {
                    const hexChainId = await window.ethereum.request({ method: 'eth_chainId' });
                    const decimalChainId = parseInt(hexChainId, 16);
                    setChainId(decimalChainId);
                } catch (error) {
                    console.error('Error getting chain ID:', error);
                }
            }
        }
        getChainId();
    }, []);
    
    // State for refresh button
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    
    // Handle refresh button click
    const handleRefresh = async () => {
        if (onRefresh && !isRefreshing) {
            setIsRefreshing(true);
            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
            }
        }
    };
    
    if (isLoading) {
        return (
            <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return <div className="text-red-600 py-2">{error}</div>;
    }

    if (!assetSummary) {
        return (
            <div className="text-gray-600 py-2">
                No asset data available
            </div>
        );
    }
    
    // Helper to format currency values
    const formatValue = (value, decimals = 6) => {
        if (value === undefined || value === null) {return '0.00';}
        return Number(value).toFixed(decimals);
    };

    // Helper to get the native symbol for a chain
    const getNativeSymbol = (chain) => {
        // Import from centralized chain mappings
        const { CHAIN_NATIVE_TOKENS } = require('@proof-of-funds/common/utils/chainMappings');
        
        // Ensure chain is a string for conversion to lowercase
        const chainStr = String(chain || '').toLowerCase();
        return CHAIN_NATIVE_TOKENS[chainStr] || chainStr.toUpperCase() || 'UNKNOWN';
    };

    // Simple network mismatch detection - chain-agnostic
    // Check if there's a mismatch between detected chain and displayed assets
    // Map chain ID to chain name for comparing with asset data
    // Use centralized chain mappings
    const { CHAIN_IDS } = require('@proof-of-funds/common/utils/chainMappings');
    
    // Get expected chain name based on detected chain ID
    const mappedChainName = CHAIN_IDS[chainId] || '';
    
    // Network mismatch warning is no longer needed with multi-chain scanning
    // but we'll keep it for cases where a user might have assets on chains we're not scanning
    const isPossibleNetworkMismatch = 
      chainId && 
      mappedChainName && 
      assetSummary?.chains && 
      !assetSummary.chains[mappedChainName] &&
      Object.keys(assetSummary.chains).length > 0;
    
    // Check if cross-chain data is available
    const hasCrossChainData = assetSummary.crossChain && 
                              assetSummary.crossChain.crossChainSummary && 
                              assetSummary.crossChain.crossChainSummary.length > 0;
    
    return (
        <div>
            {/* Network mismatch warning - shown only for truly unsupported chains */}
            {isPossibleNetworkMismatch && !hasCrossChainData && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4">
                    <p className="text-sm text-yellow-700">
                        <strong>Note:</strong> You are connected to {mappedChainName || 'a network'} that may not be fully supported.
                    </p>
                </div>
            )}
            
            {/* Warning for unknown chain */}
            {!chainId && (
                <div className="bg-red-100 border-l-4 border-red-500 p-4 mb-4">
                    <p className="text-sm text-red-700">
                        <strong>No Wallet Connection:</strong> Please connect your wallet to view assets correctly.
                    </p>
                </div>
            )}
            
            {/* Refresh button */}
            {onRefresh && (
                <div className="mb-4">
                    <button 
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                    >
                        {isRefreshing ? 'Refreshing...' : 'Refresh Assets'}
                    </button>
                </div>
            )}
            
            {/* Total value */}
            <div className="text-lg font-medium mb-2">
                Total Value: {showUSDValues
                    ? `$${formatValue(assetSummary.totalUSDValue || assetSummary.totalValue || 0, 2)} USD`
                    : 'Multiple Assets'}
            </div>

            {/* Cross-chain assets display */}
            {hasCrossChainData ? (
                <div className="mb-4">
                    <h3 className="text-lg font-medium mb-2">Your Assets Across All Chains</h3>
                    <div className="space-y-4">
                        {assetSummary.crossChain.crossChainSummary
                          .sort((a, b) => b.totalUsdValue - a.totalUsdValue) // Sort by highest value first
                          .map((asset, idx) => (
                            <div key={idx} className="p-3 bg-white rounded-lg shadow-sm border border-gray-200">
                                <div className="flex justify-between items-center mb-2">
                                    <div>
                                        <span className="font-medium text-lg">{asset.symbol}</span>
                                        {asset.name && asset.name !== asset.symbol && 
                                            <span className="text-gray-500 ml-2">({asset.name})</span>
                                        }
                                    </div>
                                    <div className="font-medium">
                                        ${formatValue(asset.totalUsdValue, 2)}
                                    </div>
                                </div>
                                
                                <div className="divide-y divide-gray-100">
                                    {asset.instances.map((instance, i) => (
                                        <div key={i} className="py-2 flex justify-between">
                                            <div className="flex items-center">
                                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-2">
                                                    {instance.chain}
                                                </span>
                                                <span className="text-sm">
                                                    {formatValue(instance.balance || instance.balance_formatted)} {asset.symbol}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                ${formatValue(instance.usdValue, 2)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                // Fallback to traditional asset table if cross-chain data isn't available
                <div className="overflow-x-auto mb-4">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="py-2 px-3 text-left">Asset</th>
                                <th className="py-2 px-3 text-right">Balance</th>
                                {showUSDValues && (
                                    <>
                                        <th className="py-2 px-3 text-right">Price (USD)</th>
                                        <th className="py-2 px-3 text-right">Value (USD)</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {/* Always use totalAssets first, and fallback to convertedAssets */}
                            {assetSummary.totalAssets && assetSummary.totalAssets.length > 0 ? (
                                assetSummary.totalAssets.map((asset, idx) => (
                                    <tr key={idx} className="border-t border-gray-200">
                                        <td className="py-2 px-3">{asset.symbol}</td>
                                        <td className="py-2 px-3 text-right">{formatValue(asset.balance)}</td>
                                        {showUSDValues && (
                                            <>
                                                <td className="py-2 px-3 text-right">${formatValue(asset.price || 0, 2)}</td>
                                                <td className="py-2 px-3 text-right">${formatValue(asset.usdValue || 0, 2)}</td>
                                            </>
                                        )}
                                    </tr>
                                ))
                            ) : assetSummary.convertedAssets ? (
                                assetSummary.convertedAssets.map((asset, idx) => (
                                    <tr key={idx} className="border-t border-gray-200">
                                        <td className="py-2 px-3">{asset.symbol}</td>
                                        <td className="py-2 px-3 text-right">{formatValue(asset.balance)}</td>
                                        {showUSDValues && (
                                            <>
                                                <td className="py-2 px-3 text-right">${formatValue(asset.price, 2)}</td>
                                                <td className="py-2 px-3 text-right">${formatValue(asset.usdValue, 2)}</td>
                                            </>
                                        )}
                                    </tr>
                                ))
                            ) : (
                                <tr className="border-t border-gray-200">
                                    <td colSpan={showUSDValues ? 4 : 2} className="py-2 px-3 text-center">
                                        No assets found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Chain breakdown - always shown */}
            <div className="mt-4">
                <h4 className="font-medium mb-2">Chain Breakdown</h4>
                <div className="space-y-2">
                    {Object.entries(assetSummary.chains).map(([chain, data]) => (
                        <div key={chain} className="p-2 bg-white rounded border">
                            <div className="font-medium capitalize">{chain}</div>
                            <div className="text-sm">
                                Native: {formatValue(data.nativeBalance)} {getNativeSymbol(chain)}
                                {showUSDValues && data.nativeUSDValue &&
                                    ` ($${formatValue(data.nativeUSDValue, 2)} USD)`
                                }
                            </div>
                            {Object.entries(data.tokens).length > 0 && (
                                <div className="text-sm">
                                    Tokens: {Object.entries(data.tokens).map(([symbol, balance], idx) => (
                                        <span key={idx}>
                                            {idx > 0 && ', '}
                                            {formatValue(balance, 2)} {symbol}
                                            {showUSDValues && data.tokensUSDValue && data.tokensUSDValue[symbol] &&
                                                ` ($${formatValue(data.tokensUSDValue[symbol], 2)} USD)`
                                            }
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MultiChainAssetDisplay; 