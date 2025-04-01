/**
 * Verification Result Component
 * 
 * Displays the result of a proof verification
 */

import React from 'react';

const VerificationResult = ({ result }) => {
    if (!result) {
        return null;
    }

    const {
        isValid,
        isExpired,
        isRevoked,
        proofType,
        createdAt,
        expiresAt,
        walletAddress,
        amount,
        threshold,
        status
    } = result;

    // Determine status display
    let statusDisplay = 'Unknown';
    let statusColor = 'gray';

    if (isRevoked) {
        statusDisplay = 'Revoked';
        statusColor = 'red';
    } else if (isExpired) {
        statusDisplay = 'Expired';
        statusColor = 'orange';
    } else if (isValid) {
        statusDisplay = 'Valid';
        statusColor = 'green';
    } else {
        statusDisplay = 'Invalid';
        statusColor = 'red';
    }

    // Format dates
    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    // Format the wallet address
    const formatAddress = (address) => {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    // Format the proof type
    const getProofTypeText = () => {
        switch (proofType) {
            case 0:
                return 'Standard (Exact Amount)';
            case 1:
                return 'Threshold (Minimum Amount)';
            case 2:
                return 'Maximum (Maximum Amount)';
            default:
                return 'Unknown';
        }
    };

    // Format ETH amount
    const formatAmount = (amountWei) => {
        if (!amountWei) return '0';
        try {
            // Convert Wei to ETH
            const amountEth = parseFloat(amountWei) / 1e18;
            return amountEth.toFixed(4) + ' ETH';
        } catch (e) {
            return amountWei.toString();
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Verification Result</h2>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold text-${statusColor}-800 bg-${statusColor}-100`}>
                    {statusDisplay}
                </span>
            </div>

            <div className="border-t border-gray-200 pt-4">
                <dl className="divide-y divide-gray-200">
                    <div className="py-3 grid grid-cols-3 gap-4">
                        <dt className="text-sm font-medium text-gray-500">Proof Type</dt>
                        <dd className="text-sm text-gray-900 col-span-2">{getProofTypeText()}</dd>
                    </div>

                    <div className="py-3 grid grid-cols-3 gap-4">
                        <dt className="text-sm font-medium text-gray-500">Wallet Address</dt>
                        <dd className="text-sm text-gray-900 col-span-2">{formatAddress(walletAddress)}</dd>
                    </div>

                    {amount && (
                        <div className="py-3 grid grid-cols-3 gap-4">
                            <dt className="text-sm font-medium text-gray-500">
                                {proofType === 1 ? 'Minimum Amount' : proofType === 2 ? 'Maximum Amount' : 'Amount'}
                            </dt>
                            <dd className="text-sm text-gray-900 col-span-2">{formatAmount(amount)}</dd>
                        </div>
                    )}

                    <div className="py-3 grid grid-cols-3 gap-4">
                        <dt className="text-sm font-medium text-gray-500">Created</dt>
                        <dd className="text-sm text-gray-900 col-span-2">{formatDate(createdAt)}</dd>
                    </div>

                    <div className="py-3 grid grid-cols-3 gap-4">
                        <dt className="text-sm font-medium text-gray-500">Expires</dt>
                        <dd className="text-sm text-gray-900 col-span-2">{formatDate(expiresAt)}</dd>
                    </div>
                </dl>
            </div>

            {!isValid && (
                <div className={`mt-4 bg-${isExpired ? 'orange' : 'red'}-50 border-l-4 border-${isExpired ? 'orange' : 'red'}-500 p-4`}>
                    <p className="text-sm text-gray-700">
                        {isRevoked ? 'This proof has been revoked by the creator.' :
                            isExpired ? 'This proof has expired. Please request an updated proof.' :
                                'This proof is invalid. The verification failed.'}
                    </p>
                </div>
            )}

            {isValid && (
                <div className="mt-4 bg-green-50 border-l-4 border-green-500 p-4">
                    <p className="text-sm text-gray-700">
                        {proofType === 0 ? 'The wallet contains exactly the verified amount.' :
                            proofType === 1 ? 'The wallet contains at least the minimum amount.' :
                                'The wallet contains at most the maximum amount.'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default VerificationResult;