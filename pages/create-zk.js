/**
 * Zero-Knowledge Proof Creation Page
 * 
 * This page allows users to create zero-knowledge proofs of their wallet balances
 * without revealing the actual amounts. The proofs are cryptographically secure
 * and can be verified by third parties using a reference ID and access key.
 * 
 * Key Features:
 * - Support for multiple proof types (standard, threshold, maximum)
 * - Wallet balance detection and verification
 * - Generation of secure reference IDs and access keys
 * - Local storage of encrypted proof data
 * - Shareable proof links
 * 
 * Technical Implementation:
 * - Uses zkProofGenerator to create zero-knowledge proofs
 * - Implements encryption for secure proof storage
 * - Generates unique reference IDs for proof sharing
 * - Stores proof data in localStorage for persistence
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { generateZKProof, createProofPackage } from '../lib/zk/zkProofGenerator';
import { formatReferenceId } from '../lib/zk/referenceId';
import ShareProofDialog from '../components/ShareProofDialog';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import Layout from '../components/Layout';

// This page is now integrated into the main create.js page with tabs
// This file exists for backward compatibility
export default function CreateZKProof() {
    const router = useRouter();
    
    // Redirect to the main create page with zk tab selected
    useEffect(() => {
        router.push({
            pathname: '/create',
            query: { tab: 'zk' }
        });
    }, [router]);
    
    // Return loading state while redirecting
    return (
        <Layout title="Redirecting...">
            <div className="container mx-auto px-4 py-8 max-w-4xl text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Redirecting to the new Create Proof page with Zero-Knowledge functionality...</p>
            </div>
        </Layout>
    );
    
    // Set the wallet address from the connected wallet
    useEffect(() => {
        if (isConnected && address) {
            setWalletAddress(address);
            // Try to detect balance
            detectBalance(address);
        }
    }, [isConnected, address]);
    
    // Detect wallet balance from the blockchain
    const detectBalance = async (address) => {
        if (!address) return;
        
        setDetectingBalance(true);
        
        try {
            // Use ethers to get the balance
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const balanceWei = await provider.getBalance(address);
            const balanceEth = ethers.utils.formatEther(balanceWei);
            
            // Update form
            setBalance(balanceWei.toString());
            
            // Set a default threshold at 50% of the balance
            const halfBalance = balanceWei.div(2);
            setThreshold(halfBalance.toString());
        } catch (error) {
            console.error('Error detecting balance:', error);
            setError(`Could not detect balance: ${error.message}`);
        } finally {
            setDetectingBalance(false);
        }
    };
    
    // Handle form submission to create a ZK proof
    const handleCreateProof = async (e) => {
        e.preventDefault();
        
        // Validate inputs
        if (!walletAddress || !balance || (proofType !== 0 && !threshold)) {
            setError('Please fill in all required fields');
            return;
        }
        
        setLoading(true);
        setError('');
        
        try {
            console.log('Creating proof with:', {
                walletAddress,
                balance,
                threshold: threshold || balance,
                proofType,
                expiryDays
            });
            
            // Convert expiry days to timestamp (seconds since epoch)
            const expiryTime = Math.floor(Date.now() / 1000) + (expiryDays * 86400);
            
            // Generate the ZK proof (using Wei values for the blockchain)
            const zkProof = await generateZKProof(
                walletAddress,
                balance, // Already in Wei format from form
                threshold || balance, // Use threshold if available, otherwise use balance for standard proofs
                proofType,
                'ethereum' // Default to Ethereum network
            );
            
            console.log('Generated ZK proof:', zkProof);
            
            // Create a proof package with encryption and reference ID
            const proofPackage = await createProofPackage(
                zkProof,
                walletAddress,
                proofType === 0 ? balance : threshold, // Amount depends on proof type
                proofType,
                expiryTime
            );
            
            console.log('Created proof package:', proofPackage);
            
            // Store in localStorage
            localStorage.setItem(
                `zkproof_${proofPackage.referenceId}`,
                JSON.stringify(proofPackage)
            );
            
            // Format the reference ID for display
            const formattedReferenceId = formatReferenceId(proofPackage.referenceId);
            
            // Set the created proof for sharing
            setCreatedProof({
                ...proofPackage,
                formattedReferenceId
            });
            
            // Show the share dialog
            setShowShareDialog(true);
        } catch (err) {
            console.error('Error creating ZK proof:', err);
            setError(err.message || 'Failed to create ZK proof');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Layout title="Create Zero-Knowledge Proof">
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <header className="mb-8">
                    <div className="flex justify-between items-center">
                        <h1 className="text-3xl font-bold text-gray-800">Create Zero-Knowledge Proof</h1>
                    </div>
                    <p className="mt-2 text-gray-600">
                        Create a privacy-preserving proof of your wallet balance without revealing the exact amount.
                    </p>
                </header>
            
            <main>
                <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                    {!isConnected ? (
                        <div className="text-center py-8">
                            <h2 className="text-xl font-medium mb-4">Connect Your Wallet</h2>
                            <p className="text-gray-600 mb-6">
                                Please connect your wallet to create a zero-knowledge proof.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleCreateProof}>
                            <div className="mb-4">
                                <label htmlFor="walletAddress" className="block text-gray-700 font-medium mb-2">
                                    Wallet Address
                                </label>
                                <input
                                    id="walletAddress"
                                    type="text"
                                    value={walletAddress}
                                    onChange={(e) => setWalletAddress(e.target.value)}
                                    disabled
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-100"
                                />
                                <p className="mt-1 text-sm text-gray-500">
                                    Using your connected wallet address.
                                </p>
                            </div>
                            
                            <div className="mb-4">
                                <label htmlFor="proofType" className="block text-gray-700 font-medium mb-2">
                                    Proof Type
                                </label>
                                <select
                                    id="proofType"
                                    value={proofType}
                                    onChange={(e) => setProofType(Number(e.target.value))}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value={0}>Standard (Equal To)</option>
                                    <option value={1}>Threshold (Greater Than or Equal)</option>
                                    <option value={2}>Maximum (Less Than or Equal)</option>
                                </select>
                                <p className="mt-1 text-sm text-gray-500">
                                    {proofType === 0 ? 
                                        "Proves that your balance is exactly equal to a specific amount." :
                                    proofType === 1 ? 
                                        "Proves that your balance is greater than or equal to a threshold." :
                                        "Proves that your balance is less than or equal to a maximum amount."}
                                </p>
                            </div>
                            
                            {proofType !== 0 && (
                                <div className="mb-4">
                                    <label htmlFor="threshold" className="block text-gray-700 font-medium mb-2">
                                        {proofType === 1 ? "Threshold Amount" : "Maximum Amount"} (in wei)
                                    </label>
                                    <input
                                        id="threshold"
                                        type="text"
                                        value={threshold}
                                        onChange={(e) => setThreshold(e.target.value)}
                                        placeholder="Enter amount in wei"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <p className="mt-1 text-sm text-gray-500">
                                        {proofType === 1 ? 
                                            "The amount that you want to prove your balance is greater than or equal to." :
                                            "The amount that you want to prove your balance is less than or equal to."}
                                    </p>
                                </div>
                            )}
                            
                            <div className="mb-4">
                                <label htmlFor="expiryDays" className="block text-gray-700 font-medium mb-2">
                                    Proof Expiry
                                </label>
                                <select
                                    id="expiryDays"
                                    value={expiryDays}
                                    onChange={(e) => setExpiryDays(Number(e.target.value))}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value={1}>1 day</option>
                                    <option value={7}>7 days</option>
                                    <option value={30}>30 days</option>
                                    <option value={90}>90 days</option>
                                    <option value={180}>180 days</option>
                                    <option value={365}>365 days</option>
                                </select>
                                <p className="mt-1 text-sm text-gray-500">
                                    How long this proof will be valid for.
                                </p>
                            </div>
                            
                            {error && (
                                <div className="mb-4 p-4 bg-red-100 border border-red-300 text-red-700 rounded-md">
                                    {error}
                                </div>
                            )}
                            
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={loading || !walletAddress || !balance}
                                    className={`px-6 py-2 rounded-md font-medium ${
                                        loading || !walletAddress || !balance ? 
                                            'bg-gray-300 text-gray-500 cursor-not-allowed' : 
                                            'bg-blue-500 text-white hover:bg-blue-600'
                                    }`}
                                >
                                    {loading ? 'Creating Proof...' : 'Create Proof'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-medium mb-4">About Zero-Knowledge Proofs</h2>
                    <p className="text-gray-600 mb-4">
                        Zero-Knowledge proofs allow you to prove statements about your wallet balance without revealing
                        the actual amount. This provides enhanced privacy and security when sharing proof of funds.
                    </p>
                    
                    <h3 className="text-lg font-medium mt-6 mb-2">Proof Types</h3>
                    <div className="space-y-4">
                        <div className="p-4 border border-gray-200 rounded-md">
                            <h4 className="font-medium">Standard (Equal To)</h4>
                            <p className="text-gray-600 mt-1">
                                Proves that your wallet has exactly the specified amount.
                            </p>
                        </div>
                        
                        <div className="p-4 border border-gray-200 rounded-md">
                            <h4 className="font-medium">Threshold (Greater Than or Equal)</h4>
                            <p className="text-gray-600 mt-1">
                                Proves that your wallet has at least the specified amount.
                            </p>
                        </div>
                        
                        <div className="p-4 border border-gray-200 rounded-md">
                            <h4 className="font-medium">Maximum (Less Than or Equal)</h4>
                            <p className="text-gray-600 mt-1">
                                Proves that your wallet has at most the specified amount.
                            </p>
                        </div>
                    </div>
                    
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mt-6">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-blue-800">Privacy Notice</h3>
                                <div className="mt-2 text-sm text-blue-700">
                                    <p>
                                        Your proofs are stored locally in your browser. Make sure to save the reference ID
                                        and access key, as they're needed to verify your proof. These proofs will be lost
                                        if you clear your browser data.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            
            {/* Share Dialog for Created Proofs */}
            {showShareDialog && createdProof && (
                <ShareProofDialog
                    referenceId={createdProof.formattedReferenceId}
                    accessKey={createdProof.accessKey}
                    onClose={() => setShowShareDialog(false)}
                    onManage={() => router.push('/manage')}
                />
            )}
            </div>
        </Layout>
    );
}