import React from 'react';

/**
 * Component for displaying multi-chain assets in a standardized format
 * 
 * @param {Object} props
 * @param {Object} props.assetSummary - The asset summary data to display
 * @param {boolean} props.showUSDValues - Whether to show USD values
 * @param {boolean} props.isLoading - Whether the assets are loading
 * @param {string} props.error - Error message if any
 */
const MultiChainAssetDisplay = ({ assetSummary, showUSDValues, isLoading, error }) => {
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
        if (value === undefined || value === null) return '0.00';
        return Number(value).toFixed(decimals);
    };

    // Helper to get the native symbol for a chain
    const getNativeSymbol = (chain) => {
        const chainMap = {
            ethereum: 'ETH',
            polygon: 'MATIC',
            binance: 'BNB',
            solana: 'SOL',
            'hardhat local': 'ETH',
            hardhat: 'ETH'
        };
        return chainMap[chain.toLowerCase()] || chain.toUpperCase();
    };

    return (
        <div>
            {/* Total value */}
            <div className="text-lg font-medium mb-2">
                Total Value: {showUSDValues
                    ? `$${formatValue(assetSummary.totalUSDValue, 2)} USD`
                    : 'Multiple Assets'}
            </div>

            {/* Assets table */}
            <div className="overflow-x-auto">
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
                        {showUSDValues
                            ? assetSummary.convertedAssets.map((asset, idx) => (
                                <tr key={idx} className="border-t border-gray-200">
                                    <td className="py-2 px-3">{asset.symbol}</td>
                                    <td className="py-2 px-3 text-right">{formatValue(asset.balance)}</td>
                                    <td className="py-2 px-3 text-right">${formatValue(asset.price, 2)}</td>
                                    <td className="py-2 px-3 text-right">${formatValue(asset.usdValue, 2)}</td>
                                </tr>
                            ))
                            : assetSummary.totalAssets.map((asset, idx) => (
                                <tr key={idx} className="border-t border-gray-200">
                                    <td className="py-2 px-3">{asset.symbol}</td>
                                    <td className="py-2 px-3 text-right">{formatValue(asset.balance)}</td>
                                </tr>
                            ))
                        }
                    </tbody>
                </table>
            </div>

            {/* Chain breakdown */}
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